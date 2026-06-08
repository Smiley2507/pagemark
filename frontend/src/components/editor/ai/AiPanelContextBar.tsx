import { FileText, X, BookOpen, FileCode, Layout, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiStore } from '@/store/aiStore';
import type { AiAttachment } from '@/store/aiStore';

const ATTACHMENT_ICONS: Record<string, typeof FileText> = {
  file: FileText,
  note: BookOpen,
  section: FileText,
  document: BookOpen,
  source: FileCode,
  template: Layout,
};

interface AiPanelContextBarProps {
  activeSectionHeading: string | null;
  activeSectionStatus?: string;
  attachmentCount?: number;
}

export function AiPanelContextBar({
  activeSectionHeading,
  activeSectionStatus,
}: AiPanelContextBarProps) {
  const { contextBarOpen, setContextBarOpen, attachments, removeAttachment, clearAttachments } = useAiStore();

  if (!contextBarOpen) return null;

  const hasContext = activeSectionHeading || attachments.length > 0;

  return (
    <div className="shrink-0 border-b border-separator bg-canvas/80 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 shrink-0 text-indigo-500/60" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Using
        </span>

        <div className="ml-1 flex flex-1 flex-wrap gap-1">
          {activeSectionHeading && (
            <span className="inline-flex items-center gap-1 rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="max-w-[80px] truncate">{activeSectionHeading}</span>
              {activeSectionStatus && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-interaction" />
              )}
            </span>
          )}
          {attachments.map((a) => {
            const Icon = ATTACHMENT_ICONS[a.type];
            return (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary"
              >
                <Icon className="h-3 w-3 shrink-0" />
                <span className="max-w-[60px] truncate">{a.label}</span>
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="ml-0.5 rounded-sm text-text-muted hover:text-text-primary"
                  aria-label={`Remove ${a.label}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
          {!hasContext && (
            <span className="text-[10px] text-text-muted italic">
              No context selected
            </span>
          )}
        </div>

        {attachments.length > 0 && (
          <button
            onClick={clearAttachments}
            className="shrink-0 rounded px-1 py-0.5 text-[10px] text-text-muted transition-colors hover:text-text-primary"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
