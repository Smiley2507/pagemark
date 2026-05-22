import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { analysisApi } from '../api/analysis';
import type { AnalysisStatus } from '../types';

const POLL_MS = 2000;
const MAX_POLL_MS = 15 * 60 * 1000;
const STALE_PENDING_MS = 60 * 1000;

export const useAnalysisStatus = (projectId: number, enabled = true) => {
  const [workerUnavailable, setWorkerUnavailable] = useState(false);
  const pendingSince = useRef<number | null>(null);

  const query = useQuery({
    queryKey: ['analysis', 'status', projectId],
    queryFn: () => analysisApi.getAnalysisStatus(projectId),
    enabled: enabled && projectId > 0,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === 'pending' || status === 'running') return POLL_MS;
      return false;
    },
  });

  useEffect(() => {
    const data = query.data;
    if (!data) return;

    if (data.status === 'pending' && !data.started_at) {
      if (pendingSince.current === null) {
        pendingSince.current = Date.now();
      } else if (Date.now() - pendingSince.current > STALE_PENDING_MS) {
        setWorkerUnavailable(true);
      }
    } else {
      pendingSince.current = null;
      setWorkerUnavailable(false);
    }
  }, [query.data]);

  return { ...query, workerUnavailable };
};

export const useAnalysisResults = (projectId: number, enabled: boolean) =>
  useQuery({
    queryKey: ['analysis', 'results', projectId],
    queryFn: () => analysisApi.getAnalysisResults(projectId),
    enabled: enabled && projectId > 0,
  });

export const useOutlineDiff = (projectId: number, enabled: boolean) =>
  useQuery({
    queryKey: ['analysis', 'outline-diff', projectId],
    queryFn: () => analysisApi.getOutlineDiff(projectId),
    enabled: enabled && projectId > 0,
  });

export const useApplyOutline = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => analysisApi.applyOutline(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', projectId] });
      queryClient.invalidateQueries({ queryKey: ['analysis', 'status', projectId] });
      queryClient.invalidateQueries({ queryKey: ['analysis', 'results', projectId] });
      queryClient.invalidateQueries({ queryKey: ['analysis', 'outline-diff', projectId] });
      toast.success('Outline applied to document');
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Failed to apply outline');
    },
  });
};

export async function pollAnalysisUntilDone(
  projectId: number,
  onProgress?: (status: AnalysisStatus) => void
): Promise<AnalysisStatus> {
  const terminal = new Set(['completed', 'failed']);
  const started = Date.now();

  while (true) {
    if (Date.now() - started > MAX_POLL_MS) {
      toast.error('Analysis timed out after 15 minutes');
      throw new Error('Analysis poll timeout');
    }

    const status = await analysisApi.getAnalysisStatus(projectId);
    onProgress?.(status);

    if (
      status.status === 'pending' &&
      !status.started_at &&
      Date.now() - started > STALE_PENDING_MS
    ) {
      toast.error(
        'Analysis has not started. Ensure the Celery worker is running (docker compose up or celery worker).'
      );
    }

    if (terminal.has(status.status)) return status;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

export const useSyncGitRepo = () =>
  useMutation({
    mutationFn: (projectId: number) => analysisApi.syncGitRepo(projectId),
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Failed to sync repository');
    },
  });
