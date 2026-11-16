import { expect, test } from '@playwright/test';

const ROUTES: Array<{ path: string; heading: string; extra?: string }> = [
  { path: '/', heading: 'ausspend' },
  { path: '/search', heading: 'Search' },
  { path: '/functions', heading: 'Functions (COFOG)' },
  { path: '/functions/07', heading: 'Functions (COFOG)', extra: 'COFOG division 07' },
  { path: '/regions', heading: 'Regions' },
  { path: '/regions/nsw', heading: 'Regions', extra: 'region nsw' },
  { path: '/states', heading: 'States and territories' },
  { path: '/states/NSW', heading: 'States and territories', extra: 'state/territory NSW' },
  { path: '/data-sources', heading: 'Data sources' },
];

for (const route of ROUTES) {
  test(`renders placeholder for ${route.path}`, async ({ page }) => {
    await page.goto(route.path);

    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    await expect(page.getByText('Provenance:')).toBeVisible();
    if (route.extra) {
      await expect(page.getByText(route.extra)).toBeVisible();
    }
  });
}
