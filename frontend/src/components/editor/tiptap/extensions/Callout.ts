import { Node, mergeAttributes } from '@tiptap/core'

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { type?: string; calloutTitle?: string }) => ReturnType
      toggleCallout: (attributes?: { type?: string; calloutTitle?: string }) => ReturnType
    }
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'paragraph+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      types: ['info', 'warning', 'danger', 'success'],
    }
  },

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-callout-type') || 'info',
        renderHTML: (attrs) => {
          if (!attrs.type) return {}
          return { 'data-callout-type': attrs.type }
        },
      },
      calloutTitle: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-callout-title') || '',
        renderHTML: (attrs) => {
          if (!attrs.calloutTitle) return {}
          return { 'data-callout-title': attrs.calloutTitle }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout-type]',
        priority: 51,
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = node.attrs.type || 'info'
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-callout-type': type,
        class: `cm-lp-callout cm-lp-callout-${type}`,
      }),
      node.attrs.calloutTitle
        ? ['div', { class: 'cm-lp-callout-header' }, ['span', { class: 'cm-lp-callout-title' }, node.attrs.calloutTitle]]
        : '',
      ['div', { class: 'cm-lp-callout-body' }, 0],
    ]
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes)
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes)
        },
    }
  },

  parseMarkdown: (token: any) => {
    const blockText = token.raw || token.text || ''
    const lines = blockText.split('\n').filter((l: string) => l.startsWith('>'))
    if (lines.length === 0) return []
    const firstLine = lines[0].replace(/^>\s?/, '')
    const match = firstLine.match(/^\[!(\w+)\]\s*(.*)/)
    if (!match) return []
    const type = match[1].toLowerCase()
    const title = match[2]
    const body = lines.slice(1).map((l: string) => l.replace(/^>\s?/, '')).join('\n')
    return {
      type: 'callout',
      attrs: { type, calloutTitle: title },
      content: body
        ? [{ type: 'paragraph', content: [{ type: 'text', text: body }] }]
        : [{ type: 'paragraph' }],
    }
  },

  renderMarkdown: (node: any, helpers: any) => {
    const type = node.attrs.type || 'info'
    const title = node.attrs.calloutTitle || type
    const content = helpers.renderChildren(node.content || [])
    return `> [!${type}] ${title}\n> ${content.trim().replace(/\n/g, '\n> ')}\n\n`
  },
})
