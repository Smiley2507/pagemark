import * as React from 'react';
import { cn } from '@/lib/utils';
import { Surface } from '@/components/ui/surface';

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function Popover({ trigger, children, className }: PopoverProps) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {trigger}
      </button>
      {open && (
        <Surface
          id={panelId}
          variant="overlay"
          padding="sm"
          className={cn('absolute right-0 top-full z-50 mt-2 w-72', className)}
        >
          {children}
        </Surface>
      )}
    </span>
  );
}

export { Popover };
