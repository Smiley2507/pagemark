import { useNavigate } from 'react-router-dom';
import { PagemarkWordmark } from './PagemarkWordmark';
import { ArrowLeft, CheckCircle, FileCheck2, GitBranch, KeyRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import heroImage from '@/assets/hero.png';

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

          <Surface variant="panel" padding="lg">
            {children}
          </Surface>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 text-meta text-text-muted hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to home
            </button>
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-sidebar-border bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-center">
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute bottom-8 right-8 h-72 w-auto opacity-10"
        />
        <div className="relative z-10 max-w-lg">
          <Badge variant="generation">Maintainer workspace</Badge>
          <h2 className="mt-6 text-title text-sidebar-foreground">
            Keep documentation close to the code.
          </h2>
          <p className="mt-4 text-body text-sidebar-foreground/75">
            Return to your Projects, resume active generation, and review Sections that need attention.
          </p>
          <div className="mt-8 space-y-3">
            {[
              {
                icon: GitBranch,
                label: 'Project-level Analysis is reused across every Document.',
              },
              {
                icon: FileCheck2,
                label: 'Generated drafts stay separate from reviewed content.',
              },
              {
                icon: KeyRound,
                label: 'Provider usage and generation status remain durable.',
              },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 border-b border-sidebar-border pb-3">
                <item.icon className="mt-0.5 h-4 w-4 text-sidebar-foreground" aria-hidden="true" />
                <span className="text-body text-sidebar-foreground/85">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 inline-flex items-center gap-2 text-meta text-sidebar-foreground/70">
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            Reviewed Sections stay editable after acceptance.
          </div>
        </div>
      </div>
    </div>
  );
}
