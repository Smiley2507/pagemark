import { Check, GitPullRequestDraft, Loader2, RotateCcw, X } from 'lucide-react';
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

  const openChanges = proposedChanges.filter((c) => c.status === 'proposed');
  const closedChanges = proposedChanges.filter((c) => c.status !== 'proposed');
  const hasChanges = openChanges.length > 0 || closedChanges.length > 0;

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
          <GitPullRequestDraft className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-medium text-text-primary">Changes</span>
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
            {openChanges.length} open
          </span>
          <span className="rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-muted">
            {closedChanges.length} closed
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!hasChanges ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <p className="text-sm text-text-muted">No AI changes yet</p>
            <p className="mt-1 text-xs text-text-muted">
              Proposed, accepted, rejected, or undone changes will appear here.
            </p>
          </div>
        ) : (
          <div className="px-3 py-3">
            {openChanges.length > 0 && (
              <section aria-label="Open proposed changes">
                <div className="mb-2 flex items-center gap-2">
                  <GitPullRequestDraft className="h-3.5 w-3.5 text-accent" />
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Open changes</h3>
                  <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">{openChanges.length}</span>
                </div>
                <div className="space-y-2">
                  {openChanges.map((change) => (
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
              </section>
            )}

            {closedChanges.length > 0 && (
              <section className={openChanges.length > 0 ? 'mt-5' : undefined} aria-label="Closed change history">
                <div className="mb-2 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-status-success" />
                  <X className="h-3.5 w-3.5 text-status-danger" />
                  <RotateCcw className="h-3.5 w-3.5 text-text-muted" />
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Change history</h3>
                  <span className="rounded bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-muted">{closedChanges.length}</span>
                </div>
                <div className="space-y-2">
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
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
