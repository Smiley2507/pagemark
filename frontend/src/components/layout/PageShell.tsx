import { cn } from '@/lib/utils';
import { SidebarNavigation } from './SidebarNavigation';

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
    <div className="flex min-h-screen bg-background text-foreground">
      <SidebarNavigation />
      <div className="flex-1 overflow-auto">
        <main className={cn('mx-auto px-8 py-8', maxWidth)}>{children}</main>
      </div>
    </div>
  );
}
