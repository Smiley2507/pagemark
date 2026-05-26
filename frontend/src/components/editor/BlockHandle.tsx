import React, { useState, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { type BlockContext } from './blockUtils';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlockHandleProps {
  position: { top: number; left: number };
  context: BlockContext;
  editor: EditorView;
}

export function BlockHandle({ position, context, editor }: BlockHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; from: number } | null>(null);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const posUnderMouse = findPosUnderMouse(editor, e.clientY);
      if (posUnderMouse !== null) {
        const line = editor.state.doc.lineAt(posUnderMouse);
        const coords = editor.view.coordsAtPos(line.from);
        if (coords) {
          setDropPos({ top: coords.top, from: line.from });
        }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      setIsDragging(false);

      if (dropPos) {
        const sourceText = editor.state.doc.sliceString(context.from, context.to);
        let targetPos = dropPos.from;

        if (targetPos > context.from && targetPos < context.to) {
          targetPos = context.to;
        }

        editor.dispatch({
          changes: [
            { from: context.from, to: context.to, insert: '' },
            { from: targetPos, to: targetPos, insert: sourceText + '\n' },
          ],
          selections: [{ anchor: targetPos, head: targetPos }],
        });
      }
      setDropPos(null);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, context, editor, dropPos]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  return (
    <>
      <div
        className="fixed z-50 flex items-center justify-center p-1 bg-transparent hover:bg-muted rounded-md transition-colors cursor-grab active:cursor-grabbing group"
        style={{
          top: position.top,
          left: position.left - 24,
          transform: 'translateY(-50%)',
        }}
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
      {isDragging && dropPos && (
        <div
          className="fixed z-50 left-0 right-0 h-px bg-primary shadow-sm pointer-events-none transition-all duration-75"
          style={{ top: dropPos.top }}
        />
      )}
    </>
  );
}

function findPosUnderMouse(view: EditorView, mouseY: number): number | null {
  const { state } = view;
  const doc = state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const coords = view.coordsAtPos(line.from);
    if (coords && mouseY >= coords.top && mouseY <= coords.bottom) {
      return line.from;
    }
  }
  return null;
}
