import { existsSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  LGPRF_ATTRIBUTION,
  LGPRF_CAVEAT,
  LGPRF_DATASET_PAGE,
  LGPRF_EXPECTED_SHA256,
  LGPRF_EXPECTED_TOTAL_ROWS,
  LGPRF_FISCAL_YEARS,
  LGPRF_ID,
  LGPRF_INDICATORS_2020_23,
  LGPRF_INDICATORS_2023_25,
  LGPRF_INDICATOR_UNITS,
  LGPRF_LICENSE,
  LGPRF_RETRIEVAL_URL,
  LGPRF_YEAR_SPECS,
  assertLgprfPremise,
  buildLgprfRecords,
  lgprfCouncilName,
  lgprfManifest,
  lgprfNaturalKey,
  mapLgprfRaw,
  parseLgprfWorkbook,
  transformLgprfRaw,
  type LgprfRaw,
} from '../src/connectors/vic-lgprf.js';
import { readLgprfFile, readLgprfWorkbook } from '../src/connectors/vic-lgprf.js';

const COUNCIL_LABELS = [
  'Alpine Shire',
  'Ararat Rural City',
  'Ballarat City',
  'Banyule City',
  'Bass Coast Shire',
  'Baw Baw Shire',
  'Bayside City',
  'Benalla Rural City',
  'Boroondara City',
  'Borough of Queenscliffe',
  'Brimbank City',
  'Buloke Shire',
  'Campaspe Shire',
  'Cardinia Shire',
  'Casey City',
  'Central Goldfields Shire',
  'Colac Otway Shire',
  'Corangamite Shire',
  'Darebin City',
  'East Gippsland Shire',
  'Frankston City',
  'Gannawarra Shire',
  'Glen Eira City',
  'Glenelg Shire',
  'Golden Plains Shire',
  'Greater Bendigo City',
  'Greater Dandenong City',
  'Greater Geelong City',
  'Greater Shepparton',
  'Hepburn Shire',
  'Hindmarsh Shire',
  'Hobsons Bay City',
  'Horsham Rural City',
  'Hume City',
  'Indigo Shire',
  'Kingston City',
  'Knox City',
  'Latrobe City',
  'Loddon Shire',
  'Macedon Ranges Shire',
  'Manningham City',
  'Mansfield Shire',
  'Maribyrnong City',
  'Maroondah City',
  'Melbourne City',
  'Melton City',
  'Merri-bek City',
  'Mildura Rural City',
  'Mitchell Shire',
  'Moira Shire',
  'Monash City',
  'Moonee Valley City',
  'Moorabool Shire',
  'Mornington Peninsula Shire',
  'Mount Alexander Shire',
  'Moyne Shire',
  'Murrindindi Shire',
  'Nillumbik Shire',
  'Northern Grampians Shire',
  'Port Phillip City',
  'Pyrenees Shire',
  'South Gippsland Shire',
  'Southern Grampians Shire',
  'Stonnington City',
  'Strathbogie Shire',
  'Surf Coast Shire',
  'Swan Hill Rural City',
  'Towong Shire',
  'Wangaratta Rural City',
  'Warrnambool City',
  'Wellington Shire',
  'West Wimmera Shire',
  'Whitehorse City',
  'Whittlesea City',
  'Wodonga City',
  'Wyndham City',
  'Yarra City',
  'Yarra Ranges Shire',
  'Yarriambiack Shire',
];

function setCell(
  sheet: ExcelJS.Worksheet,
  row: number,
  column: number,
  value: string | number | null,
): void {
  sheet.getRow(row).getCell(column).value = value;
}

async function buildSyntheticWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const disclaimer = workbook.addWorksheet('Data Access Disclaimer');
  setCell(disclaimer, 1, 1, 'LOCAL GOVERNMENT PERFORMANCE REPORTING FRAMEWORK');
  for (const spec of LGPRF_YEAR_SPECS) {
    const sheet = workbook.addWorksheet(spec.sheet);
    const headers = [
      'Council',
      'Group',
      'ID',
      'Description',
      'Service Provided',
      'Data applicable?',
      'Result',
      'Variation',
    ];
    headers.forEach((header, index) => setCell(sheet, 1, index + 1, header));
    let row = 2;
    for (let councilIndex = 0; councilIndex < COUNCIL_LABELS.length; councilIndex += 1) {
      for (let indicatorIndex = 0; indicatorIndex < spec.indicators.length; indicatorIndex += 1) {
        const indicator = spec.indicators[indicatorIndex]!;
        const ordinal = row - 2;
        const isBlank = ordinal < spec.expected_blank_results;
        const isNoData = ordinal < spec.expected_no_data_rows;
        setCell(sheet, row, 1, COUNCIL_LABELS[councilIndex]!);
        setCell(sheet, row, 2, 'Small Shire');
        setCell(sheet, row, 3, indicator);
        setCell(sheet, row, 4, `${indicator} published description`);
        setCell(sheet, row, 5, 'YES');
        setCell(sheet, row, 6, isNoData ? 'No data' : 'Applicable');
        if (!isBlank) {
          setCell(sheet, row, 7, isNoData ? 0 : councilIndex + indicatorIndex + 0.5);
        }
        setCell(sheet, row, 8, '');
        row += 1;
      }
    }
  }
  return workbook;
}

const REAL_ARCHIVE = path.join(
  process.env.HOME ?? '',
  'ausspend-source-archive',
  'vic-lgprf',
  'LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx',
);

describe('LGPRF council naming', () => {
  it('expands ordinary and exceptional workbook labels to platform council names', () => {
    expect(lgprfCouncilName('Alpine Shire')).toBe('Alpine Shire Council');
    expect(lgprfCouncilName('Ararat Rural City')).toBe('Ararat Rural City Council');
    expect(lgprfCouncilName('Ballarat City')).toBe('Ballarat City Council');
    expect(lgprfCouncilName('Borough of Queenscliffe')).toBe('Borough of Queenscliffe');
    expect(lgprfCouncilName('Greater Shepparton')).toBe('Greater Shepparton City Council');
    expect(lgprfCouncilName('Colac-Otway Shire')).toBe('Colac Otway Shire Council');
    expect(lgprfCouncilName('Moreland City')).toBe('Moreland City Council');
    expect(lgprfCouncilName('Not a council')).toBeNull();
  });

  it('maps every workbook label with no duplicates', () => {
    const mapped = COUNCIL_LABELS.map((label) => lgprfCouncilName(label));
    expect(mapped.every((name): name is string => Boolean(name))).toBe(true);
    expect(new Set(mapped).size).toBe(79);
  });
});

describe('LGPRF parse and premise', { timeout: 30_000 }, () => {
  it('parses 79 councils, 58/59 indicators and 23,068 rows from a full-shaped workbook', async () => {
    const workbook = await buildSyntheticWorkbook();
    const parsed = parseLgprfWorkbook(workbook);
    expect(() => assertLgprfPremise(parsed)).not.toThrow();
    expect(parsed.years.map((year) => year.fiscal_year)).toEqual([...LGPRF_FISCAL_YEARS]);
    expect(parsed.years.map((year) => year.councils.length)).toEqual([79, 79, 79, 79, 79]);
    expect(parsed.years.map((year) => year.indicator_codes.length)).toEqual([58, 58, 58, 59, 59]);
    expect(parsed.years.map((year) => year.rows.length)).toEqual([
      4_582, 4_582, 4_582, 4_661, 4_661,
    ]);
    expect(parsed.total_rows).toBe(LGPRF_EXPECTED_TOTAL_ROWS);
    expect(LGPRF_INDICATORS_2020_23).toHaveLength(58);
    expect(LGPRF_INDICATORS_2023_25).toHaveLength(59);
    expect(LGPRF_INDICATOR_UNITS.C1).toBe('AUD per person');
    expect(LGPRF_INDICATOR_UNITS.AM2).toBe('percentage (0-1 fraction)');
    expect(LGPRF_INDICATOR_UNITS.WC1).toBe('requests per 1,000 kerbside collection households');
    expect(Object.keys(LGPRF_INDICATOR_UNITS)).toHaveLength(62);
  });

  it('rejects a missing council row (premise falsifier)', async () => {
    const workbook = await buildSyntheticWorkbook();
    const sheet = workbook.getWorksheet('Indicators 2024-25')!;
    for (let column = 1; column <= 8; column += 1) {
      sheet.getRow(2).getCell(column).value = null;
    }
    const parsed = parseLgprfWorkbook(workbook);
    expect(() => assertLgprfPremise(parsed)).toThrow(/councils|rows/);
  });

  it('does not zero-fill a blank published Result', async () => {
    const workbook = await buildSyntheticWorkbook();
    const parsed = parseLgprfWorkbook(workbook);
    const firstYear = parsed.years[0]!;
    const blankRows = firstYear.rows.filter((row) => row.result === null);
    expect(blankRows).toHaveLength(43);
    expect(blankRows.every((row) => /no data/i.test(row.data_applicable))).toBe(true);
    const noDataZeroRows = parsed.years[2]!.rows.filter(
      (row) => row.result === 0 && /no data/i.test(row.data_applicable),
    );
    expect(noDataZeroRows).toHaveLength(43);
  });
});

describe('LGPRF financial boundary', () => {
  it('has no total-dollar income/expense indicator; every AUD unit is a per-unit rate', () => {
    const units = Object.values(LGPRF_INDICATOR_UNITS);
    expect(units).not.toContain('AUD');
    expect(
      units.some((unit) => /total.*(income|expense)|(income|expense).*total/i.test(unit)),
    ).toBe(false);
    const audUnits = units.filter((unit) => /^AUD/i.test(unit));
    expect(audUnits.length).toBeGreaterThan(0);
    expect(audUnits.every((unit) => /^AUD per /.test(unit))).toBe(true);
  });

  it('stores every performance value as a non-monetary performance row', async () => {
    const built = await buildLgprfRecords(await buildSyntheticWorkbook());
    expect(built.records).toHaveLength(LGPRF_EXPECTED_TOTAL_ROWS);
    expect(built.records.every((record) => record.amount_cents === 0)).toBe(true);
    expect(built.records.every((record) => record.performance_non_additive === true)).toBe(true);
    expect(built.records.every((record) => record.performance_unit !== 'AUD')).toBe(true);
  });
});

describe('LGPRF transform and no-sum semantics', { timeout: 30_000 }, () => {
  async function records() {
    const workbook = await buildSyntheticWorkbook();
    const built = await buildLgprfRecords(workbook);
    return built;
  }

  it('emits one non-additive row per council x year x indicator', async () => {
    const built = await records();
    expect(built.records).toHaveLength(LGPRF_EXPECTED_TOTAL_ROWS);
    expect(new Set(built.records.map((record) => record.natural_key)).size).toBe(
      LGPRF_EXPECTED_TOTAL_ROWS,
    );
    for (const record of built.records) {
      expect(record.source_id).toBe(LGPRF_ID);
      expect(record.measure_type).toBe('actual');
      expect(record.jurisdiction_level).toBe('local');
      expect(record.jurisdiction).toBe('VIC');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.performance_non_additive).toBe(true);
      expect(record.amount_cents).toBe(0);
      expect(record.performance_unit).toBeTruthy();
      expect(record.natural_key).toBeTruthy();
      expect(record.notes).toContain('CC BY 4.0');
      expect(record.notes).toContain('NON-ADDITIVE');
    }
    expect(built.records.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(0);
    expect(new Set(built.records.map((record) => record.delivery_entity)).size).toBe(79);
    const byYear = new Map<string, number>();
    for (const record of built.records) {
      byYear.set(record.fiscal_year, (byYear.get(record.fiscal_year) ?? 0) + 1);
    }
    expect([...byYear.entries()].sort()).toEqual([
      ['2020-21', 4_582],
      ['2021-22', 4_582],
      ['2022-23', 4_582],
      ['2023-24', 4_661],
      ['2024-25', 4_661],
    ]);
  });

  it('preserves units and blank values without coercion', async () => {
    const built = await records();
    const c1 = built.records.find(
      (record) =>
        record.performance_indicator_code === 'C1' &&
        record.fiscal_year === '2024-25' &&
        record.delivery_entity === 'Alpine Shire Council',
    );
    expect(c1?.performance_unit).toBe('AUD per person');
    expect(typeof c1?.performance_value).toBe('number');
    expect(c1?.amount_cents).toBe(0);
    const am2 = built.records.find(
      (record) => record.performance_indicator_code === 'AM2' && record.fiscal_year === '2024-25',
    );
    expect(am2?.performance_unit).toBe('percentage (0-1 fraction)');
    const blank = built.records.find(
      (record) => record.fiscal_year === '2020-21' && record.performance_value === undefined,
    );
    expect(blank).toBeTruthy();
    expect(blank).not.toHaveProperty('performance_value');
    const publishedZero = built.records.find(
      (record) =>
        record.fiscal_year === '2024-25' &&
        record.performance_value === 0 &&
        /no data/i.test(record.performance_data_applicable ?? ''),
    );
    expect(publishedZero).toBeTruthy();
  });

  it('is idempotent on natural_key and keeps licence/attribution metadata', async () => {
    const built = await records();
    const second = transformLgprfRaw(built.raw);
    expect(second.duplicates).toBe(0);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      built.records.map((record) => record.natural_key),
    );
    expect(LGPRF_LICENSE).toContain('CC BY 4.0');
    expect(LGPRF_ATTRIBUTION).toContain('Local Government Victoria');
    expect(LGPRF_CAVEAT).toContain('Non-additive');
    expect(LGPRF_RETRIEVAL_URL).toContain('web.archive.org');
    expect(LGPRF_EXPECTED_SHA256).toHaveLength(64);
    expect(LGPRF_DATASET_PAGE).toContain('discover.data.vic.gov.au');
  });

  it('builds a stable natural key that includes year, council and indicator', () => {
    const a = lgprfNaturalKey(['2024-25', 'Alpine Shire Council', 'C1']);
    const b = lgprfNaturalKey(['2024-25', 'Alpine Shire Council', 'C1']);
    const differentYear = lgprfNaturalKey(['2023-24', 'Alpine Shire Council', 'C1']);
    const differentCouncil = lgprfNaturalKey(['2024-25', 'Ararat Rural City Council', 'C1']);
    const differentIndicator = lgprfNaturalKey(['2024-25', 'Alpine Shire Council', 'C2']);
    expect(a).toBe(b);
    expect(new Set([a, differentYear, differentCouncil, differentIndicator]).size).toBe(4);
    expect(a.startsWith('vic-lgprf:')).toBe(true);
  });

  it('stores a textual result without coercing it to a number', () => {
    const raw: LgprfRaw = {
      kind: 'indicator',
      fiscal_year: '2024-25',
      sheet: 'Indicators 2024-25',
      council_label: 'Alpine Shire',
      council_name: 'Alpine Shire Council',
      group: 'Small Shire',
      indicator_code: 'AM1',
      indicator_name: 'Time taken to action animal management requests',
      service_provided: 'YES',
      data_applicable: 'Applicable',
      result: null,
      result_text: 'less than 2',
      unit: 'days',
      source_url: 'https://example.test/lgprf',
      dataset_page: 'https://example.test/dataset',
      resource_url: 'https://example.test/workbook.xlsx',
      retrieval_url: 'https://example.test/wayback/workbook.xlsx',
      source_sha256: 'a'.repeat(64),
      source_date: '2025-11-05',
      dataset: 'test',
    };
    const record = mapLgprfRaw(raw);
    expect(record.performance_value).toBeUndefined();
    expect(record.performance_value_text).toBe('less than 2');
    expect(record.amount_cents).toBe(0);
  });
});

describe('LGPRF real archived workbook', { timeout: 30_000 }, () => {
  it.skipIf(!existsSync(REAL_ARCHIVE))(
    'matches the documented SHA-256 and parses the official 2020-25 full set',
    async () => {
      const bytes = await readLgprfFile(REAL_ARCHIVE);
      const { createHash } = await import('node:crypto');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(LGPRF_EXPECTED_SHA256);
      const workbook = await readLgprfWorkbook(REAL_ARCHIVE);
      const built = await buildLgprfRecords(workbook);
      expect(built.parsed.years.map((year) => year.councils.length)).toEqual([79, 79, 79, 79, 79]);
      expect(built.parsed.years.map((year) => year.indicator_codes.length)).toEqual([
        58, 58, 58, 59, 59,
      ]);
      expect(built.records).toHaveLength(LGPRF_EXPECTED_TOTAL_ROWS);
      const manifest = lgprfManifest(built.parsed, {
        sha256: LGPRF_EXPECTED_SHA256,
        bytes: bytes.length,
      });
      expect(manifest.rows_emitted).toBe(LGPRF_EXPECTED_TOTAL_ROWS);
      expect(manifest.non_additive).toBe(true);
      expect(manifest.distinct_council_names_across_years).toBe(80);
    },
  );
});
