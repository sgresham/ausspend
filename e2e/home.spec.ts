import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('home renders the shell, coverage banner and provenance', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'ausspend' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByTestId('coverage-banner')).toContainText(
    'Phase 1 + F2/F3 (AusTender + PBS live).',
  );
  await expect(page.getByTestId('coverage-banner')).toContainText(
    'Live AusTender contract records and PBS budget line items',
  );
  await expect(page.getByTestId('coverage-banner')).toContainText('human-verified');
  await expect(page.getByText('Provenance:').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Data sources' }).first()).toBeVisible();

  // A small honest overview, not a national headline total.
  await expect(page.getByRole('heading', { name: 'COFOG divisions in this build' })).toBeVisible();
  await expect(page.getByRole('link', { name: '07 — Health' })).toBeVisible();
  await expect(page.getByText('Unverified').first()).toBeVisible();
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
  await expect(page.getByTestId('coverage-limitations')).toContainText('Mixed data');
  await expect(page.getByTestId('connector-status')).toContainText('stub — not wired');
});

test('home autocomplete links regions by _id/state and functions by code', async ({ page }) => {
  await page.goto('/');

  const search = page.getByTestId('home-autocomplete');
  await search.getByLabel('Search regions and functions').fill('New');

  const nsw = search
    .getByTestId('quick-region-result')
    .filter({ hasText: 'NSW — New South Wales' })
    .first();
  await expect(nsw).toBeVisible();
  await expect(nsw).toHaveAttribute('href', '/states/NSW');

  await search.getByLabel('Search regions and functions').fill('health');

  const health = search
    .getByTestId('quick-function-result')
    .filter({ hasText: '07 — Health' })
    .first();
  await expect(health).toBeVisible();
  await expect(health).toHaveAttribute('href', '/functions/07');
});
