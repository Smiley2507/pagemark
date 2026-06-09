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
  PanelLeft,
  PanelRightOpen,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  CheckCircle2,
  FileText,
  BookOpen,
  Check,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';

import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { AiPanel } from '@/components/editor/AiPanel';
import { ResourcePalette } from '@/components/editor/ResourcePalette';
import { NotesPanel } from '@/components/editor/NotesPanel';
import { QualityModal } from '@/components/editor/QualityModal';
import { ExportModal } from '@/components/editor/ExportModal';
import { ShareDialog } from '@/components/shared/ShareDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { SectionStatusBadge } from '@/components/ui/section-status-badge';
import { Tooltip } from '@/components/ui/tooltip';
import { documentsApi, type Document } from '@/api/documents';
import { useDocumentAutosave, useDocumentSections, useUpdateDocumentSection, useAcceptSectionReview } from '@/hooks/useSections';
import { useQualityReport, useRunQuality } from '@/hooks/useQuality';
import { getSectionState } from '@/lib/section-state';
import { cn } from '@/lib/utils';
import { OutlinePanel } from '@/components/editor/OutlinePanel';
import type { TocItem } from '@/components/editor/OutlinePanel';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { Section } from '@/types';

type FlatSection = Section & { depth: number };

type RightTab = 'ai' | 'notes';

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
  onLocalContentChange,
  onAcceptReview,
  onJumpToSection,
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
  onLocalContentChange: (sectionId: number, content: string) => void;
  onAcceptReview?: (sectionId: number) => void;
  onJumpToSection?: (sectionId: number) => void;
}) {
  const [content, setContent] = useState(section.content_md);
  const [title, setTitle] = useState(section.title || section.heading || 'Untitled Section');
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

  const handleContentChange = (nextContent: string) => {
    setContent(nextContent);
    onLocalContentChange(section.id, nextContent);
  };

  const commitTitle = () => {
    const nextTitle = title.trim() || 'Untitled Section';
    setTitle(nextTitle);
    if (nextTitle !== (section.title || section.heading)) {
      onRename(section.id, nextTitle);
    }
  };

  const sectionState = getSectionState(section);
  const isReviewed = sectionState.key === 'reviewed';

  return (
    <section
      id={`section-${section.id}`}
      data-editor-section="true"
      className="group min-w-0 scroll-mt-24 overflow-x-hidden py-6"
    >
      <div className="relative mx-auto max-w-4xl min-w-0 rounded-sm px-4 py-3 transition-colors duration-150 focus-within:bg-panel/45 hover:bg-panel/35">
        <div className="pointer-events-none absolute bottom-3 left-0 top-3 w-0.5 rounded-full bg-interaction opacity-0 transition-opacity duration-150 group-focus-within:opacity-70 group-hover:opacity-50" />
        <div className="mb-4 flex items-start gap-3">
          <GripVertical className="mt-4 h-4 w-4 shrink-0 text-text-muted opacity-0 transition-opacity duration-150 group-focus-within:opacity-60 group-hover:opacity-50" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              aria-label={`Heading for ${section.heading}`}
              className="h-auto rounded-none border-0 border-b border-transparent bg-transparent px-0 py-1 text-[2rem] font-semibold leading-tight text-text-primary shadow-none focus-visible:border-interaction focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {!isReviewed && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SectionStatusBadge section={section} compact />
                <span className="text-meta text-text-muted opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">{sectionState.summary}</span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
            {isReviewed ? (
              <span className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-review">
                <CheckCircle2 className="h-3 w-3" />
                Reviewed
              </span>
            ) : onAcceptReview ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onAcceptReview(section.id)}
                aria-label="Accept section review"
                className="text-review hover:text-review"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            ) : null}
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

        <div className="min-w-0 overflow-x-hidden px-1 py-2">
          <MarkdownEditor value={content} onChange={handleContentChange} />
        </div>
        {onJumpToSection && (
          <div className="mt-2 flex justify-end opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
            <Button type="button" variant="ghost" size="sm" onClick={() => onJumpToSection(section.id)} className="text-xs">
              <BookOpen className="mr-1 h-3 w-3" />
              Notes
            </Button>
          </div>
        )}
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
  const [tocOpen, setTocOpen] = useState(true);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>('ai');
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);
  const [savingSectionIds, setSavingSectionIds] = useState<Set<number>>(() => new Set());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [qualityModalOpen, setQualityModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [localContentBySectionId, setLocalContentBySectionId] = useState<Record<number, string>>({});
  const tocKeyboard = useTocKeyboardNavigation();
  const scrollRootRef = useRef<HTMLDivElement>(null);

  const { data: document, isLoading: documentLoading } = useQuery({
    queryKey: ['document-meta', pid, did],
    queryFn: () => documentsApi.getDocument(pid, did),
    enabled: pid > 0 && did > 0,
  });

  const { data: sectionTree, isLoading: sectionsLoading } = useDocumentSections(pid, did);
  const sections = useMemo(() => flattenSections(sectionTree?.sections || []), [sectionTree?.sections]);
  const sectionsForStats = useMemo(() => (
    sections.map((section) => ({
      ...section,
      content_md: localContentBySectionId[section.id] ?? section.content_md,
    }))
  ), [localContentBySectionId, sections]);
  const tocItems = useMemo(() => buildToc(sectionsForStats), [sectionsForStats]);
  const wordCount = useMemo(() => countWords(sectionsForStats), [sectionsForStats]);
  const reviewedCount = useMemo(
    () => sections.filter((section) => getSectionState(section).key === 'reviewed').length,
    [sections],
  );
  const reviewTotal = document?.progress.total_sections || sections.length;
  const isSaving = savingSectionIds.size > 0;

  const acceptSectionReview = useAcceptSectionReview(pid, did);
  const updateDocumentSection = useUpdateDocumentSection(pid, did);
  const { data: qualityData } = useQualityReport(pid, did);
  const runQuality = useRunQuality(pid, did);

  const canAcceptAll = sections.length > 0 && reviewedCount < reviewTotal;

  useEffect(() => {
    setLocalContentBySectionId((current) => {
      const next = { ...current };
      let changed = false;
      sections.forEach((section) => {
        if (next[section.id] === section.content_md) {
          delete next[section.id];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [sections]);

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
        if (visible?.target.id) {
          setActiveTocId(visible.target.id);
          const sectionMatch = visible.target.id.match(/^section-(\d+)/);
          if (sectionMatch) setActiveSectionId(Number(sectionMatch[1]));
        }
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

  const handleLocalContentChange = useCallback((sectionId: number, content: string) => {
    setLocalContentBySectionId((current) => {
      if (current[sectionId] === content) return current;
      return { ...current, [sectionId]: content };
    });
  }, []);

  const handleSavingChange = useCallback((sectionId: number, saving: boolean) => {
    setSavingSectionIds((current) => {
      const next = new Set(current);
      if (saving) next.add(sectionId);
      else next.delete(sectionId);
      return next;
    });
  }, []);

  const handleAcceptAllReview = () => {
    if (!canAcceptAll) return;
    sections.forEach((section) => {
      const state = getSectionState(section);
      if (state.key !== 'reviewed' && state.key !== 'failed' && state.key !== 'generating') {
        acceptSectionReview.mutate(section.id);
      }
    });
    toast.success('Accepting all review-ready sections');
  };

  const handleApplyContent = useCallback((content: string) => {
    if (!activeSectionId) {
      toast.error('No active section selected');
      return;
    }
    updateDocumentSection.mutate({ id: activeSectionId, data: { content_md: content } });
    toast.success('AI content applied to section');
  }, [activeSectionId, updateDocumentSection]);

  const handleReplaceContent = useCallback((content: string, sectionId: number) => {
    updateDocumentSection.mutate({ id: sectionId, data: { content_md: content } });
    toast.success('AI content replaced section');
  }, [updateDocumentSection]);

  const handleInsertAtCursor = useCallback((content: string) => {
    toast.success('AI content ready to insert');
  }, []);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'b',
        mod: 'metaKey',
        handler: () => setTocOpen((prev) => !prev),
      },
      {
        key: 'i',
        mod: 'metaKey',
        handler: () => { setRightPanelOpen((prev) => !prev); setRightTab('ai'); },
      },
      {
        key: 'k',
        mod: 'metaKey',
        handler: () => {
          setPaletteOpen(true);
        },
      },
    ],
  });

  const loading = documentLoading || sectionsLoading;
  const showSourceNotice = freshnessData?.freshness === 'stale' && (freshnessData?.stale_count || 0) > 0;
  const activeSection = activeSectionId
    ? sections.find((s) => s.id === activeSectionId) || sections[0] || null
    : sections[0] || null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-workspace">
        <Surface variant="panel" padding="default" className="flex items-center gap-3 text-body text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading document workspace...
        </Surface>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-workspace text-text-primary">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-separator bg-panel px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
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
            className="h-8 min-w-0 max-w-xl flex-1 rounded-none border-0 border-b border-transparent bg-transparent px-0 text-body font-semibold shadow-none focus-visible:border-interaction focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Badge variant={statusVariant(document?.status)} className="min-w-0 shrink-0 justify-center whitespace-nowrap px-1.5 text-[10px]">
            {documentStatusLabel(document)}
          </Badge>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Tooltip content={lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Autosave is on'} side="bottom">
            <span className="hidden items-center gap-1.5 text-meta text-text-muted sm:inline-flex">
              {isSaving || updateDocumentTitle.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 text-status-success-foreground" />
              )}
              <span>{isSaving || updateDocumentTitle.isPending ? 'Saving' : 'Saved'}</span>
            </span>
          </Tooltip>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setQualityModalOpen(true)}
            className="gap-1.5"
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">Quality</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShareModalOpen(true)}
            className="gap-1.5"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">Share</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExportModalOpen(true)}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">Export</span>
          </Button>

          <Button variant="ghost" size="icon" aria-label="Document tools">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {tocOpen && (
          <OutlinePanel
            tocItems={tocItems}
            activeTocId={activeTocId}
            onTocItemClick={scrollToTocItem}
            onTocKeyboard={tocKeyboard}
            wordCount={wordCount}
            reviewedCount={reviewedCount}
            reviewTotal={reviewTotal}
            qualityData={qualityData}
            canAcceptAll={canAcceptAll}
            onAcceptAll={handleAcceptAllReview}
            onRunQuality={() => runQuality.mutate()}
            onCreateSection={() => createSection.mutate({})}
            onClose={() => setTocOpen(false)}
          />
        )}

        <main ref={scrollRootRef} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-canvas">
          {!tocOpen && (
            <button
              onClick={() => setTocOpen(true)}
              className="sticky top-3 z-10 ml-3 inline-flex items-center gap-1.5 rounded-lg border border-separator bg-panel px-2 py-1.5 text-meta-sm text-text-muted shadow-sm transition-colors hover:bg-interaction-muted hover:text-interaction-hover"
              aria-label="Show outline"
            >
              <PanelLeft className="h-3.5 w-3.5" />
              Outline
            </button>
          )}
          {showSourceNotice && (
            <div className="mx-auto max-w-4xl px-4 pt-5">
              <Notice variant="warning" title="Potentially Stale Sections">
                {freshnessData?.stale_count} reviewed sections show source changes since acceptance.
              </Notice>
            </div>
          )}

          {sections.length === 0 ? (
            <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-center px-6 py-16">
              <h1 className="text-title font-semibold text-text-primary">No Sections yet</h1>
              <div className="mt-6">
                <Button type="button" onClick={() => createSection.mutate({})} disabled={createSection.isPending} className="gap-2">
                  {createSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Section
                </Button>
              </div>
            </div>
          ) : (
            <div className="min-w-0 px-5 py-3">
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
                  onLocalContentChange={handleLocalContentChange}
                  onAcceptReview={(sectionId) => acceptSectionReview.mutate(sectionId)}
                  onJumpToSection={(sectionId) => { setActiveSectionId(sectionId); setRightPanelOpen(true); setRightTab('notes'); }}
                />
              ))}
              <div className="mx-auto max-w-4xl py-8">
                <Button type="button" variant="outline" onClick={() => createSection.mutate({})} disabled={createSection.isPending} className="gap-2">
                  {createSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Section
                </Button>
              </div>
            </div>
          )}
        </main>

        <div className={cn(
          'flex shrink-0 border-l border-separator bg-panel transition-all duration-200',
          rightPanelOpen ? 'w-96' : 'w-10',
        )}>
          {rightPanelOpen ? (
            <div className="flex min-h-0 w-full min-w-0 flex-col">
              <div className="flex h-10 shrink-0 items-center border-b border-separator">
                <div className="flex min-w-0 flex-1">
                  <button
                    onClick={() => setRightTab('ai')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                      rightTab === 'ai'
                        ? 'border-b-2 border-interaction text-interaction-hover'
                        : 'text-text-muted hover:text-text-primary',
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    AI
                  </button>
                  <button
                    onClick={() => setRightTab('notes')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                      rightTab === 'notes'
                        ? 'border-b-2 border-interaction text-interaction-hover'
                        : 'text-text-muted hover:text-text-primary',
                    )}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Notes
                  </button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightPanelOpen(false)}
                  aria-label="Close right panel"
                  className="h-9 w-9 shrink-0"
                >
                  <PanelRightOpen className="h-3.5 w-3.5 rotate-180" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {rightTab === 'ai' ? (
                   <AiPanel
                    projectId={pid}
                    documentId={did}
                    activeSectionId={activeSection?.id ?? null}
                    activeSectionHeading={activeSection?.title || activeSection?.heading || null}
                    activeSectionContent={activeSection?.content_md || ''}
                    activeSectionStatus={activeSection?.status || 'pending'}
                    sections={sections.map((s) => ({ id: s.id, heading: s.title || s.heading }))}
                    onApplyContent={handleApplyContent}
                    onReplaceContent={handleReplaceContent}
                    onInsertAtCursor={handleInsertAtCursor}
                    onOpenPalette={() => setPaletteOpen(true)}
                  />
                ) : (
                  <NotesPanel
                    projectId={pid}
                    documentId={did}
                    activeSectionId={activeSection?.id ?? null}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex w-10 flex-col items-center gap-2 border-l border-separator bg-panel py-3">
              <button
                onClick={() => { setRightPanelOpen(true); setRightTab('ai'); }}
                className="rounded p-1.5 text-text-muted transition-colors hover:bg-interaction-muted hover:text-text-primary"
                aria-label="Open AI assistant"
                title="AI Assistant"
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setRightPanelOpen(true); setRightTab('notes'); }}
                className="rounded p-1.5 text-text-muted transition-colors hover:bg-interaction-muted hover:text-text-primary"
                aria-label="Open notes"
                title="Notes"
              >
                <FileText className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <QualityModal
        open={qualityModalOpen}
        onClose={() => setQualityModalOpen(false)}
        projectId={pid}
        documentId={did}
      />

      <ExportModal
        projectId={pid}
        documentId={did}
        projectName={document?.title || 'Document'}
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        initialSettings={undefined}
      />

      <ShareDialog
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        projectId={pid}
        documentId={did}
        documentTitle={document?.title || 'Document'}
      />

      <ResourcePalette
        projectId={pid}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />

      <ConfirmDialog
        open={sectionToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSectionToDelete(null);
        }}
        title="Delete Section?"
        description={`Delete "${sectionToDelete?.title || sectionToDelete?.heading || 'this section'}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (sectionToDelete) deleteSection.mutate(sectionToDelete.id);
          setSectionToDelete(null);
        }}
      />
    </div>
  );
}
