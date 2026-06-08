import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { qualityApi } from '@/api/quality';

export const useQualityReport = (projectId: number, documentId: number) =>
  useQuery({
    queryKey: ['quality', projectId, documentId],
    queryFn: () => qualityApi.getQuality(projectId, documentId),
    enabled: projectId > 0 && documentId > 0,
    retry: false,
    refetchInterval: (query) => {
      return query.state.data ? 30000 : false;
    },
  });

export const useRunQuality = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => qualityApi.runQuality(projectId, documentId),
    onSuccess: () => {
      toast.success('Quality analysis started');
      queryClient.invalidateQueries({ queryKey: ['quality', projectId, documentId] });
      let attempts = 0;
      const maxAttempts = 12;
      const poll = setInterval(() => {
        attempts++;
        queryClient.invalidateQueries({ queryKey: ['quality', projectId, documentId] });
        const state = queryClient.getQueryState(['quality', projectId, documentId]);
        if (state?.data) {
          clearInterval(poll);
          toast.success('Quality analysis complete');
        } else if (attempts >= maxAttempts) {
          clearInterval(poll);
          toast.error('Quality analysis timed out. Please try again.');
        }
      }, 5000);
    },
    onError: () => toast.error('Failed to start quality analysis. Check your connection and try again.'),
  });
};
