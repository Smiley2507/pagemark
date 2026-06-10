import { AlertTriangle, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StaleSectionBannerProps {
  sectionId: number
  reviewedAt: string | null
  onAccept: (sectionId: number) => void
  onReject: (sectionId: number) => void
  isProcessing?: boolean
}

export function StaleSectionBanner({
  sectionId,
  reviewedAt,
  onAccept,
  onReject,
  isProcessing,
}: StaleSectionBannerProps) {
  return (
    <div className="mx-auto max-w-5xl mb-2 rounded-lg border border-status-warning-foreground/25 bg-status-warning/10 px-4 py-2.5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning-foreground" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-text-primary">Source code changed</p>
          <p className="mt-0.5 text-muted-foreground">
            {reviewedAt
              ? `Reviewed on ${new Date(reviewedAt).toLocaleDateString()} — relevant source files have changed since.`
              : 'Relevant source files have changed since review.'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Review the section to verify it still reflects the current code. Pagemark will not overwrite reviewed content.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAccept(sectionId)}
            disabled={isProcessing}
            className="h-7 gap-1 text-xs"
          >
            <Check className="h-3 w-3" />
            Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReject(sectionId)}
            disabled={isProcessing}
            className="h-7 gap-1 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}
