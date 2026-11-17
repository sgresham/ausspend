import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

/**
 * Readiness states for the synthetic-seed removal: with the seed retired and no
 * matching real rows, the UI must say "no real data for this dimension yet"
 * instead of showing a zero, a placeholder or a synthetic value.
 */
test.beforeEach(async ({ page }) => {
  await mockApi(page, { empty: true });
});

test('function view with no real rows shows the explicit empty state', async ({ page }) => {
  await page.goto('/functions/07');

  await expect(page.getByRole('heading', { level: 1, name: 'Health (07)' })).toBeVisible();
  await expect(page.getByTestId('empty-state')).toContainText(
    'No real data for this dimension yet',
  );
  await expect(page.getByTestId('empty-state')).toContainText('Nothing is estimated');
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
});

test('state view with no real rows shows the explicit empty state', async ({ page }) => {
  await page.goto('/states/NSW');

  await expect(
    page.getByRole('heading', { level: 1, name: 'New South Wales (NSW)' }),
  ).toBeVisible();
  await expect(page.getByTestId('empty-state')).toContainText(
    'No real data for this dimension yet',
  );
  await expect(page.getByTestId('empty-state')).toContainText('no real feed covers this region');
});

test('search with no real rows shows the explicit empty state', async ({ page }) => {
  await page.goto('/search');

  await expect(page.getByTestId('empty-state')).toContainText(
    'No real data for this dimension yet',
  );
  await expect(page.getByTestId('empty-state')).toContainText('Nothing is estimated');
});

test('coverage banner reports that no synthetic rows are present', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('coverage-banner')).toContainText(
    'No synthetic seed rows are present.',
  );
  await expect(page.getByTestId('coverage-banner')).toContainText('0 synthetic seed rows');
  await expect(page.getByTestId('coverage-banner')).toContainText('QLD QGIP 2018-19..2024-25');
  await expect(page.getByTestId('coverage-banner')).toContainText('2019-20 partial');
  await expect(page.getByTestId('coverage-banner')).toContainText(
    'QGIP grants and contracts are never summed',
  );
  await expect(page.getByTestId('coverage-banner')).not.toContainText(
    'next to the synthetic development seed',
  );
});

test('source register omits the synthetic source when it is retired', async ({ page }) => {
  await page.goto('/data-sources');

  await expect(page.getByTestId('source-aus-tender')).toBeVisible();
  await expect(page.getByTestId('source-synthetic-seed')).toHaveCount(0);
});
