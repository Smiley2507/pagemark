import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mail, User, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/api/admin';

export function AdminRequestSignupPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.requestSignup({ email, name: name || undefined, justification: justification || undefined });
      setSubmitted(true);
      toast.success('Request submitted for review');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
            <Shield size={24} className="text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Request Submitted</h1>
          <p className="mt-2 text-sm text-text-muted">
            An existing admin will review your request. You'll receive an email when it's approved.
          </p>
          <Link
            to="/admin/login"
            className="mt-6 inline-block text-sm text-accent underline underline-offset-2"
          >
            Back to admin login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
            <Shield size={24} className="text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Request Admin Access</h1>
          <p className="mt-1 text-sm text-text-muted">
            Submit a request for superuser access. An existing admin must approve it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Email *</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-panel py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Name</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-panel py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
                placeholder="Your name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Why do you need admin access?</label>
            <div className="relative">
              <MessageSquare size={16} className="absolute left-3 top-3 text-text-muted" />
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-panel py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
                placeholder="Brief explanation of why you need superuser access..."
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            className="text-xs text-text-muted underline underline-offset-2 hover:text-text-primary"
          >
            Already have access? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
