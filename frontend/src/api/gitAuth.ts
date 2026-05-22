import apiClient from './client';
import type { GitProviderStatus } from '../types';

export const gitAuthApi = {
  async getGitHubStatus(): Promise<GitProviderStatus> {
    const { data } = await apiClient.get('/auth/github/status');
    return data;
  },

  async getGitLabStatus(): Promise<GitProviderStatus> {
    const { data } = await apiClient.get('/auth/gitlab/status');
    return data;
  },

  async disconnectGitHub(): Promise<void> {
    await apiClient.delete('/auth/github/disconnect');
  },

  async disconnectGitLab(): Promise<void> {
    await apiClient.delete('/auth/gitlab/disconnect');
  },
};
