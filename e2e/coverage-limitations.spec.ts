import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('nav link opens the dedicated coverage limitations page with the full list', async ({
  page,
}) => {
  await page.goto('/');

  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Coverage limitations' })
    .click();

  await expect(page).toHaveURL(/\/coverage-limitations$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Coverage limitations' })).toBeVisible();

  const limitations = page.getByTestId('coverage-limitations');
  await expect(limitations).toBeVisible();
  await expect(limitations).toContainText('Mixed data');
  await expect(limitations).toContainText(
    'AusTender OCDS contractPublished ingestion and data.gov.au PBS program-expense ingestion are live',
  );
  await expect(limitations).toContainText('GrantConnect');
  await expect(limitations.getByText('Provenance:')).toBeVisible();
});

test('Home and Data Sources link to the list once instead of duplicating it', async ({ page }) => {
  for (const path of ['/', '/data-sources']) {
    await page.goto(path);
    await expect(page.getByTestId('coverage-limitations')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'coverage limitations page' })).toHaveAttribute(
      'href',
      '/coverage-limitations',
    );
  }

  await page.goto('/coverage-limitations');
  await expect(page.getByTestId('coverage-limitations')).toHaveCount(1);
});
