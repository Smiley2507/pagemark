import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileCode2, GitBranch, Layers, LayoutTemplate, PenSquare, ShieldCheck, Star, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';

const features = [
  {
    icon: GitBranch,
    title: 'Connect source once',
    text: 'GitHub, URL, or ZIP. Analysis runs once and every Document reuses the same repository facts.',
  },
  {
    icon: Layers,
    title: 'Multiple Documents, one Project',
    text: 'Onboarding, API reference, operations guide — create purpose-specific Documents without re-ingesting.',
  },
  {
    icon: LayoutTemplate,
    title: 'Templates that fit your code',
    text: 'Rule-based and AI-personalized Template recommendations grounded in your actual repository structure.',
  },
  {
    icon: PenSquare,
    title: 'Write section by section',
    text: 'Editable blocks with source evidence, review state, and freshness tracking built into the workflow.',
  },
  {
    icon: ShieldCheck,
    title: 'Provider usage stays explicit',
    text: 'No hidden AI costs. Static Analysis works without a credential; AI actions disclose usage before they run.',
  },
  {
    icon: Zap,
    title: 'Editor-ready when you are',
    text: 'Approve the Outline, choose generation mode, and reach the editor as soon as useful work exists.',
  },
];

const testimonials = [
  {
    name: 'Riley Chen',
    role: 'Senior Engineer',
    text: 'We connect our monorepo once and get onboarding docs, API guides, and runbooks — all from the same Analysis.',
  },
  {
    name: 'Jordan Taylor',
    role: 'DevEx Lead',
    text: 'The freshness tracking alone saves us hours. When source changes, we know exactly which sections need review.',
  },
  {
    name: 'Sam Patel',
    role: 'Technical Writer',
    text: 'Section-by-section writing means I can review a generated draft, accept it, and move on — no wrestling with a monolithic doc.',
  },
];

const faqItems = [
  {
    q: 'Do I need an AI provider to use Pagemark?',
    a: 'No. Static Analysis and rule-based Template recommendations work without any provider credential. AI-personalized recommendations, Outline adaptation, and prose generation use your own provider account — you choose when to enable them.',
  },
  {
    q: 'Can I start without connecting source code?',
    a: 'Yes. You can create a blank Project and write documentation from scratch. Source-connected features like Template recommendations, evidence references, and freshness tracking only become available once you connect.',
  },
  {
    q: 'How does the multi-Document model work?',
    a: 'One Project holds a shared Analysis snapshot. Each Document picks the relevant facts, chooses its own Template or Outline, and manages its own generation, review, and freshness lifecycle independently.',
  },
  {
    q: 'What happens when my source code changes?',
    a: 'Pagemark flags reviewed sections as potentially stale and explains what changed. It never overwrites reviewed content without your explicit action — you decide whether to update, regenerate, or leave the section as-is.',
  },
  {
    q: 'How are AI costs handled?',
    a: 'All AI actions use your own provider credential (Claude, Google AI Studio, etc.). You see estimated token usage and approximate cost before generation starts. Pagemark never charges for inference.',
  },
  {
    q: 'Can I export my documentation?',
    a: 'Yes. Export single Documents as Markdown, styled HTML, or print-ready PDF. Branding, logo, headers, footers, and page layout are all configurable.',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="relative border-b border-border/60 bg-canvas/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link to="/" aria-label="Pagemark home">
            <PagemarkWordmark className="h-9" />
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
        <section className="relative overflow-hidden px-4 py-20 sm:px-8 sm:py-28">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                'radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--interaction) 14%, transparent) 0%, transparent 70%)',
                'radial-gradient(ellipse 50% 60% at 80% 40%, color-mix(in srgb, var(--interaction) 8%, transparent) 0%, transparent 60%)',
                'radial-gradient(ellipse 50% 60% at 20% 60%, color-mix(in srgb, var(--interaction) 5%, transparent) 0%, transparent 50%)',
              ].join(', '),
            }}
          />
          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="generation">Multi-Document workspace for software projects</Badge>
              <h1 className="mt-6 text-hero text-text-primary md:text-6xl lg:text-7xl">
                Documentation built section by section from your source code.
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-body-lg text-text-secondary">
                One Project powers multiple Documents. Connect source once, review Analysis, approve
                the Outline, and write — with provider usage always explicit and review state never hidden.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
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

            <div className="mt-16 grid gap-4 md:grid-cols-3">
              {[
                { label: 'Analysis', value: 'Languages, endpoints, complexity', detail: 'Progressive reveal from one ingest' },
                { label: 'Documents', value: 'Onboarding → API → Ops', detail: 'Reuse facts, choose purpose' },
                { label: 'Sections', value: 'Reviewable, trackable, fresh', detail: 'Source evidence at every claim' },
              ].map((item) => (
                <Surface key={item.label} variant="panel" padding="lg" className="text-center">
                  <p className="text-meta-sm font-medium uppercase tracking-wide text-text-muted">{item.label}</p>
                  <p className="mt-2 text-section font-semibold text-text-primary">{item.value}</p>
                  <p className="mt-1 text-meta text-text-secondary">{item.detail}</p>
                </Surface>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 px-4 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="neutral">Capabilities</Badge>
              <h2 className="mt-4 text-title text-text-primary">Everything you need to ship documentation that stays current.</h2>
              <p className="mt-3 text-body text-text-secondary">
                Pagemark connects your source code to every Document you produce, so nothing gets stale and nothing gets hidden.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Surface key={feature.title} variant="panel" padding="lg">
                  <feature.icon className="h-5 w-5 text-interaction" aria-hidden="true" />
                  <h3 className="mt-4 text-body font-semibold text-text-primary">{feature.title}</h3>
                  <p className="mt-2 text-meta text-text-secondary">{feature.text}</p>
                </Surface>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-border/60 px-4 py-20 sm:px-8 sm:py-28">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                'radial-gradient(ellipse 70% 50% at 30% 50%, color-mix(in srgb, var(--interaction) 10%, transparent) 0%, transparent 60%)',
                'radial-gradient(ellipse 50% 60% at 70% 30%, color-mix(in srgb, var(--interaction) 6%, transparent) 0%, transparent 50%)',
              ].join(', '),
            }}
          />
          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="review">Trusted by teams</Badge>
              <h2 className="mt-4 text-title text-text-primary">Used by documentation teams that ship.</h2>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <Surface key={testimonial.name} variant="panel" padding="lg" className="flex flex-col justify-between">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-interaction text-interaction" />
                    ))}
                  </div>
                  <p className="mt-4 text-body text-text-secondary">&ldquo;{testimonial.text}&rdquo;</p>
                  <div className="mt-6 border-t border-border pt-4">
                    <p className="text-body font-semibold text-text-primary">{testimonial.name}</p>
                    <p className="text-meta text-text-muted">{testimonial.role}</p>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 px-4 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <Badge variant="neutral">FAQ</Badge>
              <h2 className="mt-4 text-title text-text-primary">Frequently asked questions.</h2>
            </div>
            <div className="mx-auto mt-10 max-w-3xl divide-y divide-border">
              {faqItems.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 text-body font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ArrowRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 max-w-2xl text-body text-text-secondary">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-border/60 px-4 py-20 sm:px-8 sm:py-28">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                'radial-gradient(ellipse 80% 50% at 50% 100%, color-mix(in srgb, var(--interaction) 12%, transparent) 0%, transparent 70%)',
                'radial-gradient(ellipse 50% 60% at 30% 50%, color-mix(in srgb, var(--interaction) 6%, transparent) 0%, transparent 50%)',
              ].join(', '),
            }}
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <h2 className="text-title text-text-primary">Ready to ship documentation that stays current?</h2>
            <p className="mt-3 text-body text-text-secondary">
              Connect a Project, create your first Document, and experience section-by-section writing with source evidence and review state built in.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
        </section>
      </main>

      <footer className="border-t border-border/60 px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <PagemarkWordmark className="h-8 text-text-muted" />
          <p className="text-meta text-text-muted">&copy; {new Date().getFullYear()} Pagemark. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}