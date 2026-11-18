import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('home renders the shell and provenance', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('AusSpend — Australian government spending');
  await expect(page.getByRole('heading', { level: 1, name: 'AusSpend' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByText('AusSpend'),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByText('Provenance:').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Data sources' }).first()).toBeVisible();

  // A small honest overview, not a national headline total.
  await expect(page.getByRole('heading', { name: 'COFOG divisions in this build' })).toBeVisible();
  await expect(page.getByRole('link', { name: '07 — Health' })).toBeVisible();
  await expect(page.getByText('Unverified').first()).toBeVisible();
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
  await expect(page.getByTestId('coverage-limitations')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'coverage limitations page' })).toHaveAttribute(
    'href',
    '/coverage-limitations',
  );
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Coverage limitations' }),
  ).toBeVisible();
  await expect(page.getByTestId('connector-status')).toContainText('stub — not wired');
});

test('home autocomplete links regions by _id/state and functions by code', async ({ page }) => {
  await page.goto('/');

  const search = page.getByTestId('home-autocomplete');
  await search.getByLabel('Search functions, regions, sources and NSW SOC entities').fill('New');

  const nsw = search
    .getByTestId('quick-region-result')
    .filter({ hasText: 'NSW — New South Wales' })
    .first();
  await expect(nsw).toBeVisible();
  await expect(nsw).toHaveAttribute('href', '/states/NSW');

  await search.getByLabel('Search functions, regions, sources and NSW SOC entities').fill('health');

  const health = search
    .getByTestId('quick-function-result')
    .filter({ hasText: '07 — Health' })
    .first();
  await expect(health).toBeVisible();
  await expect(health).toHaveAttribute('href', '/functions/07');
});
