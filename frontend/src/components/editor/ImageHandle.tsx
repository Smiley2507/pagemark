import React, { useState, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { type BlockContext } from './blockUtils';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageHandleProps {
  position: { top: number; left: number };
  context: BlockContext;
  editor: EditorView;
}

export function ImageHandle({ position, context, editor }: ImageHandleProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [initialX, setInitialX] = useState(0);
  const [initialWidth, setInitialWidth] = useState(0);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - initialX;
      const newWidth = Math.max(50, initialWidth + deltaX);

      const raw = editor.state.doc.sliceString(context.from, context.to);
      const m = raw.match(/^!\[([^\]|]*)(?:\|(\d+))?\]\(([^)]+)\)/);
      if (m) {
        const [, alt, , src] = m;
        const newText = `![${alt}|${Math.round(newWidth)}](${src})`;

        editor.dispatch({
          changes: { from: context.from, to: context.to, insert: newText },
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isResizing, context, editor, initialX, initialWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setInitialX(e.clientX);

    // Get current width from markdown
    const raw = editor.state.doc.sliceString(context.from, context.to);
    const m = raw.match(/^!\[([^\]|]*)(?:\|(\d+))?\]\(([^)]+)\)/);
    if (m && m[2]) {
      setInitialWidth(parseInt(m[2]));
    } else {
      // Fallback to current DOM width if not specified in markdown
      const img = editor.view.contentDOM.querySelector('.cm-lp-img');
      setInitialWidth(img?.getBoundingClientRect().width || 300);
    }
  };

  return (
    <div
      className="fixed z-50 flex items-center justify-center p-1 bg-transparent hover:bg-muted rounded-md transition-colors cursor-ew-resize group"
      style={{
        top: position.top,
        left: position.left + (editor.view.coordsAtPos(context.to)?.left || 0) - position.left,
        transform: 'translateY(-50%)',
      }}
      onMouseDown={handleMouseDown}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </div>
  );
}
