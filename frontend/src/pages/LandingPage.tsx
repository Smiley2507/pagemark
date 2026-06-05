import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Shield, Zap, Sparkles, FileText, Users, Plus, X, Code, Layers, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';

const features = [
  {
    icon: Code,
    title: 'Repository Analysis',
    description: 'Connect a Git repository or upload a ZIP. Pagemark scans your file tree, identifies languages and frameworks, detects endpoints, and builds a structured Analysis snapshot.',
  },
  {
    icon: Layers,
    title: 'Template-Based Outlines',
    description: 'Choose from templates matched to your documentation purpose and repository traits. Each Template generates a structured Outline with section headings ready for review.',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Generation',
    description: 'Generate prose for approved Outlines — complete-Document or section by section. Provider-agnostic: use your own API key from Claude, Google AI Studio, or compatible vendors.',
  },
  {
    icon: BookOpen,
    title: 'Section-by-Section Refinement',
    description: 'Every Section is editable markdown with live preview. Review AI-generated drafts, accept or improve them, and track which content is reviewed and potentially stale.',
  },
  {
    icon: CheckCircle,
    title: 'Source-Change Freshness',
    description: 'When your source code changes, Pagemark flags potentially stale Sections and explains what changed. Accept or reject freshness updates without losing reviewed content.',
  },
  {
    icon: Users,
    title: 'Review Workflow',
    description: 'Submit Sections for review, track quality scores, and manage lifecycle states. Built for Project maintainers who care about documentation accuracy.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Connect source code and analyze',
    description: 'Connect a Git repository or upload a ZIP. Analysis discovers languages, endpoints, dependencies, and architecture — producing a structured fact snapshot for your Project.',
  },
  {
    number: '02',
    title: 'Pick a template and confirm the outline',
    description: 'Choose from templates matched to your documentation purpose. Adapt the proposed Outline — rename, reorder, add, or remove Sections — then approve it to materialize editable Sections.',
  },
  {
    number: '03',
    title: 'Generate, review, and maintain',
    description: 'Generate prose for all Sections at once or one at a time. Review AI-generated drafts, accept them as reviewed, and receive freshness notices when source code changes.',
  },
];

function StaggerChildren({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FadeUp({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GridPattern() {
  return (
    <div
      className="absolute inset-0 opacity-[0.03] pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }}
      aria-hidden
    />
  );
}

function NoiseOverlay() {
  return (
    <div
      className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '256px 256px',
      }}
      aria-hidden
    />
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <FadeUp>
      <div className="rounded-xl border border-separator bg-panel overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium text-text-primary hover:bg-panel-muted transition-colors"
        >
          {question}
          {open ? <X className="h-4 w-4 text-text-muted shrink-0" /> : <Plus className="h-4 w-4 text-text-muted shrink-0" />}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="answer"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="px-6 pb-4 text-sm text-text-muted leading-relaxed">{answer}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeUp>
  );
}

export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.95]);

  return (
    <div className="flex min-h-screen flex-col bg-workspace">
      <main className="flex-1">
        {/* ── Hero ── */}
        <section
          ref={heroRef}
          className="relative h-screen flex flex-col bg-sidebar overflow-hidden"
        >
          <GridPattern />
          <NoiseOverlay />
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(79,70,229,0.12)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(139,92,246,0.08)_0%,transparent_50%)]" />
          </div>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-interaction/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-interaction/20 to-transparent" />

          {/* Nav inside hero */}
          <div className="relative z-20 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
            <PagemarkWordmark className="h-12 text-white" />
            <nav className="hidden md:flex items-center gap-6 text-sm text-text-muted">
              <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-text-muted hover:text-white">Sign in</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </div>
          </div>

          <motion.div
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1 text-sm text-text-muted mb-8">
                <Sparkles className="h-3.5 w-3.5 text-interaction" />
                AI-powered documentation for software projects
              </div>
              <h1 className="text-4xl md:text-7xl font-bold tracking-tight text-white leading-tight">
                Documentation that stays{' '}
                <span className="text-interaction">fresh</span>
                <br />
                with every commit.
              </h1>
              <p className="mt-6 text-lg md:text-xl text-text-muted max-w-3xl mx-auto leading-relaxed">
                Pagemark turns source code into structured technical documentation
                that developers refine section by section. AI generates Outlines from
                your repository, proposes prose, and detects stale Sections when
                your codebase changes.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-10 flex items-center justify-center gap-4"
            >
              <Link to="/register">
                <Button size="lg" className="bg-interaction text-interaction-foreground hover:bg-interaction-hover">
                  Start for free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="border-white/15 text-text-muted hover:text-white hover:bg-white/[0.06]">
                  Sign in
                </Button>
              </Link>
            </motion.div>
            <p className="mt-4 text-sm text-white/30">
              No credit card required &middot; Bring your own AI provider key
            </p>
          </motion.div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="relative px-6 py-24 max-w-5xl mx-auto">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,var(--interaction)_0%,transparent_60%)] opacity-[0.02] pointer-events-none" />
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary">How it works</h2>
            <p className="mt-3 text-text-muted max-w-2xl mx-auto">
              From source code to reviewed documentation in three workflow stages.
            </p>
          </div>
          <StaggerChildren className="grid gap-10 md:grid-cols-3">
            {steps.map((step, i) => (
              <FadeUp key={step.number}>
                <div className="relative group h-full">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-interaction-muted text-interaction font-bold text-sm group-hover:bg-interaction/15 transition-colors">
                      {step.number}
                    </span>
                    {i < steps.length - 1 && (
                      <div className="hidden md:block h-px flex-1 bg-separator group-hover:bg-interaction/30 transition-colors" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary">{step.title}</h3>
                  <p className="mt-2 text-sm text-text-muted leading-relaxed">{step.description}</p>
                </div>
              </FadeUp>
            ))}
          </StaggerChildren>
        </section>

        {/* ── Features ── */}
        <section id="features" className="relative px-6 py-24 bg-panel-muted">
          <div className="max-w-5xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-text-primary">Everything you need to document well</h2>
              <p className="mt-3 text-text-muted max-w-2xl mx-auto">
                Built for Project maintainers who treat documentation as part of the codebase.
              </p>
            </div>
            <StaggerChildren className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <FadeUp key={f.title}>
                  <div className="group rounded-xl border border-separator bg-panel p-6 hover:shadow-lg hover:border-interaction/20 hover:-translate-y-0.5 transition-all duration-200">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-interaction-muted group-hover:bg-interaction/15 group-hover:scale-110 transition-all duration-200">
                      <f.icon className="h-5 w-5 text-interaction" />
                    </div>
                    <h3 className="font-semibold text-text-primary">{f.title}</h3>
                    <p className="mt-2 text-sm text-text-muted leading-relaxed">{f.description}</p>
                  </div>
                </FadeUp>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative px-6 py-24 overflow-hidden">
          <div className="absolute inset-0 bg-sidebar" />
          <GridPattern />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.08)_0%,transparent_60%)] pointer-events-none" />
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Start documenting your codebase today
            </h2>
            <p className="mt-4 text-text-muted max-w-xl mx-auto">
              Import a Project, let Analysis discover your architecture, pick a Template,
              generate prose, and review Section by Section.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="bg-interaction text-interaction-foreground hover:bg-interaction-hover">
                  Get started free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="relative px-6 py-24 max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary">Frequently asked questions</h2>
            <p className="mt-3 text-text-muted max-w-2xl mx-auto">
              Everything you need to know about Pagemark.
            </p>
          </div>
          <StaggerChildren className="space-y-3">
            {[
              {
                q: 'How does Pagemark analyze my codebase?',
                a: 'Pagemark accepts a ZIP upload or Git connection, then produces an immutable Analysis snapshot: file tree, languages, frameworks, API endpoints, database models, and complexity metrics. No source code is stored — only the structural facts needed to generate documentation Outlines.',
              },
              {
                q: 'Do I need an API key to use AI features?',
                a: 'Yes. Pagemark is bring-your-own-key — you configure a Provider credential (e.g. Claude, Google AI Studio) in Settings. Your account stores encrypted keys, and you pick one as your Active provider. Static Analysis and rule-based Template recommendations work without any AI key.',
              },
              {
                q: 'What is a Template vs an Outline?',
                a: 'A Template is a reusable documentation intent — it defines section headings and guidance for a purpose (e.g. API reference, user guide). An Outline is the concrete section hierarchy for one Document, generated from a Template and adapted to your repository\'s Analysis facts.',
              },
              {
                q: 'Can I export my documentation?',
                a: 'Yes. Export to Markdown, PDF, or DOCX anytime. Your content is never locked in — you own everything you write and maintain.',
              },
              {
                q: 'How does freshness detection work?',
                a: 'When you re-sync source code, Pagemark compares the new Analysis snapshot against the one used during review. If relevant facts changed, affected Reviewed Sections become potentially stale. You can review what changed and accept or reject the freshness update per Section.',
              },
              {
                q: 'Is there a free tier?',
                a: 'Pagemark is free to start with no credit card required. You only pay for the AI provider credentials you bring — Pagemark itself does not charge for platform usage.',
              },
              {
                q: 'Can my team collaborate?',
                a: 'Yes. Documents live in Projects with organization-based access. Sections support a review workflow — generate, review, accept, and manage lifecycle states. Collaboration notes and quality reports are planned per Document.',
              },
            ].map((faq) => (
              <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
            ))}
          </StaggerChildren>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-separator px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-text-muted">
          <PagemarkWordmark className="h-9" />
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hover:text-text-primary transition-colors">How it works</a>
            <a href="#features" className="hover:text-text-primary transition-colors">Features</a>
            <Link to="/login" className="hover:text-text-primary transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-text-primary transition-colors">Sign up</Link>
          </div>
          <span>&copy; 2026 Pagemark</span>
        </div>
      </footer>
    </div>
  );
}
