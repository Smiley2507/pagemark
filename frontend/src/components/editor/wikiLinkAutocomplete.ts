import { autocompletion, CompletionContext } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';

// Mock list of documents. In a real app, this would come from a store or API.
const MOCK_DOCUMENTS = [
  'Getting Started',
  'Project Roadmap',
  'Daily Journal',
  'Meeting Notes 2026-05-26',
  'Brainstorming Ideas',
  'Architecture Design',
  'Technical Debt List',
  'User Feedback',
];

export const wikiLinkAutocomplete = autocompletion({
  override: [
    (context: CompletionContext) => {
      const { state, pos } = context;

      // We only want to trigger this if the cursor is immediately after '[['
      const line = state.doc.lineAt(pos);
      const textBefore = line.text.slice(0, pos - line.from);

      if (!textBefore.endsWith('[[')) {
        return null;
      }

      const options = MOCK_DOCUMENTS.map(doc => ({
        label: doc,
        type: 'value',
        apply: (view: EditorView, completion: any, from: number, to: number) => {
          // Replace '[[' with '[[docName]]'
          const start = pos - 2;
          view.dispatch({
            changes: { from: start, to: pos, insert: `[[${doc}]]` },
            selection: { anchor: start + doc.length + 4, head: start + doc.length + 4 },
          });
        }
      }));

      return {
        from: pos,
        options,
      };
    },
  ],
});
