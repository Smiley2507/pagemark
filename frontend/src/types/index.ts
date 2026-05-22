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
  status: 'pending' | 'draft' | 'finalized';
  completion_pct: number;
  language?: string;
  source_type: 'zip' | 'git' | 'scratch';
  git_repo_url?: string;
  git_branch?: string;
  git_provider?: 'github' | 'gitlab' | 'bitbucket';
  starred: boolean;
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

export interface AnalysisStatus {
  id: number;
  project_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_step?: string;
  step_number: number;
  total_steps: number;
  source_type: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
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
  status: 'pending' | 'draft' | 'finalized';
  children?: Section[];
}

export interface Version {
  id: number;
  version_label: string;
  author_type: 'user' | 'ai';
  summary?: string;
  added: number;
  removed: number;
  modified: number;
  created_at: string;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  line_number: number;
}

export interface Analysis {
  id: number;
  project_id: number;
  status: 'pending' | 'running' | 'complete' | 'failed';
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
  type: 'file' | 'dir';
  language?: string;
  loc?: number;
  children?: FileNode[];
}

export interface QualityReport {
  id: number;
  overall_score: number;
  completeness: number;
  consistency: number;
  readability: number;
  accuracy: number;
  generated_at: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'ai';
  content: string;
  created_at: string;
}
