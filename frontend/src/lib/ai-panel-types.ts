import type { ReactNode } from 'react';
import type { AIEditorReference, AIEditorSelection, AIEditorCursor, AIProposedChange, AIWorkRun, AIChatActionRequest } from '@/api/ai';
import type { AiMode } from '@/store/aiStore';

export interface AiTarget {
  type: 'document' | 'section' | 'selection';
  sectionId: number | null;
  sectionHeading: string | null;
  selection: AIEditorSelection | null;
}

export type AiContextKind =
  | 'project_brief'
  | 'analysis'
  | 'source_connection'
  | 'template'
  | 'section'
  | 'document'
  | 'attached_resource'
  | 'selection';

export interface AiContextItem {
  id: string;
  kind: AiContextKind;
  label: string;
  description?: string;
  origin: 'inferred' | 'attached';
  removable: boolean;
}

export interface AiTranscriptTurn {
  id: string;
  role: 'user' | 'assistant';
  kind: 'message' | 'work_run' | 'clarification' | 'error';
  text: string;
  tone?: 'normal' | 'error';
  workRun?: AIWorkRun;
}

export interface AiReviewItem {
  id: number;
  workRunId: number;
  changeType: AIProposedChange['change_type'];
  status: AIProposedChange['status'];
  title: string;
  rationale: string | null;
  change: AIProposedChange;
  workRun?: AIWorkRun;
}

export type AiIssueKind = 'clarification' | 'clarification_section' | 'missing_provider' | 'stale_analysis' | 'grounding_warning';

export interface AiIssue {
  id: string;
  kind: AiIssueKind;
  message: string;
  actionable: boolean;
  answer?: string;
  relatedSectionId?: number | null;
}

export interface AiPanelState {
  target: AiTarget;
  transcript: AiTranscriptTurn[];
  reviewQueue: AiReviewItem[];
  reviewHistory: AiReviewItem[];
  issues: AiIssue[];
  contextItems: AiContextItem[];
}

// ── Pure mapping helpers ──────────────────────────────────────────────────

export function buildTarget(
  activeSectionId: number | null,
  activeSectionHeading: string | null,
  activeSelection: { sectionId: number; from: number; to: number; text: string } | null,
): AiTarget {
  if (activeSelection) {
    return {
      type: 'selection',
      sectionId: activeSelection.sectionId,
      sectionHeading: activeSectionHeading,
      selection: {
        section_id: activeSelection.sectionId,
        from: activeSelection.from,
        to: activeSelection.to,
        text: activeSelection.text,
      },
    };
  }
  if (activeSectionId) {
    return {
      type: 'section',
      sectionId: activeSectionId,
      sectionHeading: activeSectionHeading,
      selection: null,
    };
  }
  return {
    type: 'document',
    sectionId: null,
    sectionHeading: null,
    selection: null,
  };
}

export function splitReviewItems(
  proposedChanges: AIProposedChange[],
  turnChangeIds: Set<number>,
): { open: AiReviewItem[]; history: AiReviewItem[] } {
  const open: AiReviewItem[] = [];
  const history: AiReviewItem[] = [];

  for (const change of proposedChanges) {
    const item: AiReviewItem = {
      id: change.id,
      workRunId: change.work_run_id,
      changeType: change.change_type,
      status: change.status,
      title: change.title,
      rationale: change.rationale ?? null,
      change,
    };
    if (change.status === 'proposed') {
      open.push(item);
    } else {
      history.push(item);
    }
  }

  return { open, history };
}

export function splitTranscriptAndIssues(
  turns: Array<{
    id: string;
    role: 'user' | 'assistant';
    text: string;
    tone?: 'normal' | 'error';
    kind?: 'message' | 'clarification' | 'work_run';
    workRun?: AIWorkRun;
  }>,
): { transcript: AiTranscriptTurn[]; issues: AiIssue[] } {
  const transcript: AiTranscriptTurn[] = [];
  const issues: AiIssue[] = [];

  for (const turn of turns) {
    if (turn.kind === 'clarification') {
      issues.push({
        id: turn.id,
        kind: 'clarification',
        message: turn.text,
        actionable: true,
      });
    } else if (turn.kind === 'work_run') {
      transcript.push({
        id: turn.id,
        role: turn.role,
        kind: 'work_run',
        text: turn.text || 'AI proposed changes.',
        tone: turn.tone,
        workRun: turn.workRun,
      });
    } else {
      transcript.push({
        id: turn.id,
        role: turn.role,
        kind: turn.tone === 'error' ? 'error' : 'message',
        text: turn.text,
        tone: turn.tone,
      });
    }
  }

  return { transcript, issues };
}

export function parseMentions(
  text: string,
  sections: { id: number; heading: string }[],
): { cleanText: string; references: AIEditorReference[] } {
  const refs: AIEditorReference[] = [];
  const clean = text.replace(
    /@(section|document|source|template):([^@\n]+?)(?=\s|$)/g,
    (match, type, label) => {
      const trimmed = String(label).trim();
      const section =
        type === 'section'
          ? sections.find(
              (item) => item.heading.toLowerCase() === trimmed.toLowerCase(),
            )
          : null;
      refs.push({ type, id: section?.id ?? null, label: trimmed });
      return match;
    },
  );
  return { cleanText: clean, references: refs };
}

export function buildChatActionRequest(
  message: string,
  mode: AiMode,
  selectedModel: string | null,
  target: AiTarget,
  references: AIEditorReference[],
  resourceIds: number[],
  cursor: AIEditorCursor | null,
): AIChatActionRequest {
  return {
    message,
    mode,
    model_name: selectedModel,
    target_section_id: target.sectionId,
    selection: target.selection,
    cursor,
    references,
    resource_ids: resourceIds,
  };
}

export function buildAiPanelChatActionPayload({
  message,
  mode,
  selectedModel,
  target,
  references,
  resourceIds,
  cursor,
}: {
  message: string;
  mode: AiMode;
  selectedModel: string | null;
  target: AiTarget;
  references: AIEditorReference[];
  resourceIds: number[];
  cursor: { sectionId: number; pos: number } | AIEditorCursor | null;
}): AIChatActionRequest {
  const apiCursor = cursor
    ? {
        section_id: 'section_id' in cursor ? cursor.section_id : cursor.sectionId,
        pos: cursor.pos,
      }
    : null;

  return buildChatActionRequest(
    message,
    mode,
    selectedModel,
    target,
    references,
    resourceIds,
    apiCursor,
  );
}
