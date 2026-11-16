import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('about page explains Phase 1 scope, provenance and mixed measures', async ({ page }) => {
  await page.goto('/about');

  await expect(page.getByRole('heading', { level: 1, name: 'About ausspend' })).toBeVisible();
  await expect(page.getByTestId('about-page')).toContainText('Phase 1 scope');
  await expect(page.getByTestId('about-unverified')).toContainText('unverified');
  await expect(page.getByTestId('about-page')).toContainText('How mixed measures are handled');
  await expect(page.getByTestId('about-page')).toContainText('no headline total');
  await expect(page.getByTestId('coverage-banner')).toBeVisible();
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});
