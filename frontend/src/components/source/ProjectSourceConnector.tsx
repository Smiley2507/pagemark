import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Link2, PackageOpen, Play, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { analysisApi } from '@/api/analysis';
import { useGitHubStatus } from '@/hooks/useGit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Surface } from '@/components/ui/surface';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
    description: 'Connect a repository with OAuth, including private repositories.',
    icon: GitBranch,
  },
  {
    id: 'url',
    label: 'Git URL',
    description: 'Analyze a public repository URL without OAuth.',
    icon: Link2,
  },
  {
    id: 'zip',
    label: 'ZIP',
    description: 'Upload a static source archive for one-time analysis.',
    icon: Upload,
  },
  {
    id: 'scratch',
    label: 'Scratch',
    description: 'Keep this project without source-backed analysis.',
    icon: PackageOpen,
  },
];

function repoName(repo: GitRepo) {
  return repo.full_name.split('/').pop() || repo.name;
}

export function ProjectSourceConnector({ project }: ProjectSourceConnectorProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<SourceMode>(project.source_provider === 'github' ? 'github' : 'github');
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

  return (
    <Surface variant="panel" padding="lg" className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <h2 className="text-section font-semibold text-text-primary">Connect source</h2>
          <p className="text-body text-text-secondary">
            Configure or replace this Project source, then run Analysis from the selected codebase.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => syncSource.mutate()}
          disabled={!hasGitSource || syncSource.isPending}
        >
          <Play className="h-4 w-4" />
          {syncSource.isPending ? 'Starting...' : 'Analyze current Git source'}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sourceModes.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors',
                mode === item.id
                  ? 'border-interaction bg-interaction-muted'
                  : 'border-border bg-panel hover:bg-panel-muted',
              )}
            >
              <Icon className="mb-3 h-4 w-4 text-text-secondary" aria-hidden="true" />
              <div className="text-body font-semibold text-text-primary">{item.label}</div>
              <p className="mt-1 text-meta text-text-secondary">{item.description}</p>
            </button>
          );
        })}
      </div>

      {mode === 'github' && (
        <div className="space-y-4">
          {githubStatus.isLoading ? (
            <Surface variant="muted" padding="default">
              <p className="text-body text-text-secondary">Checking GitHub connection...</p>
            </Surface>
          ) : !githubConfigured ? (
            <Surface variant="muted" padding="default">
              <p className="text-body font-medium text-text-primary">GitHub OAuth is not configured</p>
              <p className="mt-1 text-meta text-text-secondary">
                Set {missingGithubConfig.length ? missingGithubConfig.join(', ') : 'the GitHub OAuth environment variables'} on the backend before connecting GitHub accounts.
              </p>
            </Surface>
          ) : !githubConnected ? (
            <Surface variant="muted" padding="default" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-body font-medium text-text-primary">GitHub is not connected</p>
                <p className="text-meta text-text-secondary">Connect GitHub to list and analyze repositories you can access.</p>
              </div>
              <Button type="button" className="gap-2" onClick={handleOAuthConnect}>
                <GitBranch className="h-4 w-4" />
                Connect GitHub
              </Button>
            </Surface>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {githubStatus.data?.avatar && (
                    <img src={githubStatus.data.avatar} alt="" className="h-9 w-9 rounded object-cover" />
                  )}
                  <div>
                    <p className="text-body font-medium text-text-primary">{githubStatus.data?.username || 'GitHub connected'}</p>
                    <p className="text-meta text-text-secondary">Private repositories are available through OAuth.</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleOAuthConnect}>
                  Reconnect
                </Button>
              </div>

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
                <Surface variant="muted" padding="default">
                  <p className="text-body text-text-secondary">Loading repositories...</p>
                </Surface>
              ) : reposQuery.isError ? (
                <Surface variant="muted" padding="default">
                  <p className="text-body text-text-secondary">Repositories could not be loaded. Reconnect GitHub or use a Git URL.</p>
                </Surface>
              ) : (
                <div className="grid max-h-72 gap-3 overflow-y-auto pr-1">
                  {filteredRepos.slice(0, 12).map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => {
                        setSelectedRepo(repo);
                        setSelectedBranch('');
                      }}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        selectedRepo?.id === repo.id
                          ? 'border-interaction bg-interaction-muted'
                          : 'border-border bg-panel hover:bg-panel-muted',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-body font-semibold text-text-primary">{repo.full_name}</p>
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
                  ))}
                  {filteredRepos.length === 0 && (
                    <p className="text-body text-text-muted">No repositories match this search.</p>
                  )}
                </div>
              )}

              {selectedRepo && (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
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
                    {connectGithub.isPending ? 'Connecting...' : 'Connect and analyze'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'url' && (
        <div className="space-y-3">
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
              {connectUrl.isPending ? 'Connecting...' : 'Connect and analyze'}
            </Button>
          </div>
          <p className="text-meta text-text-secondary">
            Git URL cloning is anonymous. Use GitHub OAuth for private repositories.
          </p>
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
            {uploadZip.isPending ? 'Uploading...' : 'Upload and analyze'}
          </Button>
        </div>
      )}

      {mode === 'scratch' && (
        <Surface variant="muted" padding="default">
          <p className="text-body text-text-secondary">
            This project can stay source-free. You can return here later to connect GitHub, a Git URL, or a ZIP snapshot.
          </p>
        </Surface>
      )}
    </Surface>
  );
}
