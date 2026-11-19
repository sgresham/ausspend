import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('WaterNSW note breakdown is grouped, expandable and never totalled', async ({ page }) => {
  await page.goto('/soc');

  await expect(page.getByRole('heading', { level: 1, name: 'State-owned entities' })).toBeVisible();
  await expect(page.getByTestId('soc-caveat')).toContainText(
    'never add this to government program spending',
  );

  const series = page.getByTestId('soc-series');
  await expect(series).toBeVisible();
  await expect(page.getByText('WaterNSW: 5 rows')).toBeVisible();

  // Every printed note is its own expandable group with an explicit "no total" badge.
  const groups = page.getByTestId('soc-group');
  await expect(groups).toHaveCount(5);
  await expect(page.getByText('Note 2 Revenue from water supply and delivery')).toBeVisible();
  await expect(page.getByText('Note 5 Employee related expenses')).toBeVisible();
  await expect(page.getByText('Note 6 Other operating expenses')).toBeVisible();
  await expect(page.getByText('Statement of cash flows — investing activities')).toBeVisible();
  await expect(page.getByTestId('soc-group-no-total')).toHaveCount(5);

  // The note row shows its component-of relationship, and a printed deduction keeps its sign.
  await expect(
    page.getByText('component of revenue_from_water_supply_and_delivery').first(),
  ).toBeVisible();
  const deduction = page.getByRole('row').filter({ hasText: 'employee_expenses_capitalisation' });
  await expect(deduction).toContainText('printed deduction');
  await expect(deduction).toContainText('−');
});
