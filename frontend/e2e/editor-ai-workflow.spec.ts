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
  await expect(page.getByText('Pending changes')).toBeVisible();
  await page.getByRole('button', { name: /Pending changes/ }).click();

  await page.getByTestId('ai-proposed-change-501').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Rewritten architecture summary');

  await page.getByTestId('ai-proposed-change-502').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByLabel('Heading for Operations')).toHaveValue('Operations');
});

test('reject and undo update panel state without keeping content mutations', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await page.getByRole('button', { name: /Pending changes/ }).click();

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
  await expect(page.getByText('Queued a new section for review.')).toBeVisible();
  const card = page.getByTestId('ai-proposed-change-600');
  await expect(card).toContainText('Add AI-created section');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByLabel('Heading for AI Created Section')).toHaveValue('AI Created Section');
});

test('chat insert renders an inline action card and mutates active editor on accept', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('.tiptap p').first().click();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  await sendAiPrompt(page, 'Insert a lifecycle note at the cursor');
  const card = page.getByTestId('ai-local-action-insert_at_cursor');
  await expect(card).toContainText('Insert lifecycle note');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Inserted lifecycle note from AI.');
});

test('chat replace renders an inline action card and uses preserved editor selection', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('.tiptap p').first().selectText();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  await sendAiPrompt(page, 'Replace the selected overview text');
  const card = page.getByTestId('ai-local-action-replace_selection');
  await expect(card).toContainText('Replace selected lifecycle text');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Replacement lifecycle text from AI.');
});
