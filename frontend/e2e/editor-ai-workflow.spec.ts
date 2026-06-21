import { expect, test } from '@playwright/test';
import { createMockState, installMockApi } from './fixtures/mockApi';

async function openEditor(page: import('@playwright/test').Page) {
  await installMockApi(page, createMockState('provider'));
  await page.goto('/projects/10/documents/10');
  await expect(page.getByLabel('Document title')).toHaveValue('Lifecycle Guide');
  await expect(page.getByTestId('editor-section-301')).toContainText('Existing architecture summary');
}

async function sendAiPrompt(page: import('@playwright/test').Page, prompt: string) {
  const input = page.locator('[data-ai-input="true"]');
  await input.fill(prompt);
  await input.press('Enter');
}

test('accepting proposed rewrite and add-section changes refreshes editor sections', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await expect(page.getByText('Open review')).toBeVisible();

  await page.getByTestId('ai-proposed-change-501').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Rewritten architecture summary');

  await page.getByTestId('ai-proposed-change-502').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByLabel('Heading for Operations')).toHaveValue('Operations');
});

test('reject and undo update panel state without keeping content mutations', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await expect(page.getByText('Open review')).toBeVisible();

  await page.getByTestId('ai-proposed-change-502').getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText('add section · rejected')).toBeVisible();
  await expect(page.getByTestId('editor-section-302')).toContainText('Architecture');
  await expect(page.getByTestId('editor-section-952')).toHaveCount(0);

  await page.getByTestId('ai-proposed-change-501').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Rewritten architecture summary');
  await page.getByTestId('ai-proposed-change-501').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('rewrite selection · undone')).toBeVisible();
  await expect(page.getByTestId('editor-section-301')).toContainText('Existing architecture summary');
});

test('chat action creates a reviewable add-section card', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('.tiptap').click();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  await sendAiPrompt(page, 'Add a section from the latest analysis');
  await expect(page.getByTestId('ai-turn-assistant-work_run')).toContainText('Queued a new section for review.');
  const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  const card = assistantTurn.getByTestId('ai-proposed-change-600');
  await expect(card).toContainText('Add AI-created section');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByLabel('Heading for AI Created Section')).toHaveValue('AI Created Section');
});

test('chat answer renders user and assistant bubbles', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('.tiptap p').first().click();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  await sendAiPrompt(page, 'What does this section explain?');
  const transcript = page.getByTestId('ai-panel-transcript');
  await expect(transcript).toContainText('What does this section explain?');
  await expect(transcript).toContainText('Mock answer from editor action endpoint.');
  await expect(page.getByTestId('ai-turn-assistant-message')).toContainText('Mock answer from editor action endpoint.');
});

test('chat insert renders a proposed change card and mutates active editor on accept', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('.tiptap p').first().click();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  await sendAiPrompt(page, 'Insert a lifecycle note at the cursor');
  const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  const card = assistantTurn.getByTestId('ai-proposed-change-600');
  await expect(card).toContainText('Insert lifecycle note');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Inserted lifecycle note from AI.');
});

test('chat replace renders a proposed change card and uses preserved editor selection', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('.tiptap p').first().selectText();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  await sendAiPrompt(page, 'Replace the selected overview text');
  const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  const card = assistantTurn.getByTestId('ai-proposed-change-600');
  await expect(card).toContainText('Replace selected lifecycle text');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Replacement lifecycle text from AI.');
});

test('collapsed selections show a visible replace failure instead of reusing stale ranges', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('.tiptap p').first().selectText();
  await page.getByTestId('editor-section-302').locator('.tiptap p').first().click();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  await sendAiPrompt(page, 'Replace the selected overview text');
  await expect(page.getByTestId('ai-panel-transcript')).toContainText('requires selection metadata');
  await expect(page.getByTestId('editor-section-301')).toContainText('Existing architecture summary.');
  await expect(page.getByTestId('editor-section-301')).not.toContainText('Replacement lifecycle text from AI.');
});

test('slash insert command auto-submits and creates a proposed change card', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('[contenteditable="true"]').first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/insert');
  await page.getByRole('button', { name: /Insert with AI/ }).click();

  const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  const card = assistantTurn.getByTestId('ai-proposed-change-600');
  await expect(card).toContainText('Insert lifecycle note');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Inserted lifecycle note from AI.');
});

test('selection polish command auto-submits and preserves the selected range', async ({ page }) => {
  await openEditor(page);
  const paragraph = page.getByTestId('editor-section-301').locator('.tiptap p').first();
  const box = await paragraph.boundingBox();
  if (!box) throw new Error('Expected overview paragraph to be visible');
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Polish selection' }).click();

  const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  const card = assistantTurn.getByTestId('ai-proposed-change-600');
  await expect(card).toContainText('Replace selected lifecycle text');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Replacement lifecycle text from AI.');
});

test('right-click polish command auto-submits a replace-selection action card', async ({ page }) => {
  await openEditor(page);
  const paragraph = page.getByTestId('editor-section-301').locator('.tiptap p').first();
  await paragraph.selectText();
  const box = await paragraph.boundingBox();
  if (!box) throw new Error('Expected overview paragraph to be visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await expect(page.getByText('Polish phrasing')).toBeVisible();
  await page.getByText('Polish phrasing').click();

  const assistantTurn = page.getByTestId('ai-turn-assistant-work_run');
  const card = assistantTurn.getByTestId('ai-proposed-change-600');
  await expect(card).toContainText('Replace selected lifecycle text');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Replacement lifecycle text from AI.');
});

test('structural suggestions queue rename and add-with-content cards with undo', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('.tiptap').click();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await page.getByRole('button', { name: 'Structure' }).click();
  await expect(page.getByText('Suggested changes')).toBeVisible();
  await page.getByRole('button', { name: 'Apply all' }).click();

  await expect(page.getByText('Open review')).toBeVisible();
  const renameCard = page.getByTestId('ai-proposed-change-600');
  const addCard = page.getByTestId('ai-proposed-change-601');
  await expect(renameCard).toContainText('Rename section to "System Architecture"');
  await expect(addCard).toContainText('Add section "Operational Playbook"');

  await renameCard.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByLabel('Heading for System Architecture')).toHaveValue('System Architecture');
  await addCard.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByLabel('Heading for Operational Playbook')).toHaveValue('Operational Playbook');
  await expect(page.getByTestId('editor-section-952')).toContainText('Operational playbook body from source analysis.');

  await renameCard.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Heading for Architecture')).toHaveValue('Architecture');
  await expect(page.getByTestId('editor-section-952')).toHaveCount(0);
});
