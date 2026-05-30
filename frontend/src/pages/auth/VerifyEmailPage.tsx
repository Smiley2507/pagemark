import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import apiClient from '@/api/client';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token provided.');
      return;
    }

    const verify = async () => {
      try {
        await apiClient.get(`/auth/verify-email?token=${token}`);
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.response?.data?.detail || 'Verification failed. The token may be expired or invalid.');
      }
    };

    verify();
  }, [token]);

  return (
    <AuthLayout subtitle="Email Verification">
      <div className="flex flex-col items-center justify-center space-y-6 text-center py-4">
        {status === 'loading' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Verifying your email address...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="rounded-full bg-green-500/10 p-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-medium tracking-tight">Email Verified</h3>
              <p className="text-muted-foreground text-sm">
                Your email has been successfully verified. You can now access your account.
              </p>
            </div>
            <Button asChild className="w-full mt-4">
              <Link to="/login">Continue to Login</Link>
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="rounded-full bg-destructive/10 p-4">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-medium tracking-tight">Verification Failed</h3>
              <p className="text-muted-foreground text-sm">{errorMsg}</p>
            </div>
            <Button asChild variant="outline" className="w-full mt-4">
              <Link to="/login">Back to Login</Link>
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
};
