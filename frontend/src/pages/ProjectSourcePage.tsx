import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BookOpenText, Braces, CheckCheck, Copy, ExternalLink, FileCode, GitBranch, RefreshCw, Save, SearchCode, ShieldCheck, Trash2, Webhook } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Surface } from '@/components/ui/surface';
import { analysisApi } from '@/api/analysis';
import { projectsApi } from '@/api/projects';
import { useGenerateWebhookSecret, useRegisterGitHubWebhook, useDeleteWebhook, useGitHubStatus } from '@/hooks/useGit';
import { ProjectSourceConnector } from '@/components/source/ProjectSourceConnector';
import { aiApi } from '@/api/ai';
import { toast } from 'sonner';

export function ProjectSourcePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [copiedField, setCopiedField] = useState<'url' | 'secret' | null>(null);
  const [briefDraft, setBriefDraft] = useState('');

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

  const { data: aiContext } = useQuery({
    queryKey: ['ai-context', Number(projectId)],
    queryFn: () => projectsApi.getAiContext(Number(projectId)),
    enabled: !!projectId,
  });

  const saveBrief = useMutation({
    mutationFn: (contextMd: string | null) => aiApi.updateContext(Number(projectId), contextMd),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['ai-context', Number(projectId)] }),
      ]);
      toast.success('Project brief updated');
    },
    onError: () => toast.error('Failed to save project brief'),
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

  useEffect(() => {
    setBriefDraft(aiContext?.project_brief || '');
  }, [aiContext?.project_brief]);

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

      <Surface variant="panel" padding="lg" className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Braces className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              <h2 className="text-section font-semibold text-text-primary">AI Context</h2>
            </div>
            <p className="text-body text-text-secondary">
              Inspect the Analysis facts and maintainer-written corrections that AI requests can use.
            </p>
          </div>
          <Badge variant={aiContext?.analysis_summary.status === 'completed' ? 'success' : 'neutral'}>
            {aiContext?.analysis_summary.status || 'No Analysis'}
          </Badge>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className="space-y-4">
            <Surface variant="muted" padding="default" className="space-y-3">
              <div className="flex items-center gap-2">
                <SearchCode className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                <h3 className="text-body font-semibold text-text-primary">Analysis facts from source code</h3>
              </div>
              {aiContext ? (
                <div className="grid gap-3 text-body text-text-secondary sm:grid-cols-2">
                  <span>Files: {aiContext.analysis_summary.total_files}</span>
                  <span>Endpoints: {aiContext.analysis_summary.endpoint_count}</span>
                  <span>Dependencies: {aiContext.analysis_summary.dependency_count}</span>
                  <span>Languages: {aiContext.analysis_summary.languages.join(', ') || 'Unknown'}</span>
                  <span>Frameworks: {aiContext.analysis_summary.frameworks.join(', ') || 'Unknown'}</span>
                  <span>Updated: {aiContext.analysis_summary.completed_at ? new Date(aiContext.analysis_summary.completed_at).toLocaleString() : 'Not completed'}</span>
                </div>
              ) : (
                <p className="text-body text-text-secondary">Loading AI context...</p>
              )}
            </Surface>

            <div className="grid gap-4 xl:grid-cols-2">
              <Surface variant="muted" padding="default" className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                  <h3 className="text-body font-semibold text-text-primary">Source previews</h3>
                </div>
                {aiContext?.context_files_preview.length ? (
                  <div className="space-y-2">
                    {aiContext.context_files_preview.slice(0, 5).map((file) => (
                      <div key={file.path} className="space-y-1">
                        <p className="truncate text-meta font-medium text-text-primary">{file.path}</p>
                        <pre className="max-h-20 overflow-hidden rounded bg-canvas p-2 text-[10px] text-text-secondary">{file.preview}</pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-body text-text-secondary">No source file previews are available.</p>
                )}
              </Surface>

              <Surface variant="muted" padding="default" className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                  <h3 className="text-body font-semibold text-text-primary">Unavailable or incomplete facts</h3>
                </div>
                {aiContext && (aiContext.grounding_warnings.length || aiContext.unavailable_facts.length || aiContext.partial_failures.length) ? (
                  <ul className="space-y-2 text-body text-text-secondary">
                    {[...aiContext.grounding_warnings, ...aiContext.unavailable_facts.map(String), ...aiContext.partial_failures.map((item) => JSON.stringify(item))].slice(0, 8).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body text-text-secondary">No missing Analysis facts reported.</p>
                )}
              </Surface>
            </div>
          </div>

          <Surface variant="muted" padding="default" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpenText className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                <h3 className="text-body font-semibold text-text-primary">Project Brief & Corrections</h3>
              </div>
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => saveBrief.mutate(briefDraft.trim() || null)}
                disabled={saveBrief.isPending}
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
            <textarea
              value={briefDraft}
              onChange={(event) => setBriefDraft(event.target.value)}
              rows={16}
              placeholder="Maintainer corrections, product intent, terminology, audiences, and facts Analysis cannot infer from source."
              className="w-full resize-y rounded-md border border-input bg-canvas px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-meta text-text-muted">
              Stored in project context and combined with Analysis facts for future AI requests.
            </p>
          </Surface>
        </div>
      </Surface>

      <Surface variant="panel" padding="lg" className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              <h2 className="text-section font-semibold text-text-primary">Current source</h2>
            </div>
            <p className="text-body text-text-secondary">
              Shared source connection and Analysis context support every Document in this Project.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
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
                  {analysisStatus.status === 'failed'
                    ? analysisStatus.error_message || analysisStatus.step_detail || 'Analysis failed.'
                    : analysisStatus.completed_at
                      ? `Updated ${new Date(analysisStatus.completed_at).toLocaleString()}`
                      : analysisStatus.step_detail || analysisStatus.current_step || 'Analysis is still in progress.'}
                </p>
              </div>
            ) : (
              <p className="text-body text-text-secondary">No Analysis snapshot is available yet.</p>
            )}
          </Surface>
        </div>
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
