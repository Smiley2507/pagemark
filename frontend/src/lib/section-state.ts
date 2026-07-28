import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  LoaderCircle,
  PencilLine,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { Section } from '@/types';

export type SectionStateTone =
  | 'neutral'
  | 'generation'
  | 'review'
  | 'warning'
  | 'needsInput'
  | 'danger';

export interface SectionStateDescriptor {
  key:
    | 'pending'
    | 'unreviewed_edits'
    | 'generated_draft'
    | 'reviewed'
    | 'potentially_stale'
    | 'needs_input'
    | 'generating'
    | 'failed';
  label: string;
  tone: SectionStateTone;
  icon: ComponentType<{ className?: string }>;
  summary: string;
}

export function getSectionState(section: Section): SectionStateDescriptor {
  if (section.has_failed) {
    return {
      key: 'failed',
      label: 'Failed',
      tone: 'danger',
      icon: TriangleAlert,
      summary: 'Generation failed. Review the error and retry when ready.',
    };
  }

  if (section.is_generating) {
    return {
      key: 'generating',
      label: 'Generating',
      tone: 'generation',
      icon: LoaderCircle,
      summary: 'Content is being generated. Editing should wait until the draft is ready.',
    };
  }

  if (section.needs_input || section.status === 'needs_input' || section.status === 'NEEDS_INPUT') {
    return {
      key: 'needs_input',
      label: 'Needs Input',
      tone: 'needsInput',
      icon: AlertCircle,
      summary: 'Clarification is needed before this section can be completed confidently.',
    };
  }

  if (section.is_potentially_stale) {
    return {
      key: 'potentially_stale',
      label: 'Potentially Stale',
      tone: 'warning',
      icon: TriangleAlert,
      summary: 'Source changes were detected after review. Re-check the section before relying on it.',
    };
  }

  if (section.content_lifecycle === 'reviewed' || section.status === 'finalized') {
    return {
      key: 'reviewed',
      label: 'Reviewed',
      tone: 'review',
      icon: CheckCircle2,
      summary: 'The current content was explicitly accepted and review metadata is recorded.',
    };
  }

  if (section.content_lifecycle === 'generated_draft' || section.status === 'draft') {
    return {
      key: 'generated_draft',
      label: 'Generated Draft',
      tone: 'generation',
      icon: Sparkles,
      summary: 'AI-generated prose is present, but it stays draft content until explicit acceptance.',
    };
  }

  if (section.content_md.trim().length > 0) {
    return {
      key: 'unreviewed_edits',
      label: 'Unreviewed Edits',
      tone: 'neutral',
      icon: PencilLine,
      summary: 'Content exists, but it has not been explicitly accepted as reviewed.',
    };
  }

  return {
    key: 'pending',
    label: 'Pending',
    tone: 'neutral',
    icon: CircleDashed,
    summary: 'No reviewed or generated content is available yet.',
  };
}

