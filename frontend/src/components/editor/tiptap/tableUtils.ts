import type { Editor } from '@tiptap/core'

export function detectSpreadsheetData(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return false
  const colCounts = lines.map(l => l.split('\t').length)
  const first = colCounts[0]
  if (first < 2) return false
  return colCounts.every(c => Math.abs(c - first) <= 1)
}

export function insertTableFromSpreadsheet(editor: Editor, text: string) {
  const lines = text.split('\n').filter(l => l.trim())
  const rows = lines.map(l => l.split('\t'))
  const cols = Math.max(...rows.map(r => r.length))

  editor
    .chain()
    .focus()
    .insertTable({ rows: rows.length, cols, withHeaderRow: true })
    .run()

  const { selection } = editor.state
  const tableNode = selection.$anchor.node(1)
  if (!tableNode) return

  let rowIdx = 0
  tableNode.forEach((row, rowOff) => {
    if (row.type.name !== 'tableRow') return
    let colIdx = 0
    row.forEach((cell, cellOff) => {
      if (colIdx === 0 && rows[rowIdx]) {
        const pos = tableNode.start + rowOff + cellOff + 1
        const cellText = rows[rowIdx]?.[colIdx] ?? ''
        editor.chain().focus().setTextSelection(pos).insertContent(cellText).run()
      } else if (rows[rowIdx]?.[colIdx]) {
        const pos = tableNode.start + rowOff + cellOff + 1
        editor.chain().focus().setTextSelection(pos).insertContent(rows[rowIdx][colIdx]).run()
      }
      colIdx++
    })
    rowIdx++
  })
}
