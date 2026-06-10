import { useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { cn } from '@/lib/utils'

type BubbleSection =
  | { kind: 'button'; label: string; title: string; isActive: (e: Editor) => boolean; action: (e: Editor) => void; content: ReactNode }
  | { kind: 'sep' }
  | { kind: 'heading-dropdown' }
  | { kind: 'color-picker'; type: 'text' | 'highlight' }

const FONT_COLORS = ['#dc2626','#ea580c','#d97706','#65a30d','#16a34a','#059669','#0891b2','#2563eb','#7c3aed','#9333ea','#c026d3','#be123c']
const HIGHLIGHT_COLORS = ['#fef08a','#fde68a','#bfdbfe','#bbf7d0','#fecaca','#e9d5ff']

interface BubbleMenuContentProps {
  editor: Editor
  onClose: () => void
}

export function BubbleMenuContent({ editor, onClose }: BubbleMenuContentProps) {
  const [colorOpen, setColorOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)
  const [headingOpen, setHeadingOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)

  const currentColor = editor.getAttributes('textStyle').color || ''
  const currentHighlight = editor.getAttributes('highlight').color || ''
  const currentHeading = [1,2,3].find(l => editor.isActive('heading', { level: l })) || 0

  const handleColor = (color: string | null) => {
    if (color) editor.chain().focus().setColor(color).run()
    else editor.chain().focus().unsetColor().run()
    setColorOpen(false)
  }

  const handleHighlight = (color: string | null) => {
    if (color) editor.chain().focus().toggleHighlight({ color }).run()
    else editor.chain().focus().toggleHighlight().run()
    setHighlightOpen(false)
  }

  const handleLink = () => {
    const prev = editor.getAttributes('link').href || ''
    setLinkUrl(prev)
    setLinkOpen(true)
  }

  const commitLink = () => {
    if (!linkUrl) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: linkUrl }).run()
    setLinkOpen(false)
  }

  const headingLabel = currentHeading ? `H${currentHeading}` : 'P'

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-1 shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Heading */}
      <div className="relative">
        <Btn title="Heading" active={currentHeading > 0} onClick={() => setHeadingOpen(!headingOpen)}>
          <span className="text-xs font-medium">{headingLabel}</span>
          <span className="text-[8px] ml-0.5">▾</span>
        </Btn>
        {headingOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 w-20 rounded border border-border bg-popover py-0.5 shadow-lg" onMouseDown={e => e.stopPropagation()}>
            {[{level:0,label:'Paragraph'},{level:1,label:'H1'},{level:2,label:'H2'},{level:3,label:'H3'}].map(l => (
              <button
                key={l.label}
                type="button"
                className={cn('w-full px-2 py-0.5 text-left text-xs transition-colors', (l.level > 0 ? editor.isActive('heading', { level: l.level }) : editor.isActive('paragraph')) ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
                onClick={() => { if (l.level === 0) editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: l.level as 1|2|3 }).run(); setHeadingOpen(false) }}
              >{l.label}</button>
            ))}
          </div>
        )}
      </div>

      <Sep />

      <Btn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><strong className="text-xs">B</strong></Btn>
      <Btn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><em className="text-xs">I</em></Btn>
      <Btn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><span className="text-xs underline">U</span></Btn>
      <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><span className="text-xs line-through">S</span></Btn>
      <Btn title="Inline Code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><code className="text-xs text-foreground">&lt;/&gt;</code></Btn>

      <Sep />

      {/* Color */}
      <div className="relative">
        <Btn title="Text color" active={!!currentColor} onClick={() => setColorOpen(!colorOpen)}>
          <span className="text-xs underline" style={{ color: currentColor || 'inherit' }}>A</span>
        </Btn>
        {colorOpen && (
          <SwatchPicker onSelect={handleColor} onClose={() => setColorOpen(false)} colors={FONT_COLORS} current={currentColor} />
        )}
      </div>

      {/* Highlight */}
      <div className="relative">
        <Btn title="Highlight" active={editor.isActive('highlight')} onClick={() => setHighlightOpen(!highlightOpen)}>
          <span className="text-xs px-0.5" style={{ background: currentHighlight || 'transparent', borderRadius: 2 }}>A</span>
        </Btn>
        {highlightOpen && (
          <SwatchPicker onSelect={handleHighlight} onClose={() => setHighlightOpen(false)} colors={HIGHLIGHT_COLORS} current={currentHighlight} />
        )}
      </div>

      <Sep />

      <Btn title="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <span className="text-xs">•</span>
      </Btn>
      <Btn title="Numbered List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <span className="text-xs">1.</span>
      </Btn>
      <Btn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <span className="text-xs">"</span>
      </Btn>

      <Sep />

      {/* Link */}
      <div className="relative">
        <Btn title="Link" active={editor.isActive('link')} onClick={handleLink}>
          <span className="text-xs underline">L</span>
        </Btn>
        {linkOpen && (
          <div
            className="absolute top-full left-0 mt-1 z-50 flex items-center gap-1 rounded border border-border bg-popover px-2 py-1 shadow-lg"
            onMouseDown={e => e.stopPropagation()}
          >
            <input
              type="text"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-36 rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-foreground outline-none"
              onKeyDown={e => { if (e.key === 'Enter') commitLink(); if (e.key === 'Escape') setLinkOpen(false) }}
              autoFocus
            />
            <button type="button" onClick={commitLink} className="text-xs text-foreground hover:text-primary px-1">✓</button>
            <button type="button" onClick={() => setLinkOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
          </div>
        )}
      </div>

      <Sep />

      <Btn title="AI Actions" active={false} onClick={() => {}} className="text-primary">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
          <path d="M3 20l3-3 3 3" />
        </svg>
      </Btn>
    </div>
  )
}

function Btn({ title, active, onClick, children, className }: { title: string; active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'rounded px-1.5 py-1 text-xs transition-colors',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="mx-0.5 h-4 w-px bg-border" />
}

function SwatchPicker({ colors, current, onSelect, onClose }: { colors: string[]; current: string; onSelect: (c: string | null) => void; onClose: () => void }) {
  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-36 rounded border border-border bg-popover p-1.5 shadow-lg" onMouseDown={e => e.stopPropagation()}>
      <div className="flex flex-wrap gap-0.5">
        <button
          type="button"
          title="Remove"
          className="h-5 w-5 rounded border border-border flex items-center justify-center text-[10px] text-muted-foreground hover:bg-accent"
          onClick={() => { onSelect(null); onClose() }}
        >✕</button>
        {colors.map(c => (
          <button
            key={c}
            type="button"
            title={c}
            className={cn('h-5 w-5 rounded border transition-transform hover:scale-110', current === c ? 'border-foreground scale-110' : 'border-border')}
            style={{ background: c }}
            onClick={() => { onSelect(c); onClose() }}
          />
        ))}
      </div>
    </div>
  )
}
