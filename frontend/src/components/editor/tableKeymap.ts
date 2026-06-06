import { keymap } from '@codemirror/view';
import {
  findTableAtCursor,
  getCellPosInString,
  addRow,
  formatTable,
  getTableAlignments,
} from './tableUtils';

export const tableKeymap = keymap.of([
  {
    key: 'Tab',
    run: (view) => {
      const { state } = view;
      const pos = state.selection.main.from;
      const ctx = findTableAtCursor(state.doc, pos);
      if (!ctx) return false;

      const { rows, cursorRow, cursorCol } = ctx;
      const maxCol = Math.max(...rows.map(r => r.length));
      const maxRow = rows.length - 1;
      const alignments = getTableAlignments(state.doc, ctx);

      let nextRow = cursorRow;
      let nextCol = cursorCol + 1;

      if (nextCol >= maxCol) {
        nextCol = 0;
        nextRow++;
      }

      if (nextRow <= maxRow) {
        // Auto-format the entire table, then navigate to the next cell
        const formatted = formatTable(rows, alignments);
        const targetPos = getCellPosInString(formatted, nextRow, nextCol);
        view.dispatch({
          changes: { from: ctx.from, to: ctx.to, insert: formatted },
          selection: { anchor: ctx.from + targetPos, head: ctx.from + targetPos },
          scrollIntoView: true,
        });
        return true;
      } else {
        const formatted = addRow(ctx, false, alignments);
        const targetPos = getCellPosInString(formatted, rows.length, 0);
        view.dispatch({
          changes: { from: ctx.from, to: ctx.to, insert: formatted },
          selection: { anchor: ctx.from + targetPos, head: ctx.from + targetPos },
          scrollIntoView: true,
        });
        return true;
      }
    },
  },
  {
    key: 'Enter',
    run: (view) => {
      const { state } = view;
      const pos = state.selection.main.from;
      const ctx = findTableAtCursor(state.doc, pos);
      if (!ctx) return false;

      const alignments = getTableAlignments(state.doc, ctx);
      const newText = addRow(ctx, false, alignments);
      const lines = newText.split('\n');

      // addRow inserts at max(2, cursorRow + 1) to skip the separator
      const newRowIdx = ctx.cursorRow + 1 <= 1 ? 2 : ctx.cursorRow + 1;
      const targetLine = lines[newRowIdx] || '';
      let offset = 0;
      for (let i = 0; i < targetLine.length; i++) {
        if (targetLine[i] === '|') {
          offset = i + 1;
          if (offset < targetLine.length && targetLine[offset] === ' ') offset++;
          break;
        }
      }

      let totalOffset = 0;
      for (let i = 0; i < newRowIdx; i++) {
        totalOffset += lines[i].length + 1;
      }
      totalOffset += offset;

      view.dispatch({
        changes: { from: ctx.from, to: ctx.to, insert: newText },
        selection: { anchor: ctx.from + totalOffset, head: ctx.from + totalOffset },
        scrollIntoView: true,
      });
      return true;
    },
  },
  {
    key: 'Shift-Tab',
    run: (view) => {
      const { state } = view;
      const pos = state.selection.main.from;
      const ctx = findTableAtCursor(state.doc, pos);
      if (!ctx) return false;

      const { rows, cursorRow, cursorCol } = ctx;

      let prevRow = cursorRow;
      let prevCol = cursorCol - 1;

      if (prevCol < 0) {
        prevRow--;
        const rowAbove = rows[prevRow];
        if (rowAbove) {
          prevCol = rowAbove.length - 1;
        } else {
          return false; // At the top of the table
        }
      }

      if (prevRow >= 0) {
        const alignments = getTableAlignments(state.doc, ctx);
        const formatted = formatTable(ctx.rows, alignments);
        const targetPos = getCellPosInString(formatted, prevRow, prevCol);
        view.dispatch({
          changes: { from: ctx.from, to: ctx.to, insert: formatted },
          selection: { anchor: ctx.from + targetPos, head: ctx.from + targetPos },
          scrollIntoView: true,
        });
        return true;
      }

      return false;
    },
  },
]);
