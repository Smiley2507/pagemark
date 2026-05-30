export interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: "pending" | "draft" | "finalized";
  completion_pct: number;
  language?: string;
  source_type: "zip" | "git" | "scratch";
  git_repo_url?: string;
  git_branch?: string;
  git_provider?: "github" | "gitlab" | "bitbucket";
  starred: boolean;
  context_md?: string;
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

export interface AnalysisResults extends AnalysisStatus {
  file_tree_json?: FileTreeNode;
  languages_json?: LanguagesJson;
  endpoints_json?: EndpointsJson;
  complexity_json?: ComplexityJson;
  outline_json?: OutlineSection[];
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
  username?: string;
  avatar?: string;
}

export interface Template {
  id: number;
  name: string;
  description?: string;
  category: string;
  is_builtin: boolean;
}

export interface Document {
  id: number;
  project_id: number;
  title: string;
}

export interface Section {
  id: number;
  document_id: number;
  parent_id?: number;
  order_index: number;
  heading: string;
  content_md: string;
  status: "pending" | "draft" | "finalized";
  created_at?: string;
  updated_at?: string;
  children?: Section[];
}

export interface SectionTreeResponse {
  document_id: number;
  sections: Section[];
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
  project_id: number;
  overall_score: number;
  completeness: number;
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
