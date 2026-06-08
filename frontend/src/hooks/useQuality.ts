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
      return query.state.data ? 30000 : 5000;
    },
  });

export const useRunQuality = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => qualityApi.runQuality(projectId, documentId),
    onSuccess: () => {
      toast.success('Quality analysis started');
      queryClient.invalidateQueries({ queryKey: ['quality', projectId, documentId] });
    },
    onError: () => toast.error('Failed to start quality analysis'),
  });
};
