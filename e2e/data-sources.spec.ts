import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('data sources shows the synthetic source, Unverified badge and anchor target', async ({
  page,
}) => {
  await page.goto('/data-sources#synthetic-seed');

  await expect(page).toHaveURL(/#synthetic-seed$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Data sources' })).toBeVisible();

  const anchor = page.locator('#synthetic-seed');
  await expect(anchor).toBeVisible();
  await expect(anchor).toBeInViewport();
  await expect(anchor).toContainText('Synthetic development seed');
  await expect(anchor).toContainText('source_id: synthetic-seed');
  await expect(anchor.getByText('Unverified', { exact: true }).first()).toBeVisible();
  await expect(anchor.getByRole('link', { name: '/data-sources#synthetic-seed' })).toBeVisible();
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});
