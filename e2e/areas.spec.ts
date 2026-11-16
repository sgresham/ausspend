import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('the Dubbo area page shows four panels, the caution and not-covered list', async ({
  page,
}) => {
  await page.goto('/areas/dubbo');

  await expect(page.getByRole('heading', { level: 1, name: 'Dubbo (NSW-DUBBO)' })).toBeVisible();
  await expect(page.getByTestId('area-profile')).toBeVisible();
  await expect(page.getByTestId('area-panel-local')).toContainText('Dubbo Regional Council');
  await expect(page.getByTestId('area-panel-state')).toContainText('NSW-wide');
  await expect(page.getByTestId('area-panel-federal')).toContainText('NSW-tagged');
  await expect(page.getByTestId('area-panel-pbs')).toContainText('Commonwealth-wide');
  await expect(page.getByTestId('area-caution')).toContainText('NOT additive');
  await expect(page.getByTestId('area-not-covered')).toContainText('Bathurst Regional Council');
  await expect(page.getByTestId('area-not-covered')).toContainText('VIC — not covered');
  // No cross-level/type headline total is rendered.
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
  await expect(page.getByTestId('region-measure-rows')).toBeVisible();
});

test('/regions/dubbo and /region/dubbo render the same area profile', async ({ page }) => {
  for (const path of ['/regions/dubbo', '/region/dubbo']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Dubbo (NSW-DUBBO)' })).toBeVisible();
    await expect(page.getByTestId('area-profile')).toBeVisible();
    await expect(page.getByTestId('area-panel-local')).toBeVisible();
  }
});

test('spending search ?area=dubbo uses the area profile instead of a headline total', async ({
  page,
}) => {
  await page.goto('/search?area=dubbo');

  await expect(page.getByTestId('area-profile')).toBeVisible();
  await expect(page.getByTestId('area-caution')).toContainText('NOT additive');
  await expect(page.getByTestId('headline-total')).toHaveCount(0);
  await expect(page.getByTestId('area-panel-federal')).toContainText('NSW-tagged');
});

test('data sources names dubbo-council and links to the area page', async ({ page }) => {
  await page.goto('/data-sources');

  const card = page.getByTestId('source-dubbo-council');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Dubbo Regional Council');
  await expect(card.getByRole('link', { name: /Open the Dubbo area profile/ })).toHaveAttribute(
    'href',
    '/areas/dubbo',
  );
});
