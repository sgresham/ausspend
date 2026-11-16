import { expect, test } from '@playwright/test';

test('home page renders the ausspend shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'ausspend' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByText('Provenance:')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Data sources' })).toBeVisible();
});
