import { Extension } from '@tiptap/core'

export const H1SplitPlugin = Extension.create({
  name: 'h1Split',

  addStorage() {
    return {
      pendingSplit: null as { heading: string; contentAfter: string } | null,
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this
        const { selection } = editor.state
        const { $head } = selection
        const node = $head.node()
        if (node.type.name !== 'heading' || node.attrs.level !== 1) return false

        const isAtEnd = $head.parentOffset >= node.content.size - 1
        if (!isAtEnd) return false

        const doc = editor.state.doc
        const h1Pos = $head.before()
        const h1End = $head.after()
        const docEnd = doc.content.size

        const headingText = node.textContent

        const contentAfter = doc.textBetween(h1End, docEnd)

        const storage = this.storage as { pendingSplit: { heading: string; contentAfter: string } | null }
        storage.pendingSplit = { heading: headingText, contentAfter }

        const tr = editor.state.tr
        tr.delete(h1Pos, docEnd)
        editor.view.dispatch(tr)

        return true
      },
    }
  },
})
