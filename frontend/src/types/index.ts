export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  is_verified: boolean;
  is_first_login?: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  org_id: number;
  created_by: number;
  name: string;
  description?: string;
  status: "pending" | "draft" | "finalized";
  completion_pct: number;
  language?: string;
  source_type: "zip" | "git" | "scratch";
  source_provider?: string;
  source_owner?: string;
  source_repository?: string;
  selected_branch?: string;
  default_branch?: string;
  source_visibility?: string;
  last_synced_commit?: string;
  source_metadata?: Record<string, unknown>;
  tags: string[];
  starred: boolean;
  documents_count?: number;
  sections_count?: number;
  active_generation?: boolean;
  sections_needing_input?: number;
  review_state?: string;
  freshness_state?: string;
  recent_activity_at?: string;
  context_md?: string;
  export_settings?: ExportSettings;
  webhook_secret?: string;
  webhook_id?: number;
  created_at: string;
  updated_at: string;
}

export interface GitRepo {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
  language?: string;
  stars_count: number;
  html_url: string;
}

export interface GitBranch {
  name: string;
  is_default: boolean;
}

export interface JobResponse {
  job_id: string;
  analysis_id: number;
}

export type AnalysisStepState =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped";

export interface AnalysisStepItem {
  number: number;
  name: string;
  status: AnalysisStepState;
}

export interface AnalysisStatus {
  id: number;
  project_id: number;
  status: "pending" | "running" | "completed" | "failed";
  current_step?: string;
  step_number: number;
  step_detail?: string;
  total_steps: number;
  source_type: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  steps?: AnalysisStepItem[];
  elapsed_seconds?: number;
  outline_applied?: boolean;
  outline_skipped?: boolean;
  outline_skip_reason?: string;
  facts?: Record<string, { available: boolean; unavailable_reason?: string | null }>;
  unavailable_facts?: unknown[];
  partial_failures?: unknown[];
  effective_exclusions?: unknown[];
  source_metadata?: Record<string, unknown>;
}

export interface AiContextPackage {
  project: {
    id: number;
    name: string;
    description?: string | null;
    source_type: "zip" | "git" | "scratch";
    source_provider?: string | null;
    source_repository?: string | null;
    selected_branch?: string | null;
    last_synced_commit?: string | null;
  };
  project_brief?: string | null;
  analysis_summary: {
    id?: number | null;
    status: string;
    is_current: boolean;
    completed_at?: string | null;
    source_commit?: string | null;
    total_files: number;
    languages: string[];
    frameworks: string[];
    endpoint_count: number;
    dependency_count: number;
    largest_files: unknown[];
  };
  source_connection: Record<string, unknown>;
  facts: Record<string, unknown>;
  unavailable_facts: unknown[];
  partial_failures: unknown[];
  effective_exclusions: unknown[];
  context_files_preview: { path: string; preview: string }[];
  grounding_warnings: string[];
}

export interface AiModelOption {
  id: string;
  label: string;
}

export interface AiProviderCatalogItem {
  id: string;
  label: string;
  models: AiModelOption[];
}

export interface AiProviderModelsResponse {
  provider: string;
  models: AiModelOption[];
  source: string;
}

export interface AiCredential {
  id: number;
  provider: string;
  model_id: string;
  key_hint: string;
  is_active: boolean;
  validated_at?: string;
  created_at?: string;
}

export interface AiCredentialListResponse {
  credentials: AiCredential[];
  has_active: boolean;
}

export interface DependencyItem {
  source: string;
  target: string;
}

export interface DependenciesJson {
  items: DependencyItem[];
  total_files: number;
}

export interface AnalysisResults extends AnalysisStatus {
  file_tree_json?: FileTreeNode;
  languages_json?: LanguagesJson;
  endpoints_json?: EndpointsJson;
  complexity_json?: ComplexityJson;
  outline_json?: OutlineSection[];
  dependencies_json?: DependenciesJson;
}

export interface FileTreeNode {
  name: string;
  type: "dir" | "file";
  children?: FileTreeNode[];
}

export interface LanguageBreakdown {
  language: string;
  files: number;
  lines: number;
  percent: number;
  depth: "primary" | "shallow";
}

export interface LanguagesJson {
  primary: string[];
  breakdown: LanguageBreakdown[];
  shallow: string[];
}

export interface EndpointItem {
  method: string;
  path: string;
  file: string;
  line: number;
  framework: string;
}

export interface EndpointsJson {
  count: number;
  items: EndpointItem[];
  frameworks: string[];
}

export interface ComplexityJson {
  total_files: number;
  total_lines: number;
  largest_files: { path: string; lines: number; language?: string }[];
  by_language: Record<string, { files: number; lines: number }>;
  complexity_metrics?: { file_path: string; loc: number; complexity: number }[];
  parse_stats?: {
    parsed_files: number;
    parse_errors: number;
    by_language: Record<string, number>;
  };
}

export interface OutlineSection {
  heading: string;
  description?: string;
  order_index: number;
}

export interface OutlineDiff {
  current: string[];
  proposed: string[];
  has_changes: boolean;
}

export interface GitProviderStatus {
  connected: boolean;
  configured?: boolean;
  missing_configuration?: string[];
  username?: string;
  avatar?: string;
}

export interface Template {
  id: number;
  name: string;
  description?: string;
  category: string;
  is_builtin: boolean;
  purpose?: string;
  intended_audience?: string;
  expected_outcome?: string;
  guidance?: string;
  sections_json?: any[];
  system_prompt?: string;
}

export interface Document {
  id: number;
  project_id: number;
  title: string;
}

export type DocumentStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED';

export interface NoteReference {
  type: 'section' | 'document' | 'resource' | 'source' | 'note';
  id?: number | null;
  label: string;
  metadata?: Record<string, unknown> | null;
}

export interface CollaborationNote {
  id: number;
  document_id: number;
  section_id?: number | null;
  user_id: number;
  content: string;
  created_at: string;
  references?: NoteReference[];
  user_name?: string;
  user_avatar?: string;
}

export interface SearchResult {
  type: "project" | "document" | "section";
  id: number;
  title: string;
  subtitle?: string;
  content_excerpt?: string;
  status?: string;
  tags: string[];
  last_opened_at?: string;
  last_added_at: string;
  last_modified_at: string;
  project_id: number;
  project_name: string;
  document_id?: number;
  document_title?: string;
  section_id?: number;
  section_heading?: string;
}

export interface Section {
  id: number;
  document_id: number;
  parent_id?: number;
  order_index: number;
  sort_order?: number;
  heading: string;
  title?: string | null;
  content_md: string;
  status: "pending" | "draft" | "finalized" | "needs_input" | "NEEDS_INPUT";
  is_custom?: boolean;
  lifecycle_status?: "active" | "deleted" | "archived";
  confidence_score?: number | null;
  content_lifecycle?: 'empty' | 'generated_draft' | 'reviewed';
  needs_input?: boolean;
  is_generating?: boolean;
  has_failed?: boolean;
  is_potentially_stale?: boolean;
  workflow_metadata?: Record<string, unknown> | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  reviewed_against_analysis_id?: number | null;
  created_at?: string;
  updated_at?: string;
  children?: Section[];
}

export interface GenerationQualityWarning {
  code: string;
  message: string;
  suggestion?: string;
}

export interface SectionTreeResponse {
  document_id: number;
  sections: Section[];
  status: string;
  reviewer_id?: number | null;
}

export interface Version {
  id: number;
  section_id: number;
  author_type: "user" | "ai";
  summary?: string;
  added: number;
  removed: number;
  modified: number;
  created_at: string;
}

export interface DiffResponse {
  version_id: number;
  content_old: string;
  content_new: string;
  diff_lines: DiffLine[];
}

export interface AutosaveResponse {
  saved: boolean;
  updated_at: string;
}

export interface SectionStatusUpdateResponse {
  status: Section["status"];
  completion_pct: number;
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  line_number: number;
}

export interface Analysis {
  id: number;
  project_id: number;
  status: "pending" | "running" | "complete" | "failed";
  file_tree: FileNode[];
  language_stats: Record<string, number>;
  endpoints: Endpoint[];
  complexity_score: number;
  dependencies: string[];
}

export interface Endpoint {
  path: string;
  method: string;
  description?: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  language?: string;
  loc?: number;
  children?: FileNode[];
}

export interface QualityReport {
  id: number;
  document_id: number;
  overall_score: number;
  completeness: number;
  acceptance_coverage: number;
  consistency: number;
  readability: number;
  accuracy: number;
  generated_at: string;
}

export interface QualityIssue {
  id: number;
  report_id: number;
  severity: 'error' | 'warning' | 'info';
  section_ref?: string;
  message: string;
  suggestion?: string;
}

export interface BrokenLink {
  id: number;
  report_id: number;
  url: string;
  status_code?: number;
  section_ref?: string;
}

export interface QualityReportFull extends QualityReport {
  issues: QualityIssue[];
  broken_links: BrokenLink[];
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'ai';
  content: string;
  created_at: string;
}

export interface Resource {
  id: number;
  project_id: number;
  type: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  file_path: string | null;
  symbol_name: string | null;
  reference_type: string | null;
  reference_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ContextSearchItem {
  type: string;
  id: string;
  label: string;
  subtitle: string;
  score: number;
  reference_type: string | null;
  reference_id: number | null;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  avatar_url?: string;
  personal: boolean;
  created_at: string;
  quality_threshold: number;
  ai_provider?: string;
}

export type OrgMemberRole = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER' | 'TECHNICAL_WRITER' | 'VIEWER';

export type OrgMemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DECLINED' | 'CANCELLED';

export interface OrgMember {
  id: number;
  user_id: number;
  org_id: number;
  role: OrgMemberRole;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DECLINED' | 'CANCELLED';
  joined_at: string;
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
}

export interface PendingInvite {
  org_id: number;
  org_name: string;
  org_avatar_url?: string;
  role: OrgMemberRole;
  invited_by_name?: string;
  invited_by_email?: string;
  invited_at: string;
  expires_at?: string;
  invite_token: string;
}

export interface OrgJoinLink {
  id: number;
  org_id: number;
  code: string;
  role: OrgMemberRole;
  max_uses?: number;
  use_count: number;
  expires_at?: string;
  revoked_at?: string;
  created_by: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  org_id: number;
  action: string;
  resource?: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
  source?: "audit" | "activity";
}

export interface APIKey {
  id: number;
  name: string;
  created_at: string;
  expires_at?: string;
  raw_key?: string;
}

export interface ExportSettings {
  organization_name?: string;
  title?: string;
  subtitle?: string;
  include_toc?: boolean;
  include_cover_page?: boolean;
  include_page_numbers?: boolean;
  logo_url?: string | null;
  logo_position?: 'title-page' | 'header-left' | 'header-center' | 'header-right'
    | 'footer-left' | 'footer-center' | 'footer-right' | 'none';
  logo_height?: string;
  h1_color?: string;
  h2_color?: string;
  primary_color?: string;
  text_color?: string;
  muted_color?: string;
  border_color?: string;
  font_family?: string;
  body_font_size?: string;
  h1_font_size?: string;
  h2_font_size?: string;
  h3_font_size?: string;
  code_font_size?: string;
  header_left?: string;
  header_center?: string;
  header_right?: string;
  footer_left?: string;
  footer_center?: string;
  footer_right?: string;
  page_numbers?: boolean;
  h1_underline?: boolean;
  page_number_position?: 'left' | 'center' | 'right';
  page_number_format?: 'number' | 'page-n' | 'page-n-of-m';
  paper_size?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: 'normal' | 'narrow' | 'wide';
  table_style?: 'simple' | 'striped' | 'bordered' | 'minimal';
  code_theme?: 'dark' | 'light' | 'github' | 'monokai';
  watermark_text?: string;
}

export interface DocumentShare {
  id: number;
  document_id: number;
  user_id: number;
  permission: 'view' | 'comment' | 'edit';
  created_by: number;
  created_at: string;
  revoked_at: string | null;
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
}

export interface ShareListResponse {
  shares: DocumentShare[];
  total: number;
}

export interface NLPReport {
  id: number;
  project_id: number;
  readability_score: number;
  entities: any[];
  style_analysis: Record<string, any>;
  suggestions: any[];
  created_at: string;
}
