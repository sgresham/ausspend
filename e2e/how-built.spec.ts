import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('how it was built page states the human/AI process, source and licence', async ({ page }) => {
  await page.goto('/how-it-was-built');

  await expect(page.getByTestId('how-built-page')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'How it was built' })).toBeVisible();

  const process = page.getByTestId('how-built-human-direction');
  await expect(process).toContainText('A human sets the direction');
  await expect(process).toContainText('AI orchestrator');
  await expect(process).toContainText('git ancestry');
  await expect(process).toContainText('not a claim of full autonomy');

  const github = page.getByRole('link', { name: 'sgresham/ausspend' });
  await expect(github).toHaveAttribute('href', 'https://github.com/sgresham/ausspend');
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('rel', /noopener/);

  const licence = page.getByRole('link', { name: 'LICENSE file' });
  await expect(licence).toHaveAttribute(
    'href',
    'https://github.com/sgresham/ausspend/blob/main/LICENSE',
  );
  await expect(page.getByTestId('how-built-licence')).toContainText('MIT');
  await expect(page.getByTestId('how-built-licence')).toContainText('not relicensed');

  const attributions = page.getByTestId('how-built-attributions');
  await expect(attributions).toContainText('AusTender');
  await expect(attributions).toContainText('Australian Bureau of Statistics');
  await expect(attributions).toContainText('Dubbo Regional Council');
  await expect(attributions).toContainText('not an official government publication');

  // The page is not a tenth top-nav item.
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'How it was built' }),
  ).toHaveCount(0);
});

test('footer and about page link to the how-it-was-built page', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('site-footer').getByRole('link', { name: 'How it was built' }).click();
  await expect(page).toHaveURL(/\/how-it-was-built$/);
  await expect(page.getByRole('heading', { level: 1, name: 'How it was built' })).toBeVisible();

  await page.goto('/about');
  const about = page.getByTestId('about-how-built');
  await expect(about).toBeVisible();
  await about.getByRole('link', { name: 'How it was built' }).click();
  await expect(page).toHaveURL(/\/how-it-was-built$/);
});
