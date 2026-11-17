import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('site-wide footer notice links to the full /legal page', async ({ page }) => {
  for (const path of ['/', '/about', '/data-sources']) {
    await page.goto(path);
    const footer = page.getByTestId('site-footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('not legal or financial advice');
    await expect(footer).toContainText('not an official government publication');
    await expect(
      footer.getByRole('link', { name: 'Legal, privacy and data notices' }),
    ).toHaveAttribute('href', '/legal');
  }

  await page.goto('/');
  await page
    .getByTestId('site-footer')
    .getByRole('link', { name: 'Legal, privacy and data notices' })
    .click();
  await expect(page).toHaveURL(/\/legal$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Legal, privacy and data notices',
  );
});

test('/legal contains all five blocks and the required factual corrections', async ({ page }) => {
  await page.goto('/legal');

  await expect(page.getByTestId('legal-page')).toBeVisible();
  await expect(page.getByTestId('legal-not-advice')).toContainText(
    'general information, not legal advice',
  );
  await expect(page.getByTestId('legal-page')).toContainText(
    'not an official government publication',
  );

  for (const [testId, heading] of [
    ['legal-quick-notice', 'Quick notice'],
    ['legal-disclaimer', 'Full disclaimer'],
    ['legal-copyright', 'Copyright and attribution'],
    ['legal-data', 'About this data'],
    ['legal-privacy', 'Privacy'],
  ] as const) {
    await expect(page.getByTestId(testId)).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: heading })).toBeVisible();
  }

  // Disclaimer: general information only, no warranty, independent project.
  await expect(page.getByTestId('legal-disclaimer')).toContainText(
    'not legal, financial, tax or other professional advice',
  );
  await expect(page.getByTestId('legal-disclaimer')).toContainText('does not create or audit');

  // Copyright: not all CC BY, publisher terms, Dubbo public-interest, CC BY example retained.
  const copyright = page.getByTestId('legal-copyright');
  await expect(copyright).toContainText('Not all sources are CC BY');
  await expect(copyright).toContainText('public-interest use');
  await expect(copyright).toContainText('Dubbo Regional Council');
  await expect(copyright).toContainText('© State of New South Wales');
  await expect(copyright).toContainText('CC BY 3.0 AU');

  // Data explainer: derived totals labelled, measure_type/provenance per record, double count.
  const dataBlock = page.getByTestId('legal-data');
  await expect(dataBlock).toContainText('does not create or audit source data');
  await expect(dataBlock).toContainText('derived or normalised');
  await expect(dataBlock).toContainText('documented and labelled');
  await expect(dataBlock).toContainText('measure_type');
  await expect(dataBlock).toContainText('double count');
  await expect(dataBlock).toContainText('provenance');

  // Privacy: Privacy Act/APP statement, no analytics, placeholder contact clearly marked.
  const privacy = page.getByTestId('legal-privacy');
  await expect(privacy).toContainText('Privacy Act 1988');
  await expect(privacy).toContainText('Australian Privacy Principles');
  await expect(privacy).toContainText('privacy@ausspend.com.au');
  await expect(privacy).toContainText('does not add analytics');
  await expect(page.getByTestId('legal-privacy-contact-unconfirmed')).toContainText(
    'Contact to be confirmed',
  );
  await expect(page.getByTestId('legal-privacy-contact-unconfirmed')).toContainText(
    'not a confirmed working mailbox',
  );

  // The data block links to the source register and that link works.
  await dataBlock.getByRole('link', { name: 'Data sources and provenance' }).click();
  await expect(page).toHaveURL(/\/data-sources$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Data sources' })).toBeVisible();
});

test('/legal and the footer make no write requests to the API', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET' && url.pathname.startsWith('/api/')) {
      writes.push(`${request.method()} ${url.pathname}`);
    }
  });

  await page.goto('/legal');
  await expect(page.getByTestId('legal-page')).toBeVisible();
  for (const id of [
    'legal-quick-notice',
    'legal-disclaimer',
    'legal-copyright',
    'legal-data',
    'legal-privacy',
  ]) {
    await page.getByTestId(id).scrollIntoViewIfNeeded();
  }

  expect(writes).toEqual([]);
});

test('footer and /legal are accessible landmarks and fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/legal');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Legal and site links' })).toBeVisible();

  for (const name of [
    'Quick notice',
    'Full disclaimer',
    'Copyright and attribution',
    'About this data',
    'Privacy',
  ]) {
    await expect(page.getByRole('region', { name })).toBeVisible();
  }

  // No horizontal overflow at a narrow phone width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('contentinfo').getByRole('link', { name: 'Legal, privacy and data notices' }),
  ).toBeVisible();
});
