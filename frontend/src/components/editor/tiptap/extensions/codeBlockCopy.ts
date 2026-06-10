import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const CodeBlockCopy = Extension.create({
  name: 'codeBlockCopy',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('codeBlockCopy'),
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, set) {
            set = set.map(tr.mapping, tr.doc)
            const action = tr.getMeta('codeBlockCopy')
            if (action?.type === 'copied') {
              const deco = Decoration.widget(action.pos, () => {
                const btn = document.createElement('button')
                btn.textContent = 'Copied!'
                btn.className = 'code-copy-btn code-copy-btn--done'
                btn.setAttribute('aria-label', 'Copied')
                setTimeout(() => {
                  btn.textContent = 'Copy'
                  btn.className = 'code-copy-btn'
                }, 2000)
                return btn
              }, { side: -1 })
              return set.add(tr.doc, [deco])
            }
            return set
          },
        },
        props: {
          decorations(state) {
            const { doc } = state
            const decorations: Decoration[] = []
            doc.descendants((node, pos) => {
              if (node.type.name === 'codeBlock') {
                const btn = document.createElement('button')
                btn.textContent = 'Copy'
                btn.className = 'code-copy-btn'
                btn.setAttribute('aria-label', 'Copy code')
                btn.addEventListener('click', async (e) => {
                  e.stopPropagation()
                  const text = node.textContent
                  try {
                    await navigator.clipboard.writeText(text)
                    const tr = state.tr
                    tr.setMeta('codeBlockCopy', { type: 'copied', pos })
                    state.view.dispatch(tr)
                  } catch {
                    // fallback for non-HTTPS environments
                  }
                })
                const deco = Decoration.widget(pos + node.nodeSize, btn, { side: 1 })
                decorations.push(deco)
              }
            })
            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})
