import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';
import { toast } from 'sonner';

type CreateAiWorkRunPayload = Parameters<typeof aiApi.createWorkRun>[2];
type CreateAiChatActionPayload = Parameters<typeof aiApi.createChatAction>[2];

export const useGenerateSection = (projectId: number) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sectionId, modelName }: { sectionId: number; modelName?: string | null }) =>
      aiApi.generateSection(sectionId, modelName),
    onSuccess: (_data, { sectionId }) => {
      // Invalidate relevant queries to fetch fresh data
      queryClient.invalidateQueries({ queryKey: ['section', sectionId] });
      queryClient.invalidateQueries({ queryKey: ['document', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['versions', sectionId] });
      toast.success('Section generated successfully');
    },
    onError: (error) => {
      console.error('Failed to generate section:', error);
      toast.error('Failed to generate section content');
    },
  });
};

export const useRefineSection = () => {
  return useMutation({
    mutationFn: ({ sectionId, instruction, modelName }: { sectionId: number; instruction: string; modelName?: string | null }) =>
      aiApi.refineSection(sectionId, instruction, modelName),
    onError: (error) => {
      console.error('Failed to refine section:', error);
      toast.error('Failed to generate refinement');
    },
  });
};

export const useAcceptRefinement = (projectId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sectionId, refinedContent, instruction }: { sectionId: number; refinedContent: string; instruction?: string }) =>
      aiApi.acceptRefinement(sectionId, refinedContent, instruction),
    onSuccess: (data, { sectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['section', sectionId] });
      queryClient.invalidateQueries({ queryKey: ['document', projectId] });
      queryClient.invalidateQueries({ queryKey: ['versions', sectionId] });
      toast.success('Refinement accepted');
    },
    onError: (error) => {
      console.error('Failed to accept refinement:', error);
      toast.error('Failed to save accepted refinement');
    },
  });
};

export const useThreads = (projectId: number) => {
  return useQuery({
    queryKey: ['chat-threads', projectId],
    queryFn: () => aiApi.getThreads(projectId),
    enabled: projectId > 0,
  });
};

export const useCreateThread = (projectId: number) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ title, firstMessage }: { title?: string; firstMessage?: string }) => 
      aiApi.createThread(projectId, title, firstMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-threads', projectId] });
    },
  });
};

export const useMessages = (threadId: number | null) => {
  return useQuery({
    queryKey: ['chat-messages', threadId],
    queryFn: () => aiApi.getMessages(threadId!),
    enabled: threadId !== null && threadId > 0,
  });
};

export const useStreamMessage = (threadId: number | null) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const sendMessage = useCallback((
    message: string,
    resourceIds?: number[],
    references?: string[],
    modelName?: string | null,
    targetSectionId?: number | null,
    temperature?: number,
    maxTokens?: number,
    threadIdOverride?: number,
  ) => {
    const targetThreadId = threadIdOverride || threadId;
    if (!targetThreadId) return;

    setIsStreaming(true);
    setStreamingContent('');

    // Cancel any previous stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = aiApi.streamMessage(
      targetThreadId,
      message,
      (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      },
      () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['chat-messages', targetThreadId] });
      },
      (error) => {
        console.error('Streaming error:', error);
        toast.error('Error generating response');
      },
      resourceIds,
      references,
      modelName,
      targetSectionId,
      temperature,
      maxTokens,
    );
  }, [threadId, queryClient]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: ['chat-messages', threadId] });
    }
  }, [threadId, queryClient]);

  return {
    sendMessage,
    isStreaming,
    streamingContent,
    cancelStream,
  };
};

export const useSuggestStructure = () => {
  return useMutation({
    mutationFn: (documentId: number) => aiApi.suggestStructure(documentId),
    onError: (error) => {
      console.error('Failed to suggest structure:', error);
      toast.error('Failed to generate structural suggestions');
    },
  });
};

export const useAiProposedChanges = (projectId: number, documentId: number) => {
  return useQuery({
    queryKey: ['ai-proposed-changes', projectId, documentId],
    queryFn: () => aiApi.listProposedChanges(projectId, documentId),
    enabled: projectId > 0 && documentId > 0,
  });
};

export const useCreateAiWorkRun = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAiWorkRunPayload) => aiApi.createWorkRun(projectId, documentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-proposed-changes', projectId, documentId] });
      toast.success('AI change queued for review');
    },
    onError: () => {
      toast.error('Failed to queue AI change');
    },
  });
};

export const useCreateAiChatAction = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAiChatActionPayload) => aiApi.createChatAction(projectId, documentId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-proposed-changes', projectId, documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-sections', projectId, documentId] });
      if (data.work_run) {
        toast.success('AI action queued for review');
      }
    },
    onError: (error) => {
      console.error('Failed to create AI editor action:', error);
      toast.error('AI editor action failed');
    },
  });
};

export const useAcceptAiProposedChange = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changeId: number) => aiApi.acceptProposedChange(projectId, documentId, changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-proposed-changes', projectId, documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-sections', projectId, documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-meta', projectId, documentId] });
      toast.success('AI change accepted');
    },
    onError: () => {
      toast.error('Failed to accept AI change');
    },
  });
};

export const useRejectAiProposedChange = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changeId: number) => aiApi.rejectProposedChange(projectId, documentId, changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-proposed-changes', projectId, documentId] });
      toast.success('AI change rejected');
    },
    onError: () => {
      toast.error('Failed to reject AI change');
    },
  });
};

export const useUndoAiWorkRun = (projectId: number, documentId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: number) => aiApi.undoWorkRun(projectId, documentId, runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-proposed-changes', projectId, documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-sections', projectId, documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-meta', projectId, documentId] });
      toast.success('AI work run undone');
    },
    onError: () => {
      toast.error('Failed to undo AI work run');
    },
  });
};

export const useUpdateProjectContext = (projectId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contextMd: string | null) => aiApi.updateContext(projectId, contextMd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['ai-context', projectId] });
      toast.success('Project context updated');
    },
    onError: () => {
      toast.error('Failed to update project context');
    }
  });
};
