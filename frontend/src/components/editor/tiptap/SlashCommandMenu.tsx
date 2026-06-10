import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
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
      { id: 'divider', label: 'Divider', description: 'Horizontal rule', keywords: ['hr', '---', 'separator'], execute: (e) => e.chain().focus().setHorizontalRule().run() },
    ],
  },
  {
    label: 'Media',
    items: [
      { id: 'table', label: 'Table', description: 'Insert a table', keywords: ['grid', '3x3'], execute: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id: 'image', label: 'Image', description: 'Insert an image', keywords: ['img', 'picture', 'photo'], execute: (e) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = () => {
          const file = input.files?.[0]
          if (file) {
            const url = URL.createObjectURL(file)
            e.chain().focus().setFigure({ src: url, alt: file.name }).run()
          }
        }
        input.click()
        return true
      }},
      { id: 'mermaid', label: 'Mermaid Diagram', description: 'Architecture diagram', keywords: ['diagram', 'chart', 'flow'], execute: (e) => e.chain().focus().setMermaidDiagram({ code: 'graph TD\n  A-->B' }).run() },
    ],
  },
]

/* ── SlashCommand TipTap Extension ─────────────────────────────────── */

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addStorage() {
    return {
      open: false,
      query: '',
      range: null as { from: number; to: number } | null,
      selectedIndex: 0,
      position: { top: 0, left: 0 },
    }
  },

  addKeyboardShortcuts() {
    return {
      '/': () => {
        const { editor } = this
        const { selection } = editor.state
        const { $from } = selection
        const isCode = $from.parent.type.name === 'codeBlock' || $from.parent.type.name === 'code'
        if (isCode) return false
        const atLineStart = $from.parentOffset <= 1
        if (!atLineStart) return false
        const storage = this.storage as SlashStorage
        const pos = editor.view.coordsAtPos($from.pos)
        storage.open = true
        storage.query = ''
        storage.selectedIndex = 0
        storage.range = { from: $from.pos, to: $from.pos }
        storage.position = { top: pos.bottom + 4, left: pos.left }
        return false
      },
    }
  },

  addProseMirrorPlugins() {
    const extension = this
    return [
      new Plugin({
        key: new PluginKey('slashCommandInput'),
        props: {
          handleKeyDown(view, event) {
            const storage = (extension.storage as SlashStorage)
            if (!storage.open) return false

            if (event.key === 'Enter') {
              event.preventDefault()
              return true
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              return true
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              return true
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              storage.open = false
              return true
            }
            if (event.key === 'Backspace') {
              const query = storage.query
              if (query.length === 0) {
                storage.open = false
              } else {
                storage.query = query.slice(0, -1)
                storage.selectedIndex = 0
              }
              return false
            }
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              if (event.key === '/' && storage.query.length === 0) return false
              if (event.key === ' ') {
                storage.open = false
                return false
              }
              storage.query = storage.query + event.key
              storage.selectedIndex = 0
              return false
            }
            if (event.key === ' ') {
              storage.open = false
              return false
            }
            return false
          },
        },
      }),
    ]
  },
})

type SlashStorage = ReturnType<ReturnType<typeof Extension.create>['addStorage']> & {
  open: boolean
  query: string
  range: { from: number; to: number } | null
  selectedIndex: number
  position: { top: number; left: number }
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
  const [range, setRange] = useState<{ from: number; to: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = commandGroups.flatMap(g => g.items)
  const filtered = query
    ? allItems.filter(item =>
        [item.id, item.label, item.description, ...item.keywords].some(s =>
          s.toLowerCase().includes(query.toLowerCase()),
        ),
      )
    : allItems
  const filteredSet = useRef(new Set(filtered))
  filteredSet.current = new Set(filtered)

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
    tr.delete(range.from, range.to)
    dispatch(tr)
    item.execute(editor)
    setOpen(false)
    editor.chain().focus().run()
  }, [editor, range])

  useEffect(() => {
    if (!editor) return
    const storage = (editor.extensionManager.extensions.find(
      (e) => e.name === 'slashCommand',
    )?.storage ?? {}) as SlashStorage

    const poll = () => {
      if (storage.open !== open) {
        setOpen(storage.open)
        setQuery(storage.query)
        setSelectedIndex(storage.selectedIndex)
        setPosition(storage.position)
        setRange(storage.range)
        if (storage.open) {
          setTimeout(() => inputRef.current?.focus(), 10)
        }
      } else if (storage.query !== query) {
        setQuery(storage.query)
        setSelectedIndex(storage.selectedIndex)
      }
      pollRef.current = window.setTimeout(poll, 50)
    }
    pollRef.current = window.setTimeout(poll, 50)
    return () => {
      if (pollRef.current !== null) clearTimeout(pollRef.current)
    }
  }, [editor, open, query])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        if (editor) {
          const storage = (editor.extensionManager.extensions.find(
            (e) => e.name === 'slashCommand',
          )?.storage ?? {}) as SlashStorage
          storage.open = false
        }
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, editor])

  useEffect(() => {
    if (!open || !editor) return
    const storage = (editor.extensionManager.extensions.find(
      (e) => e.name === 'slashCommand',
    )?.storage ?? {}) as SlashStorage

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        if (filtered[selectedIndex]) {
          execute(filtered[selectedIndex])
        }
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = (selectedIndex + 1) % filtered.length
        setSelectedIndex(next)
        storage.selectedIndex = next
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = (selectedIndex - 1 + filtered.length) % filtered.length
        setSelectedIndex(prev)
        storage.selectedIndex = prev
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        storage.open = false
        return
      }
      if (e.key === 'Backspace') {
        if (query.length === 0) {
          setOpen(false)
          storage.open = false
          return
        }
        const next = query.slice(0, -1)
        setQuery(next)
        storage.query = next
        storage.selectedIndex = 0
        setSelectedIndex(0)
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const next = query + e.key
        setQuery(next)
        storage.query = next
        storage.selectedIndex = 0
        setSelectedIndex(0)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, editor, query, selectedIndex, filtered, execute])

  if (!open || !editor) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 rounded-lg border border-border bg-popover py-2 shadow-lg max-h-80 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 pb-1.5">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const next = e.target.value
            setQuery(next)
            if (editor) {
              const storage = (editor.extensionManager.extensions.find(
                (ex) => ex.name === 'slashCommand',
              )?.storage ?? {}) as SlashStorage
              storage.query = next
              storage.selectedIndex = 0
            }
            setSelectedIndex(0)
          }}
          placeholder="Search commands..."
          className="w-full rounded-md border border-border bg-muted px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-interaction focus:ring-1 focus:ring-interaction"
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      {resultGroups.map((group) => (
        <div key={group.label}>
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </div>
          {group.items.map((item) => {
            const isSelected = filtered.indexOf(item) === selectedIndex
            return (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); execute(item) }}
                onMouseEnter={() => {
                  setSelectedIndex(filtered.indexOf(item))
                  const storage = (editor.extensionManager.extensions.find(
                    (ex) => ex.name === 'slashCommand',
                  )?.storage ?? {}) as SlashStorage
                  storage.selectedIndex = filtered.indexOf(item)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                  isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground',
                )}
              >
                <span className="flex-1">
                  <span className="font-medium">{highlightMatch(item.label, query)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="px-3 py-4 text-center text-meta-sm text-muted-foreground">
          No commands match &quot;{query}&quot;
        </div>
      )}
    </div>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-interaction/20 text-foreground">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}
