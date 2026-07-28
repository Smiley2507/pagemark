import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';

export const useProject = (projectId: number) =>
  useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: projectId > 0,
  });
