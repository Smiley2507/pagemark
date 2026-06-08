import { PanelRightOpen, Plus, CheckCheck, FileText, Sparkles, BookOpen, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { KeyboardEvent } from 'react';

export type TocItem = {
  id: string;
  label: string;
  kind: 'section' | 'h1' | 'h2';
  sectionId: number;
};

interface OutlinePanelProps {
  tocItems: TocItem[];
  activeTocId: string | null;
  onTocItemClick: (item: TocItem) => void;
  onTocKeyboard: (e: KeyboardEvent<HTMLButtonElement>) => void;
  wordCount: number;
  reviewedCount: number;
  reviewTotal: number;
  issueCount: number;
  qualityScore: number | null | undefined;
  canAcceptAll: boolean;
  onAcceptAll: () => void;
  onCreateSection: () => void;
  onClose: () => void;
}

function StatDot(className: string) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', className)} />;
}

export function OutlinePanel({
  tocItems,
  activeTocId,
  onTocItemClick,
  onTocKeyboard,
  wordCount,
  reviewedCount,
  reviewTotal,
  issueCount,
  qualityScore,
  canAcceptAll,
  onAcceptAll,
  onCreateSection,
  onClose,
}: OutlinePanelProps) {

  const reviewDot =
    reviewTotal === 0 ? 'bg-text-muted' :
    reviewedCount >= reviewTotal ? 'bg-status-success-foreground' :
    reviewedCount > 0 ? 'bg-status-warning-foreground' :
    'bg-status-danger-foreground';

  const qualityDot =
    qualityScore == null ? 'bg-text-muted' :
    qualityScore >= 80 ? 'bg-status-success-foreground' :
    qualityScore >= 60 ? 'bg-status-warning-foreground' :
    'bg-status-danger-foreground';

  const issueDot =
    issueCount === 0 ? 'bg-status-success-foreground' :
    issueCount <= 5 ? 'bg-status-warning-foreground' :
    'bg-status-danger-foreground';

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-separator bg-canvas">
      <div className="flex items-center justify-between border-b border-separator px-4 h-11">
        <p className="text-meta-sm font-medium uppercase text-text-muted tracking-wider">Outline</p>
        <div className="flex items-center gap-1">
          {canAcceptAll && (
            <button
              onClick={onAcceptAll}
              className="rounded p-1 text-text-muted transition-colors hover:bg-interaction-muted hover:text-interaction-hover"
              title="Accept all review-ready sections"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted transition-colors hover:bg-interaction-muted hover:text-primary"
            aria-label="Close outline panel"
          >
            <PanelRightOpen className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <nav aria-label="Document table of contents" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {tocItems.map((item) => {
          const isActive = activeTocId === item.id || activeTocId === `section-${item.sectionId}`;
          return (
            <button
              key={item.id}
              type="button"
              data-toc-item="true"
              onClick={() => onTocItemClick(item)}
              onKeyDown={onTocKeyboard}
              className={cn(
                'block w-full rounded px-2 py-1 text-left text-meta transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring',
                item.kind === 'h1' && 'pl-6',
                item.kind === 'h2' && 'pl-8',
                isActive
                  ? 'bg-interaction-muted text-interaction-hover font-medium'
                  : 'text-text-muted opacity-60 hover:opacity-100 hover:bg-panel-muted hover:text-text-primary',
              )}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className="block truncate">{item.label}</span>
            </button>
          );
        })}
        {tocItems.length === 0 && (
          <Button type="button" size="sm" onClick={onCreateSection} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        )}
      </nav>

      <div className="shrink-0 border-t border-separator px-4 py-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-meta-sm">
            <span className="flex items-center gap-1.5 text-text-muted">
              <FileText className="h-3 w-3" />
              Words
            </span>
            <span className="font-medium text-text-primary">{wordCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-meta-sm">
            <span className="flex items-center gap-1.5 text-text-muted">
              <Sparkles className="h-3 w-3" />
              Review
            </span>
            <span className="flex items-center gap-1.5">
              {StatDot(reviewDot)}
              <span className="font-medium text-text-primary">{reviewedCount}/{reviewTotal}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-meta-sm">
            <span className="flex items-center gap-1.5 text-text-muted">
              <ShieldCheck className="h-3 w-3" />
              Quality
            </span>
            <span className="flex items-center gap-1.5">
              {StatDot(qualityDot)}
              <span className="font-medium text-text-primary">
                {qualityScore != null ? `${Math.round(qualityScore)}%` : '—'}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-meta-sm">
            <span className="flex items-center gap-1.5 text-text-muted">
              <BookOpen className="h-3 w-3" />
              Issues
            </span>
            <span className="flex items-center gap-1.5">
              {StatDot(issueDot)}
              <span className="font-medium text-text-primary">{issueCount}</span>
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
