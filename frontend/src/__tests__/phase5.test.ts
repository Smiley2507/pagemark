import { beforeEach, describe, it, expect, vi } from 'vitest';
import { documentsApi } from '@/api/documents';
import { aiApi } from '@/api/ai';
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

beforeEach(() => {
  vi.clearAllMocks();
});

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

// ── Document setup lifecycle contract tests ──────────────────────────────────

describe('Document setup routes use lifecycle-owned artifacts', () => {
  it('creates provider-adapted outline proposals through the nested Document setup route', async () => {
    const adaptedOutline = [
      {
        heading: 'System Overview',
        description: 'Explain the architecture from repository facts.',
        order_index: 0,
      },
    ];
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: 9,
        document_id: 7,
        basis: 'analysis_adapted',
        status: 'draft',
        outline_json: adaptedOutline,
        explanation: { provider_usage_ref: 'openai:gpt-4.1-mini' },
      },
    });

    const result = await documentsApi.createOutlineProposal(3, 7, {
      basis: 'analysis_adapted',
      template_id: 4,
      explanation: { selected_recommendation_id: 12 },
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/3/documents/7/outline-proposals',
      {
        basis: 'analysis_adapted',
        template_id: 4,
        explanation: { selected_recommendation_id: 12 },
      },
    );
    expect(result.proposal.outline_json).toEqual(adaptedOutline);
    expect(result.proposal.basis).toBe('analysis_adapted');
  });

  it('normalizes legacy outline responses to outline_json', async () => {
    const outline = [
      {
        heading: 'Install',
        description: 'How to install the package.',
        order_index: 0,
      },
    ];
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: 10,
        document_id: 7,
        basis: 'custom_outline',
        status: 'draft',
        outline,
      },
    });

    const result = await documentsApi.createOutlineProposal(3, 7, {
      basis: 'custom_outline',
      outline,
    });

    expect(result.proposal.outline_json).toEqual(outline);
  });

  it('persists professional report profiles on the Document instead of the Project export settings', async () => {
    const printProfile = {
      page_size: 'A4',
      margins: { top: '0.75in', right: '0.7in', bottom: '0.8in', left: '0.7in' },
      include_page_numbers: true,
      footer_right: 'Confidential',
      h1_underline: false,
    };
    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: {
        id: 7,
        project_id: 3,
        title: 'Operator Guide',
        print_profile: printProfile,
      },
    });

    const result = await documentsApi.updateDocument(3, 7, {
      print_profile: printProfile,
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/projects/3/documents/7',
      { print_profile: printProfile },
    );
    expect(result.print_profile).toEqual(printProfile);
  });
});

// ── AI proposed-change workflow contract tests ───────────────────────────────

describe('AI proposed-change workflow routes are reviewable and nested', () => {
  it('creates a grouped AI work run with typed proposed changes', async () => {
    const payload = {
      provider: 'openai',
      model: 'gpt-4.1-mini',
      prompt_context: { source: 'editor-selection', instruction: 'Tighten this' },
      estimated_prompt_tokens: 120,
      estimated_completion_tokens: 80,
      estimated_cost: 0.004,
      changes: [
        {
          change_type: 'rewrite_selection' as const,
          title: 'Rewrite selected paragraph',
          section_id: 11,
          rationale: 'Make the paragraph clearer for maintainers.',
          before: { content_md: 'Old paragraph' },
          after: { content_md: 'Clearer paragraph' },
          preview_markdown: 'Clearer paragraph',
        },
      ],
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: 20,
        document_id: 7,
        provider: 'openai',
        model: 'gpt-4.1-mini',
        prompt_context: payload.prompt_context,
        status: 'proposed',
        proposed_changes: [
          {
            id: 30,
            work_run_id: 20,
            document_id: 7,
            section_id: 11,
            change_type: 'rewrite_selection',
            status: 'proposed',
            title: 'Rewrite selected paragraph',
            after: { content_md: 'Clearer paragraph' },
            created_at: '2026-06-17T00:00:00Z',
          },
        ],
        created_at: '2026-06-17T00:00:00Z',
        updated_at: '2026-06-17T00:00:00Z',
      },
    });

    const result = await aiApi.createWorkRun(3, 7, payload);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/3/documents/7/ai/work-runs',
      payload,
    );
    expect(result.status).toBe('proposed');
    expect(result.proposed_changes[0].change_type).toBe('rewrite_selection');
  });

  it('lists proposed changes from the Document AI queue', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        proposed_changes: [
          {
            id: 30,
            work_run_id: 20,
            document_id: 7,
            change_type: 'rename_section',
            status: 'proposed',
            title: 'Rename section',
            after: { heading: 'Operations' },
            created_at: '2026-06-17T00:00:00Z',
          },
        ],
      },
    });

    const result = await aiApi.listProposedChanges(3, 7);

    expect(apiClient.get).toHaveBeenCalledWith(
      '/projects/3/documents/7/ai/proposed-changes',
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('proposed');
  });

  it('previews, accepts, rejects, and undoes proposed changes through explicit endpoints', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        change: { id: 30, status: 'proposed' },
        preview: { markdown: '# Preview' },
      },
    });
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { id: 30, status: 'accepted' } })
      .mockResolvedValueOnce({ data: { id: 31, status: 'rejected' } })
      .mockResolvedValueOnce({
        data: {
          id: 20,
          document_id: 7,
          status: 'undone',
          proposed_changes: [],
          prompt_context: {},
          created_at: '2026-06-17T00:00:00Z',
          updated_at: '2026-06-17T00:00:00Z',
        },
      });

    const preview = await aiApi.previewProposedChange(3, 7, 30);
    const accepted = await aiApi.acceptProposedChange(3, 7, 30);
    const rejected = await aiApi.rejectProposedChange(3, 7, 31);
    const undone = await aiApi.undoWorkRun(3, 7, 20);

    expect(apiClient.get).toHaveBeenCalledWith(
      '/projects/3/documents/7/ai/proposed-changes/30/preview',
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/3/documents/7/ai/proposed-changes/30/accept',
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/3/documents/7/ai/proposed-changes/31/reject',
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/3/documents/7/ai/work-runs/20/undo',
    );
    expect(preview.preview.markdown).toBe('# Preview');
    expect(accepted.status).toBe('accepted');
    expect(rejected.status).toBe('rejected');
    expect(undone.status).toBe('undone');
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

  it('exports document PDF with normalized professional report profile params', () => {
    const projectId = 1;
    const documentId = 5;
    const params = new URLSearchParams({
      format: 'pdf',
      page_size: 'A4',
      include_page_numbers: 'true',
      footer_right: 'Confidential',
      h1_underline: 'false',
    });
    const url = `/projects/${projectId}/documents/${documentId}/export?${params}`;
    expect(url).toContain('format=pdf');
    expect(url).toContain('page_size=A4');
    expect(url).toContain('include_page_numbers=true');
    expect(url).toContain('footer_right=Confidential');
    expect(url).toContain('h1_underline=false');
    expect(params.has('page_numbers')).toBe(false);
  });

  it('export fetches with credentials include', () => {
    const baseURL = 'http://127.0.0.1:8000';
    const url = new URL('/projects/1/documents/1/export?format=markdown', baseURL);
    expect(url.toString()).toBe('http://127.0.0.1:8000/projects/1/documents/1/export?format=markdown');
  });
});
