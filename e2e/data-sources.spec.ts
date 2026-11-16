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

test('data sources lists the eight connector stubs and coverage limitations', async ({ page }) => {
  await page.goto('/data-sources');

  const stubs = page.getByTestId('connector-stubs');
  await expect(stubs).toBeVisible();
  await expect(stubs.getByText('stub — not wired')).toHaveCount(8);
  await expect(stubs).toContainText('Australian Government Budget Portal');
  await expect(stubs).toContainText('Western Australian Budget');

  await expect(page.getByTestId('coverage-limitations')).toContainText(
    'No live ingestion: all eight connectors are stubs',
  );
  await expect(page.getByTestId('coverage-limitations')).toContainText('never calls them');
});
