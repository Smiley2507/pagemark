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
  suggested_content_md?: string | null;
  reasoning: string;
}

export interface RefineDiff {
  original: string;
  refined: string;
  added: number;
  removed: number;
  diff_lines: { type: 'added' | 'removed' | 'unchanged'; content: string; line_number: number }[];
  action?: 'ask_user' | 'insufficient_context';
  question?: string;
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

export type AIProposedChangeType =
  | 'generate_section'
  | 'rewrite_selection'
  | 'insert_at_cursor'
  | 'replace_selection'
  | 'rename_section'
  | 'add_section'
  | 'reorder_sections'
  | 'apply_outline_diff';

export interface AIProposedChange {
  id: number;
  work_run_id: number;
  document_id: number;
  section_id?: number | null;
  change_type: AIProposedChangeType;
  status: 'proposed' | 'accepted' | 'rejected' | 'undone';
  title: string;
  rationale?: string | null;
  before?: Record<string, unknown> | null;
  after: Record<string, unknown>;
  preview_markdown?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  undone_at?: string | null;
  created_at: string;
}

export interface AIWorkRun {
  id: number;
  document_id: number;
  provider?: string | null;
  model?: string | null;
  prompt_context: Record<string, unknown>;
  status: 'pending' | 'running' | 'proposed' | 'partially_accepted' | 'accepted' | 'rejected' | 'undone' | 'failed';
  estimated_prompt_tokens?: number | null;
  estimated_completion_tokens?: number | null;
  estimated_cost?: number | null;
  actual_prompt_tokens?: number | null;
  actual_completion_tokens?: number | null;
  actual_cost?: number | null;
  undo_group?: Record<string, unknown> | null;
  proposed_changes: AIProposedChange[];
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface AIEditorReference {
  type: 'section' | 'document' | 'source' | 'template' | 'transient';
  id?: number | null;
  label?: string | null;
}

export interface AIEditorSelection {
  section_id: number;
  from?: number | null;
  to?: number | null;
  text: string;
}

export interface AIEditorCursor {
  section_id: number;
  pos?: number | null;
}

export interface AIChatActionRequest {
  message: string;
  mode?: 'chat' | 'generate' | 'refine' | 'expand' | 'auto';
  model_name?: string | null;
  target_section_id?: number | null;
  selection?: AIEditorSelection | null;
  cursor?: AIEditorCursor | null;
  references?: AIEditorReference[];
  resource_ids?: number[];
}

export type AIChatActionType =
  | 'answer'
  | 'ask_user'
  | 'insufficient_context'
  | 'insert_at_cursor'
  | 'replace_selection'
  | 'rewrite_section'
  | 'append_to_section'
  | 'rename_section'
  | 'add_section';

export interface AIChatActionResponse {
  message: string;
  action: AIChatActionType | string;
  action_payload?: {
    title?: string;
    section_id?: number;
    content_md?: string;
    rationale?: string | null;
  } | null;
  work_run?: AIWorkRun | null;
}

// ── Section AI ────────────────────────────────────────────────────────────────

export const aiApi = {
  /** Generate content for a section → returns full saved Section */
  async generateSection(sectionId: number, modelName?: string | null): Promise<Section> {
    const { data } = await apiClient.post(`/sections/${sectionId}/ai/generate`, {
      model_name: modelName || undefined,
    });
    return data;
  },

  /** Refine section content with an instruction → returns diff preview */
  async refineSection(sectionId: number, instruction: string, modelName?: string | null): Promise<RefineDiff> {
    const { data } = await apiClient.post(`/sections/${sectionId}/ai/refine`, {
      instruction,
      model_name: modelName || undefined,
    });
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
  async suggestStructure(projectId: number, documentId: number): Promise<StructuralSuggestion[]> {
    const { data } = await apiClient.post(`/projects/${projectId}/documents/${documentId}/ai/suggest-structure`);
    return data.suggestions ?? [];
  },

  async createWorkRun(
    projectId: number,
    documentId: number,
    payload: {
      provider?: string | null;
      model?: string | null;
      prompt_context?: Record<string, unknown>;
      estimated_prompt_tokens?: number;
      estimated_completion_tokens?: number;
      estimated_cost?: number;
      changes?: Array<{
        change_type: AIProposedChangeType;
        title: string;
        section_id?: number | null;
        rationale?: string | null;
        before?: Record<string, unknown> | null;
        after: Record<string, unknown>;
        preview_markdown?: string | null;
      }>;
    },
  ): Promise<AIWorkRun> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/ai/work-runs`,
      payload,
    );
    return data;
  },

  async listProposedChanges(projectId: number, documentId: number): Promise<AIProposedChange[]> {
    const { data } = await apiClient.get(
      `/projects/${projectId}/documents/${documentId}/ai/proposed-changes`,
    );
    return data.proposed_changes ?? [];
  },

  async previewProposedChange(projectId: number, documentId: number, changeId: number): Promise<{
    change: AIProposedChange;
    preview: Record<string, unknown>;
  }> {
    const { data } = await apiClient.get(
      `/projects/${projectId}/documents/${documentId}/ai/proposed-changes/${changeId}/preview`,
    );
    return data;
  },

  async acceptProposedChange(projectId: number, documentId: number, changeId: number): Promise<AIProposedChange> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/ai/proposed-changes/${changeId}/accept`,
    );
    return data;
  },

  async rejectProposedChange(projectId: number, documentId: number, changeId: number): Promise<AIProposedChange> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/ai/proposed-changes/${changeId}/reject`,
    );
    return data;
  },

  async undoWorkRun(projectId: number, documentId: number, runId: number): Promise<AIWorkRun> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/ai/work-runs/${runId}/undo`,
    );
    return data;
  },

  async createChatAction(
    projectId: number,
    documentId: number,
    payload: AIChatActionRequest,
  ): Promise<AIChatActionResponse> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/ai/chat-actions`,
      payload,
    );
    return data;
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
    modelName?: string | null,
    targetSectionId?: number | null,
    temperature?: number,
    maxTokens?: number,
  ): AbortController {
    const controller = new AbortController();

    const baseURL =
      import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

    const body: Record<string, unknown> = { message };
    if (resourceIds && resourceIds.length > 0) {
      body.resource_ids = resourceIds;
    }
    if (references && references.length > 0) {
      body.references = references;
    }
    if (modelName) body.model_name = modelName;
    if (targetSectionId) body.target_section_id = targetSectionId;
    if (typeof temperature === 'number') body.temperature = temperature;
    if (typeof maxTokens === 'number') body.max_tokens = maxTokens;

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
