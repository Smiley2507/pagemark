import { useState } from 'react';
import {
  ArrowUpDown,
  PencilLine,
  Plus,
  Trash2,
  Merge,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StructuralSuggestion } from '@/api/ai';

const TYPE_META: Record<
  StructuralSuggestion['type'],
  { icon: typeof ArrowUpDown; label: string; color: string }
> = {
  reorder: { icon: ArrowUpDown, label: 'Reorder', color: 'text-blue-500' },
  rename: { icon: PencilLine, label: 'Rename', color: 'text-amber-500' },
  add: { icon: Plus, label: 'Add', color: 'text-emerald-500' },
  remove: { icon: Trash2, label: 'Remove', color: 'text-red-500' },
  merge: { icon: Merge, label: 'Merge', color: 'text-violet-500' },
};

interface StructuralSuggestionsProps {
  suggestions: StructuralSuggestion[];
  onAccept: (suggestion: StructuralSuggestion) => void;
  onReject: (index: number) => void;
  onApplyAll: () => void;
  onClose: () => void;
  isApplying: boolean;
}

export function StructuralSuggestions({
  suggestions,
  onAccept,
  onReject,
  onApplyAll,
  onClose,
  isApplying,
}: StructuralSuggestionsProps) {
  const [acceptedSet, setAcceptedSet] = useState<Set<number>>(new Set());

  const handleAccept = (s: StructuralSuggestion, i: number) => {
    setAcceptedSet((prev) => new Set(prev).add(i));
    onAccept(s);
  };

  if (suggestions.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-center text-sm text-text-muted">
        Structure looks good — no suggestions.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-separator bg-canvas">
      <div className="flex items-center justify-between border-b border-separator px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Sparkles className="h-4 w-4 text-accent" />
          Suggested changes
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onApplyAll}
            disabled={isApplying}
          >
            {isApplying ? 'Applying...' : 'Apply all'}
          </Button>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-panel-muted hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-separator">
        {suggestions.map((s, i) => {
          const meta = TYPE_META[s.type];
          const Icon = meta.icon;
          const accepted = acceptedSet.has(i);

          return (
            <div
              key={i}
              className={`flex items-start gap-3 px-4 py-3 transition-colors ${accepted ? 'opacity-50' : ''}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    {meta.label}
                  </span>
                  <span className="truncate text-sm font-medium text-text-primary">
                    {s.heading ?? s.suggested_heading}
                  </span>
                  {s.suggested_heading && s.heading && s.type === 'rename' && (
                    <>
                      <span className="text-text-muted">→</span>
                      <span className="truncate text-sm font-medium text-text-primary">
                        {s.suggested_heading}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-text-muted">{s.reasoning}</p>
              </div>
              {!accepted && (
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleAccept(s, i)}
                    className="rounded p-1 text-emerald-500 hover:bg-emerald-500/10"
                    title="Accept"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onReject(i)}
                    className="rounded p-1 text-red-500 hover:bg-red-500/10"
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
