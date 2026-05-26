import React, { useState } from 'react';
import { EditorView } from '@codemirror/view';
import { type TableContext, addRow, addCol, deleteRow, deleteCol } from './tableUtils';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableHandlesProps {
  context: TableContext;
  editor: EditorView;
  bounds: { top: number; left: number; width: number; height: number };
}

export function TableHandles({ context, editor, bounds }: TableHandlesProps) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const dispatchUpdate = (newText: string | null) => {
    if (!newText) return;
    editor.dispatch({
      changes: { from: context.from, to: context.to, insert: newText },
    });
    editor.focus();
  };

  // Helper to calculate row height (approximate)
  const rowHeight = bounds.height / context.rows.length;
  const colWidth = bounds.width / Math.max(...context.rows.map(r => r.length));

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height
      }}
    >
      {/* Row Handles (Left side) */}
      {context.rows.map((_, i) => (
        <div
          key={`row-${i}`}
          className="absolute left-0 w-4 h-full flex items-center justify-center pointer-events-auto group"
          style={{
            top: i * rowHeight,
            height: rowHeight
          }}
          onMouseEnter={() => setHoveredRow(i)}
          onMouseLeave={() => setHoveredRow(null)}
        >
          <button
            onClick={() => dispatchUpdate(addRow(context, true))}
            className={cn(
              "absolute left-[-12px] p-0.5 bg-card border border-border-default rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm",
              hoveredRow === i && "opacity-100"
            )}
          >
            <Plus className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      ))}

      {/* Column Handles (Top side) */}
      {context.rows[0]?.map((_, i) => (
        <div
          key={`col-${i}`}
          className="absolute top-0 w-full h-4 flex items-center justify-center pointer-events-auto group"
          style={{
            left: i * colWidth,
            width: colWidth
          }}
          onMouseEnter={() => setHoveredCol(i)}
          onMouseLeave={() => setHoveredCol(null)}
        >
          <button
            onClick={() => dispatchUpdate(addCol(context, true))}
            className={cn(
              "absolute top-[-12px] p-0.5 bg-card border border-border-default rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm",
              hoveredCol === i && "opacity-100"
            )}
          >
            <Plus className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );
}
