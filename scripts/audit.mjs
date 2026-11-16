#!/usr/bin/env node
/**
 * Live provenance audit for an already-running ausspend stack.
 *
 * It never writes to the database and never reseeds. Point it at the dev compose
 * stack (defaults) or at a local `npm run dev` stack:
 *
 *   npm run audit
 *   AUDIT_WEB_URL=http://localhost:5173 AUDIT_API_URL=http://localhost:3001 npm run audit
 *
 * It checks every route for uncaught page errors, the mixed-measure rule, row and
 * summary provenance, the synthetic source register, and the API invariants the
 * UI relies on. Any failure or pageError exits nonzero.
 */
import { chromium } from '@playwright/test';

const WEB_URL = (process.env.AUDIT_WEB_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const API_URL = (process.env.AUDIT_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

/** Every source id the live UI may legitimately render in a provenance cell. */
const KNOWN_SOURCE_IDS = [
  'synthetic-seed',
  'aus-tender',
  'data-gov-au-pbs',
  'nsw-budget',
  'data-nsw-ckan',
  'dubbo-council',
];

const results = [];

function pass(name, detail = '') {
  results.push({ status: 'PASS', name });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, error) {
  const message = error instanceof Error ? error.message : String(error);
  results.push({ status: 'FAIL', name, message });
  console.log(`FAIL  ${name} — ${message}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    pass(name, detail ?? '');
  } catch (error) {
    fail(name, error);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return { status: response.status, body, text };
}

async function apiChecks() {
  await check('API health reports ok and a connected database', async () => {
    const { status, body } = await getJson('/api/health');
    assert(status === 200, `expected 200, got ${status}`);
    assert(body?.ok === true, `expected ok:true, got ${JSON.stringify(body)}`);
    assert(body?.db === 'connected', `expected db:connected, got ${JSON.stringify(body?.db)}`);
    return 'db=connected';
  });

  let regionId;
  await check('API regions list exposes a real region _id', async () => {
    const { status, body } = await getJson('/api/regions?limit=200');
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(body?.regions) && body.regions.length > 0, 'no regions returned');
    regionId = body.regions[0]._id;
    assert(/^[a-f0-9]{24}$/i.test(regionId), `region _id is not a 24-char hex id: ${regionId}`);
    return `${body.regions.length} regions, first _id=${regionId}`;
  });

  await check('API data-sources returns the unverified synthetic source', async () => {
    const { status, body } = await getJson('/api/data-sources');
    assert(status === 200, `expected 200, got ${status}`);
    const source = body?.sources?.find((entry) => entry.source_id === 'synthetic-seed');
    assert(source, 'synthetic-seed source missing');
    assert(source.verified === false, 'synthetic-seed must be unverified');
    assert(
      source.source_url === '/data-sources#synthetic-seed',
      `unexpected source_url ${source.source_url}`,
    );
    return 'source_id=synthetic-seed verified=false';
  });

  await check('API spending?function=07 is mixed with null total and per-type totals', async () => {
    const { status, body } = await getJson('/api/spending?function=07');
    assert(status === 200, `expected 200, got ${status}`);
    const summary = body?.summary;
    assert(summary?.mixed === true, `expected mixed:true, got ${summary?.mixed}`);
    assert(summary?.total_cents === null, `expected total_cents:null, got ${summary?.total_cents}`);
    assert(
      Array.isArray(summary?.total_by_measure_type) && summary.total_by_measure_type.length === 3,
      `expected 3 per-type totals, got ${JSON.stringify(summary?.total_by_measure_type)}`,
    );
    for (const entry of summary.total_by_measure_type) {
      assert(
        Number.isInteger(entry.total_cents),
        `per-type total is not an integer: ${JSON.stringify(entry)}`,
      );
    }
    for (const row of body.data) {
      assert(row.provenance?.source_id, `row ${row.id} has no provenance.source_id`);
      assert(row.provenance?.source_url, `row ${row.id} has no provenance.source_url`);
      assert(typeof row.provenance?.verified === 'boolean', `row ${row.id} verification missing`);
    }
    return `mixed=true total=null types=${summary.total_by_measure_type.length}`;
  });

  await check('API spending?function=07&measure_type=actual has a numeric total', async () => {
    const { status, body } = await getJson('/api/spending?function=07&measure_type=actual');
    assert(status === 200, `expected 200, got ${status}`);
    const summary = body?.summary;
    assert(summary?.mixed === false, `expected mixed:false, got ${summary?.mixed}`);
    assert(
      Number.isInteger(summary?.total_cents),
      `expected numeric total_cents, got ${summary?.total_cents}`,
    );
    assert(
      summary?.total_measure_type === 'actual',
      `expected total_measure_type:actual, got ${summary?.total_measure_type}`,
    );
    return `total_cents=${summary.total_cents}`;
  });

  await check('API spending resolves region=<name|slug> and rejects an unknown slug', async () => {
    // Contract C: a 24-character _id stays an exact filter, while a region
    // name/code/slug resolves case-insensitively. An unknown slug is a 404.
    const resolved = await getJson('/api/spending?region=NSW&page_size=1');
    assert(resolved.status === 200, `expected region=NSW to resolve (200), got ${resolved.status}`);
    assert(
      resolved.body?.applied_filters?.region === 'NSW',
      `expected applied_filters.region=NSW, got ${resolved.body?.applied_filters?.region}`,
    );

    const dubbo = await getJson('/api/spending?region=dubbo&page_size=1');
    assert(dubbo.status === 200, `expected region=dubbo to resolve (200), got ${dubbo.status}`);
    assert(
      Array.isArray(dubbo.body?.area_profile?.panels) &&
        dubbo.body.area_profile.panels.length === 4,
      `expected 4 Dubbo area panels, got ${dubbo.body?.area_profile?.panels?.length}`,
    );
    assert(
      dubbo.body?.summary?.total_cents === null,
      `expected no cross-level total for area mode, got ${dubbo.body?.summary?.total_cents}`,
    );

    const unknown = await getJson('/api/spending?region=not-a-region');
    assert(
      unknown.status === 404 || unknown.status === 400,
      `expected 404/400 for an unknown slug, got ${unknown.status}`,
    );
    assert(unknown.body?.ok === false, 'error envelope missing ok:false');
    return `region=NSW 200, region=dubbo 4 panels, unknown ${unknown.status}`;
  });

  await check('API spending/:id with an unknown measure id is 404', async () => {
    const { status, body } = await getJson('/api/spending/000000000000000000000000');
    assert(status === 404, `expected 404, got ${status}`);
    assert(body?.ok === false, 'error envelope missing ok:false');
    return body.error;
  });

  await check(
    'API meta/coverage reports AusTender and PBS live, GrantConnect pending',
    async () => {
      const { status, body } = await getJson('/api/meta/coverage');
      assert(status === 200, `expected 200, got ${status}`);
      assert(Array.isArray(body?.connectors), 'connectors must be an array');
      const statusCounts = body?.connector_status_counts;
      assert(statusCounts, 'missing connector_status_counts');
      const expectedConnectorTotal =
        statusCounts.active + statusCounts.degraded + statusCounts.stub;
      assert(
        body.connectors.length === expectedConnectorTotal,
        `connector count ${body.connectors.length} does not match status counts ${expectedConnectorTotal}`,
      );
      const connectorIds = body.connectors.map((connector) => connector.id);
      const ausTender = body.connectors.find((entry) => entry.id === 'aus-tender');
      assert(ausTender, 'missing federal connector aus-tender');
      assert(
        ausTender.status === 'active' || ausTender.status === 'degraded',
        `expected aus-tender active/degraded, got ${ausTender.status}`,
      );
      const pbs = body.connectors.find((entry) => entry.id === 'data-gov-au-pbs');
      assert(pbs, 'missing federal connector data-gov-au-pbs');
      assert(
        pbs.status === 'active' || pbs.status === 'degraded',
        `expected data-gov-au-pbs active/degraded, got ${pbs.status}`,
      );
      const nswBudget = body.connectors.find((entry) => entry.id === 'nsw-budget');
      assert(nswBudget, 'missing state connector nsw-budget');
      assert(
        nswBudget.status === 'active' || nswBudget.status === 'degraded',
        `expected nsw-budget active/degraded, got ${nswBudget.status}`,
      );
      const nswCkan = body.connectors.find((entry) => entry.id === 'data-nsw-ckan');
      assert(nswCkan, 'missing state connector data-nsw-ckan');
      assert(
        nswCkan.status === 'active' || nswCkan.status === 'degraded',
        `expected data-nsw-ckan active/degraded, got ${nswCkan.status}`,
      );
      const dubbo = body.connectors.find((entry) => entry.id === 'dubbo-council');
      assert(dubbo, 'missing local connector dubbo-council');
      assert(
        dubbo.status === 'active' || dubbo.status === 'degraded',
        `expected dubbo-council active/degraded, got ${dubbo.status}`,
      );
      assert(
        dubbo.jurisdiction_level === 'local',
        `expected dubbo-council jurisdiction_level local, got ${dubbo.jurisdiction_level}`,
      );
      const grantconnect = body.connectors.find((entry) => entry.id === 'grantconnect');
      assert(grantconnect, 'missing federal connector grantconnect');
      assert(
        grantconnect.status === 'stub',
        `expected grantconnect to be a stub, got ${grantconnect.status}`,
      );
      assert(
        body?.federal_ingestion?.live?.includes('aus-tender') &&
          body.federal_ingestion.live.includes('data-gov-au-pbs'),
        'meta/coverage does not list AusTender and PBS as live',
      );
      assert(
        Array.isArray(body?.federal_ingestion?.pending) &&
          body.federal_ingestion.pending.includes('grantconnect') &&
          !body.federal_ingestion.pending.includes('data-gov-au-pbs'),
        'meta/coverage pending list is not grantconnect-only',
      );
      assert(
        /does not equal the Budget Paper 1/.test(body?.federal_ingestion?.pbs_caveat ?? ''),
        'meta/coverage does not carry the PBS caveat',
      );
      assert(
        Array.isArray(body?.state_ingestion?.live) &&
          body.state_ingestion.live.includes('nsw-budget') &&
          body.state_ingestion.live.includes('data-nsw-ckan'),
        'meta/coverage state_ingestion.live must include nsw-budget and data-nsw-ckan',
      );
      assert(
        Array.isArray(body?.local_ingestion?.live) &&
          body.local_ingestion.live.includes('dubbo-council'),
        'meta/coverage local_ingestion.live must include dubbo-council',
      );
      assert(
        Array.isArray(body?.region_levels) && body.region_levels.includes('region'),
        'meta/coverage region_levels must include the sub-state region level',
      );
      assert(connectorIds.length === new Set(connectorIds).size, 'connector ids must be unique');
      assert(body.counts?.data_sources > 0, 'counts.data_sources must be > 0');
      assert(body.counts?.regions > 0, 'counts.regions must be > 0');
      assert(body.counts?.functions > 0, 'counts.functions must be > 0');
      assert(body.counts?.measures > 0, 'counts.measures must be > 0');
      return `counts=${body.counts.data_sources}/${body.counts.regions}/${body.counts.functions}/${body.counts.measures}`;
    },
  );

  await check('API federal contracts carry provenance and integer cents', async () => {
    const { status, body } = await getJson(
      '/api/v1/spending?jurisdiction_level=federal&measure_type=contract&page_size=10',
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(body?.data?.length > 0, 'no federal contract rows returned');
    for (const row of body.data) {
      assert(row.jurisdiction_level === 'federal', `row ${row.id} is not federal`);
      assert(row.natural_key, `row ${row.id} has no natural_key`);
      assert(Number.isInteger(row.amount_cents), `row ${row.id} amount is not integer cents`);
      assert(row.source_dataset, `row ${row.id} has no source_dataset`);
      assert(row.source_date, `row ${row.id} has no source_date`);
      assert(row.data_quality_flag, `row ${row.id} has no data_quality_flag`);
      assert(/^https:\/\//.test(row.source_url), `row ${row.id} source_url is not a URL`);
      assert(row.provenance?.source_id === 'aus-tender', `row ${row.id} provenance is wrong`);
    }
    return `${body.data.length} federal contract rows, ${body.summary.total_by_measure_type[0]?.total_cents ?? 0} cents`;
  });

  return regionId;
}

async function waitForRoute(page) {
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(250);
}

async function assertRowProvenance(locator, label) {
  const count = await locator.count();
  assert(count > 0, `${label}: expected at least one row`);
  for (let index = 0; index < count; index += 1) {
    const text = (await locator.nth(index).innerText()).replace(/\s+/g, ' ');
    assert(
      KNOWN_SOURCE_IDS.some((sourceId) => text.includes(sourceId)),
      `${label} row ${index + 1} has no source id`,
    );
    assert(/Unverified/.test(text), `${label} row ${index + 1} has no verification status`);
  }
  return `${count} rows`;
}

async function uiChecks(page, regionId) {
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });

  const routes = [
    '/',
    '/search',
    '/functions',
    '/functions/07',
    '/regions',
    `/regions/${regionId}`,
    '/states',
    '/states/NSW',
    '/data-sources',
    '/about',
  ];

  for (const route of routes) {
    await check(`route ${route} renders without pageError`, async () => {
      pageErrors.length = 0;
      await page.goto(`${WEB_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await waitForRoute(page);
      assert(
        pageErrors.length === 0,
        `pageErrors: ${pageErrors.map((message) => message.split('\n')[0]).join(' | ')}`,
      );
      return 'heading visible, 0 pageErrors';
    });
  }

  await check('/search default is mixed: warning, no headline total', async () => {
    pageErrors.length = 0;
    await page.goto(`${WEB_URL}/search`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('mixed-warning').waitFor({ state: 'visible', timeout: 20_000 });
    const warning = await page.getByTestId('mixed-warning').innerText();
    assert(/Measure types are mixed/.test(warning), 'mixed warning title missing');
    assert(/no headline total/i.test(warning), 'mixed warning does not withhold the total');
    assert((await page.getByTestId('headline-total').count()) === 0, 'headline total is visible');
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return 'warning visible, headline-total count=0';
  });

  await check('/search single measure type shows a headline total', async () => {
    pageErrors.length = 0;
    await page.goto(`${WEB_URL}/search?measure_type=actual&fiscal_year=2024-25`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('headline-total').waitFor({ state: 'visible', timeout: 20_000 });
    const amount = (await page.getByTestId('headline-total-amount').innerText()).trim();
    assert(amount.length > 0, 'headline total amount is empty');
    assert(
      (await page.getByTestId('mixed-warning').count()) === 0,
      'mixed warning shown for one measure type',
    );
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return `headline amount ${amount}`;
  });

  await check('/search federal PBS shows provenance and the line-item caveat', async () => {
    pageErrors.length = 0;
    await page.goto(`${WEB_URL}/search?measure_type=budget&jurisdiction_level=federal`, {
      waitUntil: 'domcontentloaded',
    });
    const caveat = page.getByTestId('pbs-caveat');
    await caveat.waitFor({ state: 'visible', timeout: 20_000 });
    assert(
      /does not equal the Budget Paper 1 total/.test(await caveat.innerText()),
      'PBS caveat is not visible on /search',
    );
    const rows = page.getByTestId('spending-rows');
    await rows.waitFor({ state: 'visible', timeout: 20_000 });
    const rowText = await rows.innerText();
    assert(/data-gov-au-pbs/.test(rowText), 'PBS row provenance is missing from /search');
    assert(/Unverified/.test(rowText), 'PBS rows are not marked Unverified');
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return 'PBS provenance and caveat visible';
  });

  await check('/functions/07 default is mixed: warning, no headline total', async () => {
    pageErrors.length = 0;
    await page.goto(`${WEB_URL}/functions/07`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('mixed-warning').waitFor({ state: 'visible', timeout: 20_000 });
    assert((await page.getByTestId('headline-total').count()) === 0, 'headline total is visible');
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return 'warning visible, headline-total count=0';
  });

  await check('/functions/07 single measure type shows a headline total', async () => {
    pageErrors.length = 0;
    await page.goto(`${WEB_URL}/functions/07?measure_type=actual`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('headline-total').waitFor({ state: 'visible', timeout: 20_000 });
    const amount = (await page.getByTestId('headline-total-amount').innerText()).trim();
    assert(amount.length > 0, 'headline total amount is empty');
    assert(
      (await page.getByTestId('mixed-warning').count()) === 0,
      'mixed warning shown for one measure type',
    );
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return `headline amount ${amount}`;
  });

  await check('/search rows and summary footers carry provenance', async () => {
    await page.goto(`${WEB_URL}/search?measure_type=actual&fiscal_year=2024-25`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('spending-rows').waitFor({ state: 'visible', timeout: 20_000 });
    const rows = await assertRowProvenance(
      page.locator('[data-testid="spending-rows"] tbody tr'),
      'search rows',
    );
    const perType = await page.getByTestId('spending-per-type-totals').innerText();
    assert(/Provenance:/.test(perType), 'per-type totals have no provenance footer');
    assert(/synthetic-seed/.test(perType), 'per-type totals footer has no source');
    const headline = await page.getByTestId('headline-total').innerText();
    assert(/Provenance:/.test(headline), 'headline total has no provenance footer');
    assert(/synthetic-seed/.test(headline), 'headline total footer has no source');
    return `${rows}, summary + headline footers present`;
  });

  await check('/functions/07 rows and per-type tables carry provenance', async () => {
    await page.goto(`${WEB_URL}/functions/07`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('per-measure-type-table').waitFor({ state: 'visible', timeout: 20_000 });
    const rows = await assertRowProvenance(
      page.locator('[data-testid="function-measure-rows"] tbody tr'),
      'function rows',
    );
    const typeRows = await assertRowProvenance(
      page.locator('[data-testid="per-measure-type-table"] tbody tr'),
      'per-measure-type rows',
    );
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return `${rows}; ${typeRows}`;
  });

  await check('/functions/07 single type ranked rows carry provenance', async () => {
    await page.goto(`${WEB_URL}/functions/07?measure_type=actual`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('ranked-states-table').waitFor({ state: 'visible', timeout: 20_000 });
    const rows = await assertRowProvenance(
      page.locator('[data-testid="ranked-states-table"] tbody tr'),
      'ranked state rows',
    );
    const measureRows = await assertRowProvenance(
      page.locator('[data-testid="function-measure-rows"] tbody tr'),
      'function rows',
    );
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return `${rows}; ${measureRows}`;
  });

  await check(`/regions/${regionId} rows and function table carry provenance`, async () => {
    await page.goto(`${WEB_URL}/regions/${regionId}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('by-function-table').waitFor({ state: 'visible', timeout: 20_000 });
    const rows = await assertRowProvenance(
      page.locator('[data-testid="region-measure-rows"] tbody tr'),
      'region rows',
    );
    const functionRows = await assertRowProvenance(
      page.locator('[data-testid="by-function-table"] tbody tr'),
      'by-function rows',
    );
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return `${rows}; ${functionRows}`;
  });

  await check(
    '/data-sources#synthetic-seed shows the synthetic source and connector statuses',
    async () => {
      pageErrors.length = 0;
      await page.goto(`${WEB_URL}/data-sources#synthetic-seed`, { waitUntil: 'domcontentloaded' });
      const source = page.getByTestId('source-synthetic-seed');
      await source.waitFor({ state: 'visible', timeout: 20_000 });
      const sourceText = (await source.innerText()).replace(/\s+/g, ' ');
      assert(/Unverified/.test(sourceText), 'source is not marked Unverified');
      assert(/synthetic-seed/.test(sourceText), 'source id is missing');
      assert(
        /verification status|Verification/i.test(sourceText) || sourceText.length > 0,
        'source card is empty',
      );
      assert(
        (await source.locator('a[href="/data-sources#synthetic-seed"]').count()) > 0,
        'synthetic source anchor link is missing',
      );

      const stubs = page.getByTestId('connector-stubs');
      await stubs.waitFor({ state: 'visible', timeout: 20_000 });
      const coverageResponse = await getJson('/api/meta/coverage');
      assert(coverageResponse.status === 200, 'meta/coverage unavailable for stub expectation');
      const coverage = coverageResponse.body;
      const expectedStubs = coverage?.connector_status_counts?.stub;
      assert(
        Number.isInteger(expectedStubs),
        `coverage connector_status_counts.stub is not an integer: ${expectedStubs}`,
      );
      const stubCount = await stubs.getByText('stub — not wired', { exact: true }).count();
      assert(
        stubCount === expectedStubs,
        `expected ${expectedStubs} connector stubs marked not wired (from coverage), got ${stubCount}`,
      );
      const expectedActive = coverage?.connector_status_counts?.active;
      assert(
        Number.isInteger(expectedActive),
        `coverage connector_status_counts.active is not an integer: ${expectedActive}`,
      );
      const activeCount = await stubs.getByText('active', { exact: true }).count();
      assert(
        activeCount === expectedActive,
        `expected ${expectedActive} active connectors (from coverage), got ${activeCount}`,
      );
      const activeIds = (coverage?.connectors ?? [])
        .filter((connector) => connector.status === 'active' || connector.status === 'degraded')
        .map((connector) => connector.id);
      for (const id of [
        'aus-tender',
        'data-gov-au-pbs',
        'nsw-budget',
        'data-nsw-ckan',
        'dubbo-council',
      ]) {
        assert(activeIds.includes(id), `coverage does not list ${id} as active/degraded`);
      }
      const connectorText = await stubs.innerText();
      assert(/nsw-budget/.test(connectorText), 'NSW Budget connector is not shown in the UI');
      assert(
        /data-nsw-ckan/.test(connectorText),
        'data.nsw.gov.au CKAN connector is not shown in the UI',
      );
      assert(
        /dubbo-council/.test(connectorText),
        'Dubbo Regional Council connector is not shown in the UI',
      );
      const pbsCard = page.getByTestId('source-data-gov-au-pbs');
      await pbsCard.waitFor({ state: 'visible', timeout: 20_000 });
      assert(
        /PBS Program Expenses|Portfolio Budget Statements/.test(await pbsCard.innerText()),
        'PBS source card is missing its provenance',
      );
      const caveat = page.getByTestId('pbs-caveat');
      await caveat.waitFor({ state: 'visible', timeout: 20_000 });
      assert(
        /does not equal the Budget Paper 1 total/.test(await caveat.innerText()),
        'PBS caveat is not visible on /data-sources',
      );

      const limitations = page.getByTestId('coverage-limitations');
      await limitations.waitFor({ state: 'visible', timeout: 20_000 });
      const limitationText = (await limitations.innerText()).replace(/\s+/g, ' ');
      assert(
        /AusTender OCDS contractPublished ingestion and data\.gov\.au PBS program-expense ingestion are live/.test(
          limitationText,
        ),
        'coverage limitations do not mention live AusTender/PBS ingestion',
      );
      assert(
        /GrantConnect is not implemented/.test(limitationText),
        'coverage limitations do not mention pending GrantConnect',
      );
      assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
      return `source Unverified, ${expectedStubs} stubs, ${expectedActive} active (incl. Dubbo), PBS caveat, limitations present`;
    },
  );
}

async function main() {
  console.log(`ausspend live provenance audit`);
  console.log(`web: ${WEB_URL}`);
  console.log(`api: ${API_URL}\n`);

  const regionId = await apiChecks();

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await uiChecks(page, regionId);
    await context.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter((result) => result.status === 'FAIL');
  const passed = results.length - failed.length;
  console.log(`\nSummary: ${passed}/${results.length} checks passed, ${failed.length} failed`);
  if (failed.length > 0) {
    for (const result of failed) console.log(`  FAIL ${result.name}: ${result.message}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[audit] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
