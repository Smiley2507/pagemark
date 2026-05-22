import { cn } from '@/lib/utils';

export function PagemarkWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-title font-bold text-foreground', className)}>
      Pagemark
    </span>
  );
}
