import { motion } from 'framer-motion';
import { PagemarkWordmark } from './PagemarkWordmark';

export function AuthLayout({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <PagemarkWordmark />
          {subtitle && (
            <p className="mt-2 text-meta text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-border bg-card p-8 shadow-sm"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
