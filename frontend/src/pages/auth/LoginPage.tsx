import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useLogin } from '@/hooks/useAuth';

export const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || undefined;
  const { login, verifyMfa, requiresMfa, mfaEmail, loginMessage, clearMfa, isPending, isVerifying } = useLogin(redirectTo);
  const [email, setEmail] = useState(mfaEmail ?? '');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (mfaEmail) setEmail(mfaEmail);
  }, [mfaEmail]);

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password } as { email: string; password: string });
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyMfa({ email: mfaEmail ?? email, code: otp });
  };

  if (requiresMfa) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={loginMessage || 'Enter the verification code sent to your email'}
      >
        <button
          onClick={() => { clearMfa(); setOtp(''); }}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </button>
        <form onSubmit={handleOtpSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                className="pl-10 text-center text-lg tracking-[8px]"
                placeholder="000000"
                autoComplete="one-time-code"
              />
            </div>
            <p className="text-meta text-muted-foreground">Sent to {mfaEmail ?? email}</p>
          </div>
          <Button type="submit" className="h-10 w-full" disabled={isVerifying || otp.length < 6}>
            {isVerifying ? 'Verifying…' : 'Verify & Sign In'}
          </Button>
        </form>
        <p className="mt-6 text-center text-meta text-text-muted">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-interaction hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off with your Documents, Sections, and review state."
    >
      <form onSubmit={handleCredentialsSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-meta text-interaction hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pl-10"
            />
          </div>
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-meta text-text-muted">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-interaction hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
};
