import apiClient from './client';
import type { GitProviderStatus } from '../types';

export const gitAuthApi = {
  async getGitHubStatus(): Promise<GitProviderStatus> {
    const { data } = await apiClient.get('/auth/github/status');
    return data;
  },

  async disconnectGitHub(): Promise<void> {
    await apiClient.delete('/auth/github/disconnect');
  },
};
