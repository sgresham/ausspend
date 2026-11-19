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
 * summary provenance, the source register (synthetic only when present), and the
 * API invariants the UI relies on. Any failure or pageError exits nonzero.
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
  'dubbo-council-gpfs',
  'city-of-sydney-gpfs',
  'blacktown-gpfs',
  'parramatta-gpfs',
  'northern-beaches-gpfs',
  'canterbury-bankstown-gpfs',
  'sutherland-shire-gpfs',
  'wollongong-gpfs',
  'newcastle-gpfs',
  'lake-macquarie-gpfs',
  'maitland-gpfs',
  'mid-coast-gpfs',
  'port-macquarie-hastings-gpfs',
  'tweed-shire-gpfs',
  'shoalhaven-gpfs',
  'shellharbour-gpfs',
  'waverley-gpfs',
  'willoughby-gpfs',
  'inner-west-gpfs',
  'bayside-gpfs',
  'randwick-gpfs',
  'ryde-gpfs',
  'north-sydney-gpfs',
  'canada-bay-gpfs',
  'cumberland-gpfs',
  'georges-river-gpfs',
  'fairfield-gpfs',
  'liverpool-gpfs',
  'ku-ring-gai-gpfs',
  'lane-cove-gpfs',
  'mosman-gpfs',
  'hawkesbury-gpfs',
  'woollahra-gpfs',
  'blue-mountains-gpfs',
  'wollondilly-gpfs',
  'camden-gpfs',
  'campbelltown-gpfs',
  'central-coast-gpfs',
  'hornsby-gpfs',
  'penrith-gpfs',
  'the-hills-gpfs',
  'warren-gpfs',
  'brewarrina-gpfs',
  'bogan-gpfs',
  'kyogle-gpfs',
  'junee-gpfs',
  'uralla-gpfs',
  'cootamundra-gundagai-gpfs',
  'moree-plains-gpfs',
  'hilltops-gpfs',
  'bourke-gpfs',
  'coolamon-gpfs',
  'gilgandra-gpfs',
  'lockhart-gpfs',
  'coonamble-gpfs',
  'weddin-gpfs',
  'walcha-gpfs',
  'murrumbidgee-gpfs',
  'armidale-gpfs',
  'byron-gpfs',
  'clarence-valley-gpfs',
  'richmond-valley-gpfs',
  'kempsey-gpfs',
  'wingecarribee-gpfs',
  'queanbeyan-palerang-gpfs',
  'goulburn-mulwaree-gpfs',
  'broken-hill-gpfs',
  'griffith-gpfs',
  'lithgow-gpfs',
  'mid-western-regional-gpfs',
  'bega-valley-gpfs',
  'snowy-monaro-gpfs',
  'singleton-gpfs',
  'orange-gpfs',
  'blayney-gpfs',
  'liverpool-plains-gpfs',
  'tenterfield-gpfs',
  'cobar-gpfs',
  'strathfield-gpfs',
  'grantconnect',
  'vic-budget',
  'vic-vlgc-vgc1',
  'vic-vlgc-abs',
  'vic-vlgc-fag',
  'vic-lgprf',
  'aihw-health-expenditure',
  'sa-budget-gfs',
  'act-budget',
  'nt-budget',
  'qld-budget',
  'qld-qgip',
  'acnc-charity',
  'abs-gfs',
  'abs-gfs-pnfc',
  'sydney-water',
  'waternsw',
  'hunter-water',
  'essential-energy',
  'forestry-corporation',
  'landcom',
  'port-authority-nsw',
  'tahe',
  'sydney-trains',
  'nsw-trainlink',
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
  let populatedRegionId;
  await check('API regions list exposes a real region _id', async () => {
    const { status, body } = await getJson('/api/regions?limit=200');
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(body?.regions) && body.regions.length > 0, 'no regions returned');
    regionId = body.regions[0]._id;
    populatedRegionId = body.regions.find((region) => region.level === 'region')?._id ?? regionId;
    assert(/^[a-f0-9]{24}$/i.test(regionId), `region _id is not a 24-char hex id: ${regionId}`);
    return `${body.regions.length} regions, first _id=${regionId}, populated region _id=${populatedRegionId}`;
  });

  await check('API data-sources returns honest provenance (synthetic if present)', async () => {
    const { status, body } = await getJson('/api/data-sources');
    assert(status === 200, `expected 200, got ${status}`);
    const source = body?.sources?.find((entry) => entry.source_id === 'synthetic-seed');
    if (!source) return 'synthetic-seed absent (real-only mode)';
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
      Array.isArray(summary?.total_by_measure_type) && summary.total_by_measure_type.length >= 2,
      `expected at least 2 per-type totals, got ${JSON.stringify(summary?.total_by_measure_type)}`,
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
    'API meta/coverage reports AusTender/PBS live and GrantConnect as a manual export',
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
        grantconnect.status === 'active' || grantconnect.status === 'degraded',
        `expected grantconnect active/degraded (manual export), got ${grantconnect.status}`,
      );
      assert(
        /manual export/i.test(
          `${body?.federal_ingestion?.grantconnect_caveat ?? ''} ${body?.federal_ingestion?.grantconnect_note ?? ''}`,
        ),
        'meta/coverage does not carry the GrantConnect manual-export caveat',
      );
      assert(
        body?.federal_ingestion?.live?.includes('aus-tender') &&
          body.federal_ingestion.live.includes('data-gov-au-pbs'),
        'meta/coverage does not list AusTender and PBS as live',
      );
      assert(
        Array.isArray(body?.federal_ingestion?.pending) &&
          !body.federal_ingestion.pending.includes('grantconnect') &&
          !body.federal_ingestion.pending.includes('data-gov-au-pbs'),
        'meta/coverage still lists grantconnect as pending',
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

  await check('ABS GFS PNFC is separate and never totalled', async () => {
    const pnfc = await getJson('/api/benchmark/pnfc?fiscal_year=2024-25');
    assert(pnfc.status === 200, `expected 200, got ${pnfc.status}`);
    assert(pnfc.body?.source?.source_id === 'abs-gfs-pnfc', 'PNFC source is not abs-gfs-pnfc');
    assert(pnfc.body?.source?.unit === '$m', 'PNFC unit is not $m');
    assert(pnfc.body?.source?.unit_to_cents === 100000000, 'PNFC scale is wrong');
    assert(!('total_cents' in pnfc.body), 'PNFC response has a total_cents');
    assert(
      Array.isArray(pnfc.body?.series) && pnfc.body.series.length > 0,
      'no PNFC benchmark series',
    );
    assert(
      pnfc.body.series.every((row) => row.jurisdiction_level === 'pnfc'),
      'PNFC rows are not jurisdiction_level pnfc',
    );
    assert(
      pnfc.body.series.every((row) => row.verified === true),
      'PNFC rows are not verified official aggregates',
    );
    assert(
      pnfc.body.series.every((row) => !('total_cents' in row)),
      'PNFC series carries a total',
    );
    const generic = await getJson('/api/spending?jurisdiction_level=pnfc&fiscal_year=2024-25');
    assert(generic.status === 200, `generic PNFC query expected 200, got ${generic.status}`);
    assert(
      Array.isArray(generic.body?.data) && generic.body.data.length === 0,
      'generic spending query returned PNFC benchmark rows',
    );
    return `${pnfc.body.series.length} PNFC cells, no combined total, excluded from /api/spending`;
  });

  await check('NSW SOC entities are entity-level, unit-checked and never totalled', async () => {
    const soc = await getJson('/api/soc?fiscal_year=2024-25');
    assert(soc.status === 200, `expected 200, got ${soc.status}`);
    assert(
      soc.body?.source?.source_id === 'sydney-water',
      'SOC default source is not sydney-water',
    );
    assert(!('total_cents' in soc.body), 'SOC response has a total_cents');
    // The default view is the latest SOC fiscal year (2024-25). TAHE's latest
    // published report is FY2023-24, so it is queried explicitly below rather
    // than mixed into the 2024-25 series. Sydney Trains' latest report IS
    // FY2024-25, so its six rows are part of the default view.
    assert(
      Array.isArray(soc.body?.series) && soc.body.series.length === 99,
      `expected 99 SOC rows (2024-25: Sydney Water 10 + WaterNSW 47 + Hunter Water 6 + Essential Energy 6 + Forestry Corporation 7 + Landcom 6 + Port Authority of NSW 5 + Sydney Trains 6 + NSW TrainLink 6), got ${soc.body?.series?.length}`,
    );
    assert(
      soc.body.series.every((row) => row.jurisdiction_level === 'soc'),
      'SOC rows are not jurisdiction_level soc',
    );
    assert(
      soc.body.series.every((row) => row.verified === false),
      'SOC rows must be unverified in this phase',
    );
    assert(
      soc.body.series.every((row) => row.aggregation_role === 'agency_detail'),
      'SOC rows are not non-additive agency detail',
    );
    assert(
      Array.isArray(soc.body.entities) &&
        soc.body.entities.includes('Sydney Water') &&
        soc.body.entities.includes('WaterNSW') &&
        soc.body.entities.includes('Hunter Water') &&
        soc.body.entities.includes('Essential Energy') &&
        soc.body.entities.includes('Forestry Corporation of NSW') &&
        soc.body.entities.includes('Landcom') &&
        soc.body.entities.includes('Port Authority of NSW') &&
        soc.body.entities.includes('TAHE') &&
        soc.body.entities.includes('Sydney Trains') &&
        soc.body.entities.includes('NSW TrainLink'),
      'SOC entities (Sydney Water, WaterNSW, Hunter Water, Essential Energy, Forestry Corporation of NSW, Landcom, Port Authority of NSW, TAHE, Sydney Trains, NSW TrainLink) are not returned',
    );
    const sources = new Map((soc.body.sources ?? []).map((source) => [source.source_id, source]));
    assert(sources.get('sydney-water')?.records === 10, 'Sydney Water source count is not 10 rows');
    assert(sources.get('waternsw')?.records === 47, 'WaterNSW source count is not 47 rows');
    assert(sources.get('hunter-water')?.records === 6, 'Hunter Water source count is not 6 rows');
    assert(
      sources.get('essential-energy')?.records === 6,
      'Essential Energy source count is not 6 rows',
    );
    assert(
      sources.get('forestry-corporation')?.records === 7,
      'Forestry Corporation source count is not 7 rows',
    );
    assert(sources.get('landcom')?.records === 6, 'Landcom source count is not 6 rows');
    assert(
      sources.get('port-authority-nsw')?.records === 5,
      'Port Authority of NSW source count is not 5 rows',
    );
    assert(
      sources.get('tahe')?.records === 0,
      'TAHE should have no rows in the default 2024-25 view',
    );
    assert(sources.get('sydney-trains')?.records === 6, 'Sydney Trains source count is not 6 rows');
    assert(sources.get('nsw-trainlink')?.records === 6, 'NSW TrainLink source count is not 6 rows');
    for (const entity of [
      'sydney-water',
      'waternsw',
      'hunter-water',
      'forestry-corporation',
      'landcom',
      'port-authority-nsw',
      'tahe',
      'sydney-trains',
      'nsw-trainlink',
    ]) {
      assert(
        sources.get(entity)?.unit === 'AUD_thousands',
        `${entity} SOC unit is not AUD_thousands`,
      );
      assert(
        sources.get(entity)?.unit_to_cents === 100000,
        `${entity} SOC scale is not 100,000 cents per unit`,
      );
    }
    assert(
      sources.get('essential-energy')?.unit === 'AUD_millions',
      'Essential Energy SOC unit is not AUD_millions',
    );
    assert(
      sources.get('essential-energy')?.unit_to_cents === 100000000,
      'Essential Energy SOC scale is not 100,000,000 cents per unit',
    );

    const sydneyWater = await getJson('/api/soc?fiscal_year=2024-25&entity=Sydney%20Water');
    assert(sydneyWater.status === 200, `Sydney Water SOC expected 200, got ${sydneyWater.status}`);
    assert(
      sydneyWater.body?.series?.length === 10,
      `expected 10 Sydney Water SOC rows, got ${sydneyWater.body?.series?.length}`,
    );
    assert(
      sydneyWater.body?.source?.source_id === 'sydney-water',
      'Sydney Water SOC source is not sydney-water',
    );
    const swByLine = new Map(sydneyWater.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      swByLine.get('total_expenses')?.amount_cents === 294954000000,
      'Sydney Water total expenses is not 2,949,540 $’000 in cents',
    );
    assert(
      swByLine.get('total_revenue')?.amount_cents === 347966700000,
      'Sydney Water total revenue is not 3,479,667 $’000 in cents',
    );
    assert(
      swByLine.get('total_expenses')?.potential_double_count === false,
      'Sydney Water own-source total expenses is flagged as double count',
    );
    assert(
      swByLine.get('nsw_government_grants_social_programs')?.potential_double_count === true,
      'Sydney Water NSW government grant row is not flagged as a potential double count',
    );

    const waterNsw = await getJson('/api/soc?fiscal_year=2024-25&entity=WaterNSW');
    assert(waterNsw.status === 200, `WaterNSW SOC expected 200, got ${waterNsw.status}`);
    assert(
      waterNsw.body?.series?.length === 47,
      `expected 47 WaterNSW SOC rows, got ${waterNsw.body?.series?.length}`,
    );
    assert(waterNsw.body?.source?.source_id === 'waternsw', 'WaterNSW SOC source is not waternsw');
    assert(
      waterNsw.body.series.every((row) => row.delivery_entity === 'WaterNSW'),
      'WaterNSW SOC response contains another entity',
    );
    const wnByLine = new Map(waterNsw.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      wnByLine.get('total_expenses')?.amount_cents === 47283100000,
      'WaterNSW total expenses is not 472,831 $’000 in cents',
    );
    assert(
      wnByLine.get('total_revenue')?.amount_cents === 49500400000,
      'WaterNSW total revenue is not 495,004 $’000 in cents',
    );
    assert(
      wnByLine.get('total_expenses')?.potential_double_count === false,
      'WaterNSW own-source total expenses is flagged as double count',
    );
    assert(
      wnByLine.get('nsw_government_contributions_to_operations')?.potential_double_count === true,
      'WaterNSW NSW government contribution is not flagged as a potential double count',
    );

    // Deep detail: the WaterNSW notes are exposed as non-additive components.
    assert(
      !('total_cents' in waterNsw.body) &&
        !('total_amount' in waterNsw.body) &&
        !('combined_total' in waterNsw.body),
      'WaterNSW SOC response must not contain a computed total',
    );
    const sectionCounts = waterNsw.body?.counts?.by_section;
    const noteCounts = waterNsw.body?.counts?.by_note;
    assert(sectionCounts && typeof sectionCounts === 'object', 'WaterNSW by_section is missing');
    assert(noteCounts && typeof noteCounts === 'object', 'WaterNSW by_note is missing');
    assert(
      sectionCounts.revenue === 16 &&
        sectionCounts.expenses === 29 &&
        sectionCounts.result === 1 &&
        sectionCounts.capital === 1,
      `WaterNSW by_section is not {revenue:16, expenses:29, result:1, capital:1}: ${JSON.stringify(sectionCounts)}`,
    );
    assert(
      noteCounts['Face statement'] === 5 &&
        noteCounts['Note 2 Revenue from water supply and delivery'] === 5 &&
        noteCounts['Note 3 Grants and subsidies'] === 3 &&
        noteCounts['Note 4 Other revenue'] === 7 &&
        noteCounts['Note 5 Employee related expenses'] === 4 &&
        noteCounts['Note 6 Other operating expenses'] === 14 &&
        noteCounts['Note 7 Depreciation and amortisation'] === 3 &&
        noteCounts['Note 8 Finance costs'] === 5 &&
        noteCounts['Statement of cash flows — investing activities'] === 1,
      `WaterNSW by_note counts are wrong: ${JSON.stringify(noteCounts)}`,
    );
    const wnNoteRows = waterNsw.body.series.filter(
      (row) => typeof row.soc_note === 'string' && row.soc_note.startsWith('Note '),
    );
    assert(
      wnNoteRows.length === 41,
      `expected 41 WaterNSW printed-note rows (38 note components + 3 Note 3 grants), got ${wnNoteRows.length}`,
    );
    assert(
      wnNoteRows.every(
        (row) => typeof row.soc_component_of === 'string' && row.soc_component_of.length > 0,
      ),
      'a WaterNSW note row is missing soc_component_of',
    );
    const signedCents = (row) =>
      row.soc_printed_sign === 'negative' ? -row.amount_cents : row.amount_cents;
    const componentSum = (subtotal) =>
      waterNsw.body.series
        .filter((row) => row.soc_component_of === subtotal)
        .reduce((sum, row) => sum + signedCents(row), 0);
    for (const [subtotal, expected] of [
      ['revenue_from_water_supply_and_delivery', 37972000000],
      ['other_revenue', 4994800000],
      ['employee_expenses', 16365400000],
      ['other_operating_expenses', 11334800000],
      ['depreciation_amortisation', 10753000000],
      ['finance_costs', 8829900000],
    ]) {
      assert(
        componentSum(subtotal) === expected,
        `WaterNSW ${subtotal} components sum to ${componentSum(subtotal)}, expected ${expected} cents`,
      );
    }
    const capex = wnByLine.get('capital_expenditure_cash');
    assert(
      capex?.amount_cents === 17082800000 &&
        capex?.soc_printed_sign === 'negative' &&
        capex?.soc_section === 'capital',
      'WaterNSW cash-flow capital expenditure row is missing or not a printed outflow',
    );
    const wnDoubleCount = waterNsw.body.series
      .filter((row) => row.potential_double_count)
      .map((row) => row.soc_line_item)
      .sort();
    assert(
      wnDoubleCount.length === 3 &&
        wnDoubleCount.join(',') ===
          'nsw_government_contributions_to_operations,nsw_government_subsidies,other_government_grants',
      `WaterNSW potential_double_count rows are not the 3 government grants: ${wnDoubleCount.join(',')}`,
    );

    const hunterWater = await getJson('/api/soc?fiscal_year=2024-25&entity=Hunter%20Water');
    assert(hunterWater.status === 200, `Hunter Water SOC expected 200, got ${hunterWater.status}`);
    assert(
      hunterWater.body?.series?.length === 6,
      `expected 6 Hunter Water SOC rows, got ${hunterWater.body?.series?.length}`,
    );
    assert(
      hunterWater.body?.source?.source_id === 'hunter-water',
      'Hunter Water SOC source is not hunter-water',
    );
    assert(
      hunterWater.body.series.every((row) => row.delivery_entity === 'Hunter Water'),
      'Hunter Water SOC response contains another entity',
    );
    const hwByLine = new Map(hunterWater.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      hwByLine.get('total_expenses')?.amount_cents === 41832600000,
      'Hunter Water total expenses is not 418,326 $’000 in cents',
    );
    assert(
      hwByLine.get('total_revenue')?.amount_cents === 44704900000,
      'Hunter Water total revenue is not 447,049 $’000 in cents',
    );
    assert(
      hwByLine.get('employee_expenses')?.amount_cents === 6961700000,
      'Hunter Water employee expenses is not 69,617 $’000 in cents',
    );
    assert(
      hwByLine.get('net_result')?.amount_cents === 1940600000,
      'Hunter Water net result is not 19,406 $’000 in cents',
    );
    assert(
      hwByLine.get('total_expenses')?.potential_double_count === false,
      'Hunter Water own-source total expenses is flagged as double count',
    );
    assert(
      hwByLine.get('government_grants_and_rebates')?.potential_double_count === true,
      'Hunter Water government grants row is not flagged as a potential double count',
    );

    const essentialEnergy = await getJson('/api/soc?fiscal_year=2024-25&entity=Essential%20Energy');
    assert(
      essentialEnergy.status === 200,
      `Essential Energy SOC expected 200, got ${essentialEnergy.status}`,
    );
    assert(
      essentialEnergy.body?.series?.length === 6,
      `expected 6 Essential Energy SOC rows, got ${essentialEnergy.body?.series?.length}`,
    );
    assert(
      essentialEnergy.body?.source?.source_id === 'essential-energy',
      'Essential Energy SOC source is not essential-energy',
    );
    assert(
      essentialEnergy.body.series.every((row) => row.delivery_entity === 'Essential Energy'),
      'Essential Energy SOC response contains another entity',
    );
    const eeByLine = new Map(essentialEnergy.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      eeByLine.get('total_expenses')?.amount_cents === 204270000000,
      'Essential Energy total expenses is not 2,042.7 $M in cents',
    );
    assert(
      eeByLine.get('total_revenue')?.amount_cents === 190600000000,
      'Essential Energy total revenue is not 1,906.0 $M in cents',
    );
    assert(
      eeByLine.get('employee_expenses')?.amount_cents === 39930000000,
      'Essential Energy employee expenses is not 399.3 $M in cents',
    );
    assert(
      eeByLine.get('depreciation_amortisation')?.amount_cents === 49720000000,
      'Essential Energy depreciation/amortisation is not 497.2 $M in cents',
    );
    assert(
      eeByLine.get('net_result')?.amount_cents === 9580000000 &&
        eeByLine.get('net_result')?.soc_printed_sign === 'negative',
      'Essential Energy net result is not the printed 95.8 $M loss',
    );
    assert(
      eeByLine.get('total_expenses')?.potential_double_count === false,
      'Essential Energy own-source total expenses is flagged as double count',
    );
    assert(
      eeByLine.get('government_grants_and_subsidies')?.potential_double_count === true,
      'Essential Energy government grants row is not flagged as a potential double count',
    );

    const forestry = await getJson(
      '/api/soc?fiscal_year=2024-25&entity=Forestry%20Corporation%20of%20NSW',
    );
    assert(
      forestry.status === 200,
      `Forestry Corporation SOC expected 200, got ${forestry.status}`,
    );
    assert(
      forestry.body?.series?.length === 7,
      `expected 7 Forestry Corporation SOC rows, got ${forestry.body?.series?.length}`,
    );
    assert(
      forestry.body?.source?.source_id === 'forestry-corporation',
      'Forestry Corporation SOC source is not forestry-corporation',
    );
    assert(
      forestry.body.series.every((row) => row.delivery_entity === 'Forestry Corporation of NSW'),
      'Forestry Corporation SOC response contains another entity',
    );
    const fcByLine = new Map(forestry.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      fcByLine.get('total_expenses')?.amount_cents === 38453200000,
      'Forestry Corporation total expenses is not $384,532 thousand in cents',
    );
    assert(
      fcByLine.get('total_revenue')?.amount_cents === 38855700000,
      'Forestry Corporation total revenue is not $388,557 thousand in cents',
    );
    assert(
      fcByLine.get('employee_expenses')?.amount_cents === 8961000000,
      'Forestry Corporation employee expenses is not $89,610 thousand in cents',
    );
    assert(
      fcByLine.get('depreciation_amortisation')?.amount_cents === 1216300000,
      'Forestry Corporation depreciation/amortisation is not $12,163 thousand in cents',
    );
    assert(
      fcByLine.get('net_result')?.amount_cents === 1983800000 &&
        fcByLine.get('net_result')?.soc_printed_sign === 'positive',
      'Forestry Corporation net result is not the printed $19,838 thousand profit',
    );
    assert(
      fcByLine.get('government_grants_community_service_obligations')?.potential_double_count ===
        true &&
        fcByLine.get('government_grants_other_state_government')?.potential_double_count === true,
      'Forestry Corporation government grant rows are not flagged as potential double counts',
    );

    const landcom = await getJson('/api/soc?fiscal_year=2024-25&entity=Landcom');
    assert(landcom.status === 200, `Landcom SOC expected 200, got ${landcom.status}`);
    assert(
      landcom.body?.series?.length === 6,
      `expected 6 Landcom SOC rows, got ${landcom.body?.series?.length}`,
    );
    assert(landcom.body?.source?.source_id === 'landcom', 'Landcom SOC source is not landcom');
    assert(
      landcom.body.series.every((row) => row.delivery_entity === 'Landcom'),
      'Landcom SOC response contains another entity',
    );
    const lcByLine = new Map(landcom.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      lcByLine.get('total_expenses')?.amount_cents === 21399500000,
      'Landcom total expenses is not $213,995 thousand in cents',
    );
    assert(
      lcByLine.get('total_revenue')?.amount_cents === 27718700000,
      'Landcom total revenue is not $277,187 thousand in cents',
    );
    assert(
      lcByLine.get('employee_expenses')?.amount_cents === 2973700000,
      'Landcom employee expenses is not $29,737 thousand in cents',
    );
    assert(
      lcByLine.get('depreciation_amortisation')?.amount_cents === 304000000,
      'Landcom depreciation/amortisation is not $3,040 thousand in cents',
    );
    assert(
      lcByLine.get('government_grants')?.amount_cents === 228500000 &&
        lcByLine.get('government_grants')?.potential_double_count === true,
      'Landcom grant income is not $2,285 thousand flagged as a potential double count',
    );
    assert(
      lcByLine.get('net_result')?.amount_cents === 4423300000 &&
        lcByLine.get('net_result')?.soc_printed_sign === 'positive',
      'Landcom net result is not the printed $44,233 thousand profit',
    );

    const portAuthority = await getJson(
      '/api/soc?fiscal_year=2024-25&entity=Port%20Authority%20of%20NSW',
    );
    assert(
      portAuthority.status === 200,
      `Port Authority of NSW SOC expected 200, got ${portAuthority.status}`,
    );
    assert(
      portAuthority.body?.series?.length === 5,
      `expected 5 Port Authority of NSW SOC rows, got ${portAuthority.body?.series?.length}`,
    );
    assert(
      portAuthority.body?.source?.source_id === 'port-authority-nsw',
      'Port Authority SOC source is not port-authority-nsw',
    );
    assert(
      portAuthority.body.series.every((row) => row.delivery_entity === 'Port Authority of NSW'),
      'Port Authority SOC response contains another entity',
    );
    assert(!('total_cents' in portAuthority.body), 'Port Authority SOC response has a total_cents');
    const paByLine = new Map(portAuthority.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      paByLine.get('total_expenses')?.amount_cents === 19095300000,
      'Port Authority total expenses is not $190,953 thousand in cents',
    );
    assert(
      paByLine.get('total_revenue')?.amount_cents === 23825400000,
      'Port Authority total revenue is not $238,254 thousand in cents',
    );
    assert(
      paByLine.get('employee_expenses')?.amount_cents === 9606100000,
      'Port Authority employee expenses is not $96,061 thousand in cents',
    );
    assert(
      paByLine.get('depreciation_amortisation')?.amount_cents === 2165000000,
      'Port Authority depreciation/amortisation is not $21,650 thousand in cents',
    );
    assert(
      paByLine.get('net_result')?.amount_cents === 3629500000 &&
        paByLine.get('net_result')?.soc_printed_sign === 'positive',
      'Port Authority net result is not the printed $36,295 thousand profit',
    );
    assert(
      paByLine.get('total_expenses')?.potential_double_count === false &&
        paByLine.get('net_result')?.potential_double_count === false,
      'Port Authority own-source rows are incorrectly flagged as potential double counts',
    );
    assert(
      paByLine.get('government_grants') === undefined,
      'Port Authority emitted a grant row although no grant is separately disclosed',
    );

    const tahe = await getJson('/api/soc?fiscal_year=2023-24&entity=TAHE');
    assert(tahe.status === 200, `TAHE SOC expected 200, got ${tahe.status}`);
    assert(
      tahe.body?.series?.length === 6,
      `expected 6 TAHE SOC rows, got ${tahe.body?.series?.length}`,
    );
    assert(tahe.body?.source?.source_id === 'tahe', 'TAHE SOC source is not tahe');
    assert(
      tahe.body.series.every((row) => row.delivery_entity === 'TAHE'),
      'TAHE SOC response contains another entity',
    );
    assert(!('total_cents' in tahe.body), 'TAHE SOC response has a total_cents');
    const taheByLine = new Map(tahe.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      taheByLine.get('total_expenses')?.amount_cents === 172204600000,
      'TAHE total expenses is not $1,722,046 thousand in cents',
    );
    assert(
      taheByLine.get('total_revenue')?.amount_cents === 2014394000000,
      'TAHE total revenue is not $20,143,940 thousand in cents',
    );
    assert(
      taheByLine.get('employee_expenses')?.amount_cents === 1050700000,
      'TAHE employee expenses is not $10,507 thousand in cents',
    );
    assert(
      taheByLine.get('depreciation_amortisation')?.amount_cents === 133457600000,
      'TAHE depreciation/amortisation is not $1,334,576 thousand in cents',
    );
    assert(
      taheByLine.get('government_grants')?.amount_cents === 126979900000 &&
        taheByLine.get('government_grants')?.potential_double_count === true,
      'TAHE grants row is not $1,269,799 thousand with potential_double_count',
    );
    assert(
      taheByLine.get('net_result')?.amount_cents === 1842189400000 &&
        taheByLine.get('net_result')?.soc_printed_sign === 'positive',
      'TAHE net result is not the printed $18,421,894 thousand surplus',
    );
    assert(
      taheByLine.get('total_expenses')?.potential_double_count === false &&
        taheByLine.get('net_result')?.potential_double_count === false,
      'TAHE own-source rows are incorrectly flagged as potential double counts',
    );

    const sydneyTrains = await getJson('/api/soc?fiscal_year=2024-25&entity=Sydney%20Trains');
    assert(
      sydneyTrains.status === 200,
      `Sydney Trains SOC expected 200, got ${sydneyTrains.status}`,
    );
    assert(
      sydneyTrains.body?.series?.length === 6,
      `expected 6 Sydney Trains SOC rows, got ${sydneyTrains.body?.series?.length}`,
    );
    assert(
      sydneyTrains.body?.source?.source_id === 'sydney-trains',
      'Sydney Trains SOC source is not sydney-trains',
    );
    assert(
      sydneyTrains.body.series.every((row) => row.delivery_entity === 'Sydney Trains'),
      'Sydney Trains SOC response contains another entity',
    );
    assert(!('total_cents' in sydneyTrains.body), 'Sydney Trains SOC response has a total_cents');
    const stByLine = new Map(sydneyTrains.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      stByLine.get('total_expenses')?.amount_cents === 537643000000,
      'Sydney Trains total expenses is not $5,376,430 thousand in cents',
    );
    assert(
      stByLine.get('total_revenue')?.amount_cents === 175905200000,
      'Sydney Trains total revenue is not $1,759,052 thousand in cents',
    );
    assert(
      stByLine.get('employee_expenses')?.amount_cents === 199705300000,
      'Sydney Trains employee expenses is not $1,997,053 thousand in cents',
    );
    assert(
      stByLine.get('depreciation_amortisation')?.amount_cents === 32171600000,
      'Sydney Trains depreciation/amortisation is not $321,716 thousand in cents',
    );
    assert(
      stByLine.get('government_grants')?.amount_cents === 350021200000 &&
        stByLine.get('government_grants')?.potential_double_count === true,
      'Sydney Trains grants row is not $3,500,212 thousand with potential_double_count',
    );
    assert(
      stByLine.get('net_result')?.amount_cents === 12827700000 &&
        stByLine.get('net_result')?.soc_printed_sign === 'negative',
      'Sydney Trains net result is not the printed $128,277 thousand deficit',
    );
    assert(
      stByLine.get('total_expenses')?.potential_double_count === false &&
        stByLine.get('net_result')?.potential_double_count === false,
      'Sydney Trains own-source rows are incorrectly flagged as potential double counts',
    );

    const nswTrainlink = await getJson('/api/soc?fiscal_year=2024-25&entity=NSW%20TrainLink');
    assert(
      nswTrainlink.status === 200,
      `NSW TrainLink SOC expected 200, got ${nswTrainlink.status}`,
    );
    assert(
      nswTrainlink.body?.series?.length === 6,
      `expected 6 NSW TrainLink SOC rows, got ${nswTrainlink.body?.series?.length}`,
    );
    assert(
      nswTrainlink.body?.source?.source_id === 'nsw-trainlink',
      'NSW TrainLink SOC source is not nsw-trainlink',
    );
    assert(
      nswTrainlink.body.series.every((row) => row.delivery_entity === 'NSW TrainLink'),
      'NSW TrainLink SOC response contains another entity',
    );
    assert(!('total_cents' in nswTrainlink.body), 'NSW TrainLink SOC response has a total_cents');
    const ntlByLine = new Map(nswTrainlink.body.series.map((row) => [row.soc_line_item, row]));
    assert(
      ntlByLine.get('total_expenses')?.amount_cents === 37774200000,
      'NSW TrainLink total expenses is not $377,742 thousand in cents',
    );
    assert(
      ntlByLine.get('total_revenue')?.amount_cents === 9708000000,
      'NSW TrainLink total revenue is not $97,080 thousand in cents',
    );
    assert(
      ntlByLine.get('employee_expenses')?.amount_cents === 14091100000,
      'NSW TrainLink employee expenses is not $140,911 thousand in cents',
    );
    assert(
      ntlByLine.get('depreciation_amortisation')?.amount_cents === 3541900000,
      'NSW TrainLink depreciation/amortisation is not $35,419 thousand in cents',
    );
    assert(
      ntlByLine.get('government_grants')?.amount_cents === 39536600000 &&
        ntlByLine.get('government_grants')?.potential_double_count === true,
      'NSW TrainLink grants row is not $395,366 thousand with potential_double_count',
    );
    assert(
      ntlByLine.get('net_result')?.amount_cents === 11381700000 &&
        ntlByLine.get('net_result')?.soc_printed_sign === 'positive',
      'NSW TrainLink net result is not the printed $113,817 thousand surplus',
    );
    assert(
      ntlByLine.get('total_expenses')?.potential_double_count === false &&
        ntlByLine.get('net_result')?.potential_double_count === false,
      'NSW TrainLink own-source rows are incorrectly flagged as potential double counts',
    );

    const generic = await getJson('/api/spending?limit=5');
    assert(generic.status === 200, `generic spending expected 200, got ${generic.status}`);
    const genericRows = generic.body?.data ?? generic.body?.measures ?? [];
    assert(
      !genericRows.some((row) => row.jurisdiction_level === 'soc'),
      'generic spending returned SOC entity rows',
    );
    const explicit = await getJson('/api/spending?jurisdiction_level=soc');
    assert(
      explicit.status === 400,
      `explicit SOC generic query expected 400, got ${explicit.status}`,
    );
    return '99 rows in the default 2024-25 SOC view (Sydney Water 10, WaterNSW 47 incl. 39 note/capex rows, Hunter Water 6, Essential Energy 6, Forestry Corporation 7, Landcom 6, Port Authority of NSW 5, Sydney Trains 6, NSW TrainLink 6) plus 6 separate FY2023-24 TAHE rows, $’000/$M, exact total expenses 2,949,540, 472,831, 418,326, 2,042.7, 384,532, 213,995, 190,953, 5,376,430, 377,742 and 1,722,046, no total, excluded from generic spending';
  });

  await check('ABS GFS benchmark is separate and never totalled', async () => {
    const benchmark = await getJson('/api/benchmark?fiscal_year=2024-25');
    assert(benchmark.status === 200, `expected 200, got ${benchmark.status}`);
    assert(benchmark.body?.source?.source_id === 'abs-gfs', 'benchmark source is not abs-gfs');
    assert(benchmark.body?.source?.unit === '$m', 'benchmark unit is not $m');
    assert(benchmark.body?.source?.unit_to_cents === 100000000, 'benchmark scale is wrong');
    assert(!('total_cents' in benchmark.body), 'benchmark response has a total_cents');
    assert(
      Array.isArray(benchmark.body?.series) && benchmark.body.series.length > 0,
      'no benchmark series',
    );
    assert(
      benchmark.body.series.every(
        (row) => row.verified === true && row.data_quality_flag === 'verified',
      ),
      'benchmark rows are not verified official aggregates',
    );
    assert(
      benchmark.body.series.every((row) => !('total_cents' in row)),
      'benchmark series carries a total',
    );
    const spending = await getJson('/api/spending?function=07&measure_type=actual');
    assert(spending.status === 200, `spending expected 200, got ${spending.status}`);
    assert(
      !spending.body.data.some((row) => row.source_id === 'abs-gfs'),
      'generic spending query returned ABS GFS benchmark rows',
    );
    return `${benchmark.body.series.length} benchmark cells, no combined total, excluded from /api/spending`;
  });

  return { regionId, populatedRegionId };
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
    assert(
      /Unverified|Verified/.test(text),
      `${label} row ${index + 1} has no verification status`,
    );
  }
  return `${count} rows`;
}

async function uiChecks(page, regionId, populatedRegionId) {
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
    '/benchmark',
    '/soc',
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
    // The default summary scans the whole non-benchmark/non-SOC set (682k rows,
    // excluding the historical AIHW matrix). On 2026-11-17 the page issued two
    // sequential summary requests (dev StrictMode) of ~11.6s and ~22.1s, with
    // the mixed warning visible at ~22.6s. Allow 35s: this is the existing
    // summary endpoint, not a hidden or bypassed check.
    await page.getByTestId('mixed-warning').waitFor({ state: 'visible', timeout: 35_000 });
    const warning = await page.getByTestId('mixed-warning').innerText();
    assert(/Mixed populations/.test(warning), 'mixed warning title missing');
    assert(/no headline total/i.test(warning), 'mixed warning does not withhold the total');
    assert((await page.getByTestId('headline-total').count()) === 0, 'headline total is visible');
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return 'warning visible, headline-total count=0';
  });

  await check('/search single measure type shows a headline total', async () => {
    pageErrors.length = 0;
    await page.goto(
      `${WEB_URL}/search?measure_type=actual&fiscal_year=2024-25&jurisdiction_level=state`,
      {
        waitUntil: 'domcontentloaded',
      },
    );
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

  await check(
    'charity expenses are labelled and never combined with government totals',
    async () => {
      pageErrors.length = 0;
      await page.goto(`${WEB_URL}/search?jurisdiction_level=charity&expense_category=total`, {
        waitUntil: 'domcontentloaded',
      });
      const categories = page.getByTestId('charity-expense-categories');
      await categories.waitFor({ state: 'visible', timeout: 20_000 });
      const text = await categories.innerText();
      assert(/not government spending/i.test(text), 'charity caveat is missing');
      assert(/never added together/i.test(text), 'charity no-sum label is missing');
      assert(/Headline total/.test(text), 'charity total label is missing');
      assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);

      const all = await getJson('/api/spending?jurisdiction_level=charity');
      const summary = all.body.summary;
      const totalCategory = summary.expense_categories.find(
        (entry) => entry.expense_category === 'total',
      );
      assert(totalCategory, 'charity total category is missing');
      assert(
        summary.total_cents === totalCategory.total_cents,
        'charity headline does not equal the total category',
      );
      assert(
        summary.total_by_measure_type.length === 1 &&
          summary.total_by_measure_type[0].total_cents === totalCategory.total_cents,
        'charity per-type total does not equal the total category',
      );
      const componentTotal = summary.expense_categories
        .filter((entry) => entry.expense_category !== 'total')
        .reduce((sum, entry) => sum + entry.total_cents, 0);
      assert(
        summary.total_cents !== totalCategory.total_cents + componentTotal,
        'charity total was double counted with its components',
      );

      const mixed = await getJson('/api/spending?measure_type=actual&fiscal_year=2024-25');
      assert(mixed.body.summary.mixed === true, 'charity + government actual is not marked mixed');
      assert(
        mixed.body.summary.total_cents === null,
        'charity + government query has a combined total',
      );
      assert(
        mixed.body.summary.total_by_measure_type.length === 0,
        'charity + government query has a combined per-type total',
      );
      return `${summary.count} charity rows; total != total + components; mixed total withheld`;
    },
  );

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
    await page.goto(
      `${WEB_URL}/search?measure_type=actual&fiscal_year=2024-25&jurisdiction_level=state`,
      {
        waitUntil: 'domcontentloaded',
      },
    );
    await page.getByTestId('spending-rows').waitFor({ state: 'visible', timeout: 20_000 });
    const rows = await assertRowProvenance(
      page.locator('[data-testid="spending-rows"] tbody tr'),
      'search rows',
    );
    const perType = await page.getByTestId('spending-per-type-totals').innerText();
    assert(/Provenance:/.test(perType), 'per-type totals have no provenance footer');
    assert(
      /synthetic-seed|aus-tender|data-gov-au-pbs|nsw-budget|data-nsw-ckan|dubbo-council|vic-budget|grantconnect|acnc-charity/.test(
        perType,
      ),
      'per-type totals footer has no known source id',
    );
    const headline = await page.getByTestId('headline-total').innerText();
    assert(/Provenance:/.test(headline), 'headline total has no provenance footer');
    assert(
      /synthetic-seed|aus-tender|data-gov-au-pbs|nsw-budget|data-nsw-ckan|dubbo-council|vic-budget|grantconnect|acnc-charity/.test(
        headline,
      ),
      'headline total footer has no known source id',
    );
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
    await page.getByTestId('function-measure-rows').waitFor({ state: 'visible', timeout: 20_000 });
    const measureRows = await assertRowProvenance(
      page.locator('[data-testid="function-measure-rows"] tbody tr'),
      'function rows',
    );
    const ranked = page.getByTestId('ranked-states-table');
    if ((await ranked.count()) === 0) {
      return `${measureRows}; no ranked-states table (no real region-tagged actual rows)`;
    }
    await ranked.waitFor({ state: 'visible', timeout: 20_000 });
    const rows = await assertRowProvenance(
      page.locator('[data-testid="ranked-states-table"] tbody tr'),
      'ranked state rows',
    );
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return `${rows}; ${measureRows}`;
  });

  await check(`/regions/${populatedRegionId} rows carry provenance`, async () => {
    await page.goto(`${WEB_URL}/regions/${populatedRegionId}`, { waitUntil: 'domcontentloaded' });
    const areaProfile = page.getByTestId('area-profile');
    const byFunction = page.getByTestId('by-function-table');
    const emptyState = page.getByTestId('empty-state');
    await page
      .locator(
        '[data-testid="area-profile"], [data-testid="by-function-table"], [data-testid="empty-state"]',
      )
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    if ((await emptyState.count()) > 0) {
      return 'no real rows for this region (explicit empty state)';
    }
    const usesAreaProfile = (await areaProfile.count()) > 0;
    const rows = await assertRowProvenance(
      page.locator('[data-testid="region-measure-rows"] tbody tr'),
      'region rows',
    );
    let functionRows = 'area profile panels';
    if (!usesAreaProfile) {
      await byFunction.waitFor({ state: 'visible', timeout: 20_000 });
      functionRows = await assertRowProvenance(
        page.locator('[data-testid="by-function-table"] tbody tr'),
        'by-function rows',
      );
    }
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return `${rows}; ${functionRows}`;
  });

  await check('/data-sources shows source register and connector statuses', async () => {
    pageErrors.length = 0;
    await page.goto(`${WEB_URL}/data-sources`, { waitUntil: 'domcontentloaded' });
    const coverageMeta = await getJson('/api/meta/coverage');
    assert(coverageMeta.status === 200, 'meta/coverage unavailable for source expectation');
    const syntheticExpected = coverageMeta.body?.synthetic === true;
    const source = page.getByTestId('source-synthetic-seed');
    const syntheticPresent = (await source.count()) > 0;
    assert(
      syntheticPresent === syntheticExpected,
      `source register synthetic card=${syntheticPresent} but coverage.synthetic=${syntheticExpected}`,
    );
    if (syntheticPresent) {
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
    }

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
      'dubbo-council-gpfs',
      'city-of-sydney-gpfs',
      'blacktown-gpfs',
      'parramatta-gpfs',
      'northern-beaches-gpfs',
      'canterbury-bankstown-gpfs',
      'sutherland-shire-gpfs',
      'wollongong-gpfs',
      'newcastle-gpfs',
      'lake-macquarie-gpfs',
      'maitland-gpfs',
      'coffs-harbour-gpfs',
      'mid-coast-gpfs',
      'port-macquarie-hastings-gpfs',
      'tweed-shire-gpfs',
      'shoalhaven-gpfs',
      'shellharbour-gpfs',
      'waverley-gpfs',
      'willoughby-gpfs',
      'inner-west-gpfs',
      'bayside-gpfs',
      'randwick-gpfs',
      'ryde-gpfs',
      'north-sydney-gpfs',
      'canada-bay-gpfs',
      'cumberland-gpfs',
      'georges-river-gpfs',
      'fairfield-gpfs',
      'grantconnect',
      'sydney-water',
      'hunter-water',
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

    const limitationsLink = page.getByRole('link', { name: 'coverage limitations page' });
    await limitationsLink.waitFor({ state: 'visible', timeout: 20_000 });
    assert(
      (await limitationsLink.getAttribute('href')) === '/coverage-limitations',
      'the data-sources limitations link does not point at /coverage-limitations',
    );
    await page.goto(`${WEB_URL}/coverage-limitations`, { waitUntil: 'domcontentloaded' });
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
      /GrantConnect is a manual/.test(limitationText),
      'coverage limitations do not mention the manual GrantConnect export',
    );
    assert(
      (await page.getByTestId('coverage-limitations').count()) === 1,
      'the coverage limitations list is duplicated on /coverage-limitations',
    );
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return `source Unverified, ${expectedStubs} stubs, ${expectedActive} active (incl. Dubbo), PBS caveat, limitations on /coverage-limitations`;
  });

  await check('/benchmark labels ABS GFS as a benchmark and never sums', async () => {
    pageErrors.length = 0;
    await page.goto(`${WEB_URL}/benchmark`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('benchmark-caveat').waitFor({ state: 'visible', timeout: 20_000 });
    const caveat = (await page.getByTestId('benchmark-caveat').innerText()).replace(/\s+/g, ' ');
    assert(/benchmark/i.test(caveat), 'benchmark caveat is missing');
    assert(/never add/i.test(caveat), 'benchmark caveat does not forbid adding project data');
    const table = page.getByTestId('benchmark-series');
    await table.waitFor({ state: 'visible', timeout: 20_000 });
    const text = (await table.innerText()).replace(/\s+/g, ' ');
    assert(/abs-gfs/.test(text), 'benchmark rows have no abs-gfs source id');
    assert(/Verified/.test(text), 'benchmark rows are not marked Verified');
    assert(!/Total/.test(text), 'benchmark table shows a total');
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return 'caveat visible, verified abs-gfs rows, no total';
  });

  await check('/benchmark shows PNFC as a separate sector aggregate with no total', async () => {
    pageErrors.length = 0;
    await page.goto(`${WEB_URL}/benchmark#pnfc`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('pnfc-benchmark-caveat').waitFor({ state: 'visible', timeout: 20_000 });
    const caveat = (await page.getByTestId('pnfc-benchmark-caveat').innerText()).replace(
      /\s+/g,
      ' ',
    );
    assert(/sector aggregate/i.test(caveat), 'PNFC caveat does not call it a sector aggregate');
    assert(/never add/i.test(caveat), 'PNFC caveat does not forbid adding project/entity data');
    const table = page.getByTestId('pnfc-benchmark-series');
    await table.waitFor({ state: 'visible', timeout: 20_000 });
    const text = (await table.innerText()).replace(/\s+/g, ' ');
    assert(/abs-gfs-pnfc/.test(text), 'PNFC rows have no abs-gfs-pnfc source id');
    assert(/Verified/.test(text), 'PNFC rows are not marked Verified');
    assert(!/combined total/i.test(text), 'PNFC table shows a combined total');
    assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
    return 'sector-aggregate caveat visible, verified PNFC rows, no combined total';
  });

  await check(
    '/soc shows entity-level SOC rows with unit, unverified and double-count warning',
    async () => {
      pageErrors.length = 0;
      await page.goto(`${WEB_URL}/soc`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('soc-caveat').waitFor({ state: 'visible', timeout: 20_000 });
      const caveat = (await page.getByTestId('soc-caveat').innerText()).replace(/\s+/g, ' ');
      assert(/never add/i.test(caveat), 'SOC caveat does not forbid adding to government spending');
      assert(
        /government program spending/i.test(caveat),
        'SOC caveat does not mention government spending',
      );
      const sourceCard = page.getByTestId('soc-source');
      await sourceCard.waitFor({ state: 'visible', timeout: 20_000 });
      const sourceText = (await sourceCard.innerText()).replace(/\s+/g, ' ');
      assert(/AUD_thousands/.test(sourceText), 'SOC unit badge is missing');
      assert(/Sydney Water/i.test(sourceText), 'SOC entity is not shown');
      const table = page.getByTestId('soc-series');
      await table.waitFor({ state: 'visible', timeout: 20_000 });
      const text = (await table.innerText()).replace(/\s+/g, ' ');
      assert(/Total expenses/i.test(text), 'SOC table has no total-expenses line');
      assert(/Unverified/.test(text), 'SOC rows are not marked Unverified');
      assert(/potential double count/i.test(text), 'SOC table has no double-count warning chip');
      assert(!/combined total/i.test(text), 'SOC table claims a combined total');
      assert(pageErrors.length === 0, `pageErrors: ${pageErrors.join(' | ')}`);
      return 'SOC entity caveat, $’000 unit, unverified rows, double-count warning, no total';
    },
  );
}

async function main() {
  console.log(`ausspend live provenance audit`);
  console.log(`web: ${WEB_URL}`);
  console.log(`api: ${API_URL}\n`);

  const { regionId, populatedRegionId } = await apiChecks();

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await uiChecks(page, regionId, populatedRegionId);
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
