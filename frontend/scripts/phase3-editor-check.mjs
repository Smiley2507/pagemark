import { readFileSync } from 'node:fs';
import path from 'node:path';
import { EditorState, Text } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { GFM } from '@lezer/markdown';
import {
  addCol,
  addRow,
  deleteCol,
  deleteRow,
  findTableAtCursor,
  formatTable,
  getTableAlignments,
} from '../src/components/editor/tableUtils.ts';

const frontendRoot = process.cwd();

function readFrontend(relativePath) {
  return readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

function fail(message) {
  console.error(`[phase3-editor] ${message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertContains(source, value, message) {
  assert(source.includes(value), message);
}

function parseNodeNames(doc) {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] })],
  });
  const names = new Set();
  syntaxTree(state).iterate({
    enter(node) {
      names.add(node.name);
    },
  });
  return names;
}

function assertMarkdownParsing() {
  const markdownSource = [
    '# Heading',
    '',
    '**bold** _italic_ [link](https://example.com) `code`',
    '',
    '```ts',
    'const value = true;',
    '```',
    '',
    '- [ ] task',
    '',
    '| A | B |',
    '| --- | --- |',
    '| C | D |',
    '',
    '---',
  ].join('\n');
  const nodes = parseNodeNames(markdownSource);
  for (const node of [
    'ATXHeading1',
    'StrongEmphasis',
    'Emphasis',
    'Link',
    'InlineCode',
    'FencedCode',
    'TaskMarker',
    'Table',
    'HorizontalRule',
  ]) {
    assert(nodes.has(node), `CodeMirror GFM parser did not expose ${node}`);
  }
}

function assertTableOperations() {
  const source = '| A | B |\n| :--- | ---: |\n| 1 | 2 |';
  const doc = Text.of(source.split('\n'));
  const ctx = findTableAtCursor(doc, source.indexOf('2'));
  assert(ctx, 'table context was not detected at cursor');
  assert(ctx.rows.length === 3, 'table context should include header, separator, and body row');

  const alignments = getTableAlignments(doc, ctx);
  assert(alignments.join(',') === 'left,right', 'table alignments were not preserved from separator row');

  const insertedRow = addRow(ctx, false, alignments);
  assert(/^\| 1\s+\| 2\s+\|$/m.test(insertedRow), 'add row should preserve existing body content');
  assert(insertedRow.split('\n').length === 4, 'add row should create one body row');
  assert(parseNodeNames(insertedRow).has('Table'), 'add row should emit valid markdown table');

  const insertedColumn = addCol(ctx, false, alignments);
  assert(/^\| A\s+\| B\s+\|\s+\|$/m.test(insertedColumn), 'add column should preserve existing headers and append a column');
  assert(parseNodeNames(insertedColumn).has('Table'), 'add column should emit valid markdown table');

  const deletedColumn = deleteCol(ctx, alignments);
  assert(deletedColumn && /^\| A\s+\|$/m.test(deletedColumn), 'delete column should remove only the active column');
  assert(parseNodeNames(deletedColumn).has('Table'), 'delete column should emit valid markdown table');

  const fourRowDoc = Text.of('| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |'.split('\n'));
  const fourRowSource = fourRowDoc.toString();
  const fourRowCtx = findTableAtCursor(fourRowDoc, fourRowSource.indexOf('4'));
  const deletedRow = deleteRow(fourRowCtx, ['left', 'left']);
  assert(deletedRow && !deletedRow.includes('| 3 | 4 |'), 'delete row should remove the active body row');
  assert(parseNodeNames(deletedRow).has('Table'), 'delete row should emit valid markdown table');

  const formatted = formatTable([['Name', 'Value'], ['---', '---'], ['alpha', '1']], ['center', 'right']);
  assert(formatted.includes('| :---: | ----: |'), 'format table should preserve center and right alignment markers');
}

function assertEditorSourceHooks() {
  const markdownEditor = readFrontend('src/components/editor/MarkdownEditor.tsx');
  const livePreview = readFrontend('src/components/editor/livePreview.ts');
  const slashMenu = readFrontend('src/components/editor/SlashCommandMenu.tsx');
  const tableKeymap = readFrontend('src/components/editor/tableKeymap.ts');
  const grammarDecoration = readFrontend('src/components/editor/grammarDecoration.ts');
  const indexCss = readFrontend('src/index.css');
  const button = readFrontend('src/components/ui/button.tsx');

  assertContains(markdownEditor, 'extensions: [GFM]', 'MarkdownEditor must enable GFM parsing');
  assertContains(markdownEditor, 'livePreviewExtension', 'MarkdownEditor must keep CodeMirror live preview enabled');
  assertContains(livePreview, 'cm-lp-strong', 'live preview must style bold spans');
  assertContains(livePreview, 'cm-lp-em', 'live preview must style italic spans');
  assertContains(livePreview, 'cm-lp-link', 'live preview must style link labels');
  assertContains(livePreview, 'cm-lp-inline-code', 'live preview must style inline code spans');
  assertContains(livePreview, 'CodeBlockWidget', 'live preview must render fenced code blocks');
  assertContains(livePreview, 'CheckboxWidget', 'live preview must render checkboxes');
  assertContains(livePreview, 'HRWidget', 'live preview must render horizontal rules');
  assertContains(tableKeymap, "key: 'Tab'", 'table keymap must support Tab navigation');
  assertContains(tableKeymap, "key: 'Enter'", 'table keymap must support row insertion with Enter');

  for (const command of [
    'paragraph',
    'heading-1',
    'heading-2',
    'heading-3',
    'checklist',
    'code-block',
    'table',
    'quote-callout',
    'horizontal-rule',
  ]) {
    assertContains(slashMenu, `id: '${command}'`, `slash menu is missing ${command}`);
  }
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) {
    assertContains(slashMenu, key, `slash menu keyboard navigation is missing ${key}`);
  }

  assertContains(grammarDecoration, 'var(--status-warning-foreground)', 'grammar indicators must use semantic status tokens');
  assertContains(grammarDecoration, 'underline dotted', 'grammar indicators should be visible but restrained');
  assertContains(indexCss, '@media (prefers-reduced-motion: reduce)', 'reduced motion coverage is missing');
  assertContains(button, 'focus-visible:ring-2', 'governed buttons must preserve visible focus');
}

assertMarkdownParsing();
assertTableOperations();
assertEditorSourceHooks();

if (!process.exitCode) {
  console.log('[phase3-editor] checks passed');
}
