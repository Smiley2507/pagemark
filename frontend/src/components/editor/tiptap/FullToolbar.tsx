import { type ReactNode, useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  Undo2, Redo2, Bold, Italic, Strikethrough, Code,
  List, ListOrdered, Quote, Code2, Minus, Table2, Image, Link2,
  RemoveFormatting,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FullToolbarProps {
  editor: Editor | null
}

export function FullToolbar({ editor }: FullToolbarProps) {
  const [headingOpen, setHeadingOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const e = editor

  return (
    <div
      className="mx-auto flex w-full max-w-4xl items-center gap-0.5 rounded-lg border border-border bg-popover px-1.5 py-1 shadow-sm"
      onMouseDown={(e) => e.preventDefault()}
    >
      <TBtn onClick={() => e?.chain().focus().undo().run()} disabled={!e || !e.can().chain().undo().run()} label="Undo">
        <Undo2 className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => e?.chain().focus().redo().run()} disabled={!e || !e.can().chain().redo().run()} label="Redo">
        <Redo2 className="h-3.5 w-3.5" />
      </TBtn>

      <Sep />

      <div className="relative">
        <TBtn onClick={() => e && setHeadingOpen(!headingOpen)} disabled={!e} label="Heading">
          <span className="text-xs font-medium min-w-[18px] text-center">P</span>
          <span className="text-[8px] ml-0.5">▾</span>
        </TBtn>
        {headingOpen && e && (
          <HDropdown editor={e} onClose={() => setHeadingOpen(false)} />
        )}
      </div>

      <Sep />

      <TBtn onClick={() => e?.chain().focus().toggleBold().run()} active={e?.isActive('bold')} disabled={!e} label="Bold">
        <Bold className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => e?.chain().focus().toggleItalic().run()} active={e?.isActive('italic')} disabled={!e} label="Italic">
        <Italic className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => e?.chain().focus().toggleStrike().run()} active={e?.isActive('strike')} disabled={!e} label="Strikethrough">
        <Strikethrough className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => e?.chain().focus().toggleCode().run()} active={e?.isActive('code')} disabled={!e} label="Code">
        <Code className="h-3.5 w-3.5" />
      </TBtn>

      <Sep />

      <TBtn onClick={() => e?.chain().focus().toggleBulletList().run()} active={e?.isActive('bulletList')} disabled={!e} label="Bullet list">
        <List className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => e?.chain().focus().toggleOrderedList().run()} active={e?.isActive('orderedList')} disabled={!e} label="Numbered list">
        <ListOrdered className="h-3.5 w-3.5" />
      </TBtn>

      <Sep />

      <TBtn onClick={() => e?.chain().focus().toggleBlockquote().run()} active={e?.isActive('blockquote')} disabled={!e} label="Blockquote">
        <Quote className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => e?.chain().focus().toggleCodeBlock().run()} active={e?.isActive('codeBlock')} disabled={!e} label="Code block">
        <Code2 className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => e?.chain().focus().setHorizontalRule().run()} disabled={!e} label="Horizontal rule">
        <Minus className="h-3.5 w-3.5" />
      </TBtn>

      <Sep />

      <TBtn onClick={() => e?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={!e} label="Table">
        <Table2 className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn onClick={() => {
        if (!e) return
        const input = document.createElement('input')
        input.type = 'file'; input.accept = 'image/*'
        input.onchange = () => {
          const file = input.files?.[0]
          if (file) e.chain().focus().setImage({ src: URL.createObjectURL(file), alt: file.name }).run()
        }
        input.click()
      }} disabled={!e} label="Image">
        <Image className="h-3.5 w-3.5" />
      </TBtn>

      <div className="relative">
        <TBtn onClick={() => { if (!e) return; const prev = e.getAttributes('link').href || ''; setLinkUrl(prev); setLinkOpen(!linkOpen) }} active={e?.isActive('link')} disabled={!e} label="Link">
          <Link2 className="h-3.5 w-3.5" />
        </TBtn>
        {linkOpen && e && (
          <LPopup editor={e} linkUrl={linkUrl} setLinkUrl={setLinkUrl} onClose={() => setLinkOpen(false)} />
        )}
      </div>

      <Sep />

      <TBtn onClick={() => e?.chain().focus().clearNodes().unsetAllMarks().run()} disabled={!e} label="Clear formatting">
        <RemoveFormatting className="h-3.5 w-3.5" />
      </TBtn>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────── */

function TBtn({
  onClick, active, disabled, label, children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'flex items-center justify-center rounded p-1 transition-colors',
        disabled
          ? 'text-muted-foreground/30 cursor-not-allowed'
          : active
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="mx-0.5 h-4 w-px bg-border" />
}

function HDropdown({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 w-24 rounded border border-border bg-popover py-0.5 shadow-lg"
      onMouseDown={e => e.stopPropagation()}
    >
      {[{level:0,label:'P'},{level:1,label:'H1'},{level:2,label:'H2'},{level:3,label:'H3'},{level:4,label:'H4'},{level:5,label:'H5'},{level:6,label:'H6'}].map(l => (
        <button
          key={l.label}
          type="button"
          className={cn('w-full px-2 py-0.5 text-left text-xs transition-colors', (l.level > 0 ? editor.isActive('heading', { level: l.level }) : editor.isActive('paragraph')) ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
          onClick={() => { if (l.level === 0) editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: l.level as 1|2|3|4|5|6 }).run(); onClose() }}
        >{l.label}</button>
      ))}
    </div>
  )
}

function LPopup({ editor, linkUrl, setLinkUrl, onClose }: { editor: Editor; linkUrl: string; setLinkUrl: (v: string) => void; onClose: () => void }) {
  return (
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
        onKeyDown={e => { if (e.key === 'Enter') { commitLink(); onClose() }; if (e.key === 'Escape') onClose() }}
        autoFocus
      />
      <button type="button" onClick={() => { commitLink(); onClose() }} className="text-xs text-foreground hover:text-primary px-1">✓</button>
      <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
    </div>
  )

  function commitLink() {
    if (!linkUrl) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().setLink({ href: linkUrl }).run()
  }
}
