import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle, CircleAlert, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const noticeVariants = cva(
  'flex gap-3 rounded-lg border px-4 py-3 text-body',
  {
    variants: {
      variant: {
        info: 'border-status-info-foreground/25 bg-status-info text-status-info-foreground',
        success: 'border-status-success-foreground/25 bg-status-success text-status-success-foreground',
        warning: 'border-status-warning-foreground/25 bg-status-warning text-status-warning-foreground',
        danger: 'border-status-danger-foreground/25 bg-status-danger text-status-danger-foreground',
        generation: 'border-status-generation-foreground/25 bg-status-generation text-status-generation-foreground',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

const icons = {
  info: Info,
  success: CheckCircle,
  warning: CircleAlert,
  danger: CircleAlert,
  generation: Sparkles,
};

export interface NoticeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof noticeVariants> {
  title?: string;
}

function Notice({ className, variant = 'info', title, children, ...props }: NoticeProps) {
  const Icon = icons[variant || 'info'];
  return (
    <div className={cn(noticeVariants({ variant }), className)} role="status" {...props}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-current/90">{children}</div>
      </div>
    </div>
  );
}

export { Notice, noticeVariants };
