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
    <div className="min-h-screen bg-workspace text-text-primary lg:grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
      <div className="flex items-center justify-center px-4 py-10 sm:px-8 lg:border-r lg:border-border">
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to Pagemark home"
          >
            <PagemarkWordmark className="h-10 text-text-primary" />
          </button>

          <div className="mt-8">
            <h1 className="text-title text-text-primary">{title}</h1>
            {subtitle && <p className="mt-2 text-body text-text-secondary">{subtitle}</p>}
          </div>

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

      <div className="hidden items-center justify-center bg-canvas lg:flex">
        <div className="max-w-lg px-10">
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
