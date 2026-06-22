import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AiIssue } from '@/lib/ai-panel-types';

interface AiPanelClarificationProps {
  issue: AiIssue;
  onSubmit: (answer: string) => void;
  isSubmitting?: boolean;
}

export function AiPanelClarification({ issue, onSubmit, isSubmitting }: AiPanelClarificationProps) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    if (!answer.trim()) return;
    onSubmit(answer.trim());
    setAnswer('');
  };

  return (
    <div className="mx-3 my-2 space-y-2 rounded-lg border border-warning bg-warning/5 p-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="text-sm text-text-primary">{issue.message}</p>
          {issue.kind === 'clarification_section' && (
            <p className="mt-0.5 text-[11px] text-text-muted">
              This question comes from the code analysis. Answering helps the AI generate better content.
            </p>
          )}
          {issue.kind === 'clarification' && (
            <p className="mt-0.5 text-[11px] text-text-muted">
              Add the missing context to the project brief so the AI can proceed.
            </p>
          )}
        </div>
      </div>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={
          issue.kind === 'clarification_section'
            ? 'Provide the missing context...'
            : 'Add the missing correction or project fact...'
        }
        className="w-full resize-none rounded border border-input bg-canvas px-2.5 py-1.5 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
        rows={2}
      />
      <Button
        size="sm"
        className="h-8 w-full text-xs"
        onClick={handleSubmit}
        disabled={isSubmitting || !answer.trim()}
      >
        {isSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        {issue.kind === 'clarification_section' ? 'Submit Answer' : 'Save to Project Brief'}
      </Button>
    </div>
  );
}
