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

  async reorderSections(sectionIds: number[]): Promise<{ message: string }> {
    const { data } = await apiClient.put(`/sections/reorder`, { section_ids: sectionIds });
    return data;
  },

  async updateSectionTitle(id: number, title: string): Promise<Section> {
    const { data } = await apiClient.put(`/sections/${id}/title`, { title });
    return data;
  },

  async deleteSection(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.delete(`/sections/${id}`);
    return data;
  },

  async createCustomSection(projectId: number, title: string): Promise<{ id: number, heading: string }> {
    const { data } = await apiClient.post(`/projects/${projectId}/sections`, { title });
    return data;
  },

  async getPhrasingSuggestions(sectionId: number, text: string): Promise<string[]> {
    const { data } = await apiClient.post(`/sections/${sectionId}/phrasing-suggestions`, { text });
    return data;
  },

  async getTerminologyConflicts(projectId: number): Promise<any[]> {
    const { data } = await apiClient.get(`/terminology/projects/${projectId}/check`);
    return data;
  },

  async resolveTerminology(projectId: number, termToReplace: string, correctTerm: string): Promise<{ message: string }> {
    const { data } = await apiClient.post(`/terminology/projects/${projectId}/resolve`, {
      term_to_replace: termToReplace,
      correct_term: correctTerm,
    });
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

  async generateAI(sectionId: number): Promise<Section> {
    const { data } = await apiClient.post(`/sections/${sectionId}/ai/generate`);
    return data;
  },

  async refineAI(sectionId: number, instruction: string): Promise<{ refined: string }> {
    const { data } = await apiClient.post(`/sections/${sectionId}/ai/refine`, { instruction });
    return data;
  },
};
