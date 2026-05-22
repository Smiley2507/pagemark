import apiClient from './client';
import type { GitBranch, GitRepo, JobResponse, AnalysisStatus } from '../types';

export const analysisApi = {
  async connectGitUrl(
    projectId: number,
    data: { repo_url: string; branch: string }
  ): Promise<JobResponse> {
    const { data: res } = await apiClient.post(
      `/projects/${projectId}/git/connect-url`,
      data
    );
    return res;
  },

  async connectGitOAuth(
    projectId: number,
    data: { owner: string; repo: string; branch: string }
  ): Promise<JobResponse> {
    const { data: res } = await apiClient.post(
      `/projects/${projectId}/git/connect-oauth`,
      data
    );
    return res;
  },

  async getGitRepos(provider: 'github' | 'gitlab' = 'github'): Promise<GitRepo[]> {
    const { data } = await apiClient.get('/projects/git/repos', {
      params: { provider },
    });
    return data;
  },

  async getRepoBranches(
    owner: string,
    repo: string,
    provider: 'github' | 'gitlab' = 'github'
  ): Promise<GitBranch[]> {
    const { data } = await apiClient.get(
      `/projects/git/repos/${owner}/${repo}/branches`,
      { params: { provider } }
    );
    return data;
  },

  async syncGitRepo(projectId: number): Promise<JobResponse> {
    const { data } = await apiClient.post(`/projects/${projectId}/git/sync`);
    return data;
  },

  async getAnalysisStatus(projectId: number): Promise<AnalysisStatus> {
    const { data } = await apiClient.get(`/projects/${projectId}/analysis/status`);
    return data;
  },

  async uploadZip(projectId: number, file: File): Promise<JobResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post(`/projects/${projectId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
