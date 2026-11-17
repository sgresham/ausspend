import { describe, expect, it } from 'vitest';
import {
  detectSydneyTrainsUnit,
  parseSydneyTrainsAnnualReportPdfLinks,
  parseSydneyTrainsExtraction,
  parseSydneyTrainsStatement,
  selectSydneyTrainsAnnualReport,
  sydneyTrainsFiscalYearFromReportYear,
  sydneyTrainsNaturalKey,
  sydneyTrainsVolumeFromFilename,
  SYDNEY_TRAINS_ID,
  type SydneyTrainsParseContext,
} from '../src/connectors/soc/nsw/sydney-trains.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.transport.nsw.gov.au/system/files/media/documents/2025/sydney-trains-annual-report-2024%E2%80%9325-volume-2.pdf';

function item(str: string, x: number, y: number, page = 1, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 1): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const STATEMENT_RIGHTS = [466.4, 533.3];

function numberCell(value: number): string {
  const text = Math.abs(value).toLocaleString('en-AU');
  return value < 0 ? `(${text})` : text;
}

interface RowSpec {
  label: string;
  note?: string;
  values: Array<number | '-' | null>;
}

function statementPage(
  options: {
    unit?: string;
    draft?: boolean;
    totalExpensesOverride?: number;
    netResultOverride?: number;
  } = {},
): PdfPage {
  const unit = options.unit ?? "$'000";
  const draft = options.draft ?? true;
  const pageNumber = 6;
  const items: PdfTextItem[] = [
    item('Sydney Trains', 70.9, 787.9, pageNumber),
    item('Statement of comprehensive income', 70.9, 774.1, pageNumber),
    item('for the year ended 30 June 2025', 70.9, 760.7, pageNumber),
    item('Statement of comprehensive income', 70.9, 750.7, pageNumber),
    item('2025', 446.4, 707.9, pageNumber),
    item('2024', 513.2, 707.9, pageNumber),
    item('Notes', 374.7, 697.4, pageNumber),
    item(unit, 444.3, 697.4, pageNumber),
    item(unit, 511.2, 697.4, pageNumber),
    item('Revenue', 76.3, 673.7, pageNumber),
  ];
  const rows: RowSpec[] = [
    {
      label: 'Sale of goods and services from contracts with customers',
      note: '2(a)',
      values: [1_247_953, 1_715_301],
    },
    { label: 'Investment revenue', note: '2(b)', values: [69_173, 55_261] },
    { label: 'Major rail project revenue', note: '2(d)', values: [434_663, 395_471] },
    { label: 'Other income', values: [7_263, 5_862] },
    { label: 'Total revenue', values: [1_759_052, 2_171_895] },
    { label: 'Expenses excluding losses', values: [] },
    { label: 'Employee-related expenses', note: '3(a)', values: [1_997_053, 1_588_550] },
    { label: 'Personnel services', note: '3(b)', values: [112_917, 109_105] },
    { label: 'Other operating expenses', note: '3(c)', values: [2_264_961, 2_136_867] },
    { label: 'Major rail project expenses', note: '3(e)', values: [434_663, 395_471] },
    { label: 'Depreciation and amortisation', note: '3(f)', values: [321_716, 264_612] },
    { label: 'Finance costs', note: '3(g)', values: [245_120, 235_096] },
    {
      label: 'Total expenses excluding losses',
      values: [options.totalExpensesOverride ?? 5_376_430, 4_729_701],
    },
    {
      label: 'Deficit from operations before grants and other contributions',
      values: [-3_617_378, -2_557_806],
    },
    { label: 'Grants and contributions', note: '2(c)', values: [3_500_212, 2_765_875] },
    { label: '(Deficit)/surplus from operations', values: [-117_166, 208_069] },
    { label: 'Gains/(losses) on disposal', note: '4', values: [-11_376, 176] },
    { label: 'Other gains/(losses)', note: '5', values: [179, -67_315] },
    {
      label: 'Impairment reversals/(losses) on financial assets',
      note: '7',
      values: [86, 36],
    },
    { label: 'Net result', values: [options.netResultOverride ?? -128_277, 140_966] },
    { label: 'Other comprehensive income', values: [] },
    { label: 'Total comprehensive income', values: [-93_787, 156_693] },
  ];
  let y = 662;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 76.3, y, pageNumber));
    if (row.note) items.push(item(row.note, 383.7, y, pageNumber));
    row.values.forEach((value, index) => {
      const right = STATEMENT_RIGHTS[index];
      if (right === undefined || value === null) return;
      items.push(money(value === '-' ? '-' : numberCell(value), right, y, pageNumber));
    });
    y -= 11.65;
  }
  items.push(
    item(
      'The accompanying notes form part of these financial statements.',
      70.9,
      303.8,
      pageNumber,
    ),
  );
  if (draft) items.push(item('Draft for year end June 2025', 166.7, 16.8, pageNumber));
  return {
    page_number: pageNumber,
    text:
      'Notes to the Financial Statements for the year ended 30 June 2024 Sydney Trains Statement of comprehensive income for the year ended 30 June 2025 ' +
      'Revenue Sale of goods and services from contracts with customers Investment revenue Major rail project revenue Other income Total revenue Expenses excluding losses Employee-related expenses Personnel services Other operating expenses Major rail project expenses Depreciation and amortisation Finance costs Total expenses excluding losses Deficit from operations before grants and other contributions Grants and contributions (Deficit)/surplus from operations Gains/(losses) on disposal Other gains/(losses) Impairment reversals/(losses) on financial assets Net result Other comprehensive income Total comprehensive income The accompanying notes form part of these financial statements. ' +
      (draft ? 'Draft for year end June 2025' : ''),
    items,
  };
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    extraPages?: PdfPage[];
    text?: string;
  } = {},
): PdfExtraction {
  return {
    source: { url: PDF_URL, sha256: 's'.repeat(64), bytes: 2_104_788 },
    pages: [statementPage(options.statement), ...(options.extraPages ?? [])],
    text:
      options.text ??
      'Statement of comprehensive income For the year ended 30 June 2025 Total comprehensive income',
    tables: [],
    warnings: [],
  };
}

const context: SydneyTrainsParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2024–25 — audited financial statements',
  fiscal_year: '2024-25',
  archive: {
    local_path: '/archive/sydney-trains/sydney-trains-annual-report-2024-25-volume-2.pdf',
    sha256: 's'.repeat(64),
    bytes: 2_104_788,
  },
  source_date: '2026-11-17',
};

function recordFor(result: ReturnType<typeof parseSydneyTrainsExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Sydney Trains annual-report discovery', () => {
  it('selects the latest report year and its Volume 2 financial statements', () => {
    const pageHtml = `
      <a href="/system/files/media/documents/2025/sydney-trains-annual-report-2024%E2%80%9325-volume-1.pdf">2024-25 Vol 1</a>
      <a href="/system/files/media/documents/2025/sydney-trains-annual-report-2024%E2%80%9325-volume-2.pdf">2024-25 Vol 2</a>
      <a href="/system/files/media/documents/2024/sydney-trains-annual-report-2023-24-volume-1.pdf">2023-24 Vol 1</a>
      <a href="/system/files/media/documents/2024/sydney-trains-annual-report-2023-24-volume-2.pdf">2023-24 Vol 2</a>
      <a href="/newsroom-and-events/reports-and-publications/sydney-trains-corporate-plan">Corporate plan</a>
      <a href="/sites/default/files/2024/sydney-trains-electricity-network-bushfire-preparedness.pdf">Bushfire</a>
      <a href="/sites/default/files/2024/sydney-trains-electricity-network-safety-management-system.pdf">Safety</a>`;
    const links = parseSydneyTrainsAnnualReportPdfLinks(
      pageHtml,
      'https://www.transport.nsw.gov.au/news-and-events/reports-and-publications/sydney-trains-annual-reports',
    );
    expect(links.map((link) => link.fiscal_year)).toEqual([
      '2024-25',
      '2024-25',
      '2023-24',
      '2023-24',
    ]);
    const latest = selectSydneyTrainsAnnualReport(links);
    expect(latest).toMatchObject({ fiscal_year: '2024-25', volume: 2, url: PDF_URL });
    expect(links.some((link) => /corporate|bushfire|safety/i.test(link.url))).toBe(false);
  });

  it('falls back to a single-PDF report year and maps report years', () => {
    expect(sydneyTrainsVolumeFromFilename('Sydney Trains Annual Report 2017-18.pdf')).toBeNull();
    expect(sydneyTrainsVolumeFromFilename('Sydney-Trains-Annual-Report-V2-2018-19.pdf')).toBe(2);
    expect(
      sydneyTrainsVolumeFromFilename(
        'Sydney-Trains-Annual-Report-2021-22-Volume-2-Audited-Financial-Statements.pdf',
      ),
    ).toBe(2);
    const links = parseSydneyTrainsAnnualReportPdfLinks(
      '<a href="/x/Sydney%20Trains%20Annual%20Report%202017-18.pdf">2017-18</a>',
      'https://www.transport.nsw.gov.au/p',
    );
    expect(selectSydneyTrainsAnnualReport(links)?.volume ?? null).toBeNull();
    expect(sydneyTrainsFiscalYearFromReportYear(2025)).toBe('2024-25');
    expect(sydneyTrainsFiscalYearFromReportYear(2018)).toBe('2017-18');
  });
});

describe("Sydney Trains $'000 guard", () => {
  it('detects an explicit thousands unit and rejects dollars/millions', () => {
    const unit = detectSydneyTrainsUnit(["$'000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const dollars = parseSydneyTrainsStatement(statementPage({ unit: '$' }));
    expect(dollars?.unit.kind).toBe('dollars');
    expect(dollars?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const millions = parseSydneyTrainsExtraction(
      extraction({ statement: { unit: '$M' } }),
      context,
    );
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseSydneyTrainsExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });
});

describe('Sydney Trains exact reconciliation and rows', () => {
  it('reconciles printed totals, components, operations and the net result exactly', () => {
    const result = parseSydneyTrainsExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(1_759_052);
    expect(result.statement?.total_expenses).toBe(5_376_430);
    expect(result.statement?.net_result).toBe(-128_277);
    expect(result.checks.join(' ')).toContain(
      'total-revenue bridge exact: 1247953 + 69173 + 434663 + 7263 = 1759052',
    );
    expect(result.checks.join(' ')).toContain(
      'total-expenses bridge exact: 1997053 + 112917 + 2264961 + 434663 + 321716 + 245120 = 5376430',
    );
    expect(result.checks.join(' ')).toContain(
      'deficit-before-grants bridge exact: 1759052 - 5376430 = -3617378',
    );
    expect(result.checks.join(' ')).toContain(
      'operations-result bridge exact: -3617378 + 3500212 = -117166',
    );
    expect(result.checks.join(' ')).toContain(
      'net-result bridge exact: -117166 + -11376 + 179 + 86 = -128277',
    );
  });

  it('maps the six required lines with provenance, exact cents and no verified claim', () => {
    const result = parseSydneyTrainsExtraction(extraction(), context);
    expect(result.records).toHaveLength(6);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 537_643_000_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'Sydney Trains',
      funding_source: 'Sydney Trains',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: SYDNEY_TRAINS_ID,
      source_url: PDF_URL,
      source_dataset: 'Sydney Trains Annual Report 2024-25',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(175_905_200_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(199_705_300_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(32_171_600_000);
    expect(recordFor(result, 'government_grants')).toMatchObject({
      amount_cents: 350_021_200_000,
      potential_double_count: true,
      funding_source: 'NSW Government — Transport for NSW',
    });
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 12_827_700_000,
      soc_printed_sign: 'negative',
    });
    expect(result.records.every((record) => record.verified === false)).toBe(true);
    expect(recordFor(result, 'total_expenses')?.notes).toContain('human_spot_check: required');
    expect(recordFor(result, 'net_result')?.notes).toContain('human_spot_check: required');
    expect(recordFor(result, 'total_expenses')?.notes).toContain('Total expenses excluding losses');
    expect(recordFor(result, 'government_grants')?.notes).toContain(
      'presented below Total revenue',
    );
  });

  it('records the published Draft footer as a provenance warning', () => {
    const result = parseSydneyTrainsExtraction(extraction(), context);
    expect(result.statement?.draft_footer).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/Draft for year end June 2025/i);
    expect(recordFor(result, 'total_expenses')?.notes).toMatch(/Draft for year end June 2025/i);

    const clean = parseSydneyTrainsExtraction(extraction({ statement: { draft: false } }), context);
    expect(clean.statement?.draft_footer).toBe(false);
    expect(clean.warnings.join(' ')).not.toMatch(/Draft for year end June 2025/i);
  });

  it('defers on a one-thousand total-expenses mismatch instead of ingesting', () => {
    const result = parseSydneyTrainsExtraction(
      extraction({ statement: { totalExpensesOverride: 5_376_431 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand net-result mismatch instead of ingesting', () => {
    const result = parseSydneyTrainsExtraction(
      extraction({ statement: { netResultOverride: -128_278 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseSydneyTrainsExtraction(extraction(), {
      ...context,
      fiscal_year: '2023-24',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Sydney Trains natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = sydneyTrainsNaturalKey('Sydney Trains', '2024-25', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^sydney-trains:[0-9a-f]{40}$/);
    expect(key).toBe(sydneyTrainsNaturalKey('Sydney Trains', '2024-25', 'total_expenses', PDF_URL));
    expect(key).not.toBe(
      sydneyTrainsNaturalKey('Sydney Trains', '2024-25', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      sydneyTrainsNaturalKey('Sydney Trains', '2023-24', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseSydneyTrainsExtraction(extraction(), context);
    const second = parseSydneyTrainsExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Sydney Trains no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseSydneyTrainsExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags only the separately disclosed grant row as a potential double count', () => {
    const result = parseSydneyTrainsExtraction(extraction(), context);
    expect(
      result.records
        .filter((record) => record.potential_double_count)
        .map((record) => record.soc_line_item),
    ).toEqual(['government_grants']);
    expect(result.records.map((record) => record.soc_line_item)).toEqual([
      'total_revenue',
      'total_expenses',
      'employee_expenses',
      'depreciation_amortisation',
      'government_grants',
      'net_result',
    ]);
  });
});
