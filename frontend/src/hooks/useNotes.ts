import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentsApi } from '@/api/documents';
import type { CollaborationNote } from '@/types';

export const useNotes = (projectId: number, documentId: number, sectionId?: number | null) =>
  useQuery({
    queryKey: ['notes', projectId, documentId, sectionId],
    queryFn: () => documentsApi.getNotes(projectId, documentId, sectionId ?? undefined),
    enabled: projectId > 0 && documentId > 0,
  });

export const useCreateNote = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, sectionId }: { content: string; sectionId?: number | null }) =>
      documentsApi.addNote(projectId, documentId, content, sectionId ?? undefined),
    onSuccess: (_, { sectionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['notes', projectId, documentId] });
      void queryClient.invalidateQueries({ queryKey: ['notes', projectId, documentId, sectionId] });
      toast.success('Note added');
    },
    onError: () => toast.error('Failed to add note'),
  });
};
