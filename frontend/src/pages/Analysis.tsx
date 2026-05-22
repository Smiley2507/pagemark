import React, { useState } from 'react';
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
  const { data: analysisStatus, refetch } = useAnalysisStatus(
    projectId,
    !syncing
  );
  const syncMutation = useSyncGitRepo();

  const provider =
    project?.git_provider ||
    (project?.git_repo_url ? detectProvider(project.git_repo_url) : null);

  const showGitSync =
    project?.source_type === 'git' && !!project?.git_repo_url;

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
    } catch {
      // toast from mutation
    } finally {
      setSyncing(false);
    }
  };

  const isRunning =
    syncing ||
    analysisStatus?.status === 'pending' ||
    analysisStatus?.status === 'running';

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="mt-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              {projectLoading ? (
                <Skeleton className="h-7 w-48" />
              ) : (
                <h1 className="text-xl font-bold">{project?.name}</h1>
              )}
              {showGitSync && project?.git_repo_url && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <GitProviderIcon provider={provider} />
                  <a
                    href={project.git_repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {project.git_repo_url.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {project.git_branch && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">
                      {project.git_branch}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {showGitSync && (
            <Button
              onClick={handleSync}
              disabled={isRunning || syncMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync Repository
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {projectLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : (
          <AnalysisStatusPanel status={analysisStatus} syncing={syncing} />
        )}

        {project && analysisStatus?.status === 'completed' && (
          <div className="mt-8 flex justify-end">
            <Button
              onClick={() => navigate(`/editor/${project.id}`)}
              className="rounded-xl bg-slate-900 text-white hover:bg-indigo-600 dark:bg-slate-100 dark:text-slate-950"
            >
              Open in Editor
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
      <p className="text-sm text-slate-500">No analysis data for this project yet.</p>
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
        'rounded-2xl border p-6',
        failed
          ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20'
          : done
            ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20'
            : 'border-slate-200/80 bg-white/60 dark:border-slate-800/80 dark:bg-slate-900/60'
      )}
    >
      <div className="flex items-center gap-3">
        {active && <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />}
        {failed && <AlertTriangle className="h-6 w-6 text-rose-500" />}
        {done && <CheckCircle2 className="h-6 w-6 text-emerald-500" />}
        <div>
          <h2 className="font-bold capitalize">
            {syncing ? 'Syncing repository…' : status?.status || 'Analysis'}
          </h2>
          {status?.current_step && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {status.current_step}
            </p>
          )}
        </div>
      </div>

      {active && status && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-500">
            <span>
              Step {status.step_number} of {status.total_steps}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {failed && status?.error_message && (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {status.error_message}
        </p>
      )}

      {done && status?.completed_at && (
        <p className="mt-3 text-sm text-slate-500">
          Completed{' '}
          {formatDistanceToNow(new Date(status.completed_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
