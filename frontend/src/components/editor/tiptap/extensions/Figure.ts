import { Node, mergeAttributes } from '@tiptap/core'
import type { MarkdownSerializerState } from '@tiptap/markdown'
import type { DOMOutputSpec } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface FigureOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      setFigure: (attrs: { src: string; alt?: string; caption?: string; alignment?: 'left' | 'center' | 'right'; width?: string }) => ReturnType
    }
  }
}

function createResizeHandle(side: 'nw' | 'ne' | 'sw' | 'se'): HTMLElement {
  const handle = document.createElement('span')
  handle.className = `figure-resize-handle figure-resize-handle--${side}`
  handle.setAttribute('data-side', side)
  return handle
}

export const Figure = Node.create<FigureOptions>({
  name: 'figure',

  group: 'block',

  defining: true,

  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      alignment: { default: 'center' },
      width: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        contentElement: 'figcaption',
        getAttrs: (node) => {
          const figure = node as HTMLElement
          const img = figure.querySelector('img')
          const figcaption = figure.querySelector('figcaption')
          return {
            src: img?.getAttribute('src') || null,
            alt: img?.getAttribute('alt') || '',
            caption: figcaption?.textContent || '',
            alignment: figure.getAttribute('data-alignment') || 'center',
            width: figure.getAttribute('data-width') || null,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const imgAttrs: Record<string, string> = { src: HTMLAttributes.src }
    if (HTMLAttributes.alt) imgAttrs.alt = HTMLAttributes.alt
    if (HTMLAttributes.width) imgAttrs.width = HTMLAttributes.width

    const figureAttrs: Record<string, string> = {}
    if (HTMLAttributes.alignment && HTMLAttributes.alignment !== 'center') {
      figureAttrs['data-alignment'] = HTMLAttributes.alignment
    }
    if (HTMLAttributes.width) {
      figureAttrs['data-width'] = HTMLAttributes.width
    }

    return [
      'figure',
      mergeAttributes(this.options.HTMLAttributes, figureAttrs, { 'data-figure-id': HTMLAttributes.src }),
      ['div', { class: 'figure-img-wrapper' }, ['img', imgAttrs]],
      ['figcaption', { contentEditable: 'true' }, HTMLAttributes.caption || ''],
    ] as DOMOutputSpec
  },

  renderText({ node }) {
    return node.attrs.alt || node.attrs.src || ''
  },

  addCommands() {
    return {
      setFigure:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          })
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('figureResize'),
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement
              const handle = target.closest('.figure-resize-handle') as HTMLElement | null
              if (!handle) return false

              event.preventDefault()
              const figureEl = handle.closest('figure[data-figure-id]') as HTMLElement | null
              if (!figureEl) return false

              const imgEl = figureEl.querySelector('img')
              if (!imgEl) return false

              const startX = event.clientX
              const startWidth = imgEl.naturalWidth || imgEl.width || 300
              const side = handle.getAttribute('data-side') as string

              const onMouseMove = (e: MouseEvent) => {
                const dx = e.clientX - startX
                let newWidth: number
                if (side === 'se' || side === 'ne') {
                  newWidth = Math.max(100, startWidth + dx * 2)
                } else if (side === 'sw' || side === 'nw') {
                  newWidth = Math.max(100, startWidth - dx * 2)
                } else {
                  newWidth = Math.max(100, startWidth + dx * 2)
                }

                const widthStr = `${Math.round(newWidth)}px`
                const figureId = figureEl.getAttribute('data-figure-id')
                const pos = findFigurePosition(view.state.doc, figureId)
                if (pos === -1) return

                view.dispatch(
                  view.state.tr.setNodeMarkup(pos, undefined, {
                    ...view.state.doc.nodeAt(pos)?.attrs,
                    width: widthStr,
                  }),
                )
              }

              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
              }

              document.addEventListener('mousemove', onMouseMove)
              document.addEventListener('mouseup', onMouseUp)
              return true
            },
            mouseenter(view, event) {
              const target = event.target as HTMLElement
              const figure = target.closest('figure[data-figure-id]') as HTMLElement | null
              if (!figure || figure.querySelector('.figure-resize-handle')) return false

              const sides = ['nw', 'ne', 'sw', 'se']
              for (const side of sides) {
                figure.appendChild(createResizeHandle(side as any))
              }
              return false
            },
            mouseleave(view, event) {
              const target = event.target as HTMLElement
              const figure = target.closest('figure[data-figure-id]') as HTMLElement | null
              if (!figure) return false

              const handles = figure.querySelectorAll('.figure-resize-handle')
              handles.forEach(h => h.remove())
              return false
            },
          },
        },
      }),
    ]
  },
})

function findFigurePosition(doc: any, figureId: string | null): number {
  if (!figureId) return -1
  let pos = -1
  doc.descendants((node: any, p: number) => {
    if (node.type.name === 'figure' && node.attrs.src === figureId) {
      pos = p
      return false
    }
    return true
  })
  return pos
}
