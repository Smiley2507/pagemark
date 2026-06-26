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
};
