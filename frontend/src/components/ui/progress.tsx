import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label?: string;
}

function Progress({ value, max = 100, label, className, ...props }: ProgressProps) {
  const bounded = Math.min(Math.max(value, 0), max);
  const percentage = max > 0 ? Math.round((bounded / max) * 100) : 0;

  return (
    <div className={cn('space-y-1.5', className)} {...props}>
      {label && (
        <div className="flex items-center justify-between text-meta text-text-secondary">
          <span>{label}</span>
          <span className="tabular-nums">{percentage}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={bounded}
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-panel-muted"
      >
        <div
          className="h-full rounded-full bg-interaction transition-[width]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export { Progress };
