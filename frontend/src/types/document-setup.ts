export type DocumentSetupStage =
  | 'source'
  | 'analysis'
  | 'template-selection'
  | 'outline-review'
  | 'generation-mode'
  | 'editor-ready';

export type PersistedDocumentSetupStage =
  | 'purpose'
  | 'template_selection'
  | 'outline_review'
  | 'generation_mode'
  | 'editor_ready';

export type SourceConnectionType = 'github-oauth' | 'git-url' | 'zip' | 'none';

export type RecommendationBasis =
  | 'rule_based'
  | 'ai_personalized'
  | 'custom_outline_seeded';

export type OutlineProposalBasis =
  | 'template'
  | 'custom_outline'
  | 'analysis_adapted';

export interface SetupSectionEvidence {
  type: string;
  path?: string;
  description: string;
}

export interface SetupSectionSummary {
  heading: string;
  description?: string;
  purpose?: string;
  evidence?: SetupSectionEvidence[];
  order_index: number;
}

export interface DocumentSetupState {
  projectId?: number;
  documentId?: number;
  stage: DocumentSetupStage;
  sourceType?: SourceConnectionType;
  projectName?: string;
  projectContext?: string;
  sourceLabel?: string;
  sourceLimitations?: string[];
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
  analysisId?: number;
  analysisComplete: boolean;
  analysisPartial: boolean;
  selectedTemplateId?: number;
  selectedTemplateName?: string;
  customOutline?: boolean;
  outlineProposalId?: number;
  outlineApproved: boolean;
  generationMode?: 'on-demand' | 'complete' | 'manual';
  providerConfigured: boolean;
  analysisUnavailableReason?: string;
  ruleBasedRecommendationCount?: number;
  aiRecommendationCount?: number;
  lastCompletedStep?: DocumentSetupStage;
}

export interface SetupDocument {
  id: number;
  project_id: number;
  title: string;
  setup_stage: PersistedDocumentSetupStage;
  status: string;
  freshness: string;
  progress: {
    total_sections: number;
    reviewed_sections: number;
    generated_sections: number;
    pct: number;
  };
  template?: {
    id: number;
    name: string;
    description?: string;
    recommended_print_profile?: Record<string, unknown>;
    structure_guidance?: Record<string, unknown>;
    section_generation_guidance?: Record<string, unknown>;
  };
  template_id?: number;
  purpose?: string;
  audience?: string;
  context?: string;
  print_profile?: Record<string, unknown>;
  export_settings?: Record<string, unknown>;
  custom_outline_metadata?: Record<string, unknown>;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentSetupStateResponse {
  document: SetupDocument;
  recommendations: TemplateRecommendation[];
  outline_proposals: OutlineProposal[];
  clarification_requests: ClarificationRequest[];
  sections: SetupSectionRecord[];
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
  basis: OutlineProposalBasis;
  status: 'draft' | 'approved' | 'superseded';
  outline?: SetupSectionSummary[];
  outline_json: SetupSectionSummary[];
  explanation?: string | Record<string, unknown>;
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
  confidence_tradeoff?: string;
  skippable: boolean;
  answered_at?: string;
  answer?: string;
  skipped_at?: string;
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

export interface SetupSectionRecord {
  id: number;
  heading: string;
  order_index: number;
  content_lifecycle: string;
  status: string;
}
