import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { analysisApi } from '../api/analysis';
import { gitAuthApi } from '../api/gitAuth';

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
