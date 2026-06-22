import { AiProposedChangeCard } from './AiProposedChangeCard';
import type { AiReviewItem } from '@/lib/ai-panel-types';

interface AiPanelReviewQueueProps {
  items: AiReviewItem[];
  onAccept: (changeId: number) => void;
  onReject: (changeId: number) => void;
  onUndo: (runId: number) => void;
  isAccepting: boolean;
  isRejecting: boolean;
  isUndoing: boolean;
}

export function AiPanelReviewQueue({
  items,
  onAccept,
  onReject,
  onUndo,
  isAccepting,
  isRejecting,
  isUndoing,
}: AiPanelReviewQueueProps) {
  if (items.length === 0) return null;

  return (
    <div className="border-t border-separator">
      <div className="sticky top-0 z-10 bg-panel/90 px-3 pb-1 pt-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Review
          </span>
          {items.length > 0 && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
              {items.length} open
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 px-3 pb-2">
        {items.map((item) => (
          <AiProposedChangeCard
            key={item.id}
            change={item.change}
            onAccept={onAccept}
            onReject={onReject}
            onUndo={onUndo}
            isAccepting={isAccepting}
            isRejecting={isRejecting}
            isUndoing={isUndoing}
          />
        ))}
      </div>
    </div>
  );
}
