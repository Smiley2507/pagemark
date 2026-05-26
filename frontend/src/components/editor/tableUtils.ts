import { Text } from '@codemirror/state';

export interface TableContext {
  from: number; // Start doc position of the table
  to: number; // End doc position of the table
  rows: string[][]; // 2D array of cell contents
  cursorRow: number; // The row index where the cursor is currently located
  cursorCol: number; // The column index where the cursor is currently located
}

// ── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Checks if a string looks like a markdown table line (starts and ends with |).
 * We make this loose to handle poorly formatted tables while typing.
 */
function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|');
}

/**
 * Parses a markdown table row into an array of cell strings.
 */
function parseRow(line: string): string[] {
  // Split by | but ignore escaped \|
  const cells = line.split(/(?<!\\\\)\\|/);
  // Remove the first and last empty elements that result from leading/trailing |
  if (cells.length > 0 && cells[0].trim() === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map(c => c.trim());
}

/**
 * Converts a 2D array of cells back into a markdown table string.
 */
export function formatTable(rows: string[][]): string {
  if (rows.length === 0) return '';
  
  // Calculate max width for each column to align it visually
  const colCount = Math.max(...rows.map(r => r.length));
  const colWidths = new Array(colCount).fill(3); // minimum 3 for '---'

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cellLen = (rows[r][c] || '').length;
      if (cellLen > colWidths[c]) {
        colWidths[c] = cellLen;
      }
    }
  }

  return rows.map((row, rIdx) => {
    // Row 1 is the separator row: |---|---|
    if (rIdx === 1) {
      const sepCells = new Array(colCount).fill('').map((_, c) => '-'.repeat(colWidths[c] || 3));
      return '| ' + sepCells.join(' | ') + ' |';
    }
    
    // Data rows
    const formattedCells = new Array(colCount).fill('').map((_, c) => {
      const cell = row[c] || '';
      return cell.padEnd(colWidths[c], ' ');
    });
    
    return '| ' + formattedCells.join(' | ') + ' |';
  }).join('\\n');
}

/**
 * Attempts to find a table surrounding the given document position.
 */
export function findTableAtCursor(doc: Text, pos: number): TableContext | null {
  const currentLine = doc.lineAt(pos);
  if (!isTableLine(currentLine.text)) return null;

  // Search up to find the start of the table
  let startLineNum = currentLine.number;
  while (startLineNum > 1 && isTableLine(doc.line(startLineNum - 1).text)) {
    startLineNum--;
  }

  // Search down to find the end of the table
  let endLineNum = currentLine.number;
  while (endLineNum < doc.lines && isTableLine(doc.line(endLineNum + 1).text)) {
    endLineNum++;
  }

  const rows: string[][] = [];
  const cursorRow = currentLine.number - startLineNum;
  let cursorCol = 0;
  
  for (let n = startLineNum; n <= endLineNum; n++) {
    const text = doc.line(n).text;
    const cells = parseRow(text);
    rows.push(cells);
    
    if (n === currentLine.number) {
      // Very rough estimation of cursor column
      const prefix = text.slice(0, pos - doc.line(n).from);
      // Count unescaped pipes in the prefix
      const pipes = (prefix.match(/(?<!\\\\)\\|/g) || []).length;
      cursorCol = Math.max(0, pipes - 1);
    }
  }

  // A valid table needs at least a header and a separator
  if (rows.length < 2) return null;

  return {
    from: doc.line(startLineNum).from,
    to: doc.line(endLineNum).to,
    rows,
    cursorRow,
    cursorCol
  };
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function addRow(ctx: TableContext, above: boolean): string {
  const newRows = [...ctx.rows];
  const colCount = Math.max(...newRows.map(r => r.length));
  const emptyRow = new Array(colCount).fill('');
  
  // Never insert above the separator
  let targetIdx = ctx.cursorRow;
  if (!above) targetIdx++;
  if (targetIdx <= 1) targetIdx = 2; 
  
  newRows.splice(targetIdx, 0, emptyRow);
  return formatTable(newRows);
}

export function deleteRow(ctx: TableContext): string | null {
  // Cannot delete header or separator
  if (ctx.cursorRow <= 1) return null; 
  // Cannot delete the only data row
  if (ctx.rows.length <= 3) return null;

  const newRows = [...ctx.rows];
  newRows.splice(ctx.cursorRow, 1);
  return formatTable(newRows);
}

export function addCol(ctx: TableContext, left: boolean): string {
  const newRows = [...ctx.rows];
  let targetIdx = ctx.cursorCol;
  if (!left) targetIdx++;
  
  for (let r = 0; r < newRows.length; r++) {
    if (r === 1) {
      newRows[r].splice(targetIdx, 0, '---');
    } else {
      newRows[r].splice(targetIdx, 0, '');
    }
  }
  return formatTable(newRows);
}

export function deleteCol(ctx: TableContext): string | null {
  // Cannot delete the only column
  if (ctx.rows[0].length <= 1) return null;

  const newRows = [...ctx.rows];
  for (let r = 0; r < newRows.length; r++) {
    newRows[r].splice(ctx.cursorCol, 1);
  }
  return formatTable(newRows);
}
