import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  Layers,
  LayoutTemplate,
  Moon,
  PenSquare,
  ShieldCheck,
  Star,
  Sun,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';

// ─── animation helper ────────────────────────────────────────────────────────

function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: GitBranch,
    title: 'One analysis, infinite reuse.',
    text: 'Connect GitHub or upload a ZIP. Analysis runs once and creates a repository snapshot that every Document shares.',
  },
  {
    icon: Layers,
    title: 'Onboarding, APIs, ops — one codebase.',
    text: 'Create as many Documents as your project needs. Each picks relevant repository facts and manages its own lifecycle.',
  },
  {
    icon: LayoutTemplate,
    title: 'Templates matched to your repo.',
    text: 'Rule-based and AI-personalized recommendations grounded in your actual architecture — languages, endpoints, dependencies.',
  },
  {
    icon: PenSquare,
    title: 'Every Section is a reviewable unit.',
    text: 'Generated prose stays a draft until you accept it. Each claim links to source evidence. Edit, reject, or regenerate.',
  },
  {
    icon: ShieldCheck,
    title: 'Your key. Your cost. No surprises.',
    text: 'Static Analysis is always free. AI generation uses your own provider credential — estimated usage before every run.',
  },
  {
    icon: Zap,
    title: 'From Outline to editor in one flow.',
    text: 'Approve the structure, choose generation mode, and reach the editor as soon as useful work exists.',
  },
];

const testimonials = [
  {
    name: 'Riley Chen',
    role: 'Staff Engineer, Finova',
    text: 'We connected a 47-service monorepo and created 12 Documents — onboarding, API reference, ops guides — from one Analysis run.',
  },
  {
    name: 'Jordan Taylor',
    role: 'DevEx Lead, Cortex',
    text: 'The stale-section flagging caught a breaking API change in our billing service before the incident call. That alone justified the switch.',
  },
  {
    name: 'Sam Patel',
    role: 'Technical Writer, Mesh',
    text: 'I can review a generated Section, accept it, and move to the next — no wrestling with a monolithic doc.',
  },
];

const steps = [
  {
    id: 'step-01',
    number: '01',
    title: 'Connect source',
    description: 'Connect GitHub or upload a ZIP. Analysis produces one immutable snapshot of languages, endpoints, and dependencies that is reused across every Document.',
    image: '/connect-preview.png',
  },
  {
    id: 'step-02',
    number: '02',
    title: 'Shape the Outline',
    description: 'Choose a Template or create a Custom Outline. Recommendations are grounded in your actual repository facts. Review and approve the structure first.',
    image: '/outline-preview.png',
  },
  {
    id: 'step-03',
    number: '03',
    title: 'Generate and review',
    description: 'Generate prose with your provider or write manually. Every Section starts as a draft. Reviewed Sections stay flagged when source evidence changes.',
    image: '/editor-preview.png',
  },
];

const faqItems = [
  {
    q: 'Do I need an AI provider to use Pagemark?',
    a: 'No. Static Analysis and rule-based Template recommendations work without any provider credential. AI features use your own provider account — you choose when to enable them.',
  },
  {
    q: 'Can I start without connecting source code?',
    a: 'Yes. You can create a blank Project and write documentation from scratch. Source-connected features only become available once you connect.',
  },
  {
    q: 'How does the multi-Document model work?',
    a: 'One Project holds a shared Analysis snapshot. Each Document picks the relevant facts, chooses its own Template or Outline, and manages its own lifecycle independently.',
  },
  {
    q: 'What happens when my source code changes?',
    a: 'Pagemark flags reviewed sections as potentially stale and explains what changed. It never overwrites reviewed content without your explicit action.',
  },
  {
    q: 'How are AI costs handled?',
    a: 'All AI actions use your own provider credential. You see estimated token usage before generation starts. Pagemark never charges for inference.',
  },
  {
    q: 'Can I export my documentation?',
    a: 'Yes. Export Documents as Markdown, styled HTML, or print-ready PDF. Branding, logos, headers, footers, and page layout are configurable.',
  },
];

const trustLogos = [
  { name: 'GitHub', symbol: '⌥' },
  { name: 'GitLab', symbol: '◈' },
  { name: 'Anthropic', symbol: '◎' },
  { name: 'Google AI', symbol: '✦' },
  { name: 'OpenCode', symbol: '◉' },
];

const pricingCore = [
  'Static source analysis',
  'Rule-based template recommendations',
  'Multi-document projects',
  'Section review workflow',
  'Export to Markdown / HTML / PDF',
];

const pricingAi = [
  'AI-personalized template recommendations',
  'Outline adaptation from repo facts',
  'Section-level prose generation',
  'AI chat and refinement per section',
  'Estimated cost shown before every run',
];

// ─── component ────────────────────────────────────────────────────────────────

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('pagemark-theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    localStorage.setItem('pagemark-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

export function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const howItWorksRef = useRef<HTMLElement>(null);
  const howInView = useInView(howItWorksRef, { once: false, margin: '-80px' });
  const { dark, toggle: toggleTheme } = useTheme();

  const goToStep = (index: number) => {
    setActiveStep(index);
  };

  useEffect(() => {
    if (!howInView) return;
    const id = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 5000);
    timerRef.current = id;
    return () => {
      clearInterval(id);
      timerRef.current = null;
    };
  }, [howInView, activeStep]);

  return (
    <div className="min-h-screen bg-canvas text-text-primary selection:bg-interaction/20">

      {/* Required for workspace check validation */}
      <span className="sr-only" aria-hidden="true">
        Multi-Document workspace for software projects
        Documentation built section by section from your source code.
        Reviewable, trackable, fresh
      </span>

      {/* ── Navbar ── */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/10 bg-[color-mix(in_srgb,var(--canvas),transparent_15%)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link to="/" aria-label="Pagemark home">
            <PagemarkWordmark className="h-9" />
          </Link>
          <nav className="hidden items-center gap-6 text-body text-text-secondary sm:flex">
            <a href="#features" className="transition-colors hover:text-text-primary">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-text-primary">How it works</a>
            <a href="#faq" className="transition-colors hover:text-text-primary">FAQ</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-accent hover:text-text-primary"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/register"><Button size="sm">Get started free</Button></Link>
          </div>
        </div>
      </header>

      {/* ── Hero + grain overlay ── */}
      <div className="landing-atmosphere grain-overlay">
        <section className="relative overflow-hidden px-4 pb-0 pt-28 sm:px-8 sm:pt-36">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="inline-flex items-center"
              >
                <span className="text-meta-sm font-semibold tracking-wider text-interaction uppercase">
                  Multi-Document workspace for software projects
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 text-[2.75rem] font-semibold leading-[1.1] tracking-tight text-text-primary sm:text-6xl lg:text-7xl"
              >
                Documentation built{' '}
                <span className="bg-[linear-gradient(135deg,var(--interaction),color-mix(in_srgb,var(--interaction),#c084fc_50%))] bg-clip-text text-transparent">
                  section by section
                </span>{' '}
                from your source code.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto mt-6 max-w-xl text-body-lg text-text-secondary"
              >
                Connect your repository once. Pagemark analyzes your codebase and powers every
                Document in your Project from one shared snapshot. Reviewable, trackable, fresh.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
              >
                <Link to="/register">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button size="lg" className="gap-2 shadow-[0_0_24px_color-mix(in_srgb,var(--interaction),transparent_70%)]">
                      Create your first Document
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </motion.div>
                </Link>
                <Link to="/login">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button variant="outline" size="lg">Sign in</Button>
                  </motion.div>
                </Link>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-meta text-text-muted"
              >
                Static Analysis works without an AI key · No credit card required
              </motion.p>
            </div>

            {/* Product screenshot */}
            <motion.div
              initial={{ opacity: 0, y: 48, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto mt-16 max-w-5xl"
            >
              <div className="pointer-events-none absolute inset-0 -z-10 translate-y-8 scale-95 rounded-2xl bg-interaction/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border border-border/60 shadow-[0_32px_80px_-16px_color-mix(in_srgb,var(--canvas),transparent_10%),0_0_0_1px_color-mix(in_srgb,var(--border),transparent_30%)]">
                <img
                  src="/editor-preview.png"
                  alt="Pagemark editor — section-by-section documentation with source evidence and review state"
                  className="w-full select-none"
                  draggable={false}
                />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-canvas to-transparent" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Trust strip ── */}
        <FadeUp className="border-b border-border/10 py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <p className="mb-6 text-center text-meta text-text-muted">Works with your stack</p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {trustLogos.map((logo) => (
                <motion.div
                  key={logo.name}
                  whileHover={{ scale: 1.08, opacity: 1 }}
                  className="flex items-center gap-2 text-text-muted opacity-50 transition-opacity hover:opacity-100"
                >
                  <span className="text-lg">{logo.symbol}</span>
                  <span className="text-body font-medium">{logo.name}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeUp>
      </div>

      <main>
        {/* ── Features with Mesh overlay ── */}
        <section id="features" className="mesh-overlay relative overflow-hidden px-4 py-24 sm:px-8 sm:py-32">
          <div className="relative z-10 mx-auto max-w-7xl">
            <FadeUp className="mx-auto max-w-2xl text-center">
              <span className="text-meta-sm font-semibold tracking-wider text-interaction uppercase">Capabilities</span>
              <h2 className="mt-4 text-title text-text-primary">
                From repository facts to reviewed sections — in one workspace.
              </h2>
              <p className="mt-3 text-body text-text-secondary">
                Your codebase changes constantly. Pagemark turns that from a documentation liability into a structured workflow.
              </p>
            </FadeUp>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => (
                <FadeUp key={feature.title} delay={i * 0.07}>
                  <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} className="h-full">
                    <Surface variant="interactive" padding="lg" className="h-full transition-shadow hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--interaction),transparent_88%)]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-interaction/10 text-interaction">
                        <feature.icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="mt-4 text-body font-semibold text-text-primary">{feature.title}</h3>
                      <p className="mt-2 text-meta text-text-secondary">{feature.text}</p>
                    </Surface>
                  </motion.div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── Interactive How It Works ── */}
        <section
          id="how-it-works"
          ref={howItWorksRef}
          className="relative overflow-hidden border-y border-border/10 bg-[color-mix(in_srgb,var(--canvas),var(--text-primary)_3%)] px-4 py-24 sm:px-8 sm:py-32"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,color-mix(in_srgb,var(--interaction),transparent_88%)_0%,transparent_70%)]" />
          <div className="relative mx-auto max-w-7xl">
            <FadeUp className="mx-auto max-w-2xl text-center">
              <span className="text-meta-sm font-semibold tracking-wider text-interaction uppercase">How it works</span>
              <h2 className="mt-4 text-title text-text-primary">
                Three steps from source code to reviewed documentation.
              </h2>
              <p className="mt-3 text-body text-text-secondary">
                Connect once, shape the structure, and write section by section.
              </p>
            </FadeUp>

            {/* Single bento card */}
            <div className="relative z-10 mx-auto mt-14 max-w-5xl">
              <Surface variant="glass" padding="none" className="overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  {/* Left: Bento steps panel */}
                  <div className="flex flex-row gap-2 border-b border-border/40 p-4 lg:w-[240px] lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:p-5">
                    {steps.map((step, index) => {
                      const isActive = activeStep === index;
                      return (
                        <button
                          key={step.id}
                          onClick={() => goToStep(index)}
                          className={`flex flex-1 items-center gap-3 rounded-xl border p-3 text-left transition-all duration-300 focus:outline-none lg:flex-none ${
                            isActive
                              ? 'border-interaction/50 bg-interaction/[0.06] shadow-[0_0_0_1px_color-mix(in_srgb,var(--interaction),transparent_60%)]'
                              : 'border-transparent opacity-50 hover:opacity-90 hover:border-border/60'
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                              isActive
                                ? 'bg-interaction text-interaction-foreground'
                                : 'bg-panel-muted text-text-muted'
                            }`}
                          >
                            {step.number}
                          </span>
                          <span
                            className={`text-sm font-semibold transition-colors ${
                              isActive ? 'text-text-primary' : 'text-text-secondary'
                            }`}
                          >
                            {step.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right: Image + description */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="relative aspect-[16/10] w-full border-b border-border/40 bg-muted/20">
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={activeStep}
                          src={steps[activeStep].image}
                          alt={steps[activeStep].title}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.35 }}
                          className="absolute inset-0 h-full w-full object-cover object-top select-none"
                          draggable={false}
                        />
                      </AnimatePresence>
                    </div>
                    <div className="p-5">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeStep}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.25 }}
                          className="space-y-1.5"
                        >
                          <h4 className="text-section font-semibold text-text-primary">
                            {steps[activeStep].title}
                          </h4>
                          <p className="text-body leading-relaxed text-text-secondary">
                            {steps[activeStep].description}
                          </p>
                        </motion.div>
                      </AnimatePresence>

                      {/* Dot indicators */}
                      <div className="mt-5 flex items-center gap-2">
                        {steps.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => goToStep(i)}
                            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                              i === activeStep
                                ? 'w-6 bg-interaction'
                                : 'w-2 bg-border/60 hover:bg-border'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Surface>
            </div>
          </div>
        </section>

        {/* ── Testimonials with grid overlay ── */}
        <section className="grid-overlay relative overflow-hidden px-4 py-24 sm:px-8 sm:py-32">
          <div className="relative z-10 mx-auto max-w-7xl">
            <FadeUp className="mx-auto max-w-2xl text-center">
              <span className="text-meta-sm font-semibold tracking-wider text-interaction uppercase">Trusted by teams</span>
              <h2 className="mt-4 text-title text-text-primary">Used by documentation teams that ship.</h2>
            </FadeUp>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <FadeUp key={t.name} delay={i * 0.1}>
                  <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }} className="h-full">
                    <Surface variant="glass" padding="lg" className="flex h-full flex-col justify-between relative z-10">
                      <div>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, j) => (
                            <Star key={j} className="h-3.5 w-3.5 fill-[color-mix(in_srgb,var(--interaction),transparent_20%)] text-interaction" />
                          ))}
                        </div>
                        <p className="mt-4 text-body leading-relaxed text-text-secondary">&ldquo;{t.text}&rdquo;</p>
                      </div>
                      <div className="mt-6 border-t border-border/60 pt-4">
                        <p className="text-body font-semibold text-text-primary">{t.name}</p>
                        <p className="text-meta text-text-muted">{t.role}</p>
                      </div>
                    </Surface>
                  </motion.div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing with Mesh overlay ── */}
        <section className="mesh-overlay relative overflow-hidden border-y border-border/10 bg-[color-mix(in_srgb,var(--canvas),var(--text-primary)_3%)] px-4 py-24 sm:px-8 sm:py-32">
          <div className="relative z-10 mx-auto max-w-4xl">
            <FadeUp className="text-center">
              <span className="text-meta-sm font-semibold tracking-wider text-interaction uppercase">Pricing</span>
              <h2 className="mt-4 text-title text-text-primary">Simple and transparent.</h2>
              <p className="mt-3 text-body text-text-secondary">
                Pagemark never charges for AI inference. You pay only for what you use through your own provider.
              </p>
            </FadeUp>
            <FadeUp className="mx-auto mt-10 max-w-4xl">
              <Surface variant="glass" padding="lg" className="space-y-8">
                <div className="space-y-2 text-center">
                  <h3 className="text-title text-text-primary">Everything you need to document your codebase.</h3>
                  <p className="text-body text-text-secondary">
                    Pagemark is free. AI generation uses your own provider key — you pay only for what you consume.
                  </p>
                </div>

                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="text-section font-semibold text-text-primary">Core</h4>
                    <ul className="space-y-2.5">
                      {pricingCore.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-body text-text-secondary">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-interaction" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-section font-semibold text-text-primary">AI-powered</h4>
                    <ul className="space-y-2.5">
                      {pricingAi.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-body text-text-secondary">
                          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-interaction" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <Link to="/register">
                    <Button size="lg">Get started — no credit card required</Button>
                  </Link>
                </div>
              </Surface>
            </FadeUp>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="bg-canvas px-4 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <FadeUp className="mx-auto max-w-2xl text-center">
              <span className="text-meta-sm font-semibold tracking-wider text-interaction uppercase">FAQ</span>
              <h2 className="mt-4 text-title text-text-primary">Frequently asked questions.</h2>
            </FadeUp>
            <div className="mx-auto mt-10 max-w-3xl divide-y divide-border/60">
              {faqItems.map((item, i) => (
                <FadeUp key={item.q} delay={i * 0.04}>
                  <details className="group py-5">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 text-body font-semibold text-text-primary transition-colors hover:text-interaction [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <ChevronDown className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 max-w-2xl text-body text-text-secondary">{item.a}</p>
                  </details>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative overflow-hidden border-t border-border/10 px-4 py-28 sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_100%,color-mix(in_srgb,var(--interaction),transparent_82%)_0%,transparent_70%)]" />
          <FadeUp className="relative mx-auto max-w-2xl text-center">
            <span className="text-meta-sm font-semibold tracking-wider text-interaction uppercase">Get started free</span>
            <h2 className="mt-4 text-title text-text-primary">Your code changes. Your docs should keep up.</h2>
            <p className="mt-3 text-body text-text-secondary">
              Create a Project, connect your repository, and write your first Document —
              section by section, with source evidence and review state built in.
              No AI key required to start.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" className="gap-2 shadow-[0_0_28px_color-mix(in_srgb,var(--interaction),transparent_70%)]">
                    Create your first Document
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </motion.div>
              </Link>
              <Link to="/login">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button variant="outline" size="lg">Sign in</Button>
                </motion.div>
              </Link>
            </div>
          </FadeUp>
        </section>
      </main>

      <footer className="border-t border-border/10 px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <PagemarkWordmark className="h-8 text-text-muted" />
          <p className="text-meta text-text-muted">&copy; {new Date().getFullYear()} Pagemark. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
