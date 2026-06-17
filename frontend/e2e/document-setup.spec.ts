import { expect, test } from '@playwright/test';
import { createMockState, installMockApi } from './fixtures/mockApi';

test('source-less setup reaches the nested editor route through rule-based recommendations', async ({ page }) => {
  await installMockApi(page, createMockState('no-provider'));

  await page.goto('/document-setup');
  await expect(page.getByRole('heading', { name: 'Connect the codebase' })).toBeVisible();
  await page.getByLabel('Project name').fill('Pagemark API');
  await page.getByLabel('Project context / description (optional)').fill('Lifecycle documentation workspace');
  await page.getByRole('button', { name: 'Start without source' }).first().click();
  await page.getByRole('button', { name: 'Start without source' }).last().click();
  await expect(page).toHaveURL(/projectId=10&documentId=10/);

  await expect(page.getByRole('heading', { name: 'Choose structure' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rule-based recommendations' })).toBeVisible();
  await expect(page.getByText('No provider usage')).toBeVisible();
  await page.getByRole('button', { name: /Technical Overview/ }).first().click();

  await expect(page.getByRole('heading', { name: 'Review the Outline' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve Outline' }).click();
  await expect(page.getByRole('heading', { name: 'Choose how to enter the Document' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter editor now' }).click();

  await expect(page).toHaveURL(/\/projects\/10\/documents\/10$/);
  await expect(page.getByLabel('Document title')).toHaveValue('Pagemark API overview');
});

test('source-backed setup shows completed analysis and AI-personalized recommendations', async ({ page }) => {
  await installMockApi(page, createMockState('provider'));

  await page.goto('/document-setup');
  await page.getByLabel('Project name').fill('Pagemark API');
  await page.getByRole('button', { name: /acme\/pagemark/ }).click();
  await page.getByRole('button', { name: 'Connect GitHub repository' }).click();

  await expect(page.getByRole('heading', { name: 'Analysis facts' })).toBeVisible();
  await expect(page.getByText('Primary languages: TypeScript.')).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();

  await expect(page.getByRole('heading', { name: 'Choose structure' })).toBeVisible();
  await expect(page.getByText('AI-personalized recommendation')).toBeVisible();
  await expect(page.getByText('Personalized from repository facts')).toBeVisible();
  await page.getByRole('button', { name: /Technical Overview/ }).first().click();
  await page.getByRole('button', { name: 'Approve Outline' }).click();
  await page.getByRole('button', { name: 'Start generation and enter editor' }).click();
  await expect(page).toHaveURL(/\/projects\/10\/documents\/10$/);
});

test('resume setup restores template, outline, and generation stages', async ({ page }) => {
  await installMockApi(page, createMockState('template-resume'));
  await page.goto('/document-setup?projectId=10&documentId=10');
  await expect(page.getByRole('heading', { name: 'Choose structure' })).toBeVisible();

  await installMockApi(page, createMockState('outline-resume'));
  await page.goto('/document-setup?projectId=10&documentId=10');
  await expect(page.getByRole('heading', { name: 'Review the Outline' })).toBeVisible();

  await installMockApi(page, createMockState('generation-resume'));
  await page.goto('/document-setup?projectId=10&documentId=10');
  await expect(page.getByRole('heading', { name: 'Choose how to enter the Document' })).toBeVisible();
});

test('provider state controls recommendation affordances', async ({ page }) => {
  await installMockApi(page, createMockState('source-no-provider'));
  await page.goto('/document-setup?projectId=10&documentId=10');
  await expect(page.getByText('No provider usage')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configure provider for AI recommendation' })).toBeVisible();

  await installMockApi(page, createMockState('provider'));
  await page.goto('/document-setup?projectId=10&documentId=10');
  await expect(page.getByText('Provider-consuming action')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI-personalized recommendation' })).toBeVisible();
});
