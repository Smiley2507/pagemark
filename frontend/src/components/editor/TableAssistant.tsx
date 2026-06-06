import React from 'react';
import {
  ArrowUpToLine, ArrowDownToLine,
  ArrowLeftToLine, ArrowRightToLine,
  Trash2, AlignCenter,
} from 'lucide-react';
import { EditorView } from '@codemirror/view';
import { type TableContext, addRow, addCol, deleteRow, deleteCol, getTableAlignments, formatTable } from './tableUtils';
import { buttonVariants } from '@/components/ui/button';

interface TableAssistantProps {
  position: { top: number; left: number };
  context: TableContext;
  editor: EditorView;
}

export function TableAssistant({ position, context, editor }: TableAssistantProps) {
  const alignments = getTableAlignments(editor.state.doc, context);

  const dispatchUpdate = (newText: string | null) => {
    if (!newText) return; // Action invalid (e.g., deleting last row)

    editor.dispatch({
      changes: { from: context.from, to: context.to, insert: newText },
    });
    editor.focus();
  };

  const cycleAlignment = () => {
    const alignCycle: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];
    const currentAlign = alignments[context.cursorCol] || 'left';
    const nextIdx = (alignCycle.indexOf(currentAlign) + 1) % 3;
    const nextAlign = alignCycle[nextIdx];

    const newAligns = [...alignments];
    newAligns[context.cursorCol] = nextAlign;

    const newText = formatTable(context.rows, newAligns);
    dispatchUpdate(newText);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const controlClass = buttonVariants({ variant: 'ghost', size: 'icon', className: 'h-7 w-7' });
  const destructiveClass = buttonVariants({ variant: 'ghost', size: 'icon', className: 'h-7 w-7 text-destructive-foreground' });

  return (
    <div
      className="fixed z-50 flex items-center gap-1 border border-border bg-popover px-1.5 py-1 shadow-overlay"
      style={{
        top: position.top - 40,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      onPointerDown={handlePointerDown}
      role="toolbar"
      aria-label="Table editing"
    >
      <div className="flex items-center gap-0.5 border-r border-border pr-1.5">
        <button 
          onClick={() => dispatchUpdate(addRow(context, true, alignments))}
          className={controlClass}
          title="Add row above"
          aria-label="Add row above"
        >
          <ArrowUpToLine className="w-4 h-4" />
        </button>
        <button 
          onClick={() => dispatchUpdate(addRow(context, false, alignments))}
          className={controlClass}
          title="Add row below"
          aria-label="Add row below"
        >
          <ArrowDownToLine className="w-4 h-4" />
        </button>
        <button 
          onClick={() => dispatchUpdate(deleteRow(context, alignments))}
          className={destructiveClass}
          title="Delete row"
          aria-label="Delete row"
          disabled={context.cursorRow <= 1}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex items-center gap-0.5 pl-1.5">
        <button
          onClick={() => dispatchUpdate(addCol(context, true, alignments))}
          className={controlClass}
          title="Add column left"
          aria-label="Add column left"
        >
          <ArrowLeftToLine className="w-4 h-4" />
        </button>
        <button
          onClick={() => dispatchUpdate(addCol(context, false, alignments))}
          className={controlClass}
          title="Add column right"
          aria-label="Add column right"
        >
          <ArrowRightToLine className="w-4 h-4" />
        </button>
        <button
          onClick={cycleAlignment}
          className={controlClass}
          title="Cycle column alignment"
          aria-label="Cycle column alignment"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          onClick={() => dispatchUpdate(deleteCol(context, alignments))}
          className={destructiveClass}
          title="Delete column"
          aria-label="Delete column"
          disabled={context.rows[0].length <= 1}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
