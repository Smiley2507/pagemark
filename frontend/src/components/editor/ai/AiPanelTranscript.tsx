import { Trash2 } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import type { AiTranscriptTurn } from '@/lib/ai-panel-types';
import { AiProposedChangeCard } from './AiProposedChangeCard';
import type { AIProposedChange } from '@/api/ai';

interface AiPanelTranscriptProps {
  turns: AiTranscriptTurn[];
  onClear?: () => void;
  onAccept?: (changeId: number) => void;
  onReject?: (changeId: number) => void;
  onUndo?: (runId: number) => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
  isUndoing?: boolean;
}

export function AiPanelTranscript({
  turns,
  onClear,
  onAccept,
  onReject,
  onUndo,
  isAccepting = false,
  isRejecting = false,
  isUndoing = false,
}: AiPanelTranscriptProps) {
  if (turns.length === 0) return null;

  return (
    <div data-testid="ai-panel-transcript">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-panel/90 px-3 pb-1 pt-2 backdrop-blur-sm">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Conversation
        </span>
        {onClear && (
          <Tooltip content="Clear conversation">
            <button
              onClick={onClear}
              className="rounded p-1 text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
              aria-label="Clear conversation"
            >
              <Trash2 size={14} />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="space-y-2 px-3 pb-2">
        {turns.map((turn) => {
          const isUser = turn.role === 'user';
          const testId = isUser ? 'ai-turn-user' : `ai-turn-assistant-${turn.kind}`;
          const changes: AIProposedChange[] = turn.workRun?.proposed_changes ?? [];
          return (
            <div
              key={turn.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              data-testid={testId}
            >
              <div className="max-w-[88%] space-y-2">
                <div
                  className={[
                    'whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed',
                    isUser
                      ? 'bg-foreground text-background'
                      : turn.tone === 'error'
                        ? 'border border-status-danger-foreground/30 bg-status-danger/10 text-text-primary'
                        : 'border border-border bg-panel text-text-primary',
                  ].join(' ')}
                >
                  {turn.text}
                </div>
                {!isUser && turn.kind === 'work_run' && changes.length > 0 && onAccept && onReject && onUndo && (
                  <div className="space-y-2">
                    {changes.map((change) => (
                      <AiProposedChangeCard
                        key={change.id}
                        change={change}
                        onAccept={onAccept}
                        onReject={onReject}
                        onUndo={onUndo}
                        isAccepting={isAccepting}
                        isRejecting={isRejecting}
                        isUndoing={isUndoing}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
