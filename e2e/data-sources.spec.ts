import { expect, test } from '@playwright/test';
import { mockApi } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('data sources shows the synthetic source, Unverified badge and anchor target', async ({
  page,
}) => {
  await page.goto('/data-sources#synthetic-seed');

  await expect(page).toHaveURL(/#synthetic-seed$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Data sources' })).toBeVisible();

  const anchor = page.locator('#synthetic-seed');
  await expect(anchor).toBeVisible();
  await expect(anchor).toBeInViewport();
  await expect(anchor).toContainText('Synthetic development seed');
  await expect(anchor).toContainText('source_id: synthetic-seed');
  await expect(anchor.getByText('Unverified', { exact: true }).first()).toBeVisible();
  await expect(anchor.getByRole('link', { name: '/data-sources#synthetic-seed' })).toBeVisible();
  await expect(page.getByText('Provenance:').first()).toBeVisible();
});

test('degraded SOC source shows a stale warning and still displays its preserved rows', async ({
  page,
}) => {
  await page.goto('/data-sources#waternsw');

  const card = page.getByTestId('source-waternsw');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('ingestion-status-waternsw')).toContainText('degraded');
  await expect(card.getByTestId('ingestion-status-waternsw')).toContainText('47 record(s)');
  await expect(card.getByTestId('ingestion-status-waternsw')).toContainText(
    'fetch strategy parliament_fallback',
  );

  const stale = card.getByTestId('stale-waternsw');
  await expect(stale).toBeVisible();
  await expect(stale).toContainText('Stale data');
  await expect(stale).toContainText('47 existing record(s) are preserved');
  await expect(stale).toContainText('parliament_fallback');
});

test('data sources lists live connectors, open stubs and coverage limitations', async ({
  page,
}) => {
  await page.goto('/data-sources');

  const stubs = page.getByTestId('connector-stubs');
  await expect(stubs).toBeVisible();
  await expect(stubs.getByText('stub — not wired')).toHaveCount(5);
  await expect(stubs.getByText('active', { exact: true })).toHaveCount(9);
  await expect(stubs).toContainText('Australian Government Budget Portal');
  await expect(stubs).toContainText('Western Australian Budget');
  await expect(stubs).toContainText('NSW Budget 2025-26 Open Data');
  await expect(stubs).toContainText('data.nsw.gov.au CKAN');
  await expect(stubs).toContainText('Dubbo Regional Council');
  await expect(stubs).toContainText('grantconnect');
  await expect(stubs.getByText('degraded', { exact: true })).toHaveCount(1);
  await expect(page.getByText('GrantConnect').first()).toBeVisible();
  await expect(page.getByText(/manual export|50,000-result cap/i).first()).toBeVisible();

  const grantconnect = page.getByTestId('source-grantconnect');
  await expect(grantconnect).toBeVisible();
  await expect(grantconnect).toContainText('manual export');
  await expect(grantconnect.getByTestId('grantconnect-manual-caveat')).toContainText(
    'not an API and not a live scraper',
  );
  await expect(
    grantconnect.getByRole('link', { name: /Browse ingested grant awards/ }),
  ).toBeVisible();

  await expect(page.getByTestId('coverage-limitations')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'coverage limitations page' })).toHaveAttribute(
    'href',
    '/coverage-limitations',
  );

  const qgipCaveat = page.getByTestId('qgip-coverage-caveat');
  await expect(qgipCaveat).toBeVisible();
  await expect(qgipCaveat).toContainText(
    'QLD QGIP grant/contract payment-level rows cover 2018-19 through 2024-25',
  );
  await expect(qgipCaveat).toContainText(
    '2019-20 is partial because the publisher left annual expenditure blank on most rows',
  );
  await expect(qgipCaveat).toContainText('QGIP grants and contracts are never summed');
  await expect(qgipCaveat).toContainText('provisional and unverified');
});

test('data sources shows targeted CKAN provenance and deferred PDF/DOCX resources', async ({
  page,
}) => {
  await page.goto('/data-sources');

  const ckan = page.getByTestId('source-data-nsw-ckan');
  await expect(ckan).toBeVisible();
  await expect(ckan).toContainText('data.nsw.gov.au CKAN');
  await expect(ckan).toContainText('3 record(s)');
  await expect(
    ckan.getByRole('link', { name: /Browse targeted data.nsw.gov.au CKAN state rows/ }),
  ).toBeVisible();

  const deferred = page.getByTestId('deferred-data-nsw-ckan');
  await expect(deferred).toBeVisible();
  await expect(deferred).toContainText('Deferred resources — recorded, not ingested');
  await expect(deferred).toContainText('PDF');
  await expect(deferred).toContainText('DOC');
  await expect(deferred).toContainText('Fleet Vehicle expenditure data FY18-19.pdf');
  await expect(deferred).toContainText('202407-202506-q4-expenditure-by-agency.docx');
});

test('data sources surfaces PBS provenance and the line-item caveat', async ({ page }) => {
  await page.goto('/data-sources');

  const pbs = page.getByTestId('source-data-gov-au-pbs');
  await expect(pbs).toBeVisible();
  await expect(pbs).toContainText('Portfolio Budget Statements');
  await expect(pbs).toContainText('12 record(s)');
  await expect(pbs).toContainText('last ingested');
  await expect(
    pbs.getByRole('link', { name: /Browse ingested PBS budget line items/ }),
  ).toBeVisible();

  const caveat = page.getByTestId('pbs-caveat');
  await expect(caveat).toBeVisible();
  await expect(caveat).toContainText('does not equal the Budget Paper 1 total');
});
