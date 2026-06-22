import { FileText, Highlighter, FileCode } from 'lucide-react';
import type { AiTarget } from '@/lib/ai-panel-types';

interface AiPanelTargetProps {
  target: AiTarget;
}

const TARGET_ICONS = {
  document: FileCode,
  section: FileText,
  selection: Highlighter,
} as const;

const TARGET_LABELS: Record<AiTarget['type'], string> = {
  document: 'Document',
  section: 'Section',
  selection: 'Selection',
};

export function AiPanelTarget({ target }: AiPanelTargetProps) {
  const Icon = TARGET_ICONS[target.type];
  const label = target.type === 'selection'
    ? 'Selected text'
    : target.sectionHeading || 'Untitled';

  return (
    <div className="shrink-0 border-b border-separator px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 text-text-muted" />
        <span className="text-[11px] text-text-muted">
          Acting on
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-panel-muted px-1.5 py-0.5 text-[11px] font-medium text-text-primary">
          {TARGET_LABELS[target.type]}
          {target.sectionHeading && (
            <>
              <span className="text-text-muted">·</span>
              <span className="max-w-[100px] truncate">{target.sectionHeading}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
