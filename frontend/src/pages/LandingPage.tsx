import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Code2,
  FileCheck2,
  GitBranch,
  KeyRound,
  Layers3,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';
import heroImage from '@/assets/hero.png';

const proofItems = [
  {
    label: 'Analysis',
    text: 'Repository facts become a reusable Project snapshot.',
    icon: Code2,
  },
  {
    label: 'Outline',
    text: 'Templates become editable Section structures.',
    icon: Layers3,
  },
  {
    label: 'Review',
    text: 'Generated prose stays draft until accepted.',
    icon: FileCheck2,
  },
];

const valueProps = [
  {
    title: 'Source-grounded setup',
    description:
      'Start with repository facts instead of a blank page. Analysis snapshots inform Template recommendations and Outline adaptation.',
    icon: GitBranch,
  },
  {
    title: 'Reviewable generation',
    description:
      'Generate the complete Document or work Section by Section. Every generated Section remains a draft until reviewed.',
    icon: Sparkles,
  },
  {
    title: 'Provider-aware usage',
    description:
      'See estimated provider usage before generation, then keep run-level and Section-level usage records after generation.',
    icon: KeyRound,
  },
  {
    title: 'Freshness workflow',
    description:
      'Reviewed Sections can be flagged when source evidence changes without overwriting accepted content.',
    icon: RefreshCw,
  },
];

const workflow = [
  {
    step: '01',
    title: 'Connect source',
    description:
      'Connect GitHub, upload a ZIP, or start without source. Repository Analysis produces reusable facts for the Project.',
  },
  {
    step: '02',
    title: 'Shape the Outline',
    description:
      'Choose a Template or create a Custom Outline. Review proposed Sections before they become the active Document structure.',
  },
  {
    step: '03',
    title: 'Generate and review',
    description:
      'Generate prose with your active provider, edit drafts, and explicitly accept content when it is ready.',
  },
];

const faqs = [
  {
    question: 'Can I use Pagemark without an AI key?',
    answer:
      'Yes. Static Analysis and rule-based Template recommendations work without a provider credential. AI-personalized recommendations and prose generation require your active provider key.',
  },
  {
    question: 'What is the difference between a Template and an Outline?',
    answer:
      'A Template is a reusable documentation intent. An Outline is the concrete Section structure for one Document, shaped by your Template choice and Project Analysis.',
  },
  {
    question: 'Does generated content become final automatically?',
    answer:
      'No. Generated prose enters as a Generated Draft. A maintainer must explicitly accept the current Section content before it becomes reviewed.',
  },
  {
    question: 'How does freshness work?',
    answer:
      'When source evidence changes, Pagemark can flag reviewed Sections as potentially stale. The workflow asks for review instead of overwriting accepted content.',
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Surface variant="panel" padding="none">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-body font-medium text-text-primary transition-colors hover:bg-panel-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{question}</span>
        <ChevronDown
          className={open ? 'h-4 w-4 shrink-0 rotate-180 text-text-muted transition-transform' : 'h-4 w-4 shrink-0 text-text-muted transition-transform'}
          aria-hidden="true"
        />
      </button>
      {open && <p className="px-5 pb-5 text-body text-text-secondary">{answer}</p>}
    </Surface>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Pagemark home">
            <PagemarkWordmark className="h-9 text-text-primary" />
          </Link>
          <nav className="hidden items-center gap-6 text-meta text-text-secondary md:flex">
            <a className="transition-colors hover:text-text-primary" href="#workflow">Workflow</a>
            <a className="transition-colors hover:text-text-primary" href="#why">Why Pagemark</a>
            <a className="transition-colors hover:text-text-primary" href="#faq">FAQ</a>
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
        <section className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden border-b border-border bg-workspace">
          <img
            src={heroImage}
            alt=""
            className="pointer-events-none absolute bottom-10 right-0 hidden h-[70vh] max-h-[520px] w-auto opacity-20 lg:block"
            aria-hidden="true"
          />
          <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
            <div className="max-w-3xl">
              <Badge variant="generation">AI-assisted documentation for maintainers</Badge>
              <h1 className="mt-6 max-w-4xl text-hero text-text-primary md:text-6xl">
                Documentation that keeps pace with your codebase.
              </h1>
              <p className="mt-6 max-w-2xl text-body-lg text-text-secondary">
                Pagemark analyzes your repository, recommends the right documentation structure,
                and helps you generate reviewable Section drafts from your own AI provider key.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register">
                  <Button size="lg">
                    Start a Project
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg">Sign in</Button>
                </Link>
              </div>
              <p className="mt-4 text-meta text-text-muted">
                Static Analysis works without an AI key. Generation uses your configured provider credential.
              </p>
            </div>

            <div className="mt-12 grid max-w-4xl gap-3 md:grid-cols-3">
              {proofItems.map((item) => (
                <Surface key={item.label} variant="panel" padding="default">
                  <item.icon className="h-5 w-5 text-interaction" aria-hidden="true" />
                  <p className="mt-3 text-meta-sm uppercase tracking-wide text-text-muted">{item.label}</p>
                  <p className="mt-1 text-body font-medium text-text-primary">{item.text}</p>
                </Surface>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-border bg-canvas px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-meta-sm font-semibold uppercase tracking-wide text-interaction">Workflow</p>
              <h2 className="mt-2 text-title text-text-primary">From source code to reviewed Sections.</h2>
              <p className="mt-3 text-body text-text-secondary">
                Pagemark separates setup, generation, and review so maintainers can keep control of the Document lifecycle.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {workflow.map((item) => (
                <Surface key={item.step} variant="panel" padding="lg">
                  <span className="text-meta-sm font-semibold text-interaction">{item.step}</span>
                  <h3 className="mt-4 text-section text-text-primary">{item.title}</h3>
                  <p className="mt-3 text-body text-text-secondary">{item.description}</p>
                </Surface>
              ))}
            </div>
          </div>
        </section>

        <section id="why" className="border-b border-border bg-panel-muted px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-meta-sm font-semibold uppercase tracking-wide text-interaction">Why Pagemark</p>
              <h2 className="mt-2 text-title text-text-primary">A documentation workspace shaped around review.</h2>
              <p className="mt-3 text-body text-text-secondary">
                The system treats generated prose as a starting point, not final content. Source facts, provider usage,
                and review state remain visible as the Document evolves.
              </p>
              <Notice variant="info" title="Designed for BYOK">
                Pagemark records provider usage context, but your active provider credential remains the source of AI capacity.
              </Notice>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {valueProps.map((item) => (
                <Surface key={item.title} variant="panel" padding="default">
                  <item.icon className="h-5 w-5 text-interaction" aria-hidden="true" />
                  <h3 className="mt-4 text-body font-semibold text-text-primary">{item.title}</h3>
                  <p className="mt-2 text-meta text-text-secondary">{item.description}</p>
                </Surface>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-sidebar px-4 py-16 text-sidebar-foreground sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-title">Start with the next Project that needs real docs.</h2>
              <p className="mt-3 text-body text-sidebar-foreground/75">
                Import source, approve an Outline, generate drafts, and review each Section when it is ready.
              </p>
            </div>
            <Link to="/register">
              <Button size="lg">
                Start a Project
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </section>

        <section id="faq" className="bg-canvas px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <p className="text-meta-sm font-semibold uppercase tracking-wide text-interaction">FAQ</p>
              <h2 className="mt-2 text-title text-text-primary">Common questions</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-canvas px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-meta text-text-secondary md:flex-row md:items-center md:justify-between">
          <PagemarkWordmark className="h-8 text-text-primary" />
          <div className="flex flex-wrap gap-4">
            <a className="hover:text-text-primary" href="#workflow">Workflow</a>
            <a className="hover:text-text-primary" href="#why">Why Pagemark</a>
            <Link className="hover:text-text-primary" to="/login">Sign in</Link>
          </div>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Built for reviewed documentation.
          </span>
        </div>
      </footer>
    </div>
  );
}
