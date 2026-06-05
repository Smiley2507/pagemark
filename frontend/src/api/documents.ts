import apiClient from './client';
import type { CollaborationNote } from '../types';

export interface DocumentProgress {
  total_sections: number;
  reviewed_sections: number;
  generated_sections: number;
  pct: number;
}

export interface Document {
  id: number;
  project_id: number;
  title: string;
  setup_stage: string;
  status: string;
  freshness: string;
  progress: DocumentProgress;
  tags: string[];
  template?: {
    id: number;
    name: string;
    description?: string;
  };
  template_id?: number;
  purpose?: string;
  audience?: string;
  context?: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export const documentsApi = {
  async listDocuments(projectId: number): Promise<DocumentListResponse> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents`);
    return data;
  },

  async submitForReview(projectId: number, reviewerId: number): Promise<{ status: string; reviewer_id: number }> {
    const { data } = await apiClient.post(`/projects/${projectId}/document/submit-review`, { reviewer_id: reviewerId });
    return data;
  },

  async approveDocument(projectId: number): Promise<{ status: string; approved_at: string }> {
    const { data } = await apiClient.post(`/projects/${projectId}/document/approve`);
    return data;
  },

  async requestChanges(projectId: number): Promise<{ status: string }> {
    const { data } = await apiClient.post(`/projects/${projectId}/document/request-changes`);
    return data;
  },

  async getNotes(docId: number): Promise<CollaborationNote[]> {
    const { data } = await apiClient.get(`/documents/${docId}/notes`);
    return data;
  },

  async addNote(docId: number, content: string): Promise<CollaborationNote> {
    const { data } = await apiClient.post(`/documents/${docId}/notes`, { content });
    return data;
  },
};
