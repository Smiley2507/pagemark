import { describe, expect, it } from 'vitest';
import {
  deriveUiStage,
  describeSource,
  generationModeRequiresProvider,
  initialGenerationMode,
  outlineBasisForRecommendation,
  shouldRequestAiRecommendations,
  sourceTypeFromProject,
} from '@/lib/document-setup-flow';
import type { AnalysisStatus } from '@/types';

describe('document setup lifecycle helpers', () => {
  it('maps Project source data into setup source types', () => {
    expect(sourceTypeFromProject('scratch')).toBe('none');
    expect(sourceTypeFromProject('zip')).toBe('zip');
    expect(sourceTypeFromProject('git', 'https://github.com/acme/api')).toBe('github-oauth');
    expect(sourceTypeFromProject('git', 'https://gitlab.com/acme/api')).toBe('git-url');
    expect(sourceTypeFromProject('git')).toBeUndefined();
  });

  it('describes source-less setup as analysis-limited', () => {
    const summary = describeSource('none');

    expect(summary.label).toBe('No source connected');
    expect(summary.limitations[0]).toContain('Analysis-grounded recommendations');
  });

  it('keeps source-backed purpose-stage Documents in analysis until analysis is resolved', () => {
    const running = { status: 'running' } as AnalysisStatus;
    const completed = { status: 'completed' } as AnalysisStatus;
    const failed = { status: 'failed' } as AnalysisStatus;

    expect(deriveUiStage('purpose', 'github-oauth', null)).toBe('analysis');
    expect(deriveUiStage('purpose', 'github-oauth', running)).toBe('analysis');
    expect(deriveUiStage('purpose', 'github-oauth', completed)).toBe('analysis');
    expect(deriveUiStage('purpose', 'github-oauth', failed)).toBe('analysis');
  });

  it('resumes persisted setup stages without sending source-less Documents through analysis', () => {
    expect(deriveUiStage('purpose', 'none')).toBe('source');
    expect(deriveUiStage('template_selection', 'none')).toBe('template-selection');
    expect(deriveUiStage('outline_review', 'github-oauth')).toBe('outline-review');
    expect(deriveUiStage('generation_mode', 'github-oauth')).toBe('generation-mode');
    expect(deriveUiStage('editor_ready', 'github-oauth')).toBe('editor-ready');
  });

  it('uses provider-backed AdaptTemplate only for AI-personalized recommendations', () => {
    expect(outlineBasisForRecommendation({ basis: 'ai_personalized' })).toBe('analysis_adapted');
    expect(outlineBasisForRecommendation({ basis: 'rule_based' })).toBe('template');
    expect(outlineBasisForRecommendation()).toBe('template');
  });

  it('requests AI recommendations only when source and provider are both available', () => {
    expect(shouldRequestAiRecommendations({
      sourceType: 'github-oauth',
      hasActiveProvider: true,
      aiRecommendationCount: 0,
    })).toBe(true);
    expect(shouldRequestAiRecommendations({
      sourceType: 'none',
      hasActiveProvider: true,
      aiRecommendationCount: 0,
    })).toBe(false);
    expect(shouldRequestAiRecommendations({
      sourceType: 'github-oauth',
      hasActiveProvider: false,
      aiRecommendationCount: 0,
    })).toBe(false);
    expect(shouldRequestAiRecommendations({
      sourceType: 'github-oauth',
      hasActiveProvider: true,
      aiRecommendationCount: 1,
    })).toBe(false);
  });
});

describe('generation choice defaults', () => {
  it('defaults to on-demand generation when a provider exists', () => {
    expect(initialGenerationMode(true)).toBe('on-demand');
    expect(generationModeRequiresProvider('on-demand')).toBe(true);
  });

  it('defaults to manual editor entry when no provider exists', () => {
    expect(initialGenerationMode(false)).toBe('manual');
    expect(generationModeRequiresProvider('manual')).toBe(false);
  });
});
