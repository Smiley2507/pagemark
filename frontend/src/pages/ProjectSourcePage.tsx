import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCheck, Copy, ExternalLink, GitBranch, RefreshCw, ShieldCheck, Trash2, Webhook } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import { analysisApi } from '@/api/analysis';
import { projectsApi } from '@/api/projects';
import { useGenerateWebhookSecret, useRegisterGitHubWebhook, useDeleteWebhook, useGitHubStatus } from '@/hooks/useGit';
import { ProjectSourceConnector } from '@/components/source/ProjectSourceConnector';

export function ProjectSourcePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [copiedField, setCopiedField] = useState<'url' | 'secret' | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: analysisStatus } = useQuery({
    queryKey: ['analysis-status', projectId],
    queryFn: async () => {
      try {
        return await analysisApi.getAnalysisStatus(Number(projectId));
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!projectId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'running' ? 2500 : false;
    },
    retry: false,
  });

  const generateSecret = useGenerateWebhookSecret();
  const registerWebhook = useRegisterGitHubWebhook();
  const deleteWebhook = useDeleteWebhook();
  const { data: githubStatus } = useGitHubStatus();

  const handleCopy = async (text: string, field: 'url' | 'secret') => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!project) {
    return (
      <EmptyState
        title="Project source unavailable"
        description="The source connection details could not be loaded."
      />
    );
  }

  const webhookUrl = project.webhook_secret
    ? `${window.location.protocol}//${window.location.hostname}:8000/webhooks/github`
    : null;

  const canRegisterWebhook = !!(
    project.webhook_secret &&
    !project.webhook_id &&
    project.source_owner &&
    project.source_repository &&
    githubStatus?.connected
  );
  const isSetupFlow = searchParams.get('setup') === 'source';
  const templateId = searchParams.get('templateId');
  const documentSetupPath = templateId
    ? `/document-setup?projectId=${project.id}&templateId=${templateId}`
    : `/document-setup?projectId=${project.id}`;

  return (
    <div className="space-y-6">
      {isSetupFlow && (
        <Surface variant="panel" padding="lg" className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <h1 className="text-section font-semibold text-text-primary">Set up project source</h1>
            <p className="text-body text-text-secondary">
              Connect source now for Analysis-backed documentation, or continue without source and add it later.
            </p>
          </div>
          <Button type="button" onClick={() => navigate(documentSetupPath)}>
            Continue to document setup
          </Button>
        </Surface>
      )}

      <ProjectSourceConnector project={project} />

      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              <h2 className="text-section font-semibold text-text-primary">Current source</h2>
            </div>
            <p className="text-body text-text-secondary">
              Shared source connection supporting every Document in this Project.
            </p>
          </div>
        </div>

        <Surface variant="muted" padding="default" className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            <h3 className="text-body font-semibold text-text-primary">Connection</h3>
          </div>
          <div className="grid gap-2 text-body text-text-secondary">
            <span>{project.source_metadata?.repo_url as string || project.source_repository || 'No source connected'}</span>
            <span>Branch: {project.selected_branch || 'Unknown'}</span>
            <span>Source type: {project.source_type}</span>
          </div>
        </Surface>
      </Surface>

      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              <h2 className="text-section font-semibold text-text-primary">Webhooks</h2>
            </div>
            <p className="text-body text-text-secondary">
              Auto-trigger re-analysis when you push to this repository on GitHub.
            </p>
          </div>
          <div className="flex gap-2">
            {project.webhook_id && (
              <Button type="button" variant="destructive" size="sm" className="gap-2"
                onClick={() => deleteWebhook.mutate(Number(projectId))}
                disabled={deleteWebhook.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Delete webhook
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" className="gap-2"
              onClick={() => generateSecret.mutate(Number(projectId))}
              disabled={generateSecret.isPending}
            >
              <RefreshCw className="h-4 w-4" />
              {project.webhook_secret ? 'Regenerate secret' : 'Generate secret'}
            </Button>
          </div>
        </div>

        {project.webhook_secret ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Surface variant="muted" padding="default" className="space-y-2">
              <label className="text-meta font-medium text-text-secondary">Webhook URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-canvas px-2 py-1 text-meta text-text-primary font-mono">
                  {webhookUrl}
                </code>
                <Button type="button" variant="ghost" size="icon" onClick={() => handleCopy(webhookUrl!, 'url')}>
                  {copiedField === 'url' ? <CheckCheck className="h-4 w-4 text-status-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </Surface>
            <Surface variant="muted" padding="default" className="space-y-2">
              <label className="text-meta font-medium text-text-secondary">Secret</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-canvas px-2 py-1 text-meta text-text-primary font-mono">
                  {project.webhook_secret}
                </code>
                <Button type="button" variant="ghost" size="icon" onClick={() => handleCopy(project.webhook_secret!, 'secret')}>
                  {copiedField === 'secret' ? <CheckCheck className="h-4 w-4 text-status-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </Surface>
            <div className="xl:col-span-2 flex items-center gap-3">
              <Badge variant={project.webhook_id ? 'success' : 'neutral'}>
                {project.webhook_id ? 'Registered on GitHub' : 'Not registered'}
              </Badge>
              {canRegisterWebhook && (
                <Button type="button" variant="secondary" size="sm" className="gap-2"
                  onClick={() => registerWebhook.mutate({
                    projectId: Number(projectId),
                    owner: project.source_owner!,
                    repo: project.source_repository!,
                  })}
                  disabled={registerWebhook.isPending}
                >
                  <ExternalLink className="h-4 w-4" />
                  Register on GitHub
                </Button>
              )}
              {project.webhook_secret && !project.webhook_id && project.source_owner && project.source_repository && githubStatus?.connected === false && (
                <p className="text-meta text-text-secondary">
                  Reconnect GitHub before registering this webhook.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-body text-text-secondary">
            Generate a secret to get your webhook URL. Then add it to your GitHub repository settings.
          </p>
        )}
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
