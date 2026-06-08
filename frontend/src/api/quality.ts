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

export const qualityApi = {
  /** Dispatch quality analysis job → 202 */
  async runQuality(projectId: number, documentId: number): Promise<void> {
    await apiClient.post(`/projects/${projectId}/documents/${documentId}/quality/run`);
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
