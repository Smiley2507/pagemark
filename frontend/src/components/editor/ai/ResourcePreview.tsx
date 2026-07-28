import { FileText, BookOpen, FileCode, Layout, Highlighter, X, ExternalLink } from 'lucide-react';
import type { AiAttachment } from '@/store/aiStore';

const TYPE_ICONS: Record<string, typeof FileText> = {
  file: FileText,
  note: BookOpen,
  section: FileText,
  document: BookOpen,
  source: FileCode,
  template: Layout,
  transient: Highlighter,
};

const TYPE_LABELS: Record<string, string> = {
  file: 'File',
  note: 'Note',
  section: 'Section',
  document: 'Document',
  source: 'Source Code',
  template: 'Template',
  transient: 'Selection',
};

interface ResourcePreviewProps {
  attachment: AiAttachment;
  onRemove: (id: string) => void;
}

export function ResourcePreview({ attachment, onRemove }: ResourcePreviewProps) {
  const Icon = TYPE_ICONS[attachment.type] || FileText;
  const typeLabel = TYPE_LABELS[attachment.type] || attachment.type;

  return (
    <div className="w-64 rounded-lg border border-separator bg-overlay p-3 shadow-overlay">
      <div className="mb-2 flex items-start gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-panel-muted">
          <Icon className="h-4 w-4 text-text-secondary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-text-primary">
            {attachment.label}
          </div>
          {attachment.reference && (
            <div className="truncate text-[10px] text-text-muted">
              {attachment.reference}
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        <span className="rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
          {typeLabel}
        </span>
        {attachment.resourceId && (
          <span className="rounded bg-interaction-muted px-1.5 py-0.5 text-[10px] text-interaction-hover">
            ID: {attachment.resourceId}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-separator pt-2">
        <button
          onClick={() => onRemove(attachment.id)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
        >
          <X className="h-3 w-3" />
          Remove
        </button>
        <button
          disabled
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary disabled:opacity-30"
        >
          <ExternalLink className="h-3 w-3" />
          Details
        </button>
      </div>
    </div>
  );
}
