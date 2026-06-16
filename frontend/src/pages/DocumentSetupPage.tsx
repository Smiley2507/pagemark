import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { toast } from 'sonner';
import { analysisApi } from '@/api/analysis';
import { aiApi } from '@/api/ai';
import { aiCredentialsApi } from '@/api/aiCredentials';
import { documentsApi } from '@/api/documents';
import { projectsApi } from '@/api/projects';
import { AnalysisFactsStep } from '@/components/document-setup/AnalysisFactsStep';
import { GenerationChoiceStep } from '@/components/document-setup/GenerationChoiceStep';
import { OutlineReviewStep } from '@/components/document-setup/OutlineReviewStep';
import { ProviderCredentialSetup } from '@/components/document-setup/ProviderCredentialSetup';
import { SetupSummaryRail } from '@/components/document-setup/SetupSummaryRail';
import { SourceStep } from '@/components/document-setup/SourceStep';
import { TemplateRecommendationStep } from '@/components/document-setup/TemplateRecommendationStep';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Surface } from '@/components/ui/surface';
import {
  deriveUiStage,
  describeSource,
  outlineBasisForRecommendation,
  sourceTypeFromProject,
} from '@/lib/document-setup-flow';
import type {
  DocumentSetupState,
  OutlineProposal,
  SetupSectionSummary,
  TemplateRecommendation,
} from '@/types/document-setup';

const INITIAL_STATE: DocumentSetupState = {
  stage: 'source',
  analysisComplete: false,
  analysisPartial: false,
  outlineApproved: false,
  providerConfigured: false,
  sourceLimitations: [],
};

export function DocumentSetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const resumeProjectId = searchParams.get('projectId');
  const resumeDocumentId = searchParams.get('documentId');

  const [setupState, setSetupState] = useState<DocumentSetupState>(INITIAL_STATE);
  const [showRailDrawer, setShowRailDrawer] = useState(false);
  const [providerContext, setProviderContext] = useState<'recommendation' | 'overview' | 'generation' | null>(null);
  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [projectOverviewDraft, setProjectOverviewDraft] = useState('');
  const [overviewQuestions, setOverviewQuestions] = useState<string[]>([]);

  const { data: credentialList } = useQuery({
    queryKey: ['ai-credentials'],
    queryFn: () => aiCredentialsApi.list(),
  });

  const hasActiveProvider = credentialList?.has_active ?? false;

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => projectsApi.getTemplates(),
    enabled: setupState.stage === 'template-selection' || setupState.stage === 'outline-review',
  });

  const sourceConnected = !!setupState.projectId && setupState.sourceType !== 'none';

  const analysisStatusQuery = useQuery({
    queryKey: ['analysis-status', setupState.projectId],
    queryFn: () => analysisApi.getAnalysisStatus(setupState.projectId!),
    enabled: !!setupState.projectId && sourceConnected,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 1500 : false;
    },
  });

  const analysisResultsQuery = useQuery({
    queryKey: ['analysis-results', setupState.projectId],
    queryFn: () => analysisApi.getAnalysisResults(setupState.projectId!),
    enabled: !!setupState.projectId && sourceConnected && analysisStatusQuery.data?.status === 'completed',
    retry: false,
  });

  const setupSnapshotQuery = useQuery({
    queryKey: ['document-setup', setupState.projectId, setupState.documentId],
    queryFn: () => documentsApi.getSetupState(setupState.projectId!, setupState.documentId!),
    enabled: !!setupState.projectId && !!setupState.documentId,
  });

  useEffect(() => {
    setSetupState((current) => ({
      ...current,
      providerConfigured: hasActiveProvider,
    }));
  }, [hasActiveProvider]);

  useEffect(() => {
    if (!resumeProjectId || resumeLoaded) return;

    let active = true;

    const loadResume = async () => {
      try {
        const projectId = Number(resumeProjectId);
        const project = await projectsApi.getProject(projectId);
        const repoUrl = project.source_metadata?.repo_url as string | undefined;
        const sourceType = sourceTypeFromProject(project.source_type, repoUrl);
        const sourceSummary = describeSource(sourceType, repoUrl);

        // --- Connect Source to Existing Project path ---
        // projectId supplied but NO documentId → user created a Project via the modal
        // and needs to connect a source for it.
        if (!resumeDocumentId) {
          if (!active) return;
          setSetupState((current) => ({
            ...current,
            projectId,
            projectName: project.name,
            sourceType,
            sourceLabel: sourceSummary.label,
            sourceLimitations: sourceSummary.limitations,
            stage: 'source',
          }));
          setResumeLoaded(true);
          return;
        }

        // --- Resume existing document setup ---
        const documentId = Number(resumeDocumentId);
        const document = await documentsApi.getDocument(projectId, documentId);

        if (!active) return;
        setSetupState((current) => ({
          ...current,
          projectId,
          documentId,
          projectName: project.name,
          projectContext: document.context || project.context_md,
          sourceType,
          sourceLabel: sourceSummary.label,
          sourceLimitations: sourceSummary.limitations,
        }));
      } catch (error) {
        toast.error('Unable to resume the Document setup flow.');
      } finally {
        if (active) setResumeLoaded(true);
      }
    };

    void loadResume();

    return () => {
      active = false;
    };
  }, [resumeDocumentId, resumeLoaded, resumeProjectId]);

  useEffect(() => {
    const snapshot = setupSnapshotQuery.data;
    if (!snapshot) return;

    const analysisStatus = analysisStatusQuery.data;
    const sourceType = setupState.sourceType;
    const sourceSummary = describeSource(sourceType, setupState.repoMetadata?.fullName);
    const firstRecommendation = snapshot.recommendations[0];
    const currentProposal = snapshot.outline_proposals[0];

    setSetupState((current) => ({
      ...current,
      stage: deriveUiStage(snapshot.document.setup_stage, sourceType, analysisStatus),
      outlineApproved:
        snapshot.document.setup_stage === 'generation_mode' ||
        snapshot.document.setup_stage === 'editor_ready',
      analysisComplete: analysisStatus?.status === 'completed',
      analysisPartial:
        analysisStatus?.status === 'completed' &&
        !!analysisStatus.steps?.some((step) => step.status === 'failed' || step.status === 'skipped'),
      selectedTemplateId: snapshot.document.template_id ?? current.selectedTemplateId,
      selectedTemplateName:
        snapshot.document.template?.name ??
        firstRecommendation?.template?.name ??
        current.selectedTemplateName,
      customOutline: Boolean(snapshot.document.custom_outline_metadata),
      outlineProposalId: currentProposal?.id,
      sourceLabel: sourceSummary.label,
      sourceLimitations: sourceSummary.limitations,
      ruleBasedRecommendationCount: snapshot.recommendations.filter((item) => item.basis === 'rule_based').length,
      aiRecommendationCount: snapshot.recommendations.filter((item) => item.basis === 'ai_personalized').length,
    }));

    if (snapshot.document.setup_stage === 'editor_ready') {
      navigate(`/projects/${snapshot.document.project_id}/documents/${snapshot.document.id}`, {
        replace: true,
      });
    }
  }, [
    analysisStatusQuery.data,
    navigate,
    setupSnapshotQuery.data,
    setupState.repoMetadata?.fullName,
    setupState.sourceType,
  ]);

  useEffect(() => {
    const status = analysisStatusQuery.data;
    if (!status) return;
    if (status.status === 'failed') {
      setSetupState((current) => ({
        ...current,
        stage: 'analysis',
      }));
    }
  }, [analysisStatusQuery.data]);

  const recommendations = setupSnapshotQuery.data?.recommendations ?? [];
  const setupSections = setupSnapshotQuery.data?.sections ?? [];
  const setupSectionIds = setupSections.map((section) => section.id);
  const outlineProposal =
    setupSnapshotQuery.data?.outline_proposals.find((item) => item.status === 'draft') ||
    setupSnapshotQuery.data?.outline_proposals[0] ||
    null;
  const clarificationRequests = setupSnapshotQuery.data?.clarification_requests ?? [];

  const onDemandEstimateQuery = useQuery({
    queryKey: ['generation-estimate', setupState.projectId, setupState.documentId, 'on-demand', setupSectionIds.join(',')],
    queryFn: () => documentsApi.estimateGeneration(setupState.projectId!, setupState.documentId!, 'on-demand', setupSectionIds),
    enabled:
      !!setupState.projectId &&
      !!setupState.documentId &&
      setupSectionIds.length > 0 &&
      setupState.stage === 'generation-mode' &&
      hasActiveProvider,
    retry: false,
  });

  const completeEstimateQuery = useQuery({
    queryKey: ['generation-estimate', setupState.projectId, setupState.documentId, 'complete'],
    queryFn: () => documentsApi.estimateGeneration(setupState.projectId!, setupState.documentId!, 'complete'),
    enabled:
      !!setupState.projectId &&
      !!setupState.documentId &&
      setupState.stage === 'generation-mode' &&
      hasActiveProvider,
    retry: false,
  });

  const requestAiRecommendationMutation = useMutation({
    mutationFn: () =>
      documentsApi.createTemplateRecommendations(
        setupState.projectId!,
        setupState.documentId!,
        'ai_personalized',
        true,
      ),
    onSuccess: async () => {
      await setupSnapshotQuery.refetch();
      setProviderContext(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const generateOverviewMutation = useMutation({
    mutationFn: () => projectsApi.generateAiOverview(setupState.projectId!),
    onSuccess: (overview) => {
      setProjectOverviewDraft(overview.overview_md);
      setOverviewQuestions(overview.questions || []);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Unable to generate the Project overview.');
    },
  });

  // ------------------------------------------------------------------
  // Handler: create first Project + first Document (onboarding flow).
  // ------------------------------------------------------------------
  const connectSource = async (payload: {
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
  }) => {
    try {
      let projectId = setupState.projectId;
      let projectName = setupState.projectName || payload.projectName;

      if (!projectId) {
        const project = await projectsApi.createProject({
          name: payload.projectName,
          description: payload.projectContext,
          source_type: payload.type === 'zip' ? 'zip' : payload.type === 'none' ? 'scratch' : 'git',
        });
        projectId = project.id;
        projectName = project.name;
      } else {
        // If the project already exists, update its name and description context if needed.
        await projectsApi.updateProject(projectId, {
          name: projectName,
          description: payload.projectContext,
        });
      }

      const document = await documentsApi.createDocument(projectId, {
        title: `${projectName} overview`,
        context: payload.projectContext,
        setup_stage: 'purpose',
      });

      const sourceType =
        payload.type === 'github-oauth'
          ? 'github-oauth'
          : payload.type === 'git-url'
            ? 'git-url'
            : payload.type === 'zip'
              ? 'zip'
              : 'none';

      const sourceSummary = describeSource(sourceType, payload.repoData?.fullName);

      setSetupState((current) => ({
        ...current,
        projectId,
        documentId: document.id,
        projectName,
        projectContext: payload.projectContext,
        repoMetadata: payload.repoData,
        sourceType,
        sourceLabel: sourceSummary.label,
        sourceLimitations: sourceSummary.limitations,
      }));

      if (payload.type === 'github-oauth' && payload.repoData) {
        await analysisApi.connectGitOAuth(projectId, {
          owner: payload.repoData.owner,
          repo: payload.repoData.repo,
          branch: payload.repoData.branch,
          provider: 'github',
        });
        setSetupState((current) => ({ ...current, stage: 'analysis' }));
      } else if (payload.type === 'git-url' && payload.gitUrl) {
        await analysisApi.connectGitUrl(projectId, {
          repo_url: payload.gitUrl,
          branch: payload.gitBranch || 'main',
        });
        setSetupState((current) => ({ ...current, stage: 'analysis' }));
      } else if (payload.type === 'zip' && payload.zipFile) {
        await analysisApi.uploadZip(projectId, payload.zipFile);
        setSetupState((current) => ({ ...current, stage: 'analysis' }));
      } else {
        await documentsApi.updateDocument(projectId, document.id, {
          setup_stage: 'template_selection',
          context: payload.projectContext,
        });
        await queryClient.invalidateQueries({ queryKey: ['document-setup', projectId, document.id] });
        setSetupState((current) => ({ ...current, stage: 'template-selection' }));
      }

      navigate(`/document-setup?projectId=${projectId}&documentId=${document.id}`, { replace: true });
    } catch (error) {
      toast.error('Unable to start the first-Document flow.');
    }
  };

  const continueFromAnalysis = async () => {
    if (!setupState.projectId || !setupState.documentId) return;
    await documentsApi.updateDocument(setupState.projectId, setupState.documentId, {
      setup_stage: 'template_selection',
    });
    await setupSnapshotQuery.refetch();
    setSetupState((current) => ({ ...current, stage: 'template-selection' }));
  };

  const saveOverviewAndContinue = async () => {
    if (!setupState.projectId || !setupState.documentId || !projectOverviewDraft.trim()) return;
    try {
      const contextMd = projectOverviewDraft.trim();
      await aiApi.updateContext(setupState.projectId, contextMd);
      await documentsApi.updateDocument(setupState.projectId, setupState.documentId, {
        context: contextMd,
        setup_stage: 'template_selection',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project', String(setupState.projectId)] }),
        queryClient.invalidateQueries({ queryKey: ['ai-context', setupState.projectId] }),
        setupSnapshotQuery.refetch(),
      ]);
      setSetupState((current) => ({
        ...current,
        projectContext: contextMd,
        stage: 'template-selection',
      }));
    } catch (error) {
      toast.error('Unable to save the Project overview.');
    }
  };

  const selectTemplate = async (
    templateId: number,
    recommendation?: TemplateRecommendation,
  ) => {
    if (!setupState.projectId || !setupState.documentId) return;
    try {
      await documentsApi.updateDocument(setupState.projectId, setupState.documentId, {
        template_id: templateId,
        setup_stage: 'outline_review',
      });
      await documentsApi.createOutlineProposal(setupState.projectId, setupState.documentId, {
        template_id: templateId,
        basis: outlineBasisForRecommendation(recommendation),
        explanation: recommendation
          ? {
              recommendation_id: recommendation.id,
              recommendation_basis: recommendation.basis,
            }
          : undefined,
      });
      await setupSnapshotQuery.refetch();
      setSetupState((current) => ({
        ...current,
        stage: 'outline-review',
        selectedTemplateId: templateId,
        selectedTemplateName:
          recommendation?.template?.name ||
          templates.find((item) => item.id === templateId)?.name ||
          current.selectedTemplateName,
      }));
    } catch (error) {
      toast.error('Unable to create the Outline proposal.');
    }
  };

  const createCustomOutline = async () => {
    if (!setupState.projectId || !setupState.documentId) return;
    try {
      const outline: SetupSectionSummary[] = [
        {
          heading: 'Overview',
          description: 'Explain the Document purpose and what this project does.',
          purpose: 'Orient the maintainer or reader quickly.',
          order_index: 0,
        },
        {
          heading: 'Core concepts',
          description: 'Introduce the most important concepts, modules, or workflows.',
          purpose: 'Capture project-specific domain ideas.',
          order_index: 1,
        },
        {
          heading: 'Key workflows',
          description: 'Document the main operational or implementation paths.',
          purpose: 'Make the first Document immediately useful.',
          order_index: 2,
        },
      ];
      await documentsApi.updateDocument(setupState.projectId, setupState.documentId, {
        setup_stage: 'outline_review',
        custom_outline_metadata: { seeded: true },
      });
      await documentsApi.createOutlineProposal(setupState.projectId, setupState.documentId, {
        outline,
        basis: 'custom_outline',
        explanation: {
          source_connected: setupState.sourceType !== 'none',
        },
      });
      await setupSnapshotQuery.refetch();
      setSetupState((current) => ({
        ...current,
        stage: 'outline-review',
        customOutline: true,
        selectedTemplateName: 'Custom Outline',
      }));
    } catch (error) {
      toast.error('Unable to create the Custom Outline.');
    }
  };

  const approveOutline = async (outline: SetupSectionSummary[]) => {
    if (!setupState.projectId || !setupState.documentId || !outlineProposal) return;
    try {
      await documentsApi.updateOutlineProposal(
        setupState.projectId,
        setupState.documentId,
        outlineProposal.id,
        { outline },
      );
      await documentsApi.approveOutlineProposal(
        setupState.projectId,
        setupState.documentId,
        outlineProposal.id,
      );
      await documentsApi.updateDocument(setupState.projectId, setupState.documentId, {
        setup_stage: 'generation_mode',
      });
      await setupSnapshotQuery.refetch();
      setSetupState((current) => ({
        ...current,
        stage: 'generation-mode',
        outlineApproved: true,
      }));
    } catch (error) {
      toast.error('Unable to approve the Outline.');
    }
  };

  const skipClarification = async (requestId: number) => {
    if (!setupState.projectId || !setupState.documentId) return;
    try {
      await documentsApi.skipClarificationRequest(setupState.projectId, setupState.documentId, requestId);
      await setupSnapshotQuery.refetch();
    } catch (error) {
      toast.error('Unable to skip that clarification.');
    }
  };

  const chooseGeneration = async (mode: 'on-demand' | 'complete' | 'manual') => {
    if (!setupState.projectId || !setupState.documentId) return;
    try {
      setSetupState((current) => ({ ...current, generationMode: mode }));
      if (mode === 'manual') {
        await documentsApi.updateDocument(setupState.projectId, setupState.documentId, {
          setup_stage: 'editor_ready',
        });
      } else {
        await documentsApi.createGenerationRun(
          setupState.projectId,
          setupState.documentId,
          mode,
          mode === 'on-demand' ? setupSectionIds : undefined,
          true,
        );
        await documentsApi.updateDocument(setupState.projectId, setupState.documentId, {
          setup_stage: 'editor_ready',
        });
      }
      navigate(`/projects/${setupState.projectId}/documents/${setupState.documentId}`);
    } catch (error) {
      toast.error('Unable to enter the editor.');
    }
  };

  const providerActionLabel =
    providerContext === 'recommendation'
      ? 'AI-personalized recommendations'
      : providerContext === 'overview'
        ? 'AI Project overview'
      : 'AI-powered generation';

  const loadingResume = !!resumeProjectId && !resumeLoaded;

  if (loadingResume) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-workspace px-4">
        <Surface variant="panel" padding="lg">
          <p className="text-body text-text-secondary">Resuming the first-Document journey…</p>
        </Surface>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-workspace text-text-primary">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border bg-canvas px-4 py-3 lg:hidden">
          <Button variant="outline" size="sm" onClick={() => setShowRailDrawer(true)}>
            <Menu className="h-4 w-4" />
            Review progress
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {providerContext ? (
            <div className="mx-auto max-w-3xl">
              <ProviderCredentialSetup
                actionLabel={providerActionLabel}
                onCancel={() => setProviderContext(null)}
                onComplete={() => {
                  if (providerContext === 'recommendation') {
                    void requestAiRecommendationMutation.mutateAsync();
                  } else if (providerContext === 'overview') {
                    setProviderContext(null);
                    void generateOverviewMutation.mutateAsync();
                  } else {
                    setProviderContext(null);
                  }
                }}
              />
            </div>
          ) : (
            <>
              {setupState.stage === 'source' && (
                <SourceStep
                  onConnect={(payload) => void connectSource(payload)}
                  onSkip={(payload) =>
                    void connectSource({
                      type: 'none',
                      projectName: payload.projectName,
                      projectContext: payload.projectContext,
                    })
                  }
                />
              )}

              {setupState.stage === 'analysis' && (
                <AnalysisFactsStep
                  analysisStatus={analysisStatusQuery.data || null}
                  analysisResults={analysisResultsQuery.data}
                  projectOverviewDraft={projectOverviewDraft}
                  overviewQuestions={overviewQuestions}
                  hasActiveProvider={hasActiveProvider}
                  isGeneratingOverview={generateOverviewMutation.isPending}
                  onOverviewChange={setProjectOverviewDraft}
                  onGenerateOverview={() => {
                    if (!hasActiveProvider) {
                      setProviderContext('overview');
                      return;
                    }
                    void generateOverviewMutation.mutateAsync();
                  }}
                  onSaveOverviewAndContinue={() => void saveOverviewAndContinue()}
                  onConfigureProvider={() => setProviderContext('overview')}
                  onContinue={() => void continueFromAnalysis()}
                  onRetry={() => void analysisStatusQuery.refetch()}
                />
              )}

              {setupState.stage === 'template-selection' && (
                <TemplateRecommendationStep
                  recommendations={recommendations}
                  availableTemplates={templates}
                  hasActiveProvider={hasActiveProvider}
                  sourceType={setupState.sourceType}
                  requestingAiRecommendations={requestAiRecommendationMutation.isPending}
                  onSelectTemplate={(templateId, recommendation) =>
                    void selectTemplate(templateId, recommendation)
                  }
                  onCreateCustom={() => void createCustomOutline()}
                  onConfigureProvider={() => setProviderContext('recommendation')}
                  onRequestAiRecommendations={() => {
                    if (!hasActiveProvider) {
                      setProviderContext('recommendation');
                      return;
                    }
                    void requestAiRecommendationMutation.mutateAsync();
                  }}
                />
              )}

              {setupState.stage === 'outline-review' && outlineProposal && (
                <OutlineReviewStep
                  proposal={outlineProposal as OutlineProposal}
                  clarificationRequests={clarificationRequests}
                  onApprove={(outline) => void approveOutline(outline)}
                  onSkipClarification={(requestId) => void skipClarification(requestId)}
                />
              )}

              {setupState.stage === 'outline-review' && !outlineProposal && (
                <div className="mx-auto max-w-3xl">
                  <Notice variant="warning" title="Outline proposal is still loading">
                    Return to Template selection if this state persists, then choose the Template again.
                  </Notice>
                </div>
              )}

              {setupState.stage === 'generation-mode' && (
                <GenerationChoiceStep
                  onDemandEstimate={onDemandEstimateQuery.data}
                  completeEstimate={completeEstimateQuery.data}
                  hasActiveProvider={hasActiveProvider}
                  onConfigureProvider={() => setProviderContext('generation')}
                  onChoose={(mode) => void chooseGeneration(mode)}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:block">
        <SetupSummaryRail state={setupState} />
      </div>

      {showRailDrawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Setup summary">
          <button
            type="button"
            className="absolute inset-0 bg-overlay-backdrop"
            onClick={() => setShowRailDrawer(false)}
            aria-label="Close review drawer"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-border bg-canvas">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-body font-semibold text-text-primary">Review progress</h2>
              <button
                type="button"
                onClick={() => setShowRailDrawer(false)}
                className="rounded-md p-1 text-text-muted transition-colors hover:text-text-primary"
                aria-label="Close review drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
              <SetupSummaryRail state={setupState} isDrawer />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
