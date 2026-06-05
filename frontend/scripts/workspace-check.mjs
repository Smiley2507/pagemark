import { readFileSync } from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();

function fail(message) {
  console.error(`[workspace-check] ${message}`);
  process.exitCode = 1;
}

function read(relativePath) {
  return readFileSync(path.join(frontendRoot, relativePath), 'utf8');
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
  ['label="Documents"', 'label="Source"', 'label="Activity"'].forEach((label) => {
    if (source.includes(label)) {
      fail(`global navigation should not contain project-only item ${label}`);
    }
  });
}

function assertProjectNavigation() {
  const source = read('src/pages/ProjectWorkspacePage.tsx');
  ['Documents', 'Source', 'Activity', "navigate('/projects')"].forEach((marker) => {
    assertContains(source, marker, `project workspace navigation is missing ${marker}`);
  });
}

function assertLibraryPreferences() {
  const home = read('src/pages/HomePage.tsx');
  const projects = read('src/pages/ProjectsPage.tsx');
  const documents = read('src/pages/DocumentLibraryPage.tsx');
  assertContains(home, "getViewMode('home-projects')", 'home must use persisted project-library view preference');
  assertContains(projects, "getViewMode('home-projects')", 'projects page must reuse project-library view preference');
  assertContains(documents, "getViewMode('project-documents', projectId)", 'document library must use persisted project view preference');
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

function assertLandingAndAuth() {
  const landing = read('src/pages/LandingPage.tsx');
  const authLayout = read('src/components/layout/AuthLayout.tsx');
  const login = read('src/pages/auth/LoginPage.tsx');
  const register = read('src/pages/auth/RegisterPage.tsx');

  [
    'Source-connected multi-Document workspace',
    'Pagemark creates purpose-specific Documents from one connected Project.',
    'Static Analysis works without a provider',
    'AI usage is explicit before it happens',
  ].forEach((marker) => assertContains(landing, marker, `landing page is missing "${marker}"`));

  ['images.unsplash.com', 'motion/', 'useScroll', 'useTransform'].forEach((marker) => {
    if (landing.includes(marker) || authLayout.includes(marker)) {
      fail(`public/auth surfaces must not rely on decorative media or motion marker ${marker}`);
    }
  });

  ['Surface', 'Same system as the workspace'].forEach((marker) => {
    assertContains(authLayout, marker, `auth layout is missing ${marker}`);
  });
  assertContains(login, 'resume Document setup', 'login page should align copy with the first-Document flow');
  assertContains(register, 'Provider credentials remain optional', 'register page should clarify provider setup timing');
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

assertGlobalNavigation();
assertProjectNavigation();
assertLibraryPreferences();
assertSharedPrimitives();
assertLandingAndAuth();
assertFirstDocumentJourney();

if (!process.exitCode) {
  console.log('[workspace-check] checks passed');
}
