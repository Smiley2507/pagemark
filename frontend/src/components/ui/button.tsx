import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-interaction text-interaction-foreground hover:bg-interaction-hover',
        secondary: 'bg-panel-muted text-text-primary hover:bg-accent hover:text-accent-foreground',
        success: 'border border-status-success-foreground/25 bg-status-success text-status-success-foreground hover:bg-status-success/80',
        warning: 'border border-status-warning-foreground/25 bg-status-warning text-status-warning-foreground hover:bg-status-warning/80',
        info: 'border border-status-info-foreground/25 bg-status-info text-status-info-foreground hover:bg-status-info/80',
        destructive: 'border border-status-danger-foreground/25 bg-status-danger text-status-danger-foreground hover:bg-status-danger/80',
        outline: 'border border-input bg-panel text-text-primary hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-text-secondary hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-8 rounded-md px-3 text-meta',
        lg: 'h-10 rounded-md px-6',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
