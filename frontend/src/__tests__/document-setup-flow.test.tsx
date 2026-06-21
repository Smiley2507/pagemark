import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GenerationChoiceStep } from '@/components/document-setup/GenerationChoiceStep';
import { OutlineReviewStep } from '@/components/document-setup/OutlineReviewStep';
import { TemplateRecommendationStep } from '@/components/document-setup/TemplateRecommendationStep';
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
import type { OutlineProposal, TemplateRecommendation } from '@/types/document-setup';

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

  it('moves legacy purpose-stage Documents into template selection', () => {
    const running = { status: 'running' } as AnalysisStatus;
    const completed = { status: 'completed' } as AnalysisStatus;
    const failed = { status: 'failed' } as AnalysisStatus;

    expect(deriveUiStage('purpose', 'github-oauth', null)).toBe('template-selection');
    expect(deriveUiStage('purpose', 'github-oauth', running)).toBe('template-selection');
    expect(deriveUiStage('purpose', 'github-oauth', completed)).toBe('template-selection');
    expect(deriveUiStage('purpose', 'github-oauth', failed)).toBe('template-selection');
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
    const onChoose = vi.fn();

    render(<GenerationChoiceStep hasActiveProvider onChoose={onChoose} />);

    fireEvent.click(screen.getByRole('button', { name: /start generation and enter editor/i }));

    expect(initialGenerationMode(true)).toBe('on-demand');
    expect(generationModeRequiresProvider('on-demand')).toBe(true);
    expect(onChoose).toHaveBeenCalledWith('on-demand');
    expect(screen.getByRole('button', { name: /generate approved sections/i })).toHaveClass('border-interaction');
    expect(within(screen.getByRole('button', { name: /generate approved sections/i })).getByText('Recommended')).toBeInTheDocument();
  });

  it('defaults to manual editor entry when no provider exists', () => {
    const onChoose = vi.fn();

    render(<GenerationChoiceStep hasActiveProvider={false} onChoose={onChoose} />);

    fireEvent.click(screen.getByRole('button', { name: /enter editor now/i }));

    expect(initialGenerationMode(false)).toBe('manual');
    expect(generationModeRequiresProvider('manual')).toBe(false);
    expect(onChoose).toHaveBeenCalledWith('manual');
    expect(screen.getByRole('button', { name: /enter editor without generation/i })).toHaveClass('border-interaction');
  });
});

describe('template recommendation setup UI', () => {
  const ruleRecommendation: TemplateRecommendation = {
    id: 1,
    document_id: 7,
    template_id: 11,
    basis: 'rule_based',
    score: 0.82,
    explanation: 'Matches repository endpoints.',
    template: {
      id: 11,
      name: 'API Reference',
      description: 'Document API endpoints.',
      category: 'Technical',
      sections_preview: [{ heading: 'Overview' }, { heading: 'Endpoints' }],
    },
  };

  const aiRecommendation: TemplateRecommendation = {
    ...ruleRecommendation,
    id: 2,
    template_id: 12,
    basis: 'ai_personalized',
    explanation: 'Adapted from analysis facts.',
    template: {
      id: 12,
      name: 'Maintainer Guide',
      description: 'Document operational workflows.',
      category: 'Technical',
      sections_preview: [{ heading: 'Operations' }],
    },
  };

  it('keeps source-less setup on the compact browse path', () => {
    render(
      <TemplateRecommendationStep
        recommendations={[ruleRecommendation]}
        sourceType="none"
        onSelectTemplate={vi.fn()}
        onCreateCustom={vi.fn()}
      />,
    );

    expect(screen.getByText('No source connected')).toBeInTheDocument();
    expect(screen.getByText('Browse all templates')).toBeInTheDocument();
  });

  it('keeps the template picker compact when source exists', () => {
    render(
      <TemplateRecommendationStep
        recommendations={[ruleRecommendation]}
        sourceType="github-oauth"
        onSelectTemplate={vi.fn()}
        onCreateCustom={vi.fn()}
      />,
    );

    expect(screen.queryByText('No source connected')).not.toBeInTheDocument();
    expect(screen.getByText('Browse all templates')).toBeInTheDocument();
    expect(screen.queryByText('Configure provider for AI recommendation')).not.toBeInTheDocument();
  });

  it('selects AI-personalized recommendations through the template callback', () => {
    const onSelectTemplate = vi.fn();

    render(
      <TemplateRecommendationStep
        recommendations={[ruleRecommendation, aiRecommendation]}
        hasActiveProvider
        sourceType="github-oauth"
        onSelectTemplate={onSelectTemplate}
        onCreateCustom={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /maintainer guide/i }));

    expect(onSelectTemplate).toHaveBeenCalledWith(12, aiRecommendation);
  });
});

describe('outline review setup UI', () => {
  function proposal(): OutlineProposal {
    return {
      id: 21,
      document_id: 7,
      basis: 'template',
      status: 'draft',
      outline_json: [
        {
          heading: 'Overview',
          description: 'Original overview guidance',
          purpose: 'Orient the reader',
          order_index: 0,
        },
        {
          heading: 'Endpoints',
          description: 'Endpoint guidance',
          purpose: 'List API behavior',
          order_index: 1,
        },
      ],
    };
  }

  it('approves edited outline sections with reindexed order', () => {
    const onApprove = vi.fn();

    render(
      <OutlineReviewStep
        proposal={proposal()}
        onApprove={onApprove}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /overview/i }));
    fireEvent.change(screen.getByLabelText('Heading'), {
      target: { value: 'System Overview' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /move section down/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /approve outline/i }));

    expect(onApprove).toHaveBeenCalledWith([
      expect.objectContaining({ heading: 'Endpoints', order_index: 0 }),
      expect.objectContaining({ heading: 'System Overview', order_index: 1 }),
    ]);
  });

  it('adds and removes sections before approval', () => {
    const onApprove = vi.fn();

    render(
      <OutlineReviewStep
        proposal={proposal()}
        onApprove={onApprove}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^add section$/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /remove section/i })[1]);
    fireEvent.click(screen.getByRole('button', { name: /approve outline/i }));

    expect(onApprove).toHaveBeenCalledWith([
      expect.objectContaining({ heading: 'Overview', order_index: 0 }),
      expect.objectContaining({ heading: 'New Section', order_index: 1 }),
    ]);
  });
});
