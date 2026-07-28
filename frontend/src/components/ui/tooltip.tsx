import * as React from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<{ 'aria-describedby'?: string }>;
  className?: string;
  side?: 'top' | 'bottom';
}

function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
  const id = React.useId();
  return (
    <span className="group relative inline-flex">
      {React.cloneElement(children, { 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 rounded-md border border-border bg-overlay px-2.5 py-1.5 text-meta text-overlay-foreground opacity-0 shadow-overlay transition-opacity',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          'group-hover:opacity-100 group-focus-within:opacity-100',
          className
        )}
      >
        {content}
      </span>
    </span>
  );
}

export { Tooltip };
