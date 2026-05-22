import { cn } from '@/lib/utils';
import { AppHeader } from './AppHeader';

export function PageShell({
  children,
  maxWidth = 'max-w-7xl',
  onOpenSettings,
}: {
  children: React.ReactNode;
  maxWidth?: string;
  onOpenSettings?: () => void;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader onOpenSettings={onOpenSettings} />
      <main className={cn('mx-auto px-6 py-8', maxWidth)}>{children}</main>
    </div>
  );
}
