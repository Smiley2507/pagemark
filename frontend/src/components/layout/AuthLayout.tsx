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
    <div className="flex min-h-screen">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center lg:hidden">
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

      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--primary)_0%,transparent_60%)] opacity-5" />
        <div className="relative z-10 max-w-md text-center">
          <PagemarkWordmark className="h-8" />
          <p className="mt-4 text-lg text-muted-foreground">
            Turn source code into structured technical documentation
            that developers refine section by section.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-left">
            {[
              { label: 'AI-Powered', desc: 'Generate docs from any codebase' },
              { label: 'Quality Built In', desc: 'Grammar & style checking' },
              { label: 'Team Ready', desc: 'Review workflow & collaboration' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border/50 bg-card/50 p-3">
                <div className="font-semibold text-sm text-foreground">{item.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
