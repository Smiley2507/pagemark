import { Loader2, Check, Circle, AlertCircle, MinusCircle } from 'lucide-react';
import type { AnalysisStatus, AnalysisStepItem } from '@/types';
import { cn } from '@/lib/utils';

const DEFAULT_STEPS = [
  'Connecting to source',
  'Extracting source',
  'Detecting languages',
  'Parsing source files',
  'Detecting endpoints',
  'Computing complexity',
  'Finalizing results',
  'Generating documentation outline',
];

function StepIcon({ status }: { status: AnalysisStepItem['status'] }) {
  if (status === 'done') {
    return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === 'running') {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }
  if (status === 'failed') {
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
  if (status === 'skipped') {
    return <MinusCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground/40" />;
}

function formatElapsed(seconds?: number): string {
  if (seconds == null) return '';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

interface AnalysisProgressProps {
  status: AnalysisStatus | null | undefined;
  syncing?: boolean;
  workerUnavailable?: boolean;
  compact?: boolean;
}

export function AnalysisProgress({
  status,
  syncing,
  workerUnavailable,
  compact = false,
}: AnalysisProgressProps) {
  const active =
    syncing || status?.status === 'pending' || status?.status === 'running';
  const failed = status?.status === 'failed';
  const done = status?.status === 'completed';

  const steps: AnalysisStepItem[] =
    status?.steps?.length
      ? status.steps
      : DEFAULT_STEPS.map((name, i) => ({
          number: i + 1,
          name,
          status:
            status && status.step_number > i + 1
              ? 'done'
              : status && status.step_number === i + 1 && active
                ? 'running'
                : 'pending',
        }));

  const progress =
    status && status.total_steps > 0
      ? Math.round((status.step_number / status.total_steps) * 100)
      : 0;

  return (
    <div
      className={cn(
        'rounded-lg border p-6',
        failed
          ? 'border-destructive/20 bg-destructive/10'
          : done
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
            : 'border-border bg-card'
      )}
    >
      <div className="flex items-start gap-3">
        {active && <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-muted-foreground" />}
        {failed && <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />}
        {done && <Check className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />}
        <div className="min-w-0 flex-1">
          <h2 className="text-section font-semibold capitalize">
            {syncing ? 'Syncing repository…' : status?.current_step || 'Analysis'}
          </h2>
          {status?.step_detail && (
            <p className="mt-1 text-meta text-muted-foreground">{status.step_detail}</p>
          )}
          {status?.elapsed_seconds != null && active && (
            <p className="mt-0.5 text-meta-sm text-muted-foreground">
              Elapsed {formatElapsed(status.elapsed_seconds)}
            </p>
          )}
        </div>
        {active && status && (
          <span className="text-meta-sm font-medium text-muted-foreground">{progress}%</span>
        )}
      </div>

      {workerUnavailable && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-meta text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          Analysis has not started. Start the Celery worker:{' '}
          <code className="text-meta-sm">docker compose up -d</code> or{' '}
          <code className="text-meta-sm">celery -A app.workers.celery_app worker</code>
        </p>
      )}

      {active && status && !compact && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {!compact && (
        <ul className="mt-4 space-y-2">
          {steps.map((step) => (
            <li key={step.number} className="flex items-center gap-2 text-meta-sm">
              <StepIcon status={step.status} />
              <span
                className={cn(
                  step.status === 'running' && 'font-medium text-foreground',
                  step.status === 'done' && 'text-muted-foreground',
                  step.status === 'pending' && 'text-muted-foreground/60',
                  step.status === 'skipped' && 'text-amber-700 dark:text-amber-300'
                )}
              >
                {step.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      {failed && status?.error_message && (
        <p className="mt-3 text-meta text-destructive">{status.error_message}</p>
      )}
    </div>
  );
}
