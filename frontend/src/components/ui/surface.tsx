import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const surfaceVariants = cva('rounded-lg text-text-primary', {
  variants: {
    variant: {
      canvas: 'bg-canvas',
      workspace: 'bg-workspace',
      panel: 'border border-border bg-panel',
      muted: 'border border-border bg-panel-muted',
      overlay: 'border border-border bg-overlay shadow-overlay',
      sidebar: 'bg-sidebar text-sidebar-foreground',
      glass: 'border border-[color-mix(in_oklch,var(--border),transparent_40%)] bg-[color-mix(in_oklch,var(--panel),transparent_30%)] backdrop-blur-sm',
      interactive: 'border border-border bg-panel card-hover cursor-pointer',
      'glass-interactive': 'border border-[color-mix(in_oklch,var(--border),transparent_40%)] bg-[color-mix(in_oklch,var(--panel),transparent_30%)] backdrop-blur-sm card-hover cursor-pointer',
    },
    padding: {
      none: '',
      sm: 'p-3',
      default: 'p-4',
      lg: 'p-6',
    },
  },
  defaultVariants: {
    variant: 'panel',
    padding: 'default',
  },
});

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof surfaceVariants> {
  as?: React.ElementType;
}

const Surface = React.forwardRef<HTMLElement, SurfaceProps>(
  ({ className, variant, padding, as, ...props }, ref) => {
    const Comp = (as || 'div') as React.ElementType;
    return (
      <Comp
        ref={ref}
        className={cn(surfaceVariants({ variant, padding }), className)}
        {...(props as Record<string, unknown>)}
      />
    );
  }
);
Surface.displayName = 'Surface';

export { Surface, surfaceVariants };
