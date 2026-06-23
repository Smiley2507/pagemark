import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock, KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi, setAdminToken } from '@/api/admin';
import { useAdminStore } from '@/store/adminStore';

export function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [loading, setLoading] = useState(false);
  const setSession = useAdminStore((s) => s.setSession);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.login({ email, password });
      setStep('otp');
      toast.success('OTP sent to your email');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await adminApi.verifyOtp({ email, code: otp });
      setAdminToken(res.access_token);
      setSession(res.access_token, res.expires_in_minutes);
      toast.success('Welcome to the admin panel');
      navigate('/admin');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
            <Shield size={24} className="text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Admin Panel</h1>
          <p className="mt-1 text-sm text-text-muted">
            {step === 'credentials'
              ? 'Sign in with your admin credentials'
              : 'Enter the verification code sent to your email'}
          </p>
        </div>

        {step === 'otp' && (
          <button
            onClick={() => setStep('credentials')}
            className="mb-4 flex items-center gap-1 text-sm text-text-muted hover:text-text-primary"
          >
            <ArrowLeft size={14} />
            Back
          </button>
        )}

        {step === 'credentials' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-panel py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
                  placeholder="admin@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-panel py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Verification Code</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  className="w-full rounded-lg border border-border bg-panel py-2.5 pl-10 pr-3 text-center text-lg tracking-[8px] text-text-primary outline-none transition-colors focus:border-accent"
                  placeholder="000000"
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Sent to {email}
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-xs text-text-muted underline underline-offset-2 hover:text-text-primary"
          >
            Back to main site
          </Link>
        </div>
      </div>
    </div>
  );
}
