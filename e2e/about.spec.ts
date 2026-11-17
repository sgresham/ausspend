import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('about page explains Phase 1 scope, provenance and mixed measures', async ({ page }) => {
  await page.goto('/about');

  await expect(page.getByRole('heading', { level: 1, name: 'About AusSpend' })).toBeVisible();
  await expect(page.getByTestId('about-page')).toContainText('Phase 1 scope');
  await expect(page.getByTestId('about-unverified')).toContainText('unverified');
  await expect(page.getByTestId('about-unverified')).toContainText(
    'QLD QGIP grant/contract payment-level rows cover 2018-19 through 2024-25',
  );
  await expect(page.getByTestId('about-unverified')).toContainText(
    '2019-20 is partial because the publisher left annual expenditure blank on most rows',
  );
  await expect(page.getByTestId('about-unverified')).toContainText(
    'QGIP grants and contracts are never summed',
  );
  await expect(page.getByTestId('about-page')).toContainText('How mixed measures are handled');
  await expect(page.getByTestId('about-page')).toContainText('no headline total');
  await expect(page.getByTestId('coverage-banner')).toBeVisible();
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});

test('real-only about page states full QGIP coverage and the 2019-20 gap', async ({ page }) => {
  await mockApi(page, { empty: true });
  await page.goto('/about');

  const about = page.getByTestId('about-unverified');
  await expect(about).toContainText('No synthetic seed rows are present.');
  await expect(about).toContainText(
    'QLD QGIP grant/contract payment-level rows covering 2018-19 through 2024-25',
  );
  await expect(about).toContainText(
    '2019-20 QGIP is partial because the publisher left annual expenditure blank on most rows',
  );
  await expect(about).toContainText('QGIP grants and contracts are never summed');
  await expect(about).toContainText('provisional and unverified');
  await expect(about).not.toContainText('QLD QGIP 2024-25 grant/contract expenditure');
});
