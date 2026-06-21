import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, BookOpenText, Braces, RefreshCw, Save, SearchCode } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import { analysisApi } from '@/api/analysis';
import { projectsApi } from '@/api/projects';
import { aiApi } from '@/api/ai';
import { toast } from 'sonner';

export function ProjectAnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [briefDraft, setBriefDraft] = useState('');

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

  const generateBrief = useMutation({
    mutationFn: () => projectsApi.generateBrief(Number(projectId)),
    onSuccess: (result) => {
      setBriefDraft(result.brief_md);
      toast.success('Brief generated. Review and save.');
    },
    onError: () => toast.error('Failed to generate brief'),
  });

  useEffect(() => {
    setBriefDraft(aiContext?.project_brief || '');
  }, [aiContext?.project_brief]);

  return (
    <div className="space-y-6">
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
                  <SearchCode className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                  <h3 className="text-body font-semibold text-text-primary">Source analysis</h3>
                </div>
                {aiContext?.analysis_summary.status === "completed" ? (
                  <div className="space-y-4">
                    {(aiContext.analysis_summary.largest_files as Array<{ path: string; lines: number; language?: string }>)?.length > 0 && (
                      <div>
                        <p className="text-meta font-medium text-text-secondary mb-2">Largest files</p>
                        <div className="space-y-1">
                          {(aiContext.analysis_summary.largest_files as Array<{ path: string; lines: number; language?: string }>).slice(0, 5).map((file) => (
                            <div key={file.path} className="flex items-center justify-between gap-2 rounded bg-canvas px-2 py-1">
                              <span className="truncate text-meta text-text-primary font-mono">{file.path}</span>
                              <span className="shrink-0 text-meta text-text-secondary">{file.lines} lines</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {((aiContext.facts as Record<string, unknown>).endpoints as Array<{ method: string; path: string }>)?.length > 0 && (
                      <div>
                        <p className="text-meta font-medium text-text-secondary mb-2">Endpoints</p>
                        <div className="space-y-1">
                          {((aiContext.facts as Record<string, unknown>).endpoints as Array<{ method: string; path: string }>).slice(0, 6).map((ep, i) => (
                            <div key={i} className="flex items-center gap-2 text-meta">
                              <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                                ep.method === 'GET' ? 'bg-green-100 text-green-800' :
                                ep.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                                ep.method === 'PUT' || ep.method === 'PATCH' ? 'bg-amber-100 text-amber-800' :
                                ep.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                                'bg-neutral-100 text-neutral-800'
                              }`}>{ep.method}</span>
                              <span className="font-mono text-text-primary truncate">{ep.path}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {((aiContext.facts as Record<string, unknown>).dependencies as Array<{ name: string }>)?.length > 0 && (
                      <div>
                        <p className="text-meta font-medium text-text-secondary mb-2">Dependencies</p>
                        <div className="flex flex-wrap gap-1">
                          {((aiContext.facts as Record<string, unknown>).dependencies as Array<{ name: string }>).slice(0, 8).map((dep, i) => (
                            <span key={i} className="rounded bg-canvas px-2 py-0.5 text-meta text-text-secondary">{dep.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-body text-text-secondary">Complete an analysis run to see source analysis details.</p>
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => generateBrief.mutate()}
                  disabled={generateBrief.isPending}
                >
                  <RefreshCw className={`h-4 w-4 ${generateBrief.isPending ? 'animate-spin' : ''}`} />
                  Regenerate with AI
                </Button>
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
