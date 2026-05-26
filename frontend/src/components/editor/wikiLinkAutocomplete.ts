import { autocompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

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
    {
      update(state: EditorState, completionInfo) {
        const { cursor } = completionInfo;

        // We only want to trigger this if the cursor is immediately after '[['
        const line = state.doc.lineAt(cursor.pos);
        const textBefore = line.text.slice(0, cursor.pos - line.from);

        if (!textBefore.endsWith('[[')) {
          return null;
        }

        const completions = MOCK_DOCUMENTS.map(doc => ({
          label: doc,
          type: 'value',
          apply: (view, auto) => {
            // Replace '[[' with '[[docName]]'
            const from = cursor.pos - 2;
            view.dispatch({
              changes: { from, to: cursor.pos, insert: `[[${doc}]]` },
              selections: [{ anchor: cursor.pos + doc.length + 2, head: cursor.pos + doc.length + 2 }],
            });
          }
        }));

        return {
          completions,
          stopOnExactMatch: true,
        };
      },
    },
  ],
});
