import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { toast } from 'sonner';

import { projectsApi } from '@/api/projects';
import { analysisApi } from '@/api/analysis';
import { aiCredentialsApi } from '@/api/aiCredentials';
import { documentsApi } from '@/api/documents';

import { SetupSummaryRail } from '@/components/document-setup/SetupSummaryRail';
import { SourceStep } from '@/components/document-setup/SourceStep';
import { AnalysisFactsStep } from '@/components/document-setup/AnalysisFactsStep';
import { TemplateRecommendationStep } from '@/components/document-setup/TemplateRecommendationStep';
import { OutlineReviewStep } from '@/components/document-setup/OutlineReviewStep';
import { GenerationChoiceStep } from '@/components/document-setup/GenerationChoiceStep';
import { ProviderCredentialSetup } from '@/components/document-setup/ProviderCredentialSetup';
import { Button } from '@/components/ui/button';

import type { DocumentSetupState, DocumentSetupStage } from '@/types/document-setup';
import type { AnalysisStatus, AnalysisResults, Template } from '@/types';

export function DocumentSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeProjectId = searchParams.get('projectId');

  const [showRailDrawer, setShowRailDrawer] = useState(false);
  const [showProviderSetup, setShowProviderSetup] = useState(false);
  
  const [setupState, setSetupState] = useState<DocumentSetupState>({
    stage: 'source',
    analysisComplete: false,
    analysisPartial: false,
    outlineApproved: false,
    providerConfigured: false,
  });

  // Check if user has active provider
  const { data: credentialsData } = useQuery({
    queryKey: ['ai-credentials'],
    queryFn: () => aiCredentialsApi.list(),
  });

  const hasActiveProvider = credentialsData?.has_active ?? false;

  // Poll analysis status if in analysis stage
  const { data: analysisStatus, refetch: refetchAnalysis } = useQuery({
    queryKey: ['analysis-status', setupState.projectId],
    queryFn: () => analysisApi.getAnalysisStatus(setupState.projectId!),
    enabled: !!setupState.projectId && setupState.stage === 'analysis',
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 2000 : false;
    },
  });

  const { data: analysisResults } = useQuery({
    queryKey: ['analysis-results', setupState.projectId],
    queryFn: () => analysisApi.getAnalysisResults(setupState.projectId!),
    enabled: !!setupState.projectId && analysisStatus?.status === 'completed',
  });

  // Fetch available templates
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => projectsApi.getTemplates(),
    enabled: setupState.stage === 'template-selection',
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      source_type: 'zip' | 'git' | 'scratch';
      git_repo_url?: string;
      git_branch?: string;
    }) => projectsApi.createProject(data),
    onSuccess: (project) => {
      setSetupState((prev) => ({
        ...prev,
        projectId: project.id,
        projectName: project.name,
      }));
    },
    onError: (error: Error) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });

  // Monitor analysis completion
  useEffect(() => {
    if (analysisStatus?.status === 'completed') {
      setSetupState((prev) => ({
        ...prev,
        analysisComplete: true,
        analysisId: analysisStatus.id,
        stage: 'template-selection',
      }));
    } else if (analysisStatus?.status === 'failed') {
      toast.error('Analysis failed. You can retry or continue without analysis.');
    }
  }, [analysisStatus]);

  // Update provider status in state
  useEffect(() => {
    setSetupState((prev) => ({
      ...prev,
      providerConfigured: hasActiveProvider,
    }));
  }, [hasActiveProvider]);

  const handleSourceConnect = async (data: {
    type: 'github-oauth' | 'git-url' | 'zip' | 'none';
    repoData?: {
      owner: string;
      repo: string;
      branch: string;
      provider: 'github';
      fullName: string;
      visibility: 'public' | 'private';
      language?: string;
    };
    gitUrl?: string;
    gitBranch?: string;
    zipFile?: File;
  }) => {
    try {
      let projectData: Parameters<typeof projectsApi.createProject>[0];

      if (data.type === 'github-oauth' && data.repoData) {
        const repoMeta = data.repoData;
        projectData = {
          name: repoMeta.fullName,
          source_type: 'git',
          git_repo_url: `https://github.com/${repoMeta.fullName}`,
          git_branch: repoMeta.branch,
        };

        const project = await createProjectMutation.mutateAsync(projectData);

        // Connect via OAuth
        await analysisApi.connectGitOAuth(project.id, {
          owner: repoMeta.owner,
          repo: repoMeta.repo,
          branch: repoMeta.branch,
          provider: 'github',
        });

        setSetupState((prev) => ({
          ...prev,
          sourceType: 'github-oauth',
          repoMetadata: repoMeta,
          stage: 'analysis',
        }));
      } else if (data.type === 'git-url' && data.gitUrl) {
        projectData = {
          name: data.gitUrl.split('/').pop()?.replace('.git', '') || 'New Project',
          source_type: 'git',
          git_repo_url: data.gitUrl,
          git_branch: data.gitBranch || 'main',
        };

        const project = await createProjectMutation.mutateAsync(projectData);

        await analysisApi.connectGitUrl(project.id, {
          repo_url: data.gitUrl,
          branch: data.gitBranch || 'main',
        });

        setSetupState((prev) => ({
          ...prev,
          sourceType: 'git-url',
          stage: 'analysis',
        }));
      } else if (data.type === 'zip' && data.zipFile) {
        projectData = {
          name: data.zipFile.name.replace('.zip', ''),
          source_type: 'zip',
        };

        const project = await createProjectMutation.mutateAsync(projectData);

        await analysisApi.uploadZip(project.id, data.zipFile);

        setSetupState((prev) => ({
          ...prev,
          sourceType: 'zip',
          stage: 'analysis',
        }));
      } else {
        // No source
        projectData = {
          name: 'New Documentation Project',
          source_type: 'scratch',
        };

        await createProjectMutation.mutateAsync(projectData);

        setSetupState((prev) => ({
          ...prev,
          sourceType: 'none',
          stage: 'template-selection',
        }));
      }
    } catch (error) {
      console.error('Failed to connect source:', error);
      toast.error('Failed to connect source');
    }
  };

  const handleSourceSkip = async () => {
    const projectData: Parameters<typeof projectsApi.createProject>[0] = {
      name: 'New Documentation Project',
      source_type: 'scratch',
    };

    await createProjectMutation.mutateAsync(projectData);

    setSetupState((prev) => ({
      ...prev,
      sourceType: 'none',
      stage: 'template-selection',
    }));
  };

  const handleAnalysisContinue = () => {
    setSetupState((prev) => ({
      ...prev,
      stage: 'template-selection',
    }));
  };

  const handleSelectTemplate = (templateId: number) => {
    setSetupState((prev) => ({
      ...prev,
      selectedTemplateId: templateId,
      customOutline: false,
      stage: 'outline-review',
    }));
  };

  const handleCreateCustom = () => {
    setSetupState((prev) => ({
      ...prev,
      customOutline: true,
      stage: 'outline-review',
    }));
  };

  const approveMutation = useMutation({
    mutationFn: (proposalId: number) =>
      documentsApi.approveOutlineProposal(
        setupState.projectId!,
        setupState.documentId!,
        proposalId,
      ),
    onSuccess: () => {
      setSetupState((prev) => ({
        ...prev,
        outlineApproved: true,
        stage: 'generation-mode',
      }));
      toast.success('Outline approved! Sections have been created.');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleApproveOutline = (outline: unknown[]) => {
    // Get the current proposal id to approve
    const proposalId = currentProposal?.id;
    if (proposalId) {
      approveMutation.mutate(proposalId);
    } else {
      // Fallback: advance stage without API (for documents without proposals)
      setSetupState((prev) => ({
        ...prev,
        outlineApproved: true,
        stage: 'generation-mode',
      }));
    }
  };

  const handleProviderComplete = () => {
    setShowProviderSetup(false);
    setSetupState((prev) => ({
      ...prev,
      providerConfigured: true,
    }));
  };

  // Fetch template recommendations for the document
  const { data: recommendationsData, refetch: refetchRecommendations } = useQuery({
    queryKey: ['template-recommendations', setupState.projectId, setupState.documentId],
    queryFn: () => documentsApi.getTemplateRecommendations(setupState.projectId!, setupState.documentId!),
    enabled: !!setupState.projectId && !!setupState.documentId && setupState.stage === 'template-selection',
  });

  // Create rule-based recommendations when entering template selection
  const createRecommendationsMutation = useMutation({
    mutationFn: () =>
      documentsApi.createTemplateRecommendations(
        setupState.projectId!,
        setupState.documentId!,
        'rule_based',
        false,
      ),
    onSuccess: () => {
      refetchRecommendations();
    },
    onError: () => {
      // Silently handle - we may be offline but still want to show UI
    },
  });

  // Trigger recommendation creation when stage reaches template-selection
  const prevStageRef = useRef(setupState.stage);
  React.useEffect(() => {
    if (
      setupState.stage === 'template-selection' &&
      prevStageRef.current !== 'template-selection' &&
      setupState.projectId &&
      setupState.documentId
    ) {
      createRecommendationsMutation.mutate();
    }
    prevStageRef.current = setupState.stage;
  }, [setupState.stage, setupState.projectId, setupState.documentId]);

  // Fetch outline proposals for the document
  const { data: proposalsData } = useQuery({
    queryKey: ['outline-proposals', setupState.projectId, setupState.documentId],
    queryFn: () => documentsApi.getOutlineProposals(setupState.projectId!, setupState.documentId!),
    enabled: !!setupState.projectId && !!setupState.documentId && setupState.stage === 'outline-review',
  });

  const recommendations = recommendationsData?.recommendations || [];
  const currentProposal = proposalsData?.proposals?.[0] || null;

  // Fetch generation estimates when stage reaches generation-mode
  const { data: onDemandEstimate } = useQuery({
    queryKey: ['generation-estimate', 'on-demand', setupState.projectId, setupState.documentId],
    queryFn: () =>
      documentsApi.estimateGeneration(
        setupState.projectId!,
        setupState.documentId!,
        'on-demand',
      ),
    enabled: !!setupState.projectId && !!setupState.documentId && setupState.stage === 'generation-mode',
  });

  const { data: completeEstimate } = useQuery({
    queryKey: ['generation-estimate', 'complete', setupState.projectId, setupState.documentId],
    queryFn: () =>
      documentsApi.estimateGeneration(
        setupState.projectId!,
        setupState.documentId!,
        'complete',
      ),
    enabled: !!setupState.projectId && !!setupState.documentId && setupState.stage === 'generation-mode',
  });

  // Create generation run when user chooses mode
  const createRunMutation = useMutation({
    mutationFn: (mode: 'on-demand' | 'complete') =>
      documentsApi.createGenerationRun(
        setupState.projectId!,
        setupState.documentId!,
        mode,
      ),
    onSuccess: (data, mode) => {
      setSetupState((prev) => ({
        ...prev,
        generationMode: mode,
        stage: 'editor-ready',
      }));
      if (setupState.projectId) {
        navigate(`/editor/${setupState.projectId}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleChooseGeneration = (mode: 'on-demand' | 'complete') => {
    createRunMutation.mutate(mode);
  };

  return (
    <div className="flex h-screen bg-workspace overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full p-8">
          {/* Mobile drawer toggle */}
          <div className="lg:hidden mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRailDrawer(true)}
              className="gap-2"
            >
              <Menu className="h-4 w-4" />
              View Progress
            </Button>
          </div>

          {showProviderSetup ? (
            <div className="max-w-3xl">
              <ProviderCredentialSetup
                onComplete={handleProviderComplete}
                onCancel={() => setShowProviderSetup(false)}
              />
            </div>
          ) : (
            <>
              {setupState.stage === 'source' && (
                <SourceStep onConnect={handleSourceConnect} onSkip={handleSourceSkip} />
              )}

              {setupState.stage === 'analysis' && (
                <AnalysisFactsStep
                  analysisStatus={analysisStatus || null}
                  analysisResults={analysisResults}
                  onContinue={handleAnalysisContinue}
                  onRetry={() => refetchAnalysis()}
                />
              )}

              {setupState.stage === 'template-selection' && (
                <TemplateRecommendationStep
                  recommendations={recommendations}
                  availableTemplates={templates}
                  hasActiveProvider={hasActiveProvider}
                  onSelectTemplate={handleSelectTemplate}
                  onCreateCustom={handleCreateCustom}
                  onConfigureProvider={() => setShowProviderSetup(true)}
                />
              )}

              {setupState.stage === 'outline-review' && currentProposal && (
                <OutlineReviewStep
                  proposal={currentProposal}
                  clarificationRequests={[]}
                  onApprove={handleApproveOutline}
                />
              )}

              {setupState.stage === 'generation-mode' && (
                <GenerationChoiceStep
                  onDemandEstimate={onDemandEstimate}
                  completeEstimate={completeEstimate}
                  hasActiveProvider={hasActiveProvider}
                  onChoose={handleChooseGeneration}
                  onConfigureProvider={() => setShowProviderSetup(true)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Desktop Summary Rail */}
      <div className="hidden lg:block">
        <SetupSummaryRail state={setupState} />
      </div>

      {/* Mobile Summary Drawer */}
      {showRailDrawer && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setShowRailDrawer(false)}
        >
          <div className="absolute inset-0 bg-overlay-backdrop" />
          <div
            className="absolute right-0 top-0 bottom-0 w-80 bg-panel shadow-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-separator">
              <h3 className="text-body font-semibold text-text-primary">Setup Progress</h3>
              <button
                onClick={() => setShowRailDrawer(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto" style={{ height: 'calc(100vh - 60px)' }}>
              <SetupSummaryRail state={setupState} isDrawer />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
