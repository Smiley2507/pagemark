import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { StateEffect, StateField, type StateEffectType } from '@codemirror/state';

export interface GrammarIssue {
  offset: number;
  length: number;
  message: string;
  short_message: string;
  rule_id: string;
  replacements: string[];
}

export const setGrammarIssues: StateEffectType<GrammarIssue[]> = StateEffect.define<GrammarIssue[]>();

const grammarMark = Decoration.mark({
  class: 'cm-grammar-issue',
});

export const grammarDecorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setGrammarIssues)) {
        const issues = effect.value as GrammarIssue[];
        const decoArr = issues.map(issue =>
          grammarMark.range(issue.offset, issue.offset + issue.length)
        );
        return Decoration.set(decoArr);
      }
    }
    return decos.map(tr.changes);
  },
  provide(f) {
    return EditorView.decorations.from(f);
  },
});

export function grammarDecorationTheme() {
  return EditorView.theme({
    '.cm-grammar-issue': {
      textDecoration: 'underline wavy var(--destructive)',
      textUnderlineOffset: '3px',
      cursor: 'pointer',
    },
  });
}
