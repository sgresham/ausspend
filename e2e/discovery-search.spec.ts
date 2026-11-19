import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

const HOME_LABEL = 'Search functions, regions, sources and State-owned entities';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('home makes the bounded search the first interaction and documents Phase 2', async ({
  page,
}) => {
  await page.goto('/');

  const search = page.getByTestId('home-autocomplete');
  await expect(search).toBeVisible();
  await expect(search.getByLabel(HOME_LABEL)).toBeVisible();
  await expect(page.getByTestId('home-search')).toContainText('bounded discovery index');
  await expect(page.getByTestId('home-search')).toContainText(
    'full 515k-row measure set is Phase 2',
  );
  await expect(search.getByLabel(HOME_LABEL)).toHaveAttribute('aria-expanded', 'false');
});

test('typo and partial queries match functions, regions and state-owned entities', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByTestId('home-autocomplete').getByLabel(HOME_LABEL);

  await input.fill('waternsw');
  const waternsw = page.getByTestId('quick-soc-result').filter({ hasText: 'WaterNSW' }).first();
  await expect(waternsw).toBeVisible();
  await expect(waternsw).toHaveAttribute('href', '/soc?entity=WaterNSW');

  await input.fill('sydny water');
  const sydneyWater = page
    .getByTestId('quick-soc-result')
    .filter({ hasText: 'Sydney Water' })
    .first();
  await expect(sydneyWater).toBeVisible();
  await expect(sydneyWater).toHaveAttribute('href', '/soc?entity=Sydney%20Water');

  await input.fill('dubbo');
  const dubbo = page.getByTestId('quick-region-result').filter({ hasText: 'Dubbo' }).first();
  await expect(dubbo).toBeVisible();
  await expect(dubbo).toHaveAttribute('href', '/regions/dubbo');

  await input.fill('hunter wter');
  const hunter = page.getByTestId('quick-soc-result').filter({ hasText: 'Hunter Water' }).first();
  await expect(hunter).toBeVisible();

  await input.fill('health');
  const health = page
    .getByTestId('quick-function-result')
    .filter({ hasText: '07 — Health' })
    .first();
  await expect(health).toBeVisible();
  await expect(health).toHaveAttribute('href', '/functions/07');
});

test('combobox exposes ARIA state and keyboard selection navigates', async ({ page }) => {
  await page.goto('/');
  const input = page.getByTestId('home-autocomplete').getByLabel(HOME_LABEL);

  await input.fill('dubb');
  const listbox = page.getByTestId('home-autocomplete-results');
  await expect(listbox).toBeVisible();
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  await expect(input).toHaveAttribute('aria-controls', /.+/);

  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', /.+/);
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
  await input.press('Enter');

  await expect(page).toHaveURL(/\/regions\/dubbo$/);
});

test('submitting the box without an active option opens the existing explorer', async ({
  page,
}) => {
  await page.goto('/');
  const input = page.getByTestId('home-autocomplete').getByLabel(HOME_LABEL);

  await input.fill('health');
  await input.press('Enter');

  await expect(page).toHaveURL(/\/search\?q=health$/);
  await expect(page.getByTestId('applied-filters')).toContainText('Project or item: “health”');
});

test('explorer no-result shows a did-you-mean suggestion instead of a dead end', async ({
  page,
}) => {
  await page.goto('/search?q=healht');

  await expect(page.getByTestId('empty-state')).toBeVisible();
  const suggestion = page.getByTestId('no-result-suggestion');
  await expect(suggestion).toContainText('Did you mean');
  await expect(suggestion.getByRole('link')).toHaveAttribute('href', '/functions/07');
  await expect(suggestion.getByRole('link')).toHaveText('07 — Health');
});

test('header search keeps discovery access and SOC links deep-link the entity page', async ({
  page,
}) => {
  await page.goto('/functions');
  const header = page.getByTestId('header-quick-search');
  await expect(header).toBeVisible();

  const input = header.getByRole('combobox', { name: 'Search' });
  await input.fill('waternsw');
  const soc = header.getByTestId('quick-soc-result').filter({ hasText: 'WaterNSW' }).first();
  await expect(soc).toBeVisible();
  await soc.click();

  await expect(page).toHaveURL(/\/soc\?entity=WaterNSW$/);
  await expect(page.getByRole('heading', { level: 1, name: 'State-owned entities' })).toBeVisible();
});

test('discovery search is GET-only and does not write', async ({ page }) => {
  const methods: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) methods.push(request.method());
  });

  await page.goto('/');
  const input = page.getByTestId('home-autocomplete').getByLabel(HOME_LABEL);
  await input.fill('waternsw');
  await expect(page.getByTestId('quick-soc-result').first()).toBeVisible();

  expect(methods.length).toBeGreaterThan(0);
  expect(methods.every((method) => method === 'GET')).toBe(true);
});

test('mobile layout keeps the prominent search and navigation access', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByTestId('home-autocomplete')).toBeVisible();
  await expect(page.getByTestId('header-quick-search')).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('link', { name: 'Search' })).toBeVisible();
});
