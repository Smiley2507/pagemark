import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-muted border-t-primary',
          sizeMap[size]
        )}
      />
    </div>
  );
}

export function FullPageLoader({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <LoadingSpinner size="lg" />
      {message && (
        <p className="text-meta text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface SlideInProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  className?: string;
}

export function SlideIn({ children, direction = 'up', className }: SlideInProps) {
  const dirMap = {
    left: { x: -12, y: 0 },
    right: { x: 12, y: 0 },
    up: { x: 0, y: 12 },
    down: { x: 0, y: -12 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...dirMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
