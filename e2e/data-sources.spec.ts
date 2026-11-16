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

test('data sources lists live connectors, open stubs and coverage limitations', async ({
  page,
}) => {
  await page.goto('/data-sources');

  const stubs = page.getByTestId('connector-stubs');
  await expect(stubs).toBeVisible();
  await expect(stubs.getByText('stub — not wired')).toHaveCount(8);
  await expect(stubs.getByText('active', { exact: true })).toHaveCount(4);
  await expect(stubs).toContainText('Australian Government Budget Portal');
  await expect(stubs).toContainText('Western Australian Budget');
  await expect(stubs).toContainText('NSW Budget 2025-26 Open Data');
  await expect(stubs).toContainText('data.nsw.gov.au CKAN');
  await expect(stubs).toContainText('grantconnect');
  await expect(page.getByText('GrantConnect').first()).toBeVisible();
  await expect(page.getByText(/no public award API|blocked/i).first()).toBeVisible();

  await expect(page.getByTestId('coverage-limitations')).toContainText(
    'AusTender OCDS contractPublished ingestion and data.gov.au PBS program-expense ingestion are live',
  );
  await expect(page.getByTestId('coverage-limitations')).toContainText('GrantConnect');
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
