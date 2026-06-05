import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { PagemarkWordmark } from './PagemarkWordmark';
import { ArrowLeft } from 'lucide-react';

export function AuthLayout({
  children,
  title = 'Welcome back',
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="grid min-h-screen bg-workspace text-text-primary lg:grid-cols-[1fr_1.05fr]">
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Back to Pagemark home"
            >
              <PagemarkWordmark className="h-10 text-text-primary" />
            </button>
            <h1 className="mt-8 text-title text-text-primary">{title}</h1>
            {subtitle && <p className="mt-2 text-body text-text-secondary">{subtitle}</p>}
          </div>

          <div className="rounded-lg border border-border bg-panel p-6">
            {children}
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 text-meta text-text-muted transition-colors hover:text-text-primary"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to home
            </button>
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-sidebar-border lg:flex">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ duration: 20, ease: 'easeOut', repeat: Infinity, repeatType: 'reverse' }}
        >
          <img
            src="https://images.unsplash.com/photo-1673526759327-54f1f5b27322?q=80&w=2064&auto=format&fit=crop"
            alt=""
            className="h-full w-full object-cover"
            aria-hidden="true"
          />
        </motion.div>
      </div>
    </div>
  );
}
