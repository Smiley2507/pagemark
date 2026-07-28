import apiClient from './client';
import type { Resource } from '@/types';

export interface ResourceListResponse {
  resources: Resource[];
  total: number;
}

export const resourcesApi = {
  async upload(projectId: number, file: File): Promise<Resource> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post(`/projects/${projectId}/resources/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async list(projectId: number, type?: string): Promise<ResourceListResponse> {
    const params = type ? { type } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/resources`, { params });
    return data;
  },

  async get(projectId: number, resourceId: number): Promise<Resource> {
    const { data } = await apiClient.get(`/projects/${projectId}/resources/${resourceId}`);
    return data;
  },

  async delete(projectId: number, resourceId: number): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/resources/${resourceId}`);
  },
};
