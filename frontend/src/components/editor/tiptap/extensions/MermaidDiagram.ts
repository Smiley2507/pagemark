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
      ['div', { class: 'mermaid-code-hint', contentEditable: 'false' }, 'Double-click to edit diagram code'],
    ] as DOMOutputSpec
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

      const hint = document.createElement('div')
      hint.className = 'mermaid-code-hint'
      hint.textContent = 'Double-click to edit diagram code'

      wrapper.appendChild(svgContainer)
      wrapper.appendChild(hint)

      let editing = false
      let textarea: HTMLTextAreaElement | null = null

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

      wrapper.addEventListener('dblclick', () => {
        if (editing) return
        editing = true
        hint.textContent = 'Press Ctrl+Enter to save'

        textarea = document.createElement('textarea')
        textarea.value = node.attrs.code
        textarea.className = 'mermaid-textarea'
        textarea.spellcheck = false

        svgContainer.style.display = 'none'
        wrapper.insertBefore(textarea, hint)

        textarea.focus()

        textarea.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            const newCode = textarea!.value
            const { state, dispatch } = editor.view
            const pos = typeof getPos === 'function' ? getPos() : undefined
            if (pos === undefined) return
            const tr = state.tr.setNodeMarkup(pos, undefined, { code: newCode })
            dispatch(tr)
            svgContainer.innerHTML = ''
            await renderMermaid(newCode)
            svgContainer.style.display = ''
            textarea?.remove()
            editing = false
            hint.textContent = 'Double-click to edit diagram code'
            editor.chain().focus().run()
          }
          if (e.key === 'Escape') {
            textarea?.remove()
            svgContainer.style.display = ''
            editing = false
            hint.textContent = 'Double-click to edit diagram code'
          }
        })
      })

      return {
        dom: wrapper,
        ignoreMutation: () => true,
      }
    }
  },
})
