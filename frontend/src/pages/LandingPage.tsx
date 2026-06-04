import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Shield, Zap, Sparkles, FileText, Users, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';
import { motion } from 'framer-motion';

const features = [
  {
    icon: Sparkles,
    title: 'AI-Generated Outlines',
    description: 'Import any codebase — Pagemark analyzes your architecture, endpoints, and patterns to produce a structured documentation outline.',
  },
  {
    icon: BookOpen,
    title: 'Section-by-Section Refinement',
    description: 'Each section is an editable markdown document. Use AI to expand, rephrase, or polish individual sections without losing context.',
  },
  {
    icon: Shield,
    title: 'Quality Gates',
    description: 'Built-in grammar checking, readability scoring, and style consistency checks ensure your docs meet the bar before publishing.',
  },
  {
    icon: FileText,
    title: 'Live Preview',
    description: 'Write in CodeMirror 6 with live markdown preview — see headings, bold, tables, and code blocks rendered as you type.',
  },
  {
    icon: Users,
    title: 'Review Workflow',
    description: 'Submit sections for review, track quality scores, and approve changes. Built for teams that care about documentation quality.',
  },
  {
    icon: Zap,
    title: 'Export Anywhere',
    description: 'Export your documentation to Markdown, PDF, or DOCX. Ready for publishing on your own site or documentation platform.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Connect your codebase',
    description: 'Upload a ZIP or connect a Git repository. Pagemark analyzes languages, endpoints, dependencies, and architecture patterns automatically.',
  },
  {
    number: '02',
    title: 'Review the outline',
    description: 'Pagemark generates a structured documentation outline from your codebase. Add, remove, or reorder sections to match your needs.',
  },
  {
    number: '03',
    title: 'Write with AI assistance',
    description: 'Each section opens in a markdown editor with live preview, grammar checking, and AI-powered phrasing suggestions. Iterate until it reads right.',
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
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
          <PagemarkWordmark className="h-7" />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative px-6 pt-20 pb-16 md:pt-28 md:pb-20 max-w-5xl mx-auto text-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_65%)] opacity-[0.03] pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1 text-sm text-muted-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI-powered documentation for engineering teams
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-tight">
              Documentation that{' '}
              <span className="text-primary">writes itself</span>
              <br />
              and reads like a team effort.
            </h1>
            <p className="mt-5 text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Pagemark turns source code into structured technical documentation
              that developers refine section by section — with AI assistance,
              quality gates, and a review workflow built for teams.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-10 flex items-center justify-center gap-4"
          >
            <Link to="/register">
              <Button size="lg" className="gap-2 h-12 px-8 text-base shadow-md">
                Start for free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Sign in
              </Button>
            </Link>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="mt-4 text-sm text-muted-foreground"
          >
            No credit card required &middot; Export anytime
          </motion.p>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="px-6 py-20 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView="visible"
            viewport={{ once: true }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">How it works</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              From codebase to polished documentation in three steps.
            </p>
          </motion.div>
          <StaggerChildren className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <FadeUp key={step.number}>
                <div className="relative group">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                      {step.number}
                    </span>
                    {i < steps.length - 1 && (
                      <div className="hidden md:block h-px flex-1 bg-border group-hover:bg-primary/20 transition-colors" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </FadeUp>
            ))}
          </StaggerChildren>
        </section>

        {/* ── Divider ── */}
        <div className="px-6 max-w-5xl mx-auto">
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        {/* ── Features ── */}
        <section id="features" className="px-6 py-20 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView="visible"
              viewport={{ once: true }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-14"
            >
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Everything you need to document well</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                Built for engineering teams that take documentation seriously.
              </p>
            </motion.div>
            <StaggerChildren className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <FadeUp key={f.title}>
                  <div className="group rounded-xl border border-border bg-card p-6 hover:shadow-md hover:border-primary/20 transition-all duration-200">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                </FadeUp>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="relative px-6 py-24 max-w-3xl mx-auto text-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_60%)] opacity-[0.04] pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView="visible"
            viewport={{ once: true }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Start documenting your codebase today
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Import a project, let AI generate the outline, and refine section by section.
              Free to start, no credit card required.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="gap-2 h-12 px-8 text-base shadow-md">
                  Get started free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <PagemarkWordmark className="h-5" />
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-foreground transition-colors">Sign up</Link>
          </div>
          <span>&copy; 2026 Pagemark</span>
        </div>
      </footer>
    </div>
  );
}
