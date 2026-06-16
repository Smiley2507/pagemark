import apiClient from './client';

export interface ActivityChartDay {
  date: string;
  label: string;
  total: number;
  categories: Record<string, number>;
}

export interface ActivityEvent {
  id: number;
  project_id?: number;
  project_name?: string | null;
  event_type: string;
  weight: number;
  message: string;
  document_title: string | null;
  section_heading: string | null;
  analysis_status: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}
import type { AiContextPackage, Project, Template } from '../types';

export const projectsApi = {
  async getProjects(params?: {
    search?: string;
    status?: string;
    starred?: boolean;
    tag?: string;
  }): Promise<Project[]> {
    const { data } = await apiClient.get('/projects', { params });
    // Note: The backend returns a ProjectListResponse containing { projects: Project[], total: number }
    return data.projects;
  },

  async getProject(id: number): Promise<Project> {
    const { data } = await apiClient.get(`/projects/${id}`);
    return data;
  },

  async getAiContext(id: number): Promise<AiContextPackage> {
    const { data } = await apiClient.get(`/projects/${id}/ai-context`);
    return data;
  },

  async generateAiOverview(id: number): Promise<{
    overview_md: string;
    questions: string[];
    confidence_score: number;
  }> {
    const { data } = await apiClient.post(`/projects/${id}/ai-context/overview`);
    return data;
  },

  async createProject(projectData: {
    name: string;
    description?: string;
    source_type: 'zip' | 'git' | 'scratch';
    template_id?: number;
  }): Promise<Project> {
    const { data } = await apiClient.post('/projects', projectData);
    return data;
  },

  async updateProject(
    id: number,
    projectData: {
      name?: string;
      description?: string;
      starred?: boolean;
      status?: 'pending' | 'draft' | 'finalized';
      tags?: string[];
      export_settings?: import('@/types').ExportSettings;
    }
  ): Promise<Project> {
    const { data } = await apiClient.patch(`/projects/${id}`, projectData);
    return data;
  },

  async deleteProject(id: number): Promise<void> {
    await apiClient.delete(`/projects/${id}`);
  },

  async duplicateProject(id: number): Promise<Project> {
    const { data } = await apiClient.post(`/projects/${id}/duplicate`);
    return data;
  },

  async getTags(): Promise<string[]> {
    const { data } = await apiClient.get('/projects/tags');
    return data.tags;
  },

  async getTemplates(): Promise<Template[]> {
    const { data } = await apiClient.get('/templates');
    // Note: The backend returns TemplateListResponse { templates: Template[] }
    return data.templates;
  },

  async createTemplate(templateData: {
    name: string;
    description?: string;
    category?: string;
    sections_json?: string[] | { heading: string; description?: string }[];
    system_prompt?: string;
  }): Promise<Template> {
    const { data } = await apiClient.post('/templates', templateData);
    return data;
  },

  async deleteTemplate(id: number): Promise<void> {
    await apiClient.delete(`/templates/${id}`);
  },

  async updateTemplate(id: number, data: {
    name?: string;
    description?: string;
    category?: string;
    sections_json?: string[] | { heading: string; description?: string }[];
    system_prompt?: string;
  }): Promise<Template> {
    const res = await apiClient.patch(`/templates/${id}`, data);
    return res.data;
  },

  async getActivity(projectId: number, params?: {
    limit?: number;
    offset?: number;
    event_type?: string;
    days?: number;
  }): Promise<{ events: ActivityEvent[]; total: number }> {
    const { data } = await apiClient.get(`/projects/${projectId}/activity`, { params });
    return data;
  },

  async getRecentActivity(params?: {
    limit?: number;
    days?: number;
  }): Promise<{ events: ActivityEvent[]; total: number }> {
    const { data } = await apiClient.get('/projects/activity/recent', { params });
    return data;
  },

  async getActivityHeatmap(projectId: number, days?: number): Promise<ActivityChartDay[]> {
    const { data } = await apiClient.get(`/projects/${projectId}/activity/heatmap`, {
      params: { days },
    });
    return data;
  },
};
