import React from 'react';
import { AlertTriangle, RefreshCw, FolderOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-5 w-5" />
        <span className="font-medium">{message}</span>
      </div>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = FolderOpen,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon?: React.ComponentType<React.ComponentProps<typeof FolderOpen>>;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <h3 className="mt-4 text-section font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-meta text-muted-foreground">{description}</p>
      <Button className="mt-6" onClick={onAction}>
        {actionLabel}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
