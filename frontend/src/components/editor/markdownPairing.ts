import { EditorView, keymap } from '@codemirror/view';

export function createPairingHandler(char: string, closing: string) {
  return {
    key: char,
    run: (view: EditorView) => {
      const { state } = view;
      const pos = state.selection.main.head;

      // Insert opening and closing markers
      const insertText = char + closing;

      view.dispatch({
        changes: {
          from: pos,
          to: pos,
          insert: insertText
        },
        selections: [{ anchor: pos + 1, head: pos + 1 }],
        userEvent: 'input.text',
      });
      return true;
    }
  };
}

export const pairingExtension = keymap.of([
  createPairingHandler('*', '**'),
  createPairingHandler('_', '__'),
  createPairingHandler('`', '`'),
]);
