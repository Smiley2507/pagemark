import { expect, test } from '@playwright/test';
import { createMockState, installMockApi } from './fixtures/mockApi';

test('project workspace tabs and document library navigate to nested editor route', async ({ page }) => {
  await installMockApi(page, createMockState('provider'));

  await page.goto('/projects/10');
  await expect(page.getByRole('heading', { name: 'Pagemark API' })).toBeVisible();
  const workspaceNav = page.getByRole('navigation', { name: 'Project workspace navigation' });
  await expect(workspaceNav).toBeVisible();
  await expect(workspaceNav.getByRole('link', { name: /Documents/ })).toHaveAttribute('href', /\/projects\/10$/);
  await expect(workspaceNav.getByRole('link', { name: /Source/ })).toHaveAttribute('href', /\/projects\/10\/source$/);
  await expect(workspaceNav.getByRole('link', { name: /Activity/ })).toHaveAttribute('href', /\/projects\/10\/activity$/);
  await expect(workspaceNav.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', /\/projects\/10\/settings$/);

  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await expect(page.getByTestId('document-row-10')).toContainText('Lifecycle Guide');
  await page.getByTestId('document-row-10').getByRole('button', { name: /Lifecycle Guide/ }).click();

  await expect(page).toHaveURL(/\/projects\/10\/documents\/10$/);
  await expect(page.getByLabel('Document title')).toHaveValue('Lifecycle Guide');
});
