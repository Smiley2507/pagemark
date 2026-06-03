import apiClient from './client';
import type { SearchResult } from '../types';

export const searchApi = {
  async search(q?: string, tag?: string): Promise<SearchResult[]> {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (tag) params.tag = tag;
    const { data } = await apiClient.get('/projects/search', { params });
    return data.results;
  },
};
