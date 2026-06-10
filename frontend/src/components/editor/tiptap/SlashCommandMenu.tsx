import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  label: string
  description: string
  keywords: string[]
  icon?: string
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
      { id: 'bold', label: 'Bold', description: 'Bold text', keywords: ['b', 'strong'], execute: (e) => e.chain().focus().toggleBold().run() },
      { id: 'italic', label: 'Italic', description: 'Italic text', keywords: ['i', 'em'], execute: (e) => e.chain().focus().toggleItalic().run() },
      { id: 'strike', label: 'Strikethrough', description: 'Strikethrough text', keywords: ['s', 'del'], execute: (e) => e.chain().focus().toggleStrike().run() },
      { id: 'code', label: 'Inline Code', description: 'Monospaced code', keywords: ['mono', 'backtick'], execute: (e) => e.chain().focus().toggleCode().run() },
    ],
  },
  {
    label: 'Blocks',
    items: [
      { id: 'bullet-list', label: 'Bullet List', description: 'Unordered list', keywords: ['ul', 'list'], execute: (e) => e.chain().focus().toggleBulletList().run() },
      { id: 'ordered-list', label: 'Numbered List', description: 'Ordered list', keywords: ['ol', 'numbered'], execute: (e) => e.chain().focus().toggleOrderedList().run() },
      { id: 'task-list', label: 'Task List', description: 'Checklist', keywords: ['checkbox', 'todo', 'check'], execute: (e) => e.chain().focus().toggleTaskList().run() },
      { id: 'blockquote', label: 'Blockquote', description: 'Quote block', keywords: ['quote', '>'], execute: (e) => e.chain().focus().toggleBlockquote().run() },
      { id: 'code-block', label: 'Code Block', description: 'Code with syntax highlighting', keywords: ['pre', '```'], execute: (e) => e.chain().focus().toggleCodeBlock().run() },
      { id: 'callout', label: 'Callout', description: 'Info/note callout', keywords: ['note', 'info', 'warning'], execute: (e) => e.chain().focus().setCallout({ type: 'note' }).run() },
    ],
  },
  {
    label: 'Media',
    items: [
      { id: 'table', label: 'Table', description: 'Insert a table', keywords: ['grid'], execute: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id: 'divider', label: 'Divider', description: 'Horizontal rule', keywords: ['hr', '---', 'separator'], execute: (e) => e.chain().focus().setHorizontalRule().run() },
    ],
  },
]

interface SlashCommandMenuProps {
  editor: Editor | null
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<{ from: number; to: number } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const slashPos = useRef<{ top: number; left: number } | null>(null)

  const allItems = commandGroups.flatMap(g => g.items)
  const filtered = query
    ? allItems.filter(item =>
        [item.id, item.label, item.description, ...item.keywords].some(s =>
          s.toLowerCase().includes(query.toLowerCase()),
        ),
      )
    : allItems
  const resultGroups = query
    ? [{ label: 'Commands', items: filtered }]
    : commandGroups.map(g => ({
        ...g,
        items: g.items,
      })).filter(g => g.items.length > 0)

  const execute = useCallback((item: CommandItem) => {
    if (!editor || !range) return
    const { state, dispatch } = editor.view
    const tr = state.tr
    const slashText = state.doc.textBetween(range.from, range.to)
    if (slashText) {
      tr.delete(range.from, range.to)
      dispatch(tr)
    }
    item.execute(editor)
    setOpen(false)
    editor.chain().focus().run()
  }, [editor, range])

  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        const { selection } = editor.state
        const { $from } = selection
        const isCodeBlock = $from.parent.type.name === 'codeBlock' || $from.parent.type.name === 'code'
        if (isCodeBlock) return
        const textBefore = $from.nodeBefore?.textContent || ''
        const atLineStart = $from.parentOffset <= 1
        if (atLineStart || textBefore === '') {
          setTimeout(() => {
            const pos = editor.view.coordsAtPos($from.pos)
            slashPos.current = { top: pos.bottom + 4, left: pos.left }
            setQuery('')
            setSelectedIndex(0)
            setRange({ from: $from.pos, to: $from.pos })
            setOpen(true)
          }, 0)
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!open) return
      if (event.key === 'Enter') {
        event.preventDefault()
        if (filtered[selectedIndex]) {
          execute(filtered[selectedIndex])
        }
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filtered.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key === 'Backspace') {
        if (query.length === 0) {
          setOpen(false)
          return
        }
        setQuery(prev => prev.slice(0, -1))
        setSelectedIndex(0)
        return
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        setQuery(prev => prev + event.key)
        setSelectedIndex(0)
      }
    }

    editor.view.dom.addEventListener('keydown', handleKeyDown)
    editor.view.dom.addEventListener('keyup', handleKeyUp)

    return () => {
      editor.view.dom.removeEventListener('keydown', handleKeyDown)
      editor.view.dom.removeEventListener('keyup', handleKeyUp)
    }
  }, [editor, open, query, filtered, selectedIndex, execute])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!open || !editor) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 rounded-lg border border-border bg-popover py-1 shadow-lg max-h-80 overflow-y-auto"
      style={{ top: slashPos.current?.top ?? 0, left: slashPos.current?.left ?? 0 }}
    >
      {resultGroups.map((group) => (
        <div key={group.label}>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </div>
          {group.items.map((item, idx) => {
            const globalIdx = filtered.indexOf(item)
            return (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); execute(item) }}
                onMouseEnter={() => setSelectedIndex(globalIdx)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                  selectedIndex === globalIdx ? 'bg-accent text-accent-foreground' : 'text-foreground',
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
    </div>
  )
}
