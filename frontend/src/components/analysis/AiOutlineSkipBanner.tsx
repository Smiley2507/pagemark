import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AiOutlineSkipBannerProps {
  onOpenSettings?: () => void;
  className?: string;
}

export function AiOutlineSkipBanner({ onOpenSettings, className }: AiOutlineSkipBannerProps) {
  return (
    <div
      className={
        className ??
        'rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="text-body-sm font-medium text-amber-900 dark:text-amber-100">
              Documentation outline was not generated
            </p>
            <p className="mt-1 text-meta text-amber-800 dark:text-amber-200">
              Code analysis completed successfully. Add an Anthropic or Google AI Studio API key
              in Settings to enable AI outline generation.
            </p>
          </div>
        </div>
        {onOpenSettings && (
          <Button variant="outline" size="sm" onClick={onOpenSettings}>
            Open AI settings
          </Button>
        )}
      </div>
    </div>
  );
}
