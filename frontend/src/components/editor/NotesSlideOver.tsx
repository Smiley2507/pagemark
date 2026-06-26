import { X, MessageSquare } from 'lucide-react';
import { NotesPanel } from './NotesPanel';

interface NotesSlideOverProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  documentId: number;
  activeSectionId: number | null;
  initialScope?: 'document' | 'section';
  focusSignal?: number;
  sections?: Array<{ id: number; heading: string; title?: string | null }>;
}

export function NotesSlideOver({ open, onClose, projectId, documentId, activeSectionId, initialScope, focusSignal, sections }: NotesSlideOverProps) {
  if (!open) return null;

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-separator bg-panel">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-separator px-3">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs font-medium text-text-primary">Notes</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-text-muted transition-colors hover:text-text-primary"
          aria-label="Close notes"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <NotesPanel
          projectId={projectId}
          documentId={documentId}
          activeSectionId={activeSectionId}
          initialScope={initialScope}
          focusSignal={focusSignal}
          sections={sections}
        />
      </div>
    </div>
  );
}
