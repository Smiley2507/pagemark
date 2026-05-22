import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { analysisApi } from '../api/analysis';
import { gitAuthApi } from '../api/gitAuth';

export const useGitHubStatus = () =>
  useQuery({
    queryKey: ['git', 'github', 'status'],
    queryFn: gitAuthApi.getGitHubStatus,
  });

export const useGitLabStatus = () =>
  useQuery({
    queryKey: ['git', 'gitlab', 'status'],
    queryFn: gitAuthApi.getGitLabStatus,
  });

export const useGitRepos = (provider: 'github' | 'gitlab', enabled = true) =>
  useQuery({
    queryKey: ['git', 'repos', provider],
    queryFn: () => analysisApi.getGitRepos(provider),
    enabled,
  });

export const useRepoBranches = (
  owner: string | undefined,
  repo: string | undefined,
  provider: 'github' | 'gitlab',
  enabled = true
) =>
  useQuery({
    queryKey: ['git', 'branches', provider, owner, repo],
    queryFn: () => analysisApi.getRepoBranches(owner!, repo!, provider),
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

export const useDisconnectGitLab = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: gitAuthApi.disconnectGitLab,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git', 'gitlab'] });
      toast.success('GitLab disconnected');
    },
    onError: () => toast.error('Failed to disconnect GitLab'),
  });
};
