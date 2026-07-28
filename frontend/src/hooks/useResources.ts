import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resourcesApi } from '@/api/resources';
import { toast } from 'sonner';

export const useResources = (projectId: number, typeFilter?: string) => {
  return useQuery({
    queryKey: ['resources', projectId, typeFilter],
    queryFn: () => resourcesApi.list(projectId, typeFilter),
    enabled: projectId > 0,
  });
};

export const useResource = (projectId: number, resourceId: number | null) => {
  return useQuery({
    queryKey: ['resource', projectId, resourceId],
    queryFn: () => resourcesApi.get(projectId, resourceId!),
    enabled: projectId > 0 && resourceId !== null && resourceId > 0,
  });
};

export const useUploadResource = (projectId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => resourcesApi.upload(projectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', projectId] });
      toast.success('File uploaded');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to upload file');
    },
  });
};

export const useDeleteResource = (projectId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resourceId: number) => resourcesApi.delete(projectId, resourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources', projectId] });
      toast.success('Resource deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete resource');
    },
  });
};
