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

assertGlobalNavigation();
assertProjectNavigation();
assertLibraryPreferences();
assertSharedPrimitives();

if (!process.exitCode) {
  console.log('[workspace-check] checks passed');
}
