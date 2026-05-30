import { keymap } from '@codemirror/view';
import { Text } from '@codemirror/state';
import {
  findTableAtCursor,
  getCellPos,
  addRow,
  addCol,
  type TableContext
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

      let nextRow = cursorRow;
      let nextCol = cursorCol + 1;

      if (nextCol >= maxCol) {
        nextCol = 0;
        nextRow++;
      }

      if (nextRow <= maxRow) {
        const newPos = getCellPos(state.doc, ctx, nextRow, nextCol);
        view.dispatch({
          selection: { anchor: newPos, head: newPos },
          scrollIntoView: true,
        });
        return true;
      } else {
        const newText = addCol(ctx, false);
        const lines = newText.split('\n');
        const targetLine = lines[maxRow] || '';
        let pipeCount = 0;
        let offset = 0;
        for (let i = 0; i < targetLine.length; i++) {
          if (targetLine[i] === '|') {
            pipeCount++;
            if (pipeCount === maxCol + 1) {
              offset = i + 1;
              if (offset < targetLine.length && targetLine[offset] === ' ') offset++;
              break;
            }
          }
        }

        let totalOffset = 0;
        for (let i = 0; i < maxRow; i++) {
          totalOffset += lines[i].length + 1;
        }
        totalOffset += offset;

        view.dispatch({
          changes: { from: ctx.from, to: ctx.to, insert: newText },
          selection: { anchor: ctx.from + totalOffset, head: ctx.from + totalOffset },
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

      const newText = addRow(ctx, false);
      const lines = newText.split('\n');

      // The new row is at index ctx.cursorRow + 1
      const targetLine = lines[ctx.cursorRow + 1] || '';
      let offset = 0;
      // Find the first cell content start (after the first pipe and space)
      for (let i = 0; i < targetLine.length; i++) {
        if (targetLine[i] === '|') {
          offset = i + 1;
          if (offset < targetLine.length && targetLine[offset] === ' ') offset++;
          break;
        }
      }

      let totalOffset = 0;
      for (let i = 0; i < ctx.cursorRow + 1; i++) {
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
        const newPos = getCellPos(state.doc, ctx, prevRow, prevCol);
        view.dispatch({
          selection: { anchor: newPos, head: newPos },
          scrollIntoView: true,
        });
        return true;
      }

      return false;
    },
  },
]);
