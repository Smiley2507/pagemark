import ReactDiffViewer from 'react-diff-viewer-continued';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/store/themeStore';

interface DiffViewerProps {
  original: string;
  refined: string;
  onAccept: () => void;
  onReject: () => void;
}

function countLineChanges(original: string, refined: string) {
  const o = original.split('\n');
  const r = refined.split('\n');
  let added = 0;
  let removed = 0;
  const max = Math.max(o.length, r.length);
  for (let i = 0; i < max; i++) {
    if (o[i] === undefined) added++;
    else if (r[i] === undefined) removed++;
    else if (o[i] !== r[i]) {
      added++;
      removed++;
    }
  }
  return { added, removed };
}

export function DiffViewer({ original, refined, onAccept, onReject }: DiffViewerProps) {
  const { theme } = useThemeStore();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && document.documentElement.classList.contains('dark'));

  const { added, removed } = countLineChanges(original, refined);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-meta-sm">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
            +{added} added
          </span>
          <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-medium text-destructive">
            -{removed} removed
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReject}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <X className="mr-1 h-4 w-4" />
            Reject
          </Button>
          <Button size="sm" onClick={onAccept} className="bg-emerald-600 hover:bg-emerald-700">
            <Check className="mr-1 h-4 w-4" />
            Accept
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto text-sm">
        <ReactDiffViewer
          oldValue={original}
          newValue={refined}
          splitView
          useDarkTheme={isDark}
          hideLineNumbers={false}
        />
      </div>
    </div>
  );
}
