import { expect, test } from '@playwright/test';
import { MOCK_IDS, mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('search renders function results with links and provenance', async ({ page }) => {
  await page.goto('/search?q=health');

  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
  const health = page.getByRole('link', { name: '07 — Health' });
  await expect(health).toBeVisible();
  await expect(health).toHaveAttribute('href', '/functions/07');
  await expect(page.getByTestId('search-functions')).toContainText('Health');
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});

test('search renders region results linking by region _id', async ({ page }) => {
  await page.goto('/search?q=NSW');

  const nsw = page.getByRole('link', { name: 'NSW — New South Wales' });
  await expect(nsw).toBeVisible();
  await expect(nsw).toHaveAttribute('href', `/regions/${MOCK_IDS.NSW}`);
});

test('search shows a no-results state rather than inventing data', async ({ page }) => {
  await page.goto('/search?q=zzz');

  await expect(page.getByTestId('empty-state')).toContainText('No results for “zzz”');
});
