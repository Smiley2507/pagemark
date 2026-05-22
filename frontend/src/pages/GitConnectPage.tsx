import React, { useEffect } from 'react';
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
import { cn } from '@/lib/utils';

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

  const connectGithub = () => {
    window.location.href = getOAuthAuthorizeUrl('github');
  };

  const connectGitlab = () => {
    window.location.href = getOAuthAuthorizeUrl('gitlab');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-lg font-bold">Connected Accounts</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <ProviderSection
          title="GitHub"
          provider="github"
          loading={githubLoading}
          connected={githubStatus?.connected}
          username={githubStatus?.username}
          avatar={githubStatus?.avatar}
          onConnect={connectGithub}
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
          onConnect={connectGitlab}
          onDisconnect={() => disconnectGitlab.mutate()}
          disconnecting={disconnectGitlab.isPending}
        />

        <section className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 dark:border-slate-800/80 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitProviderIcon provider="bitbucket" className="text-slate-400" />
              <h2 className="text-lg font-bold">Bitbucket</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Coming soon
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Bitbucket integration is not available yet.
          </p>
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
    <section className="rounded-2xl border border-slate-200/80 bg-white/60 p-6 dark:border-slate-800/80 dark:bg-slate-900/60">
      <div className="flex items-center gap-3">
        <GitProviderIcon provider={provider} />
        <h2 className="text-lg font-bold">{title}</h2>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking connection…
        </div>
      ) : connected && username ? (
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`}
              alt=""
              className="h-12 w-12 rounded-xl object-cover ring-2 ring-indigo-500/10"
            />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{username}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Connected account</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={onDisconnect}
            disabled={disconnecting}
            className="rounded-xl border-slate-200 dark:border-slate-700"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
      ) : (
        <Button
          onClick={onConnect}
          className={cn(
            'mt-6 flex items-center gap-2 rounded-xl bg-slate-900 text-white hover:bg-indigo-600',
            'dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-indigo-500 dark:hover:text-white'
          )}
        >
          <GitProviderIcon provider={provider} className="text-current" />
          Connect {title}
        </Button>
      )}
    </section>
  );
}
