import apiClient from './client';
import type { SearchResult } from '../types';

export type GlobalSearchType = 'all' | 'project' | 'document' | 'section';
export type GlobalSearchSort = 'name' | 'last_opened' | 'last_added' | 'last_modified';

export const searchApi = {
  async search(paramsOrQuery?: {
    q?: string;
    tag?: string;
    status?: string;
    type?: GlobalSearchType;
    sort?: GlobalSearchSort;
  } | string, tag?: string): Promise<SearchResult[]> {
    const params: Record<string, string> = {};
    if (typeof paramsOrQuery === 'string') {
      if (paramsOrQuery) params.q = paramsOrQuery;
      if (tag) params.tag = tag;
    } else if (paramsOrQuery) {
      if (paramsOrQuery.q) params.q = paramsOrQuery.q;
      if (paramsOrQuery.tag) params.tag = paramsOrQuery.tag;
      if (paramsOrQuery.status) params.status = paramsOrQuery.status;
      if (paramsOrQuery.type && paramsOrQuery.type !== 'all') params.type = paramsOrQuery.type;
      if (paramsOrQuery.sort) params.sort = paramsOrQuery.sort;
    }
    const { data } = await apiClient.get('/projects/search', { params });
    return data.results;
  },
};
