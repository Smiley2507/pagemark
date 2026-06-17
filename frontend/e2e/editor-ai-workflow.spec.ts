import { expect, test } from '@playwright/test';
import { createMockState, installMockApi } from './fixtures/mockApi';

async function openEditor(page: import('@playwright/test').Page) {
  await installMockApi(page, createMockState('provider'));
  await page.goto('/projects/10/documents/10');
  await expect(page.getByLabel('Document title')).toHaveValue('Lifecycle Guide');
  await expect(page.getByTestId('editor-section-301')).toContainText('Existing architecture summary');
}

function chatMessage(page: import('@playwright/test').Page) {
  return page.locator('.prose').getByText('AI generated paragraph for lifecycle checks.', { exact: true }).last();
}

test('accepting proposed rewrite and add-section changes refreshes editor sections', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await expect(page.getByText('AI Proposed Changes')).toBeVisible();

  await page.getByTestId('ai-proposed-change-501').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('Rewritten architecture summary');

  await page.getByTestId('ai-proposed-change-502').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByLabel('Heading for Operations')).toHaveValue('Operations');
});

test('reject and undo update panel state without keeping content mutations', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

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

test('chat actions queue reviewable rewrite and append changes', async ({ page }) => {
  await openEditor(page);
  await page.getByTestId('editor-section-301').locator('.tiptap').click();
  await page.getByRole('button', { name: 'Open AI assistant' }).click();

  const aiMessage = chatMessage(page);
  await aiMessage.hover();
  await page.getByRole('button', { name: 'Rewrite' }).click();
  await expect(page.getByText('Rewrite active section')).toBeVisible();
  await page.getByTestId('ai-chat-proposal').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Chat proposed rewrite')).toBeVisible();

  await chatMessage(page).hover();
  await page.getByRole('button', { name: 'Append' }).click();
  await expect(page.getByText('Append to active section')).toBeVisible();
  await page.getByTestId('ai-chat-proposal').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Chat proposed append')).toBeVisible();
});

test('chat insert mutates active editor content explicitly', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'Open AI assistant' }).click();
  await page.getByTestId('editor-section-301').locator('.tiptap p').first().click();

  const aiMessage = chatMessage(page);
  await aiMessage.hover();
  await page.getByRole('button', { name: 'Insert' }).click();
  await expect(page.getByText('Insert at cursor')).toBeVisible();
  await page.getByTestId('ai-chat-proposal').getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByTestId('editor-section-301')).toContainText('AI generated paragraph for lifecycle checks.');
});
