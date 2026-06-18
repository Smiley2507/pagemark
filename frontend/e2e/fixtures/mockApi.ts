import type { Page, Route } from '@playwright/test';

type SetupStage = 'purpose' | 'template_selection' | 'outline_review' | 'generation_mode' | 'editor_ready';
type Scenario = 'no-provider' | 'source-no-provider' | 'provider' | 'template-resume' | 'outline-resume' | 'generation-resume';
type ChangeStatus = 'proposed' | 'accepted' | 'rejected' | 'undone';

const now = '2026-06-17T08:00:00.000Z';

interface MockChange {
  id: number;
  work_run_id: number;
  document_id: number;
  section_id: number | null;
  change_type: 'rewrite_selection' | 'add_section' | 'rename_section';
  status: ChangeStatus;
  title: string;
  rationale?: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  preview_markdown: string;
  created_at: string;
}

interface MockState {
  scenario: Scenario;
  project: ReturnType<typeof baseProject>;
  document: ReturnType<typeof baseDocument>;
  setupStage: SetupStage;
  sourceType: 'scratch' | 'git';
  recommendations: unknown[];
  outlineProposals: unknown[];
  sections: Array<Record<string, unknown>>;
  changes: MockChange[];
  nextChangeId: number;
  nextRunId: number;
  lastExportUrl?: URL;
}

export function createMockState(scenario: Scenario = 'provider'): MockState {
  const project = baseProject();
  const document = baseDocument();
  const sections = baseSections();
  const state: MockState = {
    scenario,
    project,
    document,
    setupStage: 'template_selection',
    sourceType: 'scratch',
    recommendations: [ruleRecommendation()],
    outlineProposals: [],
    sections,
    changes: [
      rewriteChange('proposed', 501),
      addSectionChange('proposed', 502),
    ],
    nextChangeId: 600,
    nextRunId: 800,
  };

  if (scenario === 'provider' || scenario === 'source-no-provider') {
    state.sourceType = 'git';
    state.project.source_type = 'git';
    state.project.source_metadata = { repo_url: 'https://github.com/acme/pagemark' };
    state.recommendations = scenario === 'provider' ? [ruleRecommendation(), aiRecommendation()] : [ruleRecommendation()];
  }
  if (scenario === 'template-resume') {
    state.setupStage = 'template_selection';
  }
  if (scenario === 'outline-resume') {
    state.setupStage = 'outline_review';
    state.document.setup_stage = 'outline_review';
    state.document.template_id = 101;
    state.document.template = templateSummary();
    state.outlineProposals = [outlineProposal('draft')];
  }
  if (scenario === 'generation-resume') {
    state.setupStage = 'generation_mode';
    state.document.setup_stage = 'generation_mode';
    state.document.template_id = 101;
    state.document.template = templateSummary();
    state.outlineProposals = [outlineProposal('approved')];
  }

  syncDocumentStage(state);
  return state;
}

export async function installMockApi(page: Page, state = createMockState()) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return route.continue();
    }
    if (url.port !== '8000') {
      return route.continue();
    }
    return handleApi(route, url, state);
  });
  return state;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function handleApi(route: Route, url: URL, state: MockState) {
  const request = route.request();
  const method = request.method();
  const path = url.pathname;

  if (method === 'GET' && path === '/auth/me') return json(route, user());
  if (method === 'POST' && path === '/auth/refresh') return json(route, { ok: true });
  if (method === 'GET' && path === '/organizations') return json(route, [organization()]);
  if (method === 'GET' && path === '/organizations/1/members') return json(route, [member()]);
  if (method === 'GET' && path === '/templates') return json(route, { templates: templates() });
  if (method === 'GET' && path === '/auth/me/ai-credentials') return json(route, credentials(state.scenario === 'provider' || state.scenario === 'outline-resume' || state.scenario === 'generation-resume'));
  if (method === 'GET' && path === '/auth/me/ai-providers') return json(route, providerCatalog());
  if (method === 'GET' && path === '/auth/me/ai-providers/openai/models') return json(route, { provider: 'openai', models: [{ id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' }], source: 'mock' });

  if (method === 'GET' && path === '/projects/git/repos') return json(route, gitRepos());
  if (method === 'GET' && path === '/projects/git/repos/acme/pagemark/branches') return json(route, [{ name: 'main', is_default: true }]);
  if (method === 'POST' && path === '/projects') {
    const body = postBody(request);
    state.project.name = body.name || state.project.name;
    state.project.description = body.description;
    state.project.source_type = body.source_type || state.project.source_type;
    state.sourceType = state.project.source_type === 'git' ? 'git' : 'scratch';
    return json(route, state.project);
  }
  if (method === 'GET' && path === '/projects') return json(route, { projects: [state.project], total: 1 });
  if (method === 'GET' && path === '/projects/10') return json(route, state.project);
  if (method === 'PATCH' && path === '/projects/10') {
    Object.assign(state.project, postBody(request), { updated_at: now });
    return json(route, state.project);
  }
  if (method === 'POST' && path === '/projects/10/git/connect-oauth') {
    state.project.source_type = 'git';
    state.project.source_metadata = { repo_url: 'https://github.com/acme/pagemark' };
    state.sourceType = 'git';
    return json(route, { job_id: 'analysis-1', analysis_id: 1 });
  }
  if (method === 'GET' && path === '/projects/10/analysis/status') return json(route, analysisStatus());
  if (method === 'GET' && path === '/projects/10/analysis/results') return json(route, analysisResults());
  if (method === 'GET' && path === '/projects/10/analysis/outline-diff') return json(route, { has_changes: false, current: [], proposed: [] });
  if (method === 'GET' && path === '/projects/10/ai-context') return json(route, aiContext(state));
  if (method === 'PATCH' && path === '/projects/10/context') {
    const body = postBody(request);
    state.project.context_md = body.context_md;
    return json(route, { context_md: state.project.context_md });
  }
  if (method === 'GET' && path === '/projects/10/activity') return json(route, { events: [], total: 0 });
  if (method === 'GET' && path === '/projects/10/activity/heatmap') return json(route, { days: [] });

  if (method === 'POST' && path === '/projects/10/documents') {
    const body = postBody(request);
    Object.assign(state.document, {
      title: body.title || state.document.title,
      context: body.context,
      setup_stage: body.setup_stage || 'purpose',
      updated_at: now,
    });
    state.setupStage = state.document.setup_stage as SetupStage;
    return json(route, state.document);
  }
  if (method === 'GET' && path === '/projects/10/documents') return json(route, { documents: [state.document], total: 1 });
  if (method === 'GET' && path === '/projects/10/documents/10') return json(route, state.document);
  if (method === 'PATCH' && path === '/projects/10/documents/10') {
    const body = postBody(request);
    Object.assign(state.document, body, { updated_at: now });
    if (body.setup_stage) state.setupStage = body.setup_stage;
    syncDocumentStage(state);
    return json(route, state.document);
  }
  if (method === 'GET' && path === '/projects/10/documents/10/setup') return json(route, setupSnapshot(state));
  if (method === 'GET' && path === '/projects/10/documents/10/template-recommendations') return json(route, { recommendations: state.recommendations });
  if (method === 'POST' && path === '/projects/10/documents/10/template-recommendations') {
    const body = postBody(request);
    if (body.basis === 'ai_personalized' && !state.recommendations.some((item: any) => item.basis === 'ai_personalized')) {
      state.recommendations.push(aiRecommendation());
    }
    return json(route, { recommendations: state.recommendations });
  }
  if (method === 'GET' && path === '/projects/10/documents/10/outline-proposals') return json(route, { proposals: state.outlineProposals });
  if (method === 'POST' && path === '/projects/10/documents/10/outline-proposals') {
    state.outlineProposals = [outlineProposal('draft')];
    return json(route, { proposal: state.outlineProposals[0] });
  }
  if (method === 'PATCH' && path === '/projects/10/documents/10/outline-proposals/201') {
    const body = postBody(request);
    state.outlineProposals = [outlineProposal('draft', body.outline)];
    return json(route, { proposal: state.outlineProposals[0] });
  }
  if (method === 'POST' && path === '/projects/10/documents/10/outline-proposals/201/approve') {
    state.outlineProposals = [outlineProposal('approved')];
    state.sections = setupSections().map((section, index) => ({
      id: 301 + index,
      project_id: 10,
      document_id: 10,
      heading: section.heading,
      title: section.heading,
      content_md: '',
      order_index: index,
      status: 'pending',
      content_lifecycle: 'pending',
      children: [],
      updated_at: now,
    }));
    return json(route, state.outlineProposals[0]);
  }
  if (method === 'POST' && path === '/projects/10/documents/10/generation-estimate') return json(route, generationEstimate());
  if (method === 'POST' && path === '/projects/10/documents/10/generation-runs') return json(route, { id: 71, status: 'completed' });
  if (method === 'GET' && path === '/projects/10/documents/10/generation-runs') return json(route, { runs: [] });
  if (method === 'GET' && path === '/projects/10/documents/10/sections') return json(route, { sections: state.sections });
  if (method === 'POST' && path === '/projects/10/documents/10/sections') {
    const section = sectionRecord(900 + state.sections.length, 'New Section', '');
    state.sections.push(section);
    return json(route, section);
  }
  if (method === 'PUT' && path === '/projects/10/documents/10/sections/reorder') return json(route, { sections: state.sections });
  if (method === 'GET' && path === '/projects/10/documents/10/freshness') return json(route, { freshness: 'fresh', stale_count: 0, stale_sections: [] });
  if (method === 'GET' && path === '/projects/10/documents/10/quality') return json(route, { report: null });
  if (method === 'POST' && path.match(/^\/projects\/10\/documents\/10\/sections\/\d+\/collaboration\/auth$/)) return json(route, { token: 'mock-liveblocks-token' });
  if (method === 'PATCH' && path.match(/^\/projects\/10\/documents\/10\/sections\/\d+\/collaboration\/snapshot$/)) return json(route, { saved: true, updated_at: now });
  if (method === 'GET' && path === '/projects/10/documents/10/ai/proposed-changes') return json(route, { proposed_changes: state.changes });
  if (method === 'POST' && path === '/projects/10/documents/10/ai/chat-actions') {
    const body = postBody(request);
    const message = String(body.message || '').toLowerCase();
    if (message.includes('insert')) {
      return json(route, {
        message: 'Prepared an insertion for the active section.',
        action: 'insert_at_cursor',
        action_payload: {
          title: 'Insert lifecycle note',
          section_id: 301,
          content_md: 'Inserted lifecycle note from AI.',
          rationale: 'Adds a concise lifecycle detail.',
        },
        work_run: null,
      });
    }
    if (message.includes('polish') || message.includes('replace')) {
      return json(route, {
        message: 'Prepared a replacement for the selected text.',
        action: 'replace_selection',
        action_payload: {
          title: 'Replace selected lifecycle text',
          section_id: 301,
          content_md: 'Replacement lifecycle text from AI.',
          rationale: 'Clarifies the selected text.',
        },
        work_run: null,
      });
    }
    if (message.includes('add') || message.includes('create')) {
      const runId = state.nextRunId++;
      const change = {
        id: state.nextChangeId++,
        work_run_id: runId,
        document_id: 10,
        section_id: null,
        change_type: 'add_section' as const,
        status: 'proposed' as const,
        title: 'Add AI-created section',
        rationale: 'The assistant found a missing workflow section.',
        before: null,
        after: {
          heading: 'AI Created Section',
          order_index: state.sections.length,
          content_md: 'AI-created section body.',
        },
        preview_markdown: 'AI-created section body.',
        created_at: now,
      };
      state.changes = [change, ...state.changes];
      return json(route, {
        message: 'Queued a new section for review.',
        action: 'add_section',
        work_run: {
          id: runId,
          document_id: 10,
          status: 'proposed',
          prompt_context: body,
          proposed_changes: [change],
          created_at: now,
          updated_at: now,
        },
      });
    }
    return json(route, { message: 'Mock answer from editor action endpoint.', action: 'answer', work_run: null });
  }
  if (method === 'POST' && path === '/projects/10/documents/10/ai/work-runs') {
    const body = postBody(request);
    const runId = state.nextRunId++;
    const changes = (body.changes || []).map((change: any) => ({
      id: state.nextChangeId++,
      work_run_id: runId,
      document_id: 10,
      status: 'proposed' as const,
      created_at: now,
      ...change,
    }));
    state.changes = [...changes, ...state.changes];
    return json(route, {
      id: runId,
      document_id: 10,
      status: 'proposed',
      prompt_context: body.prompt_context || {},
      proposed_changes: changes,
      created_at: now,
      updated_at: now,
    });
  }
  const acceptMatch = path.match(/^\/projects\/10\/documents\/10\/ai\/proposed-changes\/(\d+)\/accept$/);
  if (method === 'POST' && acceptMatch) {
    const change = state.changes.find((item) => item.id === Number(acceptMatch[1]));
    if (change) applyChange(state, change);
    return json(route, change);
  }
  const rejectMatch = path.match(/^\/projects\/10\/documents\/10\/ai\/proposed-changes\/(\d+)\/reject$/);
  if (method === 'POST' && rejectMatch) {
    const change = state.changes.find((item) => item.id === Number(rejectMatch[1]));
    if (change) change.status = 'rejected';
    return json(route, change);
  }
  const undoMatch = path.match(/^\/projects\/10\/documents\/10\/ai\/work-runs\/(\d+)\/undo$/);
  if (method === 'POST' && undoMatch) {
    state.changes.filter((item) => item.work_run_id === Number(undoMatch[1])).forEach((item) => { item.status = 'undone'; });
    state.sections = baseSections();
    return json(route, { id: Number(undoMatch[1]), document_id: 10, status: 'undone', prompt_context: {}, proposed_changes: state.changes, created_at: now, updated_at: now });
  }
  if (method === 'GET' && path === '/projects/10/chat/threads') return json(route, chatThreads());
  if (method === 'POST' && path === '/projects/10/chat/threads') return json(route, chatThreads()[0]);
  if (method === 'GET' && path === '/chat/threads/401/messages') return json(route, chatMessages());
  if (method === 'POST' && path === '/chat/threads/401/messages/stream') {
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"chunk":"Streamed AI update"}\n\ndata: [DONE]\n\n',
    });
  }
  if (method === 'POST' && path === '/sections/301/ai/refine') return json(route, {
    original: '# Overview\nExisting architecture summary.',
    refined: '# Overview\nRewritten architecture summary.',
    added: 3,
    removed: 2,
    diff_lines: [],
  });
  if (method === 'POST' && path === '/documents/10/ai/suggest-structure') return json(route, {
    suggestions: [
      {
        type: 'rename',
        section_id: 302,
        target_section_id: null,
        heading: 'Architecture',
        suggested_heading: 'System Architecture',
        suggested_order: null,
        suggested_parent_heading: null,
        reasoning: 'The section covers system boundaries, so the heading should be more explicit.',
      },
      {
        type: 'add',
        section_id: null,
        target_section_id: null,
        heading: null,
        suggested_heading: 'Operational Playbook',
        suggested_order: 2,
        suggested_parent_heading: null,
        suggested_content_md: 'Operational playbook body from source analysis.',
        reasoning: 'Operations deserve their own section.',
      },
    ],
  });

  if (method === 'GET' && path === '/projects/10/documents/10/export') {
    state.lastExportUrl = url;
    if (url.searchParams.get('format') === 'html') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><body><main class="page"><h1>Mock HTML Preview</h1><p>Page 1 of 3</p></main></body></html>',
      });
    }
    if (url.searchParams.get('format') === 'pdf') {
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: '%PDF-1.4\n% mock pagemark pdf\n%%EOF',
      });
    }
    return route.fulfill({ status: 200, contentType: 'text/markdown', body: '# Mock export' });
  }

  return json(route, { detail: `Unhandled mock route ${method} ${path}` }, 404);
}

function postBody(request: Route['request']) {
  try {
    return request.postDataJSON() as Record<string, any>;
  } catch {
    return {};
  }
}

function syncDocumentStage(state: MockState) {
  state.document.setup_stage = state.setupStage;
  state.document.template = state.document.template_id ? templateSummary() : undefined;
}

function applyChange(state: MockState, change: MockChange) {
  change.status = 'accepted';
  if (change.change_type === 'rewrite_selection' && change.section_id) {
    state.sections = state.sections.map((section) => section.id === change.section_id
      ? { ...section, content_md: String(change.after.content_md || ''), updated_at: now }
      : section);
  }
  if (change.change_type === 'add_section') {
    const heading = String(change.after.heading || 'Added Section');
    state.sections.push(sectionRecord(950 + state.sections.length, heading, String(change.after.content_md || '')));
  }
  if (change.change_type === 'rename_section' && change.section_id) {
    const heading = String(change.after.heading || change.after.title || 'Renamed Section');
    state.sections = state.sections.map((section) => section.id === change.section_id
      ? { ...section, heading, title: heading, updated_at: now }
      : section);
  }
}

function user() {
  return { id: 1, email: 'verified@example.com', name: 'Verified User', is_verified: true, created_at: now };
}

function organization() {
  return { id: 1, name: 'Personal', slug: 'personal', personal: true, role: 'owner', created_at: now };
}

function member() {
  return { id: 1, user_id: 1, user_name: 'Verified User', user_email: 'verified@example.com', role: 'owner', joined_at: now };
}

function baseProject() {
  return {
    id: 10,
    org_id: 1,
    created_by: 1,
    name: 'Pagemark API',
    description: 'A lifecycle documentation workspace.',
    status: 'draft' as const,
    completion_pct: 35,
    source_type: 'scratch' as const,
    source_metadata: {},
    tags: ['docs'],
    starred: false,
    documents_count: 1,
    sections_count: 2,
    context_md: 'Document lifecycle context.',
    created_at: now,
    updated_at: now,
  };
}

function baseDocument() {
  return {
    id: 10,
    project_id: 10,
    title: 'Lifecycle Guide',
    setup_stage: 'template_selection' as SetupStage,
    status: 'draft',
    freshness: 'fresh',
    progress: { total_sections: 2, reviewed_sections: 0, generated_sections: 2, pct: 50 },
    tags: ['lifecycle'],
    template_id: 101,
    template: templateSummary(),
    purpose: 'Explain the lifecycle.',
    audience: 'Engineers',
    context: 'Lifecycle coverage.',
    print_profile: {
      margins: 'wide',
      paper_size: 'letter',
      header_left: 'Pagemark',
      footer_center: 'Confidential',
      logo_position: 'header-left',
      include_page_numbers: true,
      include_cover_page: true,
      include_toc: true,
      h1_underline: false,
    },
    last_activity_at: now,
    created_at: now,
    updated_at: now,
  };
}

function templateSummary() {
  return { id: 101, name: 'Technical Overview', description: 'A maintainable technical overview.' };
}

function templates() {
  return [
    { id: 101, name: 'Technical Overview', description: 'A maintainable technical overview.', category: 'technical', sections_json: setupSections() },
    { id: 102, name: 'API Reference', description: 'Endpoint-oriented reference.', category: 'api', sections_json: [{ heading: 'Endpoints' }] },
  ];
}

function setupSections() {
  return [
    { heading: 'Overview', description: 'Orient the reader.', purpose: 'Introduce the system.', order_index: 0 },
    { heading: 'Architecture', description: 'Explain the components.', purpose: 'Clarify structure.', order_index: 1 },
  ];
}

function ruleRecommendation() {
  return {
    id: 1,
    document_id: 10,
    template_id: 101,
    basis: 'rule_based',
    score: 0.82,
    explanation: 'Best default for a source-less technical document.',
    template: { ...templateSummary(), category: 'technical', sections_preview: setupSections() },
  };
}

function aiRecommendation() {
  return {
    id: 2,
    document_id: 10,
    template_id: 101,
    basis: 'ai_personalized',
    score: 0.93,
    explanation: 'Personalized from repository facts and architecture signals.',
    provider_usage: { tokens: 1420, cost: 0.011 },
    template: { ...templateSummary(), category: 'technical', sections_preview: setupSections() },
  };
}

function outlineProposal(status: 'draft' | 'approved', outline = setupSections()) {
  return {
    id: 201,
    document_id: 10,
    basis: 'template',
    status,
    outline,
    outline_json: outline,
    explanation: { source: 'mock' },
    approved_at: status === 'approved' ? now : undefined,
  };
}

function setupSnapshot(state: MockState) {
  syncDocumentStage(state);
  return {
    document: state.document,
    recommendations: state.recommendations,
    outline_proposals: state.outlineProposals,
    clarification_requests: [],
    sections: state.sections.map((section, index) => ({
      id: section.id,
      heading: section.heading || section.title,
      order_index: index,
      content_lifecycle: section.content_lifecycle || 'pending',
      status: section.status || 'pending',
    })),
  };
}

function sectionRecord(id: number, heading: string, content: string) {
  return {
    id,
    project_id: 10,
    document_id: 10,
    heading,
    title: heading,
    content_md: content,
    order_index: id,
    status: 'draft',
    content_lifecycle: content ? 'generated' : 'pending',
    review_status: 'draft',
    children: [],
    created_at: now,
    updated_at: now,
  };
}

function baseSections() {
  return [
    sectionRecord(301, 'Overview', '# Overview\nExisting architecture summary.'),
    sectionRecord(302, 'Architecture', '# Architecture\nService boundaries and exports.'),
  ];
}

function rewriteChange(status: ChangeStatus, id: number): MockChange {
  return {
    id,
    work_run_id: 701,
    document_id: 10,
    section_id: 301,
    change_type: 'rewrite_selection',
    status,
    title: 'Rewrite overview',
    rationale: 'Improve clarity.',
    before: { content_md: '# Overview\nExisting architecture summary.' },
    after: { content_md: '# Overview\nRewritten architecture summary.' },
    preview_markdown: '# Overview\nRewritten architecture summary.',
    created_at: now,
  };
}

function addSectionChange(status: ChangeStatus, id: number): MockChange {
  return {
    id,
    work_run_id: 702,
    document_id: 10,
    section_id: null,
    change_type: 'add_section',
    status,
    title: 'Add operations section',
    rationale: 'Document operational workflow.',
    before: null,
    after: { heading: 'Operations', order_index: 2 },
    preview_markdown: 'Adds an Operations section.',
    created_at: now,
  };
}

function credentials(active: boolean) {
  return active
    ? { has_active: true, credentials: [{ id: 1, provider: 'openai', model_id: 'gpt-4.1-mini', key_hint: 'sk-...', is_active: true, validated_at: now, created_at: now }] }
    : { has_active: false, credentials: [] };
}

function providerCatalog() {
  return {
    providers: [
      { id: 'openai', label: 'OpenAI', models: [{ id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' }] },
    ],
  };
}

function gitRepos() {
  return [{
    id: 1,
    name: 'pagemark',
    full_name: 'acme/pagemark',
    description: 'Lifecycle documentation app',
    private: false,
    default_branch: 'main',
    updated_at: now,
    language: 'TypeScript',
    stars_count: 12,
    html_url: 'https://github.com/acme/pagemark',
  }];
}

function analysisStatus() {
  return {
    id: 1,
    project_id: 10,
    status: 'completed',
    step_number: 5,
    total_steps: 5,
    source_type: 'git',
    completed_at: now,
    steps: [
      { number: 1, name: 'file-tree', status: 'done' },
      { number: 2, name: 'languages', status: 'done' },
      { number: 3, name: 'endpoints', status: 'done' },
    ],
    facts: {
      languages: { available: true },
      endpoints: { available: true },
      dependencies: { available: true },
    },
  };
}

function analysisResults() {
  return {
    ...analysisStatus(),
    languages_json: { primary: ['TypeScript'], breakdown: [{ language: 'TypeScript', files: 42, lines: 4200, percent: 82, depth: 'primary' }], shallow: [] },
    endpoints_json: { count: 6, items: [], frameworks: ['FastAPI'] },
    dependencies_json: { items: [], total_files: 42 },
  };
}

function aiContext(state: MockState) {
  return {
    project: {
      id: 10,
      name: state.project.name,
      description: state.project.description,
      source_type: state.project.source_type,
      source_provider: state.project.source_type === 'git' ? 'github' : null,
      source_repository: state.project.source_type === 'git' ? 'acme/pagemark' : null,
      selected_branch: 'main',
      last_synced_commit: 'abc123',
    },
    project_brief: state.project.context_md,
    analysis_summary: {
      id: 1,
      status: state.project.source_type === 'git' ? 'completed' : 'skipped',
      is_current: true,
      completed_at: now,
      source_commit: 'abc123',
      total_files: state.project.source_type === 'git' ? 42 : 0,
      languages: state.project.source_type === 'git' ? ['TypeScript'] : [],
      frameworks: ['React', 'FastAPI'],
      endpoint_count: state.project.source_type === 'git' ? 6 : 0,
      dependency_count: state.project.source_type === 'git' ? 12 : 0,
      largest_files: [],
    },
    source_connection: state.project.source_metadata || {},
    facts: {},
    unavailable_facts: [],
    partial_failures: [],
    effective_exclusions: [],
    context_files_preview: [],
    grounding_warnings: [],
  };
}

function generationEstimate() {
  return {
    mode: 'on-demand',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    relative_usage: 'low',
    estimated_prompt_tokens: 1200,
    estimated_completion_tokens: 800,
    estimated_cost: 0.015,
    uncertainty: 'medium',
    pricing_note: 'Mock estimate.',
    section_breakdown: [
      { section_id: 301, heading: 'Overview', estimated_prompt_tokens: 600, estimated_completion_tokens: 400, estimated_cost: 0.007, uncertainty: 'medium' },
    ],
  };
}

function chatThreads() {
  return [{ id: 401, project_id: 10, title: 'Editor chat', created_at: now, updated_at: now }];
}

function chatMessages() {
  return [
    { id: 1, thread_id: 401, role: 'user', content: 'Improve this section', created_at: now },
    { id: 2, thread_id: 401, role: 'ai', content: 'AI generated paragraph for lifecycle checks.', created_at: now },
  ];
}
