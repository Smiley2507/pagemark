import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface EvidenceData {
  type: string
  path?: string
  description: string
}

interface EvidenceTooltipProps {
  evidence: EvidenceData
  children: React.ReactNode
}

export function EvidenceTooltip({ evidence, children }: EvidenceTooltipProps) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(null)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        if (timer.current) clearTimeout(timer.current)
        setOpen(true)
      }}
      onMouseLeave={() => {
        timer.current = setTimeout(() => setOpen(false), 200)
      }}
    >
      {children}
      {open && (
        <span
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2"
          onMouseEnter={() => {
            if (timer.current) clearTimeout(timer.current)
            setOpen(true)
          }}
          onMouseLeave={() => {
            timer.current = setTimeout(() => setOpen(false), 200)
          }}
        >
          <span className="block w-64 rounded-lg border border-border bg-popover p-3 shadow-lg">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-interaction/60" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{evidence.type}</p>
                {evidence.path && (
                  <p className="mt-0.5 truncate font-mono text-meta-sm text-muted-foreground">{evidence.path}</p>
                )}
                <p className="mt-1 text-meta-sm text-muted-foreground">{evidence.description}</p>
              </div>
            </div>
          </span>
          <span className="block h-2 w-2 -mt-1 mx-auto rotate-45 border-l border-b border-border bg-popover" />
        </span>
      )}
    </span>
  )
}

interface EvidenceMarkerProps {
  evidence: EvidenceData
  className?: string
}

export function EvidenceMarker({ evidence, className }: EvidenceMarkerProps) {
  return (
    <EvidenceTooltip evidence={evidence}>
      <sup
        className={cn(
          'inline-block h-1.5 w-1.5 rounded-full bg-interaction/60 cursor-help align-super mx-0.5',
          'ring-1 ring-background',
          className,
        )}
        aria-label={`Evidence: ${evidence.description}`}
      />
    </EvidenceTooltip>
  )
}
