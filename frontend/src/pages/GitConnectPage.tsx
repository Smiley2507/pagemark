import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GitProviderIcon } from '@/components/git/GitProviderIcon';
import {
  useGitHubStatus,
  useGitLabStatus,
  useDisconnectGitHub,
  useDisconnectGitLab,
} from '@/hooks/useGit';
import { getOAuthAuthorizeUrl } from '@/lib/git';

export const GitConnectPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: githubStatus, isLoading: githubLoading } = useGitHubStatus();
  const { data: gitlabStatus, isLoading: gitlabLoading } = useGitLabStatus();
  const disconnectGithub = useDisconnectGitHub();
  const disconnectGitlab = useDisconnectGitLab();

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      const provider = searchParams.get('provider') || 'github';
      const label = provider === 'gitlab' ? 'GitLab' : 'GitHub';
      toast.success(`${label} connected successfully`);
      searchParams.delete('connected');
      searchParams.delete('provider');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-4 px-6">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-meta text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-section font-semibold">Connected accounts</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <ProviderSection
          title="GitHub"
          provider="github"
          loading={githubLoading}
          connected={githubStatus?.connected}
          username={githubStatus?.username}
          avatar={githubStatus?.avatar}
          onConnect={() => {
            window.location.href = getOAuthAuthorizeUrl('github');
          }}
          onDisconnect={() => disconnectGithub.mutate()}
          disconnecting={disconnectGithub.isPending}
        />

        <ProviderSection
          title="GitLab"
          provider="gitlab"
          loading={gitlabLoading}
          connected={gitlabStatus?.connected}
          username={gitlabStatus?.username}
          avatar={gitlabStatus?.avatar}
          onConnect={() => {
            window.location.href = getOAuthAuthorizeUrl('gitlab');
          }}
          onDisconnect={() => disconnectGitlab.mutate()}
          disconnecting={disconnectGitlab.isPending}
        />

        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitProviderIcon provider="bitbucket" className="text-muted-foreground" />
              <h2 className="text-section font-semibold">Bitbucket</h2>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-meta-sm font-medium text-muted-foreground">
              Coming soon
            </span>
          </div>
        </section>
      </main>
    </div>
  );
};

function ProviderSection({
  title,
  provider,
  loading,
  connected,
  username,
  avatar,
  onConnect,
  onDisconnect,
  disconnecting,
}: {
  title: string;
  provider: 'github' | 'gitlab';
  loading: boolean;
  connected?: boolean;
  username?: string;
  avatar?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <GitProviderIcon provider={provider} />
        <h2 className="text-section font-semibold">{title}</h2>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-meta text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking connection…
        </div>
      ) : connected && username ? (
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`}
              alt=""
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div>
              <p className="font-semibold">{username}</p>
              <p className="text-meta text-emerald-600 dark:text-emerald-400">Connected</p>
            </div>
          </div>
          <Button variant="outline" onClick={onDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
      ) : (
        <Button className="mt-6" onClick={onConnect}>
          <GitProviderIcon provider={provider} className="mr-2" />
          Connect {title}
        </Button>
      )}
    </section>
  );
}
