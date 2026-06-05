import { Badge } from '@/components/ui/badge';
import { getSectionState } from '@/lib/section-state';
import type { Section } from '@/types';

const VARIANT_BY_TONE = {
  neutral: 'neutral',
  generation: 'generation',
  review: 'review',
  warning: 'warning',
  needsInput: 'needsInput',
  danger: 'danger',
} as const;

export function SectionStatusBadge({
  section,
  compact = false,
}: {
  section: Section;
  compact?: boolean;
}) {
  const state = getSectionState(section);
  return (
    <Badge
      variant={VARIANT_BY_TONE[state.tone]}
      aria-label={`${state.label}. ${state.summary}`}
      title={state.summary}
      className={compact ? 'gap-1 px-1.5 py-0 text-[11px]' : undefined}
    >
      {state.label}
    </Badge>
  );
}

