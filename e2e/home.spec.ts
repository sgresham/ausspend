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
    'Phase 1 synthetic seed data only',
  );
  await expect(page.getByTestId('coverage-banner')).toContainText('unverified');
  await expect(page.getByText('Provenance:').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Data sources' }).first()).toBeVisible();

  // A small honest overview, not a national headline total.
  await expect(page.getByRole('heading', { name: 'COFOG divisions in this build' })).toBeVisible();
  await expect(page.getByRole('link', { name: '07 — Health' })).toBeVisible();
  await expect(page.getByText('Unverified').first()).toBeVisible();
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
});
