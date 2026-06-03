import apiClient from './client';
import type { Project, Template } from '../types';

export const projectsApi = {
  async getProjects(params?: {
    search?: string;
    status?: string;
    starred?: boolean;
  }): Promise<Project[]> {
    const { data } = await apiClient.get('/projects', { params });
    // Note: The backend returns a ProjectListResponse containing { projects: Project[], total: number }
    return data.projects;
  },

  async getProject(id: number): Promise<Project> {
    const { data } = await apiClient.get(`/projects/${id}`);
    return data;
  },

  async createProject(projectData: {
    name: string;
    description?: string;
    source_type: 'zip' | 'git' | 'scratch';
    git_repo_url?: string;
    git_branch?: string;
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
  }): Promise<Template> {
    const { data } = await apiClient.post('/templates', templateData);
    return data;
  },
};
