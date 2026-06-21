import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Link2, PackageOpen, Play, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { analysisApi } from '@/api/analysis';
import { useGitHubStatus } from '@/hooks/useGit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getOAuthAuthorizeUrl, rememberOAuthReturnPath, validateGitUrl } from '@/lib/git';
import type { GitRepo, Project } from '@/types';

type SourceMode = 'github' | 'url' | 'zip' | 'scratch';

interface ProjectSourceConnectorProps {
  project: Project;
}

const sourceModes: Array<{
  id: SourceMode;
  label: string;
  description: string;
  icon: typeof GitBranch;
}> = [
  {
    id: 'github',
    label: 'GitHub',
    description: 'Live repository sync.',
    icon: GitBranch,
  },
  {
    id: 'url',
    label: 'Git URL',
    description: 'Public repository URL.',
    icon: Link2,
  },
  {
    id: 'zip',
    label: 'ZIP',
    description: 'Snapshot upload.',
    icon: Upload,
  },
  {
    id: 'scratch',
    label: 'Scratch',
    description: 'No source attached.',
    icon: PackageOpen,
  },
];

function repoName(repo: GitRepo) {
  return repo.full_name.split('/').pop() || repo.name;
}

function getInitialMode(project: Project): SourceMode {
  if (project.source_type === 'zip') return 'zip';
  if (project.source_type === 'scratch') return 'scratch';
  if (project.source_provider === 'github') return 'github';
  return 'url';
}

export function ProjectSourceConnector({ project }: ProjectSourceConnectorProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<SourceMode>(() => getInitialMode(project));
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState(project.selected_branch || 'main');
  const [zipFile, setZipFile] = useState<File | null>(null);

  const githubStatus = useGitHubStatus();
  const githubConnected = Boolean(githubStatus.data?.connected);
  const githubConfigured = githubStatus.data?.configured !== false;
  const missingGithubConfig = githubStatus.data?.missing_configuration || [];

  useEffect(() => {
    setMode(getInitialMode(project));
  }, [project.id, project.source_provider, project.source_type]);

  const reposQuery = useQuery({
    queryKey: ['git', 'repos', 'github'],
    queryFn: () => analysisApi.getGitRepos('github'),
    enabled: mode === 'github' && githubConnected,
    retry: false,
  });

  const branchesQuery = useQuery({
    queryKey: ['git', 'branches', 'github', selectedRepo?.full_name],
    queryFn: () => {
      if (!selectedRepo) return Promise.resolve([]);
      const [owner, repo] = selectedRepo.full_name.split('/');
      return analysisApi.getRepoBranches(owner, repo, 'github');
    },
    enabled: mode === 'github' && Boolean(selectedRepo),
    retry: false,
  });

  useEffect(() => {
    if (!selectedRepo) return;
    const branch = branchesQuery.data?.find((item) => item.is_default) || branchesQuery.data?.[0];
    if (branch && !selectedBranch) {
      setSelectedBranch(branch.name);
    }
  }, [branchesQuery.data, selectedBranch, selectedRepo]);

  useEffect(() => {
    if (mode !== 'github' || !reposQuery.data?.length || selectedRepo) return;
    const currentRepoName = project.source_owner && project.source_repository
      ? `${project.source_owner}/${project.source_repository}`
      : null;
    if (!currentRepoName) return;
    const currentRepo = reposQuery.data.find((repo) => repo.full_name === currentRepoName);
    if (currentRepo) {
      setSelectedRepo(currentRepo);
      setSelectedBranch(project.selected_branch || currentRepo.default_branch);
    }
  }, [
    mode,
    project.selected_branch,
    project.source_owner,
    project.source_repository,
    reposQuery.data,
    selectedRepo,
  ]);

  const filteredRepos = useMemo(() => {
    const query = repoSearch.trim().toLowerCase();
    const repos = reposQuery.data || [];
    if (!query) return repos;
    return repos.filter((repo) => repo.full_name.toLowerCase().includes(query));
  }, [repoSearch, reposQuery.data]);

  const invalidateSourceState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['project', String(project.id)] }),
      queryClient.invalidateQueries({ queryKey: ['project', project.id] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['analysis-status', String(project.id)] }),
      queryClient.invalidateQueries({ queryKey: ['analysis-status', project.id] }),
    ]);
  };

  const connectGithub = useMutation({
    mutationFn: async () => {
      if (!selectedRepo || !selectedBranch) throw new Error('Select a repository and branch first.');
      const [owner, repo] = selectedRepo.full_name.split('/');
      return analysisApi.connectGitOAuth(project.id, {
        owner,
        repo,
        branch: selectedBranch,
        provider: 'github',
      });
    },
    onSuccess: async () => {
      toast.success('GitHub source connected. Analysis started.');
      await invalidateSourceState();
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to connect GitHub source'),
  });

  const connectUrl = useMutation({
    mutationFn: () => analysisApi.connectGitUrl(project.id, {
      repo_url: gitUrl.trim(),
      branch: gitBranch.trim() || 'main',
    }),
    onSuccess: async () => {
      toast.success('Repository connected. Analysis started.');
      await invalidateSourceState();
    },
    onError: () => toast.error('Failed to connect repository URL'),
  });

  const uploadZip = useMutation({
    mutationFn: () => {
      if (!zipFile) throw new Error('Choose a ZIP archive first.');
      return analysisApi.uploadZip(project.id, zipFile);
    },
    onSuccess: async () => {
      toast.success('ZIP uploaded. Analysis started.');
      setZipFile(null);
      await invalidateSourceState();
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to upload ZIP archive'),
  });

  const syncSource = useMutation({
    mutationFn: () => analysisApi.syncGitRepo(project.id),
    onSuccess: async () => {
      toast.success('Source sync started.');
      await invalidateSourceState();
    },
    onError: () => toast.error('Unable to sync this source. Connect a Git source first.'),
  });

  const handleOAuthConnect = () => {
    rememberOAuthReturnPath(`${window.location.pathname}${window.location.search}`);
    window.location.href = getOAuthAuthorizeUrl('github');
  };

  const hasGitSource = project.source_type === 'git';
  const disableGitUrlSubmit = !gitUrl.trim() || !validateGitUrl(gitUrl) || connectUrl.isPending;
  const currentSourceLabel =
    project.source_metadata?.repo_url as string
    || (project.source_owner && project.source_repository ? `${project.source_owner}/${project.source_repository}` : '')
    || (project.source_type === 'zip' ? 'ZIP snapshot connected' : '')
    || (project.source_type === 'scratch' ? 'Scratch workspace' : 'No source connected');

  return (
    <Surface variant="panel" padding="lg" className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-meta font-medium uppercase tracking-[0.14em] text-text-muted">
            <GitBranch className="h-4 w-4" aria-hidden="true" />
            Source
          </div>
          <div className="space-y-1">
            <h2 className="text-section font-semibold text-text-primary">Select the source</h2>
            <p className="max-w-2xl text-body text-text-secondary">
              Pick the source that feeds analysis. GitHub keeps syncing, Git URL is a public repository, ZIP is a one-time snapshot, and Scratch stays source-free.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => syncSource.mutate()}
          disabled={!hasGitSource || syncSource.isPending}
        >
          <Play className="h-4 w-4" />
          {syncSource.isPending ? 'Starting...' : 'Analyze'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-panel-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-meta font-medium uppercase tracking-[0.12em] text-text-muted">Current source</p>
          <p className="truncate text-body font-semibold text-text-primary">{currentSourceLabel}</p>
        </div>
        <Badge variant={project.source_type === 'scratch' ? 'neutral' : 'success'} showIcon={false}>
          {project.source_type === 'scratch' ? 'Source-free' : 'Connected'}
        </Badge>
      </div>

      <SegmentedControl
        label="Source mode"
        value={mode}
        onValueChange={(value) => setMode(value as SourceMode)}
        options={sourceModes.map((item) => ({
          value: item.id,
          label: (
            <span className="inline-flex items-center gap-1.5">
              <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </span>
          ),
        }))}
      />

      {mode === 'github' && (
        <div className="space-y-4">
          {githubStatus.isLoading ? (
            <Notice variant="info">Checking GitHub connection...</Notice>
          ) : !githubConfigured ? (
            <Notice variant="warning" title="GitHub OAuth is not configured">
              Set {missingGithubConfig.length ? missingGithubConfig.join(', ') : 'the GitHub OAuth environment variables'} on the backend before connecting GitHub accounts.
            </Notice>
          ) : !githubConnected ? (
            <Notice
              variant="info"
              title="GitHub is not connected"
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between"
            >
              <span>Connect GitHub to list and analyze repositories you can access.</span>
              <Button type="button" className="mt-3 gap-2 sm:mt-0" onClick={handleOAuthConnect}>
                <GitBranch className="h-4 w-4" />
                Connect GitHub
              </Button>
            </Notice>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="source-repo-search">Repository</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    id="source-repo-search"
                    value={repoSearch}
                    onChange={(event) => setRepoSearch(event.target.value)}
                    placeholder="owner/repository"
                    className="pl-9"
                  />
                </div>
              </div>

              {reposQuery.isLoading ? (
                <Notice variant="info">Loading repositories...</Notice>
              ) : reposQuery.isError ? (
                <Notice variant="warning">Repositories could not be loaded. Reconnect GitHub or use a Git URL.</Notice>
              ) : (
                <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                  {filteredRepos.slice(0, 10).map((repo) => {
                    const active = selectedRepo?.id === repo.id;
                    return (
                      <button
                        key={repo.id}
                        type="button"
                        onClick={() => {
                          setSelectedRepo(repo);
                          setSelectedBranch('');
                        }}
                        className={cn(
                          'rounded-lg border px-3 py-3 text-left transition-colors',
                          active ? 'border-interaction bg-interaction-muted' : 'border-border bg-panel-muted/30 hover:bg-panel',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-body font-medium text-text-primary">{repo.full_name}</p>
                            {repo.description && <p className="mt-1 line-clamp-2 text-meta text-text-secondary">{repo.description}</p>}
                          </div>
                          <Badge variant={repo.private ? 'info' : 'neutral'} showIcon={false}>
                            {repo.private ? 'Private' : 'Public'}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-meta text-text-muted">
                          {repo.language && <span>{repo.language}</span>}
                          <span>{repo.default_branch}</span>
                          <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredRepos.length === 0 && <p className="text-body text-text-muted">No repositories match this search.</p>}
                </div>
              )}

              {selectedRepo && (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="source-repo-branch">Branch for {repoName(selectedRepo)}</Label>
                    <Select
                      id="source-repo-branch"
                      value={selectedBranch}
                      onChange={(event) => setSelectedBranch(event.target.value)}
                      disabled={branchesQuery.isLoading}
                    >
                      {(branchesQuery.data || []).map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.name}{branch.is_default ? ' (default)' : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={() => connectGithub.mutate()}
                    disabled={!selectedBranch || connectGithub.isPending}
                  >
                    {connectGithub.isPending ? 'Connecting...' : 'Connect'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'url' && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="source-git-url">Repository URL</Label>
            <Input
              id="source-git-url"
              type="url"
              value={gitUrl}
              onChange={(event) => setGitUrl(event.target.value)}
              placeholder="https://github.com/org/repository.git"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-git-branch">Branch</Label>
            <Input
              id="source-git-branch"
              value={gitBranch}
              onChange={(event) => setGitBranch(event.target.value)}
              placeholder="main"
            />
          </div>
          <Button type="button" onClick={() => connectUrl.mutate()} disabled={disableGitUrlSubmit}>
            {connectUrl.isPending ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
      )}

      {mode === 'zip' && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="source-zip">ZIP archive</Label>
            <Input
              id="source-zip"
              type="file"
              accept=".zip"
              onChange={(event) => setZipFile(event.target.files?.[0] || null)}
            />
          </div>
          <Button type="button" onClick={() => uploadZip.mutate()} disabled={!zipFile || uploadZip.isPending}>
            {uploadZip.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      )}

      {mode === 'scratch' && (
        <Notice variant="info">This project can stay source-free. You can connect GitHub, a Git URL, or a ZIP snapshot later.</Notice>
      )}
    </Surface>
  );
}
