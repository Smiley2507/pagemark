import { Node, mergeAttributes } from '@tiptap/core'
import type { DOMOutputSpec } from '@tiptap/pm/model'

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
      mergeAttributes(this.options.HTMLAttributes, figureAttrs),
      ['div', { class: 'figure-img-wrapper' },
        ['img', imgAttrs],
        ['span', { class: 'figure-resize-handle figure-resize-handle--se' }],
        ['span', { class: 'figure-resize-handle figure-resize-handle--sw' }],
      ],
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
})
