import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileArchive,
  GitBranch,
  Loader2,
  Search,
  Star,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GitProviderIcon } from '@/components/git/GitProviderIcon';
import { projectsApi } from '@/api/projects';
import { analysisApi } from '@/api/analysis';
import { pollAnalysisUntilDone } from '@/hooks/useAnalysis';
import {
  useGitHubStatus,
  useGitLabStatus,
  useGitRepos,
  useRepoBranches,
  useDisconnectGitHub,
  useDisconnectGitLab,
} from '@/hooks/useGit';
import { validateGitUrl, getOAuthAuthorizeUrl, parseOwnerRepo } from '@/lib/git';
import type { GitRepo, AnalysisStatus } from '@/types';
import { cn } from '@/lib/utils';

type SourceChoice = 'zip' | 'git' | 'scratch';
type GitTab = 'url' | 'account';

const STEPS = ['Details', 'Source', 'Configure', 'Analyse'];

export const NewProject: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template_id');

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceChoice, setSourceChoice] = useState<SourceChoice | null>(null);

  const [gitTab, setGitTab] = useState<GitTab>('url');
  const [repoUrl, setRepoUrl] = useState('');
  const [urlBranch, setUrlBranch] = useState('main');
  const [oauthProvider, setOauthProvider] = useState<'github' | 'gitlab'>('github');
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitRepo | null>(null);
  const [oauthBranch, setOauthBranch] = useState('main');
  const [zipFile, setZipFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisStatus | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null);

  const { data: githubStatus } = useGitHubStatus();
  const { data: gitlabStatus } = useGitLabStatus();
  const disconnectGithub = useDisconnectGitHub();
  const disconnectGitlab = useDisconnectGitLab();

  const oauthConnected =
    oauthProvider === 'github' ? githubStatus?.connected : gitlabStatus?.connected;
  const oauthProfile =
    oauthProvider === 'github' ? githubStatus : gitlabStatus;

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      const provider = (searchParams.get('provider') as 'github' | 'gitlab') || 'github';
      setOauthProvider(provider);
      setGitTab('account');
      toast.success(`${provider === 'gitlab' ? 'GitLab' : 'GitHub'} connected`);
    }
  }, [searchParams]);

  useEffect(() => {
    if (githubStatus?.connected && !gitlabStatus?.connected) {
      setOauthProvider('github');
    } else if (gitlabStatus?.connected && !githubStatus?.connected) {
      setOauthProvider('gitlab');
    }
  }, [githubStatus?.connected, gitlabStatus?.connected]);

  const urlValid = repoUrl.trim() ? validateGitUrl(repoUrl) : null;

  const { data: repos, isLoading: reposLoading } = useGitRepos(
    oauthProvider,
    gitTab === 'account' && !!oauthConnected
  );

  const selectedParts = selectedRepo ? parseOwnerRepo(selectedRepo.full_name) : null;
  const { data: branches, isLoading: branchesLoading } = useRepoBranches(
    selectedParts?.owner,
    selectedParts?.repo,
    oauthProvider,
    !!selectedRepo
  );

  useEffect(() => {
    if (selectedRepo) {
      setOauthBranch(selectedRepo.default_branch);
    }
  }, [selectedRepo?.id]);

  const filteredRepos = useMemo(() => {
    if (!repos) return [];
    const q = repoSearch.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false)
    );
  }, [repos, repoSearch]);

  const canNextStep1 = name.trim().length > 0;
  const canNextStep2 = sourceChoice !== null;

  const handleConnectAndAnalyse = async () => {
    if (!sourceChoice) return;
    setSubmitting(true);

    try {
      const project = await projectsApi.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        source_type: sourceChoice,
        template_id: templateId ? Number(templateId) : undefined,
      });
      setCreatedProjectId(project.id);

      if (sourceChoice === 'scratch') {
        navigate(`/editor/${project.id}`);
        return;
      }

      setStep(4);

      if (sourceChoice === 'zip' && zipFile) {
        await analysisApi.uploadZip(project.id, zipFile);
      } else if (sourceChoice === 'git' && gitTab === 'url') {
        await analysisApi.connectGitUrl(project.id, {
          repo_url: repoUrl.trim(),
          branch: urlBranch.trim() || 'main',
        });
      } else if (sourceChoice === 'git' && gitTab === 'account' && selectedRepo) {
        const { owner, repo } = parseOwnerRepo(selectedRepo.full_name);
        await analysisApi.connectGitOAuth(project.id, {
          owner,
          repo,
          branch: oauthBranch,
        });
      } else {
        throw new Error('Incomplete configuration');
      }

      const final = await pollAnalysisUntilDone(project.id, setAnalysisProgress);
      if (final.status === 'completed') {
        toast.success('Analysis complete');
        navigate(`/analysis/${project.id}`);
      } else {
        toast.error(final.error_message || 'Analysis failed');
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Something went wrong';
      toast.error(typeof detail === 'string' ? detail : 'Failed to start analysis');
      setStep(3);
    } finally {
      setSubmitting(false);
    }
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
            Cancel
          </button>
          <h1 className="text-lg font-bold">New Project</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <StepIndicator current={step} />

        {step === 1 && (
          <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-6 dark:border-slate-800/80 dark:bg-slate-900/60">
            <div>
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My API Docs"
                className="mt-1.5 rounded-xl"
                required
              />
            </div>
            <div>
              <Label htmlFor="project-desc">Description (optional)</Label>
              <Input
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this project document?"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button
                disabled={!canNextStep1}
                onClick={() => setStep(2)}
                className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              How would you like to bring in your codebase?
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  { id: 'zip' as const, label: 'Upload ZIP', icon: FileArchive },
                  { id: 'git' as const, label: 'Connect Git', icon: GitBranch },
                  { id: 'scratch' as const, label: 'Start Empty', icon: CheckCircle2 },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSourceChoice(id)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all',
                    sourceChoice === id
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-sm dark:bg-indigo-950/30'
                      : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-8 w-8',
                      sourceChoice === id ? 'text-indigo-500' : 'text-slate-400'
                    )}
                  />
                  <span className="text-sm font-bold">{label}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">
                Back
              </Button>
              <Button
                disabled={!canNextStep2}
                onClick={() => setStep(3)}
                className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 3 && sourceChoice === 'zip' && (
          <ZipStep
            zipFile={zipFile}
            onFile={setZipFile}
            onBack={() => setStep(2)}
            onSubmit={handleConnectAndAnalyse}
            submitting={submitting}
          />
        )}

        {step === 3 && sourceChoice === 'scratch' && (
          <ScratchStep
            onBack={() => setStep(2)}
            onSubmit={handleConnectAndAnalyse}
            submitting={submitting}
          />
        )}

        {step === 3 && sourceChoice === 'git' && (
          <div className="space-y-4">
            <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/60">
              {(['url', 'account'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setGitTab(tab)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
                    gitTab === tab
                      ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {tab === 'url' ? 'Paste URL' : 'Connect Account'}
                </button>
              ))}
            </div>

            {gitTab === 'url' && (
              <GitUrlTab
                repoUrl={repoUrl}
                setRepoUrl={setRepoUrl}
                branch={urlBranch}
                setBranch={setUrlBranch}
                urlValid={urlValid}
                onBack={() => setStep(2)}
                onSubmit={handleConnectAndAnalyse}
                submitting={submitting}
              />
            )}

            {gitTab === 'account' && (
              <GitAccountTab
                oauthProvider={oauthProvider}
                setOauthProvider={setOauthProvider}
                githubConnected={!!githubStatus?.connected}
                gitlabConnected={!!gitlabStatus?.connected}
                profile={oauthProfile}
                oauthConnected={!!oauthConnected}
                reposLoading={reposLoading}
                filteredRepos={filteredRepos}
                repoSearch={repoSearch}
                setRepoSearch={setRepoSearch}
                selectedRepo={selectedRepo}
                setSelectedRepo={setSelectedRepo}
                branches={branches}
                branchesLoading={branchesLoading}
                oauthBranch={oauthBranch}
                setOauthBranch={setOauthBranch}
                onDisconnect={() => {
                  if (oauthProvider === 'github') disconnectGithub.mutate();
                  else disconnectGitlab.mutate();
                  setSelectedRepo(null);
                }}
                onBack={() => setStep(2)}
                onSubmit={handleConnectAndAnalyse}
                submitting={submitting}
              />
            )}
          </div>
        )}

        {step === 4 && (
          <ProcessingStep
            progress={analysisProgress}
            projectId={createdProjectId}
          />
        )}
      </main>
    </div>
  );
};

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <li
            key={label}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 text-xs font-semibold',
              active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2',
                done && 'border-indigo-500 bg-indigo-500 text-white',
                active && !done && 'border-indigo-500 text-indigo-600',
                !active && !done && 'border-slate-200 dark:border-slate-700'
              )}
            >
              {done ? <Check className="h-4 w-4" /> : n}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function GitUrlTab({
  repoUrl,
  setRepoUrl,
  branch,
  setBranch,
  urlValid,
  onBack,
  onSubmit,
  submitting,
}: {
  repoUrl: string;
  setRepoUrl: (v: string) => void;
  branch: string;
  setBranch: (v: string) => void;
  urlValid: boolean | null;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-6 dark:border-slate-800/80 dark:bg-slate-900/60">
      <div>
        <Label htmlFor="git-url">GitHub / GitLab / Bitbucket URL</Label>
        <div className="relative mt-1.5">
          <Input
            id="git-url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/username/repo-name"
            className="rounded-xl pr-10"
          />
          {urlValid === true && (
            <Check className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500" />
          )}
          {urlValid === false && (
            <X className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-rose-500" />
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="git-branch-url">Branch</Label>
        <Input
          id="git-branch-url"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="mt-1.5 rounded-xl"
        />
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="rounded-xl">
          Back
        </Button>
        <Button
          disabled={!urlValid || submitting}
          onClick={onSubmit}
          className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {submitting ? 'Starting…' : 'Connect & Analyse'}
        </Button>
      </div>
    </div>
  );
}

function GitAccountTab({
  oauthProvider,
  setOauthProvider,
  githubConnected,
  gitlabConnected,
  profile,
  oauthConnected,
  reposLoading,
  filteredRepos,
  repoSearch,
  setRepoSearch,
  selectedRepo,
  setSelectedRepo,
  branches,
  branchesLoading,
  oauthBranch,
  setOauthBranch,
  onDisconnect,
  onBack,
  onSubmit,
  submitting,
}: {
  oauthProvider: 'github' | 'gitlab';
  setOauthProvider: (p: 'github' | 'gitlab') => void;
  githubConnected: boolean;
  gitlabConnected: boolean;
  profile?: { username?: string; avatar?: string };
  oauthConnected: boolean;
  reposLoading: boolean;
  filteredRepos: GitRepo[];
  repoSearch: string;
  setRepoSearch: (v: string) => void;
  selectedRepo: GitRepo | null;
  setSelectedRepo: (r: GitRepo | null) => void;
  branches?: { name: string; is_default: boolean }[];
  branchesLoading: boolean;
  oauthBranch: string;
  setOauthBranch: (v: string) => void;
  onDisconnect: () => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  if (!oauthConnected) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-6 dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-sm text-slate-500">
          Connect your account to access private repositories.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            onClick={() => {
              window.location.href = getOAuthAuthorizeUrl('github');
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950"
          >
            <GitProviderIcon provider="github" />
            Connect GitHub
          </Button>
          <Button
            type="button"
            onClick={() => {
              window.location.href = getOAuthAuthorizeUrl('gitlab');
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
          >
            <GitProviderIcon provider="gitlab" />
            Connect GitLab
          </Button>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack} className="rounded-xl">
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-6 dark:border-slate-800/80 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={
              profile?.avatar ||
              `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile?.username}`
            }
            alt=""
            className="h-10 w-10 rounded-lg object-cover"
          />
          <div>
            <p className="text-sm font-bold">{profile?.username}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {oauthProvider === 'github' ? 'GitHub' : 'GitLab'} connected
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {githubConnected && (
            <button
              type="button"
              onClick={() => setOauthProvider('github')}
              className={cn(
                'rounded-lg px-2 py-1 text-xs font-semibold',
                oauthProvider === 'github'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40'
                  : 'text-slate-500'
              )}
            >
              GitHub
            </button>
          )}
          {gitlabConnected && (
            <button
              type="button"
              onClick={() => setOauthProvider('gitlab')}
              className={cn(
                'rounded-lg px-2 py-1 text-xs font-semibold',
                oauthProvider === 'gitlab'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40'
                  : 'text-slate-500'
              )}
            >
              GitLab
            </button>
          )}
          <Button variant="outline" size="sm" onClick={onDisconnect} className="rounded-lg">
            Disconnect
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={repoSearch}
          onChange={(e) => setRepoSearch(e.target.value)}
          placeholder="Search repositories…"
          className="rounded-xl pl-9"
        />
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {reposLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : filteredRepos.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No repositories found.</p>
        ) : (
          filteredRepos.map((repo) => (
            <button
              key={repo.id}
              type="button"
              onClick={() => setSelectedRepo(repo)}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition-all',
                selectedRepo?.id === repo.id
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{repo.full_name}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                    repo.private
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                  )}
                >
                  {repo.private ? 'Private' : 'Public'}
                </span>
              </div>
              {repo.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{repo.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {repo.language && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                    {repo.language}
                  </span>
                )}
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3" />
                  {repo.stars_count}
                </span>
                <span>
                  Updated {formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedRepo && (
        <div>
          <Label htmlFor="oauth-branch">Branch</Label>
          {branchesLoading ? (
            <Loader2 className="mt-2 h-5 w-5 animate-spin text-indigo-500" />
          ) : (
            <select
              id="oauth-branch"
              value={oauthBranch}
              onChange={(e) => setOauthBranch(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              {(branches ?? [{ name: selectedRepo.default_branch, is_default: true }]).map(
                (b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                    {b.is_default ? ' (default)' : ''}
                  </option>
                )
              )}
            </select>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="rounded-xl">
          Back
        </Button>
        <Button
          disabled={!selectedRepo || submitting}
          onClick={onSubmit}
          className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
        >
          {submitting ? 'Starting…' : 'Connect & Analyse'}
        </Button>
      </div>
    </div>
  );
}

function ZipStep({
  zipFile,
  onFile,
  onBack,
  onSubmit,
  submitting,
}: {
  zipFile: File | null;
  onFile: (f: File | null) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-6 dark:border-slate-800/80 dark:bg-slate-900/60">
      <Label htmlFor="zip-upload">ZIP archive</Label>
      <Input
        id="zip-upload"
        type="file"
        accept=".zip"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="rounded-xl"
      />
      {zipFile && (
        <p className="text-sm text-slate-500">
          Selected: {zipFile.name} ({(zipFile.size / 1024 / 1024).toFixed(2)} MB)
        </p>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="rounded-xl">
          Back
        </Button>
        <Button
          disabled={!zipFile || submitting}
          onClick={onSubmit}
          className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Upload & Analyse
        </Button>
      </div>
    </div>
  );
}

function ScratchStep({
  onBack,
  onSubmit,
  submitting,
}: {
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-6 dark:border-slate-800/80 dark:bg-slate-900/60">
      <p className="text-sm text-slate-500">
        Start with an empty documentation outline — no codebase analysis.
      </p>
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="rounded-xl">
          Back
        </Button>
        <Button
          disabled={submitting}
          onClick={onSubmit}
          className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Create Project
        </Button>
      </div>
    </div>
  );
}

function ProcessingStep({
  progress,
  projectId,
}: {
  progress: AnalysisStatus | null;
  projectId: number | null;
}) {
  const pct =
    progress && progress.total_steps > 0
      ? Math.round((progress.step_number / progress.total_steps) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-8 text-center dark:border-slate-800/80 dark:bg-slate-900/60">
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-500" />
      <h2 className="mt-4 text-lg font-bold">Analysing your codebase</h2>
      <p className="mt-1 text-sm text-slate-500">
        {progress?.current_step || 'Preparing analysis pipeline…'}
      </p>
      <div className="mx-auto mt-6 max-w-md">
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
          <span>
            {progress
              ? `Step ${progress.step_number} of ${progress.total_steps}`
              : 'Starting…'}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {projectId && (
        <p className="mt-4 text-xs text-slate-400">Project #{projectId}</p>
      )}
    </div>
  );
}
