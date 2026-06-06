import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';

const documentStates = [
  {
    title: 'Analysis snapshot',
    badge: 'Project scope',
    lines: ['Primary languages: TypeScript, Python', 'API endpoints: 18 detected', 'Complexity: 164 files, 28k LOC'],
  },
  {
    title: 'Template recommendation',
    badge: 'Rule-based',
    lines: ['Recommended: API onboarding guide', 'Basis: backend routes, auth layer, SDK usage', 'AI-personalized available with provider'],
  },
  {
    title: 'Generation choice',
    badge: 'Approximate cost',
    lines: ['On demand: lower usage, section by section', 'Complete Document: faster, higher usage', 'Costs are estimates, not guaranteed billing'],
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Pagemark home">
            <PagemarkWordmark className="h-9 text-text-primary" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_30rem] lg:items-start">
            <div className="max-w-3xl">
              <Badge variant="generation">Multi-Document workspace for software projects</Badge>
              <h1 className="mt-5 text-hero text-text-primary md:text-6xl">
                Documentation built section by section from your source code.
              </h1>
              <p className="mt-5 max-w-2xl text-body-lg text-text-secondary">
                One Project powers multiple Documents. Connect source once, review Analysis, approve
                the Outline, and write — with provider usage always explicit.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register">
                  <Button size="lg">
                    Start your first Document
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg">Sign in</Button>
                </Link>
              </div>
            </div>

            <Surface variant="panel" padding="none" className="overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-meta-sm uppercase tracking-wide text-text-muted">First-Document journey</p>
                    <h2 className="mt-1 text-section text-text-primary">Product workflow</h2>
                  </div>
                  <Badge variant="review">Editor-ready when useful</Badge>
                </div>
              </div>
              <div className="grid gap-px bg-border md:grid-cols-3">
                {documentStates.map((state) => (
                  <div key={state.title} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-body font-semibold text-text-primary">{state.title}</h3>
                      <Badge variant="neutral">{state.badge}</Badge>
                    </div>
                    <ul className="mt-4 space-y-2 text-meta text-text-secondary">
                      {state.lines.map((line) => (
                        <li key={line} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-interaction" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="border-t border-border px-5 py-4">
                <p className="text-meta text-text-secondary">
                  One Project can produce multiple Documents for onboarding, architecture, operations,
                  or any other documentation purpose without re-ingesting the repository.
                </p>
              </div>
            </Surface>
          </div>
        </section>
      </main>
    </div>
  );
}
