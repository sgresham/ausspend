import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('functions index lists all ten divisions with links and provenance', async ({ page }) => {
  await page.goto('/functions');

  await expect(page.getByRole('heading', { level: 1, name: 'Functions (COFOG)' })).toBeVisible();
  await expect(page.getByTestId('functions-index')).toBeVisible();
  await expect(page.getByRole('link', { name: '07 — Health' })).toBeVisible();
  await expect(page.getByTestId('functions-index').getByRole('link')).toHaveCount(20);
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});

test('mixed function view shows the warning and no headline total', async ({ page }) => {
  await page.goto('/functions/07');

  await expect(page.getByRole('heading', { level: 1, name: 'Health (07)' })).toBeVisible();
  await expect(page.getByTestId('mixed-warning')).toContainText('Measure types are mixed');
  await expect(page.getByTestId('mixed-warning')).toContainText('no headline total');
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
  await expect(page.getByTestId('measure-type-chart')).toBeVisible();
  await expect(page.getByTestId('view-filters')).toContainText('fiscal year all');
  await expect(page.getByTestId('view-filters')).toContainText('measure type all');
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});

test('single-type function view shows the headline total and ranked states', async ({ page }) => {
  await page.goto('/functions/07?measure_type=actual&fiscal_year=2024-25');

  await expect(page.getByTestId('headline-total')).toBeVisible();
  await expect(page.getByTestId('headline-total-amount')).toContainText('3,200,000,000');
  await expect(page.getByTestId('ranked-states-table')).toBeVisible();
  await expect(page.getByTestId('ranked-states-table')).toContainText('New South Wales');
  await expect(page.getByTestId('view-filters')).toContainText('2024-25');
  await expect(page.getByTestId('view-filters')).toContainText('actual');
});

test('changing the measure-type filter updates the URL and removes the mixed warning', async ({
  page,
}) => {
  await page.goto('/functions/07');
  await expect(page.getByTestId('mixed-warning')).toBeVisible();

  await page.getByRole('combobox', { name: 'Measure type' }).click();
  await page.getByRole('option', { name: 'Actual' }).click();

  await expect(page).toHaveURL(/measure_type=actual/);
  await expect(page.getByTestId('headline-total')).toBeVisible();
  await expect(page.getByTestId('mixed-warning')).toHaveCount(0);
});

test('unknown function code renders a visible not-found state', async ({ page }) => {
  await page.goto('/functions/99');

  await expect(page.getByTestId('api-error')).toContainText('Not found');
  await expect(page.getByTestId('api-error')).toContainText('Unknown function code: 99');
});
