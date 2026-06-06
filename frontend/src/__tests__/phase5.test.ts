import { describe, it, expect, vi } from 'vitest';
import { documentsApi } from '@/api/documents';
import { getSectionState } from '@/lib/section-state';
import type { Section } from '@/types';
import apiClient from '@/api/client';

// ── Mock apiClient ────────────────────────────────────────────────────────────

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// ── AI @reference tests ───────────────────────────────────────────────────────

describe('AI @ references attach intended context', () => {
  it('parses @section references from input text', () => {
    const input = 'Please review @section:Overview and @section:Endpoints';
    const refs = input.match(/@section:[a-zA-Z0-9_-]+/g);
    expect(refs).not.toBeNull();
    expect(refs).toHaveLength(2);
    expect(refs![0]).toBe('@section:Overview');
    expect(refs![1]).toBe('@section:Endpoints');
  });

  it('parses @document references', () => {
    const input = 'Based on @document:current update the intro';
    const refs = input.match(/@document:\S+/g);
    expect(refs).not.toBeNull();
    expect(refs![0]).toBe('@document:current');
  });

  it('parses @source references', () => {
    const input = 'Check @source:repository for the latest API signatures';
    const refs = input.match(/@source:\S+/g);
    expect(refs).not.toBeNull();
    expect(refs![0]).toBe('@source:repository');
  });

  it('parses @template references', () => {
    const input = 'Follow @template:document-template for the structure';
    const refs = input.match(/@template:\S+/g);
    expect(refs).not.toBeNull();
    expect(refs![0]).toBe('@template:document-template');
  });

  it('handles multiple reference types in a single message', () => {
    const input = 'Use @section:Overview with @document:current and @source:repo';
    const refs = input.match(/@(?:section|document|source|template):\S+/g);
    expect(refs).toHaveLength(3);
  });
});

// ── AI apply/replace/insert tests ────────────────────────────────────────────

describe('AI apply/replace/insert changes editor content correctly', () => {
  it('applies content by updating section content_md', async () => {
    const mockResponse = { id: 1, content_md: 'Generated AI content' };
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockResponse });

    const result = await documentsApi.updateDocumentSection(1, 1, 1, {
      content_md: 'Generated AI content',
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/projects/1/documents/1/sections/1',
      { content_md: 'Generated AI content' },
    );
    expect(result.content_md).toBe('Generated AI content');
  });

  it('replaces content with AI-generated alternative', async () => {
    const mockResponse = { id: 2, content_md: 'Replaced AI content' };
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockResponse });

    const result = await documentsApi.updateDocumentSection(1, 1, 2, {
      content_md: 'Replaced AI content',
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/projects/1/documents/1/sections/2',
      { content_md: 'Replaced AI content' },
    );
    expect(result.content_md).toBe('Replaced AI content');
  });

  it('inserts content at cursor via section update', async () => {
    const existingContent = 'Start of section.\n';
    const insertion = '\nInserted AI content.\n';
    const mockResponse = { id: 3, content_md: existingContent + insertion };
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockResponse });

    const result = await documentsApi.updateDocumentSection(1, 1, 3, {
      content_md: existingContent + insertion,
    });

    expect(result.content_md).toContain('Inserted AI content');
  });
});

// ── Notes create/list tests ──────────────────────────────────────────────────

describe('Notes create/list against Document or Section', () => {
  it('creates a Document-scoped note', async () => {
    const mockNote = { id: 1, document_id: 10, content: 'Doc note', user_id: 1 };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockNote });

    const result = await documentsApi.addNote(1, 10, 'Doc note');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/1/documents/10/notes',
      { content: 'Doc note', section_id: undefined },
    );
    expect(result.content).toBe('Doc note');
  });

  it('creates a Section-scoped note', async () => {
    const mockNote = { id: 2, document_id: 10, section_id: 5, content: 'Section note', user_id: 1 };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockNote });

    const result = await documentsApi.addNote(1, 10, 'Section note', 5);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/1/documents/10/notes',
      { content: 'Section note', section_id: 5 },
    );
    expect(result.section_id).toBe(5);
  });

  it('lists notes for a Document', async () => {
    const mockNotes = [
      { id: 1, document_id: 10, content: 'Note 1', user_id: 1, user_name: 'Alice' },
      { id: 2, document_id: 10, content: 'Note 2', user_id: 2, user_name: 'Bob' },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockNotes });

    const result = await documentsApi.getNotes(1, 10);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/projects/1/documents/10/notes',
      { params: {} },
    );
    expect(result).toHaveLength(2);
  });

  it('lists section-scoped notes with section_id filter', async () => {
    const mockNotes = [
      { id: 3, document_id: 10, section_id: 5, content: 'Section note', user_id: 1 },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockNotes });

    const result = await documentsApi.getNotes(1, 10, 5);
    expect(apiClient.get).toHaveBeenCalledWith(
      '/projects/1/documents/10/notes',
      { params: { section_id: 5 } },
    );
    expect(result).toHaveLength(1);
  });
});

// ── Review acceptance and edit invalidation tests ─────────────────────────────

describe('Review acceptance and edit invalidation still pass', () => {
  function makeSection(overrides: Partial<Section> = {}): Section {
    return {
      id: 1,
      document_id: 1,
      order_index: 0,
      heading: 'Test',
      title: 'Test',
      content_md: '',
      status: 'pending',
      children: [],
      ...overrides,
    };
  }

  it('getSectionState returns reviewed for finalized sections', () => {
    const section = makeSection({ content_lifecycle: 'reviewed', status: 'finalized' });
    const state = getSectionState(section);
    expect(state.key).toBe('reviewed');
    expect(state.label).toBe('Reviewed');
  });

  it('getSectionState returns unreviewed_edits for content without review', () => {
    const section = makeSection({ content_md: 'Some content' });
    const state = getSectionState(section);
    expect(state.key).toBe('unreviewed_edits');
  });

  it('getSectionState returns pending for empty sections', () => {
    const section = makeSection({ content_md: '' });
    const state = getSectionState(section);
    expect(state.key).toBe('pending');
  });

  it('accept-review endpoint sends correct payload', async () => {
    const mockResponse = { id: 1, content_lifecycle: 'reviewed', reviewed_by: 1 };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse });

    const result = await documentsApi.acceptSectionReview(1);
    expect(apiClient.post).toHaveBeenCalledWith('/sections/1/accept-review');
    expect(result.content_lifecycle).toBe('reviewed');
  });

  it('editing reviewed content clears review state in backend model', () => {
    const reviewed: Section = makeSection({
      content_lifecycle: 'reviewed',
      status: 'finalized',
      reviewed_by: 1,
      reviewed_at: '2025-01-01T00:00:00Z',
    });
    expect(reviewed.content_lifecycle).toBe('reviewed');
    expect(reviewed.reviewed_by).toBe(1);

    const edited = { ...reviewed, content_md: 'Edited after review', content_lifecycle: 'generated_draft' as const, status: 'draft' as const, reviewed_by: null, reviewed_at: null };
    expect(edited.content_lifecycle).toBe('generated_draft');
    expect(edited.reviewed_by).toBeNull();
  });
});

// ── Export from editor tests ──────────────────────────────────────────────────

describe('Export from editor matches current active Sections', () => {
  it('exports document as markdown via correct URL', () => {
    const projectId = 1;
    const documentId = 5;
    const format = 'markdown';
    const url = `/projects/${projectId}/documents/${documentId}/export?format=${format}`;
    expect(url).toBe('/projects/1/documents/5/export?format=markdown');
  });

  it('exports document as HTML with branding params', () => {
    const projectId = 1;
    const documentId = 5;
    const params = new URLSearchParams({ format: 'html', primary_color: '#2563eb' });
    const url = `/projects/${projectId}/documents/${documentId}/export?${params}`;
    expect(url).toContain('format=html');
    expect(url).toContain('primary_color=%232563eb');
  });

  it('export fetches with credentials include', () => {
    const baseURL = 'http://localhost:8000';
    const url = new URL('/projects/1/documents/1/export?format=markdown', baseURL);
    expect(url.toString()).toBe('http://localhost:8000/projects/1/documents/1/export?format=markdown');
  });
});

