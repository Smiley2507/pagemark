import apiClient from './client';
import type { QualityReport } from '@/types';

export interface QualityIssue {
  id: number;
  report_id: number;
  severity: 'error' | 'warning' | 'info';
  section_ref?: string;
  message: string;
  suggestion?: string;
}

export type QualityFindingCategory =
  | 'completeness'
  | 'acceptance'
  | 'terminology'
  | 'links'
  | 'readability'
  | 'grammar'
  | 'accuracy';

export type QualityFindingStatus = 'open' | 'proposed' | 'resolved' | 'dismissed';

export interface QualityFinding {
  id: number;
  document_id: number;
  report_id?: number | null;
  category: QualityFindingCategory;
  status: QualityFindingStatus;
  severity: 'error' | 'warning' | 'info';
  section_id?: number | null;
  section_ref?: string | null;
  message: string;
  suggestion?: string | null;
  quote?: string | null;
  offset?: number | null;
  length?: number | null;
  replacements: string[];
  rule_id?: string | null;
  content_fingerprint: string;
  provider?: string | null;
  provider_metadata?: Record<string, unknown> | null;
  stale_location: boolean;
  first_seen_at: string;
  last_seen_at: string;
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
  findings?: QualityFinding[];
}

export interface QualityRunResponse {
  message: string;
  task_id: string;
}

export interface QualityStatus {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'missing_report';
  task_id: string;
  message: string;
  report?: {
    id: number;
    document_id: number;
    overall_score: number;
    generated_at: string;
  } | null;
  error?: string | null;
}

export const qualityApi = {
  /** Dispatch quality analysis job → 202 */
  async runQuality(projectId: number, documentId: number): Promise<QualityRunResponse> {
    const { data } = await apiClient.post(`/projects/${projectId}/documents/${documentId}/quality/run`);
    return data;
  },

  async getStatus(projectId: number, documentId: number, taskId: string): Promise<QualityStatus> {
    const { data } = await apiClient.get(
      `/projects/${projectId}/documents/${documentId}/quality/status`,
      { params: { task_id: taskId } },
    );
    return data;
  },

  /** Fetch latest quality report with all issues + broken links */
  async getQuality(projectId: number, documentId: number): Promise<QualityReportFull> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}/quality`);
    return data;
  },

  /** Fetch issues, optionally filtered by severity */
  async getIssues(
    projectId: number,
    documentId: number,
    severity?: 'error' | 'warning' | 'info',
  ): Promise<QualityIssue[]> {
    const params = severity ? { severity } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}/quality/issues`, { params });
    return data;
  },

  async getFindings(
    projectId: number,
    documentId: number,
    params?: { category?: QualityFindingCategory; status?: QualityFindingStatus; section_id?: number },
  ): Promise<QualityFinding[]> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}/quality/findings`, { params });
    return data;
  },

  async updateFindingStatus(
    projectId: number,
    documentId: number,
    findingId: number,
    status: QualityFindingStatus,
  ): Promise<QualityFinding> {
    const { data } = await apiClient.patch(`/projects/${projectId}/documents/${documentId}/quality/findings/${findingId}`, { status });
    return data;
  },

  async runGrammarFindings(
    projectId: number,
    documentId: number,
    payload: { section_id?: number; language?: string } = {},
  ): Promise<QualityFinding[]> {
    const { data } = await apiClient.post(`/projects/${projectId}/documents/${documentId}/quality/grammar/run`, payload);
    return data;
  },

  async createAiFix(
    projectId: number,
    documentId: number,
    payload: {
      finding_id?: number;
      category?: QualityFindingCategory;
      section_id?: number;
      status?: QualityFindingStatus;
      action?: string;
    },
  ) {
    const { data } = await apiClient.post(`/projects/${projectId}/documents/${documentId}/quality/ai-fix`, payload);
    return data;
  },
};
