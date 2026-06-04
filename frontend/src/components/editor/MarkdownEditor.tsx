import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { closeBrackets } from '@codemirror/autocomplete';
import { cn } from '@/lib/utils';
import { SlashCommandMenu } from './SlashCommandMenu';
import { BubbleMenu } from './BubbleMenu';
import { TableAssistant } from './TableAssistant';
import { findTableAtCursor, type TableContext } from './tableUtils';
import { findBlockAtCursor, type BlockContext } from './blockUtils';
import { pairingExtension } from './markdownPairing';
import { livePreviewExtension } from './livePreview';
import { tableKeymap } from './tableKeymap';
import { wikiLinkAutocomplete } from './wikiLinkAutocomplete';
import { grammarDecorationField, grammarDecorationTheme, setGrammarIssues, type GrammarIssue } from './grammarDecoration';

// ── Theme ─────────────────────────────────────────────────────────────────────
// Base CodeMirror theme — keeps transparent background, hides gutters, etc.
// Visual styles for live-preview elements live in the CSS block below.

const editorTheme = EditorView.theme({
  '&': {
    minHeight: '180px',
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    fontFamily: 'Inter, sans-serif',
    fontSize: '15px',
    lineHeight: '1.75',
    padding: '0',
    overflow: 'visible',
  },
  '.cm-content': {
    padding: '0',
    caretColor: 'var(--foreground)',
    minHeight: '180px',
  },
  '.cm-line': { padding: '0' },
  '.cm-focused': { outline: 'none' },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklch, var(--muted), transparent 70%)' },
  '.cm-selectionBackground': { backgroundColor: 'color-mix(in oklch, var(--accent), transparent 65%)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in oklch, var(--accent), transparent 65%)' },
  '.cm-gutters': { display: 'none' },

  // ── Syntax highlighting (applied via defaultHighlightStyle) ────────────
  '.cm-formatting': {
    color: 'var(--muted-foreground)',
    fontSize: '0.85em',
  },
  '.cm-strong': { fontWeight: '700' },
  '.cm-em':     { fontStyle: 'italic' },
  '.cm-strikethrough': { textDecoration: 'line-through', opacity: '0.55' },
  '.cm-link': {
    color: 'var(--primary)',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in oklch, var(--primary), transparent 60%)',
  },
  '.cm-url':    { color: 'var(--primary)' },
  '.cm-heading': { fontWeight: '600', color: 'var(--foreground)' },
  '.cm-heading-1': { fontSize: '1.85rem' },
  '.cm-heading-2': { fontSize: '1.5rem' },
  '.cm-heading-3': { fontSize: '1.25rem' },
  '.cm-comment': { color: 'var(--muted-foreground)', fontStyle: 'italic' },
  '.cm-monospace': {
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    fontSize: '0.85em',
    background: 'var(--muted)',
    borderRadius: '4px',
    padding: '2px 6px',
  },
  '.cm-quote': {
    borderLeft: '3px solid color-mix(in oklch, var(--primary), transparent 50%)',
    paddingLeft: '1rem',
    color: 'var(--muted-foreground)',
    fontStyle: 'italic',
  },
});

// ── Live-preview CSS injected once into <head> ────────────────────────────────
// We inject a <style> tag rather than using the CM theme object so we can use
// standard CSS units (em, rem) and pseudo-selectors without CM's string-only API.

const LP_STYLE_ID = 'cm-live-preview-styles';

function ensureLivePreviewStyles() {
  if (document.getElementById(LP_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LP_STYLE_ID;
  style.textContent = `
    /* ── Headings ─────────────────────────────────────────────────────────── */
    .cm-line.cm-lp-h1 { font-size: 1.85rem; font-weight: 700; line-height: 1.2; color: var(--foreground); margin: 0.6em 0 0.1em; }
    .cm-line.cm-lp-h2 { font-size: 1.5rem;  font-weight: 650; line-height: 1.3; color: var(--foreground); margin: 0.5em 0 0.1em; }
    .cm-line.cm-lp-h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.4; color: var(--foreground); margin: 0.4em 0 0.05em; }
    .cm-line.cm-lp-h4 { font-size: 1.1rem;  font-weight: 600; line-height: 1.4; color: var(--foreground); margin: 0.3em 0 0.05em; }
    .cm-line.cm-lp-h5 { font-size: 1.0rem;  font-weight: 600; line-height: 1.5; color: var(--muted-foreground); margin: 0.2em 0 0; }
    .cm-line.cm-lp-h6 { font-size: 0.9rem;  font-weight: 600; line-height: 1.5; color: var(--muted-foreground); margin: 0.2em 0 0; }

    /* ── Inline formatting ────────────────────────────────────────────────── */
    .cm-lp-strong      { font-weight: 700; }
    .cm-lp-em          { font-style: italic; }
    .cm-lp-strike      { text-decoration: line-through; opacity: 0.55; }

    .cm-lp-inline-code {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.85em;
      background: var(--muted);
      color: var(--primary);
      border-radius: 4px;
      padding: 2px 6px;
    }

    /* ── Links ────────────────────────────────────────────────────────────── */
    .cm-lp-link {
      color: var(--primary);
      text-decoration: underline;
      text-decoration-color: color-mix(in oklch, var(--primary), transparent 60%);
      text-underline-offset: 2px;
      transition: text-decoration-color 0.15s;
    }
    .cm-lp-link:hover { text-decoration-color: var(--primary); }
    .cm-lp-wikilink {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      background: color-mix(in oklch, var(--primary), transparent 90%);
      border-radius: 3px;
      padding: 0 2px;
      transition: all 0.15s;
    }
    .cm-lp-wikilink:hover {
      background: color-mix(in oklch, var(--primary), transparent 75%);
      text-decoration: underline;
    }

    /* ── Callouts ────────────────────────────────────────────────────── */
    .cm-lp-callout {
      margin: 0.75em 0;
      border-radius: 8px;
      border: 1px solid var(--border);
      overflow: hidden;
      background: var(--muted);
    }
    .cm-lp-callout-header {
      padding: 6px 12px;
      background: color-mix(in oklch, var(--primary), transparent 80%);
      border-bottom: 1px solid var(--border);
      font-weight: 600;
      font-size: 0.85rem;
    }
    .cm-lp-callout-title {
      text-transform: capitalize;
    }
    .cm-lp-callout-body {
      padding: 8px 12px;
      font-size: 0.9rem;
      color: var(--foreground);
      white-space: pre-wrap;
    }

    /* Callout Types */
    .cm-lp-callout-info { border-left: 4px solid #3b82f6; }
    .cm-lp-callout-warning { border-left: 4px solid #f59e0b; }
    .cm-lp-callout-danger { border-left: 4px solid #ef4444; }
    .cm-lp-callout-success { border-left: 4px solid #10b981; }

    /* ── Blockquote ───────────────────────────────────────────────────────── */
    .cm-line.cm-lp-blockquote {
      border-left: 3px solid color-mix(in oklch, var(--primary), transparent 50%);
      padding-left: 1rem;
      color: var(--muted-foreground);
      font-style: italic;
    }

    /* ── Horizontal rule ──────────────────────────────────────────────────── */
    .cm-lp-hr {
      border: none;
      border-top: 1px solid var(--border);
      width: 100%;
      height: 1px;
      margin: 0.75em 0;
    }

    /* ── Images ───────────────────────────────────────────────────────────── */
    .cm-lp-img-wrap { display: block; margin: 0.75em 0; }
    .cm-lp-img {
      max-width: 100%;
      max-height: 480px;
      border-radius: 8px;
      border: 1px solid var(--border);
      object-fit: contain;
    }

    /* ── List markers ────────────────────────────────────────────────────── */
    .cm-lp-list-mark {
      color: var(--primary);
      font-weight: 600;
    }

    /* ── Task checkboxes ─────────────────────────────────────────────────── */
    .cm-lp-checkbox {
      width: 16px;
      height: 16px;
      vertical-align: middle;
      accent-color: var(--primary);
      cursor: pointer;
      margin-right: 6px;
      border-radius: 3px;
    }

    /* ── Table pipes (when cursor is inside, very subtle) ──────────────────────── */
    .cm-lp-pipe {
      color: color-mix(in oklch, var(--muted-foreground), transparent 75%);
      font-size: 0.85em;
    }
    .cm-lp-pipe-active {
      color: transparent;
      /* We keep the width by not using display: none */
    }

    /* ── Rendered table (when cursor is outside) ─────────────────────────── */
    .cm-lp-table-wrap {
      margin: 0.5em 0;
      overflow-x: auto;
    }
    .cm-lp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9em;
      line-height: 1.5;
    }
    .cm-lp-table th {
      text-align: left;
      font-weight: 600;
      padding: 6px 12px;
      border-bottom: 2px solid var(--border);
      color: var(--foreground);
      background: color-mix(in oklch, var(--muted), transparent 50%);
    }
    .cm-lp-table td {
      padding: 5px 12px;
      border-bottom: 1px solid color-mix(in oklch, var(--border), transparent 40%);
      color: var(--foreground);
    }
    .cm-lp-table tbody tr:hover {
      background: color-mix(in oklch, var(--muted), transparent 70%);
    }

    /* ── Fenced code block ───────────────────────────────────────────────── */
    .cm-lp-codeblock {
      margin: 0.5em 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: var(--muted);
    }
    .cm-lp-active-fenced {
      background-color: color-mix(in oklch, var(--background), transparent 50%);
    }
    .cm-lp-codeblock-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 12px;
      background: var(--muted);
      border-bottom: 1px solid color-mix(in oklch, var(--border), transparent 50%);
    }
    .cm-lp-codeblock-lang {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted-foreground);
      font-weight: 500;
    }
    .cm-lp-codeblock-copy {
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted-foreground);
      cursor: pointer;
      transition: all 0.15s;
    }
    .cm-lp-codeblock-copy:hover {
      background: var(--accent);
      color: var(--foreground);
    }
    .cm-lp-codeblock-body {
      margin: 0;
      padding: 12px 16px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.85em;
      line-height: 1.6;
      overflow-x: auto;
      color: var(--foreground);
      background: transparent;
    }
    .cm-lp-codeblock-body code {
      font-family: inherit;
      background: none;
      padding: 0;
    }
  `;
  document.head.appendChild(style);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface MarkdownEditorHandle {
  focus: () => void;
  replaceSelection: (text: string) => void;
  setGrammarIssues: (issues: GrammarIssue[]) => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  sectionId?: number;
  onPolish?: (text: string) => void;
  grammarIssues?: GrammarIssue[];
}

interface MenuState {
  position: { top: number; left: number };
  slashPos: number;
  searchTerm: string;
}

interface BubbleMenuState {
  position: { top: number; left: number };
}

interface TableAssistantState {
  position: { top: number; left: number };
  context: TableContext;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, className, sectionId, onPolish, grammarIssues }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef      = useRef<EditorView | null>(null);
    const [menuState, setMenuState] = useState<MenuState | null>(null);
    const [bubbleMenuState, setBubbleMenuState] = useState<BubbleMenuState | null>(null);
    const [tableAssistantState, setTableAssistantState] = useState<TableAssistantState | null>(null);

    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; });

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      replaceSelection: (text: string) => {
        const view = viewRef.current;
        if (!view) return;
        const selection = view.state.selection.main;
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
        });
        view.focus();
      },
      setGrammarIssues: (issues: GrammarIssue[]) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ effects: setGrammarIssues.of(issues) });
      },
    }));

    // Sync grammar issues from props
    useEffect(() => {
      const view = viewRef.current;
      if (!view || !grammarIssues) return;
      view.dispatch({ effects: setGrammarIssues.of(grammarIssues) });
    }, [grammarIssues]);

    // ── Mount ──────────────────────────────────────────────────────────────
    useEffect(() => {
      if (!containerRef.current) return;

      ensureLivePreviewStyles();

      const updateListener = EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;

        onChangeRef.current(update.state.doc.toString());

        // Slash command detection
        const { state } = update;
        const pos = state.selection.main.from;

        if (pos > 0) {
          const line = state.doc.lineAt(pos);
          const lineTextBeforeCursor = state.doc.sliceString(line.from, pos);
          const slashIndex = lineTextBeforeCursor.lastIndexOf('/');
          
          if (slashIndex !== -1) {
            // Check if '/' is the first char or preceded by space
            if (slashIndex === 0 || lineTextBeforeCursor[slashIndex - 1] === ' ') {
              const searchTerm = lineTextBeforeCursor.slice(slashIndex + 1);
              // Auto-close if searchTerm contains space (e.g. typing normal text)
              if (!searchTerm.includes(' ')) {
                const slashPos = line.from + slashIndex;
                const coords = update.view.coordsAtPos(slashPos);
                if (coords) {
                  setMenuState({
                    position: { top: coords.bottom + 4, left: coords.left },
                    slashPos: slashPos,
                    searchTerm: searchTerm,
                  });
                  return;
                }
              }
            }
          }
        }

        setMenuState(null);
      });

      // Handle bubble menu selection on selection change, but use a separate DOM event for blur
      // because we want to hide it if clicking elsewhere, but not if clicking inside bubble menu
      const selectionListener = EditorView.updateListener.of((update) => {
        if (!update.selectionSet && !update.geometryChanged) return;
        
        const { main } = update.state.selection;
        if (!main.empty) {
          const coords = update.view.coordsAtPos(main.from);
          const endCoords = update.view.coordsAtPos(main.to);
          
          if (coords && endCoords) {
            // Position above the center of the selection
            const centerLeft = coords.left + (endCoords.left - coords.left) / 2;
            setBubbleMenuState({
              position: { top: Math.min(coords.top, endCoords.top), left: centerLeft },
            });
          }
          setTableAssistantState(null);
        } else {
          setBubbleMenuState(null);

          // Table Assistant detection
          const tableCtx = findTableAtCursor(update.state.doc, main.from);
          if (tableCtx) {
            const coords = update.view.coordsAtPos(main.from);
            if (coords) {
              setTableAssistantState({
                position: { top: coords.top, left: coords.left },
                context: tableCtx,
              });
            }
          } else {
            setTableAssistantState(null);
          }
        }
      });

      const state = EditorState.create({
        doc: value,
        extensions: [
          markdown({ codeLanguages: languages }),
          EditorView.lineWrapping,
          editorTheme,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          livePreviewExtension,          // ← Obsidian-style live preview
          grammarDecorationField,
          grammarDecorationTheme(),
          pairingExtension,               // ← Advanced Auto-pairing
          closeBrackets(),
          wikiLinkAutocomplete,
          placeholder("Type '/' for commands"),
          tableKeymap,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          history(),
          updateListener,
          selectionListener,
        ],
      });

      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = view;
      
      // Hide bubble menu on blur
      const handleBlur = () => {
        // If clicking on the bubble menu itself, it shouldn't hide.
        // We use preventDefault on mousedown in the menu to stop focus loss,
        // so if a blur happens, it's a real click outside.
        setBubbleMenuState(null);
        setTableAssistantState(null);
      };

      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
        const images = files.filter(f => f.type.startsWith('image/'));

        if (images.length > 0) {
          const { state } = view;
          const pos = state.selection.main.head;

          images.forEach((file, idx) => {
            // In a real app, this would be an upload call.
            // For now, we'll use a local object URL for immediate feedback.
            const url = URL.createObjectURL(file);
            const markdown = `![${file.name}|300](${url})\n`;

            view.dispatch({
              changes: { from: pos + (idx * markdown.length), insert: markdown },
            });
          });

          view.focus();
        }
      };

      view.contentDOM.addEventListener('blur', handleBlur);
      view.contentDOM.addEventListener('drop', handleDrop);
      view.contentDOM.addEventListener('dragover', (e) => e.preventDefault());

      return () => {
        view.contentDOM.removeEventListener('blur', handleBlur);
        view.contentDOM.removeEventListener('drop', handleDrop);
        view.destroy();
        viewRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Sync external value changes ────────────────────────────────────────
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (current === value) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }, [value]);

    return (
      <div ref={containerRef} className={cn('min-h-[180px] w-full relative', className)}>
        {menuState && viewRef.current &&
          createPortal(
            <SlashCommandMenu
              position={menuState.position}
              slashPos={menuState.slashPos}
              searchTerm={menuState.searchTerm}
              editor={viewRef.current}
              onClose={() => {
                setMenuState(null);
                viewRef.current?.focus();
              }}
            />,
            document.body,
          )
        }
        {bubbleMenuState && viewRef.current &&
          createPortal(
            <BubbleMenu
              position={bubbleMenuState.position}
              editor={viewRef.current}
              onPolish={onPolish}
            />,
            document.body,
          )
        }
        {tableAssistantState && viewRef.current &&
          createPortal(
            <TableAssistant
              position={tableAssistantState.position}
              context={tableAssistantState.context}
              editor={viewRef.current}
            />,
            document.body,
          )
        }
      </div>
    );
  }
);
