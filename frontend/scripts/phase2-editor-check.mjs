import { readFileSync } from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const repoRoot = path.resolve(frontendRoot, '..');

function readFrontend(relativePath) {
  return readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function fail(message) {
  console.error(`[phase2-editor] ${message}`);
  process.exitCode = 1;
}

function assertContains(source, value, message) {
  if (!source.includes(value)) fail(message);
}

const app = readFrontend('src/App.tsx');
const editor = readFrontend('src/pages/DocumentEditorPage.tsx');
const markdownEditor = readFrontend('src/components/editor/MarkdownEditor.tsx');
const documentsApi = readFrontend('src/api/documents.ts');
const phase1BackendTests = readFileSync(
  path.join(repoRoot, 'backend/tests/test_phase1_backend_contract_cleanup.py'),
  'utf8',
);

assertContains(
  app,
  '<Route path="/projects/:projectId/documents/:documentId" element={<DocumentEditorPage />} />',
  'canonical nested Document editor route is missing',
);

const fullScreenBlock = app.slice(
  app.indexOf('{/* Full-screen routes'),
  app.indexOf('{/* Main application routes'),
);
assertContains(
  fullScreenBlock,
  '/projects/:projectId/documents/:documentId',
  'canonical editor route must stay outside MainLayout',
);

[
  'function SectionBlock',
  'data-editor-section="true"',
  'MarkdownEditor value={content}',
  'onAdd(section.id, \'above\')',
  'onAdd(section.id, \'below\')',
  'Delete Section?',
  'documentsApi.reorderDocumentSections',
  'documentsApi.updateDocumentSectionTitle',
  'documentsApi.updateDocument(pid, did, { title })',
  'documentStatusLabel(document)',
  'data-toc-item="true"',
  'useTocKeyboardNavigation',
  'lg:grid-cols-[18rem_minmax(0,1fr)_3rem]',
  'col-start-1 row-start-2 hidden',
  'col-start-1 row-start-2 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto bg-canvas lg:col-start-2',
  'col-start-2 row-start-2 flex min-h-0 flex-col',
  'Grammar/style',
  'Reserved Tools',
].forEach((marker) => {
  assertContains(editor, marker, `editor source is missing ${marker}`);
});

[
  'EditorView.lineWrapping',
  'min-w-0 overflow-x-hidden',
].forEach((marker) => {
  assertContains(markdownEditor, marker, `MarkdownEditor source is missing ${marker}`);
});

[
  'getSections(projectId: number, documentId: number)',
  'createSection(projectId: number, documentId: number',
  'updateDocumentSection(',
  'autosaveDocumentSection(',
  'updateDocumentSectionTitle(',
  'reorderDocumentSections(',
  'deleteDocumentSection(',
].forEach((marker) => {
  assertContains(documentsApi, marker, `nested Section API contract is missing ${marker}`);
});

[
  'test_blank_project_document_and_manual_section_lifecycle',
  '"Current overview content"',
  'sections_response.json()["sections"]',
  'Details" not in exported',
  'sections/reorder',
  'sections/{overview',
].forEach((marker) => {
  assertContains(phase1BackendTests, marker, `Phase 1 backend coverage is missing ${marker}`);
});

if (!process.exitCode) {
  console.log('[phase2-editor] checks passed');
}
