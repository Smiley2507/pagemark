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
    onSuccess: () => {
      toast.success('Quality analysis started');
      queryClient.invalidateQueries({ queryKey: ['quality', projectId, documentId] });

      let attempts = 0;
      const maxAttempts = 12;
      pollTimerRef.current = setInterval(() => {
        attempts++;
        queryClient.invalidateQueries({ queryKey: ['quality', projectId, documentId] });
        const state = queryClient.getQueryState(['quality', projectId, documentId]);
        if (state?.data) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          toast.success('Quality analysis complete');
        } else if (attempts >= maxAttempts) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          toast.error('Quality analysis timed out. The celery task may have failed — check the worker logs.');
        }
      }, 5000);
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
