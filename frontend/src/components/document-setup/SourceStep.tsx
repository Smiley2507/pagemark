import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Search } from 'lucide-react';
import { analysisApi } from '@/api/analysis';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import type { GitRepo } from '@/types';

interface SourceConnectPayload {
  type: 'github-oauth' | 'git-url' | 'zip' | 'none';
  projectName: string;
  projectContext?: string;
  repoData?: {
    owner: string;
    repo: string;
    branch: string;
    provider: 'github';
    fullName: string;
    visibility: 'public' | 'private';
    language?: string;
    lastUpdated?: string;
  };
  gitUrl?: string;
  gitBranch?: string;
  zipFile?: File;
}

interface SourceStepProps {
  isSubmitting?: boolean;
  onConnect: (data: SourceConnectPayload) => void;
  onSkip: (data: Pick<SourceConnectPayload, 'projectName' | 'projectContext'>) => void;
}

type SourceMethod = 'github' | 'url' | 'zip' | 'none';

const methods: Array<{
  id: SourceMethod;
  label: string;
  description: string;
}> = [
  {
    id: 'github',
    label: 'GitHub',
    description: 'Primary path for future synchronization and freshness detection.',
  },
  {
    id: 'url',
    label: 'Repository URL',
    description: 'Fallback for public repositories when OAuth is not available.',
  },
  {
    id: 'zip',
    label: 'ZIP upload',
    description: 'Snapshot-based fallback without automatic source synchronization.',
  },
  {
    id: 'none',
    label: 'Start without source',
    description: 'Secondary path when source connection is not ready yet.',
  },
];

export function SourceStep({ isSubmitting = false, onConnect, onSkip }: SourceStepProps) {
  const [method, setMethod] = useState<SourceMethod>('github');
  const [projectName, setProjectName] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [zipFile, setZipFile] = useState<File | null>(null);

  const {
    data: repos = [],
    error: reposError,
    isLoading: reposLoading,
  } = useQuery({
    queryKey: ['git-repos', 'github'],
    queryFn: () => analysisApi.getGitRepos('github'),
    enabled: method === 'github',
    retry: false,
  });

  const {
    data: branches = [],
    isLoading: branchesLoading,
  } = useQuery({
    queryKey: ['git-branches', selectedRepo?.full_name],
    queryFn: () => {
      if (!selectedRepo) return Promise.resolve([]);
      const [owner, repo] = selectedRepo.full_name.split('/');
      return analysisApi.getRepoBranches(owner, repo, 'github');
    },
    enabled: !!selectedRepo,
  });

  React.useEffect(() => {
    if (selectedRepo && !projectName.trim()) {
      const repoName = selectedRepo.full_name.split('/').pop() || selectedRepo.name;
      setProjectName(repoName);
    }
  }, [selectedRepo, projectName]);

  React.useEffect(() => {
    if (zipFile && !projectName.trim()) {
      setProjectName(zipFile.name.replace(/\.zip$/i, ''));
    }
  }, [zipFile, projectName]);

  React.useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      const branch = branches.find((item) => item.is_default) || branches[0];
      setSelectedBranch(branch.name);
    }
  }, [branches, selectedBranch]);

  const filteredRepos = useMemo(
    () => repos.filter((repo) => repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())),
    [repos, searchQuery],
  );

  const disableSubmit = !projectName.trim() || isSubmitting;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div className="max-w-3xl">
        <Badge variant="review">First Document</Badge>
        <h1 className="mt-4 text-title text-text-primary">Connect the Project source</h1>
        <p className="mt-3 text-body text-text-secondary">
          Pagemark creates a source-connected Project workspace first, then uses that shared
          Project context to create multiple purpose-specific Documents over time.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Surface variant="panel" padding="lg" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Payments service"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-context">Business or product context</Label>
              <Input
                id="project-context"
                value={projectContext}
                onChange={(event) => setProjectContext(event.target.value)}
                placeholder="Optional context source code will not reveal"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {methods.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMethod(item.id)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors',
                  method === item.id
                    ? 'border-interaction bg-interaction-muted'
                    : 'border-border bg-panel hover:bg-panel-muted',
                )}
              >
                <div className="text-body font-semibold text-text-primary">{item.label}</div>
                <p className="mt-2 text-meta text-text-secondary">{item.description}</p>
              </button>
            ))}
          </div>

          {method === 'github' && (
            <div className="space-y-4">
              <Notice variant="info" title="GitHub is the primary source path">
                It supports future synchronization, shared Project Analysis, and Document freshness signals.
              </Notice>

              <div className="space-y-2">
                <Label htmlFor="repo-search">Search recent repositories</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    id="repo-search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="owner/repository"
                    className="pl-9"
                  />
                </div>
              </div>

              {reposError ? (
                <Notice variant="warning" title="GitHub repositories are unavailable">
                  Use a repository URL, ZIP upload, or continue without source if GitHub access is not connected yet.
                </Notice>
              ) : reposLoading ? (
                <Surface variant="muted" padding="lg">
                  <p className="text-body text-text-secondary">Loading repositories…</p>
                </Surface>
              ) : (
                <div className="grid gap-3">
                  {filteredRepos.slice(0, 8).map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => setSelectedRepo(repo)}
                      className={cn(
                        'rounded-lg border p-4 text-left transition-colors',
                        selectedRepo?.id === repo.id
                          ? 'border-interaction bg-interaction-muted'
                          : 'border-border bg-panel hover:bg-panel-muted',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-body font-semibold text-text-primary">{repo.full_name}</div>
                          {repo.description && (
                            <p className="mt-1 text-meta text-text-secondary">{repo.description}</p>
                          )}
                        </div>
                        <Badge variant={repo.private ? 'info' : 'neutral'}>
                          {repo.private ? 'Private' : 'Public'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-meta text-text-muted">
                        {repo.language && <span>{repo.language}</span>}
                        <span>{repo.default_branch}</span>
                        <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedRepo && (
                <div className="space-y-2">
                  <Label htmlFor="repo-branch">Branch</Label>
                  <select
                    id="repo-branch"
                    value={selectedBranch}
                    onChange={(event) => setSelectedBranch(event.target.value)}
                    disabled={branchesLoading}
                    className="h-9 w-full rounded-md border border-input bg-panel px-3 text-body text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {branches.map((branch) => (
                      <option key={branch.name} value={branch.name}>
                        {branch.name}
                        {branch.is_default ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={disableSubmit || !selectedRepo || !selectedBranch}
                  onClick={() => {
                    if (!selectedRepo) return;
                    const [owner, repo] = selectedRepo.full_name.split('/');
                    onConnect({
                      type: 'github-oauth',
                      projectName: projectName.trim(),
                      projectContext: projectContext.trim() || undefined,
                      repoData: {
                        owner,
                        repo,
                        branch: selectedBranch,
                        provider: 'github',
                        fullName: selectedRepo.full_name,
                        visibility: selectedRepo.private ? 'private' : 'public',
                        language: selectedRepo.language,
                        lastUpdated: selectedRepo.updated_at,
                      },
                    });
                  }}
                >
                  Connect GitHub repository
                </Button>
              </div>
            </div>
          )}

          {method === 'url' && (
            <div className="space-y-4">
              <Notice variant="warning" title="Repository URL is a fallback path">
                Public repositories only. Private repositories should use the GitHub path above so the Project can sync later.
              </Notice>
              <div className="space-y-2">
                <Label htmlFor="git-url">Repository URL</Label>
                <Input
                  id="git-url"
                  type="url"
                  value={gitUrl}
                  onChange={(event) => setGitUrl(event.target.value)}
                  placeholder="https://github.com/org/repository.git"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="git-branch">Branch</Label>
                <Input
                  id="git-branch"
                  value={gitBranch}
                  onChange={(event) => setGitBranch(event.target.value)}
                  placeholder="main"
                />
              </div>
              <Button
                disabled={disableSubmit || !gitUrl.trim()}
                onClick={() =>
                  onConnect({
                    type: 'git-url',
                    projectName: projectName.trim(),
                    projectContext: projectContext.trim() || undefined,
                    gitUrl: gitUrl.trim(),
                    gitBranch: gitBranch.trim() || 'main',
                  })
                }
              >
                Connect repository URL
              </Button>
            </div>
          )}

          {method === 'zip' && (
            <div className="space-y-4">
              <Notice variant="warning" title="ZIP upload creates a static snapshot">
                Analysis still works, but automatic synchronization and source-change maintenance will remain unavailable.
              </Notice>
              <div className="space-y-2">
                <Label htmlFor="zip-file">ZIP archive</Label>
                <Input
                  id="zip-file"
                  type="file"
                  accept=".zip"
                  onChange={(event) => setZipFile(event.target.files?.[0] || null)}
                />
              </div>
              <Button
                disabled={disableSubmit || !zipFile}
                onClick={() =>
                  zipFile &&
                  onConnect({
                    type: 'zip',
                    projectName: projectName.trim(),
                    projectContext: projectContext.trim() || undefined,
                    zipFile,
                  })
                }
              >
                Upload and analyze
              </Button>
            </div>
          )}

          {method === 'none' && (
            <div className="space-y-4">
              <Notice variant="warning" title="Source-less setup has clear limits">
                Analysis-grounded recommendations, repository evidence, and source-change freshness will stay unavailable until source code is connected.
              </Notice>
              <Button
                variant="outline"
                disabled={disableSubmit}
                onClick={() =>
                  onSkip({
                    projectName: projectName.trim(),
                    projectContext: projectContext.trim() || undefined,
                  })
                }
              >
                Start without source
              </Button>
            </div>
          )}
        </Surface>

        <div className="space-y-4">
          <Surface variant="muted" padding="lg">
            <h2 className="text-body font-semibold text-text-primary">What Pagemark confirms next</h2>
            <ul className="mt-3 space-y-2 text-meta text-text-secondary">
              <li>Repository facts appear progressively during Analysis.</li>
              <li>Template recommendations distinguish rule-based and AI-personalized bases.</li>
              <li>Provider setup appears only before an AI-powered action.</li>
            </ul>
          </Surface>
          <Surface variant="muted" padding="lg">
            <h2 className="flex items-center gap-2 text-body font-semibold text-text-primary">
              <GitBranch className="h-4 w-4 text-interaction" />
              Source options
            </h2>
            <ul className="mt-3 space-y-2 text-meta text-text-secondary">
              <li>GitHub: best for ongoing maintenance.</li>
              <li>Repository URL: public fallback path.</li>
              <li>ZIP upload: one-time snapshot.</li>
              <li>Without source: manual path with reduced capability.</li>
            </ul>
          </Surface>
        </div>
      </div>
    </div>
  );
}
