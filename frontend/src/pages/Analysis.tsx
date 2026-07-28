import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { GitProviderIcon } from '@/components/git/GitProviderIcon';
import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { AnalysisResults } from '@/components/analysis/AnalysisResults';
import { OutlineProposal } from '@/components/analysis/OutlineProposal';
import { AiOutlineSkipBanner } from '@/components/analysis/AiOutlineSkipBanner';
import { useProject } from '@/hooks/useProject';
import {
  useAnalysisStatus,
  useAnalysisResults,
  useOutlineDiff,
  useApplyOutline,
  useSyncGitRepo,
  pollAnalysisUntilDone,
} from '@/hooks/useAnalysis';
import { detectProvider, type GitProvider } from '@/lib/git';
import { useHasCapability } from '@/hooks/useHasCapability';
import { DOCUMENT_MANAGE, PROJECT_MANAGE } from '@/lib/authz';

function asGitProvider(provider: string | null | undefined): GitProvider | null {
  return provider === 'github' || provider === 'bitbucket' ? provider : null;
}

export const Analysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const canManageDocuments = useHasCapability(DOCUMENT_MANAGE, project);
  const canManageProject = useHasCapability(PROJECT_MANAGE, project);
  const { data: analysisStatus, refetch, workerUnavailable } = useAnalysisStatus(
    projectId,
    !syncing
  );
  const isCompleted = analysisStatus?.status === 'completed';
  const { data: results, isLoading: resultsLoading } = useAnalysisResults(
    projectId,
    isCompleted
  );
  const { data: outlineDiff } = useOutlineDiff(
    projectId,
    isCompleted && !analysisStatus?.outline_applied
  );
  const applyOutline = useApplyOutline(projectId);
  const syncMutation = useSyncGitRepo();

  const repoUrl = project?.source_metadata?.repo_url as string | undefined;
  const provider: GitProvider | null =
    asGitProvider(project?.source_provider) ||
    (repoUrl ? detectProvider(repoUrl) : null);

  const showGitSync = project?.source_type === 'git' && !!repoUrl;

  const handleSync = async () => {
    if (!projectId) return;
    setSyncing(true);
    try {
      await syncMutation.mutateAsync(projectId);
      const final = await pollAnalysisUntilDone(projectId);
      await refetch();
      if (final.status === 'completed') {
        toast.success('Repository synced successfully');
      } else {
        toast.error(final.error_message || 'Sync failed');
      }
    } finally {
      setSyncing(false);
    }
  };

  const isRunning =
    syncing ||
    analysisStatus?.status === 'pending' ||
    analysisStatus?.status === 'running';

  const showOutlineSkipBanner =
    analysisStatus?.status === 'completed' &&
    analysisStatus?.outline_skipped &&
    analysisStatus?.outline_skip_reason === 'no_ai_credential';

  return (
    <div className="space-y-6">
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="mt-1 text-muted-foreground hover:text-foreground"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              {projectLoading ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                <h1 className="text-section font-semibold">{project?.name}</h1>
              )}
              {repoUrl && provider && (
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1.5 text-meta text-muted-foreground hover:text-primary"
                >
                  <GitProviderIcon provider={provider} className="h-3.5 w-3.5" />
                  {repoUrl.replace(/^https?:\/\//, '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {showGitSync && canManageProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing || isRunning}
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync repo
              </Button>
            )}
            {isCompleted && (
              <Button size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
                Open project
              </Button>
            )}
          </div>
        </div>
      </Surface>

      <div className="space-y-8">
        <AnalysisProgress
          status={analysisStatus}
          syncing={syncing}
          workerUnavailable={workerUnavailable}
        />

        {showOutlineSkipBanner && (
          <AiOutlineSkipBanner
            onOpenSettings={() => navigate('/settings')}
          />
        )}

        {isCompleted && (
          <>
            {resultsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : results ? (
              <AnalysisResults results={results} />
            ) : null}

            <OutlineProposal
              diff={outlineDiff}
              outlineApplied={analysisStatus?.outline_applied}
              onApply={() => applyOutline.mutate()}
              applying={applyOutline.isPending}
              canApply={canManageDocuments}
            />
          </>
        )}
      </div>
    </div>
  );
};
