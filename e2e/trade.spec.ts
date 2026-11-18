import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('Trade is a top-level nav item and /trade renders', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Trade' })
    .click();

  await expect(page).toHaveURL(/\/trade$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Trade' })).toBeVisible();
  await expect(page.getByTestId('trade-caveat')).toContainText(
    'Trade value — not spending and not profit',
  );
});

test('mocked API renders ABS flow, financial year, commodity and provenance', async ({ page }) => {
  await page.goto('/trade');

  await expect(page.getByTestId('trade-caveat')).toContainText('non-additive');
  await expect(page.getByTestId('trade-caveat')).toContainText('border cost');
  await expect(page.getByTestId('trade-source')).toContainText(
    'ABS International Trade (Data API Beta)',
  );
  await expect(page.getByTestId('trade-table')).toBeVisible();
  await expect(page.getByTestId('trade-row')).toHaveCount(20);
  await expect(page.getByText('Coal, coke and briquettes').first()).toBeVisible();
  await expect(page.getByText('2024-25').first()).toBeVisible();
  await expect(page.getByTestId('trade-quality').first()).toHaveText('Observed — verified');
  await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();
  await expect(page.getByRole('link', { name: 'ABS Data API' }).first()).toHaveAttribute(
    'href',
    /data\.api\.abs\.gov\.au/,
  );
});

test('trade never presents a spending total and pages large results', async ({ page }) => {
  await page.goto('/trade');

  await expect(page.getByText('no combined total')).toBeVisible();
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
  await expect(page.getByText(/total spending/i)).toHaveCount(0);

  await page.getByTestId('trade-pagination').getByText('2', { exact: true }).click();

  await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();
  await expect(page.getByTestId('trade-row')).toHaveCount(5);
});

test('flow filter switches to imports', async ({ page }) => {
  await page.goto('/trade');

  await page.getByLabel('Flow').click();
  await page.getByRole('option', { name: 'Imports' }).click();

  await expect(page.getByText('Import trade value (ABS)')).toBeVisible();
  await expect(page.getByTestId('trade-row').first()).toContainText('Import');
});

test('empty trade result shows the explicit empty state', async ({ page }) => {
  await mockApi(page, { tradeEmpty: true });
  await page.goto('/trade');

  await expect(page.getByTestId('empty-state')).toContainText(
    'No trade observations match these filters',
  );
  await expect(page.getByTestId('trade-table')).toHaveCount(0);
});

test('trade API failure shows the visible error state', async ({ page }) => {
  await mockApi(page, { tradeError: true });
  await page.goto('/trade');

  await expect(page.getByTestId('api-error')).toContainText('Trade API unavailable');
  await expect(page.getByTestId('trade-table')).toHaveCount(0);
});
