import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DiffViewer } from '@/components/editor/DiffViewer';
import { proposedChangeDiffText, proposedChangePreviewText } from '@/lib/ai-proposed-change-preview';
import type { AIProposedChange } from '@/api/ai';

interface AiProposedChangeCardProps {
  change: AIProposedChange;
  onAccept: (changeId: number) => void;
  onReject: (changeId: number) => void;
  onUndo: (runId: number) => void;
  isAccepting: boolean;
  isRejecting: boolean;
  isUndoing: boolean;
}

export function AiProposedChangeCard({
  change,
  onAccept,
  onReject,
  onUndo,
  isAccepting,
  isRejecting,
  isUndoing,
}: AiProposedChangeCardProps) {
  const { beforeText, afterText, isTextChange } = proposedChangeDiffText(change);
  const previewText = proposedChangePreviewText(change);
  const canUndo = change.status === 'accepted';
  const [expanded, setExpanded] = useState(change.status === 'proposed');

  useEffect(() => {
    setExpanded(change.status === 'proposed');
  }, [change.status]);

  return (
    <div className="rounded-lg border border-border bg-panel" data-testid={`ai-proposed-change-${change.id}`}>
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
          ) : (
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-text-primary">{change.title}</p>
          <p className="text-[10px] capitalize text-text-muted">
            {change.change_type.replaceAll('_', ' ')}
            {' · '}
            <span
              className={
                change.status === 'accepted'
                  ? 'text-status-success'
                  : change.status === 'rejected'
                    ? 'text-status-danger'
                    : change.status === 'undone'
                      ? 'text-text-muted'
                      : 'text-accent'
              }
            >
              {change.status}
            </span>
          </p>
          </div>
        </button>
        <div className="flex shrink-0 gap-1">
          {change.status === 'proposed' && (
            <>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => onAccept(change.id)} disabled={isAccepting}>
                {isAccepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Accept
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onReject(change.id)} disabled={isRejecting}>
                <X className="h-3 w-3" />
                Reject
              </Button>
            </>
          )}
          {canUndo && (
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onUndo(change.work_run_id)} disabled={isUndoing}>
              {isUndoing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Undo
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <>
          {change.rationale && <p className="px-3 pt-2 text-[11px] text-text-secondary">{change.rationale}</p>}
          <div className="max-h-72 overflow-auto p-3">
            {isTextChange ? (
              <DiffViewer oldText={beforeText} newText={afterText} viewMode="unified" />
            ) : (
              <pre className="whitespace-pre-wrap rounded bg-canvas p-2 text-[11px] leading-relaxed text-text-secondary">
                {previewText}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
