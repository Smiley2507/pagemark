import type { AnalysisStatus } from '@/types';
import type {
  DocumentSetupStage,
  OutlineProposalBasis,
  PersistedDocumentSetupStage,
  SourceConnectionType,
  TemplateRecommendation,
} from '@/types/document-setup';

export type GenerationChoiceMode = 'on-demand' | 'complete' | 'manual';

export function sourceTypeFromProject(
  sourceType?: string,
  gitRepoUrl?: string,
): SourceConnectionType | undefined {
  if (sourceType === 'scratch') return 'none';
  if (sourceType === 'zip') return 'zip';
  if (gitRepoUrl?.includes('github.com')) return 'github-oauth';
  if (gitRepoUrl) return 'git-url';
  return undefined;
}

export function describeSource(
  sourceType?: SourceConnectionType,
  repoFullName?: string,
): { label?: string; limitations: string[] } {
  if (sourceType === 'github-oauth') {
    return {
      label: repoFullName || 'GitHub repository',
      limitations: [],
    };
  }
  if (sourceType === 'git-url') {
    return {
      label: 'Repository URL fallback',
      limitations: ['Automatic synchronization is weaker than the GitHub source path.'],
    };
  }
  if (sourceType === 'zip') {
    return {
      label: 'ZIP snapshot',
      limitations: ['Automatic synchronization and freshness updates are unavailable for ZIP Projects.'],
    };
  }
  if (sourceType === 'none') {
    return {
      label: 'No source connected',
      limitations: [
        'Analysis-grounded recommendations and repository evidence remain disabled until source is connected.',
      ],
    };
  }
  return { limitations: [] };
}

export function deriveUiStage(
  persistedStage: PersistedDocumentSetupStage,
  sourceType?: SourceConnectionType,
  analysisStatus?: AnalysisStatus | null,
): DocumentSetupStage {
  if (persistedStage === 'template_selection') return 'template-selection';
  if (persistedStage === 'outline_review') return 'outline-review';
  if (persistedStage === 'generation_mode') return 'generation-mode';
  if (persistedStage === 'editor_ready') return 'editor-ready';
  if (sourceType && sourceType !== 'none') {
    if (!analysisStatus || analysisStatus.status === 'pending' || analysisStatus.status === 'running') {
      return 'analysis';
    }
    if (analysisStatus.status === 'completed' || analysisStatus.status === 'failed') {
      return 'analysis';
    }
  }
  return 'source';
}

export function outlineBasisForRecommendation(
  recommendation?: Pick<TemplateRecommendation, 'basis'>,
): OutlineProposalBasis {
  return recommendation?.basis === 'ai_personalized' ? 'analysis_adapted' : 'template';
}

export function shouldRequestAiRecommendations(args: {
  sourceType?: SourceConnectionType;
  hasActiveProvider: boolean;
  aiRecommendationCount: number;
}): boolean {
  return args.sourceType !== 'none' && args.hasActiveProvider && args.aiRecommendationCount === 0;
}

export function initialGenerationMode(hasActiveProvider: boolean): GenerationChoiceMode {
  return hasActiveProvider ? 'on-demand' : 'manual';
}

export function generationModeRequiresProvider(mode: GenerationChoiceMode): boolean {
  return mode !== 'manual';
}
