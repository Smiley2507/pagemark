import apiClient from './client';
import type { Section, ChatMessage } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StructuralSuggestion {
  type: 'reorder' | 'rename' | 'add' | 'remove' | 'merge';
  section_id: number | null;
  target_section_id: number | null;
  heading: string | null;
  suggested_heading: string | null;
  suggested_order: number | null;
  suggested_parent_heading: string | null;
  reasoning: string;
}

export interface RefineDiff {
  original: string;
  refined: string;
  added: number;
  removed: number;
  diff_lines: { type: 'added' | 'removed' | 'unchanged'; content: string; line_number: number }[];
}

export interface OutlineSuggestion {
  heading: string;
  description?: string;
}

export interface ChatThread {
  id: number;
  project_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

// ── Section AI ────────────────────────────────────────────────────────────────

export const aiApi = {
  /** Generate content for a section → returns full saved Section */
  async generateSection(sectionId: number): Promise<Section> {
    const { data } = await apiClient.post(`/sections/${sectionId}/ai/generate`);
    return data;
  },

  /** Refine section content with an instruction → returns diff preview */
  async refineSection(sectionId: number, instruction: string): Promise<RefineDiff> {
    const { data } = await apiClient.post(`/sections/${sectionId}/ai/refine`, { instruction });
    return data;
  },

  /** Accept a refined suggestion → saves + creates version snapshot */
  async acceptRefinement(
    sectionId: number,
    refinedContent: string,
    instruction?: string,
  ): Promise<Section> {
    const { data } = await apiClient.post(`/sections/${sectionId}/ai/accept`, {
      refined_content: refinedContent,
      instruction: instruction ?? '',
    });
    return data;
  },

  /** Suggest structural changes (reorder, rename, add, remove, merge) for a document */
  async suggestStructure(documentId: number): Promise<StructuralSuggestion[]> {
    const { data } = await apiClient.post(`/documents/${documentId}/ai/suggest-structure`);
    return data.suggestions ?? [];
  },

  /** Generate a documentation outline for a project */
  async generateOutline(projectId: number): Promise<OutlineSuggestion[]> {
    const { data } = await apiClient.post(`/projects/${projectId}/ai/generate-outline`);
    return data.sections ?? data;
  },

  // ── Chat ──────────────────────────────────────────────────────────────────

  async createThread(projectId: number, title?: string, firstMessage?: string): Promise<ChatThread> {
    const { data } = await apiClient.post(`/projects/${projectId}/chat/threads`, {
      title,
      first_message: firstMessage,
    });
    return data;
  },

  async getThreads(projectId: number): Promise<ChatThread[]> {
    const { data } = await apiClient.get(`/projects/${projectId}/chat/threads`);
    return data;
  },

  async getMessages(threadId: number): Promise<ChatMessage[]> {
    const { data } = await apiClient.get(`/chat/threads/${threadId}/messages`);
    return data;
  },

  /**
   * Stream a chat message via SSE fetch.
   * onChunk is called for each text chunk; onDone when the stream completes.
   * resourceIds: IDs of Resource objects to attach as context.
   * references: section heading strings to include as context.
   */
  streamMessage(
    threadId: number,
    message: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError?: (err: Error) => void,
    resourceIds?: number[],
    references?: string[],
  ): AbortController {
    const controller = new AbortController();

    const baseURL =
      import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

    const body: Record<string, unknown> = { message };
    if (resourceIds && resourceIds.length > 0) {
      body.resource_ids = resourceIds;
    }
    if (references && references.length > 0) {
      body.references = references;
    }

    fetch(`${baseURL}/chat/threads/${threadId}/messages/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          throw new Error(`Stream request failed: ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6);
            if (payload === '[DONE]') {
              onDone();
              return;
            }
            if (payload) onChunk(payload);
          }
        }
        onDone();
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        onError?.(err);
        onDone();
      });

    return controller;
  },

  // ── Project Context ────────────────────────────────────────────────────────

  /** Update the AI context for a project */
  async updateContext(
    projectId: number,
    contextMd: string | null,
  ): Promise<void> {
    await apiClient.patch(`/projects/${projectId}/context`, { context_md: contextMd });
  },
};
