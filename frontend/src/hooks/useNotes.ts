import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { documentsApi } from '@/api/documents';
import type { CollaborationNote, NoteReference } from '@/types';

export const useNotes = (
  projectId: number,
  documentId: number,
  sectionId?: number | null,
  options?: { refetchInterval?: number | false },
) =>
  useQuery({
    queryKey: ['notes', projectId, documentId, sectionId],
    queryFn: () => documentsApi.getNotes(projectId, documentId, sectionId ?? undefined),
    enabled: projectId > 0 && documentId > 0,
    refetchInterval: options?.refetchInterval,
  });

export const useCreateNote = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, sectionId, references }: { content: string; sectionId?: number | null; references?: NoteReference[] }) =>
      documentsApi.addNote(projectId, documentId, content, sectionId ?? undefined, references ?? []),
    onSuccess: (_, { sectionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['notes', projectId, documentId] });
      void queryClient.invalidateQueries({ queryKey: ['notes', projectId, documentId, sectionId] });
      toast.success('Note added');
    },
    onError: () => toast.error('Failed to add note'),
  });
};
