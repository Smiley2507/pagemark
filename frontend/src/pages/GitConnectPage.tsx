import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GitProviderIcon } from '@/components/git/GitProviderIcon';
import { useGitHubStatus, useDisconnectGitHub } from '@/hooks/useGit';
import { consumeOAuthReturnPath, getOAuthAuthorizeUrl } from '@/lib/git';

export const GitConnectPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: githubStatus, isLoading: githubLoading } = useGitHubStatus();
  const disconnectGithub = useDisconnectGitHub();

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      toast.success('GitHub connected successfully');
      const returnPath = consumeOAuthReturnPath();
      if (returnPath) {
        navigate(returnPath, { replace: true });
        return;
      }
      searchParams.delete('connected');
      searchParams.delete('provider');
      setSearchParams(searchParams, { replace: true });
    }
  }, [navigate, searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-4 px-6">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-meta text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-section font-semibold">Connected accounts</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <GitProviderIcon provider="github" />
            <h2 className="text-section font-semibold">GitHub</h2>
          </div>

          {githubLoading ? (
            <div className="mt-6 flex items-center gap-2 text-meta text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking connection…
            </div>
          ) : githubStatus?.configured === false ? (
            <div className="mt-6 rounded-lg border border-border bg-muted p-4">
              <p className="font-semibold">GitHub OAuth is not configured</p>
              <p className="mt-1 text-meta text-muted-foreground">
                Set {(githubStatus.missing_configuration || []).join(', ') || 'the GitHub OAuth environment variables'} on the backend before connecting GitHub accounts.
              </p>
            </div>
          ) : githubStatus?.connected && githubStatus?.username ? (
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={githubStatus.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${githubStatus.username}`}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div>
                  <p className="font-semibold">{githubStatus.username}</p>
                  <p className="text-meta text-emerald-600 dark:text-emerald-400">Connected</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => disconnectGithub.mutate()} disabled={disconnectGithub.isPending}>
                {disconnectGithub.isPending ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <Button className="mt-6" onClick={() => { window.location.href = getOAuthAuthorizeUrl('github'); }}>
              <GitProviderIcon provider="github" className="mr-2" />
              Connect GitHub
            </Button>
          )}
        </section>
      </main>
    </div>
  );
};
