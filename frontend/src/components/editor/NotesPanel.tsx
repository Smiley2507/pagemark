import { useState, useRef, useEffect } from 'react';
import { FileText, MessageSquare, Plus, Loader2, User, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNotes, useCreateNote } from '@/hooks/useNotes';
import { useAuthStore } from '@/store/authStore';
import { resourcesApi } from '@/api/resources';
import { cn } from '@/lib/utils';
import type { NoteReference } from '@/types';

interface NotesPanelProps {
  projectId: number;
  documentId: number;
  activeSectionId: number | null;
  initialScope?: 'document' | 'section';
  focusSignal?: number;
  sections?: Array<{ id: number; heading: string; title?: string | null }>;
  canComment?: boolean;
}

export function NotesPanel({ projectId, documentId, activeSectionId, initialScope = 'document', focusSignal = 0, sections = [], canComment = true }: NotesPanelProps) {
  const [scope, setScope] = useState<'document' | 'section'>(initialScope);
  const [newNote, setNewNote] = useState('');
  const [references, setReferences] = useState<NoteReference[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const user = useAuthStore((s) => s.user);
  const resolvedSectionId = scope === 'section' ? activeSectionId : null;
  const { data: notes = [], isLoading } = useNotes(projectId, documentId, resolvedSectionId, {
    refetchInterval: 2500,
  });
  const createNote = useCreateNote(projectId, documentId);
  const { data: resourcesData } = useQuery({
    queryKey: ['resources', projectId],
    queryFn: () => resourcesApi.list(projectId),
    enabled: projectId > 0,
  });
  const resources = resourcesData?.resources ?? [];

  useEffect(() => {
    setScope(initialScope);
    if (focusSignal > 0) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [focusSignal, initialScope]);

  useEffect(() => {
    if (newNote && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [newNote]);

  const handleSubmit = () => {
    const content = newNote.trim();
    if (!content) return;
    createNote.mutate(
      { content, sectionId: resolvedSectionId, references },
      { onSuccess: () => { setNewNote(''); setReferences([]); } },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const addReference = (reference: NoteReference) => {
    if (references.some((item) => item.type === reference.type && item.id === reference.id && item.label === reference.label)) {
      return;
    }
    setReferences((current) => [...current, reference]);
  };

  const removeReference = (index: number) => {
    setReferences((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const currentSection = sections.find((section) => section.id === activeSectionId);

  useEffect(() => {
    if (scope === 'section' && currentSection) {
      addReference({
        type: 'section',
        id: currentSection.id,
        label: currentSection.title || currentSection.heading || `Section ${currentSection.id}`,
      });
    }
  }, [scope, currentSection?.id]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-separator px-4">
        <MessageSquare className="h-4 w-4 text-text-muted" />
        <span className="text-sm font-medium text-text-primary">Notes</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setScope('document')}
            className={cn(
              'rounded px-2 py-0.5 text-xs transition-colors',
              scope === 'document'
                ? 'bg-interaction-muted text-interaction-hover'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            Document
          </button>
          <button
            onClick={() => setScope('section')}
            className={cn(
              'rounded px-2 py-0.5 text-xs transition-colors',
              scope === 'section'
                ? 'bg-interaction-muted text-interaction-hover'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            Section
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <MessageSquare className="mb-2 h-6 w-6 text-text-muted" />
            <p className="text-sm font-medium text-text-primary">No notes yet</p>
            <p className="mt-1 text-xs text-text-muted">
              {scope === 'section' && !activeSectionId
                ? 'Select a section to add section-scoped notes'
                : 'Add a note below'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 px-4 py-4">
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-separator bg-canvas p-3">
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-panel-muted">
                    <User className="h-3 w-3 text-text-muted" />
                  </div>
                  <span className="text-xs font-medium text-text-primary">
                    {note.user_name || 'Unknown'}
                  </span>
                  <span className="ml-auto text-[10px] text-text-muted">
                    {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-text-secondary whitespace-pre-wrap">{note.content}</p>
                {note.references && note.references.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {note.references.map((reference, index) => (
                      <span
                        key={`${reference.type}-${reference.id ?? reference.label}-${index}`}
                        className="inline-flex max-w-full items-center gap-1 rounded border border-separator bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-muted"
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{reference.label}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canComment && (
      <div className="shrink-0 border-t border-separator px-3 pb-3 pt-3">
        <div className="rounded-lg border border-input bg-canvas focus-within:border-interaction">
          <textarea
            ref={textareaRef}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={scope === 'section' ? 'Note about this section...' : 'Note about the document...'}
            className="w-full resize-none bg-transparent px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            rows={2}
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[10px] text-text-muted">
              {scope === 'section' ? 'Section note' : 'Document note'}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!newNote.trim() || createNote.isPending}
              className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              {createNote.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </button>
          </div>
          <div className="border-t border-separator px-2 py-2">
            <div className="mb-2 flex flex-wrap gap-1">
              {references.map((reference, index) => (
                <button
                  key={`${reference.type}-${reference.id ?? reference.label}-${index}`}
                  type="button"
                  onClick={() => removeReference(index)}
                  className="inline-flex max-w-full items-center gap-1 rounded border border-separator bg-panel-muted px-1.5 py-0.5 text-[10px] text-text-secondary hover:text-text-primary"
                  title="Remove citation"
                >
                  <span className="truncate">{reference.label}</span>
                  <X className="h-3 w-3 shrink-0" />
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <select
                value=""
                onChange={(event) => {
                  const section = sections.find((item) => String(item.id) === event.target.value);
                  if (section) {
                    addReference({
                      type: 'section',
                      id: section.id,
                      label: section.title || section.heading || `Section ${section.id}`,
                    });
                  }
                }}
                className="h-7 rounded border border-input bg-canvas px-2 text-[10px] text-text-secondary"
              >
                <option value="">Add section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title || section.heading || `Section ${section.id}`}
                  </option>
                ))}
              </select>
              <select
                value=""
                onChange={(event) => {
                  const resource = resources.find((item) => String(item.id) === event.target.value);
                  if (resource) {
                    addReference({
                      type: 'resource',
                      id: resource.id,
                      label: resource.original_name,
                      metadata: {
                        mime_type: resource.mime_type,
                        file_path: resource.file_path,
                      },
                    });
                  }
                }}
                className="h-7 rounded border border-input bg-canvas px-2 text-[10px] text-text-secondary"
              >
                <option value="">Add resource</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.original_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
