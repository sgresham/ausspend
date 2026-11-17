import { describe, expect, it } from 'vitest';
import {
  FAG_2023_24_REPORT,
  FAG_2024_25_REPORT,
  FAG_ATTRIBUTION,
  FAG_COUNCIL_LABELS,
  FAG_ID,
  FAG_LICENSE,
  FAG_MEASURE,
  FAG_REPORT_LICENCE_VERBATIM,
  FAG_VLGGC_CONDITIONS_OF_USE,
  assertFagPremise,
  buildFagRaw,
  fagCouncilName,
  fagManifest,
  fagNaturalKey,
  parseFag2023_24Estimate,
  parseFag2023_24Final,
  parseFag2024_25Estimate,
  reconcileFag2023_24,
  transformFagRaw,
  type FagParsedYear,
} from '../src/connectors/vic-vlgc-fag.js';

const TOTAL_2024_25 = 789_162_301;
const TOTAL_2023_24_ESTIMATE = 747_377_237;
const TOTAL_2023_24_FINAL = 748_241_357;
const TOTAL_2023_24_DIFFERENCE = 864_120;

const ND24 = new Set([
  'Ararat RC',
  'Baw Baw S',
  'Central Goldfields S',
  'East Gippsland S',
  'Gannawarra S',
  'Greater Bendigo C',
  'Hepburn S',
  'Hume C',
  'Latrobe C',
  'Loddon S',
  'Macedon Ranges S',
  'Mitchell S',
  'Moorabool S',
  'Moyne S',
  'Murrindindi S',
  'South Gippsland S',
  'Wellington S',
]);
const ND23 = new Set([
  'Baw Baw S',
  'East Gippsland S',
  'Mansfield S',
  'Moorabool S',
  'South Gippsland S',
  'Wellington S',
]);

function splitTotal(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function fmt(value: number): string {
  return value.toLocaleString('en-AU');
}

function build2024Text(): string {
  const totals = splitTotal(TOTAL_2024_25, FAG_COUNCIL_LABELS.length);
  const rows: string[] = [];
  let eqTotal = 0;
  let ndTotal = 0;
  let lrTotal = 0;
  let dpTotal = 0;
  FAG_COUNCIL_LABELS.forEach((label, index) => {
    const total = totals[index]!;
    const localRoads = 1_000 + index;
    const dataProject = 2_000 + index;
    const naturalDisaster = ND24.has(label) ? 500 : 0;
    const equalisation = total - localRoads - dataProject - naturalDisaster;
    eqTotal += equalisation;
    ndTotal += naturalDisaster;
    lrTotal += localRoads;
    dpTotal += dataProject;
    rows.push(
      ND24.has(label)
        ? `${label} ${fmt(equalisation)} ${fmt(naturalDisaster)} ${fmt(localRoads)} ${fmt(dataProject)} ${fmt(total)}`
        : `${label} ${fmt(equalisation)} ${fmt(localRoads)} ${fmt(dataProject)} ${fmt(total)}`,
    );
  });
  return [
    'Appendix 2 2024-25 Allocations A. Estimated Allocations',
    'Financial Assistance Grants 2024-25',
    ...rows,
    `${fmt(eqTotal)} ${fmt(ndTotal)} ${fmt(lrTotal)} ${fmt(dpTotal)} ${fmt(TOTAL_2024_25)}`,
    'Appendix 2 2024-25 Allocations B. Payments',
  ].join('\n');
}

function build2023EstimateText(): string {
  const totals = splitTotal(TOTAL_2023_24_ESTIMATE, FAG_COUNCIL_LABELS.length);
  const rows: string[] = [];
  let eqTotal = 0;
  let ndTotal = 0;
  let gpTotal = 0;
  let lrTotal = 0;
  FAG_COUNCIL_LABELS.forEach((label, index) => {
    const total = totals[index]!;
    const localRoads = 1_000 + index;
    const naturalDisaster = ND23.has(label) ? 100 : 0;
    const gp = total - localRoads;
    const equalisation = gp - naturalDisaster;
    eqTotal += equalisation;
    ndTotal += naturalDisaster;
    gpTotal += gp;
    lrTotal += localRoads;
    rows.push(
      ND23.has(label)
        ? `${label} ${fmt(equalisation)} ${fmt(naturalDisaster)} ${fmt(gp)} ${fmt(localRoads)} ${fmt(total)}`
        : `${label} ${fmt(equalisation)} ${fmt(gp)} ${fmt(localRoads)} ${fmt(total)}`,
    );
  });
  return [
    'Appendix 2 2023-24 Allocations A. Estimated Allocations',
    'Financial Assistance Grants 2023-24',
    ...rows,
    `${fmt(eqTotal)} ${fmt(ndTotal)} ${fmt(gpTotal)} ${fmt(lrTotal)} ${fmt(TOTAL_2023_24_ESTIMATE)}`,
    'Appendix 2 2023-24 Allocations B. Payments',
  ].join('\n');
}

function build2023FinalText(): string {
  const estimates = splitTotal(TOTAL_2023_24_ESTIMATE, FAG_COUNCIL_LABELS.length);
  const differences = splitTotal(TOTAL_2023_24_DIFFERENCE, FAG_COUNCIL_LABELS.length);
  const first: string[] = [];
  const second: string[] = [];
  FAG_COUNCIL_LABELS.forEach((label, index) => {
    const initial = estimates[index]!;
    const difference = differences[index]!;
    const final = initial + difference;
    const line = `${label} ${fmt(initial)} ${fmt(final)} ${fmt(difference)}`;
    if (index < 40) first.push(line);
    else second.push(line);
  });
  return [
    '2023-24 Final Grant Allocations Appendix 1 Financial Assistance Grants',
    'Initial ($) Final ($) Difference ($)',
    ...first,
    'Page 40 Victorian Local Government Grants Commission – Allocation Report 2024-25 OFFICIAL OFFICIAL',
    'Page 41 OFFICIAL OFFICIAL 2023-24 Final Grant Allocations Appendix 1 Financial Assistance Grants',
    ...second,
    `${fmt(TOTAL_2023_24_ESTIMATE)} ${fmt(TOTAL_2023_24_FINAL)} ${fmt(TOTAL_2023_24_DIFFERENCE)}`,
    'Appendix 2 2024-25 Allocations A. Estimated Allocations',
  ].join('\n');
}

function parseFixture(): {
  fy2024_25: FagParsedYear;
  fy2023_24_final: FagParsedYear;
  fy2023_24_estimate: FagParsedYear;
} {
  return {
    fy2024_25: parseFag2024_25Estimate(build2024Text()),
    fy2023_24_final: parseFag2023_24Final(build2023FinalText()),
    fy2023_24_estimate: parseFag2023_24Estimate(build2023EstimateText()),
  };
}

describe('VLGGC FAG allocation parser', () => {
  it('parses exactly 79 councils for each year, excludes Totals and reconciles to published totals', () => {
    const parsed = parseFixture();
    expect(parsed.fy2024_25.rows).toHaveLength(79);
    expect(parsed.fy2023_24_final.rows).toHaveLength(79);
    expect(parsed.fy2023_24_estimate.rows).toHaveLength(79);
    expect(parsed.fy2024_25.published_total_dollars).toBe(TOTAL_2024_25);
    expect(parsed.fy2023_24_final.published_total_dollars).toBe(TOTAL_2023_24_FINAL);
    expect(parsed.fy2023_24_estimate.published_total_dollars).toBe(TOTAL_2023_24_ESTIMATE);
    expect(parsed.fy2024_25.sum_dollars).toBe(TOTAL_2024_25);
    expect(parsed.fy2023_24_final.sum_dollars).toBe(TOTAL_2023_24_FINAL);
    expect(parsed.fy2023_24_estimate.sum_dollars).toBe(TOTAL_2023_24_ESTIMATE);
    for (const year of Object.values(parsed)) {
      expect(year.rows.every((row) => !/^totals?$/i.test(row.council_name))).toBe(true);
      expect(year.totals_suppressed).toBe(1);
    }
    assertFagPremise(parsed);
  });

  it('reconciles final FY2023-24 minus the September 2023 estimate to the printed $864,120 adjustment', () => {
    const parsed = parseFixture();
    const result = reconcileFag2023_24(parsed.fy2023_24_estimate, parsed.fy2023_24_final);
    expect(result.checked).toBe(79);
    expect(result.total_difference_dollars).toBe(TOTAL_2023_24_DIFFERENCE);
    for (const row of parsed.fy2023_24_final.rows) {
      expect(row.amount_dollars - (row.prior_estimate_dollars ?? 0)).toBe(
        row.published_difference_dollars,
      );
    }
  });

  it('expands the printed council labels to the exact official council names', () => {
    expect(fagCouncilName('Alpine S')).toBe('Alpine Shire Council');
    expect(fagCouncilName('Ararat RC')).toBe('Ararat Rural City Council');
    expect(fagCouncilName('Greater Bendigo C')).toBe('Greater Bendigo City Council');
    expect(fagCouncilName('Merri-bek C')).toBe('Merri-bek City Council');
    expect(fagCouncilName('Queenscliffe B')).toBe('Borough of Queenscliffe');
    const names = FAG_COUNCIL_LABELS.map((label) => fagCouncilName(label));
    expect(new Set(names).size).toBe(79);
    expect(names).toContain('Borough of Queenscliffe');
    expect(names).not.toContain('Moreland City Council');
  });

  it('fails the premise when a printed total does not match the council rows', () => {
    const parsed = parseFixture();
    const bad = {
      ...parsed,
      fy2024_25: { ...parsed.fy2024_25, published_total_dollars: TOTAL_2024_25 + 1 },
    };
    expect(() => assertFagPremise(bad)).toThrow(/printed total/i);
  });
});

describe('VLGGC FAG record transform', () => {
  it('emits 158 non-additive grant rows with exact funding source and no project/LGA allocation', () => {
    const parsed = parseFixture();
    const raw = buildFagRaw(parsed);
    expect(raw).toHaveLength(158);
    const records = transformFagRaw(raw).records;
    expect(records).toHaveLength(158);
    expect(records.filter((record) => record.fiscal_year === '2024-25')).toHaveLength(79);
    expect(records.filter((record) => record.fiscal_year === '2023-24')).toHaveLength(79);
    expect(new Set(records.map((record) => record.source_id))).toEqual(new Set([FAG_ID]));
    expect(new Set(records.map((record) => record.delivery_entity)).size).toBe(79);
    for (const record of records) {
      expect(record.measure_type).toBe('grant_award');
      expect(record.jurisdiction_level).toBe('local');
      expect(record.jurisdiction).toBe('VIC');
      expect(record.funding_source).toBe('Victorian Local Government Grants Commission');
      expect(record.vlgc_measure).toBe(FAG_MEASURE);
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.potential_double_count).toBe(true);
      expect(record.verified).toBe(false);
      expect(record.project_name).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.amount_cents).toBeGreaterThan(0);
    }
    expect(records.some((record) => /^totals?$/i.test(record.delivery_entity))).toBe(false);
  });

  it('uses fiscal-year natural keys and is idempotent', () => {
    const parsed = parseFixture();
    const raw = buildFagRaw(parsed);
    const first = transformFagRaw(raw);
    const second = transformFagRaw(raw);
    const duplicated = transformFagRaw([...raw, ...raw]);
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(new Set(first.records.map((record) => record.natural_key)).size).toBe(158);
    expect(duplicated.records).toHaveLength(158);
    expect(duplicated.duplicates).toBe(158);
    const alpine2024 = first.records.find(
      (record) =>
        record.delivery_entity === 'Alpine Shire Council' && record.fiscal_year === '2024-25',
    );
    const alpine2023 = first.records.find(
      (record) =>
        record.delivery_entity === 'Alpine Shire Council' && record.fiscal_year === '2023-24',
    );
    expect(alpine2024?.natural_key).not.toBe(alpine2023?.natural_key);
    expect(fagNaturalKey(['2024-25', 'Alpine Shire Council', FAG_MEASURE, 'estimated'])).toBe(
      fagNaturalKey(['2024-25', 'Alpine Shire Council', FAG_MEASURE, 'estimated']),
    );
  });

  it('publishes no component rows and no invented or cross-council total', () => {
    const records = transformFagRaw(buildFagRaw(parseFixture())).records;
    expect(records.every((record) => record.vlgc_measure === FAG_MEASURE)).toBe(true);
    expect(records.every((record) => record.vlgc_allocation_status !== undefined)).toBe(true);
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(records.some((record) => record.amount_cents === TOTAL_2024_25 * 100)).toBe(false);
    expect(records.some((record) => record.amount_cents === TOTAL_2023_24_FINAL * 100)).toBe(false);
    for (const record of records) {
      expect(record.notes).toMatch(/potential_double_count=true/);
      expect(record.notes).toMatch(/VGC1/);
      expect(record.notes).toMatch(/never add/i);
    }
  });

  it('records the report licence verbatim and does not claim only CC BY', () => {
    const parsed = parseFixture();
    const manifest = fagManifest(FAG_2024_25_REPORT, 'rows', parsed.fy2024_25, {
      rows_emitted: 79,
    });
    expect(manifest.license).toContain('Creative Commons Attribution 3.0 Australia');
    expect(manifest.license).toContain('NOT CC BY');
    expect(manifest.license).toContain(FAG_VLGGC_CONDITIONS_OF_USE);
    expect(manifest.license).toContain(FAG_REPORT_LICENCE_VERBATIM);
    expect(manifest.attribution).toBe(FAG_ATTRIBUTION);
    expect(manifest.sha256).toBe(FAG_2024_25_REPORT.sha256);
    expect(manifest.bytes).toBe(FAG_2024_25_REPORT.bytes);
    expect(FAG_2023_24_REPORT.sha256).toHaveLength(64);
    expect(FAG_LICENSE).toContain('not the CC BY 4.0');
  });
});
