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
          <div className="mb-8 text-center">
            <PagemarkWordmark className="h-12 mx-auto" />
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

      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-[#0a0e1a] p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,#1e3a5f_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,#2d1b69_0%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,#0f2027_0%,transparent_50%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/10 to-transparent" />
          <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/10 to-transparent" />
        </div>
        <div className="relative z-10 max-w-md text-center">
          <h2 className="text-3xl font-bold text-white">
            AI-assisted. Automated.{' '}
            <span className="text-primary">Collaborative.</span>
          </h2>
          <p className="mt-4 text-base text-white/60 leading-relaxed">
            Pagemark turns source code into structured technical documentation
            that developers refine section by section — with AI assistance,
            quality gates, and a review workflow built for teams.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-3 text-left">
            {[
              { label: 'AI-Assisted', desc: 'Smart outlines and writing suggestions from your codebase' },
              { label: 'Automated', desc: 'Grammar checking, readability scoring, and style consistency' },
              { label: 'Collaborative', desc: 'Submit, review, and approve sections with your team' },
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
