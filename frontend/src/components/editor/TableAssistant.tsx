import React from 'react';
import { 
  ArrowUpToLine, ArrowDownToLine, 
  ArrowLeftToLine, ArrowRightToLine, 
  Trash2
} from 'lucide-react';
import { EditorView } from '@codemirror/view';
import { type TableContext, addRow, addCol, deleteRow, deleteCol } from './tableUtils';

interface TableAssistantProps {
  position: { top: number; left: number };
  context: TableContext;
  editor: EditorView;
}

export function TableAssistant({ position, context, editor }: TableAssistantProps) {
  const dispatchUpdate = (newText: string | null) => {
    if (!newText) return; // Action invalid (e.g., deleting last row)
    
    editor.dispatch({
      changes: { from: context.from, to: context.to, insert: newText },
    });
    editor.focus();
  };

  const handleMouseDown = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      className="fixed z-50 flex items-center gap-1 px-1.5 py-1 bg-card border border-border-default rounded-md shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: position.top - 40,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center gap-0.5 border-r border-border-default pr-1.5">
        <button 
          onClick={() => dispatchUpdate(addRow(context, true))} 
          className="p-1.5 text-text-2 hover:text-foreground hover:bg-accent rounded transition-colors" 
          title="Add Row Above"
        >
          <ArrowUpToLine className="w-4 h-4" />
        </button>
        <button 
          onClick={() => dispatchUpdate(addRow(context, false))} 
          className="p-1.5 text-text-2 hover:text-foreground hover:bg-accent rounded transition-colors" 
          title="Add Row Below"
        >
          <ArrowDownToLine className="w-4 h-4" />
        </button>
        <button 
          onClick={() => dispatchUpdate(deleteRow(context))} 
          className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent" 
          title="Delete Row" 
          disabled={context.cursorRow <= 1} // Cannot delete header/separator
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex items-center gap-0.5 pl-1.5">
        <button 
          onClick={() => dispatchUpdate(addCol(context, true))} 
          className="p-1.5 text-text-2 hover:text-foreground hover:bg-accent rounded transition-colors" 
          title="Add Column Left"
        >
          <ArrowLeftToLine className="w-4 h-4" />
        </button>
        <button 
          onClick={() => dispatchUpdate(addCol(context, false))} 
          className="p-1.5 text-text-2 hover:text-foreground hover:bg-accent rounded transition-colors" 
          title="Add Column Right"
        >
          <ArrowRightToLine className="w-4 h-4" />
        </button>
        <button 
          onClick={() => dispatchUpdate(deleteCol(context))} 
          className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent" 
          title="Delete Column"
          disabled={context.rows[0].length <= 1}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
