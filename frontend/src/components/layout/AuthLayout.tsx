import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PagemarkWordmark } from './PagemarkWordmark';
import { Surface } from '@/components/ui/surface';

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
    <div className="min-h-screen bg-canvas text-text-primary lg:grid lg:grid-cols-2">
      <div className="flex flex-col px-4 py-8 sm:px-10 lg:border-r lg:border-border/60">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to Pagemark home"
        >
          <PagemarkWordmark className="h-10" />
        </button>

        <div className="mt-16 flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <h1 className="text-title text-text-primary">{title}</h1>
            {subtitle && <p className="mt-2 text-body text-text-secondary">{subtitle}</p>}

            <Surface variant="panel" padding="lg" className="mt-6">
              {children}
            </Surface>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-4 inline-flex items-center gap-1 text-meta text-text-muted transition-colors hover:text-text-primary"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to home
            </button>
          </div>
        </div>
      </div>

      <div
        className="relative hidden items-center justify-center overflow-hidden lg:flex"
        style={{
          background: [
            'linear-gradient(135deg, color-mix(in srgb, var(--interaction) 18%, var(--canvas)) 0%, color-mix(in srgb, var(--interaction) 6%, var(--canvas)) 50%, var(--canvas) 100%)',
          ].join(', '),
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: [
              'linear-gradient(var(--interaction) 1px, transparent 1px)',
              'linear-gradient(90deg, var(--interaction) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: '40px 40px',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              'radial-gradient(ellipse 80% 50% at 50% 20%, color-mix(in srgb, var(--interaction) 20%, transparent) 0%, transparent 60%)',
              'radial-gradient(ellipse 50% 60% at 80% 70%, color-mix(in srgb, var(--interaction) 12%, transparent) 0%, transparent 50%)',
            ].join(', '),
          }}
        />
        <div className="relative max-w-lg px-10">
          <h2 className="text-title text-text-primary">
            Connect source once, write multiple Documents.
          </h2>
          <p className="mt-3 text-body text-text-secondary">
            Same workspace model as the editor — no marketing surface, no separate wizard.
            Provider credentials stay optional until you choose an AI-powered action.
          </p>
        </div>
      </div>
    </div>
  );
}