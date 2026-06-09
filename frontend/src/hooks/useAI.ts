import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';
import { toast } from 'sonner';

export const useGenerateSection = (projectId: number) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (sectionId: number) => aiApi.generateSection(sectionId),
    onSuccess: (data, sectionId) => {
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
    mutationFn: ({ sectionId, instruction }: { sectionId: number; instruction: string }) => 
      aiApi.refineSection(sectionId, instruction),
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

  const sendMessage = useCallback((message: string, resourceIds?: number[], references?: string[]) => {
    if (!threadId) return;

    setIsStreaming(true);
    setStreamingContent('');

    // Cancel any previous stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = aiApi.streamMessage(
      threadId,
      message,
      (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      },
      () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['chat-messages', threadId] });
      },
      (error) => {
        console.error('Streaming error:', error);
        toast.error('Error generating response');
      },
      resourceIds,
      references,
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

export const useUpdateProjectContext = (projectId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contextMd: string | null) => aiApi.updateContext(projectId, contextMd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Project context updated');
    },
    onError: () => {
      toast.error('Failed to update project context');
    }
  });
};
