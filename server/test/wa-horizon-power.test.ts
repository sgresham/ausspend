import { describe, expect, it } from 'vitest';
import {
  HORIZON_POWER_ID,
  HORIZON_POWER_OFFICIAL_FALLBACK_URL,
  detectHorizonPowerUnit,
  discoverHorizonPowerAnnualReport,
  horizonPowerFiscalYearFromFilename,
  horizonPowerNaturalKey,
  horizonPowerOfficialFallback,
  parseHorizonPowerAnnualReportPdfLinks,
  parseHorizonPowerExtraction,
  parseHorizonPowerStatement,
  type HorizonPowerParseContext,
} from '../src/connectors/soc/wa/horizon-power.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL = HORIZON_POWER_OFFICIAL_FALLBACK_URL;
const OFFICIAL_PDF_2026 =
  'https://www.horizonpower.com.au/globalassets/media/documents/annual-reports/20252026/horizon-power-annual-report-2026.pdf';

function item(str: string, x: number, y: number, page = 105, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 105): PdfTextItem {
  const width = Math.max(6, str.length * 4);
  return item(str, right - width, y, page, width);
}

const COLS = [462, 552];

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
  note?: string;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function renderRow(row: RowSpec, pageNumber: number, y: number): PdfTextItem[] {
  const items: PdfTextItem[] = [item(row.label, 43, y, pageNumber)];
  if (row.note) items.push(item(row.note, 348, y, pageNumber));
  row.values.forEach((value, index) => {
    const right = COLS[index] as number;
    if (value === null) return;
    const text =
      typeof value === 'string'
        ? value
        : value < 0
          ? `(${numberCell(Math.abs(value))})`
          : numberCell(value);
    items.push(money(text, right, y, pageNumber));
  });
  return items;
}

interface StatementOptions {
  unit?: string;
  totalIncomeOverride?: number;
  employeeOverride?: number;
  pbtOverride?: number;
  netOverride?: number;
}

function facePage(options: StatementOptions = {}): PdfPage {
  const unit = options.unit ?? '$’000';
  const pageNumber = 105;
  const items: PdfTextItem[] = [
    item('Notes', 348, 685, pageNumber),
    item('30 June', 430, 685, pageNumber),
    item('2026', 441, 675, pageNumber),
    item(unit, 438, 665, pageNumber),
    item('30 June', 520, 685, pageNumber),
    item('2025', 531, 675, pageNumber),
    item(unit, 527, 665, pageNumber),
    item('Statement of comprehensive income', 43, 718, pageNumber),
    item('for the year ended 30 June 2026', 43, 703, pageNumber),
  ];
  let y = 652;
  const add = (row: RowSpec) => {
    items.push(...renderRow(row, pageNumber, y));
    y -= 14;
  };
  add({ label: 'Revenue', values: [498_907, 485_057], note: '4(b)' });
  add({ label: 'Other income', values: [254_447, 231_185], note: '5(b)' });
  add({
    label: 'Total income',
    values: [options.totalIncomeOverride ?? 753_354, 716_242],
  });
  add({ label: 'Expenses', values: [null, null] });
  add({ label: 'Electricity and fuel purchases', values: [-279_767, -282_686], note: '6(b)' });
  add({
    label: 'Employee benefits expense',
    values: [-(options.employeeOverride ?? 105_578), -97_843],
    note: '6(b)',
  });
  add({ label: 'Materials and services', values: [-112_848, -91_800], note: '6(b)' });
  add({
    label: 'Depreciation and amortisation expense',
    values: [-131_448, -121_238],
    note: '6(b)',
  });
  add({ label: 'Other expenses', values: [-43_169, -42_311], note: '6(b)' });
  add({ label: 'Finance costs', values: [-56_992, -56_188], note: '6(b)' });
  add({
    label: 'Profit before income tax equivalent expense',
    values: [options.pbtOverride ?? 23_552, 24_176],
  });
  add({ label: 'Income tax equivalent expense', values: [-6_660, -8_982], note: '7(b)' });
  add({
    label: 'Profit for the year',
    values: [options.netOverride ?? 16_892, 15_194],
  });
  return {
    page_number: pageNumber,
    text: `Statement of comprehensive income for the year ended 30 June 2026 Notes 30 June 2026 $’000 30 June 2025 $’000 Revenue Other income Total income Expenses Electricity and fuel purchases Employee benefits expense Materials and services Depreciation and amortisation expense Other expenses Finance costs Profit before income tax equivalent expense Income tax equivalent expense Profit for the year`,
    items,
  };
}

function extraction(options: StatementOptions = {}, text = 'For the year ended 30 June 2026') {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 11_000_133 },
    pages: [facePage(options)],
    text,
    tables: [],
    warnings: [],
  } satisfies PdfExtraction;
}

const context: HorizonPowerParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/wa-horizon-power/Horizon-Power-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 11_000_133,
  },
  source_date: '2026-11-19',
  access: 'official-pdf-fallback',
};

function recordFor(result: ReturnType<typeof parseHorizonPowerExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Horizon Power annual-report discovery', () => {
  it('selects the newest official annual report and rejects non-annual PDFs', () => {
    const html = `
      <a href="https://www.horizonpower.com.au/globalassets/media/documents/annual-reports/20242025/2024-25-annual-report_horizon-power.pdf">2024-25</a>
      <a href="${OFFICIAL_PDF_2026}">2025-26</a>
      <a href="https://www.horizonpower.com.au/globalassets/media/documents/annual-reports/20242025/horizon-power-2025-energy-charter-disclosure-report_hr-web.pdf">Energy Charter</a>
      <a href="https://www.horizonpower.com.au/globalassets/media/documents/annual-reports/20252026/horizon-power-2026-statement-of-corporate-intent.pdf">SCI</a>`;
    const links = parseHorizonPowerAnnualReportPdfLinks(
      html,
      'https://www.horizonpower.com.au/about-horizon-power/publications/',
    );
    expect(links[0]).toMatchObject({
      url: OFFICIAL_PDF_2026,
      filename: 'horizon-power-annual-report-2026.pdf',
      fiscal_year: '2025-26',
      access: 'official',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.some((link) => /energy-charter|corporate-intent/i.test(link.filename))).toBe(
      false,
    );
  });

  it('parses year-ended and 2024-25 span filenames and rejects non-annual reports', () => {
    expect(horizonPowerFiscalYearFromFilename('horizon-power-annual-report-2026.pdf')).toBe(
      '2025-26',
    );
    expect(horizonPowerFiscalYearFromFilename('2024-25-annual-report_horizon-power.pdf')).toBe(
      '2024-25',
    );
    expect(
      horizonPowerFiscalYearFromFilename('horizon-power-2025-energy-charter-disclosure-report.pdf'),
    ).toBeNull();
    expect(
      horizonPowerFiscalYearFromFilename('horizon-power-2026-statement-of-corporate-intent.pdf'),
    ).toBeNull();
  });

  it('falls back to the documented official CDN PDF when the publications page is 403', async () => {
    const fetchImpl = (async () => new Response('blocked', { status: 403 })) as typeof fetch;
    const latest = await discoverHorizonPowerAnnualReport(fetchImpl);
    expect(latest).toEqual(horizonPowerOfficialFallback());
    expect(latest.url).toBe(OFFICIAL_PDF_2026);
    expect(latest.access).toBe('official-pdf-fallback');
    expect(latest.fiscal_year).toBe('2025-26');
  });

  it('uses the official page when it is accessible', async () => {
    const fetchImpl = (async () =>
      new Response(`<a href="${OFFICIAL_PDF_2026}">2026</a>`, { status: 200 })) as typeof fetch;
    const latest = await discoverHorizonPowerAnnualReport(fetchImpl);
    expect(latest.url).toBe(OFFICIAL_PDF_2026);
    expect(latest.access).toBe('official');
  });
});

describe('Horizon Power $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectHorizonPowerUnit(["$'000 30 June 2026 $'000 30 June 2025"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing', () => {
    const result = parseHorizonPowerExtraction(extraction({ unit: '' }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseHorizonPowerStatement(facePage({ unit: '$M' }));
    expect(millions?.unit.kind).toBe('millions');

    const millionsDeferral = parseHorizonPowerExtraction(extraction({ unit: '$M' }), context);
    expect(millionsDeferral.records).toHaveLength(0);
    expect(millionsDeferral.deferral?.phase).toBe('unit');

    const dollars = parseHorizonPowerExtraction(extraction({ unit: '$' }), context);
    expect(dollars.records).toHaveLength(0);
    expect(dollars.deferral?.phase).toBe('unit');
  });
});

describe('Horizon Power exact reconciliation and rows', () => {
  it('derives total expenses and reconciles every printed bridge exactly', () => {
    const result = parseHorizonPowerExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_income).toBe(753_354);
    expect(result.statement?.total_expenses).toBe(729_802);
    expect(result.statement?.employee_expenses).toBe(105_578);
    expect(result.statement?.depreciation_amortisation).toBe(131_448);
    expect(result.statement?.profit_before_tax).toBe(23_552);
    expect(result.statement?.net_result).toBe(16_892);
    const checks = result.checks.join(' ');
    expect(checks).toContain(
      'income components exact: 498907 + 254447 = 753354 (printed Total income 753354)',
    );
    expect(checks).toContain(
      'total expenses exact: 279767 + 105578 + 112848 + 131448 + 43169 + 56992 = 729802',
    );
    expect(checks).toContain(
      'profit-before-tax bridge exact: 753354 - 729802 = 23552 (printed 23552)',
    );
    expect(checks).toContain('net-result bridge exact: 23552 + -6660 = 16892 (printed 16892)');
  });

  it('maps the five required lines with provenance and exact cents', () => {
    const result = parseHorizonPowerExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 72_980_200_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'WA',
      delivery_entity: 'Horizon Power',
      funding_source: 'Horizon Power',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: HORIZON_POWER_ID,
      source_url: PDF_URL,
      source_dataset: 'Horizon Power Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Statement of comprehensive income',
      extraction_confidence: 'high',
      location: { state: 'WA' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(75_335_400_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(10_557_800_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(13_144_800_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 1_689_200_000,
      soc_printed_sign: 'positive',
    });
  });

  it('defers on an income-component mismatch', () => {
    const result = parseHorizonPowerExtraction(
      extraction({ totalIncomeOverride: 753_355 }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/income component total mismatch/i);
  });

  it('defers on profit-before-tax or net-result mismatches', () => {
    const pbt = parseHorizonPowerExtraction(extraction({ pbtOverride: 23_553 }), context);
    expect(pbt.records).toHaveLength(0);
    expect(pbt.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);

    const net = parseHorizonPowerExtraction(extraction({ netOverride: 16_893 }), context);
    expect(net.records).toHaveLength(0);
    expect(net.deferral?.reason).toMatch(/net-result bridge mismatch/i);
  });

  it('defers on a component change that breaks the derived-expense bridge', () => {
    const result = parseHorizonPowerExtraction(extraction({ employeeOverride: 105_579 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.reason).toMatch(/profit-before-tax bridge mismatch/i);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseHorizonPowerExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Horizon Power natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = horizonPowerNaturalKey('Horizon Power', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^wa-horizon-power:[0-9a-f]{40}$/);
    expect(key).toBe(
      horizonPowerNaturalKey('Horizon Power', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      horizonPowerNaturalKey('Horizon Power', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      horizonPowerNaturalKey('Horizon Power', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseHorizonPowerExtraction(extraction(), context);
    const second = parseHorizonPowerExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Horizon Power no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive, WA-only and excluded from the generic spending query', () => {
    const result = parseHorizonPowerExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Horizon Power']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['WA']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(HORIZON_POWER_ID);
      expect(record.potential_double_count).toBe(false);
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
    expect(
      result.records.some((record) => /total.*wa|wa.*total/i.test(record.soc_line_item ?? '')),
    ).toBe(false);
  });
});
