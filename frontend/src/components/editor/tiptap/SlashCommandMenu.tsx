import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  label: string
  description: string
  keywords: string[]
  execute: (editor: Editor) => boolean
}

function createCommandGroups(
  onInsertImage?: (file: File) => void | Promise<void>,
  onAiCommand?: (prompt: string) => void,
): { label: string; items: CommandItem[] }[] {
  return [
  ...(onAiCommand ? [{
    label: 'AI',
    items: [
      { id: 'ai-ask', label: 'Ask AI', description: 'Ask about this section', keywords: ['ask', 'mark', 'chat'], execute: (e: Editor) => { onAiCommand('Help me improve this section.'); e.chain().focus().run(); return true } },
      { id: 'ai-insert', label: 'Insert with AI', description: 'Generate content here', keywords: ['generate', 'insert', 'draft'], execute: (e: Editor) => { onAiCommand('Insert a useful paragraph at the cursor for this section.'); e.chain().focus().run(); return true } },
      { id: 'ai-rewrite', label: 'Rewrite Section', description: 'Queue a rewrite card', keywords: ['rewrite', 'refine'], execute: (e: Editor) => { onAiCommand('Rewrite this section for clarity and completeness.'); e.chain().focus().run(); return true } },
      { id: 'ai-explain', label: 'Explain Selection', description: 'Explain selected text', keywords: ['explain', 'selection'], execute: (e: Editor) => { onAiCommand('Explain the selected text in the context of this documentation.'); e.chain().focus().run(); return true } },
    ],
  }] : []),
  {
    label: 'Text',
    items: [
      { id: 'paragraph', label: 'Paragraph', description: 'Plain text', keywords: ['p', 'normal'], execute: (e) => e.chain().focus().setParagraph().run() },
      { id: 'heading-1', label: 'Heading 1', description: 'Large heading', keywords: ['h1', '#'], execute: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
      { id: 'heading-2', label: 'Heading 2', description: 'Medium heading', keywords: ['h2', '##'], execute: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
      { id: 'heading-3', label: 'Heading 3', description: 'Small heading', keywords: ['h3', '###'], execute: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    ],
  },
  {
    label: 'Formatting',
    items: [
      { id: 'bold', label: 'Bold', description: 'Bold text', keywords: ['b', 'strong'], execute: (e) => e.chain().focus().toggleBold().run() },
      { id: 'italic', label: 'Italic', description: 'Italic text', keywords: ['i', 'em'], execute: (e) => e.chain().focus().toggleItalic().run() },
      { id: 'code', label: 'Inline Code', description: 'Monospaced code', keywords: ['mono', 'backtick'], execute: (e) => e.chain().focus().toggleCode().run() },
    ],
  },
  {
    label: 'Blocks',
    items: [
      { id: 'bullet-list', label: 'Bullet List', description: 'Unordered list', keywords: ['ul', 'list'], execute: (e) => e.chain().focus().toggleBulletList().run() },
      { id: 'ordered-list', label: 'Numbered List', description: 'Ordered list', keywords: ['ol', 'numbered'], execute: (e) => e.chain().focus().toggleOrderedList().run() },
      { id: 'blockquote', label: 'Blockquote', description: 'Quote block', keywords: ['quote', '>'], execute: (e) => e.chain().focus().toggleBlockquote().run() },
      { id: 'code-block', label: 'Code Block', description: 'Code with syntax highlighting', keywords: ['pre', '```'], execute: (e) => e.chain().focus().toggleCodeBlock().run() },
      { id: 'callout', label: 'Callout', description: 'Info/note callout', keywords: ['note', 'info', 'warning'], execute: (e) => e.chain().focus().setCallout({ type: 'info' }).run() },
      { id: 'divider', label: 'Divider', description: 'Horizontal rule', keywords: ['hr', '---'], execute: (e) => e.chain().focus().setHorizontalRule().run() },
    ],
  },
  {
    label: 'Media',
    items: [
      { id: 'table', label: 'Table', description: 'Insert a 3x3 table', keywords: ['grid'], execute: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id: 'image', label: 'Image', description: 'Insert an image', keywords: ['img', 'picture'], execute: (e) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = () => {
          const file = input.files?.[0]
          if (!file) return
          if (onInsertImage) void onInsertImage(file)
          else e.chain().focus().setImage({ src: URL.createObjectURL(file), alt: file.name }).run()
        }
        input.click()
        return true
      }},
      { id: 'mermaid', label: 'Mermaid Diagram', description: 'Architecture diagram', keywords: ['diagram', 'chart'], execute: (e) => e.chain().focus().setMermaidDiagram({ code: 'graph TD\n  A-->B' }).run() },
    ],
  },
  ]
}

interface SlashState {
  open: boolean
  query: string
  range: { from: number; to: number } | null
  selectedIndex: number
  position: { top: number; left: number }
}

export function SlashCommandMenu({
  editor,
  onInsertImage,
  onAiCommand,
}: {
  editor: Editor | null
  onInsertImage?: (file: File) => void | Promise<void>
  onAiCommand?: (prompt: string) => void
}) {
  const [state, setState] = useState<SlashState>({
    open: false,
    query: '',
    range: null,
    selectedIndex: 0,
    position: { top: 0, left: 0 },
  })
  const menuRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(false)

  useEffect(() => {
    openRef.current = state.open
  }, [state.open])

  const commandGroups = createCommandGroups(onInsertImage, onAiCommand)
  const allItems = commandGroups.flatMap(g => g.items)

  const filtered = state.query
    ? allItems.filter(item =>
        [item.id, item.label, item.description, ...item.keywords].some(s =>
          s.toLowerCase().includes(state.query.toLowerCase()),
        ),
      )
    : allItems

  const clampedIndex = Math.min(state.selectedIndex, Math.max(0, filtered.length - 1))

  const resultGroups = state.query
    ? [{ label: 'Commands', items: filtered }]
    : commandGroups.map(g => ({ ...g, items: g.items })).filter(g => g.items.length > 0)

  const close = useCallback(() => {
    setState(s => ({ ...s, open: false }))
  }, [])

  const execute = useCallback((item: CommandItem) => {
    if (!editor || !state.range) return
    editor
      .chain()
      .focus()
      .deleteRange({ from: state.range.from, to: state.range.to })
      .run()
    item.execute(editor)
    close()
  }, [editor, state.range, close])

  const updateSlashState = useCallback(() => {
    if (!editor) return
    const { selection } = editor.state
    const { $from } = selection
    const node = $from.parent
    if (node.type.name === 'codeBlock' || node.type.name === 'code' || !selection.empty) {
      if (openRef.current) close()
      return
    }

    const blockStart = $from.start()
    const cursorPos = $from.pos
    const textBefore = editor.state.doc.textBetween(blockStart, cursorPos)
    const slashIndex = textBefore.lastIndexOf('/')
    if (slashIndex === -1) {
      if (openRef.current) close()
      return
    }

    const beforeSlash = textBefore.slice(0, slashIndex)
    const query = textBefore.slice(slashIndex + 1)
    if (query.includes(' ') || !/^\s*$/.test(beforeSlash)) {
      if (openRef.current) close()
      return
    }

    const from = blockStart + slashIndex
    const coords = editor.view.coordsAtPos(cursorPos)
    setState(s => ({
      ...s,
      open: true,
      query,
      range: { from, to: cursorPos },
      position: { top: coords.bottom + 4, left: coords.left },
      selectedIndex: s.query !== query ? 0 : s.selectedIndex,
    }))
  }, [close, editor])

  /* ── Track editor transactions for / at cursor ──────────────────── */
  useEffect(() => {
    if (!editor) return
    let frame: number | null = null
    const schedule = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateSlashState)
    }
    editor.on('update', schedule)
    editor.on('selectionUpdate', schedule)
    editor.on('focus', schedule)
    editor.on('blur', close)
    schedule()
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      editor.off('update', schedule)
      editor.off('selectionUpdate', schedule)
      editor.off('focus', schedule)
      editor.off('blur', close)
    }
  }, [editor, close, updateSlashState])

  /* ── Capture-phase keydown interception ────────────────────────── */
  useEffect(() => {
    if (!state.open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const item = filtered[clampedIndex]
        if (item) execute(item)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        if (filtered.length === 0) return
        setState(s => ({ ...s, selectedIndex: (s.selectedIndex + 1) % filtered.length }))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        if (filtered.length === 0) return
        setState(s => ({ ...s, selectedIndex: (s.selectedIndex - 1 + filtered.length) % filtered.length }))
        return
      }
      if (e.key === ' ') {
        e.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', handler, { capture: true })
    return () => document.removeEventListener('keydown', handler, { capture: true })
  }, [state.open, filtered, clampedIndex, execute, close])

  /* ── Click outside to close ────────────────────────────────────── */
  useEffect(() => {
    if (!state.open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [state.open, close])

  /* ── Reset selectedIndex when query narrows ────────────────────── */
  useEffect(() => {
    if (state.open) setState(s => ({ ...s, selectedIndex: 0 }))
  }, [state.query])

  /* ── Auto-scroll selected item into view ─────────────────────── */
  useEffect(() => {
    if (!state.open || !menuRef.current) return
    const selected = menuRef.current.querySelector<HTMLButtonElement>(`[data-slash-item="${clampedIndex}"]`)
    selected?.scrollIntoView({ block: 'nearest' })
  }, [state.open, clampedIndex])

  if (!state.open || !editor) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 rounded-lg border border-border bg-popover py-1 shadow-lg max-h-72 overflow-y-auto"
      style={{ top: state.position.top, left: state.position.left }}
    >
      {resultGroups.map((group) => (
        <div key={group.label}>
          <div className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </div>
          {group.items.map((item) => {
            const globalIdx = filtered.indexOf(item)
            const isSelected = globalIdx === clampedIndex
            return (
              <button
                key={item.id}
                type="button"
                data-slash-item={globalIdx}
                onMouseDown={(e) => { e.preventDefault(); execute(item) }}
                onMouseEnter={() => setState(s => ({ ...s, selectedIndex: globalIdx }))}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1 text-left text-sm transition-colors',
                  isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground',
                )}
              >
                <span className="flex-1">
                  <span className="font-medium">{item.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="px-3 py-3 text-center text-xs text-muted-foreground">
          No commands match &quot;{state.query}&quot;
        </div>
      )}
    </div>
  )
}
