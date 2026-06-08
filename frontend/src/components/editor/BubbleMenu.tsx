import React, { useEffect, useState, useRef } from 'react';
import { Bold, Italic, Strikethrough, Code, Link, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorView } from '@codemirror/view';

type AiAction = 'rewrite' | 'improve' | 'expand' | 'summarize';

interface BubbleMenuProps {
  position: { top: number; left: number };
  editor: EditorView;
  onPolish?: (text: string) => void;
  onAiAction?: (action: AiAction, text: string) => void;
}

const AI_ACTION_LABELS: Record<AiAction, string> = {
  rewrite: 'Rewrite',
  improve: 'Improve Clarity',
  expand: 'Expand',
  summarize: 'Summarize',
};

export function BubbleMenu({ position, editor, onPolish, onAiAction }: BubbleMenuProps) {
  const [showAiMenu, setShowAiMenu] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setShowAiMenu(false);
      }
    };
    if (showAiMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showAiMenu]);

  const toggleFormat = (before: string, after: string = before) => {
    const selection = editor.state.selection.main;
    const text = editor.state.sliceDoc(selection.from, selection.to);
    
    const isWrappedInner = text.startsWith(before) && text.endsWith(after);
    
    const textBefore = editor.state.sliceDoc(Math.max(0, selection.from - before.length), selection.from);
    const textAfter = editor.state.sliceDoc(selection.to, selection.to + after.length);
    const isWrappedOuter = textBefore === before && textAfter === after;

    if (isWrappedOuter) {
      editor.dispatch({
        changes: [
          { from: selection.from - before.length, to: selection.from, insert: '' },
          { from: selection.to, to: selection.to + after.length, insert: '' },
        ],
      });
    } else if (isWrappedInner) {
      editor.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: text.slice(before.length, text.length - after.length),
        },
      });
    } else {
      editor.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: `${before}${text}${after}`,
        },
        selection: { anchor: selection.from + before.length, head: selection.to + before.length },
      });
    }
    
    editor.focus();
  };

  const toggleLink = () => {
    const selection = editor.state.selection.main;
    const text = editor.state.sliceDoc(selection.from, selection.to);
    
    const isLink = text.startsWith('[') && text.includes('](') && text.endsWith(')');
    
    if (isLink) {
      const match = text.match(/^\[(.*)\]\((.*)\)$/);
      if (match) {
        editor.dispatch({
          changes: { from: selection.from, to: selection.to, insert: match[1] },
        });
      }
    } else {
      editor.dispatch({
        changes: { from: selection.from, to: selection.to, insert: `[${text}](url)` },
        selection: { anchor: selection.from + text.length + 3, head: selection.from + text.length + 6 },
      });
    }
    editor.focus();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const getSelectedText = () => {
    const selection = editor.state.selection.main;
    return editor.state.sliceDoc(selection.from, selection.to);
  };

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 px-1 py-1 bg-card border border-border rounded-md shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: position.top - 40,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={handleMouseDown}
    >
      <button
        onClick={() => toggleFormat('**')}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => toggleFormat('_')}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => toggleFormat('~~')}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        onClick={() => toggleFormat('\`')}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Inline Code"
      >
        <Code className="w-4 h-4" />
      </button>
      <div className="w-[1px] h-4 bg-border mx-1" />
      <button
        onClick={toggleLink}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Link"
      >
        <Link className="w-4 h-4" />
      </button>
      <div className="w-[1px] h-4 bg-border mx-1" />

      <div className="relative" ref={aiMenuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAiMenu(!showAiMenu);
          }}
          className={cn(
            'p-1.5 rounded transition-colors',
            showAiMenu
              ? 'text-foreground bg-accent'
              : 'text-primary hover:text-foreground hover:bg-accent',
          )}
          title="AI Actions"
        >
          <Sparkles className="w-4 h-4" />
        </button>
        {showAiMenu && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg"
            onMouseDown={(e) => e.preventDefault()}
          >
            {(Object.keys(AI_ACTION_LABELS) as AiAction[]).map((action) => (
              <button
                key={action}
                onClick={() => {
                  const text = getSelectedText();
                  if (text && onAiAction) {
                    onAiAction(action, text);
                  } else if (text && onPolish) {
                    onPolish(text);
                  }
                  setShowAiMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {AI_ACTION_LABELS[action]}
              </button>
            ))}
            <div className="mx-2 my-1 h-px bg-border" />
            <button
              onClick={() => {
                const text = getSelectedText();
                if (text && onPolish) {
                  onPolish(text);
                }
                setShowAiMenu(false);
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Phrasing...
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
