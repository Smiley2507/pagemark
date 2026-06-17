import { expect, test } from '@playwright/test';
import { createMockState, installMockApi } from './fixtures/mockApi';

test('export modal hydrates print profile controls and PDF preview request params', async ({ page }) => {
  const state = createMockState('provider');
  await installMockApi(page, state);

  await page.goto('/projects/10/documents/10');
  await page.getByRole('button', { name: /Export/ }).click();

  await expect(page.getByTestId('export-modal')).toBeVisible();
  await expect(page.getByLabel('Paper size')).toHaveValue('letter');
  await expect(page.getByLabel('Page margins')).toHaveValue('wide');
  await expect(page.getByLabel('Logo placement')).toHaveValue('header-left');
  await expect(page.getByLabel('Left header')).toHaveValue('Pagemark');
  await expect(page.getByLabel('Center footer')).toHaveValue('Confidential');
  await expect(page.getByLabel('Page numbers')).toBeChecked();
  await expect(page.getByLabel('Cover')).toBeChecked();
  await expect(page.getByLabel('TOC')).toBeChecked();
  await expect(page.getByLabel('H1 underline')).not.toBeChecked();

  await expect.poll(() => state.lastExportUrl?.searchParams.get('include_page_numbers')).toBe('true');
  expect(state.lastExportUrl?.searchParams.has('page_numbers')).toBe(false);

  const pdfFrame = page.frameLocator('iframe[title="Paged PDF preview"]');
  await expect(pdfFrame.locator('body')).toBeAttached();
  const iframe = page.locator('iframe[title="Paged PDF preview"]');
  await expect(iframe).toHaveAttribute('src', /^blob:/);
});

test('HTML preview uses srcDoc iframe behavior', async ({ page }) => {
  await installMockApi(page, createMockState('provider'));

  await page.goto('/projects/10/documents/10');
  await page.getByRole('button', { name: /Export/ }).click();
  await page.getByRole('radio', { name: 'HTML' }).click();

  const iframe = page.locator('iframe[title="HTML export preview"]');
  await expect(iframe).toBeVisible();
  await expect(iframe).not.toHaveAttribute('src', /^blob:/);
  await expect(page.frameLocator('iframe[title="HTML export preview"]').getByText('Mock HTML Preview')).toBeVisible();
});

test('export modal layout can be screenshotted at desktop and mobile widths', async ({ page }) => {
  await installMockApi(page, createMockState('provider'));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/projects/10/documents/10');
  await page.getByRole('button', { name: /Export/ }).click();
  await expect(page.getByTestId('export-modal')).toBeVisible();
  const desktop = await page.getByTestId('export-modal').screenshot();
  expect(desktop.byteLength).toBeGreaterThan(20_000);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('export-modal')).toBeVisible();
  const mobile = await page.getByTestId('export-modal').screenshot();
  expect(mobile.byteLength).toBeGreaterThan(15_000);

  const controls = await page.getByTestId('export-controls').boundingBox();
  const preview = await page.getByTestId('export-preview').boundingBox();
  expect(controls?.width ?? 0).toBeGreaterThan(0);
  expect(preview?.width ?? 0).toBeGreaterThan(0);
});
