import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Shield, Zap, CheckCircle, Sparkles, FileText, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';

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
    description: 'Write in CodeMirror 6 with Obsidian-style live preview — see headings, bold, tables, and code blocks rendered as you type.',
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

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto w-full">
          <PagemarkWordmark className="h-7" />
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
        <section className="px-6 pt-20 pb-16 md:pt-28 md:pb-20 max-w-5xl mx-auto text-center">
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
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="gap-2 h-12 px-8 text-base">
                Start for free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Sign in
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required &middot; Export anytime
          </p>
        </section>

        {/* ── How it works ── */}
        <section className="px-6 py-20 max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">How it works</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              From codebase to polished documentation in three steps.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="relative">
                <div className="text-5xl font-bold text-primary/20 mb-4">{step.number}</div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="px-6 py-20 bg-muted/50 border-y border-border">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Everything you need to document well</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                Built for engineering teams that take documentation seriously.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-card p-6 hover:shadow-sm transition-shadow">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-6 py-20 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Start documenting your codebase today
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Import a project, let AI generate the outline, and refine section by section.
            Free to start, no credit card required.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="gap-2 h-12 px-8 text-base">
                Get started free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <PagemarkWordmark className="h-5" />
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-foreground transition-colors">Sign up</Link>
          </div>
          <span>&copy; 2026 Pagemark</span>
        </div>
      </footer>
    </div>
  );
}
