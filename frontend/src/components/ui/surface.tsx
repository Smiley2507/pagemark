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
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceVariants> {}

const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(surfaceVariants({ variant, padding }), className)}
      {...props}
    />
  )
);
Surface.displayName = 'Surface';

export { Surface, surfaceVariants };
