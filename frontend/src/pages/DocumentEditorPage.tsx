import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
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
  Sun,
  Moon,
  Laptop,
  GitPullRequestDraft,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Editor } from '@tiptap/core'
import { MarkdownEditor, type MarkdownSelectionSnapshot } from '@/components/editor/MarkdownEditor';
import { AiPanel } from '@/components/editor/AiPanel';
import { AiPanelHistoryTab } from '@/components/editor/AiPanelHistoryTab';
import { NotesSlideOver } from '@/components/editor/NotesSlideOver';
import { useNotes } from '@/hooks/useNotes';
import { ResourcePalette } from '@/components/editor/ResourcePalette';
import { QualityModal } from '@/components/editor/QualityModal';
import { ExportModal } from '@/components/editor/ExportModal';
import { ShareDialog } from '@/components/shared/ShareDialog';
import { OutlineDiffBanner } from '@/components/editor/OutlineDiffBanner';
import { VersionHistory } from '@/components/editor/VersionHistory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { StaleSectionBanner } from '@/components/ui/stale-section-banner';
import { Notice } from '@/components/ui/notice';
import { SectionStatusDot } from '@/components/ui/section-status-dot';
import { SectionStatusBadge } from '@/components/ui/section-status-badge';
import { UserBadge } from '@/components/ui/user-badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { documentsApi, type Document } from '@/api/documents';
import { projectsApi } from '@/api/projects';
import { useDocumentAutosave, useDocumentSections, useUpdateDocumentSection, useAcceptSectionReview } from '@/hooks/useSections';
import { useQualityReport, useRunQuality } from '@/hooks/useQuality';
import { useAiProposedChanges } from '@/hooks/useAI';
import { getSectionState } from '@/lib/section-state';
import { cn } from '@/lib/utils';
import { OutlinePanel } from '@/components/editor/OutlinePanel';
import type { TocItem } from '@/components/editor/OutlinePanel';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useHasCapability } from '@/hooks/useHasCapability';
import { DOCUMENT_MANAGE, CONTENT_REVIEW, CONTENT_COMMENT } from '@/lib/authz';
import type { GenerationQualityWarning, Section } from '@/types';

type FlatSection = Section & { depth: number };

type RightTab = 'ai' | 'history';
type ThemeChoice = 'light' | 'dark' | 'system';
type AiCommandOptions = {
  autoSubmit?: boolean;
  selection?: MarkdownSelectionSnapshot;
};

type BackendAppliedSectionSync = {
  nonce: number;
  sections: Array<{
    id: number;
    content_md: string;
    version?: string;
    staleContent?: string;
  }>;
};

function sectionAcceptanceCriteria(section: Section): string[] {
  const criteria = section.workflow_metadata?.acceptance_criteria;
  if (!Array.isArray(criteria)) return [];
  return criteria.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function sectionGenerationQualityWarnings(section: Section): GenerationQualityWarning[] {
  const warnings = section.workflow_metadata?.generation_quality_warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.filter((warning): warning is GenerationQualityWarning => {
    if (warning == null || typeof warning !== 'object') return false;
    const item = warning as Record<string, unknown>;
    return typeof item.code === 'string' && typeof item.message === 'string';
  });
}

const themeOptions: Array<{ value: ThemeChoice; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop },
];

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
  if (status === 'generating') return 'generation';
  if (status === 'draft') return 'neutral';
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
  onVersionHistory,
  staleSectionMeta,
  onAcceptStaleness,
  onRejectStaleness,
  isStalenessProcessing,
  onFocusChange,
  onEditorReady,
  onSelectionChange,
  onSectionPointerDown,
  onAiCommand,
  isDocumentApproved,
  isCollaborationActive,
  backendAppliedContent,
  backendAppliedVersion,
  backendAppliedStaleContent,
  onCollaborationAuthFailed,
  canManageDocuments = true,
  canReview = true,
  canComment = true,
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
  onVersionHistory?: (sectionId: number) => void;
  staleSectionMeta?: Map<number, { reviewed_at: string | null }>;
  onAcceptStaleness?: (sectionId: number) => void;
  onRejectStaleness?: (sectionId: number) => void;
  isStalenessProcessing?: boolean;
  onFocusChange?: (sectionId: number, editor: Editor | null) => void;
  onEditorReady?: (sectionId: number, editor: Editor | null) => void;
  onSelectionChange?: (sectionId: number, selection: MarkdownSelectionSnapshot | null) => void;
  onSectionPointerDown?: (sectionId: number) => void;
  onAiCommand?: (sectionId: number, prompt: string, options?: AiCommandOptions) => void;
  isDocumentApproved?: boolean;
  isCollaborationActive?: boolean;
  backendAppliedContent?: string;
  backendAppliedVersion?: string | number;
  backendAppliedStaleContent?: string;
  onCollaborationAuthFailed?: (detail: { sectionId: number; status?: number; message: string }) => void;
  canManageDocuments?: boolean;
  canReview?: boolean;
  canComment?: boolean;
}) {
  const [content, setContent] = useState(section.content_md);
  const [title, setTitle] = useState(section.title || section.heading || 'Untitled Section');
  const collaborationEnabled = import.meta.env.VITE_COLLABORATION_ENABLED === 'true';
  const { isSaving, lastSaved, markPersisted } = useDocumentAutosave(
    projectId,
    documentId,
    section.id,
    content,
    !isDocumentApproved,
  );

  useEffect(() => {
    setContent(section.content_md);
    setTitle(section.title || section.heading || 'Untitled Section');
    markPersisted(section.content_md, section.updated_at);
    onLocalContentChange(section.id, section.content_md);
  }, [markPersisted, section.content_md, section.heading, section.id, section.title, section.updated_at, onLocalContentChange]);

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

  const handleEditorFocusChange = useCallback((editor: Editor | null) => {
    onFocusChange?.(section.id, editor);
  }, [onFocusChange, section.id]);

  const commitTitle = () => {
    const nextTitle = title.trim() || 'Untitled Section';
    setTitle(nextTitle);
    if (nextTitle !== (section.title || section.heading)) {
      onRename(section.id, nextTitle);
    }
  };

  const sectionState = getSectionState(section);
  const isReviewed = sectionState.key === 'reviewed';
  const isStale = staleSectionMeta?.has(section.id) ?? false;
  const staleMeta = staleSectionMeta?.get(section.id);
  const acceptanceCriteria = sectionAcceptanceCriteria(section);
  const qualityWarnings = sectionGenerationQualityWarnings(section);

  return (
    <section
      id={`section-${section.id}`}
      data-editor-section="true"
      data-testid={`editor-section-${section.id}`}
      onPointerDown={() => onSectionPointerDown?.(section.id)}
      className="group min-w-0 scroll-mt-24 overflow-x-hidden py-7"
    >
      <div className="relative mx-auto max-w-4xl min-w-0 px-2 py-1 transition-colors duration-150 sm:px-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="mt-[12px] opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
            <SectionStatusDot section={section} />
          </div>
          <div className="min-w-0 flex-1">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              readOnly={!canManageDocuments}
              aria-label={`Heading for ${section.heading}`}
              className="h-auto rounded-none border-0 border-b border-transparent bg-transparent px-0 py-1 text-2xl font-semibold leading-tight text-text-primary shadow-none focus-visible:border-interaction focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-3xl"
            />
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
            <SectionStatusBadge section={section} compact />
            {canManageDocuments && (
              <>
                <Button type="button" variant="ghost" size="icon" onClick={() => onAdd(section.id, 'above')} aria-label="Add section above" className="text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => onAdd(section.id, 'below')} aria-label="Add section below" className="text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5 rotate-180" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteRequest(section)} aria-label="Delete section" className="text-muted-foreground hover:text-status-danger-foreground">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="More actions" className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManageDocuments && (
                  <>
                    <DropdownMenuItem disabled={index === 0} onClick={() => onMove(section.id, 'up')}>
                      <ArrowUp className="h-3.5 w-3.5" />
                      Move Up
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={index >= total - 1} onClick={() => onMove(section.id, 'down')}>
                      <ArrowDown className="h-3.5 w-3.5" />
                      Move Down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {canReview && (!isReviewed && onAcceptReview ? (
                  <DropdownMenuItem onClick={() => onAcceptReview(section.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-review" />
                    Accept Review
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled className="text-review">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Reviewed
                  </DropdownMenuItem>
                ))}
                {onJumpToSection && canComment && (
                  <DropdownMenuItem onClick={() => onJumpToSection(section.id)}>
                    <BookOpen className="h-3.5 w-3.5" />
                    Add note
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onVersionHistory?.(section.id)}>
                  <FileText className="h-3.5 w-3.5" />
                  Version History
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isStale && staleMeta && (
          <StaleSectionBanner
            sectionId={section.id}
            reviewedAt={staleMeta.reviewed_at}
            onAccept={(id) => onAcceptStaleness?.(id)}
            onReject={(id) => onRejectStaleness?.(id)}
            isProcessing={isStalenessProcessing}
            canReview={canReview}
          />
        )}

        {(qualityWarnings.length > 0 || acceptanceCriteria.length > 0) && (
          <div className="mb-3 space-y-2">
            {qualityWarnings.length > 0 && (
              <div className="rounded-md border border-status-warning-foreground/25 bg-status-warning/10 px-3 py-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning-foreground" />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-text-primary">Generated draft needs review</p>
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {qualityWarnings.slice(0, 3).map((warning) => (
                        <li key={warning.code}>
                          {warning.message}
                          {warning.suggestion ? <span> {warning.suggestion}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            {acceptanceCriteria.length > 0 && (
              <div className="rounded-md border border-border bg-panel-muted/50 px-3 py-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-review" />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-text-primary">Acceptance criteria</p>
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {acceptanceCriteria.slice(0, 5).map((criterion) => (
                        <li key={criterion} className="flex gap-1.5">
                          <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 overflow-x-hidden px-1 py-1">
          <MarkdownEditor
            value={content}
            onChange={handleContentChange}
            sectionId={section.id}
            projectId={projectId}
            documentId={documentId}
            collaboration={collaborationEnabled && Boolean(isCollaborationActive)}
            readOnly={isDocumentApproved}
            onSavingChange={(saving) => onSavingChange(section.id, saving)}
            onSaved={onSaved}
            onFocusChange={handleEditorFocusChange}
            onEditorReady={(editor) => onEditorReady?.(section.id, editor)}
            onSelectionChange={(selection) => onSelectionChange?.(section.id, selection)}
            onAiCommand={(prompt, options) => onAiCommand?.(section.id, prompt, options)}
            backendAppliedContent={backendAppliedContent}
            backendAppliedVersion={backendAppliedVersion}
            backendAppliedStaleContent={backendAppliedStaleContent}
            onCollaborationAuthFailed={onCollaborationAuthFailed}
            onPolish={(text, selection) => onAiCommand?.(
              section.id,
              `Replace the selected text with a polished version while preserving meaning. Return a replace_selection editor action.\n\nSelected text:\n${text}`,
              { autoSubmit: true, selection },
            )}
          />
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
  const currentUser = useAuthStore((state) => state.user);
  const { theme, setTheme } = useThemeStore();
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesInitialScope, setNotesInitialScope] = useState<'document' | 'section'>('document');
  const [notesFocusSignal, setNotesFocusSignal] = useState(0);
  const { data: allNotes = [] } = useNotes(pid, did, null);
  const noteCount = allNotes.length;
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [activeEditorSectionId, setActiveEditorSectionId] = useState<number | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [collaborationSectionId, setCollaborationSectionId] = useState<number | null>(null);
  const [aiDraftCommand, setAiDraftCommand] = useState<{
    id: number;
    prompt: string;
    autoSubmit: boolean;
    selection?: { sectionId: number; from: number; to: number; text: string };
  } | null>(null);
  const [editorSelection, setEditorSelection] = useState<{
    sectionId: number;
    from: number;
    to: number;
    text: string;
  } | null>(null);
  const [editorCursor, setEditorCursor] = useState<{ sectionId: number; pos: number } | null>(null);
  const [versionHistorySectionId, setVersionHistorySectionId] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [focusBarVisible, setFocusBarVisible] = useState(false);
  const focusBarTimer = useRef<number | null>(null);
  const [localContentBySectionId, setLocalContentBySectionId] = useState<Record<number, string>>({});
  const tocKeyboard = useTocKeyboardNavigation();
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const editorBySectionIdRef = useRef(new Map<number, Editor>());
  const focusedEditorSectionIdRef = useRef<number | null>(null);
  const aiDraftCommandIdRef = useRef(0);
  const collaborationAuthFailureRef = useRef(new Set<string>());

  const { data: document, isLoading: documentLoading } = useQuery({
    queryKey: ['document-meta', pid, did],
    queryFn: () => documentsApi.getDocument(pid, did),
    enabled: pid > 0 && did > 0,
  });

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => projectsApi.getProject(pid),
    enabled: pid > 0,
  });
  const canManageDocuments = useHasCapability(DOCUMENT_MANAGE, project);
  const canReviewContent = useHasCapability(CONTENT_REVIEW, project);
  const canCommentContent = useHasCapability(CONTENT_COMMENT, project);

  const { data: sectionTree, isLoading: sectionsLoading } = useDocumentSections(pid, did);
  const { data: backendAppliedSync } = useQuery<BackendAppliedSectionSync | null>({
    queryKey: ['backend-applied-section-sync', pid, did],
    queryFn: async () => null,
    enabled: false,
    staleTime: Infinity,
  });
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
  const { data: aiProposedChanges = [] } = useAiProposedChanges(pid, did);

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

  useEffect(() => {
    if (!sections.length || activeSectionId) return;
    setActiveSectionId(sections[0].id);
    setActiveTocId(`section-${sections[0].id}`);
  }, [activeSectionId, sections]);

  useEffect(() => {
    if (!sections.length) {
      setCollaborationSectionId(null);
      return;
    }

    setCollaborationSectionId((current) => {
      if (current && sections.some((section) => section.id === current)) return current;
      return sections[0].id;
    });
  }, [sections]);

  const backendAppliedBySectionId = useMemo(() => {
    const syncSections = backendAppliedSync?.sections ?? [];
    return new Map(syncSections.map((section) => [section.id, section]));
  }, [backendAppliedSync]);

  useEffect(() => {
    if (!backendAppliedSync) return;
    setLocalContentBySectionId((current) => {
      let changed = false;
      const next = { ...current };
      for (const section of backendAppliedSync.sections) {
        if (next[section.id] !== section.content_md) {
          next[section.id] = section.content_md;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [backendAppliedSync]);

  const { data: freshnessData } = useQuery({
    queryKey: ['freshness', pid, did],
    queryFn: async () => {
      try {
        return await documentsApi.getFreshness(pid, did);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: pid > 0 && did > 0,
    refetchInterval: (query) => query.state.data ? 30000 : false,
  });

  const staleSectionIds = useMemo(() => {
    if (!freshnessData?.stale_sections) return new Set<number>()
    return new Set(freshnessData.stale_sections.map(s => s.id))
  }, [freshnessData])

  const staleSectionMeta = useMemo(() => {
    if (!freshnessData?.stale_sections) return new Map<number, { reviewed_at: string | null }>()
    return new Map(freshnessData.stale_sections.map(s => [s.id, { reviewed_at: s.reviewed_at }]))
  }, [freshnessData])

  const exportReadinessSummary = useMemo(() => {
    const warnings: string[] = [];
    const openAiChanges = aiProposedChanges.filter((change) => change.status === 'proposed').length;
    const generatedDrafts = sections.filter((section) => (
      section.content_lifecycle === 'generated_draft' || section.status === 'draft'
    ) && (section.content_md || '').trim().length > 0).length;
    const incompleteCriteria = sections.filter((section) => (
      sectionAcceptanceCriteria(section).length > 0 && getSectionState(section).key !== 'reviewed'
    )).length;
    const sectionsWithGenerationWarnings = sections.filter((section) => sectionGenerationQualityWarnings(section).length > 0).length;
    const qualityIsStale = Boolean(
      qualityData?.generated_at &&
      document?.updated_at &&
      new Date(qualityData.generated_at).getTime() < new Date(document.updated_at).getTime(),
    );
    const staleCount = freshnessData?.stale_count ?? 0;

    if (openAiChanges > 0) warnings.push(`${openAiChanges} AI proposed change${openAiChanges === 1 ? '' : 's'} still need review.`);
    if (generatedDrafts > 0) warnings.push(`${generatedDrafts} generated draft section${generatedDrafts === 1 ? '' : 's'} are not reviewed.`);
    if (!qualityData) warnings.push('Quality report has not been run for this document.');
    if (qualityIsStale) warnings.push('Quality report may be stale after recent document edits.');
    if (incompleteCriteria > 0) warnings.push(`${incompleteCriteria} section${incompleteCriteria === 1 ? '' : 's'} have incomplete acceptance criteria review.`);
    if (staleCount > 0) warnings.push(`${staleCount} section${staleCount === 1 ? '' : 's'} may be stale after source changes.`);
    if (sectionsWithGenerationWarnings > 0) warnings.push(`${sectionsWithGenerationWarnings} section${sectionsWithGenerationWarnings === 1 ? '' : 's'} still have generated-draft warnings.`);

    return { warningCount: warnings.length, warnings };
  }, [aiProposedChanges, document?.updated_at, freshnessData?.stale_count, qualityData, sections]);

  const acceptFreshness = useMutation({
    mutationFn: (sectionId: number) => documentsApi.acceptFreshnessUpdate(pid, did, sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freshness', pid, did] })
      toast.success('Staleness accepted')
    },
    onError: () => toast.error('Failed to accept staleness update'),
  })

  const rejectFreshness = useMutation({
    mutationFn: (sectionId: number) => documentsApi.rejectFreshnessUpdate(pid, did, sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['freshness', pid, did] })
      toast.success('Staleness dismissed')
    },
    onError: () => toast.error('Failed to dismiss staleness update'),
  })

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
          if (sectionMatch) {
            const sectionId = Number(sectionMatch[1]);
            setActiveSectionId(sectionId);
            if (!focusedEditorSectionIdRef.current) setCollaborationSectionId(sectionId);
          }
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
    if (item.sectionId) {
      setActiveSectionId(item.sectionId);
      setCollaborationSectionId(item.sectionId);
    }
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

  const handleSectionEditorReady = useCallback((sectionId: number, editor: Editor | null) => {
    if (editor) {
      editorBySectionIdRef.current.set(sectionId, editor);
      return;
    }
    editorBySectionIdRef.current.delete(sectionId);
  }, []);

  const handleSectionFocusChange = useCallback((sectionId: number, editor: Editor | null) => {
    if (!editor) {
      const wasFocusedEditor = focusedEditorSectionIdRef.current === sectionId;
      if (wasFocusedEditor) focusedEditorSectionIdRef.current = null;
      setActiveEditor((current) => wasFocusedEditor ? null : current);
      setActiveEditorSectionId((current) => current === sectionId ? null : current);
      return;
    }
    focusedEditorSectionIdRef.current = sectionId;
    setActiveEditor(editor);
    setActiveEditorSectionId(sectionId);
    setActiveSectionId(sectionId);
    setEditorSelection((current) => {
      if (current?.sectionId !== sectionId) return null;
      const { selection } = editor.state;
      if (selection.empty) return null;
      const selectedText = editor.state.doc.textBetween(selection.from, selection.to);
      return selection.from === current.from && selection.to === current.to && selectedText === current.text
        ? current
        : null;
    });
    setEditorCursor({ sectionId, pos: editor.state.selection.to });
  }, []);

  const handleSectionSelectionChange = useCallback((sectionId: number, selection: MarkdownSelectionSnapshot | null) => {
    if (!selection) {
      setEditorSelection((current) => current?.sectionId === sectionId ? null : current);
      return;
    }
    setActiveSectionId(sectionId);
    setEditorSelection({
      sectionId,
      from: selection.from,
      to: selection.to,
      text: selection.text,
    });
    setEditorCursor({ sectionId, pos: selection.to });
  }, []);

  const handleSectionPointerDown = useCallback((sectionId: number) => {
    setActiveSectionId(sectionId);
    setEditorSelection(null);
    setEditorCursor(null);
  }, []);

  const handleCollaborationAuthFailed = useCallback(async ({ sectionId, status, message }: { sectionId: number; status?: number; message: string }) => {
    if (sectionId !== collaborationSectionId) return;
    const failureKey = `${sectionId}:${status ?? 'unknown'}:${message}`;
    if (collaborationAuthFailureRef.current.has(failureKey)) return;
    collaborationAuthFailureRef.current.add(failureKey);

    if (status !== 404) return;

    try {
      const freshTree = await queryClient.fetchQuery({
        queryKey: ['document-sections', pid, did],
        queryFn: () => documentsApi.getSections(pid, did),
      });
      const freshSections = flattenSections(freshTree.sections || []);
      const stillExists = freshSections.some((section) => section.id === sectionId);
      if (stillExists) {
        toast.message('Collaboration room refreshed for this section.');
        return;
      }

      const currentIndex = sections.findIndex((section) => section.id === sectionId);
      const fallback = freshSections[Math.max(0, Math.min(currentIndex, freshSections.length - 1))] ?? freshSections[0];
      if (fallback) {
        setActiveSectionId(fallback.id);
        setCollaborationSectionId(fallback.id);
        setActiveTocId(`section-${fallback.id}`);
        toast.message('That section is no longer available. Moved to the nearest section.');
      } else {
        setActiveSectionId(null);
        setCollaborationSectionId(null);
        setActiveTocId(null);
        toast.message('That section is no longer available.');
      }
    } catch {
      void queryClient.invalidateQueries({ queryKey: ['document-sections', pid, did] });
    }
  }, [collaborationSectionId, did, pid, queryClient, sections]);

  const handleAiCommand = useCallback((sectionId: number, prompt: string, options?: AiCommandOptions) => {
    setActiveSectionId(sectionId);
    setRightPanelOpen(true);
    setRightTab('ai');
    aiDraftCommandIdRef.current += 1;
    setAiDraftCommand({
      id: aiDraftCommandIdRef.current,
      prompt,
      autoSubmit: Boolean(options?.autoSubmit),
      selection: options?.selection
        ? {
          sectionId,
          from: options.selection.from,
          to: options.selection.to,
          text: options.selection.text,
        }
        : undefined,
    });
  }, []);

  const openSectionNoteComposer = useCallback((sectionId: number | null) => {
    if (sectionId) setActiveSectionId(sectionId);
    setNotesInitialScope('section');
    setNotesOpen(true);
    setNotesFocusSignal((value) => value + 1);
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
      {
        key: 'n',
        mod: 'metaKey',
        alt: true,
        enabled: Boolean(activeEditorSectionId || activeSectionId),
        handler: () => openSectionNoteComposer(activeEditorSectionId ?? activeSectionId),
      },
      {
        key: 'n',
        mod: 'ctrlKey',
        alt: true,
        enabled: Boolean(activeEditorSectionId || activeSectionId),
        handler: () => openSectionNoteComposer(activeEditorSectionId ?? activeSectionId),
      },
      {
        key: 'F',
        mod: 'ctrlKey',
        shift: true,
        handler: () => setFocusMode((prev) => !prev),
      },
    ],
  });

  const loading = documentLoading || sectionsLoading;
  const showSourceNotice = freshnessData?.freshness === 'stale' && (freshnessData?.stale_count || 0) > 0;
  const activeSection = activeSectionId
    ? sections.find((s) => s.id === activeSectionId) || null
    : null;
  const userDisplayName = currentUser?.name || currentUser?.email || 'User';

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
    <div className={cn('flex h-screen flex-col bg-workspace text-text-primary', focusMode && 'focus-mode')}>
      <style>{`
        .focus-mode > header { display: none; }
        .focus-mode > .flex > div:first-child { display: none; }
        .focus-mode > .flex > div:last-child { display: none; }
      `}</style>
      <div
        className={cn(
          'flex h-10 items-center justify-center border-b border-separator bg-panel/80 backdrop-blur-sm transition-all duration-200 shrink-0',
          focusMode && focusBarVisible ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-x-0 -translate-y-full',
        )}
        onMouseEnter={() => {
          if (focusBarTimer.current !== null) window.clearTimeout(focusBarTimer.current)
          setFocusBarVisible(true)
        }}
        onMouseLeave={() => {
          focusBarTimer.current = window.setTimeout(() => setFocusBarVisible(false), 1500)
        }}
      >
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <kbd className="rounded border border-border bg-panel-muted px-1 py-0.5 text-meta-sm">Ctrl+Shift+F</kbd>
          Exit focus mode
        </button>
      </div>
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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setNotesInitialScope('document'); setNotesOpen(true); }}
            className="gap-1.5 relative"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">Notes</span>
            {!notesOpen && noteCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-medium text-white">
                {noteCount > 9 ? '9+' : noteCount}
              </span>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="User menu"
              >
                <UserBadge
                  name={userDisplayName}
                  avatarUrl={currentUser?.avatar_url}
                  size="sm"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="truncate">
                {userDisplayName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className="justify-between"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{option.label}</span>
                    </span>
                    {theme === option.value && (
                      <Check className="h-3.5 w-3.5 text-status-success-foreground" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
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
            canAcceptAll={canAcceptAll && canReviewContent}
            onAcceptAll={handleAcceptAllReview}
            onRunQuality={() => runQuality.mutate()}
            onCreateSection={() => createSection.mutate({})}
            onClose={() => setTocOpen(false)}
            onReorderSections={(sectionIds) => reorderSections.mutate(sectionIds)}
            canManageDocuments={canManageDocuments}
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
          <OutlineDiffBanner projectId={pid} documentId={did} />
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
            <div className="min-w-0 px-4 py-5 sm:px-6">
              <div className="mx-auto mb-2 flex max-w-4xl items-center justify-between border-b border-border/50 pb-3 text-xs text-muted-foreground">
                <span>{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
                <span>{wordCount.toLocaleString()} words</span>
              </div>
              {sections.map((section, index) => {
                const backendApplied = backendAppliedBySectionId.get(section.id);
                return (
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
                    onJumpToSection={(sectionId) => openSectionNoteComposer(sectionId)}
                    onVersionHistory={setVersionHistorySectionId}
                    staleSectionMeta={staleSectionMeta}
                    onAcceptStaleness={(sectionId) => acceptFreshness.mutate(sectionId)}
                    onRejectStaleness={(sectionId) => rejectFreshness.mutate(sectionId)}
                    isStalenessProcessing={acceptFreshness.isPending || rejectFreshness.isPending}
                    onFocusChange={handleSectionFocusChange}
                    onEditorReady={handleSectionEditorReady}
                    onSelectionChange={handleSectionSelectionChange}
                    onSectionPointerDown={handleSectionPointerDown}
                    onAiCommand={handleAiCommand}
                    isDocumentApproved={document?.status === 'approved'}
                    isCollaborationActive={section.id === collaborationSectionId}
                    backendAppliedContent={backendApplied?.content_md}
                    backendAppliedVersion={backendApplied ? `${backendAppliedSync?.nonce ?? 0}:${backendApplied.version ?? ''}` : undefined}
                    backendAppliedStaleContent={backendApplied?.staleContent}
                    onCollaborationAuthFailed={handleCollaborationAuthFailed}
                    canManageDocuments={canManageDocuments}
                    canReview={canReviewContent}
                    canComment={canCommentContent}
                  />
                );
              })}
              <div className="mx-auto max-w-4xl py-8">
                {canManageDocuments && (
                  <Button type="button" variant="outline" onClick={() => createSection.mutate({})} disabled={createSection.isPending} className="gap-2">
                    {createSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add Section
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>

        {notesOpen && (
          <NotesSlideOver
            projectId={pid}
            documentId={did}
            activeSectionId={activeSection?.id ?? null}
            initialScope={notesInitialScope}
            focusSignal={notesFocusSignal}
            sections={sections.map((section) => ({
              id: section.id,
              heading: section.heading,
              title: section.title,
            }))}
            onClose={() => setNotesOpen(false)}
            open={notesOpen}
            canComment={canCommentContent}
          />
        )}

        <div className={cn(
          'flex shrink-0 border-l border-separator bg-panel transition-all duration-200',
          rightPanelOpen ? 'w-96' : 'w-10',
        )} data-testid="editor-right-panel">
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
                    onClick={() => setRightTab('history')}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                      rightTab === 'history'
                        ? 'border-b-2 border-interaction text-interaction-hover'
                        : 'text-text-muted hover:text-text-primary',
                    )}
                  >
                    <GitPullRequestDraft className="h-3.5 w-3.5" />
                    Changes
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
                    activeSectionContent={activeSection ? (localContentBySectionId[activeSection.id] ?? activeSection.content_md ?? '') : ''}
                    activeSectionStatus={activeSection?.status || 'pending'}
                    activeSelection={editorSelection}
                    activeCursor={editorCursor}
                    sections={sections.map((s) => ({ id: s.id, heading: s.title || s.heading }))}
                    projectName={project?.name || document?.title || 'Project'}
                    projectContextMd={project?.context_md || undefined}
                    draftPrompt={aiDraftCommand?.prompt}
                    draftPromptId={aiDraftCommand?.id}
                    draftPromptAutoSubmit={Boolean(aiDraftCommand?.autoSubmit)}
                    draftSelection={aiDraftCommand?.selection}
                    onDraftPromptConsumed={() => setAiDraftCommand(null)}
                    onOpenPalette={() => setPaletteOpen(true)}
                  />
                ) : (
                  <AiPanelHistoryTab
                    projectId={pid}
                    documentId={did}
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
                onClick={() => { setRightPanelOpen(true); setRightTab('history'); }}
                className="rounded p-1.5 text-text-muted transition-colors hover:bg-interaction-muted hover:text-text-primary"
                aria-label="Open changes"
                title="Changes"
              >
                <GitPullRequestDraft className="h-4 w-4" />
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
        activeSectionId={activeSection?.id ?? null}
      />

      <ExportModal
        projectId={pid}
        documentId={did}
        projectName={document?.title || 'Document'}
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        initialSettings={document?.print_profile || document?.export_settings}
        readinessSummary={exportReadinessSummary}
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

      <VersionHistory
        sectionId={versionHistorySectionId ?? 0}
        projectId={pid}
        open={versionHistorySectionId !== null}
        onOpenChange={(open) => { if (!open) setVersionHistorySectionId(null); }}
      />
    </div>
  );
}
