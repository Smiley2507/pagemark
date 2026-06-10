import { Mark, mergeAttributes } from '@tiptap/core'

export interface EvidenceMarkOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    evidenceMark: {
      toggleEvidence: (attrs?: { type?: string; path?: string }) => ReturnType
    }
  }
}

export const EvidenceMark = Mark.create<EvidenceMarkOptions>({
  name: 'evidence',

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      type: { default: 'source code' },
      path: { default: null },
      description: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-evidence]',
        getAttrs: (node) => {
          const el = node as HTMLElement
          return {
            type: el.getAttribute('data-evidence-type') || 'source code',
            path: el.getAttribute('data-evidence-path'),
            description: el.getAttribute('data-evidence-description') || '',
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-evidence': '',
        'data-evidence-type': HTMLAttributes.type,
        'data-evidence-path': HTMLAttributes.path,
        'data-evidence-description': HTMLAttributes.description,
        class: 'evidence-mark',
        title: HTMLAttributes.description || `${HTMLAttributes.type} evidence`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleEvidence:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attrs)
        },
    }
  },
})
