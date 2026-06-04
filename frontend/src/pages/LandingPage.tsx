import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';

const features = [
  {
    icon: BookOpen,
    title: 'AI-Powered Docs',
    description: 'Generate structured technical documentation from your codebase with AI assistance.',
  },
  {
    icon: Shield,
    title: 'Quality First',
    description: 'Built-in grammar checking and quality scoring ensure your docs meet the bar.',
  },
  {
    icon: Zap,
    title: 'Real-Time Preview',
    description: 'Write markdown with live preview, table editing, and slash commands.',
  },
];

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <PagemarkWordmark className="text-xl" />
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-6 pt-24 pb-16 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Documentation your{' '}
            <span className="text-primary">team will love</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Pagemark turns source code into structured technical documentation
            that developers refine section by section.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="gap-2">
                Get started free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        <section className="px-6 pb-24 max-w-5xl mx-auto">
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>&copy; 2026 Pagemark</span>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-foreground transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
