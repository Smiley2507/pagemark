import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle, CircleAlert, CircleDashed, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-meta-sm font-medium',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-panel-muted text-text-secondary',
        success: 'border-status-success-foreground/25 bg-status-success text-status-success-foreground',
        warning: 'border-status-warning-foreground/25 bg-status-warning text-status-warning-foreground',
        danger: 'border-status-danger-foreground/25 bg-status-danger text-status-danger-foreground',
        info: 'border-status-info-foreground/25 bg-status-info text-status-info-foreground',
        generation: 'border-status-generation-foreground/25 bg-status-generation text-status-generation-foreground',
        review: 'border-status-review-foreground/25 bg-status-review text-status-review-foreground',
        needsInput: 'border-status-needs-input-foreground/25 bg-status-needs-input text-status-needs-input-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

const statusIcons = {
  neutral: CircleDashed,
  success: CheckCircle,
  warning: CircleAlert,
  danger: CircleAlert,
  info: Info,
  generation: Sparkles,
  review: CheckCircle,
  needsInput: CircleAlert,
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  showIcon?: boolean;
}

function Badge({ className, variant = 'neutral', showIcon = true, children, ...props }: BadgeProps) {
  const Icon = statusIcons[variant || 'neutral'];
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {showIcon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
