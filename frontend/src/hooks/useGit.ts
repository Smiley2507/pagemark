import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import axios from 'axios';
import { analysisApi } from '../api/analysis';
import { gitAuthApi } from '../api/gitAuth';

function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

export const useGitHubStatus = () =>
  useQuery({
    queryKey: ['git', 'github', 'status'],
    queryFn: gitAuthApi.getGitHubStatus,
  });

export const useGitRepos = (enabled = true) =>
  useQuery({
    queryKey: ['git', 'repos', 'github'],
    queryFn: () => analysisApi.getGitRepos('github'),
    enabled,
  });

export const useRepoBranches = (
  owner: string | undefined,
  repo: string | undefined,
  enabled = true
) =>
  useQuery({
    queryKey: ['git', 'branches', 'github', owner, repo],
    queryFn: () => analysisApi.getRepoBranches(owner!, repo!, 'github'),
    enabled: enabled && !!owner && !!repo,
  });

export const useDisconnectGitHub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: gitAuthApi.disconnectGitHub,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git', 'github'] });
      toast.success('GitHub disconnected');
    },
    onError: () => toast.error('Failed to disconnect GitHub'),
  });
};

export const useGenerateWebhookSecret = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => analysisApi.generateWebhookSecret(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      toast.success('Webhook secret generated');
    },
    onError: () => toast.error('Failed to generate webhook secret'),
  });
};

export const useRegisterGitHubWebhook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, owner, repo }: { projectId: number; owner: string; repo: string }) =>
      analysisApi.registerGitHubWebhook(projectId, owner, repo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      toast.success('Webhook registered on GitHub');
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'Failed to register webhook')),
  });
};

export const useDeleteWebhook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => analysisApi.deleteWebhook(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
      toast.success('Webhook removed');
    },
    onError: () => toast.error('Failed to delete webhook'),
  });
};
