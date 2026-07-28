import { Node, mergeAttributes } from '@tiptap/core'
import type { DOMOutputSpec } from '@tiptap/pm/model'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidDiagram: {
      setMermaidDiagram: (attrs: { code: string }) => ReturnType
    }
  }
}

export const MermaidDiagram = Node.create({
  name: 'mermaidDiagram',

  priority: 1000,

  group: 'block',

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      code: { default: 'graph TD\n  A-->B' },
      svg: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-mermaid]',
        getAttrs: (node) => {
          const el = node as HTMLElement
          return {
            code: el.getAttribute('data-mermaid-code') || '',
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-mermaid': '',
        'data-mermaid-code': HTMLAttributes.code,
        class: 'mermaid-diagram',
      }),
      ['div', { class: 'mermaid-svg', innerHTML: HTMLAttributes.svg || '' }],
      ['div', { class: 'mermaid-code-hint', contentEditable: 'false' }, 'Edit diagram code'],
    ] as DOMOutputSpec
  },

  markdownTokenName: 'code',

  parseMarkdown: (token, helpers) => {
    if ((token.lang || '').trim().toLowerCase() !== 'mermaid') {
      return []
    }

    return helpers.createNode('mermaidDiagram', { code: token.text || '' })
  },

  renderMarkdown: (node) => {
    const code = String(node.attrs?.code || '').replace(/\n?$/, '\n')
    return `\`\`\`mermaid\n${code}\`\`\``
  },

  addCommands() {
    return {
      setMermaidDiagram:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          })
        },
    }
  },

  addNodeView() {
    return ({ editor, node, getPos }) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-diagram'
      wrapper.setAttribute('data-mermaid', '')
      wrapper.setAttribute('data-mermaid-code', node.attrs.code)

      const svgContainer = document.createElement('div')
      svgContainer.className = 'mermaid-svg'

      const toolbar = document.createElement('div')
      toolbar.className = 'mermaid-toolbar'

      const editButton = document.createElement('button')
      editButton.type = 'button'
      editButton.className = 'mermaid-edit-button'
      editButton.textContent = 'Edit'
      editButton.setAttribute('aria-label', 'Edit Mermaid diagram code')

      const hint = document.createElement('div')
      hint.className = 'mermaid-code-hint'
      hint.textContent = 'Edit diagram code'

      wrapper.appendChild(svgContainer)
      toolbar.appendChild(hint)
      toolbar.appendChild(editButton)
      wrapper.appendChild(toolbar)

      let editing = false
      let textarea: HTMLTextAreaElement | null = null
      let controls: HTMLDivElement | null = null

      const renderMermaid = async (code: string) => {
        try {
          const { default: mermaid } = await import('mermaid')
          mermaid.initialize({ startOnLoad: false, theme: 'default' })
          const id = `mermaid-${Date.now()}`
          const { svg } = await mermaid.render(id, code)
          svgContainer.innerHTML = svg
        } catch {
          svgContainer.innerHTML = `<pre class="mermaid-error">Failed to render diagram</pre>`
        }
      }

      renderMermaid(node.attrs.code)

      const closeEditor = () => {
        textarea?.remove()
        controls?.remove()
        textarea = null
        controls = null
        svgContainer.style.display = ''
        editing = false
        hint.textContent = 'Edit diagram code'
        editButton.disabled = false
      }

      const saveCode = async () => {
        if (!textarea) return
        const newCode = textarea.value
        const { state, dispatch } = editor.view
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (pos === undefined) return
        const tr = state.tr.setNodeMarkup(pos, undefined, { code: newCode })
        dispatch(tr)
        svgContainer.innerHTML = ''
        await renderMermaid(newCode)
        closeEditor()
        editor.chain().focus().run()
      }

      const openEditor = () => {
        if (editing) return
        editing = true
        hint.textContent = 'Ctrl+Enter saves'
        editButton.disabled = true

        textarea = document.createElement('textarea')
        textarea.value = node.attrs.code
        textarea.className = 'mermaid-textarea'
        textarea.spellcheck = false

        svgContainer.style.display = 'none'
        wrapper.insertBefore(textarea, toolbar)

        controls = document.createElement('div')
        controls.className = 'mermaid-edit-controls'

        const saveButton = document.createElement('button')
        saveButton.type = 'button'
        saveButton.className = 'mermaid-save-button'
        saveButton.textContent = 'Save'
        saveButton.addEventListener('click', () => void saveCode())

        const cancelButton = document.createElement('button')
        cancelButton.type = 'button'
        cancelButton.className = 'mermaid-cancel-button'
        cancelButton.textContent = 'Cancel'
        cancelButton.addEventListener('click', closeEditor)

        controls.appendChild(saveButton)
        controls.appendChild(cancelButton)
        wrapper.insertBefore(controls, toolbar)

        textarea.focus()

        textarea.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            await saveCode()
          }
          if (e.key === 'Escape') {
            closeEditor()
          }
        })
      }

      editButton.addEventListener('click', openEditor)

      return {
        dom: wrapper,
        ignoreMutation: () => true,
        stopEvent: (event) => {
          const target = event.target as HTMLElement | null
          return Boolean(target?.closest('textarea, button'))
        },
      }
    }
  },
})
