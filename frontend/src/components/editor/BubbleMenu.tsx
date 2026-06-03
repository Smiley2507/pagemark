import React, { useEffect } from 'react';
import { Bold, Italic, Strikethrough, Code, Link, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorView } from '@codemirror/view';

interface BubbleMenuProps {
  position: { top: number; left: number };
  editor: EditorView;
  onPolish?: (text: string) => void;
}

export function BubbleMenu({ position, editor, onPolish }: BubbleMenuProps) {
  // Helper to toggle formatting wrappers
  const toggleFormat = (before: string, after: string = before) => {
    const selection = editor.state.selection.main;
    const text = editor.state.sliceDoc(selection.from, selection.to);
    
    // Check if the current selection is already wrapped in this formatting
    const isWrappedInner = text.startsWith(before) && text.endsWith(after);
    
    // Check if the formatting surrounds the selection
    const textBefore = editor.state.sliceDoc(Math.max(0, selection.from - before.length), selection.from);
    const textAfter = editor.state.sliceDoc(selection.to, selection.to + after.length);
    const isWrappedOuter = textBefore === before && textAfter === after;

    if (isWrappedOuter) {
      // Remove wrapper
      editor.dispatch({
        changes: [
          { from: selection.from - before.length, to: selection.from, insert: '' },
          { from: selection.to, to: selection.to + after.length, insert: '' },
        ],
      });
    } else if (isWrappedInner) {
      // Remove wrapper from inside the selection
      editor.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: text.slice(before.length, text.length - after.length),
        },
      });
    } else {
      // Add wrapper
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
      // Extract text from link
      const match = text.match(/^\\[(.*)\\]\\((.*)\\)$/);
      if (match) {
        editor.dispatch({
          changes: { from: selection.from, to: selection.to, insert: match[1] },
        });
      }
    } else {
      // Wrap in link
      editor.dispatch({
        changes: { from: selection.from, to: selection.to, insert: `[${text}](url)` },
        selection: { anchor: selection.from + text.length + 3, head: selection.from + text.length + 6 }, // Select 'url'
      });
    }
    editor.focus();
  };

  // Prevent mousedown from blurring the editor
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 px-1 py-1 bg-card border border-border-default rounded-md shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={{
        // Position slightly above the selection, centered
        top: position.top - 40,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={handleMouseDown}
    >
      <button
        onClick={() => toggleFormat('**')}
        className="p-1.5 text-text-2 hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => toggleFormat('_')}
        className="p-1.5 text-text-2 hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => toggleFormat('~~')}
        className="p-1.5 text-text-2 hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </button>
      <button
        onClick={() => toggleFormat('\`')}
        className="p-1.5 text-text-2 hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Inline Code"
      >
        <Code className="w-4 h-4" />
      </button>
      <div className="w-[1px] h-4 bg-border-default mx-1" />
      <button
        onClick={toggleLink}
        className="p-1.5 text-text-2 hover:text-foreground hover:bg-accent rounded transition-colors"
        title="Link"
      >
        <Link className="w-4 h-4" />
      </button>
      <div className="w-[1px] h-4 bg-border-default mx-1" />
      <button
        onClick={() => {
          const selection = editor.state.selection.main;
          const text = editor.state.sliceDoc(selection.from, selection.to);
          if (text && onPolish) {
            onPolish(text);
          }
        }}
        className="p-1.5 text-primary hover:text-foreground hover:bg-accent rounded transition-colors"
        title="AI Phrasing Suggestions"
      >
        <Sparkles className="w-4 h-4" />
      </button>
    </div>
  );
}
