// Types for the first-Document journey (Phase 8)

export type DocumentSetupStage =
  | 'source'
  | 'analysis'
  | 'template-selection'
  | 'outline-review'
  | 'generation-mode'
  | 'editor-ready';

export type SourceConnectionType = 'github-oauth' | 'git-url' | 'zip' | 'none';

export type RecommendationBasis = 'rule_based' | 'ai_personalized' | 'custom_outline_seeded';

export interface DocumentSetupState {
  projectId?: number;
  documentId?: number;
  stage: DocumentSetupStage;
  sourceType?: SourceConnectionType;
  repoMetadata?: {
    owner: string;
    repo: string;
    branch: string;
    provider: 'github';
    fullName: string;
    visibility: 'public' | 'private';
    language?: string;
    lastUpdated?: string;
  };
  projectName?: string;
  projectContext?: string;
  analysisId?: number;
  analysisComplete: boolean;
  analysisPartial: boolean;
  selectedTemplateId?: number;
  customOutline?: boolean;
  outlineProposalId?: number;
  outlineApproved: boolean;
  generationMode?: 'on-demand' | 'complete';
  providerConfigured: boolean;
}

export interface TemplateRecommendation {
  id: number;
  template_id?: number;
  document_id: number;
  analysis_id?: number;
  basis: RecommendationBasis;
  score: number;
  explanation: string;
  supporting_facts?: Record<string, unknown>;
  provider_usage?: {
    tokens: number;
    cost: number;
  };
  template?: {
    id: number;
    name: string;
    description?: string;
    category: string;
    purpose?: string;
    intended_audience?: string;
    expected_outcome?: string;
    sections_preview?: Array<{
      heading: string;
      description?: string;
    }>;
  };
}

export interface OutlineProposal {
  id: number;
  document_id: number;
  analysis_id?: number;
  basis: RecommendationBasis;
  status: 'draft' | 'approved' | 'superseded';
  outline_json: Array<{
    heading: string;
    description?: string;
    purpose?: string;
    evidence?: Array<{
      type: string;
      path?: string;
      description: string;
    }>;
    order_index: number;
  }>;
  explanation?: string;
  approved_at?: string;
  approved_by?: number;
}

export interface ClarificationRequest {
  id: number;
  document_id: number;
  section_heading?: string;
  question: string;
  context: string;
  affected_sections: string[];
  skippable: boolean;
  answered_at?: string;
  answer?: string;
}

export interface GenerationEstimate {
  mode: string;
  provider: string | null;
  model: string | null;
  relative_usage: string;
  estimated_prompt_tokens: number;
  estimated_completion_tokens: number;
  estimated_cost: number;
  uncertainty: string;
  pricing_note: string;
  section_breakdown?: Array<{
    section_id: number;
    heading: string;
    estimated_prompt_tokens: number;
    estimated_completion_tokens: number;
    estimated_cost: number;
    uncertainty: string;
  }>;
  // Legacy fields for backwards compatibility
  estimated_tokens?: number;
  approximate_cost?: number;
  currency?: string;
}

export interface AnalysisFact {
  category: 'languages' | 'file-tree' | 'endpoints' | 'complexity' | 'dependencies';
  status: 'pending' | 'running' | 'complete' | 'failed' | 'unavailable';
  summary?: string;
  data?: unknown;
  error?: string;
}
