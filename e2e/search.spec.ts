import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('spending explorer shows mixed warning and per-type totals, never a headline', async ({
  page,
}) => {
  await page.goto('/search');

  await expect(page.getByRole('heading', { level: 1, name: 'Spending explorer' })).toBeVisible();
  await expect(page.getByTestId('mixed-warning')).toContainText('Measure types are mixed');
  await expect(page.getByTestId('mixed-warning')).toContainText('no headline total');
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
  await expect(page.getByTestId('spending-per-type-totals')).toContainText('Actual');
  await expect(page.getByTestId('spending-per-type-totals')).toContainText('Budget');
  await expect(page.getByTestId('spending-per-type-totals')).toContainText('Estimate');
  await expect(page.getByTestId('spending-by-function')).toContainText('Health');
  await expect(page.getByTestId('spending-by-region')).toContainText('New South Wales');
  await expect(page.getByTestId('spending-rows')).toBeVisible();
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});

test('a single measure-type filter shows the headline total', async ({ page }) => {
  await page.goto('/search?measure_type=actual&fiscal_year=2024-25');

  await expect(page.getByTestId('mixed-warning')).toHaveCount(0);
  await expect(page.getByTestId('headline-total')).toBeVisible();
  await expect(page.getByTestId('headline-total-amount')).toContainText('4,900,000,000');
  await expect(page.getByTestId('spending-per-type-totals')).toContainText('Actual');
  await expect(page.getByTestId('applied-filters')).toContainText('Measure type: Actual');
  await expect(page.getByTestId('applied-filters')).toContainText('Fiscal year: 2024-25');
});

test('filter changes update the URL and reload restores the state', async ({ page }) => {
  await page.goto('/search');

  await page.getByRole('combobox', { name: 'Function' }).click();
  await page.getByRole('option', { name: '07 — Health' }).click();

  await expect(page).toHaveURL(/function=07/);
  await expect(page.getByTestId('applied-filters')).toContainText('Function: 07 — Health');

  await page.reload();

  await expect(page.getByTestId('applied-filters')).toContainText('Function: 07 — Health');
  await expect(page).toHaveURL(/function=07/);
});

test('pagination moves to page 2 and preserves filters', async ({ page }) => {
  await page.goto('/search?function=07');

  await expect(page.getByTestId('pagination')).toContainText('Page 1 of 2');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page).toHaveURL(/function=07/);
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByTestId('pagination')).toContainText('Page 2 of 2');
  await expect(page.getByTestId('applied-filters')).toContainText('Function: 07 — Health');
  await expect(page.getByTestId('spending-rows')).toBeVisible();
});

test('row provenance is visible on every row', async ({ page }) => {
  await page.goto('/search?measure_type=actual&fiscal_year=2024-25');

  const rows = page.getByTestId('spending-rows');
  await expect(rows).toContainText('synthetic-seed');
  await expect(rows).toContainText('Unverified');
  await expect(rows.getByRole('link', { name: 'synthetic-seed' }).first()).toBeVisible();
});

test('jump-to name search applies a function filter', async ({ page }) => {
  await page.goto('/search');

  const jump = page.getByTestId('jump-search');
  await jump.getByLabel('Find a function or region').fill('health');
  await expect(jump.getByTestId('quick-function-result').first()).toBeVisible();
  await jump
    .getByTestId('quick-function-result')
    .filter({ hasText: '07 — Health' })
    .first()
    .click();

  await expect(page).toHaveURL(/function=07/);
  await expect(page.getByTestId('applied-filters')).toContainText('Function: 07 — Health');
});
