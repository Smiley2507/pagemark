import { useEffect, useRef } from 'react';
import { FileText, Sparkles, PenLine, MessageSquare } from 'lucide-react';

interface EditorContextMenuProps {
  position: { top: number; left: number };
  hasSelection: boolean;
  selectedText: string;
  onAddContext: (text: string) => void;
  onPolish?: (text: string) => void;
  onExplain?: (text: string) => void;
  onClose: () => void;
}

export function EditorContextMenu({
  position,
  hasSelection,
  selectedText,
  onAddContext,
  onPolish,
  onExplain,
  onClose,
}: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (!hasSelection) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-52 rounded-lg border border-separator bg-overlay py-1 shadow-overlay"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        onClick={() => { onAddContext(selectedText); onClose(); }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-panel-muted"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500/60" />
        Add selection to AI context
      </button>

      <button
        onClick={() => { onExplain?.(selectedText); onClose(); }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-panel-muted"
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        Explain selection
      </button>

      <button
        onClick={() => { onPolish?.(selectedText); onClose(); }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-primary transition-colors hover:bg-panel-muted"
      >
        <PenLine className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        Polish phrasing
      </button>

      <div className="my-1 border-t border-separator" />

      <div className="flex items-center gap-2 px-3 py-1 text-[10px] text-text-muted">
        <span>Esc close</span>
      </div>
    </div>
  );
}
