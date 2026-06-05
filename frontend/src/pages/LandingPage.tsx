import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import {
  ArrowRight,
  ChevronDown,
  Code2,
  FileCheck2,
  GitBranch,
  Layers3,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';

const valueProps = [
  {
    title: 'Source-grounded',
    description:
      'Analysis produces reusable facts from your repository. Templates and Outlines are shaped by real code, not blank page assumptions.',
    icon: GitBranch,
  },
  {
    title: 'Review-gated',
    description:
      'Generated prose enters as a draft. Every Section stays draft until the maintainer accepts it. Source changes flag stale content without overwriting it.',
    icon: FileCheck2,
  },
  {
    title: 'Section by section',
    description:
      'Generate the complete Document in the background or work through Sections on demand. Provider usage is tracked per run and per Section.',
    icon: Layers3,
  },
  {
    title: 'Freshness-aware',
    description:
      'Reviewed Sections are checked against current source evidence. When code changes, Pagemark flags what needs re-review without touching accepted content.',
    icon: RefreshCw,
  },
];

const workflow = [
  {
    step: '01',
    title: 'Connect & Analyse',
    description:
      'Connect a repository or upload source. Analysis produces structured facts about the codebase — languages, endpoints, complexity — without writing anything.',
  },
  {
    step: '02',
    title: 'Shape the Outline',
    description:
      'Choose a Template or create a Custom Outline. Review the proposed Sections, reorder and rename, then approve the structure before generation begins.',
  },
  {
    step: '03',
    title: 'Generate & Review',
    description:
      'Generate prose with your own AI provider key. Each Section is a draft until you review and accept it. Source evidence links back to the repository.',
  },
];

const faqs = [
  {
    question: 'Can I use Pagemark without an AI key?',
    answer:
      'Yes. Static Analysis and rule-based Template recommendations work without a provider credential. AI-personalized recommendations and prose generation require your key.',
  },
  {
    question: 'What is the difference between a Template and an Outline?',
    answer:
      'A Template is a reusable documentation intent. An Outline is the concrete Section structure for one Document, adapted from the Template using your project facts.',
  },
  {
    question: 'Does generated content become final automatically?',
    answer:
      'No. Generated prose enters as a draft and stays there until a maintainer explicitly accepts the Section content. Accepting records the source evidence snapshot.',
  },
  {
    question: 'What happens when source code changes?',
    answer:
      'Pagemark flags reviewed Sections whose source evidence has changed since acceptance. It explains what changed and asks for re-review without overwriting content.',
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
          className={
            open
              ? 'h-4 w-4 shrink-0 rotate-180 text-text-muted transition-transform'
              : 'h-4 w-4 shrink-0 text-text-muted transition-transform'
          }
          aria-hidden="true"
        />
      </button>
      {open && <p className="px-5 pb-5 text-body text-text-secondary">{answer}</p>}
    </Surface>
  );
}

export function LandingPage() {
  const { scrollYProgress } = useScroll();
  const heroParallax = useTransform(scrollYProgress, [0, 0.3], [1, 1.1]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.6]);

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <header className="sticky top-0 z-40 border-b border-border bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Pagemark home">
            <PagemarkWordmark className="h-9 text-text-primary" />
          </Link>
          <nav className="hidden items-center gap-6 text-meta text-text-secondary md:flex">
            <a className="transition-colors hover:text-text-primary" href="#how-it-works">How it works</a>
            <a className="transition-colors hover:text-text-primary" href="#why-pagemark">Why Pagemark</a>
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
        <section className="relative overflow-hidden border-b border-border bg-workspace">
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ scale: heroParallax, opacity: heroOpacity }}
          >
            <img
              src="https://images.unsplash.com/photo-1618556450994-a6a128ef0d9d?q=80&w=2070&auto=format&fit=crop"
              alt=""
              className="h-full w-full object-cover"
              aria-hidden="true"
            />
          </motion.div>

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-workspace via-workspace via-60% to-transparent" />

          <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-24">
            <motion.div
              className="max-w-3xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <Badge variant="generation">AI-assisted documentation for maintainers</Badge>
              <h1 className="mt-6 max-w-4xl text-hero text-text-primary md:text-6xl">
                Documentation that keeps pace with your codebase.
              </h1>
              <p className="mt-5 max-w-2xl text-body-lg text-text-secondary">
                Pagemark analyses your repository, recommends the right documentation
                structure, and generates reviewable Section drafts from your own AI
                provider key. No platform-funded inference, no locked-in content.
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
                Static Analysis works without an AI key. Generation uses your configured provider.
              </p>
            </motion.div>

            <motion.div
              className="mt-16 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            >
              {[
                { label: 'Analysis', text: 'Repository facts become a reusable Project snapshot.', icon: Code2 },
                { label: 'Outline', text: 'Templates become editable Section structures.', icon: Layers3 },
                { label: 'Review', text: 'Generated prose stays draft until accepted.', icon: FileCheck2 },
              ].map((item) => (
                <div key={item.label} className="bg-workspace p-5">
                  <item.icon className="h-5 w-5 text-interaction" aria-hidden="true" />
                  <p className="mt-3 text-meta-sm uppercase tracking-wide text-text-muted">{item.label}</p>
                  <p className="mt-1 text-body font-medium text-text-primary">{item.text}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-border bg-canvas px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-meta-sm font-semibold uppercase tracking-wide text-interaction">Workflow</p>
              <h2 className="mt-2 text-title text-text-primary">From source code to reviewed Sections.</h2>
              <p className="mt-3 text-body text-text-secondary">
                Three stages turn repository facts into maintainer-approved documentation.
              </p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {workflow.map((item, index) => (
                <div key={item.step} className="relative">
                  {index < workflow.length - 1 && (
                    <div className="absolute left-8 top-8 hidden h-px w-[calc(100%-4rem)] border-t border-dashed border-border md:block" />
                  )}
                  <Surface variant="panel" padding="lg" className="relative">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-interaction text-meta-sm font-semibold text-interaction-foreground">
                      {item.step}
                    </span>
                    <h3 className="mt-5 text-section text-text-primary">{item.title}</h3>
                    <p className="mt-2 text-body text-text-secondary">{item.description}</p>
                  </Surface>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="why-pagemark" className="border-b border-border bg-workspace px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-meta-sm font-semibold uppercase tracking-wide text-interaction">Why Pagemark</p>
              <h2 className="mt-2 text-title text-text-primary">Built for reviewed documentation.</h2>
              <p className="mt-3 text-body text-text-secondary">
                The system treats generated prose as a starting point, not final content. Source facts,
                provider usage, and review state remain visible as the Document evolves.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {valueProps.map((item) => (
                <Surface key={item.title} variant="panel" padding="default">
                  <item.icon className="h-5 w-5 text-interaction" aria-hidden="true" />
                  <h3 className="mt-4 text-body font-semibold text-text-primary">{item.title}</h3>
                  <p className="mt-1 text-meta text-text-secondary">{item.description}</p>
                </Surface>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-b border-border bg-sidebar px-4 py-20 text-sidebar-foreground sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--sidebar-accent)_0%,_transparent_70%)] opacity-30" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <h2 className="text-title">Ready to document your next project?</h2>
              <p className="mt-3 max-w-xl text-body text-sidebar-foreground/70">
                Connect source, approve an Outline, and generate reviewable drafts with your own AI provider.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/register">
                  <Button size="lg" variant="default" className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
                    Start a Project
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    Sign in
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="bg-canvas px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-10 text-center">
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

      <footer className="border-t border-border bg-canvas px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 text-meta text-text-secondary md:flex-row md:items-center md:justify-between">
          <PagemarkWordmark className="h-8 text-text-primary" />
          <div className="flex flex-wrap gap-5">
            <a className="transition-colors hover:text-text-primary" href="#how-it-works">How it works</a>
            <a className="transition-colors hover:text-text-primary" href="#why-pagemark">Why Pagemark</a>
            <Link className="transition-colors hover:text-text-primary" to="/login">Sign in</Link>
          </div>
          <span className="text-meta text-text-muted">
            &copy; {new Date().getFullYear()} Pagemark
          </span>
        </div>
      </footer>
    </div>
  );
}
