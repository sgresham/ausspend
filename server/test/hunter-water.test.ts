import { describe, expect, it } from 'vitest';
import {
  detectHunterWaterUnit,
  hunterWaterNaturalKey,
  parseHunterWaterAnnualReportPageLinks,
  parseHunterWaterAnnualReportPdfLinks,
  parseHunterWaterExtraction,
  parseHunterWaterStatement,
  HUNTER_WATER_ID,
  type HunterWaterParseContext,
} from '../src/connectors/soc/nsw/hunter-water.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.hunterwater.com.au/documents/assets/src/uploads/documents/Annual-Reports-Past-Reports/Annual-report-2024-25.pdf';

function item(str: string, x: number, y: number, page = 1, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 1): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const STATEMENT_RIGHTS = [442, 507];
const NOTE3_RIGHTS = [468, 541];

interface RowSpec {
  label?: string;
  note?: string;
  values?: Array<number | null>;
}

function statementPage(
  options: { unit?: string; totalExpensesOverride?: number; pbtOverride?: number } = {},
): PdfPage {
  const unit = options.unit ?? "$'000";
  const pageNumber = 77;
  const items: PdfTextItem[] = [
    item('Income Statement for the year ended 30 June 2025', 34, 705, pageNumber),
    item('2025', 421, 679, pageNumber),
    item('2024', 486, 679, pageNumber),
    item('Notes', 344, 674, pageNumber),
    item(unit, 418, 669, pageNumber),
    item(unit, 484, 669, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Services', note: '2', values: [446_759, 438_050] },
    { label: 'Other income', note: '2', values: [290, 340] },
    { label: 'Total revenue', values: [447_049, 438_390] },
    { label: 'Operational expenses', note: '3', values: [-198_606, -179_694] },
    { label: 'Depreciation and amortisation', note: '4(a)', values: [-107_778, -101_316] },
    { label: 'Finance costs', note: '4(b)', values: [-88_870, -78_125] },
    { label: 'Superannuation expense', note: '4(c)', values: [-9_489, -8_946] },
    { label: 'Asset revaluation increment/(decrement)', note: '4(d)', values: [7, -223] },
    { label: 'Other', note: '4(e)', values: [-13_590, -2_120] },
    {
      label: 'Total expenses',
      values: [-(options.totalExpensesOverride ?? 418_326), -370_423],
    },
    { label: 'Profit before income tax', values: [options.pbtOverride ?? 28_723, 67_967] },
    { label: 'Income tax expense', note: '5(a)', values: [-9_316, -18_187] },
    { label: 'Profit after income tax', values: [19_406, 49_780] },
    { label: 'Profit for the year', values: [19_406, 49_780] },
  ];
  let y = 654;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 37, y, pageNumber));
    if (row.note) items.push(item(row.note, 353, y, pageNumber, 5));
    (row.values ?? []).forEach((value, index) => {
      const right = STATEMENT_RIGHTS[index];
      if (right === undefined) return;
      if (typeof value === 'number')
        items.push(money(value.toLocaleString('en-AU'), right, y, pageNumber));
    });
    y -= 14;
  }
  return {
    page_number: pageNumber,
    text: 'Income Statement for the year ended 30 June 2025 Revenue Services Other income Total revenue Expenses Operational expenses Depreciation and amortisation Finance costs Superannuation expense Asset revaluation increment/(decrement) Other Total expenses Profit before income tax Income tax expense Profit after income tax Profit for the year',
    items,
  };
}

function revenuePage(): PdfPage {
  const pageNumber = 84;
  const items: PdfTextItem[] = [
    item('Note 2. Revenue', 34, 743, pageNumber),
    item('2025', 415, 720, pageNumber),
    item('2024', 486, 720, pageNumber),
    item("$'000", 413, 710, pageNumber),
    item('$’000', 484, 710, pageNumber),
    item('Tariff - service charges', 37, 682, pageNumber),
    money('204,364', 436.5, 682, pageNumber),
    money('202,240', 507.4, 682, pageNumber),
    item('Government grants and rebates', 37, 498, pageNumber),
    money('19,901', 436.6, 498, pageNumber),
    money('19,625', 507.4, 498, pageNumber),
  ];
  return {
    page_number: pageNumber,
    text: 'Note 2. Revenue Government grants and rebates Tariff - service charges',
    items,
  };
}

function operationalPage(options: { employeeOverride?: number } = {}): PdfPage {
  const pageNumber = 86;
  const items: PdfTextItem[] = [
    item('Note 3. Operational expenses', 34, 743, pageNumber),
    item('2025', 446, 724, pageNumber),
    item('2024', 520, 724, pageNumber),
    item("$'000", 444, 714, pageNumber),
    item('$’000', 518, 714, pageNumber),
  ];
  const rows: RowSpec[] = [
    {
      label: 'Employee related',
      values: [options.employeeOverride ?? 69_617, 62_441],
    },
    { label: 'Maintenance', values: [24_862, 23_453] },
    { label: 'Operations', values: [54_272, 48_462] },
    { label: 'Regulatory', values: [7_010, 6_298] },
    { label: 'Corporate', values: [41_958, 38_294] },
    { label: 'Other', values: [887, 746] },
  ];
  let y = 700;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 37, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = NOTE3_RIGHTS[index];
      if (right === undefined) return;
      if (typeof value === 'number')
        items.push(money(value.toLocaleString('en-AU'), right, y, pageNumber));
    });
    y -= 14;
  }
  return {
    page_number: pageNumber,
    text: 'Note 3. Operational expenses Employee related Maintenance Operations Regulatory Corporate Other',
    items,
  };
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    operational?: Parameters<typeof operationalPage>[0];
    includeRevenue?: boolean;
    includeOperational?: boolean;
  } = {},
): PdfExtraction {
  const pages = [statementPage(options.statement)];
  if (options.includeRevenue !== false) pages.push(revenuePage());
  if (options.includeOperational !== false) pages.push(operationalPage(options.operational));
  return {
    source: { url: PDF_URL, sha256: 'c'.repeat(64), bytes: 13_658_943 },
    pages,
    text: 'Income Statement for the year ended 30 June 2025',
    tables: [],
    warnings: [],
  };
}

const context: HunterWaterParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2024–25',
  fiscal_year: '2024-25',
  archive: {
    local_path: '/archive/hunter-water/hunter-water-ar-2024-25.pdf',
    sha256: 'c'.repeat(64),
    bytes: 13_658_943,
  },
  source_date: '2026-11-17',
};

function recordFor(result: ReturnType<typeof parseHunterWaterExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Hunter Water annual-report discovery', () => {
  it('selects the latest annual-report page and PDF, ignoring CRFD and older reports', () => {
    const pageHtml = `
      <a href="https://www.hunterwater.com.au/about/publications/reports-and-publications/annual-report-2024">2024</a>
      <a href="https://www.hunterwater.com.au/about/publications/reports-and-publications/annual-report-2025">2025</a>
      <a href="https://www.hunterwater.com.au/about/publications/reports-and-publications/regulatory-reports">Regulatory</a>`;
    const pages = parseHunterWaterAnnualReportPageLinks(pageHtml);
    expect(pages.map((page) => page.report_year)).toEqual([2025, 2024]);

    const arHtml = `
      <a href="https://www.hunterwater.com.au/documents/assets/src/uploads/documents/Annual-Reports-Past-Reports/Hunter-Water-CRFD-2024-25.pdf">CRFD</a>
      <a href="https://www.hunterwater.com.au/documents/assets/src/uploads/documents/Annual-Reports-Past-Reports/Annual-report-2023-24.pdf">2023-24</a>
      <a href="${PDF_URL}">2024-25</a>`;
    const links = parseHunterWaterAnnualReportPdfLinks(
      arHtml,
      'https://www.hunterwater.com.au/about/publications/reports-and-publications/annual-report-2025',
    );
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ fiscal_year: '2024-25', url: PDF_URL });
    expect(links.some((link) => /crfd/i.test(link.filename))).toBe(false);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
  });
});

describe("Hunter Water $'000 guard", () => {
  it("detects an explicit $'000 unit and converts at 100,000 cents per unit", () => {
    const unit = detectHunterWaterUnit(["$'000 2025 $’000 2024"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseHunterWaterExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it("rejects a statement read as dollars instead of $'000", () => {
    const dollars = statementPage({ unit: '$' });
    const parsed = parseHunterWaterStatement(dollars);
    expect(parsed?.unit.kind).toBe('dollars');
    expect(parsed?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const result = parseHunterWaterExtraction(extraction({ statement: { unit: '$' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
  });
});

describe('Hunter Water exact reconciliation and rows', () => {
  it('accepts the explicit printed Total expenses and reconciles every printed bridge exactly', () => {
    const result = parseHunterWaterExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_expenses).toBe(-418_326);
    expect(result.statement?.total_revenue).toBe(447_049);
    expect(result.checks.join(' ')).toContain(
      'expense components exact: -198606 + -107778 + -88870 + -9489 + 7 + -13590 = -418326',
    );
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 447049 + (-418326) = 28723',
    );
    expect(result.checks.join(' ')).toContain(
      'Note 3 operational-expenses subtotal exact: 69617 + 24862 + 54272 + 7010 + 41958 + 887 = 198606',
    );
  });

  it('retains the printed NPAT despite the audited one-dollar tax arithmetic rounding, as a warned spot-check line', () => {
    const result = parseHunterWaterExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.profit_after_tax).toBe(19_406);
    expect(result.warnings.join(' ')).toContain('difference -1');
    expect(result.warnings.join(' ')).toMatch(/human spot-check required/i);
  });

  it('maps the required lines, government grants and net result with provenance and exact cents', () => {
    const result = parseHunterWaterExtraction(extraction(), context);
    expect(result.records).toHaveLength(6);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 41_832_600_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'Hunter Water',
      funding_source: 'Hunter Water',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: HUNTER_WATER_ID,
      source_url: PDF_URL,
      source_dataset: 'Hunter Water Annual Report 2024-25',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(44_704_900_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(6_961_700_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(10_777_800_000);
    expect(recordFor(result, 'net_result')?.amount_cents).toBe(1_940_600_000);
    expect(recordFor(result, 'government_grants_and_rebates')).toMatchObject({
      amount_cents: 1_990_100_000,
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
    });
  });

  it('defers on a one-unit Total expenses / profit-before-tax mismatch instead of ingesting', () => {
    const result = parseHunterWaterExtraction(
      extraction({ statement: { totalExpensesOverride: 418_327 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-unit Profit before income tax mismatch instead of ingesting', () => {
    const result = parseHunterWaterExtraction(
      extraction({ statement: { pbtOverride: 28_724 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the Note 3 operational-expenses components do not sum to the statement line', () => {
    const result = parseHunterWaterExtraction(
      extraction({ operational: { employeeOverride: 69_618 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 3 operational-expenses mismatch/);
  });

  it('defers when the government-grants revenue note is missing', () => {
    const result = parseHunterWaterExtraction(extraction({ includeRevenue: false }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('notes');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseHunterWaterExtraction(extraction(), { ...context, fiscal_year: '2023-24' });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Hunter Water natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = hunterWaterNaturalKey('Hunter Water', '2024-25', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^hunter-water:[0-9a-f]{40}$/);
    expect(key).toBe(hunterWaterNaturalKey('Hunter Water', '2024-25', 'total_expenses', PDF_URL));
    expect(key).not.toBe(
      hunterWaterNaturalKey('Hunter Water', '2024-25', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      hunterWaterNaturalKey('Hunter Water', '2023-24', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseHunterWaterExtraction(extraction(), context);
    const second = parseHunterWaterExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Hunter Water no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseHunterWaterExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags the government-grants row but not the own-source revenue/expense/result rows', () => {
    const result = parseHunterWaterExtraction(extraction(), context);
    expect(recordFor(result, 'total_revenue')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'total_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'employee_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'depreciation_amortisation')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'net_result')?.potential_double_count).toBe(false);
    const flagged = result.records.filter((record) => record.potential_double_count);
    expect(flagged.map((record) => record.soc_line_item)).toEqual([
      'government_grants_and_rebates',
    ]);
  });
});
