import { useCallback } from 'react'
import type { Editor } from '@tiptap/core'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editor: Editor
}

const COLOR_SWATCHES = [
  '#dc2626', '#ea580c', '#d97706', '#65a30d', '#16a34a', '#059669',
  '#0891b2', '#2563eb', '#7c3aed', '#9333ea', '#c026d3', '#be123c',
]

const HIGHLIGHT_COLORS = [
  '#fef08a', '#fde68a', '#bfdbfe', '#bbf7d0', '#fecaca', '#e9d5ff',
]

type ToolbarAction = {
  id: string
  label: string
  icon: React.ReactNode
  isActive?: (editor: Editor) => boolean
  action: (editor: Editor) => boolean | void
  divider?: boolean
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 px-1 border-r border-border/50 last:border-r-0">{children}</div>
}

function ToolbarBtn({ active, onClick, children, title }: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={cn(
        'flex items-center justify-center h-7 min-w-[28px] rounded-md text-sm transition-colors',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function ColorPicker({ label, colors, onSelect, currentColor, type }: {
  label: string
  colors: string[]
  onSelect: (color: string | null) => void
  currentColor?: string
  type: 'text' | 'highlight'
}) {
  return (
    <div className="relative group">
      <ToolbarBtn
        title={label}
        onClick={() => {}}
      >
        {type === 'text' ? (
          <span className="underline text-xs" style={{ color: currentColor || 'currentColor' }}>A</span>
        ) : (
          <span className="text-xs px-1" style={{ background: currentColor || 'transparent', borderRadius: 2 }}>A</span>
        )}
      </ToolbarBtn>
      <div className="absolute top-full left-0 mt-1 z-50 hidden group-hover:block group-focus-within:block">
        <div className="rounded-lg border border-border bg-popover p-2 shadow-lg w-44">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              title="Remove color"
              onMouseDown={(e) => { e.preventDefault(); onSelect(null) }}
              className="h-6 w-6 rounded border border-border flex items-center justify-center text-xs text-muted-foreground hover:bg-accent"
            >
              ✕
            </button>
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onMouseDown={(e) => { e.preventDefault(); onSelect(color) }}
                className={cn(
                  'h-6 w-6 rounded border transition-transform hover:scale-110',
                  currentColor === color ? 'border-foreground scale-110 ring-1 ring-foreground' : 'border-border',
                )}
                style={{ background: color }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function HeadingDropdown({ editor }: { editor: Editor }) {
  const levels = [
    { level: 0, label: 'Paragraph' },
    { level: 1, label: 'H1' },
    { level: 2, label: 'H2' },
    { level: 3, label: 'H3' },
    { level: 4, label: 'H4' },
    { level: 5, label: 'H5' },
    { level: 6, label: 'H6' },
  ]

  const currentHeading = levels.find(l => l.level > 0 ? editor.isActive('heading', { level: l.level }) : editor.isActive('paragraph'))
  const currentLabel = currentHeading?.label || 'P'

  return (
    <div className="relative group">
      <ToolbarBtn title="Heading">{currentLabel} ▾</ToolbarBtn>
      <div className="absolute top-full left-0 mt-1 z-50 hidden group-hover:block group-focus-within:block">
        <div className="rounded-lg border border-border bg-popover py-1 shadow-lg w-32">
          {levels.map((l) => (
            <button
              key={l.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                if (l.level === 0) editor.chain().focus().setParagraph().run()
                else editor.chain().focus().toggleHeading({ level: l.level as 1|2|3|4|5|6 }).run()
              }}
              className={cn(
                'w-full px-3 py-1 text-left text-sm transition-colors',
                (l.level > 0 ? editor.isActive('heading', { level: l.level }) : editor.isActive('paragraph'))
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const handleTextColor = useCallback((color: string | null) => {
    if (color) editor.chain().focus().setColor(color).run()
    else editor.chain().focus().unsetColor().run()
  }, [editor])

  const handleHighlight = useCallback((color: string | null) => {
    if (color) editor.chain().focus().toggleHighlight({ color }).run()
    else editor.chain().focus().toggleHighlight().run()
  }, [editor])

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-panel px-1.5 py-1 shadow-sm mb-2 sticky top-0 z-20">
      <ToolbarGroup>
        <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 4H2v3M2 4l3 3"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 4h3v3M13 4l-3 3"/></svg>
        </ToolbarBtn>
      </ToolbarGroup>

      <ToolbarGroup>
        <HeadingDropdown editor={editor} />
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong className="text-sm">B</strong>
        </ToolbarBtn>
        <ToolbarBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em className="text-sm">I</em>
        </ToolbarBtn>
        <ToolbarBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <span className="text-sm underline">U</span>
        </ToolbarBtn>
        <ToolbarBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <span className="text-sm line-through">S</span>
        </ToolbarBtn>
        <ToolbarBtn title="Inline Code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
          <code className="text-xs">&lt;/&gt;</code>
        </ToolbarBtn>
      </ToolbarGroup>

      <ToolbarGroup>
        <ColorPicker
          label="Text color"
          colors={COLOR_SWATCHES}
          onSelect={handleTextColor}
          currentColor={editor.getAttributes('textStyle').color}
          type="text"
        />
        <ColorPicker
          label="Highlight color"
          colors={HIGHLIGHT_COLORS}
          onSelect={handleHighlight}
          currentColor={editor.getAttributes('highlight').color}
          type="highlight"
        />
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarBtn title="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="3" cy="7.5" r="1.5" fill="currentColor"/><path d="M7 4h6M7 7.5h6M7 11h6"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Ordered List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><text x="0" y="10" fontSize="8" fontWeight="bold">1.</text><path d="M7 4h6M7 7.5h6M7 11h6"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><path d="M3 3h9v9H3V3zm1 1v7h7V4H4z"/><path d="M5 6h5v1H5V6zm0 2h3v1H5V8z"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Code Block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 4L2 7.5 5 11M10 4l3 3.5L10 11"/></svg>
        </ToolbarBtn>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarBtn title="Insert Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="11" height="11" rx="1"/><path d="M2 6h11M2 9.5h11M7 2v11"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Insert Image" onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.onchange = () => {
            const file = input.files?.[0]
            if (file) {
              const url = URL.createObjectURL(file)
              editor.chain().focus().setFigure({ src: url, alt: file.name }).run()
            }
          }
          input.click()
        }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="11" height="11" rx="1.5"/><circle cx="5.5" cy="5.5" r="1.5" fill="currentColor"/><path d="M2 11l3-3 2 2 3-3 3 3"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Mermaid Diagram" onClick={() => editor.chain().focus().setMermaidDiagram({ code: 'graph TD\n  A-->B' }).run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h11v9H2V3z"/><circle cx="7.5" cy="7.5" r="2"/><path d="M4 11l3-3 2 2 2-2"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Horizontal Rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 7.5h11"/></svg>
        </ToolbarBtn>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarBtn title="Link" active={editor.isActive('link')} onClick={() => {
          const prevUrl = editor.getAttributes('link').href
          const url = window.prompt('URL', prevUrl || '')
          if (url === null) return
          if (url === '') editor.chain().focus().unsetLink().run()
          else editor.chain().focus().setLink({ href: url }).run()
        }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 10l3 3a3 3 0 004-4l-2-2M9 5L6 2a3 3 0 00-4 4l2 2"/><path d="M5.5 9.5l4-4"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Clear formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l7 7M11 4l-7 7"/></svg>
        </ToolbarBtn>
      </ToolbarGroup>
    </div>
  )
}
