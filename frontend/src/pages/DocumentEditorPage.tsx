import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Download,
  GripVertical,
  Loader2,
  MoreHorizontal,
  PanelRightOpen,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { SectionStatusBadge } from '@/components/ui/section-status-badge';
import { Surface } from '@/components/ui/surface';
import { documentsApi, type Document } from '@/api/documents';
import { useDocumentAutosave, useDocumentSections, useUpdateDocumentSection } from '@/hooks/useSections';
import { getSectionState } from '@/lib/section-state';
import { cn } from '@/lib/utils';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import type { Section } from '@/types';

type FlatSection = Section & { depth: number };

type TocItem = {
  id: string;
  label: string;
  kind: 'section' | 'h1' | 'h2';
  sectionId: number;
};

function flattenSections(sections: Section[], depth = 0): FlatSection[] {
  return sections.flatMap((section) => [
    { ...section, depth },
    ...flattenSections(section.children || [], depth + 1),
  ]);
}

function parseHeadings(section: Section): TocItem[] {
  const items: TocItem[] = [];
  section.content_md.split('\n').forEach((line, index) => {
    const match = /^(#{1,2})\s+(.+)$/.exec(line.trim());
    if (match) {
      items.push({
        id: `section-${section.id}-heading-${index}`,
        label: match[2].trim(),
        kind: match[1].length === 1 ? 'h1' : 'h2',
        sectionId: section.id,
      });
    }
  });
  return items;
}

function buildToc(sections: FlatSection[]): TocItem[] {
  return sections.flatMap((section) => [
    {
      id: `section-${section.id}`,
      label: section.title || section.heading || 'Untitled Section',
      kind: 'section' as const,
      sectionId: section.id,
    },
    ...parseHeadings(section),
  ]);
}

function countWords(sections: Section[]): number {
  return sections.reduce((total, section) => {
    const text = `${section.title || section.heading} ${section.content_md}`
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#*_`>\-[\]()]/g, ' ');
    const words = text.trim().match(/\b[\w']+\b/g);
    return total + (words?.length || 0);
  }, 0);
}

function countQualityIssues(sections: Section[]): number {
  return sections.reduce((total, section) => {
    const metadata = section.workflow_metadata || {};
    const raw =
      metadata.grammar_issue_count ??
      metadata.style_issue_count ??
      metadata.quality_issue_count ??
      metadata.issue_count;
    return total + (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);
  }, 0);
}

function documentStatusLabel(document: Document | undefined): string {
  const raw = document?.status || 'empty';
  return raw
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusVariant(status: string | undefined): 'neutral' | 'success' | 'warning' | 'danger' | 'generation' | 'review' | 'needsInput' {
  if (status === 'approved' || status === 'reviewed') return 'review';
  if (status === 'generating' || status === 'draft') return 'generation';
  if (status === 'needs_input') return 'needsInput';
  if (status === 'potentially_stale') return 'warning';
  if (status === 'failed') return 'danger';
  if (status === 'empty') return 'neutral';
  return 'neutral';
}

function useTocKeyboardNavigation() {
  return useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-toc-item="true"]')
    );
    const currentIndex = buttons.indexOf(event.currentTarget);
    const nextIndex = event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
    buttons[nextIndex]?.focus();
  }, []);
}

function SectionBlock({
  projectId,
  documentId,
  section,
  index,
  total,
  onAdd,
  onDeleteRequest,
  onMove,
  onRename,
  onSavingChange,
  onSaved,
}: {
  projectId: number;
  documentId: number;
  section: FlatSection;
  index: number;
  total: number;
  onAdd: (anchorSectionId: number, placement: 'above' | 'below') => void;
  onDeleteRequest: (section: Section) => void;
  onMove: (sectionId: number, direction: 'up' | 'down') => void;
  onRename: (sectionId: number, title: string) => void;
  onSavingChange: (sectionId: number, isSaving: boolean) => void;
  onSaved: (date: Date) => void;
}) {
  const [content, setContent] = useState(section.content_md);
  const [title, setTitle] = useState(section.title || section.heading || 'Untitled Section');
  const updateSection = useUpdateDocumentSection(projectId, documentId);
  const { isSaving, lastSaved, markPersisted } = useDocumentAutosave(
    projectId,
    documentId,
    section.id,
    content,
  );

  useEffect(() => {
    setContent(section.content_md);
    setTitle(section.title || section.heading || 'Untitled Section');
    markPersisted(section.content_md, section.updated_at);
  }, [markPersisted, section.content_md, section.heading, section.id, section.title, section.updated_at]);

  useEffect(() => {
    onSavingChange(section.id, isSaving);
  }, [isSaving, onSavingChange, section.id]);

  useEffect(() => {
    if (lastSaved) onSaved(lastSaved);
  }, [lastSaved, onSaved]);

  const saveNow = async () => {
    const updated = await updateSection.mutateAsync({
      id: section.id,
      data: { content_md: content },
    });
    markPersisted(updated.content_md, updated.updated_at);
    toast.success('Section saved');
  };

  const commitTitle = () => {
    const nextTitle = title.trim() || 'Untitled Section';
    setTitle(nextTitle);
    if (nextTitle !== (section.title || section.heading)) {
      onRename(section.id, nextTitle);
    }
  };

  return (
    <section
      id={`section-${section.id}`}
      data-editor-section="true"
      className="group min-w-0 scroll-mt-24 overflow-x-hidden border-b border-separator py-10 last:border-b-0"
    >
      <div className="mx-auto max-w-3xl min-w-0">
        <div className="mb-4 flex items-start gap-3">
          <GripVertical className="mt-3 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              aria-label={`Heading for ${section.heading}`}
              className="h-auto border-transparent bg-transparent px-1 py-1 text-title font-semibold text-text-primary shadow-none focus-visible:border-interaction focus-visible:bg-panel focus-visible:px-2"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SectionStatusBadge section={section} compact />
              <span className="text-meta text-text-muted">{getSectionState(section).summary}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => onAdd(section.id, 'above')} aria-label="Add section above">
              <Plus className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onAdd(section.id, 'below')} aria-label="Add section below">
              <Plus className="h-4 w-4 rotate-180" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMove(section.id, 'up')}
              disabled={index === 0}
              aria-label="Move section up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onMove(section.id, 'down')}
              disabled={index >= total - 1}
              aria-label="Move section down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteRequest(section)} aria-label="Delete section">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-w-0 overflow-x-hidden rounded-md bg-canvas px-1 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
          <MarkdownEditor value={content} onChange={setContent} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-meta text-text-muted">
          <span>
            {isSaving ? 'Autosaving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Ready'}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={saveNow} disabled={updateSection.isPending}>
            {updateSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}

export function DocumentEditorPage() {
  const { projectId, documentId } = useParams<{ projectId: string; documentId: string }>();
  const pid = Number(projectId);
  const did = Number(documentId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recordRecentWork = useViewPreferenceStore((state) => state.recordRecentWork);
  const [titleDraft, setTitleDraft] = useState('');
  const [query, setQuery] = useState('');
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);
  const [savingSectionIds, setSavingSectionIds] = useState<Set<number>>(() => new Set());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const tocKeyboard = useTocKeyboardNavigation();
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const { data: document, isLoading: documentLoading } = useQuery({
    queryKey: ['document-meta', pid, did],
    queryFn: () => documentsApi.getDocument(pid, did),
    enabled: pid > 0 && did > 0,
  });

  const { data: sectionTree, isLoading: sectionsLoading } = useDocumentSections(pid, did);
  const sections = useMemo(() => flattenSections(sectionTree?.sections || []), [sectionTree?.sections]);
  const tocItems = useMemo(() => buildToc(sections), [sections]);
  const wordCount = useMemo(() => countWords(sections), [sections]);
  const issueCount = useMemo(() => countQualityIssues(sections), [sections]);
  const reviewedCount = document?.progress.reviewed_sections || 0;
  const reviewTotal = document?.progress.total_sections || sections.length;
  const isSaving = savingSectionIds.size > 0;

  const { data: freshnessData } = useQuery({
    queryKey: ['freshness', pid, did],
    queryFn: () => documentsApi.getFreshness(pid, did),
    enabled: pid > 0 && did > 0,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (document) setTitleDraft(document.title || 'Untitled Document');
  }, [document]);

  useEffect(() => {
    recordRecentWork({ projectId: pid, documentId: did, sectionId: sections[0]?.id });
  }, [did, pid, recordRecentWork, sections]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveTocId(visible.target.id);
      },
      { root, rootMargin: '-25% 0px -60% 0px', threshold: [0.1, 0.4, 0.8] },
    );
    root.querySelectorAll<HTMLElement>('[data-editor-section="true"]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);

  const updateDocumentTitle = useMutation({
    mutationFn: (title: string) => documentsApi.updateDocument(pid, did, { title }),
    onSuccess: (updated) => {
      setTitleDraft(updated.title);
      setLastSaved(new Date(updated.updated_at));
      void queryClient.invalidateQueries({ queryKey: ['document-meta', pid, did] });
    },
    onError: () => toast.error('Failed to rename document'),
  });

  const createSection = useMutation({
    mutationFn: async ({ anchorSectionId, placement }: { anchorSectionId?: number; placement?: 'above' | 'below' }) => {
      const section = await documentsApi.createSection(pid, did, 'New Section');
      const currentIds = sections.map((item) => item.id);
      if (anchorSectionId && placement) {
        const anchorIndex = currentIds.indexOf(anchorSectionId);
        const insertIndex = placement === 'above' ? anchorIndex : anchorIndex + 1;
        const nextIds = currentIds.filter((id) => id !== section.id);
        nextIds.splice(Math.max(0, insertIndex), 0, section.id);
        await documentsApi.reorderDocumentSections(pid, did, nextIds);
      }
      return section;
    },
    onSuccess: (section) => {
      void queryClient.invalidateQueries({ queryKey: ['document-sections', pid, did] });
      void queryClient.invalidateQueries({ queryKey: ['document-meta', pid, did] });
      requestAnimationFrame(() => {
        globalThis.document.getElementById(`section-${section.id}`)?.scrollIntoView({ block: 'center' });
      });
      toast.success('Section added');
    },
    onError: () => toast.error('Failed to add section'),
  });

  const renameSection = useMutation({
    mutationFn: ({ sectionId, title }: { sectionId: number; title: string }) =>
      documentsApi.updateDocumentSectionTitle(pid, did, sectionId, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document-sections', pid, did] });
      void queryClient.invalidateQueries({ queryKey: ['document-meta', pid, did] });
    },
    onError: () => toast.error('Failed to rename section'),
  });

  const reorderSections = useMutation({
    mutationFn: (sectionIds: number[]) => documentsApi.reorderDocumentSections(pid, did, sectionIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document-sections', pid, did] });
      void queryClient.invalidateQueries({ queryKey: ['document-meta', pid, did] });
    },
    onError: () => toast.error('Failed to reorder sections'),
  });

  const deleteSection = useMutation({
    mutationFn: (sectionId: number) => documentsApi.deleteDocumentSection(pid, did, sectionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document-sections', pid, did] });
      void queryClient.invalidateQueries({ queryKey: ['document-meta', pid, did] });
      toast.success('Section deleted');
    },
    onError: () => toast.error('Failed to delete section'),
  });

  const commitDocumentTitle = () => {
    const title = titleDraft.trim() || 'Untitled Document';
    setTitleDraft(title);
    if (title !== document?.title) {
      updateDocumentTitle.mutate(title);
    }
  };

  const moveSection = (sectionId: number, direction: 'up' | 'down') => {
    const currentIndex = sections.findIndex((section) => section.id === sectionId);
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sections.length) return;
    const nextSections = [...sections];
    const [moved] = nextSections.splice(currentIndex, 1);
    nextSections.splice(nextIndex, 0, moved);
    reorderSections.mutate(nextSections.map((section) => section.id));
  };

  const scrollToTocItem = (item: TocItem) => {
    globalThis.document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveTocId(item.id);
  };

  const runFind = () => {
    const needle = query.trim().toLowerCase();
    if (!needle) return;
    const match = sections.find((section) =>
      `${section.title || section.heading}\n${section.content_md}`.toLowerCase().includes(needle)
    );
    if (match) {
      globalThis.document.getElementById(`section-${match.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSavingChange = useCallback((sectionId: number, saving: boolean) => {
    setSavingSectionIds((current) => {
      const next = new Set(current);
      if (saving) next.add(sectionId);
      else next.delete(sectionId);
      return next;
    });
  }, []);

  const loading = documentLoading || sectionsLoading;
  const showSourceNotice = freshnessData?.freshness === 'stale' && (freshnessData?.stale_count || 0) > 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-workspace">
        <div className="flex items-center gap-3 text-body text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading document workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-screen grid-cols-[minmax(0,1fr)_3rem] grid-rows-[3.5rem_minmax(0,1fr)] bg-workspace text-text-primary lg:grid-cols-[18rem_minmax(0,1fr)_3rem]">
      <header className="col-span-2 row-start-1 flex items-center justify-between border-b border-separator bg-panel px-3 lg:col-span-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${pid}`)} aria-label="Back to project">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitDocumentTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            aria-label="Document title"
            className="h-9 max-w-xl border-transparent bg-transparent text-section font-semibold shadow-none focus-visible:border-interaction focus-visible:bg-panel"
          />
          <Badge variant={statusVariant(document?.status)}>{documentStatusLabel(document)}</Badge>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <div className="hidden items-center gap-1 rounded-md border border-input bg-panel px-2 lg:flex">
            <Search className="h-4 w-4 text-text-muted" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runFind();
              }}
              placeholder="Find"
              aria-label="Find in document"
              className="h-8 w-44 bg-transparent text-body text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          <span className="hidden text-meta text-text-muted sm:inline">
            {isSaving || updateDocumentTitle.isPending
              ? 'Saving...'
              : lastSaved
                ? `Saved ${lastSaved.toLocaleTimeString()}`
                : 'Autosave on'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
              const exportUrl = new URL(`/projects/${pid}/documents/${did}/export?format=markdown`, apiBase);
              window.open(exportUrl.toString(), '_blank');
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="ghost" size="icon" aria-label="Document tools">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <aside className="col-start-1 row-start-2 hidden min-h-0 border-r border-separator bg-panel lg:flex lg:flex-col">
        <div className="border-b border-separator px-4 py-3">
          <p className="text-meta font-medium uppercase text-text-muted">Outline</p>
        </div>
        <nav aria-label="Document table of contents" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {tocItems.map((item) => (
            <button
              key={item.id}
              type="button"
              data-toc-item="true"
              onClick={() => scrollToTocItem(item)}
              onKeyDown={tocKeyboard}
              className={cn(
                'block w-full rounded-md px-2 py-1.5 text-left text-meta transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                item.kind === 'h1' && 'pl-5',
                item.kind === 'h2' && 'pl-8',
                activeTocId === item.id || activeTocId === `section-${item.sectionId}`
                  ? 'bg-interaction-muted text-interaction-hover'
                  : 'text-text-secondary hover:bg-panel-muted hover:text-text-primary',
              )}
            >
              <span className="block truncate">{item.label}</span>
            </button>
          ))}
          {tocItems.length === 0 && (
            <Button type="button" size="sm" onClick={() => createSection.mutate({})} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Add Section
            </Button>
          )}
        </nav>
        <div className="space-y-2 border-t border-separator px-4 py-3 text-meta text-text-secondary">
          <div className="flex justify-between gap-3">
            <span>Words</span>
            <span className="font-medium text-text-primary">{wordCount}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Review</span>
            <span className="font-medium text-text-primary">{reviewedCount}/{reviewTotal}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Grammar/style</span>
            <span className="font-medium text-text-primary">{issueCount}</span>
          </div>
        </div>
      </aside>

      <main ref={scrollRootRef} className="col-start-1 row-start-2 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto bg-canvas lg:col-start-2">
        {showSourceNotice && (
          <div className="mx-auto max-w-3xl px-4 pt-5">
            <Notice variant="warning" title="Potentially Stale Sections">
              {freshnessData?.stale_count} reviewed sections show source changes since acceptance.
            </Notice>
          </div>
        )}

        {sections.length === 0 ? (
          <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16">
            <p className="mb-3 text-meta font-medium uppercase text-text-muted">Blank Document</p>
            <h1 className="text-title font-semibold text-text-primary">Start with a Section</h1>
            <p className="mt-2 max-w-xl text-body text-text-secondary">
              This Document has no active Sections yet.
            </p>
            <div className="mt-6">
              <Button type="button" onClick={() => createSection.mutate({})} disabled={createSection.isPending} className="gap-2">
                {createSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Section
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-w-0 px-4 py-4">
            {sections.map((section, index) => (
              <SectionBlock
                key={section.id}
                projectId={pid}
                documentId={did}
                section={section}
                index={index}
                total={sections.length}
                onAdd={(anchorSectionId, placement) => createSection.mutate({ anchorSectionId, placement })}
                onDeleteRequest={setSectionToDelete}
                onMove={moveSection}
                onRename={(sectionId, title) => renameSection.mutate({ sectionId, title })}
                onSavingChange={handleSavingChange}
                onSaved={setLastSaved}
              />
            ))}
            <div className="mx-auto max-w-3xl py-8">
              <Button type="button" variant="outline" onClick={() => createSection.mutate({})} disabled={createSection.isPending} className="gap-2">
                {createSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Section
              </Button>
            </div>
          </div>
        )}
      </main>

      <aside className="col-start-2 row-start-2 flex min-h-0 flex-col items-center border-l border-separator bg-panel py-3 lg:col-start-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setRightPanelOpen((open) => !open)}
          aria-label={rightPanelOpen ? 'Collapse right tools panel' : 'Open right tools panel'}
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        {rightPanelOpen && (
          <Surface variant="overlay" padding="default" className="absolute bottom-0 right-12 top-14 w-80">
            <p className="text-meta font-medium uppercase text-text-muted">Reserved Tools</p>
            <p className="mt-2 text-body text-text-secondary">
              AI, notes, and review tools will live here in later phases.
            </p>
          </Surface>
        )}
      </aside>

      <ConfirmDialog
        open={sectionToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSectionToDelete(null);
        }}
        title="Delete Section?"
        description={`Delete "${sectionToDelete?.title || sectionToDelete?.heading || 'this section'}"? This removes it from the active Document but preserves the persisted lifecycle record.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (sectionToDelete) deleteSection.mutate(sectionToDelete.id);
          setSectionToDelete(null);
        }}
      />
    </div>
  );
}
