import React, { useState } from 'react';
import { GitBranch, Upload, FileText, Search, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { GitRepo, GitBranch as Branch } from '@/types';
import { analysisApi } from '@/api/analysis';
import { useQuery } from '@tanstack/react-query';

interface SourceStepProps {
  onConnect: (data: {
    type: 'github-oauth' | 'git-url' | 'zip' | 'none';
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
  }) => void;
  onSkip: () => void;
}

type ConnectionMethod = 'github' | 'url' | 'zip' | null;

export function SourceStep({ onConnect, onSkip }: SourceStepProps) {
  const [method, setMethod] = useState<ConnectionMethod>('github');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [zipFile, setZipFile] = useState<File | null>(null);

  const { data: repos = [], isLoading: loadingRepos } = useQuery({
    queryKey: ['git-repos'],
    queryFn: () => analysisApi.getGitRepos('github'),
    enabled: method === 'github',
  });

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['git-branches', selectedRepo?.full_name],
    queryFn: () => {
      if (!selectedRepo) return Promise.resolve([]);
      const [owner, repo] = selectedRepo.full_name.split('/');
      return analysisApi.getRepoBranches(owner, repo, 'github');
    },
    enabled: !!selectedRepo,
  });

  const filteredRepos = repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGitHubConnect = () => {
    if (!selectedRepo || !selectedBranch) return;

    const [owner, repo] = selectedRepo.full_name.split('/');
    onConnect({
      type: 'github-oauth',
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
  };

  const handleUrlConnect = () => {
    if (!gitUrl) return;
    onConnect({
      type: 'git-url',
      gitUrl,
      gitBranch,
    });
  };

  const handleZipConnect = () => {
    if (!zipFile) return;
    onConnect({
      type: 'zip',
      zipFile,
    });
  };

  React.useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      const defaultBranch = branches.find((b) => b.is_default);
      setSelectedBranch(defaultBranch?.name || branches[0].name);
    }
  }, [branches, selectedBranch]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="space-y-2">
        <h2 className="text-title font-semibold text-text-primary">Connect Source Code</h2>
        <p className="text-body text-text-secondary">
          Connect your repository to enable analysis-grounded documentation. GitHub is recommended
          for automatic synchronization and freshness detection.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={method === 'github' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('github')}
          className="gap-2"
        >
          <GitBranch className="h-4 w-4" />
          GitHub
        </Button>
        <Button
          variant={method === 'url' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('url')}
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Repository URL
        </Button>
        <Button
          variant={method === 'zip' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('zip')}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          ZIP Upload
        </Button>
      </div>

      {method === 'github' && (
        <div className="space-y-4 bg-panel rounded-lg border border-separator p-6">
          <div className="space-y-2">
            <Label htmlFor="repo-search">Search Repositories</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                id="repo-search"
                placeholder="Search your repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loadingRepos ? (
            <div className="text-center py-8 text-text-muted">Loading repositories...</div>
          ) : filteredRepos.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              {searchQuery ? 'No repositories found matching your search.' : 'No repositories available.'}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredRepos.slice(0, 20).map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo)}
                  className={cn(
                    'w-full text-left p-3 rounded-md border transition-colors',
                    selectedRepo?.id === repo.id
                      ? 'border-interaction bg-interaction-muted'
                      : 'border-separator hover:border-input hover:bg-panel-muted'
                  )}
                >
                  <div className="font-medium text-body text-text-primary">{repo.full_name}</div>
                  {repo.description && (
                    <div className="text-meta text-text-secondary mt-1 line-clamp-1">
                      {repo.description}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-meta text-text-muted">
                    {repo.language && <span>{repo.language}</span>}
                    <span>{repo.private ? 'Private' : 'Public'}</span>
                    <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedRepo && (
            <div className="space-y-2 pt-4 border-t border-separator">
              <Label htmlFor="branch-select">Branch</Label>
              <select
                id="branch-select"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={loadingBranches}
                className="w-full h-9 px-3 rounded-md border border-input bg-panel text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {loadingBranches ? (
                  <option>Loading branches...</option>
                ) : (
                  branches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name}
                      {branch.is_default && ' (default)'}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleGitHubConnect}
              disabled={!selectedRepo || !selectedBranch}
              className="gap-2"
            >
              Connect Repository
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              Start Without Source
            </Button>
          </div>
        </div>
      )}

      {method === 'url' && (
        <div className="space-y-4 bg-panel rounded-lg border border-separator p-6">
          <div className="space-y-2">
            <Label htmlFor="git-url">Repository URL</Label>
            <Input
              id="git-url"
              type="url"
              placeholder="https://github.com/owner/repo.git"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
            />
            <p className="text-meta text-text-muted">
              Public repositories only. For private repos, use GitHub OAuth above.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="git-branch">Branch</Label>
            <Input
              id="git-branch"
              placeholder="main"
              value={gitBranch}
              onChange={(e) => setGitBranch(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleUrlConnect} disabled={!gitUrl} className="gap-2">
              Connect Repository
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              Start Without Source
            </Button>
          </div>
        </div>
      )}

      {method === 'zip' && (
        <div className="space-y-4 bg-panel rounded-lg border border-separator p-6">
          <div className="space-y-2">
            <Label htmlFor="zip-file">ZIP File</Label>
            <Input
              id="zip-file"
              type="file"
              accept=".zip"
              onChange={(e) => setZipFile(e.target.files?.[0] || null)}
            />
            <p className="text-meta text-text-muted">
              Upload a ZIP archive of your source code. This creates a snapshot but does not support
              automatic synchronization.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleZipConnect} disabled={!zipFile} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload and Analyze
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              Start Without Source
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
