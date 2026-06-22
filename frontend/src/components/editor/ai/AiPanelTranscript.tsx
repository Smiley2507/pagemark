import type { AiTranscriptTurn } from '@/lib/ai-panel-types';

interface AiPanelTranscriptProps {
  turns: AiTranscriptTurn[];
}

export function AiPanelTranscript({ turns }: AiPanelTranscriptProps) {
  if (turns.length === 0) return null;

  return (
    <div data-testid="ai-panel-transcript">
      <div className="sticky top-0 z-10 bg-panel/90 px-3 pb-1 pt-2 backdrop-blur-sm">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Conversation
        </span>
      </div>
      <div className="space-y-2 px-3 pb-2">
        {turns.map((turn) => {
          const isUser = turn.role === 'user';
          return (
            <div
              key={turn.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              data-testid={`ai-turn-${turn.role}`}
            >
              <div className="max-w-[88%]">
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
