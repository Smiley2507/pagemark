import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { orgApi } from '@/api/org';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { Button } from '@/components/ui/button';
import { PagemarkWordmark } from '@/components/layout/PagemarkWordmark';

export const OrgInvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { setOrganizations, setActiveOrgId } = useOrgStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No invite token provided');
      return;
    }
    if (!user) {
      setStatus('error');
      setMessage('Please log in first to accept this invitation.');
      return;
    }

    orgApi.acceptInvite(token)
      .then(async (res) => {
        setStatus('success');
        setMessage(res?.message || 'Joined organization successfully');
        const orgs = await orgApi.listOrganizations();
        setOrganizations(orgs);
        const joinedOrg = orgs.find(o => !o.personal);
        if (joinedOrg) setActiveOrgId(joinedOrg.id);
      })
      .catch((e: any) => {
        setStatus('error');
        setMessage(e?.response?.data?.detail || 'Failed to accept invitation');
      });
  }, [token, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mb-6 flex justify-center">
          <PagemarkWordmark className="text-section" />
        </div>

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Accepting invitation…</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
            <h2 className="text-xl font-semibold">Invitation Accepted</h2>
            <p className="text-muted-foreground">{message}</p>
            <Button className="mt-4" onClick={() => navigate('/home')}>
              Go to Dashboard
            </Button>
          </div>
        )}

        {status === 'error' && !user && (
          <div className="flex flex-col items-center gap-4 py-8">
            <XCircle className="h-16 w-16 text-amber-500" />
            <h2 className="text-xl font-semibold">Login Required</h2>
            <p className="text-muted-foreground">{message}</p>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={() => navigate('/login')}>
                Log In
              </Button>
              <Button onClick={() => navigate('/register')}>
                Create Account
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && user && (
          <div className="flex flex-col items-center gap-4 py-8">
            <XCircle className="h-16 w-16 text-red-500" />
            <h2 className="text-xl font-semibold">Invitation Failed</h2>
            <p className="text-muted-foreground">{message}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/home')}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
