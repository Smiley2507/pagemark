import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { sectionsApi } from '@/api/sections';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Section } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MiddlePanelMode = 'write' | 'preview' | 'diff';

export interface DiffData {
  original: string;
  refined: string;
}

export interface MiddlePanelProps {
  sections: Section[];
  activeSectionId: number | null;
  onSectionVisible: (sectionId: number) => void;
  mode: MiddlePanelMode;
  onModeChange: (mode: MiddlePanelMode) => void;
  diffData?: DiffData;
  onDiffAccept?: () => void;
  onDiffReject?: () => void;
}

// ── Line-diff algorithm (LCS-based) ──────────────────────────────────────────

type LineKind = 'added' | 'removed' | 'unchanged';

interface DiffLine {
  kind: LineKind;
  content: string;
}

/**
 * Computes a line-level diff using Longest Common Subsequence.
 * Returns two parallel views:
 *   left  — original lines, removed lines highlighted
 *   right — revised lines,  added lines highlighted
 */
function computeLineDiff(
  original: string,
  revised: string,
): { left: DiffLine[]; right: DiffLine[] } {
  const origLines = original.split('\n');
  const revLines = revised.split('\n');
  const m = origLines.length;
  const n = revLines.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        origLines[i - 1] === revLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to reconstruct the diff
  type Edit = { kind: LineKind; orig?: string; rev?: string };
  const edits: Edit[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === revLines[j - 1]) {
      edits.unshift({ kind: 'unchanged', orig: origLines[i - 1], rev: revLines[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.unshift({ kind: 'added', rev: revLines[j - 1] });
      j--;
    } else {
      edits.unshift({ kind: 'removed', orig: origLines[i - 1] });
      i--;
    }
  }

  // Build the two side-by-side views
  const left: DiffLine[] = edits
    .filter((e) => e.kind !== 'added')
    .map((e) => ({
      kind: e.kind === 'removed' ? 'removed' : 'unchanged',
      content: e.orig ?? '',
    }));

  const right: DiffLine[] = edits
    .filter((e) => e.kind !== 'removed')
    .map((e) => ({
      kind: e.kind === 'added' ? 'added' : 'unchanged',
      content: e.rev ?? '',
    }));

  return { left, right };
}

// ── Editor height helper ──────────────────────────────────────────────────────
// CodeMirror (MarkdownEditor) uses height:100% internally.
// We give each section wrapper an explicit pixel height so the editor fills it.
// The height grows reactively as the user types.

const LINE_HEIGHT_PX = 26; // Inter 15px × 1.7 ≈ 25.5, rounded up
const SECTION_PADDING_PX = 56; // top + bottom breathing room inside the wrapper
const MIN_EDITOR_HEIGHT_PX = 200;

function editorHeight(content: string): number {
  const lines = content.split('\n').length;
  return Math.max(MIN_EDITOR_HEIGHT_PX, lines * LINE_HEIGHT_PX + SECTION_PADDING_PX);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MiddlePanel({
  sections,
  activeSectionId,
  onSectionVisible,
  mode,
  onModeChange,
  diffData,
  onDiffAccept,
  onDiffReject,
}: MiddlePanelProps) {
  // ── Local content (tracks in-progress edits; never overwritten by prop refresh) ──
  const [localContent, setLocalContent] = useState<Record<number, string>>(
    () => Object.fromEntries(sections.map((s) => [s.id, s.content_md])),
  );

  // When the sections prop gains a new section (first load or new section added),
  // seed its content without clobbering any in-progress edit.
  useEffect(() => {
    setLocalContent((prev) => {
      const next = { ...prev };
      for (const s of sections) {
        if (!(s.id in next)) {
          next[s.id] = s.content_md;
        }
      }
      return next;
    });
  }, [sections]);

  // ── Autosave ─────────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Use a ref-based counter so overlapping async saves don't race with setState.
  const savingCountRef = useRef(0);
  const saveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const lastPersistedRef = useRef<Record<number, string>>({});

  const handleSectionChange = useCallback((sectionId: number, value: string) => {
    setLocalContent((prev) => ({ ...prev, [sectionId]: value }));

    // Debounce: cancel any pending save for this section and schedule a new one.
    if (saveTimersRef.current[sectionId]) {
      clearTimeout(saveTimersRef.current[sectionId]);
    }

    saveTimersRef.current[sectionId] = setTimeout(async () => {
      if (lastPersistedRef.current[sectionId] === value) return; // no-op if unchanged

      savingCountRef.current += 1;
      setIsSaving(true);

      try {
        const res = await sectionsApi.autosaveSection(sectionId, value);
        if (res.saved) {
          lastPersistedRef.current[sectionId] = value;
          setLastSaved(new Date(res.updated_at));
        }
      } catch {
        toast.error('Autosave failed');
      } finally {
        savingCountRef.current = Math.max(0, savingCountRef.current - 1);
        if (savingCountRef.current === 0) setIsSaving(false);
      }
    }, 3000);
  }, []);

  // Clear timers on unmount to prevent state updates on an unmounted component.
  useEffect(
    () => () => {
      for (const t of Object.values(saveTimersRef.current)) clearTimeout(t);
    },
    [],
  );

  // ── Section refs & scroll-spy via IntersectionObserver ───────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());

  // Stable observer setup — re-runs when the sections list changes so newly
  // added section divs get observed.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
            const rawId = (entry.target as HTMLElement).dataset.sectionId;
            const id = Number(rawId);
            if (!Number.isNaN(id)) onSectionVisible(id);
          }
        }
      },
      { root, threshold: 0.3 },
    );

    for (const el of sectionRefsMap.current.values()) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections, onSectionVisible]);

  // ── Scroll to active section when the TOC selection changes ─────────────────
  useEffect(() => {
    if (activeSectionId === null) return;
    const el = sectionRefsMap.current.get(activeSectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeSectionId]);

  // ── Diff computation (memoised — only recalculates when diffData changes) ───
  const diffResult = useMemo(() => {
    if (mode !== 'diff' || !diffData) return null;
    return computeLineDiff(diffData.original, diffData.refined);
  }, [mode, diffData]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {/* ── Floating toolbar ── */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-10 max-w-2xl items-center justify-between px-16">
          {/* Segmented mode control */}
          <div className="inline-flex rounded-lg bg-muted p-1">
            {(['write', 'preview', 'diff'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={cn(
                  'capitalize',
                  m === mode
                    ? 'rounded-md bg-background px-3 py-1 text-sm font-medium text-foreground shadow-sm'
                    : 'px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground',
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Autosave indicator — fades between Saving / Saved states */}
          <div className="flex h-6 w-24 items-center justify-end">
            {isSaving ? (
              <span
                key="saving"
                className="animate-fade-in flex items-center gap-1.5 text-meta text-muted-foreground"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            ) : lastSaved ? (
              <span
                key="saved"
                className="animate-fade-in flex items-center gap-1.5 text-meta text-muted-foreground"
              >
                <Check className="h-3 w-3" />
                Saved
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Content column ── */}
      <div className="mx-auto max-w-2xl px-16 py-12">
        {/* ── Write mode ──────────────────────────────────────────────── */}
        {mode === 'write' && (
          <div>
            {sections.map((section) => {
              const content = localContent[section.id] ?? section.content_md;
              return (
                <div
                  key={section.id}
                  data-section-id={String(section.id)}
                  ref={(el) => {
                    if (el) sectionRefsMap.current.set(section.id, el);
                    else sectionRefsMap.current.delete(section.id);
                  }}
                  className="mb-16"
                >
                  <h2 className="mb-4 text-title font-semibold text-foreground">
                    {section.heading}
                  </h2>
                  {/* Explicit height so CodeMirror's h-full has something to fill.
                      Recomputed on every keystroke so the editor grows with content. */}
                  <div style={{ height: editorHeight(content) }}>
                    <MarkdownEditor
                      value={content}
                      onChange={(val) => handleSectionChange(section.id, val)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Preview mode ─────────────────────────────────────────────── */}
        {mode === 'preview' && (
          <div>
            {sections.map((section) => (
              <div
                key={section.id}
                data-section-id={String(section.id)}
                ref={(el) => {
                  if (el) sectionRefsMap.current.set(section.id, el);
                  else sectionRefsMap.current.delete(section.id);
                }}
                className="mb-16"
              >
                <h2 className="mb-4 text-title font-semibold text-foreground">
                  {section.heading}
                </h2>
                <div className="prose prose-neutral max-w-none dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Code blocks follow the spec: bg-muted rounded-md px-4 py-3 font-mono text-sm
                      pre: ({ children, ...props }) => (
                        <pre
                          {...props}
                          className="rounded-md bg-muted px-4 py-3 font-mono text-sm overflow-x-auto"
                        >
                          {children}
                        </pre>
                      ),
                      code: ({ children, className, ...props }) => (
                        <code
                          {...props}
                          className={cn(
                            'font-mono text-sm',
                            // Inline code (no parent pre)
                            !className && 'rounded bg-muted px-1 py-0.5',
                            className,
                          )}
                        >
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {localContent[section.id] ?? section.content_md}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Diff mode ────────────────────────────────────────────────── */}
        {mode === 'diff' && diffResult && (
          <div>
            {/* Accept / Reject row */}
            <div className="mb-6 flex items-center justify-end gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={onDiffReject}
              >
                Reject
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={onDiffAccept}
              >
                Accept
              </Button>
            </div>

            {/* Side-by-side panels: 48% + 4% gap + 48% */}
            <div className="flex gap-[4%]">
              {/* Left — original, removed lines highlighted */}
              <div className="w-[48%]">
                <p className="mb-2 text-meta text-muted-foreground">Previous</p>
                <div className="overflow-auto rounded-md border border-border">
                  {diffResult.left.map((line, idx) => (
                    <div
                      // eslint-disable-next-line react/no-array-index-key
                      key={idx}
                      className={cn(
                        'border-l-2 px-3 py-0.5 font-mono text-sm leading-relaxed',
                        line.kind === 'removed'
                          ? 'border-red-500 bg-red-50 text-foreground dark:bg-red-950/20'
                          : 'border-transparent',
                      )}
                    >
                      {/* Preserve empty lines so the two sides stay visually aligned */}
                      {line.content || '\u00a0'}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — revised, added lines highlighted */}
              <div className="w-[48%]">
                <p className="mb-2 text-meta text-primary">Revised</p>
                <div className="overflow-auto rounded-md border border-border">
                  {diffResult.right.map((line, idx) => (
                    <div
                      // eslint-disable-next-line react/no-array-index-key
                      key={idx}
                      className={cn(
                        'border-l-2 px-3 py-0.5 font-mono text-sm leading-relaxed',
                        line.kind === 'added'
                          ? 'border-emerald-500 bg-emerald-50 text-foreground dark:bg-emerald-950/20'
                          : 'border-transparent',
                      )}
                    >
                      {line.content || '\u00a0'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state when diff mode is active but no diff data is available yet */}
        {mode === 'diff' && !diffResult && (
          <p className="py-8 text-center text-meta text-muted-foreground">
            Use the AI assistant to generate a suggestion, then review it here.
          </p>
        )}
      </div>
    </div>
  );
}
