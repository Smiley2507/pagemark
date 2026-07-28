import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BookOpenText, Copy, GitBranch, RefreshCw, SearchCode, Trash2, Webhook } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiApi } from '@/api/ai';
import { analysisApi } from '@/api/analysis';
import { projectsApi } from '@/api/projects';
import { ProjectSourceConnector } from '@/components/source/ProjectSourceConnector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDeleteWebhook, useGenerateWebhookSecret, useGitHubStatus, useRegisterGitHubWebhook } from '@/hooks/useGit';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useHasCapability } from '@/hooks/useHasCapability';
import { PROJECT_MANAGE } from '@/lib/authz';

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel-muted/30 px-4 py-3">
      <p className="text-meta font-medium uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="mt-1 truncate text-body font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function AnalysisRail({
  analysisStatus,
}: {
  analysisStatus: { status: string; steps?: Array<{ number: number; name: string; status: string }> } | null | undefined;
}) {
  const steps = analysisStatus?.steps || [];
  const currentStep = steps.find((step) => step.status === 'running')
    || steps.find((step) => step.status === 'failed')
    || steps.find((step) => step.status === 'pending')
    || steps[steps.length - 1];
  const status = analysisStatus?.status;
  const completed = status === 'completed';
  const failed = status === 'failed' || currentStep?.status === 'failed';
  const percent = completed
    ? 100
    : steps.length > 0
      ? Math.max(12, Math.min(88, Math.round(((steps.filter((step) => step.status === 'done').length || 0) / steps.length) * 100)))
      : status === 'pending' || status === 'running'
        ? 28
        : 0;

  return (
    <div className="space-y-3">
      <div className="h-2 overflow-hidden rounded-full bg-panel-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            failed ? 'bg-status-danger' : completed ? 'bg-status-success' : 'bg-interaction',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className={cn('text-body font-medium', failed ? 'text-status-danger-foreground' : 'text-text-primary')}>
          {failed ? 'Stop' : currentStep?.name || (completed ? 'Complete' : 'Waiting')}
        </p>
        <p className="text-meta text-text-muted">
          {failed ? 'Failed' : completed ? 'Done' : status === 'running' ? 'Running' : 'Idle'}
        </p>
      </div>
    </div>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:text-text-primary prose-p:text-text-secondary prose-li:text-text-secondary prose-strong:text-text-primary prose-code:rounded prose-code:bg-panel-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.92em] prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-panel-muted prose-pre:p-4 prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-border prose-th:bg-panel-muted prose-th:px-3 prose-th:py-2 prose-th:text-left prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ProjectSourcePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [briefDraft, setBriefDraft] = useState('');
  const [briefEditing, setBriefEditing] = useState(false);
  const [tab, setTab] = useState<'analysis' | 'results'>('analysis');

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

  useEffect(() => {
    setBriefDraft(aiContext?.project_brief || '');
    if (!aiContext?.project_brief) {
      setBriefEditing(false);
    }
  }, [aiContext?.project_brief]);

  const saveBrief = useMutation({
    mutationFn: (contextMd: string | null) => aiApi.updateContext(Number(projectId), contextMd),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['ai-context', Number(projectId)] }),
      ]);
      setBriefEditing(false);
      toast.success('Project brief updated');
    },
    onError: () => toast.error('Failed to save project brief'),
  });

  const generateBrief = useMutation({
    mutationFn: () => projectsApi.generateBrief(Number(projectId)),
    onSuccess: (result) => {
      setBriefDraft(result.brief_md);
      setBriefEditing(true);
      toast.success('Brief generated. Review the draft.');
    },
    onError: () => toast.error('Failed to generate brief'),
  });

  const generateSecret = useGenerateWebhookSecret();
  const registerWebhook = useRegisterGitHubWebhook();
  const deleteWebhook = useDeleteWebhook();
  const { data: githubStatus } = useGitHubStatus();

  const canManageProject = useHasCapability(PROJECT_MANAGE, project);

  if (!project) {
    return (
      <EmptyState
        title="Project source unavailable"
        description="The source connection details could not be loaded."
      />
    );
  }

  const isSetupFlow = searchParams.get('setup') === 'source';
  const templateId = searchParams.get('templateId');
  const documentSetupPath = templateId
    ? `/document-setup?projectId=${project.id}&templateId=${templateId}`
    : `/document-setup?projectId=${project.id}`;

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

  const analysisActive = analysisStatus?.status === 'pending' || analysisStatus?.status === 'running';
  const analysisComplete = analysisStatus?.status === 'completed' || Boolean(aiContext?.analysis_summary.status === 'completed');
  const analysisFailed = analysisStatus?.status === 'failed';

  const metrics = aiContext
    ? [
        { label: 'Files', value: aiContext.analysis_summary.total_files.toLocaleString() },
        { label: 'Endpoints', value: aiContext.analysis_summary.endpoint_count.toLocaleString() },
        { label: 'Dependencies', value: aiContext.analysis_summary.dependency_count.toLocaleString() },
        { label: 'Languages', value: aiContext.analysis_summary.languages.join(', ') || 'Unknown' },
      ]
    : [];

  const topFiles = (aiContext?.analysis_summary.largest_files as Array<{ path: string; lines: number }> | undefined) || [];
  const topEndpoints = ((aiContext?.facts as Record<string, unknown> | undefined)?.endpoints as Array<{ method: string; path: string }> | undefined) || [];
  const warnings = aiContext
    ? [...aiContext.grounding_warnings, ...aiContext.unavailable_facts.map(String), ...aiContext.partial_failures.map((item) => JSON.stringify(item))].slice(0, 6)
    : [];

  const brief = aiContext?.project_brief?.trim() || '';

  return (
    <div className="space-y-5 px-6 py-6">
      {isSetupFlow && (
        <Surface variant="glass" padding="lg" className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-section font-semibold text-text-primary">Set up project source</h1>
            <p className="text-body text-text-secondary">
              Connect source now for analysis-backed documentation, or continue without source and add it later.
            </p>
          </div>
          <Button type="button" onClick={() => window.location.assign(documentSetupPath)}>
            Continue
          </Button>
        </Surface>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'analysis' | 'results')} className="space-y-5">
        <TabsList aria-label="Source page tabs" className="max-w-xs">
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-5">
          <Surface variant="panel" padding="lg" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-meta font-medium uppercase tracking-[0.12em] text-text-muted">Analysis</p>
              <Badge variant={analysisComplete ? 'success' : analysisFailed ? 'danger' : analysisActive ? 'generation' : 'neutral'} showIcon={false}>
                {analysisComplete ? 'Ready' : analysisFailed ? 'Stopped' : analysisActive ? 'Running' : 'Idle'}
              </Badge>
            </div>

            <AnalysisRail analysisStatus={analysisStatus} />

            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-meta text-text-muted">
                {analysisComplete ? 'Results are ready.' : analysisFailed ? 'Analysis stopped.' : 'Results will appear after analysis completes.'}
              </p>
              <Button
                type="button"
                variant={analysisComplete ? 'default' : 'outline'}
                size="sm"
                disabled={!analysisComplete}
                onClick={() => setTab('results')}
                className={cn(!analysisComplete && 'cursor-not-allowed opacity-50')}
              >
                View results
              </Button>
            </div>
          </Surface>

          <ProjectSourceConnector project={project} />
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Surface variant="panel" padding="lg" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpenText className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                <h2 className="text-section font-semibold text-text-primary">Brief</h2>
              </div>
              {canManageProject && (
              <div className="flex items-center gap-2">
                {brief && !briefEditing && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setBriefEditing(true)}>
                    Edit
                  </Button>
                )}
                {briefEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBriefDraft(brief);
                      setBriefEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  onClick={() => generateBrief.mutate()}
                  disabled={generateBrief.isPending}
                >
                  <RefreshCw className={`h-4 w-4 ${generateBrief.isPending ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
                {briefEditing && (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={() => saveBrief.mutate(briefDraft.trim() || null)}
                    disabled={saveBrief.isPending}
                  >
                    Save
                  </Button>
                )}
              </div>
              )}
            </div>

            {metrics.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <Metric key={metric.label} label={metric.label} value={metric.value} />
                ))}
              </div>
            ) : (
              <Notice variant="info">Complete analysis to see results.</Notice>
            )}

            {briefEditing ? (
              <textarea
                value={briefDraft}
                onChange={(event) => setBriefDraft(event.target.value)}
                rows={18}
                className="min-h-[18rem] w-full resize-y rounded-xl border border-input bg-panel-muted/30 px-4 py-3 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Write the project brief in markdown..."
              />
            ) : brief ? (
              <MarkdownPreview content={brief} />
            ) : (
              <EmptyState
                title="No brief saved"
                description="Add project context to show it here."
                action={canManageProject ? (
                  <Button type="button" onClick={() => setBriefEditing(true)}>
                    Create brief
                  </Button>
                ) : undefined}
              />
            )}
          </Surface>

          <Surface variant="panel" padding="lg" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                <h2 className="text-section font-semibold text-text-primary">Results</h2>
              </div>
              <Badge variant={analysisComplete ? 'success' : 'neutral'} showIcon={false}>
                {analysisComplete ? 'Ready' : 'Pending'}
              </Badge>
            </div>

            {analysisComplete ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-xl border border-border bg-panel-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <SearchCode className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                    <h3 className="text-body font-semibold text-text-primary">Files</h3>
                  </div>
                  {topFiles.length > 0 ? (
                    <div className="space-y-2">
                      {topFiles.slice(0, 4).map((file) => (
                        <div key={file.path} className="flex items-center justify-between gap-3">
                          <span className="truncate font-mono text-meta text-text-primary">{file.path}</span>
                          <span className="shrink-0 text-meta text-text-secondary">{file.lines} lines</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-body text-text-secondary">No file breakdown available.</p>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-panel-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <BookOpenText className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                    <h3 className="text-body font-semibold text-text-primary">Endpoints</h3>
                  </div>
                  {topEndpoints.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {topEndpoints.slice(0, 6).map((endpoint, index) => (
                        <span key={`${endpoint.method}-${endpoint.path}-${index}`} className="rounded-full border border-border bg-panel px-3 py-1 text-meta text-text-secondary">
                          <span className="font-semibold text-text-primary">{endpoint.method}</span>
                          <span className="ml-2 font-mono">{endpoint.path}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-body text-text-secondary">No endpoint facts were extracted.</p>
                  )}
                </div>
              </div>
            ) : (
              <Notice variant="info">Results appear after analysis completes.</Notice>
            )}

            {warnings.length > 0 && (
              <div className="space-y-3 rounded-xl border border-border bg-panel-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                  <h3 className="text-body font-semibold text-text-primary">Missing facts</h3>
                </div>
                <div className="grid gap-2">
                  {warnings.map((item) => (
                    <div key={item} className="rounded-lg border border-border bg-panel px-3 py-2 text-body text-text-secondary">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Surface>
        </TabsContent>
      </Tabs>
    </div>
  );
}
