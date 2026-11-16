import { expect, test } from '@playwright/test';
import { MOCK_IDS, mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('regions index lists the national row and states with links', async ({ page }) => {
  await page.goto('/regions');

  await expect(page.getByRole('heading', { level: 1, name: 'Regions' })).toBeVisible();
  await expect(page.getByTestId('regions-list')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'National' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'States and territories' })).toBeVisible();
  await expect(page.getByText('AUS — Australia')).toBeVisible();
  await expect(page.getByText('QLD — Queensland')).toBeVisible();

  const national = page.getByRole('link', { name: 'National region page' });
  await expect(national).toHaveAttribute('href', `/regions/${MOCK_IDS.AUS}`);

  const nswRow = page.getByRole('listitem').filter({ hasText: 'NSW — New South Wales' });
  await expect(nswRow.getByRole('link', { name: 'Open state page' })).toHaveAttribute(
    'href',
    '/states/NSW',
  );
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});

test('region detail renders live-shaped data with the mixed warning', async ({ page }) => {
  await page.goto(`/regions/${MOCK_IDS.AUS}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Australia (AUS)' })).toBeVisible();
  await expect(page.getByTestId('mixed-warning')).toBeVisible();
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
  await expect(page.getByTestId('by-function-table')).toContainText('Health');
  await expect(page.getByTestId('region-measure-rows')).toBeVisible();
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});

test('state detail renders the total, by-function table and provenance', async ({ page }) => {
  await page.goto('/states/NSW');

  await expect(
    page.getByRole('heading', { level: 1, name: 'New South Wales (NSW)' }),
  ).toBeVisible();
  await expect(page.getByTestId('headline-total')).toBeVisible();
  await expect(page.getByTestId('headline-total-amount')).toContainText('2,000,000,000');
  await expect(page.getByTestId('by-function-table')).toBeVisible();
  await expect(page.getByTestId('spending-bar-chart')).toBeVisible();
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});

test('unknown state code renders a visible not-found state', async ({ page }) => {
  await page.goto('/states/ZZZ');

  await expect(page.getByTestId('api-error')).toContainText('Not found');
  await expect(page.getByTestId('api-error')).toContainText('Unknown state/territory code: ZZZ');
});
