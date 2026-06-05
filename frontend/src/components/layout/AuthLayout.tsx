import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileCode2, LayoutTemplate, PenSquare } from 'lucide-react';
import { PagemarkWordmark } from './PagemarkWordmark';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';

const authJourney = [
  {
    title: 'Connect a Project',
    text: 'GitHub first, with repository URL, ZIP upload, and source-less fallback paths kept visible.',
    icon: FileCode2,
  },
  {
    title: 'Choose the right Document',
    text: 'Rule-based and AI-personalized recommendations stay explainable and tied to repository facts.',
    icon: LayoutTemplate,
  },
  {
    title: 'Enter the editor early',
    text: 'Approve the Outline, review generation choices, and start writing as soon as useful work exists.',
    icon: PenSquare,
  },
];

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
            className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      <div className="hidden bg-canvas lg:block">
        <div className="mx-auto flex h-full max-w-3xl flex-col justify-center px-10 py-12">
          <Badge variant="review">Same system as the workspace</Badge>
          <h2 className="mt-4 max-w-xl text-title text-text-primary">
            Authentication is part of the product, not a separate marketing surface.
          </h2>
          <p className="mt-3 max-w-xl text-body text-text-secondary">
            The first-Document journey keeps provider setup embedded, makes source limitations clear,
            and uses the same typography, spacing, semantic tokens, and restrained surfaces as the
            editor and Project workspace.
          </p>

          <div className="mt-8 grid gap-4">
            {authJourney.map((item) => (
              <Surface key={item.title} variant="panel" padding="lg">
                <item.icon className="h-5 w-5 text-interaction" aria-hidden="true" />
                <h3 className="mt-4 text-body font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-meta text-text-secondary">{item.text}</p>
              </Surface>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
