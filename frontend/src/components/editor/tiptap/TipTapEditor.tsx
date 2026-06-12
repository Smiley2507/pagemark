import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'
import { Bold, Code, Italic, Link2, MessageSquarePlus, Quote, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAiStore } from '@/store/aiStore'
import { resourcesApi } from '@/api/resources'
import { createExtensions } from './editorSetup'
import { SlashCommandMenu } from './SlashCommandMenu'
import { TableToolbar } from './TableToolbar'
import { detectSpreadsheetData, insertTableFromSpreadsheet } from './tableUtils'
import { EditorContextMenu } from '../EditorContextMenu'
import type { GrammarIssue } from '../grammarDecoration'
import './tiptap-editor.css'

export interface TipTapEditorHandle {
  focus: () => void
  replaceSelection: (text: string) => void
  setGrammarIssues: (issues: GrammarIssue[]) => void
}

interface TipTapEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  sectionId?: number
  projectId?: number
  onPolish?: (text: string) => void
  grammarIssues?: GrammarIssue[]
  onFocusChange?: (editor: Editor | null) => void
}

export const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(
  function TipTapEditor({ value, onChange, className, sectionId, projectId, onPolish, grammarIssues, onFocusChange }, ref) {
    const [contextMenuState, setContextMenuState] = useState<{ position: { top: number; left: number }; selectedText: string } | null>(null)
    const projectIdRef = useRef(projectId)
    useEffect(() => { projectIdRef.current = projectId })

    const editor = useEditor({
      extensions: createExtensions("Type '/' for commands"),
      content: value,
      contentType: 'markdown',
      onUpdate: ({ editor }) => {
        onChange(editor.getMarkdown())
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[120px]',
        },
      },
      immediatelyRender: false,
    })

    useEffect(() => {
      if (!editor || !onFocusChange) return
      const handleFocus = () => onFocusChange(editor)
      editor.on('focus', handleFocus)
      return () => {
        editor.off('focus', handleFocus)
        onFocusChange(null)
      }
    }, [editor, onFocusChange])

    useImperativeHandle(ref, () => ({
      focus: () => editor?.chain().focus().run(),
      replaceSelection: (text: string) => {
        editor?.chain().focus().deleteSelection().insertContent(text, { contentType: 'markdown' }).run()
      },
      setGrammarIssues: (_issues: GrammarIssue[]) => {
        // TODO: port grammar decoration to ProseMirror plugin
      },
    }))

    useEffect(() => {
      if (editor && value !== editor.getMarkdown()) {
        editor.commands.setContent(value, {
          emitUpdate: false,
          contentType: 'markdown',
          parseOptions: { preserveWhitespace: 'full' },
        })
      }
    }, [editor, value])

    const uploadAndInsertImage = useCallback(async (file: File) => {
      if (!editor) return
      const pid = projectIdRef.current
      if (!pid) {
        const url = URL.createObjectURL(file)
        editor.chain().focus().setImage({ src: url, alt: file.name }).run()
        return
      }
      try {
        const resource = await resourcesApi.upload(pid, file)
        const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
        const imgUrl = `${baseURL}/projects/${pid}/resources/${resource.id}/data`
        editor.chain().focus().setImage({ src: imgUrl, alt: resource.original_name ?? file.name }).run()
      } catch {
        const url = URL.createObjectURL(file)
        editor.chain().focus().setImage({ src: url, alt: file.name }).run()
      }
    }, [editor])

    useEffect(() => {
      if (!editor) return
      const handlePaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items
        const text = e.clipboardData?.getData('text/plain')
        if (!items) return

        if (text && detectSpreadsheetData(text)) {
          e.preventDefault()
          insertTableFromSpreadsheet(editor, text)
          return
        }

        const imageFiles: File[] = []
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) imageFiles.push(file)
          }
        }
        if (imageFiles.length > 0) {
          e.preventDefault()
          for (const file of imageFiles) {
            await uploadAndInsertImage(file)
          }
        }
      }
      const handleDrop = async (e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : []
        const images = files.filter(f => f.type.startsWith('image/'))
        for (const file of images) {
          await uploadAndInsertImage(file)
        }
      }
      const handleDragOver = (e: DragEvent) => e.preventDefault()

      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        const { selection } = editor.state
        const { from, to } = selection
        if (from === to) {
          const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
          if (!pos) return
          const word = getWordRangeAt(editor, pos.pos)
          if (!word) return
          setContextMenuState({ position: { top: e.clientY, left: e.clientX }, selectedText: word.text })
          return
        }
        const text = editor.state.doc.textBetween(from, to)
        setContextMenuState({ position: { top: e.clientY, left: e.clientX }, selectedText: text })
      }

      const editorDOM = editor.view.dom
      editorDOM.addEventListener('paste', handlePaste)
      editorDOM.addEventListener('drop', handleDrop)
      editorDOM.addEventListener('dragover', handleDragOver)
      editorDOM.addEventListener('contextmenu', handleContextMenu)

      return () => {
        editorDOM.removeEventListener('paste', handlePaste)
        editorDOM.removeEventListener('drop', handleDrop)
        editorDOM.removeEventListener('dragover', handleDragOver)
        editorDOM.removeEventListener('contextmenu', handleContextMenu)
      }
    }, [editor, uploadAndInsertImage])

    /* ── Copy button on code blocks ────────────────────────────── */
    useEffect(() => {
      if (!editor) return
      const id = setInterval(() => {
        editor.view.dom.querySelectorAll<HTMLPreElement>('pre').forEach(pre => {
          if (pre.querySelector('[data-code-copy]')) return
          const btn = document.createElement('button')
          btn.setAttribute('data-code-copy', '')
          btn.type = 'button'
          btn.setAttribute('aria-label', 'Copy code')
          btn.setAttribute('title', 'Copy code')
          btn.innerHTML = copyIconSvg()
          btn.className = 'code-copy-btn'
          btn.addEventListener('click', async (e) => {
            e.stopPropagation()
            const text = pre.querySelector('code')?.textContent || ''
            try {
              await navigator.clipboard.writeText(text)
              btn.setAttribute('aria-label', 'Code copied')
              btn.setAttribute('title', 'Code copied')
              btn.innerHTML = checkIconSvg()
              btn.classList.add('code-copy-btn--done')
              window.setTimeout(() => {
                btn.setAttribute('aria-label', 'Copy code')
                btn.setAttribute('title', 'Copy code')
                btn.innerHTML = copyIconSvg()
                btn.classList.remove('code-copy-btn--done')
              }, 1600)
            } catch {
              btn.setAttribute('aria-label', 'Copy failed')
              btn.setAttribute('title', 'Copy failed')
            }
          })
          pre.appendChild(btn)
        })
      }, 500)
      return () => clearInterval(id)
    }, [editor])

    return (
      <div className={cn('tiptap-editor relative min-h-36 w-full min-w-0 overflow-x-hidden', className)} data-section-id={sectionId}>
        {editor && (
          <BubbleMenu
            editor={editor}
            className="flex"
            options={{ placement: 'top' }}
            shouldShow={({ editor }) => editor.isActive('table')}
          >
            <TableToolbar editor={editor} />
          </BubbleMenu>
        )}
        {editor && (
          <BubbleMenu
            editor={editor}
            className="flex"
            options={{ placement: 'top' }}
            shouldShow={({ editor }) => {
              const { from, to } = editor.state.selection
              return editor.isFocused && from !== to && !editor.isActive('table')
            }}
          >
            <SelectionToolbar
              editor={editor}
              onAddContext={(text) => {
                useAiStore.getState().addAttachment({
                  id: `transient-${Date.now()}`,
                  type: 'transient',
                  label: 'Selection',
                  reference: text,
                })
              }}
              onPolish={onPolish}
            />
          </BubbleMenu>
        )}
        <SlashCommandMenu editor={editor} onInsertImage={uploadAndInsertImage} />
        <EditorContent editor={editor} />
        {contextMenuState && editor && createPortal(
          <EditorContextMenu
            position={contextMenuState.position}
            hasSelection={contextMenuState.selectedText.length > 0}
            selectedText={contextMenuState.selectedText}
            onAddContext={(text) => {
              const addAttachment = useAiStore.getState().addAttachment
              addAttachment({
                id: `transient-${Date.now()}`,
                type: 'transient',
                label: 'Selection',
                reference: text,
              })
            }}
            onClose={() => { setContextMenuState(null); editor?.chain().focus().run() }}
          />,
          document.body,
        )}
      </div>
    )
  }
)

function copyIconSvg() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>'
}

function checkIconSvg() {
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>'
}

function getWordRangeAt(editor: Editor, pos: number): { from: number; to: number; text: string } | null {
  const $pos = editor.state.doc.resolve(pos)
  const parentStart = $pos.start()
  const parentText = $pos.parent.textContent
  const offset = Math.max(0, Math.min($pos.parentOffset, parentText.length))
  const left = parentText.slice(0, offset).search(/[^\s.,;:!?()[\]{}"']*$/)
  const rightMatch = parentText.slice(offset).match(/^[^\s.,;:!?()[\]{}"']*/)
  const fromOffset = left < 0 ? offset : left
  const toOffset = offset + (rightMatch?.[0].length ?? 0)
  if (fromOffset === toOffset) return null
  const text = parentText.slice(fromOffset, toOffset)
  return {
    from: parentStart + fromOffset,
    to: parentStart + toOffset,
    text,
  }
}

function SelectionToolbar({
  editor,
  onAddContext,
  onPolish,
}: {
  editor: Editor
  onAddContext: (text: string) => void
  onPolish?: (text: string) => void
}) {
  const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to).trim()

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href || ''
    const href = window.prompt('Link URL', previousUrl)
    if (href === null) return
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-separator bg-overlay px-1 py-1 shadow-overlay">
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Link"
        active={editor.isActive('link')}
        onClick={setLink}
      >
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-separator" />
      <ToolbarButton
        label="Add to AI context"
        onClick={() => selectedText && onAddContext(selectedText)}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </ToolbarButton>
      {onPolish && (
        <ToolbarButton
          label="Polish selection"
          onClick={() => selectedText && onPolish(selectedText)}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
        </ToolbarButton>
      )}
    </div>
  )
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors',
        active ? 'bg-interaction-muted text-interaction-hover' : 'hover:bg-panel-muted hover:text-text-primary',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-text-muted',
      )}
    >
      {children}
    </button>
  )
}
