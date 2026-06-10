import { getSectionState } from '@/lib/section-state'
import type { Section } from '@/types'

const statusColors: Record<string, string> = {
  pending: 'bg-muted-foreground',
  unreviewed_edits: 'bg-status-danger-foreground',
  generated_draft: 'bg-status-info-foreground',
  reviewed: 'bg-status-success-foreground',
  potentially_stale: 'bg-status-warning-foreground',
  needs_input: 'bg-status-danger-foreground',
  generating: 'bg-status-info-foreground',
  failed: 'bg-status-danger-foreground',
}

interface SectionStatusDotProps {
  section: Section
}

export function SectionStatusDot({ section }: SectionStatusDotProps) {
  const state = getSectionState(section)
  const colorClass = statusColors[state.key] || 'bg-muted-foreground'

  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${colorClass} ring-2 ring-transparent transition-all duration-150`}
      aria-label={state.summary}
    />
  )
}
