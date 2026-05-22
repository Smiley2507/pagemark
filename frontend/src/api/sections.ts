import apiClient from './client';
import type {
  AutosaveResponse,
  DiffResponse,
  Section,
  SectionStatusUpdateResponse,
  SectionTreeResponse,
  Version,
} from '../types';

export const sectionsApi = {
  async getDocument(projectId: number): Promise<SectionTreeResponse> {
    const { data } = await apiClient.get(`/projects/${projectId}/document`);
    return data;
  },

  async getSection(id: number): Promise<Section> {
    const { data } = await apiClient.get(`/sections/${id}`);
    return data;
  },

  async autosaveSection(id: number, content_md: string): Promise<AutosaveResponse> {
    const { data } = await apiClient.patch(`/sections/${id}/autosave`, { content_md });
    return data;
  },

  async updateSection(
    id: number,
    payload: { content_md?: string; status?: Section['status'] }
  ): Promise<Section> {
    const { data } = await apiClient.patch(`/sections/${id}`, payload);
    return data;
  },

  async updateSectionStatus(
    id: number,
    status: Section['status']
  ): Promise<SectionStatusUpdateResponse> {
    const { data } = await apiClient.patch(`/sections/${id}/status`, { status });
    return data;
  },

  async getVersions(sectionId: number): Promise<Version[]> {
    const { data } = await apiClient.get(`/sections/${sectionId}/versions`);
    return data;
  },

  async getVersionDiff(versionId: number): Promise<DiffResponse> {
    const { data } = await apiClient.get(`/versions/${versionId}/diff`);
    return data;
  },

  async restoreVersion(versionId: number): Promise<Section> {
    const { data } = await apiClient.post(`/versions/${versionId}/restore`);
    return data;
  },
};
