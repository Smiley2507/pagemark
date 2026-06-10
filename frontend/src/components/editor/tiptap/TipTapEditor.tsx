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
import { BubbleMenuContent } from './BubbleMenuContent'
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
  onSplitSection?: (heading: string, contentAfter: string) => void
}

export const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(
  function TipTapEditor({ value, onChange, className, sectionId, projectId, onPolish, grammarIssues, onSplitSection }, ref) {
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
          class: 'prose prose-sm prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[120px]',
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

    useEffect(() => {
      if (!editor || !onSplitSection) return
      const id = window.setInterval(() => {
        const ext = editor.extensionManager.extensions.find(e => e.name === 'h1Split')
        if (!ext) return
        const storage = ext.storage as { pendingSplit: { heading: string; contentAfter: string } | null }
        if (storage.pendingSplit) {
          const { heading, contentAfter } = storage.pendingSplit
          storage.pendingSplit = null
          onSplitSection(heading, contentAfter)
        }
      }, 200)
      return () => clearInterval(id)
    }, [editor, onSplitSection])

    return (
      <div className={cn('relative min-h-36 w-full min-w-0 overflow-x-hidden', className)}>
        {editor && (
          <BubbleMenu
            editor={editor}
            className="flex"
            shouldShow={({ editor }) => {
              const { selection } = editor.state
              const { empty } = selection
              const node = selection.$head.node()
              return !empty
                && !editor.isActive('table')
                && node.type.name !== 'codeBlock'
                && node.type.name !== 'code'
                && !editor.isActive('callout')
            }}
          >
            <BubbleMenuContent editor={editor} onClose={() => {}} />
          </BubbleMenu>
        )}
        {editor && showTableToolbar && (
          <div className="mb-1 flex justify-center">
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
