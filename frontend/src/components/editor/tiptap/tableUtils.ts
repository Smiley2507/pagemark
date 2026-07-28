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
  const normalizedRows = rows.map(row => {
    const cells = [...row]
    while (cells.length < cols) cells.push('')
    return cells.map(cell => cell.trim().replace(/\|/g, '\\|'))
  })

  const [header, ...body] = normalizedRows
  const separator = Array.from({ length: cols }, () => '---')
  const markdown = [header, separator, ...body]
    .map(row => `| ${row.join(' | ')} |`)
    .join('\n')

  editor.chain().focus().insertContent(markdown, { contentType: 'markdown' }).run()
}
