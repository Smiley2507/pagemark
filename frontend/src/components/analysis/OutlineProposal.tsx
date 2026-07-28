import { Button } from '@/components/ui/button';
import type { OutlineDiff } from '@/types';
import { cn } from '@/lib/utils';

interface OutlineProposalProps {
  diff: OutlineDiff | undefined;
  outlineApplied?: boolean;
  onApply: () => void;
  applying?: boolean;
  canApply?: boolean;
}

export function OutlineProposal({
  diff,
  outlineApplied,
  onApply,
  applying,
  canApply = true,
}: OutlineProposalProps) {
  if (!diff?.proposed?.length) return null;

  const showApply = diff.has_changes && !outlineApplied;

  const added = diff.proposed.filter((h) => !diff.current.includes(h));
  const removed = diff.current.filter((h) => !diff.proposed.includes(h));
  const kept = diff.proposed.filter((h) => diff.current.includes(h));

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-section font-semibold">Proposed outline</h3>
          <p className="mt-1 text-meta text-muted-foreground">
            {outlineApplied
              ? 'Outline has been applied to your document.'
              : showApply
                ? 'Review AI-suggested section headings before applying.'
                : 'Outline matches your current document.'}
          </p>
        </div>
        {showApply && canApply && (
          <Button onClick={onApply} disabled={applying}>
            {applying ? 'Applying…' : 'Apply outline'}
          </Button>
        )}
      </div>

      {showApply && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {removed.length > 0 && (
            <div>
              <p className="mb-2 text-meta-sm font-medium text-destructive">Removed</p>
              <ul className="space-y-1">
                {removed.map((h) => (
                  <li key={h} className="text-meta-sm text-muted-foreground line-through">
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {added.length > 0 && (
            <div>
              <p className="mb-2 text-meta-sm font-medium text-emerald-600 dark:text-emerald-400">
                Added
              </p>
              <ul className="space-y-1">
                {added.map((h) => (
                  <li key={h} className="text-meta-sm font-medium text-foreground">
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kept.length > 0 && (
            <div>
              <p className="mb-2 text-meta-sm font-medium text-muted-foreground">Unchanged</p>
              <ul className="space-y-1">
                {kept.map((h) => (
                  <li key={h} className={cn('text-meta-sm text-muted-foreground')}>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!showApply && diff.proposed.length > 0 && (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-body-sm">
          {diff.proposed.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
