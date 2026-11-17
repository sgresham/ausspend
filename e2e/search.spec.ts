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
  await expect(page.getByTestId('mixed-warning')).toContainText('Mixed populations');
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

  await page
    .getByTestId('spending-filters')
    .getByRole('combobox', { name: 'Function' })
    .click();
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

test('PBS budget rows carry provenance and the line-item caveat', async ({ page }) => {
  await page.goto('/search?measure_type=budget&jurisdiction_level=federal');

  await expect(page.getByTestId('pbs-caveat')).toBeVisible();
  await expect(page.getByTestId('pbs-caveat')).toContainText(
    'does not equal the Budget Paper 1 total',
  );
  await expect(page.getByTestId('applied-filters')).toContainText('Measure type: Budget');
  await expect(page.getByTestId('applied-filters')).toContainText('Jurisdiction: Federal');

  const rows = page.getByTestId('spending-rows');
  await expect(rows).toContainText('data-gov-au-pbs');
  await expect(rows).toContainText('Unverified');
  await expect(rows.getByRole('link', { name: 'data-gov-au-pbs' }).first()).toBeVisible();
  await expect(rows).toContainText('Program 1.1: Health policy');
});

test('grant award filter states that GrantConnect is a manual, partial export', async ({
  page,
}) => {
  await page.goto('/search?measure_type=grant_award&jurisdiction_level=federal');

  const note = page.getByTestId('grantconnect-partial');
  await expect(note).toBeVisible();
  await expect(note).toContainText('GrantConnect is a manual export');
  await expect(note).toContainText('not an API and not a live scraper');
  await expect(note).toContainText('50,000-result cap');
  await expect(note).toContainText('No grant row is estimated or zero-filled');
});

test('NSW state budget rows are shown and labelled Budgeted', async ({ page }) => {
  await page.goto('/search?jurisdiction_level=state&measure_type=budget');

  await expect(page.getByTestId('nsw-budgeted-note')).toContainText('NSW state rows are Budgeted');
  const rows = page.getByTestId('spending-rows');
  await expect(rows).toContainText('Chichester Trunk Gravity Main');
  await expect(rows).toContainText('Budgeted');
  await expect(rows).not.toContainText('No COFOG function');
});

test('a direct project/item q URL shows the New Dubbo Bridge row with a clearable chip', async ({
  page,
}) => {
  await page.goto('/search?q=New%20Dubbo%20Bridge');

  const rows = page.getByTestId('spending-rows');
  await expect(rows).toContainText('New Dubbo Bridge');
  await expect(rows).toContainText('nsw-budget');
  await expect(rows).not.toContainText('Chichester Trunk Gravity Main');

  const applied = page.getByTestId('applied-filters');
  await expect(applied).toContainText('Project or item: “New Dubbo Bridge”');
  await expect(page.getByLabel('Project or item')).toHaveValue('New Dubbo Bridge');
});

test('a word-order variant of the project/item q URL still shows the bridge row', async ({
  page,
}) => {
  await page.goto('/search?q=dubbo%20new%20bridge');

  const rows = page.getByTestId('spending-rows');
  await expect(rows).toContainText('New Dubbo Bridge');
  await expect(rows).toContainText('nsw-budget');
  await expect(rows).not.toContainText('Chichester Trunk Gravity Main');

  const applied = page.getByTestId('applied-filters');
  await expect(applied).toContainText('Project or item: “dubbo new bridge”');
  await expect(page.getByLabel('Project or item')).toHaveValue('dubbo new bridge');
  await expect(page.getByText('every word', { exact: false })).toBeVisible();
});

test('the project/item input applies q and the chip clears it', async ({ page }) => {
  await page.goto('/search');

  const input = page.getByLabel('Project or item');
  await input.fill('New Dubbo Bridge');
  await input.press('Enter');

  await expect(page).toHaveURL(/q=New\+Dubbo\+Bridge/);
  await expect(page.getByTestId('applied-filters')).toContainText(
    'Project or item: “New Dubbo Bridge”',
  );
  await expect(page.getByTestId('spending-rows')).toContainText('New Dubbo Bridge');

  await page.getByTestId('applied-filters').locator('.MuiChip-deleteIcon').click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page.getByTestId('spending-rows')).not.toContainText('New Dubbo Bridge');
});
