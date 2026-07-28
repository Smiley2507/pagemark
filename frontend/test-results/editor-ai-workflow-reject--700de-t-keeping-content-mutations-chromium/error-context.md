# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-ai-workflow.spec.ts >> reject and undo update panel state without keeping content mutations
- Location: e2e/editor-ai-workflow.spec.ts:29:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('add section · rejected')
Expected: visible
Timeout: 7500ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 7500ms
  - waiting for getByText('add section · rejected')

```

```yaml
- region "Notifications alt+T"
- button "Ctrl+Shift+F Exit focus mode"
- banner:
  - button "Back to project"
  - textbox "Document title": Lifecycle Guide
  - text: Draft Saved
  - tooltip "Saved 10:00:00 AM"
  - button "Quality"
  - button "Share"
  - button "Export"
  - button "User menu": VU
- complementary:
  - paragraph: Outline
  - button "Accept all review-ready sections"
  - button "Close outline panel"
  - navigation "Document table of contents":
    - button "Drag Overview"
    - button "Overview"
    - button "Overview"
    - button "Drag Architecture"
    - button "Architecture"
    - button "Architecture"
    - status
  - text: Words 11 Review 0/2
  - button "Quality"
  - button "Run quality analysis"
  - text: NaN% Issues 0 Broken links 0
- main:
  - text: 2 sections 11 words
  - textbox "Heading for Overview": Overview
  - text: Generated Draft
  - button "Add section above"
  - button "Add section below"
  - button "Delete section"
  - button "More actions"
  - heading "Overview" [level=1]
  - paragraph: Existing architecture summary.
  - textbox "Heading for Architecture": Architecture
  - text: Generated Draft
  - button "Add section above"
  - button "Add section below"
  - button "Delete section"
  - button "More actions"
  - heading "Architecture" [level=1]
  - paragraph: Service boundaries and exports.
  - button "Add Section"
- button "AI"
- button "Notes"
- button "Close right panel"
- text: Mark
- button "AI settings"
- text: AI model
- combobox "AI model":
  - option "gpt-4.1-mini" [selected]
- button "Context"
- heading "Open review" [level=3]
- paragraph: Queued changes not attached to the current conversation.
- text: "1"
- paragraph: Rewrite overview
- paragraph: rewrite selection · proposed
- button "Accept"
- button "Reject"
- paragraph: Improve clarity.
- text: +1 lines -1 lines - Existing architecture summary. + Rewritten architecture summary.
- button "Review history 1 closed changes"
- button "Generate"
- button "Refine"
- button "Expand"
- button "Structure"
- text: Using context Overview Project brief Using latest analysis 42 files TypeScript / React, FastAPI
- link "AI Context":
  - /url: /projects/10/source
- textbox "Message Mark... (type @ to reference)"
- button "Attach resource"
- button "Chat"
- text: OpenAI / gpt-4.1-mini
- button "Send message" [disabled]
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | import { createMockState, installMockApi } from './fixtures/mockApi';
  3   | 
  4   | async function openEditor(page: import('@playwright/test').Page) {
  5   |   await installMockApi(page, createMockState('provider'));
  6   |   await page.goto('/projects/10/documents/10');
  7   |   await expect(page.getByLabel('Document title')).toHaveValue('Lifecycle Guide');
  8   |   await expect(page.getByTestId('editor-section-301')).toContainText('Existing architecture summary');
  9   | }
  10  | 
  11  | async function sendAiPrompt(page: import('@playwright/test').Page, prompt: string) {
  12  |   const input = page.locator('[data-ai-input="true"]');
  13  |   await input.fill(prompt);
  14  |   await input.press('Enter');
  15  | }
  16  | 
  17  | test('accepting proposed rewrite and add-section changes refreshes editor sections', async ({ page }) => {
  18  |   await openEditor(page);
  19  |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  20  |   await expect(page.getByText('Open review')).toBeVisible();
  21  | 
  22  |   await page.getByTestId('ai-proposed-change-501').getByRole('button', { name: 'Accept' }).click();
  23  |   await expect(page.getByTestId('editor-section-301')).toContainText('Rewritten architecture summary');
  24  | 
  25  |   await page.getByTestId('ai-proposed-change-502').getByRole('button', { name: 'Accept' }).click();
  26  |   await expect(page.getByLabel('Heading for Operations')).toHaveValue('Operations');
  27  | });
  28  | 
  29  | test('reject and undo update panel state without keeping content mutations', async ({ page }) => {
  30  |   await openEditor(page);
  31  |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  32  |   await expect(page.getByText('Open review')).toBeVisible();
  33  | 
  34  |   await page.getByTestId('ai-proposed-change-502').getByRole('button', { name: 'Reject' }).click();
> 35  |   await expect(page.getByText('add section · rejected')).toBeVisible();
      |                                                          ^ Error: expect(locator).toBeVisible() failed
  36  |   await expect(page.getByTestId('editor-section-302')).toContainText('Architecture');
  37  |   await expect(page.getByTestId('editor-section-952')).toHaveCount(0);
  38  | 
  39  |   await page.getByTestId('ai-proposed-change-501').getByRole('button', { name: 'Accept' }).click();
  40  |   await expect(page.getByTestId('editor-section-301')).toContainText('Rewritten architecture summary');
  41  |   await page.getByTestId('ai-proposed-change-501').getByRole('button', { name: 'Undo' }).click();
  42  |   await expect(page.getByText('rewrite selection · undone')).toBeVisible();
  43  |   await expect(page.getByTestId('editor-section-301')).toContainText('Existing architecture summary');
  44  | });
  45  | 
  46  | test('chat action creates a reviewable add-section card', async ({ page }) => {
  47  |   await openEditor(page);
  48  |   await page.getByTestId('editor-section-301').locator('.tiptap').click();
  49  |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  50  | 
  51  |   await sendAiPrompt(page, 'Add a section from the latest analysis');
  52  |   await expect(page.getByTestId('ai-turn-assistant-work_run')).toContainText('Queued a new section for review.');
  53  |   const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  54  |   const card = assistantTurn.getByTestId('ai-proposed-change-600');
  55  |   await expect(card).toContainText('Add AI-created section');
  56  |   await card.getByRole('button', { name: 'Accept' }).click();
  57  |   await expect(page.getByLabel('Heading for AI Created Section')).toHaveValue('AI Created Section');
  58  | });
  59  | 
  60  | test('chat answer renders user and assistant bubbles', async ({ page }) => {
  61  |   await openEditor(page);
  62  |   await page.getByTestId('editor-section-301').locator('.tiptap p').first().click();
  63  |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  64  | 
  65  |   await sendAiPrompt(page, 'What does this section explain?');
  66  |   const transcript = page.getByTestId('ai-panel-transcript');
  67  |   await expect(transcript).toContainText('What does this section explain?');
  68  |   await expect(transcript).toContainText('Mock answer from editor action endpoint.');
  69  |   await expect(page.getByTestId('ai-turn-assistant-message')).toContainText('Mock answer from editor action endpoint.');
  70  | });
  71  | 
  72  | test('chat insert renders a proposed change card and mutates active editor on accept', async ({ page }) => {
  73  |   await openEditor(page);
  74  |   await page.getByTestId('editor-section-301').locator('.tiptap p').first().click();
  75  |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  76  | 
  77  |   await sendAiPrompt(page, 'Insert a lifecycle note at the cursor');
  78  |   const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  79  |   const card = assistantTurn.getByTestId('ai-proposed-change-600');
  80  |   await expect(card).toContainText('Insert lifecycle note');
  81  |   await card.getByRole('button', { name: 'Accept' }).click();
  82  |   await expect(page.getByTestId('editor-section-301')).toContainText('Inserted lifecycle note from AI.');
  83  | });
  84  | 
  85  | test('chat replace renders a proposed change card and uses preserved editor selection', async ({ page }) => {
  86  |   await openEditor(page);
  87  |   await page.getByTestId('editor-section-301').locator('.tiptap p').first().selectText();
  88  |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  89  | 
  90  |   await sendAiPrompt(page, 'Replace the selected overview text');
  91  |   const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  92  |   const card = assistantTurn.getByTestId('ai-proposed-change-600');
  93  |   await expect(card).toContainText('Replace selected lifecycle text');
  94  |   await card.getByRole('button', { name: 'Accept' }).click();
  95  |   await expect(page.getByTestId('editor-section-301')).toContainText('Replacement lifecycle text from AI.');
  96  | });
  97  | 
  98  | test('collapsed selections show a visible replace failure instead of reusing stale ranges', async ({ page }) => {
  99  |   await openEditor(page);
  100 |   await page.getByTestId('editor-section-301').locator('.tiptap p').first().selectText();
  101 |   await page.getByTestId('editor-section-302').locator('.tiptap p').first().click();
  102 |   await page.getByRole('button', { name: 'Open AI assistant' }).click();
  103 | 
  104 |   await sendAiPrompt(page, 'Replace the selected overview text');
  105 |   await expect(page.getByTestId('ai-panel-transcript')).toContainText('requires selection metadata');
  106 |   await expect(page.getByTestId('editor-section-301')).toContainText('Existing architecture summary.');
  107 |   await expect(page.getByTestId('editor-section-301')).not.toContainText('Replacement lifecycle text from AI.');
  108 | });
  109 | 
  110 | test('slash insert command auto-submits and creates a proposed change card', async ({ page }) => {
  111 |   await openEditor(page);
  112 |   await page.getByTestId('editor-section-301').locator('[contenteditable="true"]').first().click();
  113 |   await page.keyboard.press('End');
  114 |   await page.keyboard.press('Enter');
  115 |   await page.keyboard.type('/insert');
  116 |   await page.getByRole('button', { name: /Insert with AI/ }).click();
  117 | 
  118 |   const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  119 |   const card = assistantTurn.getByTestId('ai-proposed-change-600');
  120 |   await expect(card).toContainText('Insert lifecycle note');
  121 |   await card.getByRole('button', { name: 'Accept' }).click();
  122 |   await expect(page.getByTestId('editor-section-301')).toContainText('Inserted lifecycle note from AI.');
  123 | });
  124 | 
  125 | test('selection polish command auto-submits and preserves the selected range', async ({ page }) => {
  126 |   await openEditor(page);
  127 |   const paragraph = page.getByTestId('editor-section-301').locator('.tiptap p').first();
  128 |   const box = await paragraph.boundingBox();
  129 |   if (!box) throw new Error('Expected overview paragraph to be visible');
  130 |   await page.mouse.move(box.x + 4, box.y + box.height / 2);
  131 |   await page.mouse.down();
  132 |   await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 8 });
  133 |   await page.mouse.up();
  134 |   await page.getByRole('button', { name: 'Polish selection' }).click();
  135 | 
```