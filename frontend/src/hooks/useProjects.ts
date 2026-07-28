import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { projectsApi } from '../api/projects';
import type { Project, Template } from '../types';

export const useProjects = (filters?: {
  search?: string;
  status?: string;
  starred?: boolean;
  tag?: string;
}) => {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: () => projectsApi.getProjects(filters),
    placeholderData: (previousData) => previousData,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create project');
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    },
  });
};

export const useDuplicateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.duplicateProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project duplicated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to duplicate project');
    },
  });
};

export const useStarProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, starred }: { id: number; starred: boolean }) =>
      projectsApi.updateProject(id, { starred }),
    onMutate: async ({ id, starred }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['projects'] });

      // Snapshot the previous values
      const queries = queryClient.getQueriesData<Project[]>({ queryKey: ['projects'] });

      // Optimistically update all project lists in cache
      queryClient.setQueriesData<Project[]>({ queryKey: ['projects'] }, (old) => {
        if (!old) return old;
        return old.map((p) => (p.id === id ? { ...p, starred } : p));
      });

      // Also optimistically update specific project query if it exists
      const previousProject = queryClient.getQueryData<Project>(['project', id]);
      if (previousProject) {
        queryClient.setQueryData<Project>(['project', id], {
          ...previousProject,
          starred,
        });
      }

      return { queries, previousProject };
    },
    onError: (err, variables, context) => {
      // Rollback list queries
      if (context?.queries) {
        context.queries.forEach(([key, value]) => {
          queryClient.setQueryData(key, value);
        });
      }
      // Rollback specific project query
      if (context?.previousProject) {
        queryClient.setQueryData(['project', variables.id], context.previousProject);
      }
      toast.error('Failed to update star status');
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
    },
  });
};

export const useTemplates = () => {
  return useQuery({
    queryKey: ['templates'],
    queryFn: projectsApi.getTemplates,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create template');
    },
  });
};
