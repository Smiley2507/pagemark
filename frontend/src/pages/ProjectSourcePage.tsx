import { useParams } from 'react-router-dom';
import { GitBranch, RefreshCw, SearchCode, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import { analysisApi } from '@/api/analysis';
import { projectsApi } from '@/api/projects';

export function ProjectSourcePage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: analysisStatus } = useQuery({
    queryKey: ['analysis-status', projectId],
    queryFn: () => analysisApi.getAnalysisStatus(Number(projectId)),
    enabled: !!projectId,
  });

  if (!project) {
    return (
      <EmptyState
        title="Project source unavailable"
        description="The source connection details could not be loaded."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              <h2 className="text-section font-semibold text-text-primary">Source</h2>
            </div>
            <p className="text-body text-text-secondary">
              Shared source connection and Analysis context support every Document in this Project.
            </p>
          </div>
          <Button type="button" variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync source
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Surface variant="muted" padding="default" className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <h3 className="text-body font-semibold text-text-primary">Connection</h3>
            </div>
            <div className="grid gap-2 text-body text-text-secondary">
              <span>{project.git_repo_url || 'No source connected'}</span>
              <span>Branch: {project.git_branch || 'Unknown'}</span>
              <span>Source type: {project.source_type}</span>
            </div>
          </Surface>

          <Surface variant="muted" padding="default" className="space-y-3">
            <div className="flex items-center gap-2">
              <SearchCode className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <h3 className="text-body font-semibold text-text-primary">Analysis</h3>
            </div>
            {analysisStatus ? (
              <div className="space-y-3">
                <Badge variant={analysisStatus.status === 'completed' ? 'success' : analysisStatus.status === 'failed' ? 'danger' : 'info'}>
                  {analysisStatus.status === 'completed' ? 'Analysis complete' : `Analysis ${analysisStatus.status}`}
                </Badge>
                <p className="text-body text-text-secondary">
                  {analysisStatus.completed_at
                    ? `Updated ${new Date(analysisStatus.completed_at).toLocaleString()}`
                    : 'Analysis is still in progress.'}
                </p>
              </div>
            ) : (
              <p className="text-body text-text-secondary">No Analysis snapshot is available yet.</p>
            )}
          </Surface>
        </div>
      </Surface>

      {analysisStatus?.steps && analysisStatus.steps.length > 0 && (
        <Surface variant="panel" padding="lg" className="space-y-4">
          <h3 className="text-section font-semibold text-text-primary">Analysis workflow</h3>
          <div className="space-y-3">
            {analysisStatus.steps.map((step) => (
              <Surface key={step.number} variant="muted" padding="default" className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-body font-medium text-text-primary">{step.name}</p>
                  <p className="text-meta text-text-muted">Step {step.number}</p>
                </div>
                <Badge
                  variant={step.status === 'done' ? 'success' : step.status === 'failed' ? 'danger' : step.status === 'running' ? 'generation' : 'neutral'}
                  showIcon={false}
                >
                  {step.status}
                </Badge>
              </Surface>
            ))}
          </div>
        </Surface>
      )}

    </div>
  );
}
