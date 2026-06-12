type DiffType = 'added' | 'removed' | 'unchanged'

interface DiffWord {
  text: string
  type: DiffType
}

interface DiffChunk {
  type: 'change'
  lines: { text: string; type: DiffType; words: DiffWord[] }[]
}

interface DiffResult {
  chunks: DiffChunk[]
  stats: { added: number; removed: number }
}

function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = eq(a[i - 1], b[j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

function backtrack<T>(a: T[], b: T[], dp: number[][], eq: (x: T, y: T) => boolean): { type: DiffType; item: T; indexA: number; indexB: number }[] {
  const result: { type: DiffType; item: T; indexA: number; indexB: number }[] = []
  let i = a.length
  let j = b.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && eq(a[i - 1], b[j - 1])) {
      result.unshift({ type: 'unchanged', item: a[i - 1], indexA: i - 1, indexB: j - 1 })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', item: b[j - 1], indexA: -1, indexB: j - 1 })
      j--
    } else {
      result.unshift({ type: 'removed', item: a[i - 1], indexA: i - 1, indexB: -1 })
      i--
    }
  }
  return result
}

function wordDiff(a: string, b: string): DiffWord[] {
  const wordsA = a.split(/(\s+)/)
  const wordsB = b.split(/(\s+)/)
  const eq = (x: string, y: string) => x === y
  const dp = lcs(wordsA, wordsB, eq)
  const trace = backtrack(wordsA, wordsB, dp, eq)
  return trace.map(({ type, item }) => ({ text: item, type }))
}

export function computeDiff(oldText: string, newText: string): DiffResult {
  const paragraphsA = oldText.split('\n')
  const paragraphsB = newText.split('\n')
  const eq = (x: string, y: string) => x === y
  const dp = lcs(paragraphsA, paragraphsB, eq)
  const trace = backtrack(paragraphsA, paragraphsB, dp, eq)

  const chunks: DiffChunk[] = []
  let currentChange: DiffChunk['lines'] | null = null
  let added = 0
  let removed = 0

  for (const entry of trace) {
    if (entry.type === 'unchanged') {
      if (currentChange && currentChange.length > 0) {
        chunks.push({ type: 'change', lines: currentChange })
        currentChange = null
      }
    } else {
      if (!currentChange) currentChange = []
      const words = entry.indexA >= 0 && entry.indexB >= 0
        ? wordDiff(paragraphsA[entry.indexA], paragraphsB[entry.indexB])
        : [{ text: entry.item as string, type: entry.type }]
      currentChange.push({ text: entry.item as string, type: entry.type, words })
      if (entry.type === 'added') added++
      if (entry.type === 'removed') removed++
    }
  }
  if (currentChange && currentChange.length > 0) {
    chunks.push({ type: 'change', lines: currentChange })
  }

  return { chunks, stats: { added, removed } }
}

function renderInlineMarkdown(text: string): (string | { text: string; bold?: boolean; code?: boolean })[] {
  const parts: (string | { text: string; bold?: boolean; code?: boolean })[] = []
  const remaining = text
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(remaining.slice(lastIndex, match.index))
    }
    const inner = match[0].slice(2, -2)
    if (match[0].startsWith('`')) {
      parts.push({ text: match[0].slice(1, -1), code: true })
    } else {
      parts.push({ text: inner, bold: true })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < remaining.length) {
    parts.push(remaining.slice(lastIndex))
  }
  return parts.length > 0 ? parts : [text]
}

interface DiffViewerProps {
  oldText?: string
  newText?: string
  oldContent?: string
  newContent?: string
  viewMode?: 'unified' | 'side-by-side'
  className?: string
}

export function DiffViewer({ oldText, newText, oldContent, newContent, viewMode = 'side-by-side', className }: DiffViewerProps) {
  const before = oldContent ?? oldText ?? ''
  const after = newContent ?? newText ?? ''
  const diff = computeDiff(before, after)

  if (viewMode === 'unified') {
    return (
      <div className={className}>
        <DiffStats added={diff.stats.added} removed={diff.stats.removed} />
        <div className="rounded-lg border border-border overflow-hidden">
          {diff.chunks.map((chunk, ci) => (
            <div key={ci} className="divide-y divide-border">
              {chunk.lines.map((line, li) => (
                <div
                  key={li}
                  className={cn(
                    'flex items-start gap-3 px-4 py-1.5 text-sm font-mono leading-relaxed',
                    line.type === 'added' && 'bg-status-success/10 border-l-2 border-status-success-foreground',
                    line.type === 'removed' && 'bg-status-danger/10 border-l-2 border-status-danger-foreground',
                  )}
                >
                  <span className="w-6 shrink-0 text-right text-meta-sm text-muted-foreground select-none">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="min-w-0 flex-1">
                    {line.words.map((word, wi) => (
                      <span
                        key={wi}
                        className={cn(
                          word.type === 'added' && 'bg-status-success-foreground/15 rounded px-0.5',
                          word.type === 'removed' && 'bg-status-danger-foreground/15 rounded px-0.5',
                        )}
                      >
                        {word.text}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {diff.chunks.length === 0 && (
            <div className="px-4 py-6 text-center text-meta-sm text-muted-foreground">No changes</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <DiffStats added={diff.stats.added} removed={diff.stats.removed} />
      <div className="grid grid-cols-2 gap-0 rounded-lg border border-border overflow-hidden">
        <div className="divide-y divide-border">
          <div className="sticky top-0 bg-panel-muted px-4 py-2 text-meta-sm font-medium text-muted-foreground border-b border-border">
            Original
          </div>
          {diff.chunks.length === 0 ? (
            <div className="px-4 py-6 text-center text-meta-sm text-muted-foreground">No changes</div>
          ) : (
            diff.chunks.map((chunk, ci) => (
              <div key={ci}>
                {chunk.lines
                  .filter(l => l.type !== 'added')
                  .map((line, li) => (
                    <div
                      key={li}
                      className={cn(
                        'px-4 py-1.5 text-sm leading-relaxed',
                        line.type === 'removed' && 'bg-status-danger/10',
                      )}
                    >
                      <span className="flex flex-wrap gap-0">
                        {line.words.map((word, wi) => (
                          <span
                            key={wi}
                            className={cn(
                              word.type === 'removed' && 'bg-status-danger-foreground/15 rounded px-0.5 line-through',
                            )}
                          >
                            {word.text}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
              </div>
            ))
          )}
        </div>
        <div className="divide-y divide-border border-l border-border">
          <div className="sticky top-0 bg-panel-muted px-4 py-2 text-meta-sm font-medium text-muted-foreground border-b border-border">
            Revised
          </div>
          {diff.chunks.length === 0 ? (
            <div className="px-4 py-6 text-center text-meta-sm text-muted-foreground">No changes</div>
          ) : (
            diff.chunks.map((chunk, ci) => (
              <div key={ci}>
                {chunk.lines
                  .filter(l => l.type !== 'removed')
                  .map((line, li) => (
                    <div
                      key={li}
                      className={cn(
                        'px-4 py-1.5 text-sm leading-relaxed',
                        line.type === 'added' && 'bg-status-success/10',
                      )}
                    >
                      <span className="flex flex-wrap gap-0">
                        {line.words.map((word, wi) => (
                          <span
                            key={wi}
                            className={cn(
                              word.type === 'added' && 'bg-status-success-foreground/15 rounded px-0.5',
                            )}
                          >
                            {word.text}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function DiffStats({ added, removed }: { added: number; removed: number }) {
  if (added === 0 && removed === 0) return null
  return (
    <div className="flex items-center gap-3 text-meta-sm">
      {added > 0 && (
        <span className="flex items-center gap-1 text-status-success-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-status-success-foreground" />
          +{added} lines
        </span>
      )}
      {removed > 0 && (
        <span className="flex items-center gap-1 text-status-danger-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-status-danger-foreground" />
          -{removed} lines
        </span>
      )}
    </div>
  )
}

import { cn } from '@/lib/utils'
