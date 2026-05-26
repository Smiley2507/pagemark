import { EditorView, keymap } from '@codemirror/view';

export function createPairingHandler(char: string, closing: string) {
  return {
    key: char,
    run: (view: EditorView) => {
      const { state } = view;
      const selection = state.selection.main;
      const from = selection.from;
      const to = selection.to;

      if (!selection.empty) {
        // Wrap selection
        const selectedText = state.doc.sliceString(from, to);
        const replacement = char + selectedText + closing;

        view.dispatch({
          changes: { from, to, insert: replacement },
          selection: { anchor: from + 1, head: from + selectedText.length + 1 },
          userEvent: 'input.text',
        });
        return true;
      } else {
        // Empty pair
        const insertText = char + closing;
        view.dispatch({
          changes: { from: from, to: from, insert: insertText },
          selection: { anchor: from + 1, head: from + 1 },
          userEvent: 'input.text',
        });
        return true;
      }
    }
  };
}

export const pairingExtension = keymap.of([
  createPairingHandler('*', '*'),
  createPairingHandler('_', '_'),
  createPairingHandler('`', '`'),
]);
