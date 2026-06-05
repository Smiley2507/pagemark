import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PagemarkWordmark } from './PagemarkWordmark';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AuthLayout({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <button onClick={() => navigate('/')} className="mx-auto block">
              <PagemarkWordmark className="h-12 mx-auto" />
            </button>
            {subtitle && (
              <p className="mt-2 text-meta text-text-muted">{subtitle}</p>
            )}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-separator bg-panel p-8 shadow-overlay"
          >
            {children}
          </motion.div>
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 text-meta text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to home
            </button>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-sidebar p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(79,70,229,0.12)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(139,92,246,0.08)_0%,transparent_50%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-interaction/20 to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-interaction/10 to-transparent" />
        </div>
        <div className="relative z-10 max-w-md text-center space-y-8">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Documentation that stays{' '}
            <span className="text-interaction">fresh</span>
            <br />
            with every commit.
          </h2>
          <div className="grid grid-cols-1 gap-3 text-left">
            {[
              {
                label: 'Repository Analysis',
                desc: 'Pagemark scans your codebase and produces structured facts — languages, endpoints, dependencies — that inform every documentation decision.',
              },
              {
                label: 'Template-Based Outlines',
                desc: 'Match a documentation purpose to a Template, adapt the proposed Outline, and approve it to materialize editable Sections.',
              },
              {
                label: 'AI Generation & Freshness',
                desc: 'Generate prose from your own AI provider key. When source code changes, affected Sections are flagged so nothing stays stale.',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3.5">
                <div className="font-medium text-sm text-white">{item.label}</div>
                <div className="mt-0.5 text-xs text-white/40">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
