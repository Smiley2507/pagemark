import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  label: string
  description: string
  keywords: string[]
  execute: (editor: Editor) => boolean
}

const commandGroups: { label: string; items: CommandItem[] }[] = [
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
      { id: 'callout', label: 'Callout', description: 'Info/note callout', keywords: ['note', 'info', 'warning'], execute: (e) => e.chain().focus().setCallout({ type: 'note' }).run() },
      { id: 'divider', label: 'Divider', description: 'Horizontal rule', keywords: ['hr', '---'], execute: (e) => e.chain().focus().setHorizontalRule().run() },
    ],
  },
  {
    label: 'Media',
    items: [
      { id: 'table', label: 'Table', description: 'Insert a 3×3 table', keywords: ['grid'], execute: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id: 'image', label: 'Image', description: 'Insert an image', keywords: ['img', 'picture'], execute: (e) => {
        const input = document.createElement('input')
        input.type = 'file', input.accept = 'image/*'
        input.onchange = () => {
          const file = input.files?.[0]
          if (file) e.chain().focus().setFigure({ src: URL.createObjectURL(file), alt: file.name }).run()
        }
        input.click()
        return true
      }},
      { id: 'mermaid', label: 'Mermaid Diagram', description: 'Architecture diagram', keywords: ['diagram', 'chart'], execute: (e) => e.chain().focus().setMermaidDiagram({ code: 'graph TD\n  A-->B' }).run() },
    ],
  },
]

/* ── Plugin (single source of truth) ───────────────────────────────── */

interface SlashPluginState {
  open: boolean
  query: string
  range: { from: number; to: number } | null
  selectedIndex: number
  position: { top: number; left: number }
}

let pluginState: SlashPluginState = {
  open: false,
  query: '',
  range: null,
  selectedIndex: 0,
  position: { top: 0, left: 0 },
}

export const slashCommandPlugin = new Plugin({
  key: new PluginKey('slashCommand'),
  props: {
    handleKeyDown(view, event) {
      const { state } = view
      const { selection } = state
      const { $from } = selection

      if (!pluginState.open) {
        if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
          const isCode = $from.parent.type.name === 'codeBlock' || $from.parent.type.name === 'code'
          if (isCode) return false
          if ($from.parentOffset > 1) return false
          const pos = view.coordsAtPos($from.pos)
          pluginState = {
            open: true,
            query: '',
            range: { from: $from.pos, to: $from.pos + 1 },
            selectedIndex: 0,
            position: { top: pos.bottom + 4, left: pos.left },
          }
          return true
        }
        return false
      }

      event.preventDefault()

      if (event.key === 'Escape') {
        pluginState = { ...pluginState, open: false }
        return true
      }
      if (event.key === 'Enter') {
        return true
      }
      if (event.key === 'ArrowDown') {
        pluginState = { ...pluginState, selectedIndex: pluginState.selectedIndex + 1 }
        return true
      }
      if (event.key === 'ArrowUp') {
        pluginState = { ...pluginState, selectedIndex: Math.max(0, pluginState.selectedIndex - 1) }
        return true
      }
      if (event.key === 'Backspace') {
        if (pluginState.query.length === 0) {
          pluginState = { ...pluginState, open: false }
        } else {
          pluginState = { ...pluginState, query: pluginState.query.slice(0, -1), selectedIndex: 0 }
        }
        return true
      }
      if (event.key === ' ') {
        pluginState = { ...pluginState, open: false }
        return true
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        pluginState = { ...pluginState, query: pluginState.query + event.key, selectedIndex: 0 }
        return true
      }

      return true
    },
  },
})

export function getSlashPluginState(): SlashPluginState {
  return pluginState
}

export function resetSlashPluginState() {
  pluginState = { ...pluginState, open: false }
}

export function setSlashSelectedIndex(index: number) {
  pluginState = { ...pluginState, selectedIndex: index }
}

/* ── React Component ───────────────────────────────────────────────── */

interface SlashCommandMenuProps {
  editor: Editor | null
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = commandGroups.flatMap(g => g.items)

  const filtered = query
    ? allItems.filter(item =>
        [item.id, item.label, item.description, ...item.keywords].some(s =>
          s.toLowerCase().includes(query.toLowerCase()),
        ),
      )
    : allItems

  const clampedIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1))

  const resultGroups = query
    ? [{ label: 'Commands', items: filtered }]
    : commandGroups.map(g => ({ ...g, items: g.items })).filter(g => g.items.length > 0)

  const execute = useCallback((item: CommandItem) => {
    if (!editor) return
    const range = pluginState.range
    if (range) {
      const tr = editor.state.tr.delete(range.from, range.to)
      editor.view.dispatch(tr)
    }
    item.execute(editor)
    resetSlashPluginState()
  }, [editor])

  useEffect(() => {
    const poll = () => {
      const s = getSlashPluginState()
      setOpen(s.open)
      if (s.open) {
        setQuery(s.query)
        setPosition(s.position)
        const clamped = Math.min(s.selectedIndex, allItems.length - 1)
        setSelectedIndex(clamped)
      }
    }
    const id = setInterval(poll, 50)
    return () => clearInterval(id)
  }, [allItems.length])

  useEffect(() => {
    if (!open || !editor) return
    setTimeout(() => inputRef.current?.focus(), 10)

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!pluginState.open) return
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const item = filtered[selectedIndex >= filtered.length ? 0 : selectedIndex]
        if (item) execute(item)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = (selectedIndex + 1) % filtered.length
        setSelectedIndex(next)
        setSlashSelectedIndex(next)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = (selectedIndex - 1 + filtered.length) % filtered.length
        setSelectedIndex(prev)
        setSlashSelectedIndex(prev)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        resetSlashPluginState()
        return
      }
      if (e.key === 'Backspace') {
        const s = getSlashPluginState()
        if (!s.open) return
        if (s.query.length === 0) {
          resetSlashPluginState()
          return
        }
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const s = getSlashPluginState()
        setQuery(s.query)
        setSelectedIndex(0)
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [open, editor, selectedIndex, filtered, execute])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        resetSlashPluginState()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    const s = getSlashPluginState()
    if (s.query !== query) {
      setQuery(s.query)
      setSelectedIndex(0)
    }
  }, [open, query])

  if (!open || !editor) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 rounded-lg border border-border bg-popover py-1 shadow-lg max-h-72 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-2 pb-1 pt-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value
            pluginState = { ...pluginState, query: val, selectedIndex: 0 }
            setQuery(val)
            setSelectedIndex(0)
          }}
          placeholder="Search commands..."
          className="w-full rounded border border-border bg-muted px-2 py-1 text-sm text-foreground outline-none focus:border-foreground/30"
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
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
                onMouseDown={(e) => { e.preventDefault(); execute(item) }}
                onMouseEnter={() => { setSelectedIndex(globalIdx); setSlashSelectedIndex(globalIdx) }}
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
          No commands match &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}
