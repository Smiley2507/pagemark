import apiClient from './client';
import type { ContextSearchItem } from '@/types';

export interface ContextSearchResponse {
  results: ContextSearchItem[];
  total: number;
}

export const contextSearchApi = {
  async search(projectId: number, query: string, limit = 20): Promise<ContextSearchResponse> {
    const { data } = await apiClient.get(`/projects/${projectId}/context/search`, {
      params: { q: query, limit },
    });
    return data;
  },
};
