import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GitProviderIcon } from '@/components/git/GitProviderIcon';
import { useProject } from '@/hooks/useProject';
import {
  useAnalysisStatus,
  useSyncGitRepo,
  pollAnalysisUntilDone,
} from '@/hooks/useAnalysis';
import { detectProvider } from '@/lib/git';
import { cn } from '@/lib/utils';

export const Analysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: analysisStatus, refetch } = useAnalysisStatus(projectId, !syncing);
  const syncMutation = useSyncGitRepo();

  const provider =
    project?.git_provider ||
    (project?.git_repo_url ? detectProvider(project.git_repo_url) : null);

  const showGitSync = project?.source_type === 'git' && !!project?.git_repo_url;

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
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
              {showGitSync && project?.git_repo_url && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-meta text-muted-foreground">
                  <GitProviderIcon provider={provider} />
                  <a
                    href={project.git_repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                  >
                    {project.git_repo_url.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {project.git_branch && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-meta-sm font-medium">
                      {project.git_branch}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {showGitSync && (
            <Button onClick={handleSync} disabled={isRunning || syncMutation.isPending}>
              {isRunning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync repository
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <AnalysisStatusPanel status={analysisStatus} syncing={syncing} />

        {project && analysisStatus?.status === 'completed' && (
          <div className="flex justify-end">
            <Button onClick={() => navigate(`/editor/${project.id}`)}>
              Open in editor
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

function AnalysisStatusPanel({
  status,
  syncing,
}: {
  status?: {
    status: string;
    current_step?: string;
    step_number: number;
    total_steps: number;
    error_message?: string;
    completed_at?: string;
  };
  syncing: boolean;
}) {
  if (!status && !syncing) {
    return (
      <p className="text-meta text-muted-foreground">No analysis data for this project yet.</p>
    );
  }

  const active = syncing || status?.status === 'pending' || status?.status === 'running';
  const failed = status?.status === 'failed';
  const done = status?.status === 'completed';
  const progress =
    status && status.total_steps > 0
      ? Math.round((status.step_number / status.total_steps) * 100)
      : 0;

  return (
    <div
      className={cn(
        'rounded-lg border p-6',
        failed
          ? 'border-destructive/20 bg-destructive/10'
          : done
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
            : 'border-border bg-card'
      )}
    >
      <div className="flex items-center gap-3">
        {active && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
        {failed && <AlertTriangle className="h-6 w-6 text-destructive" />}
        {done && <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
        <div>
          <h2 className="text-section font-semibold capitalize">
            {syncing ? 'Syncing repository…' : status?.status || 'Analysis'}
          </h2>
          {status?.current_step && (
            <p className="text-meta text-muted-foreground">{status.current_step}</p>
          )}
        </div>
      </div>

      {active && status && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-meta-sm font-medium text-muted-foreground">
            <span>
              Step {status.step_number} of {status.total_steps}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {failed && status?.error_message && (
        <p className="mt-3 text-meta text-destructive">{status.error_message}</p>
      )}

      {done && status?.completed_at && (
        <p className="mt-3 text-meta text-muted-foreground">
          Completed{' '}
          {formatDistanceToNow(new Date(status.completed_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
