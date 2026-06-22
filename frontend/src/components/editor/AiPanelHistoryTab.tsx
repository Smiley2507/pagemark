import { Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { useAiProposedChanges, useAcceptAiProposedChange, useRejectAiProposedChange, useUndoAiWorkRun } from '@/hooks/useAI';
import { AiProposedChangeCard } from './ai/AiProposedChangeCard';

interface AiPanelHistoryTabProps {
  projectId: number;
  documentId: number;
}

export function AiPanelHistoryTab({ projectId, documentId }: AiPanelHistoryTabProps) {
  const { data: proposedChanges = [], isLoading } = useAiProposedChanges(projectId, documentId);
  const acceptAiChange = useAcceptAiProposedChange(projectId, documentId);
  const rejectAiChange = useRejectAiProposedChange(projectId, documentId);
  const undoAiWorkRun = useUndoAiWorkRun(projectId, documentId);

  const closedChanges = proposedChanges.filter((c) => c.status !== 'proposed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-separator px-3 py-2">
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-status-success" />
          <X className="h-3.5 w-3.5 text-status-danger" />
          <RotateCcw className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs font-medium text-text-primary">Review history</span>
          <span className="rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-muted">
            {closedChanges.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {closedChanges.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <p className="text-sm text-text-muted">No closed changes yet</p>
            <p className="mt-1 text-xs text-text-muted">
              Accepted, rejected, or undone changes will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2 px-3 py-3">
            {closedChanges.map((change) => (
              <AiProposedChangeCard
                key={change.id}
                change={change}
                onAccept={(changeId) => acceptAiChange.mutate(changeId)}
                onReject={(changeId) => rejectAiChange.mutate(changeId)}
                onUndo={(runId) => undoAiWorkRun.mutate(runId)}
                isAccepting={acceptAiChange.isPending}
                isRejecting={rejectAiChange.isPending}
                isUndoing={undoAiWorkRun.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
