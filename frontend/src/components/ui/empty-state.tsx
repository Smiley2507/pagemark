import * as React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Surface } from '@/components/ui/surface';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

function EmptyState({
  icon: Icon = FileText,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <Surface
      variant="muted"
      padding="lg"
      className={cn('flex flex-col items-center justify-center text-center', className)}
      {...props}
    >
      <Icon className="mb-3 h-8 w-8 text-text-muted" aria-hidden="true" />
      <h2 className="text-section font-semibold text-text-primary">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-body text-text-secondary">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Surface>
  );
}

export { EmptyState };
