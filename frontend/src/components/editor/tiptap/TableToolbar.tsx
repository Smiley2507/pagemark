import type { Editor } from '@tiptap/core'
import { Trash2, Columns3, Rows3, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableToolbarProps {
  editor: Editor
  className?: string
}

export function TableToolbar({ editor, className }: TableToolbarProps) {
  if (!editor.isActive('table')) return null

  return (
    <div className={cn('flex items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-1 shadow-lg', className)}>
      <TableButton
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        label="Add column before"
      >
        <Plus className="h-3 w-3" />
        <Columns3 className="h-3 w-3" />
      </TableButton>
      <TableButton
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        label="Add column after"
      >
        <Columns3 className="h-3 w-3" />
        <Plus className="h-3 w-3" />
      </TableButton>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <TableButton
        onClick={() => editor.chain().focus().addRowBefore().run()}
        label="Add row before"
      >
        <Plus className="h-3 w-3" />
        <Rows3 className="h-3 w-3" />
      </TableButton>
      <TableButton
        onClick={() => editor.chain().focus().addRowAfter().run()}
        label="Add row after"
      >
        <Rows3 className="h-3 w-3" />
        <Plus className="h-3 w-3" />
      </TableButton>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <TableButton
        onClick={() => editor.chain().focus().deleteColumn().run()}
        label="Delete column"
        destructive
      >
        <Minus className="h-3 w-3" />
        <Columns3 className="h-3 w-3" />
      </TableButton>
      <TableButton
        onClick={() => editor.chain().focus().deleteRow().run()}
        label="Delete row"
        destructive
      >
        <Minus className="h-3 w-3" />
        <Rows3 className="h-3 w-3" />
      </TableButton>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <TableButton
        onClick={() => editor.chain().focus().deleteTable().run()}
        label="Delete table"
        destructive
      >
        <Trash2 className="h-3.5 w-3.5" />
      </TableButton>
    </div>
  )
}

function TableButton({
  onClick,
  label,
  destructive,
  children,
}: {
  onClick: () => void
  label: string
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'flex items-center gap-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        destructive && 'hover:text-status-danger-foreground',
      )}
    >
      {children}
    </button>
  )
}
