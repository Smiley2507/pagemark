import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Loader2, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { PhrasingModal } from './PhrasingModal';
import { sectionsApi } from '@/api/sections';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  onSectionsChange?: (sections: Section[]) => void;
  mode: MiddlePanelMode;
  onModeChange: (mode: MiddlePanelMode) => void;
  diffData?: DiffData;
  onDiffAccept?: () => void;
  onDiffReject?: () => void;
}

// ── Components ───────────────────────────────────────────────────────────────────

function SortableSection({
  section,
  content,
  onChange,
  onTitleCommit,
  onDelete,
  activeSectionId,
  setActiveSectionId,
  onPolish,
  editorRefCallback,
  sectionRefCallback,
}: {
  section: Section;
  content: string;
  onChange: (val: string) => void;
  onTitleCommit: (title: string) => void;
  onDelete: (id: number) => void;
  activeSectionId: number | null;
  setActiveSectionId: (id: number) => void;
  onPolish: (text: string) => void;
  editorRefCallback: (ref: any) => void;
  sectionRefCallback: (el: HTMLDivElement | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(section.title ?? section.heading);
  const confidenceScore = section.confidence_score;
  const displayTitle = section.title?.trim() ? section.title : section.heading;

  useEffect(() => {
    setDraftTitle(section.title ?? section.heading);
  }, [section.id, section.title, section.heading]);

  const commitTitle = () => {
    setIsEditingTitle(false);
    const currentTitle = section.title ?? section.heading;
    if (draftTitle === currentTitle) return;
    onTitleCommit(draftTitle);
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        sectionRefCallback(el);
      }}
      data-section-id={String(section.id)}
      style={style}
      className={cn(
        "group mb-16 relative",
        activeSectionId === section.id && "ring-1 ring-primary/20 rounded-lg p-2 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded text-muted-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {isEditingTitle ? (
          <input
            className="text-title font-semibold bg-transparent border-b border-primary outline-none w-full max-w-md"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') {
                setDraftTitle(section.title ?? section.heading);
                setIsEditingTitle(false);
              }
            }}
          />
        ) : (
          <h2
            className="text-title font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => setIsEditingTitle(true)}
          >
            {displayTitle}
          </h2>
        )}

        <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {confidenceScore != null && (
            <div className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              confidenceScore >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
              confidenceScore >= 50 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}>
              {confidenceScore}%
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(section.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div style={{ height: editorHeight(content) }}>
        <MarkdownEditor
          ref={editorRefCallback}
          value={content}
          onChange={(val) => onChange(val)}
        />
      </div>
    </div>
  );
}

function DndEditorWrapper({
  sections,
  localContent,
  handleSectionChange,
  handleTitleCommit,
  handleDeleteSection,
  activeSectionId,
  setActiveSectionId,
  onPolish,
  editorRefCallback,
  onDragEnd,
  onAddSection,
  sectionRefCallback,
}: {
  sections: Section[];
  localContent: Record<number, string>;
  handleSectionChange: (id: number, val: string) => void;
  handleTitleCommit: (id: number, title: string) => void;
  handleDeleteSection: (id: number) => void;
  activeSectionId: number | null;
  setActiveSectionId: (id: number) => void;
  onPolish: (id: number, text: string) => void;
  editorRefCallback: (id: number, ref: any) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onAddSection: (projectId: number) => void;
  sectionRefCallback: (id: number, el: HTMLDivElement | null) => void;
}) {
  const pointerSensor = useSensor(PointerSensor);
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={sections.map(s => s.id)}
        strategy={verticalListSortingStrategy}
      >
        {sections.map((section, idx) => (
          <Fragment key={section.id}>
            <SortableSection
              section={section}
              content={localContent[section.id] ?? section.content_md}
              onChange={(val) => handleSectionChange(section.id, val)}
              onTitleCommit={(title) => handleTitleCommit(section.id, title)}
              onDelete={(id) => handleDeleteSection(id)}
              activeSectionId={activeSectionId}
              setActiveSectionId={setActiveSectionId}
              onPolish={(text) => onPolish(section.id, text)}
              editorRefCallback={(ref) => editorRefCallback(section.id, ref)}
              sectionRefCallback={(el) => sectionRefCallback(section.id, el)}
            />
            {idx < sections.length - 1 && (
              <div className="my-8 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0 hover:bg-primary/10"
                  onClick={() => onAddSection(sections[0]?.document_id || 0)}
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}
          </Fragment>
        ))}
      </SortableContext>
    </DndContext>
  );
}

// ── Editor height helper ──────────────────────────────────────────────────────
// CodeMirror (MarkdownEditor) uses height:100% internally.
// We give each section wrapper an explicit pixel height so the editor fills it.

type LineKind = 'added' | 'removed' | 'unchanged';

interface DiffLine {
  kind: LineKind;
  content: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 p-1.5 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-accent rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 border border-border"
      aria-label="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-status-finalized-foreground" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
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
  onSectionsChange,
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
  const [isSaving, setIsSaving] = useState(false);
  const sectionEditorRefs = useRef<Record<number, any>>({});
  const [sortedSections, setSortedSections] = useState(sections);
  const [phrasingState, setPhrasingState] = useState<{
    isOpen: boolean;
    suggestions: string[];
    isLoading: boolean;
    activeSectionId: number | null;
    selectedText: string;
  }>({
    isOpen: false,
    suggestions: [],
    isLoading: false,
    activeSectionId: null,
    selectedText: '',
  });

  useEffect(() => {
    setSortedSections(sections);
  }, [sections]);

  const applySectionUpdate = (updater: (sections: Section[]) => Section[]) => {
    const next = updater(sortedSections);
    setSortedSections(next);
    onSectionsChange?.(next);
    return next;
  };

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedSections.findIndex(s => s.id === active.id);
    const newIndex = sortedSections.findIndex(s => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newOrder = arrayMove(sortedSections, oldIndex, newIndex);
    applySectionUpdate(() => newOrder);

    try {
      await sectionsApi.reorderSections(newOrder.map(s => s.id));
      toast.success("Section reordered");
    } catch (e) {
      toast.error("Failed to reorder sections");
      applySectionUpdate(() => sections);
    }
  };

  const handleTitleCommit = async (id: number, title: string) => {
    const previousSections = sortedSections;
    applySectionUpdate((current) =>
      current.map((section) =>
        section.id === id ? { ...section, title } : section
      )
    );

    try {
      const updatedSection = await sectionsApi.updateSectionTitle(id, title);
      applySectionUpdate((current) =>
        current.map((section) =>
          section.id === id ? { ...section, ...updatedSection } : section
        )
      );
      toast.success("Title updated");
    } catch (e) {
      applySectionUpdate(() => previousSections);
      toast.error("Failed to update title");
    }
  };

  const handleDeleteSection = async (id: number) => {
    if (!confirm("Delete this section?")) return;
    const previousSections = sortedSections;
    const nextSections = sortedSections.filter((section) => section.id !== id);
    applySectionUpdate(() => nextSections);
    if (activeSectionId === id) {
      const fallbackSection = nextSections[0];
      if (fallbackSection) onSectionVisible(fallbackSection.id);
    }

    try {
      await sectionsApi.deleteSection(id);
      toast.success("Section deleted");
    } catch (e) {
      applySectionUpdate(() => previousSections);
      toast.error("Failed to delete section");
    }
  };

  const handleAddSection = async (projectId: number) => {
    const title = prompt("Section Title:");
    if (!title) return;
    try {
      const createdSection = await sectionsApi.createCustomSection(projectId, title);
      const orderIndex = sortedSections.length;
      const section: Section = {
        id: createdSection.id,
        document_id: sortedSections[0]?.document_id ?? projectId,
        parent_id: undefined,
        order_index: orderIndex,
        sort_order: orderIndex,
        heading: createdSection.heading,
        title,
        content_md: '',
        status: 'pending',
        is_custom: true,
        lifecycle_status: 'active',
        confidence_score: null,
        children: [],
      };
      applySectionUpdate((current) => [...current, section]);
      setLocalContent((prev) => ({ ...prev, [section.id]: '' }));
      onSectionVisible(section.id);
      toast.success("Section added");
    } catch (e) {
      toast.error("Failed to add section");
    }
  };

  const handlePolishRequest = async (sectionId: number, text: string) => {
    setPhrasingState(prev => ({ ...prev, isOpen: true, isLoading: true, suggestions: [], activeSectionId: sectionId, selectedText: text }));
    try {
      const suggestions = await sectionsApi.getPhrasingSuggestions(sectionId, text);
      setPhrasingState(prev => ({ ...prev, isLoading: false, suggestions }));
    } catch (e) {
      toast.error("Failed to get phrasing suggestions");
      setPhrasingState(prev => ({ ...prev, isLoading: false, isOpen: false }));
    }
  };

  const handleSelectPhrasing = (suggestion: string) => {
    const { activeSectionId } = phrasingState;
    if (!activeSectionId) return;

    const editor = sectionEditorRefs.current[activeSectionId];
    if (editor && editor.replaceSelection) {
      editor.replaceSelection(suggestion);
    } else {
      toast.error("Could not replace text: editor not found");
    }

    setPhrasingState(prev => ({ ...prev, isOpen: false }));
  };
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Use a ref-based counter so overlapping async saves don't race with setState.
  const savingCountRef = useRef(0);
  const saveTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const lastPersistedRef = useRef<Record<number, string>>({});

  const handleSectionChange = useCallback((sectionId: number, value: string) => {
    setLocalContent((prev) => ({ ...prev, [sectionId]: value }));
    applySectionUpdate((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, content_md: value } : section
      )
    );

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
  }, [sortedSections, onSectionsChange]);

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
    if (!root || sortedSections.length === 0) return;

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
  }, [sortedSections, onSectionVisible]);

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
        <div className="mx-auto flex h-10 max-w-3xl items-center justify-between px-8">
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
      <div className="mx-auto max-w-3xl px-8 py-8">
        {/* ── Write mode ──────────────────────────────────────────────── */}
        {mode === 'write' && (
          <div className="relative">
            <DndEditorWrapper
              sections={sortedSections}
              localContent={localContent}
              handleSectionChange={handleSectionChange}
              handleTitleCommit={(id, title) => handleTitleCommit(id, title)}
              handleDeleteSection={handleDeleteSection}
              activeSectionId={activeSectionId}
              setActiveSectionId={onSectionVisible}
              onPolish={handlePolishRequest}
              editorRefCallback={(id, ref) => { sectionEditorRefs.current[id] = ref; }}
              onDragEnd={handleDragEnd}
              onAddSection={handleAddSection}
              sectionRefCallback={(id, el) => {
                if (el) sectionRefsMap.current.set(id, el);
                else sectionRefsMap.current.delete(id);
              }}
            />
            {sortedSections.length > 0 && (
               <div className="my-8 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0 hover:bg-primary/10"
                  onClick={() => handleAddSection(sortedSections[0]?.document_id || 0)}
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Preview mode ─────────────────────────────────────────────── */}
        {mode === 'preview' && (
          <div>
            {sortedSections.map((section) => (
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
                  {section.title?.trim() ? section.title : section.heading}
                </h2>
                <div className="prose prose-neutral max-w-none dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Code blocks follow the spec: bg-muted rounded-md px-4 py-3 font-mono text-sm
                      pre: ({ children, ...props }: any) => {
                        const codeElement = Array.isArray(children) ? children[0] : children;
                        const codeText = codeElement?.props?.children?.toString() || '';
                        
                        return (
                          <div className="relative group mb-4">
                            <CopyButton text={codeText} />
                            <pre
                              {...props}
                              className="rounded-md bg-muted px-4 py-3 font-mono text-sm overflow-x-auto m-0"
                            >
                              {children}
                            </pre>
                          </div>
                        );
                      },
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
                    {(localContent[section.id] ?? section.content_md).replace(/\n([^\n])/g, '  \n$1')}
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
                className="bg-status-finalized-foreground text-white hover:opacity-90"
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
                          ? 'border-destructive bg-destructive/10 text-foreground'
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
                          ? 'border-status-finalized-foreground bg-status-finalized/20 text-foreground'
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
      <PhrasingModal
        isOpen={phrasingState.isOpen}
        onClose={() => setPhrasingState(prev => ({ ...prev, isOpen: false }))}
        suggestions={phrasingState.suggestions}
        onSelect={handleSelectPhrasing}
        isLoading={phrasingState.isLoading}
      />
    </div>
  );
}
