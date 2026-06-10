import { useState } from 'react'
import { useVersions, useVersionDiff, useRestoreVersion } from '@/hooks/useSections'
import { DiffViewer } from './DiffViewer'
import { cn } from '@/lib/utils'

interface VersionHistoryProps {
  sectionId: number
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VersionHistory({ sectionId, projectId, open, onOpenChange }: VersionHistoryProps) {
  const { data: versions, isLoading } = useVersions(sectionId)
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null)
  const { data: diff } = useVersionDiff(selectedVersionId)
  const restore = useRestoreVersion(projectId)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12" onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-2xl rounded-lg border border-border bg-popover shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Version History</h3>
          <button
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="p-4 text-center text-meta-sm text-muted-foreground">Loading versions...</div>
        ) : versions && versions.length > 0 ? (
          <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
            <div className="overflow-y-auto">
              {versions.map((version) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  selected={selectedVersionId === version.id}
                  onSelect={() => setSelectedVersionId(version.id === selectedVersionId ? null : version.id)}
                  onRestore={() => restore.mutate(version.id)}
                  isRestoring={restore.isPending}
                />
              ))}
            </div>

            {diff && (
              <div className="border-t border-border">
                <div className="px-4 py-2 text-meta-sm font-medium text-muted-foreground">Changes</div>
                <div className="px-2 pb-2">
                  <DiffViewer
                    oldContent={diff.content_old}
                    newContent={diff.content_new}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-meta-sm text-muted-foreground">No version history</div>
        )}
      </div>
    </div>
  )
}

interface VersionRowProps {
  version: {
    id: number
    author_type: string
    summary?: string
    added: number
    removed: number
    modified: number
    created_at: string
  }
  selected: boolean
  onSelect: () => void
  onRestore: () => void
  isRestoring: boolean
}

function VersionRow({ version, selected, onSelect, onRestore, isRestoring }: VersionRowProps) {
  const date = new Date(version.created_at)
  const label = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-border/50 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-muted/50',
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          'mt-1 inline-block h-2 w-2 shrink-0 rounded-full',
          version.author_type === 'user' ? 'bg-blue-500' : 'bg-interaction/60',
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-meta-sm font-medium text-foreground capitalize">
            {version.author_type === 'user' ? 'You' : 'AI'}
          </span>
          <span className="text-meta-sm text-muted-foreground">{label}</span>
        </div>
        {version.summary && (
          <p className="mt-0.5 text-meta-sm text-muted-foreground line-clamp-2">{version.summary}</p>
        )}
        <div className="mt-1 flex items-center gap-3 text-meta-sm text-muted-foreground">
          <span className="text-green-600 dark:text-green-400">+{version.added}</span>
          <span className="text-red-600 dark:text-red-400">-{version.removed}</span>
          <span>~{version.modified}</span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRestore()
        }}
        disabled={isRestoring}
        className="shrink-0 rounded-md px-2 py-1 text-meta-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
      >
        Restore
      </button>
    </div>
  )
}
