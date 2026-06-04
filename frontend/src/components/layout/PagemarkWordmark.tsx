import { cn } from '@/lib/utils';

export function PagemarkWordmark({ className }: { className?: string }) {
  return (
    <img
      src="/pagemark-logo.svg"
      alt="Pagemark"
      className={cn('h-6 w-auto', className)}
    />
  );
}
