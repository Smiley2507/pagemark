import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
}

function SegmentedControl({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex rounded-lg bg-panel-muted p-1 text-meta text-text-secondary', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap',
              active
                ? 'bg-panel text-text-primary shadow-sm'
                : 'text-text-secondary hover:bg-accent hover:text-accent-foreground',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export { SegmentedControl };
