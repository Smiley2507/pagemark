import { readFileSync } from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, '..');

function fail(message) {
  console.error(`[workspace-check] ${message}`);
  process.exitCode = 1;
}

function read(relativePath) {
  return readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertContains(source, value, message) {
  if (!source.includes(value)) {
    fail(message);
  }
}

function assertGlobalNavigation() {
  const source = read('src/components/layout/SidebarNavigation.tsx');
  ['label="Home"', 'label="Projects"', 'label="Templates"', 'label="Settings"'].forEach((label) => {
    assertContains(source, label, `global navigation is missing ${label}`);
  });
  ['New Project', 'sidebar-tags', 'topTags', 'Hash'].forEach((marker) => {
    assertContains(source, marker, `sidebar is missing Phase 4 marker ${marker}`);
  });
  ['label="Documents"', 'label="Source"', 'label="Activity"'].forEach((label) => {
    if (source.includes(label)) {
      fail(`global navigation should not contain project-only item ${label}`);
    }
  });
}

function assertProjectNavigation() {
  const source = read('src/pages/ProjectWorkspacePage.tsx');
  ['Documents', 'Source', 'Activity', 'Settings', "navigate('/projects')", 'projectsApi.updateProject', 'Project description'].forEach((marker) => {
    assertContains(source, marker, `project workspace navigation is missing ${marker}`);
  });
  const routes = read('src/App.tsx');
  assertContains(routes, 'ProjectSettingsPage', 'project settings route is missing');
}

function assertOldRoutesRedirect() {
  const routes = read('src/App.tsx');
  [
    'EditorLegacyRedirect',
    "path=\"/editor/:id\"",
    "Navigate to={\`/projects/",
  ].forEach((marker) => assertContains(routes, marker, `old route redirect is missing ${marker}`));
  if (/from ['"]\.\/pages\/Editor['"]/.test(routes)) {
    fail('legacy Editor import should be removed from App.tsx');
  }
  const editorPage = read('src/pages/DocumentEditorPage.tsx');
  assertContains(editorPage, 'DocumentEditorPage', 'document editor page should exist for active document routes');
}

function assertUnifiedLibrarySurfaces() {
  const home = read('src/pages/HomePage.tsx');
  const projects = read('src/pages/ProjectsPage.tsx');
  const documents = read('src/pages/DocumentLibraryPage.tsx');
  const sharedProjectLibrary = read('src/components/workspace/project-library.tsx');

  assertContains(home, 'Overview', 'home must render the unified overview card');
  assertContains(home, 'activeOverviewTab', 'home overview must switch content in one card');
  assertContains(home, 'headerActions', 'home project library controls must live in the project library card');
  assertContains(projects, 'headerActions', 'projects controls must live in the project library card');
  assertContains(documents, 'space-y-2 bg-panel-muted/55 p-3', 'document library must render separated rows inside one panel');
  assertContains(sharedProjectLibrary, 'headerActions', 'shared project library must support in-card header controls');

  [
    ["getViewMode('home-projects')", home, 'home should not use the removed project grid/list preference'],
    ["getViewMode('home-projects')", projects, 'projects should not use the removed project grid/list preference'],
    ["getViewMode('project-documents', projectId)", documents, 'document library should not use the removed document grid/list preference'],
  ].forEach(([marker, source, message]) => {
    if (source.includes(marker)) {
      fail(message);
    }
  });
}

function assertSharedPrimitives() {
  const home = read('src/pages/HomePage.tsx');
  const workspace = read('src/pages/DocumentLibraryPage.tsx');
  const sharedProjectLibrary = read('src/components/workspace/project-library.tsx');
  const sharedDocumentLibrary = read('src/components/workspace/document-library-items.tsx');

  [home, workspace, sharedProjectLibrary, sharedDocumentLibrary].forEach((source, index) => {
    if (!source.includes('Surface')) {
      fail(`workspace source ${index + 1} does not render through Surface primitives`);
    }
  });
}

function assertPhase4SearchAndSettings() {
  const header = read('src/components/layout/AppHeader.tsx');
  [
    'Search Projects, Documents, Sections',
    'Search entity type',
    'Search tag filter',
    'Search status filter',
    'Search sort',
    "sortBy === 'last_opened'",
    'value="project"',
    'value="document"',
    'value="section"',
  ].forEach((marker) => assertContains(header, marker, `topbar search is missing ${marker}`));

  const searchApi = read('src/api/search.ts');
  ['GlobalSearchType', 'GlobalSearchSort', 'last_opened', 'last_added', 'last_modified'].forEach((marker) => {
    assertContains(searchApi, marker, `search API is missing ${marker}`);
  });

  const settings = read('src/pages/SettingsPage.tsx');
  const aiProviders = read('src/components/settings/AiProvidersSection.tsx');
  const orgSettings = read('src/components/org/OrgSettingsView.tsx');
  [
    'Profile',
    'Organization',
    'Members',
    'Notifications',
    'AI Providers',
    'API Keys',
    'Activity Log',
    'section.keywords',
  ].forEach((marker) => assertContains(settings, marker, `settings center is missing ${marker}`));
  [
    'useAiProviderModels',
    'Refresh models',
    'Models refresh after validation.',
    'aiCredentialsApi.getModels',
  ].forEach((marker) => assertContains(aiProviders, marker, `AI providers settings is missing ${marker}`));
  [
    'AI_PROVIDERS',
    'Save AI Settings',
    'ai_provider',
    'ai_key',
  ].forEach((marker) => {
    if (orgSettings.includes(marker)) {
      fail(`organization settings still exposes duplicate AI provider setting ${marker}`);
    }
  });
  [
    'Source Connections',
    'Export Defaults',
    'Security',
  ].forEach((marker) => {
    if (settings.includes(marker)) {
      fail(`settings center still exposes stub surface ${marker}`);
    }
  });

  // Phase 4: Notifications is now a real section, not a stub
  assertContains(settings, 'Notifications', 'settings should now have a real Notifications section');
}

function assertNoPrimaryWorkspaceStubs() {
  const primaryFiles = [
    'src/components/layout/SidebarNavigation.tsx',
    'src/components/layout/AppHeader.tsx',
    'src/pages/HomePage.tsx',
    'src/pages/ProjectsPage.tsx',
    'src/pages/ProjectWorkspacePage.tsx',
    'src/pages/ProjectSettingsPage.tsx',
    'src/pages/SettingsPage.tsx',
  ];
  const banned = [/coming soon/i, /placeholder content/i, /not implemented/i, /stub/i];
  for (const file of primaryFiles) {
    const source = read(file);
    for (const pattern of banned) {
      if (pattern.test(source)) {
        fail(`${file} contains visible stub marker ${pattern}`);
      }
    }
  }
}

function assertLandingAndAuth() {
  const landing = read('src/pages/LandingPage.tsx');
  const authLayout = read('src/components/layout/AuthLayout.tsx');
  const login = read('src/pages/auth/LoginPage.tsx');
  const register = read('src/pages/auth/RegisterPage.tsx');

  [
    'Multi-Document workspace for software projects',
    'Documentation built section by section from your source code.',
    'Reviewable, trackable, fresh',
  ].forEach((marker) => assertContains(landing, marker, `landing page is missing "${marker}"`));

  // unsplash images and scroll-driven hooks are banned everywhere on public/auth surfaces
  ['images.unsplash.com', 'useScroll', 'useTransform'].forEach((marker) => {
    if (landing.includes(marker) || authLayout.includes(marker)) {
      fail(`public/auth surfaces must not rely on decorative media or scroll-motion marker ${marker}`);
    }
  });
  // motion/ imports are intentionally used on LandingPage for animations; ban only on AuthLayout
  if (authLayout.includes('motion/')) {
    fail('auth layout must not rely on motion/ animations');
  }

  assertContains(authLayout, 'Surface', 'auth layout is missing Surface');
  assertContains(authLayout, 'Connect source once', 'auth layout should reference the core product workflow');
  assertContains(login, 'your Documents, Sections, and review state', 'login page should reference workspace resume');
  assertContains(register, 'no provider credential required', 'register page should highlight low-friction start');
}

function assertFirstDocumentJourney() {
  const page = read('src/pages/DocumentSetupPage.tsx');
  const sourceStep = read('src/components/document-setup/SourceStep.tsx');
  const templateStep = read('src/components/document-setup/TemplateRecommendationStep.tsx');
  const generationStep = read('src/components/document-setup/GenerationChoiceStep.tsx');
  const rail = read('src/components/document-setup/SetupSummaryRail.tsx');

  [
    "documentsApi.createDocument",
    "documentsApi.getSetupState",
    "resumeProjectId",
    "setup_stage: 'template_selection'",
    "setup_stage: 'generation_mode'",
    "/projects/${setupState.projectId}/documents/${setupState.documentId}",
  ].forEach((marker) => assertContains(page, marker, `document setup flow is missing ${marker}`));

  [
    'GitHub is the primary source path',
    'Start without source',
    'Analysis-grounded recommendations, repository evidence, and source-change freshness will stay unavailable',
  ].forEach((marker) => assertContains(sourceStep, marker, `source step is missing "${marker}"`));

  [
    'Rule-based recommendations',
    'AI-personalized recommendation',
    'Provider-consuming action',
  ].forEach((marker) => assertContains(templateStep, marker, `template step is missing "${marker}"`));

  [
    'Enter editor without generation',
    'Approximate cost',
    'Section-level breakdown',
  ].forEach((marker) => assertContains(generationStep, marker, `generation choice step is missing "${marker}"`));

  ['Live summary', 'Current limitations', 'First-Document journey'].forEach((marker) => {
    assertContains(rail, marker, `summary rail is missing "${marker}"`);
  });
}

function assertQualityRequiresDocumentContext() {
  const modal = read('src/components/editor/QualityModal.tsx');
  [
    'hasDocumentContext',
    'enabled: open && hasDocumentContext',
    'isMissingQualityReport',
    'Open a Document to run quality analysis',
    'Quality analysis runs against one Document at a time.',
  ].forEach((marker) => {
    assertContains(modal, marker, `quality modal is missing document-context guard ${marker}`);
  });
  if (/documentId\s*=\s*0/.test(modal)) {
    fail('quality modal must not default missing documentId to 0');
  }
}

function assertPhasePromptsStartFromCanonicalPrompt() {
  const promptFiles = [
    'docs/REDESIGN_PHASE_PROMPTS.md',
    'docs/GAP_FILL_PHASE_PROMPTS.md',
  ];

  for (const file of promptFiles) {
    const source = readRepo(file);
    const promptBlocks = [...source.matchAll(/```text\n([\s\S]*?)```/g)];
    if (promptBlocks.length === 0) {
      fail(`${file} does not contain phase prompt blocks`);
      continue;
    }
    for (const [index, block] of promptBlocks.entries()) {
      const firstLine = block[1].trimStart().split('\n')[0];
      if (firstLine !== 'Read docs/CANONICAL_EXECUTION_PROMPT.md first.') {
        fail(`${file} prompt block ${index + 1} must read docs/CANONICAL_EXECUTION_PROMPT.md first`);
      }
      if (/Read docs\/REDESIGN_IMPLEMENTATION_PLAN\.md|Read docs\/MASTER_ROADMAP\.md|Read docs\/ARCHITECTURE_REVIEW\.md|Read docs\/LANDING_PAGE_COPY\.md/.test(block[1])) {
        fail(`${file} prompt block ${index + 1} points to an older source-of-truth document`);
      }
    }
  }
}

assertGlobalNavigation();
assertProjectNavigation();
assertOldRoutesRedirect();
assertUnifiedLibrarySurfaces();
assertSharedPrimitives();
assertPhase4SearchAndSettings();
assertNoPrimaryWorkspaceStubs();
assertLandingAndAuth();
assertFirstDocumentJourney();
assertQualityRequiresDocumentContext();
assertPhasePromptsStartFromCanonicalPrompt();

if (!process.exitCode) {
  console.log('[workspace-check] checks passed');
}
