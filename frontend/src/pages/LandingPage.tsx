import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileCode2,
  GitBranch,
  LayoutTemplate,
  PenSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';

const journeySteps = [
  {
    label: 'Connect source',
    text: 'GitHub is primary for synchronization and freshness checks. Repository URL, ZIP upload, and source-less setup remain available as fallbacks.',
    icon: GitBranch,
  },
  {
    label: 'Review Analysis',
    text: 'Repository facts appear progressively so maintainers can inspect languages, endpoints, and structural evidence before picking a Document purpose.',
    icon: FileCode2,
  },
  {
    label: 'Approve the Outline',
    text: 'Pagemark recommends Templates, adapts the Outline, and keeps generation optional until the maintainer confirms the Section structure.',
    icon: LayoutTemplate,
  },
  {
    label: 'Enter the editor',
    text: 'The maintainer reaches the Document as soon as useful work exists, with generation state, evidence, and review status kept explicit.',
    icon: PenSquare,
  },
];

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
      <header className="border-b border-border bg-canvas">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Pagemark home">
            <PagemarkWordmark className="h-9 text-text-primary" />
          </Link>
          <nav className="hidden items-center gap-6 text-meta text-text-secondary md:flex">
            <a className="transition-colors hover:text-text-primary" href="#product">Product</a>
            <a className="transition-colors hover:text-text-primary" href="#journey">First Document</a>
            <a className="transition-colors hover:text-text-primary" href="#byok">Provider model</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Start a Project</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section id="product" className="border-b border-border bg-workspace px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_30rem] lg:items-start">
            <div className="max-w-3xl">
              <Badge variant="generation">Source-connected multi-Document workspace</Badge>
              <h1 className="mt-5 text-hero text-text-primary md:text-6xl">
                Pagemark creates purpose-specific Documents from one connected Project.
              </h1>
              <p className="mt-5 max-w-2xl text-body-lg text-text-secondary">
                Connect a software project once, reuse the same Analysis across multiple Documents,
                and move from repository facts to reviewable drafts without hiding provider usage,
                source limitations, or review responsibility.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register">
                  <Button size="lg">
                    Start the first Document
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg">Open workspace</Button>
                </Link>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Notice variant="info" title="Static Analysis works without a provider">
                  Rule-based recommendations remain available even when the maintainer has not configured provider credentials yet.
                </Notice>
                <Notice variant="generation" title="AI usage is explicit before it happens">
                  Personalized recommendations, Outline adaptation, and prose generation disclose provider usage and approximate cost before action.
                </Notice>
              </div>
            </div>

            <Surface variant="panel" padding="none" className="overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-meta-sm uppercase tracking-wide text-text-muted">Live product state</p>
                    <h2 className="mt-1 text-section text-text-primary">First-Document journey</h2>
                  </div>
                  <Badge variant="review">Editor-ready when useful</Badge>
                </div>
              </div>
              <div className="grid gap-px bg-border md:grid-cols-3">
                {documentStates.map((state) => (
                  <div key={state.title} className="bg-panel p-5">
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
              <div className="border-t border-border bg-panel-muted px-5 py-4">
                <p className="text-meta text-text-secondary">
                  One Project can produce multiple Documents for onboarding, architecture, operations,
                  or any other documentation purpose without re-ingesting the repository.
                </p>
              </div>
            </Surface>
          </div>
        </section>

        <section id="journey" className="border-b border-border bg-canvas px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-meta-sm font-semibold uppercase tracking-wide text-interaction">First Document</p>
              <h2 className="mt-2 text-title text-text-primary">The first useful path is the product.</h2>
              <p className="mt-3 text-body text-text-secondary">
                The public entry, authentication, and setup flow all point into the same calm
                workspace model instead of a separate marketing layer or generic project wizard.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-4">
              {journeySteps.map((step) => (
                <Surface key={step.label} variant="panel" padding="lg">
                  <step.icon className="h-5 w-5 text-interaction" aria-hidden="true" />
                  <h3 className="mt-5 text-body font-semibold text-text-primary">{step.label}</h3>
                  <p className="mt-2 text-meta text-text-secondary">{step.text}</p>
                </Surface>
              ))}
            </div>
          </div>
        </section>

        <section id="byok" className="bg-workspace px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <Surface variant="panel" padding="lg">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-interaction" />
                <div>
                  <h2 className="text-section text-text-primary">Provider credentials stay explicit.</h2>
                  <p className="mt-2 text-body text-text-secondary">
                    Maintainers can skip provider setup during onboarding. Pagemark asks for a
                    provider credential only when they choose an AI-powered recommendation, Outline
                    adaptation, or generation action, and it keeps that step embedded in the flow.
                  </p>
                </div>
              </div>
            </Surface>
            <Surface variant="muted" padding="lg">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-interaction" />
                <div>
                  <h3 className="text-body font-semibold text-text-primary">What becomes AI-powered</h3>
                  <p className="mt-2 text-meta text-text-secondary">
                    Personalized recommendations, adapted Outlines, and generated drafts consume the
                    maintainer&apos;s provider account. Usage estimates are approximate and not
                    authoritative billing amounts.
                  </p>
                </div>
              </div>
            </Surface>
          </div>
        </section>
      </main>
    </div>
  );
}
