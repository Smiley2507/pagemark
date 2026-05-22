import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { cn } from '@/lib/utils';

// ── Theme ─────────────────────────────────────────────────────────────────────
// All colours use CSS custom properties so the editor inherits the app's light
// and dark themes without any extra JS-side theme switching.

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    fontFamily: 'Inter, sans-serif',
    fontSize: '15px',
    lineHeight: '1.7',
    padding: '0',
  },
  '.cm-content': {
    padding: '0',
    caretColor: 'hsl(var(--foreground))',
  },
  '.cm-line': { padding: '0' },
  '.cm-focused': { outline: 'none' },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-selectionBackground': {
    backgroundColor: 'hsl(var(--accent))',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'hsl(var(--accent))',
  },
  '.cm-gutters': { display: 'none' },

  // ── Markdown-specific ──────────────────────────────────────────────────────
  '.cm-header-1': {
    fontSize: '24px',
    fontWeight: '700',
    color: 'hsl(var(--foreground))',
  },
  '.cm-header-2': {
    fontSize: '20px',
    fontWeight: '600',
    color: 'hsl(var(--foreground))',
  },
  '.cm-header-3': {
    fontSize: '17px',
    fontWeight: '600',
  },
  '.cm-strong': { fontWeight: '700' },
  '.cm-em': { fontStyle: 'italic' },
  '.cm-url': { color: 'hsl(var(--primary))' },
  // Make syntax markers (*, **, #, etc.) subtle rather than invisible
  '.cm-formatting': {
    color: 'hsl(var(--muted-foreground))',
    fontSize: '0.85em',
  },
});

// ── Public API ─────────────────────────────────────────────────────────────────

export interface MarkdownEditorHandle {
  focus: () => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    // Keep the onChange callback in a ref so the update-listener extension
    // never needs to be rebuilt when the parent re-renders.
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    });

    // Expose focus() to parent components via ref
    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
    }));

    // ── Mount the editor once ────────────────────────────────────────────────
    useEffect(() => {
      if (!containerRef.current) return;

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          markdown({ codeLanguages: languages }),
          EditorView.lineWrapping,
          editorTheme,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          history(),
          updateListener,
        ],
      });

      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally empty — create once on mount

    // ── Sync external value changes (e.g. AI updates the content) ───────────
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;

      const current = view.state.doc.toString();
      // No-op when the change originated from inside the editor — the value
      // prop will equal what the editor already has, so this guard prevents
      // a redundant dispatch on every keystroke.
      if (current === value) return;

      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    }, [value]);

    return (
      <div
        ref={containerRef}
        className={cn('h-full w-full', className)}
      />
    );
  },
);
