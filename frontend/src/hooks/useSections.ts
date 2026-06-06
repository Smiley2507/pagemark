import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sectionsApi } from '@/api/sections';
import { documentsApi } from '@/api/documents';
import type { Section } from '@/types';

export const useDocument = (projectId: number) =>
  useQuery({
    queryKey: ['document', projectId],
    queryFn: () => sectionsApi.getDocument(projectId),
    enabled: projectId > 0,
  });

export const useSection = (sectionId: number | null) =>
  useQuery({
    queryKey: ['section', sectionId],
    queryFn: () => sectionsApi.getSection(sectionId!),
    enabled: sectionId !== null && sectionId > 0,
  });

export const useDocumentSections = (projectId: number, documentId: number) =>
  useQuery({
    queryKey: ['document-sections', projectId, documentId],
    queryFn: () => documentsApi.getSections(projectId, documentId),
    enabled: projectId > 0 && documentId > 0,
  });

export function useAutosave(sectionId: number | null, content: string) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastPersistedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (id: number, body: string) => {
    setIsSaving(true);
    try {
      const res = await sectionsApi.autosaveSection(id, body);
      if (res.saved) {
        lastPersistedRef.current = body;
        setLastSaved(new Date(res.updated_at));
      }
    } catch {
      toast.error('Autosave failed');
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!sectionId) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (lastPersistedRef.current === content) return;
      save(sectionId, content);
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sectionId, content, save]);

  useEffect(() => {
    lastPersistedRef.current = null;
    setLastSaved(null);
  }, [sectionId]);

  const markPersisted = useCallback((body: string, at?: string) => {
    lastPersistedRef.current = body;
    setLastSaved(at ? new Date(at) : new Date());
  }, []);

  return { isSaving, lastSaved, markPersisted };
}

export function useDocumentAutosave(
  projectId: number,
  documentId: number,
  sectionId: number | null,
  content: string,
) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastPersistedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (id: number, body: string) => {
    setIsSaving(true);
    try {
      const res = await documentsApi.autosaveDocumentSection(projectId, documentId, id, body);
      if (res.saved) {
        lastPersistedRef.current = body;
        setLastSaved(new Date(res.updated_at));
        void queryClient.invalidateQueries({ queryKey: ['document-sections', projectId, documentId] });
        void queryClient.invalidateQueries({ queryKey: ['document-meta', projectId, documentId] });
      }
    } catch {
      toast.error('Autosave failed');
    } finally {
      setIsSaving(false);
    }
  }, [documentId, projectId, queryClient]);

  useEffect(() => {
    if (!sectionId || projectId <= 0 || documentId <= 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (lastPersistedRef.current === content) return;
      save(sectionId, content);
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectId, documentId, sectionId, content, save]);

  useEffect(() => {
    lastPersistedRef.current = null;
    setLastSaved(null);
  }, [sectionId]);

  const markPersisted = useCallback((body: string, at?: string) => {
    lastPersistedRef.current = body;
    setLastSaved(at ? new Date(at) : new Date());
  }, []);

  return { isSaving, lastSaved, markPersisted };
}

export const useUpdateSection = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { content_md?: string; status?: Section['status'] };
    }) => sectionsApi.updateSection(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['document', projectId] });
      queryClient.invalidateQueries({ queryKey: ['section', id] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: () => toast.error('Failed to update section'),
  });
};

export const useUpdateDocumentSection = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { content_md?: string; status?: Section['status'] };
    }) => documentsApi.updateDocumentSection(projectId, documentId, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['document-sections', projectId, documentId] });
      queryClient.invalidateQueries({ queryKey: ['section', id] });
      queryClient.invalidateQueries({ queryKey: ['document', projectId] });
      queryClient.invalidateQueries({ queryKey: ['freshness', projectId, documentId] });
    },
    onError: () => toast.error('Failed to update section'),
  });
};

export const useAcceptSectionReview = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sectionId: number) => documentsApi.acceptSectionReview(sectionId),
    onSuccess: (section) => {
      queryClient.invalidateQueries({ queryKey: ['document-sections', projectId, documentId] });
      queryClient.invalidateQueries({ queryKey: ['section', section.id] });
      queryClient.invalidateQueries({ queryKey: ['document', projectId] });
      queryClient.invalidateQueries({ queryKey: ['activity', projectId] });
      queryClient.invalidateQueries({ queryKey: ['freshness', projectId, documentId] });
      toast.success('Section accepted as reviewed');
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useUpdateSectionStatus = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: Section['status'] }) =>
      sectionsApi.updateSectionStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: () => toast.error('Failed to update status'),
  });
};

export const useVersions = (sectionId: number | null) =>
  useQuery({
    queryKey: ['versions', sectionId],
    queryFn: () => sectionsApi.getVersions(sectionId!),
    enabled: sectionId !== null && sectionId > 0,
  });

export const useVersionDiff = (versionId: number | null) =>
  useQuery({
    queryKey: ['version-diff', versionId],
    queryFn: () => sectionsApi.getVersionDiff(versionId!),
    enabled: versionId !== null && versionId > 0,
  });

export const useRestoreVersion = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) => sectionsApi.restoreVersion(versionId),
    onSuccess: (section) => {
      queryClient.invalidateQueries({ queryKey: ['document', projectId] });
      queryClient.invalidateQueries({ queryKey: ['section', section.id] });
      queryClient.invalidateQueries({ queryKey: ['versions', section.id] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Version restored');
    },
    onError: () => toast.error('Failed to restore version'),
  });
};
