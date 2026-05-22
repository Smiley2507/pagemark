import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { analysisApi } from '../api/analysis';
import type { AnalysisStatus } from '../types';

export const useAnalysisStatus = (projectId: number, enabled = true) =>
  useQuery({
    queryKey: ['analysis', 'status', projectId],
    queryFn: () => analysisApi.getAnalysisStatus(projectId),
    enabled: enabled && projectId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'running') return 2000;
      return false;
    },
  });

export async function pollAnalysisUntilDone(
  projectId: number,
  onProgress?: (status: AnalysisStatus) => void
): Promise<AnalysisStatus> {
  const terminal = new Set(['completed', 'failed']);

  while (true) {
    const status = await analysisApi.getAnalysisStatus(projectId);
    onProgress?.(status);
    if (terminal.has(status.status)) return status;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export const useSyncGitRepo = () =>
  useMutation({
    mutationFn: (projectId: number) => analysisApi.syncGitRepo(projectId),
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Failed to sync repository');
    },
  });
