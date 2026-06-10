import { Node, mergeAttributes } from '@tiptap/core'

export interface WikiLinkOptions {
  openOnClick: boolean
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attributes: { text: string }) => ReturnType
    }
  }
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',

  group: 'inline',

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      openOnClick: true,
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      text: {
        default: null,
        parseHTML: (el) => (el as HTMLAnchorElement).getAttribute('data-wiki-link'),
        renderHTML: (attrs) => {
          if (!attrs.text) return {}
          return { 'data-wiki-link': attrs.text }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-wiki-link]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        href: '#',
        class: 'cm-lp-wikilink',
        'data-wiki-link': node.attrs.text,
      }),
      `[[${node.attrs.text}]]`,
    ]
  },

  addCommands() {
    return {
      setWikiLink:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
    }
  },

  parseMarkdown: {
    handler: ({ leafText }) => {
      const match = leafText.match(/^\[\[(.+?)\]\]$/)
      if (match) {
        return {
          type: 'wikiLink',
          attrs: { text: match[1] },
        }
      }
      return null
    },
  },

  renderMarkdown: {
    handler: (node) => `[[${node.attrs.text}]]`,
  },
})
