import apiClient from './client';
import type { CollaborationNote } from '../types';

export const documentsApi = {
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
