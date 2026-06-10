import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'
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
}

export const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(
  function TipTapEditor({ value, onChange, className, sectionId, projectId, onPolish, grammarIssues }, ref) {
    const editorRef = useRef<Editor | null>(null)
    const [contextMenuState, setContextMenuState] = useState<{ position: { top: number; left: number }; selectedText: string } | null>(null)
    const [showTableToolbar, setShowTableToolbar] = useState(false)
    const projectIdRef = useRef(projectId)
    useEffect(() => { projectIdRef.current = projectId })

    const editor = useEditor({
      extensions: createExtensions("Type '/' for commands"),
      content: value,
      contentType: 'markdown',
      onUpdate: ({ editor }) => {
        onChange(editor.getMarkdown())
      },
      onSelectionUpdate: ({ editor }) => {
        setShowTableToolbar(editor.isActive('table'))
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[180px]',
        },
      },
      immediatelyRender: false,
    })

    editorRef.current = editor ?? null

    useImperativeHandle(ref, () => ({
      focus: () => editor?.chain().focus().run(),
      replaceSelection: (text: string) => {
        editor?.chain().focus().deleteSelection().insertContent(text).run()
      },
      setGrammarIssues: (_issues: GrammarIssue[]) => {
        // TODO: port grammar decoration to ProseMirror plugin
      },
    }))

    useEffect(() => {
      if (editor && value !== editor.getMarkdown()) {
        editor.commands.setContent(value, false, { preserveWhitespace: 'full' })
      }
    }, [editor, value])

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

      const uploadAndInsertImage = async (file: File) => {
        const pid = projectIdRef.current
        if (!pid) {
          const url = URL.createObjectURL(file)
          editor?.chain().focus().setFigure({ src: url, alt: file.name }).run()
          return
        }
        try {
          const resource = await resourcesApi.upload(pid, file)
          const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
          const imgUrl = `${baseURL}/projects/${pid}/resources/${resource.id}/data`
          editor?.chain().focus().setFigure({ src: imgUrl, alt: resource.filename ?? file.name }).run()
        } catch {
          const url = URL.createObjectURL(file)
          editor?.chain().focus().setFigure({ src: url, alt: file.name }).run()
        }
      }

      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault()
        const { selection } = editor.state
        const { from, to } = selection
        if (from === to) {
          const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
          if (!pos) return
          const word = editor.state.doc.wordAt(pos.pos)
          if (!word) return
          const text = editor.state.doc.textBetween(word.from, word.to)
          setContextMenuState({ position: { top: e.clientY, left: e.clientX }, selectedText: text })
          return
        }
        const text = editor.state.doc.textBetween(from, to)
        setContextMenuState({ position: { top: e.clientY, left: e.clientX }, selectedText: text })
      }

      const editorDOM = editor.view.dom
      editorDOM.addEventListener('paste', handlePaste)
      editorDOM.addEventListener('drop', handleDrop)
      editorDOM.addEventListener('dragover', (e: DragEvent) => e.preventDefault())
      editorDOM.addEventListener('contextmenu', handleContextMenu)

      return () => {
        editorDOM.removeEventListener('paste', handlePaste)
        editorDOM.removeEventListener('drop', handleDrop)
        editorDOM.removeEventListener('contextmenu', handleContextMenu)
      }
    }, [editor])

    return (
      <div className={cn('relative min-h-44 w-full min-w-0 overflow-x-hidden', className)}>
        {editor && (
          <BubbleMenu
            editor={editor}
            className="flex items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-1 shadow-lg"
          >
            <FormatButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} label="Bold" shortcut="Ctrl+B">
              <strong className="text-xs">B</strong>
            </FormatButton>
            <FormatButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} label="Italic" shortcut="Ctrl+I">
              <em className="text-xs">I</em>
            </FormatButton>
            <FormatButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} label="Strikethrough">
              <span className="text-xs line-through">S</span>
            </FormatButton>
            <FormatButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} label="Inline Code">
              <code className="text-xs">&lt;/&gt;</code>
            </FormatButton>
            <div className="mx-1 h-4 w-px bg-border" />
            <FormatButton onClick={() => {
              const prevUrl = editor.getAttributes('link').href
              const url = window.prompt('URL', prevUrl || '')
              if (url === null) return
              if (url === '') {
                editor.chain().focus().unsetLink().run()
              } else {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }} isActive={editor.isActive('link')} label="Link">
              <span className="text-xs underline">L</span>
            </FormatButton>
            <div className="mx-1 h-4 w-px bg-border" />
            <FormatButton
              onClick={() => {
                const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)
                onPolish?.(selectedText)
              }}
              isActive={false}
              label="AI Actions"
              className="text-primary hover:text-foreground"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
                <path d="M3 20l3-3 3 3" />
              </svg>
            </FormatButton>
          </BubbleMenu>
        )}
        {editor && showTableToolbar && (
          <div className="mb-2 flex justify-center">
            <TableToolbar editor={editor} />
          </div>
        )}
        <SlashCommandMenu editor={editor} />
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

function FormatButton({
  onClick,
  isActive,
  label,
  shortcut,
  children,
  className,
}: {
  onClick: () => void
  isActive: boolean
  label: string
  shortcut?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
      className={cn(
        'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        isActive && 'bg-accent text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}
