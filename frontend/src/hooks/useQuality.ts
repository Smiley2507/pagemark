import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { qualityApi } from '@/api/quality';

function isMissingQualityReport(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 404) {
    return false;
  }
  const detail = error.response.data?.detail;
  return typeof detail === 'string' && detail.includes('No quality report found');
}

function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export const useQualityReport = (projectId: number, documentId: number) =>
  useQuery({
    queryKey: ['quality', projectId, documentId],
    queryFn: async () => {
      try {
        return await qualityApi.getQuality(projectId, documentId);
      } catch (error) {
        if (isMissingQualityReport(error) || isNotFound(error)) {
          return null;
        }
        throw error;
      }
    },
    enabled: projectId > 0 && documentId > 0,
    retry: false,
    refetchInterval: (query) => {
      return query.state.data ? 30000 : false;
    },
  });

export const useRunQuality = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [projectId, documentId]);

  return useMutation({
    mutationFn: () => qualityApi.runQuality(projectId, documentId),
    onSuccess: (run) => {
      toast.success('Quality analysis started');
      queryClient.invalidateQueries({ queryKey: ['quality', projectId, documentId] });
      queryClient.setQueryData(['quality-status', projectId, documentId, run.task_id], {
        status: 'queued',
        task_id: run.task_id,
        message: run.message,
      });

      let attempts = 0;
      const maxAttempts = 24;
      pollTimerRef.current = setInterval(async () => {
        attempts++;
        try {
          const status = await qualityApi.getStatus(projectId, documentId, run.task_id);
          queryClient.setQueryData(['quality-status', projectId, documentId, run.task_id], status);

          if (status.status === 'completed') {
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;
            queryClient.invalidateQueries({ queryKey: ['quality', projectId, documentId] });
            queryClient.invalidateQueries({ queryKey: ['quality-modal', projectId, documentId] });
            toast.success('Quality analysis complete');
            return;
          }

          if (status.status === 'failed' || status.status === 'missing_report') {
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;
            const message = status.error || status.message;
            toast.error(message);
            return;
          }
        } catch {
          queryClient.invalidateQueries({ queryKey: ['quality', projectId, documentId] });
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          toast.error('Quality analysis is still running. Check status again shortly or inspect the worker logs.');
        }
      }, 3000);
    },
    onError: (error) => {
      if (isNotFound(error)) {
        toast.error('Quality analysis is unavailable for this document or project.');
        return;
      }
      toast.error('Failed to start quality analysis. Check your connection and try again.');
    },
  });
};
