import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Check, Copy, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type InlineAction = 'rewrite' | 'improve' | 'expand' | 'summarize';

interface AiInlineToolbarProps {
  position: { top: number; left: number };
  selectedText: string;
  onAction: (action: InlineAction, text: string) => Promise<string>;
  onReplace: (text: string) => void;
  onInsertBelow: (text: string) => void;
  onClose: () => void;
}

const ACTION_LABELS: Record<InlineAction, string> = {
  rewrite: 'Rewrite',
  improve: 'Improve',
  expand: 'Expand',
  summarize: 'Summarize',
};

const ACTION_PROMPTS: Record<InlineAction, string> = {
  rewrite: 'Rewrite the following text:',
  improve: 'Improve the clarity of the following text:',
  expand: 'Expand with more detail:',
  summarize: 'Summarize the key points:',
};

export function AiInlineToolbar({
  position,
  selectedText,
  onAction,
  onReplace,
  onInsertBelow,
  onClose,
}: AiInlineToolbarProps) {
  const [activeAction, setActiveAction] = useState<InlineAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAction = async (action: InlineAction) => {
    setActiveAction(action);
    setLoading(true);
    setResult(null);
    try {
      const response = await onAction(action, selectedText);
      setResult(response);
    } catch {
      setResult('Error: Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setActiveAction(null);
    setResult(null);
    setCopied(false);
  };

  const toolbarTop = position.top - 48;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: Math.max(8, toolbarTop),
        left: position.left,
        transform: 'translateX(-50%)',
      }}
    >
      {!activeAction && (
        <div className="flex items-center gap-0.5 rounded-lg border border-separator bg-panel px-1 py-1 shadow-lg">
          {(Object.keys(ACTION_LABELS) as InlineAction[]).map((action) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              className="rounded-md px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-interaction-muted hover:text-interaction-hover"
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
          <div className="mx-0.5 h-4 w-px bg-separator" />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
            aria-label="Close inline AI toolbar"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          </button>
        </div>
      )}

      {activeAction && (
        <div className="w-80 rounded-lg border border-separator bg-panel shadow-lg">
          <div className="flex items-center gap-2 border-b border-separator px-3 py-2">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-xs font-medium text-text-primary">
              {ACTION_LABELS[activeAction]}
            </span>
            <button
              onClick={reset}
              className="ml-auto text-[10px] text-text-muted transition-colors hover:text-text-primary"
            >
              Back
            </button>
          </div>
          <div className="px-3 py-2">
            {loading ? (
              <div className="flex items-center gap-2 py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />
                <span className="text-xs text-text-muted">Generating...</span>
              </div>
            ) : result ? (
              <div>
                <p className="max-h-24 overflow-y-auto text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                  {result.length > 300 ? result.slice(0, 300) + '...' : result}
                </p>
                <div className="mt-2 flex items-center gap-1 border-t border-separator pt-2">
                  <button
                    onClick={() => onReplace(result)}
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => onInsertBelow(result)}
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-interaction-hover transition-colors hover:bg-interaction-muted"
                  >
                    <ArrowDown className="mr-0.5 inline h-2.5 w-2.5" />
                    Insert
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <p className="py-1 text-xs text-text-muted italic">
                {ACTION_PROMPTS[activeAction]}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
