import { X, FileText, BookOpen, FileCode, Layout, Search, Highlighter } from 'lucide-react';
import { useAiStore } from '@/store/aiStore';
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

const PRESET_RESOURCES: { label: string; type: AiAttachment['type']; ref: string }[] = [
  { label: 'Current Section', type: 'section', ref: 'current-section' },
  { label: 'Document Context', type: 'document', ref: 'current-document' },
  { label: 'Repository Source', type: 'source', ref: 'repository-source' },
  { label: 'Document Template', type: 'template', ref: 'document-template' },
];

interface AiPanelAttachmentsProps {
  onClose: () => void;
  onOpenPalette?: () => void;
}

export function AiPanelAttachments({ onClose, onOpenPalette }: AiPanelAttachmentsProps) {
  const { attachments, addAttachment, removeAttachment } = useAiStore();

  return (
    <div className="border-t border-separator bg-canvas px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text-primary">Attach Resources</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
          aria-label="Close attachments"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {PRESET_RESOURCES.map((r) => {
          const Icon = TYPE_ICONS[r.type];
          const isAttached = attachments.some((a) => a.reference === r.ref);
          return (
            <button
              key={r.ref}
              onClick={() => {
                if (isAttached) {
                  const found = attachments.find((a) => a.reference === r.ref);
                  if (found) removeAttachment(found.id);
                } else {
                  addAttachment({
                    id: `preset-${r.ref}`,
                    type: r.type,
                    label: r.label,
                    reference: r.ref,
                  });
                }
              }}
              className={
                'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ' +
                (isAttached
                  ? 'bg-interaction-muted text-interaction-hover'
                  : 'border border-separator text-text-muted hover:bg-panel-muted hover:text-text-primary')
              }
            >
              <Icon className="h-3 w-3 shrink-0" />
              {r.label}
              {isAttached && <X className="ml-0.5 h-2.5 w-2.5" />}
            </button>
          );
        })}

        {onOpenPalette && (
          <button
            onClick={onOpenPalette}
            className="inline-flex items-center gap-1 rounded border border-dashed border-separator px-2 py-1 text-xs text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
          >
            <Search className="h-3 w-3" />
            Browse resources…
          </button>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-text-muted">Attached ({attachments.length})</span>
          <div className="flex flex-wrap gap-1">
            {attachments.map((a) => {
              const Icon = TYPE_ICONS[a.type];
              return (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 rounded-full bg-panel-muted px-2 py-0.5 text-[11px] text-text-secondary"
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="max-w-[80px] truncate">{a.label}</span>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    className="ml-0.5 rounded-full text-text-muted hover:text-text-primary"
                    aria-label={`Remove ${a.label}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
