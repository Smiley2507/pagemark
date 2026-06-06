import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Bot,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Save,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { SectionStatusBadge } from '@/components/ui/section-status-badge';
import { Surface } from '@/components/ui/surface';
import { documentsApi } from '@/api/documents';
import { sectionsApi } from '@/api/sections';
import { useDocumentAutosave, useDocumentSections, useUpdateDocumentSection, useAcceptSectionReview } from '@/hooks/useSections';
import { getSectionState } from '@/lib/section-state';
import { cn } from '@/lib/utils';
import { useViewPreferenceStore } from '@/store/viewPreferenceStore';

type AssistantEntry = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  refined?: string;
};

const QUICK_ACTIONS = [
  { label: 'Generate Draft', mode: 'generate' as const },
  { label: 'Improve Clarity', mode: 'refine' as const, prompt: 'Improve clarity and structure while keeping the technical meaning intact.' },
  { label: 'Add Examples', mode: 'refine' as const, prompt: 'Add concrete examples and implementation details where they are missing.' },
  { label: 'Tighten Language', mode: 'refine' as const, prompt: 'Tighten the prose for a concise technical audience.' },
];

function flattenSections<T extends { id: number; children?: T[] }>(sections: T[]): T[] {
  return sections.flatMap((section) => [section, ...flattenSections(section.children || [])]);
}

export function DocumentEditorPage() {
  const { projectId, documentId } = useParams<{ projectId: string; documentId: string }>();
  const pid = Number(projectId);
  const did = Number(documentId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recordRecentWork = useViewPreferenceStore((s) => s.recordRecentWork);
  const getLastSection = useViewPreferenceStore((s) => s.getLastSection);

  const [outlineOpen, setOutlineOpen] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [assistantDraft, setAssistantDraft] = useState('');
  const [assistantEntries, setAssistantEntries] = useState<AssistantEntry[]>([]);

  const { data: document } = useQuery({
    queryKey: ['document-meta', pid, did],
    queryFn: () => documentsApi.getDocument(pid, did),
    enabled: pid > 0 && did > 0,
  });

  const { data: sectionTree, isLoading } = useDocumentSections(pid, did);
  const sections = useMemo(() => flattenSections(sectionTree?.sections || []), [sectionTree?.sections]);
  const activeSection = sections.find((section) => section.id === activeSectionId) || null;
  const activeState = activeSection ? getSectionState(activeSection) : null;

  const { data: freshnessData } = useQuery({
    queryKey: ['freshness', pid, did],
    queryFn: () => documentsApi.getFreshness(pid, did),
    enabled: pid > 0 && did > 0,
    refetchInterval: 30000,
  });

  const updateSection = useUpdateDocumentSection(pid, did);
  const acceptReview = useAcceptSectionReview(pid, did);
  const { isSaving, lastSaved, markPersisted } = useDocumentAutosave(pid, did, activeSectionId, content);

  const createSection = useMutation({
    mutationFn: (title: string) => documentsApi.createSection(pid, did, title),
    onSuccess: (section) => {
      void queryClient.invalidateQueries({ queryKey: ['document-sections', pid, did] });
      void queryClient.invalidateQueries({ queryKey: ['document-meta', pid, did] });
      setActiveSectionId(section.id);
      setContent(section.content_md);
      setTitleDraft(section.title || section.heading);
      markPersisted(section.content_md, section.updated_at);
      toast.success('Section added');
    },
    onError: () => toast.error('Failed to add section'),
  });

  const renameSection = useMutation({
    mutationFn: ({ sectionId, title }: { sectionId: number; title: string }) =>
      documentsApi.updateDocumentSectionTitle(pid, did, sectionId, title),
    onSuccess: (section) => {
      void queryClient.invalidateQueries({ queryKey: ['document-sections', pid, did] });
      void queryClient.invalidateQueries({ queryKey: ['document-meta', pid, did] });
      setTitleDraft(section.title || section.heading);
      toast.success('Section renamed');
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
    onSuccess: (_, sectionId) => {
      const remaining = sections.filter((section) => section.id !== sectionId);
      setActiveSectionId(remaining[0]?.id ?? null);
      void queryClient.invalidateQueries({ queryKey: ['document-sections', pid, did] });
      void queryClient.invalidateQueries({ queryKey: ['document-meta', pid, did] });
      toast.success('Section deleted');
    },
    onError: () => toast.error('Failed to delete section'),
  });

  const generateDraft = useMutation({
    mutationFn: (sectionId: number) => sectionsApi.generateAI(sectionId),
    onSuccess: (section) => {
      void queryClient.invalidateQueries({ queryKey: ['document-sections', pid, did] });
      void queryClient.invalidateQueries({ queryKey: ['document-meta', pid, did] });
      setContent(section.content_md);
      markPersisted(section.content_md, section.updated_at);
      setAssistantEntries((entries) => [
        ...entries,
        {
          id: `assistant-generate-${section.id}-${Date.now()}`,
          role: 'assistant',
          text: 'Generated Draft ready. Review it before accepting the section.',
        },
      ]);
      toast.success('Generated Draft ready for review');
    },
    onError: () => toast.error('Draft generation failed'),
  });

  const refineDraft = useMutation({
    mutationFn: ({
      sectionId,
      instruction,
    }: {
      sectionId: number;
      instruction: string;
    }) => sectionsApi.refineAI(sectionId, instruction),
    onSuccess: (result, variables) => {
      setAssistantEntries((entries) => [
        ...entries,
        { id: `user-${Date.now()}`, role: 'user', text: variables.instruction },
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: 'Suggested revision prepared. Apply it to keep editing in the document surface.',
          refined: result.refined,
        },
      ]);
      setAssistantDraft('');
      setAssistantOpen(true);
    },
    onError: () => toast.error('AI refinement failed'),
  });

  useEffect(() => {
    if (sections.length === 0 || activeSectionId) return;
    const lastSectionId = getLastSection(pid, did);
    const nextSection = lastSectionId ? sections.find((section) => section.id === lastSectionId) : sections[0];
    if (nextSection) {
      setActiveSectionId(nextSection.id);
      setContent(nextSection.content_md);
      markPersisted(nextSection.content_md, nextSection.updated_at);
    }
  }, [sections, activeSectionId, getLastSection, pid, did, markPersisted]);

  useEffect(() => {
    if (!activeSection) return;
    setContent(activeSection.content_md);
    setTitleDraft(activeSection.title || activeSection.heading);
    markPersisted(activeSection.content_md, activeSection.updated_at);
    recordRecentWork({ projectId: pid, documentId: did, sectionId: activeSection.id });
  }, [activeSectionId, activeSection, markPersisted, pid, did, recordRecentWork]);

  const staleCount = freshnessData?.stale_count || 0;
  const showSourceNotice = freshnessData?.freshness === 'stale' && staleCount > 0;

  const handleSave = async () => {
    if (!activeSection) return;
    const section = await updateSection.mutateAsync({
      id: activeSection.id,
      data: { content_md: content },
    });
    markPersisted(section.content_md, section.updated_at);
    toast.success('Section saved');
  };

  const handleAddSection = () => {
    const title = window.prompt('Section title');
    if (!title?.trim()) return;
    createSection.mutate(title.trim());
  };

  const handleRenameSection = () => {
    if (!activeSection) return;
    const title = titleDraft.trim();
    if (!title || title === (activeSection.title || activeSection.heading)) return;
    renameSection.mutate({ sectionId: activeSection.id, title });
  };

  const handleMoveSection = (direction: 'up' | 'down') => {
    if (!activeSection) return;
    const currentIndex = sections.findIndex((section) => section.id === activeSection.id);
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sections.length) return;
    const nextSections = [...sections];
    const [moved] = nextSections.splice(currentIndex, 1);
    nextSections.splice(nextIndex, 0, moved);
    reorderSections.mutate(nextSections.map((section) => section.id));
  };

  const handleDeleteSection = () => {
    if (!activeSection) return;
    if (!window.confirm('Delete this section?')) return;
    deleteSection.mutate(activeSection.id);
  };

  const handleAcceptReview = async () => {
    if (!activeSection) return;
    const section = await acceptReview.mutateAsync(activeSection.id);
    setContent(section.content_md);
    markPersisted(section.content_md);
  };

  const submitAssistantInstruction = () => {
    if (!activeSection || !assistantDraft.trim()) return;
    refineDraft.mutate({ sectionId: activeSection.id, instruction: assistantDraft.trim() });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-workspace">
        <div className="flex items-center gap-3 text-body text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading document workspace…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-workspace text-text-primary">
      <header className="border-b border-separator bg-panel/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${pid}`)} aria-label="Back to project">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-meta uppercase tracking-[0.18em] text-text-muted">Document Workspace</p>
              <h1 className="text-section font-semibold text-text-primary">
                {document?.title || 'Untitled Document'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-right md:block">
              <p className="text-meta text-text-secondary">{sections.length} sections</p>
              <p className="text-meta text-text-muted">
                {isSaving ? 'Autosaving…' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'No saved changes yet'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOutlineOpen((open) => !open)} className="gap-2">
              {outlineOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Outline
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddSection}
              disabled={createSection.isPending}
              className="gap-2"
            >
              {createSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Section
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAssistantOpen((open) => !open)} className="gap-2">
              {assistantOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              Assistant
            </Button>
          </div>
        </div>
      </header>

      {showSourceNotice && (
        <div className="mx-auto w-full max-w-[1600px] px-5 pt-4">
          <Notice variant="warning" title="Potentially Stale Sections">
            {staleCount} reviewed {staleCount === 1 ? 'section shows' : 'sections show'} source changes since acceptance.
            Review them explicitly before trusting the current document.
          </Notice>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-4 overflow-hidden px-5 py-4">
        {outlineOpen && (
          <Surface variant="muted" padding="none" className="hidden w-72 shrink-0 overflow-hidden lg:flex lg:flex-col">
            <div className="border-b border-separator px-4 py-3">
              <p className="text-meta uppercase tracking-[0.18em] text-text-muted">Outline</p>
              <p className="mt-1 text-body text-text-secondary">Secondary navigation with section review state.</p>
            </div>
            <nav aria-label="Document outline" className="flex-1 space-y-1 overflow-y-auto p-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionId(section.id)}
                  className={cn(
                    'w-full rounded-md border px-3 py-3 text-left transition-colors',
                    activeSectionId === section.id
                      ? 'border-interaction bg-panel text-text-primary'
                      : 'border-transparent bg-transparent text-text-secondary hover:border-separator hover:bg-panel'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body font-medium">{section.heading}</p>
                      <p className="mt-1 text-meta text-text-muted">{getSectionState(section).label}</p>
                    </div>
                    <SectionStatusBadge section={section} compact />
                  </div>
                </button>
              ))}
              {sections.length === 0 && (
                <Button type="button" size="sm" onClick={handleAddSection} disabled={createSection.isPending} className="w-full gap-2">
                  {createSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Section
                </Button>
              )}
            </nav>
          </Surface>
        )}

        <div className="min-w-0 flex-1 overflow-y-auto">
          {activeSection ? (
            <article className="mx-auto max-w-5xl">
              <Surface variant="canvas" padding="lg" className="min-h-[calc(100vh-11rem)] border border-separator">
                <div className="mx-auto max-w-3xl space-y-5">
                  <div className="space-y-3 border-b border-separator pb-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-meta uppercase tracking-[0.18em] text-text-muted">Active Section</p>
                        <Input
                          value={titleDraft}
                          onChange={(event) => setTitleDraft(event.target.value)}
                          onBlur={handleRenameSection}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur();
                            }
                          }}
                          aria-label="Section title"
                          className="h-auto border-transparent bg-transparent px-0 text-title font-semibold text-text-primary shadow-none focus-visible:border-interaction focus-visible:px-2"
                        />
                      </div>
                      <SectionStatusBadge section={activeSection} />
                    </div>

                    <p className="max-w-2xl text-body text-text-secondary">{activeState?.summary}</p>

                    <div className="flex flex-wrap gap-2">
                      {QUICK_ACTIONS.map((action) => (
                        <Button
                          key={action.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!activeSection) return;
                            if (action.mode === 'generate') {
                              void generateDraft.mutateAsync(activeSection.id);
                              return;
                            }
                            setAssistantDraft(action.prompt || '');
                            setAssistantOpen(true);
                          }}
                          disabled={generateDraft.isPending || refineDraft.isPending || activeSection.is_generating}
                          className="gap-2"
                        >
                          {action.mode === 'generate' ? <Sparkles className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          {action.label}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleMoveSection('up')}
                        disabled={sections.findIndex((section) => section.id === activeSection.id) <= 0 || reorderSections.isPending}
                        className="gap-2"
                      >
                        <ArrowUp className="h-4 w-4" />
                        Move
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleMoveSection('down')}
                        disabled={
                          sections.findIndex((section) => section.id === activeSection.id) >= sections.length - 1 ||
                          reorderSections.isPending
                        }
                        className="gap-2"
                      >
                        <ArrowDown className="h-4 w-4" />
                        Move
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteSection}
                        disabled={deleteSection.isPending}
                        className="gap-2"
                      >
                        {deleteSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete
                      </Button>
                    </div>

                    {activeSection.reviewed_at && (
                      <Notice variant="success" title="Review Metadata Recorded">
                        Accepted {new Date(activeSection.reviewed_at).toLocaleString()}
                        {activeSection.reviewed_against_analysis_id
                          ? ` against Analysis snapshot #${activeSection.reviewed_against_analysis_id}.`
                          : '.'}
                      </Notice>
                    )}
                  </div>

                  <div className="rounded-lg bg-canvas">
                    <MarkdownEditor value={content} onChange={setContent} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-4">
                    <div className="text-meta text-text-muted">
                      {isSaving ? 'Autosaving changes…' : lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString()}` : 'Edits remain local until the first save.'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAssistantOpen(true)}
                        className="gap-2"
                      >
                        <Bot className="h-4 w-4" />
                        Ask Assistant
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAcceptReview}
                        disabled={acceptReview.isPending}
                        className="gap-2"
                      >
                        {acceptReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Accept Review
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={updateSection.isPending} className="gap-2">
                        {updateSection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </Surface>
            </article>
          ) : (
            <Surface variant="panel" padding="lg">
              <p className="text-body text-text-secondary">Select a section to start working in the document surface.</p>
            </Surface>
          )}
        </div>

        {assistantOpen && (
          <Surface variant="panel" padding="none" className="flex w-full max-w-sm shrink-0 flex-col overflow-hidden">
            <div className="border-b border-separator px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-meta uppercase tracking-[0.18em] text-text-muted">Assistant Panel</p>
                  <h3 className="text-body font-semibold text-text-primary">Longer AI conversation</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setAssistantOpen(false)} aria-label="Close assistant panel">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-body text-text-secondary">
                Longer requests and suggested revisions for the active Section.
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {assistantEntries.length === 0 ? (
                <Surface variant="muted" padding="default" className="text-body text-text-secondary">
                  No assistant messages for this Section yet.
                </Surface>
              ) : (
                assistantEntries.map((entry) => (
                  <Surface
                    key={entry.id}
                    variant={entry.role === 'assistant' ? 'muted' : 'panel'}
                    padding="default"
                    className="space-y-3"
                  >
                    <p className="text-meta uppercase tracking-[0.18em] text-text-muted">
                      {entry.role === 'assistant' ? 'Assistant' : 'Instruction'}
                    </p>
                    <p className="whitespace-pre-wrap text-body text-text-primary">{entry.text}</p>
                    {entry.refined && (
                      <>
                        <div className="rounded-md border border-separator bg-canvas p-3 text-body text-text-secondary">
                          {entry.refined}
                        </div>
                        <Button type="button" size="sm" onClick={() => setContent(entry.refined || '')}>
                          Apply Suggested Draft
                        </Button>
                      </>
                    )}
                  </Surface>
                ))
              )}
            </div>

            <div className="border-t border-separator p-4">
              <div className="space-y-2">
                <Input
                  value={assistantDraft}
                  onChange={(event) => setAssistantDraft(event.target.value)}
                  placeholder="Ask for a revision, expansion, or wording change…"
                  aria-label="Assistant instruction"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={submitAssistantInstruction}
                  disabled={!activeSection || !assistantDraft.trim() || refineDraft.isPending}
                  className="w-full gap-2"
                >
                  {refineDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  Send to Assistant
                </Button>
              </div>
            </div>
          </Surface>
        )}
      </div>
    </div>
  );
}
