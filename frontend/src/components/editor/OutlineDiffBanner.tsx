import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { analysisApi } from '@/api/analysis'

interface OutlineDiffBannerProps {
  projectId: number
  documentId?: number
}

export function OutlineDiffBanner({ projectId, documentId }: OutlineDiffBannerProps) {
  const queryClient = useQueryClient()

  const { data: diff } = useQuery({
    queryKey: ['outline-diff', projectId],
    queryFn: () => analysisApi.getOutlineDiff(projectId),
    enabled: projectId > 0,
  })

  const apply = useMutation({
    mutationFn: () => analysisApi.applyOutline(projectId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['outline-diff', projectId] })
      if (documentId) {
        queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      }
    },
  })

  if (!diff?.has_changes) return null

  function getHeading(key: string) {
    const match = key.match(/^(#{1,6})\s+(.+)$/)
    if (match) return { level: match[1].length, text: match[2] }
    return { level: 1, text: key }
  }

  function isNew(key: string) {
    return !diff!.current.includes(key)
  }

  function isRemoved(key: string) {
    return !diff!.proposed.includes(key)
  }

  function isModified(key: string) {
    return diff!.current.includes(key) && diff!.proposed.includes(key) && false
  }

  return (
    <div className="mx-auto mb-6 w-full max-w-5xl rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-amber-800/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-600 dark:text-amber-400">
            <path d="M8 1v14M1 8h14" />
          </svg>
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Outline changes available
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => apply.mutate()}
            disabled={apply.isPending}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-meta-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {apply.isPending ? 'Applying...' : 'Apply'}
          </button>
          <button
            onClick={() => queryClient.setQueryData(['outline-diff', projectId], { ...diff, has_changes: false })}
            className="rounded-md px-3 py-1.5 text-meta-sm font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
          >
            Dismiss
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="text-meta-sm text-amber-700 dark:text-amber-400 mb-3">
          Analysis suggests the following outline changes based on updated source code:
        </div>
        <div className="space-y-1.5">
          {diff.proposed.map((key) => {
            const h = getHeading(key)
            return (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-meta-sm"
              >
                {isNew(key) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2v8M2 6h8" />
                    </svg>
                    New
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                    Kept
                  </span>
                )}
                <span style={{ paddingLeft: `${(h.level - 1) * 16}px` }} className="text-foreground">
                  {h.text}
                </span>
              </div>
            )
          })}
          {diff.current.filter((k) => !diff.proposed.includes(k)).map((key) => {
            const h = getHeading(key)
            return (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-meta-sm"
              >
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6h8" />
                  </svg>
                  Removed
                </span>
                <span style={{ paddingLeft: `${(h.level - 1) * 16}px` }} className="text-muted-foreground line-through">
                  {h.text}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
