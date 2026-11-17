import { describe, expect, it } from 'vitest';
import {
  detectEssentialEnergyUnit,
  essentialEnergyNaturalKey,
  parseEssentialEnergyAnnualReportPdfLinks,
  parseEssentialEnergyExpensesNote,
  parseEssentialEnergyExtraction,
  parseEssentialEnergyRevenueNote,
  parseEssentialEnergyStatement,
  ESSENTIAL_ENERGY_ID,
  type EssentialEnergyParseContext,
} from '../src/connectors/soc/nsw/essential-energy.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.essentialenergy.com.au/ext/ar2025/files/2025/11/Essential-Energy_Annual-Report_2024-25.pdf';

function item(str: string, x: number, y: number, page = 1, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 1): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const STATEMENT_RIGHTS = [442, 507];
const NOTE_RIGHTS = [442, 507];

interface RowSpec {
  label?: string;
  values?: Array<number | null>;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function statementPage(
  options: { unit?: string; pbtOverride?: number; passThroughOverride?: number } = {},
): PdfPage {
  const unit = options.unit ?? '$M';
  const pageNumber = 81;
  const items: PdfTextItem[] = [
    item('Consolidated Statement of Comprehensive Income', 34, 705, pageNumber),
    item('for the year ended 30 June 2025', 34, 692, pageNumber),
    item('Notes', 344, 679, pageNumber),
    item('2025', 421, 679, pageNumber),
    item('2024', 486, 679, pageNumber),
    item(unit, 418, 669, pageNumber),
    item(unit, 484, 669, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Network revenue from contracts with customers', values: [1582.6, 1469.7] },
    { label: 'Other revenue from contracts with customers', values: [293.4, 296.3] },
    { label: 'Total revenue from contracts with customers', values: [1876.0, 1766.0] },
    { label: 'Other revenue', values: [30.0, 27.7] },
    { label: 'Total revenue', values: [1906.0, 1793.7] },
    {
      label: 'Pass through costs',
      values: [-(options.passThroughOverride ?? 424.1), -312.9],
    },
    { label: 'Operating expenses', values: [-723.7, -652.1] },
    { label: 'Loss on disposal or write-off of non-financial assets', values: [-59.0, -20.2] },
    {
      label: 'Earnings before interest, taxation, depreciation and amortisation (EBITDA)',
      values: [699.2, 808.5],
    },
    { label: 'Depreciation, amortisation and impairment', values: [-497.2, -536.6] },
    { label: 'Earnings before interest and taxation (EBIT)', values: [202.0, 271.9] },
    { label: 'Net finance costs', values: [-338.7, -331.5] },
    { label: 'Loss before income tax', values: [options.pbtOverride ?? -136.7, -59.6] },
    { label: 'Income tax benefit', values: [40.9, 13.4] },
    { label: 'Loss for the year', values: [-95.8, -46.2] },
  ];
  let y = 654;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 37, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = STATEMENT_RIGHTS[index];
      if (right === undefined) return;
      if (typeof value === 'number') items.push(money(numberCell(value), right, y, pageNumber));
    });
    y -= 14;
  }
  return {
    page_number: pageNumber,
    text: 'Consolidated Statement of Comprehensive Income for the year ended 30 June 2025 Profit or loss Total revenue Pass through costs Operating expenses Loss on disposal or write-off of non-financial assets EBITDA Depreciation, amortisation and impairment EBIT Net finance costs Loss before income tax Income tax benefit Loss for the year',
    items,
  };
}

function revenuePage(options: { grantsOverride?: number; unit?: string } = {}): PdfPage {
  const unit = options.unit ?? '$M';
  const pageNumber = 88;
  const items: PdfTextItem[] = [
    item('2. Revenue', 34, 743, pageNumber),
    item('2025', 415, 720, pageNumber),
    item('2024', 486, 720, pageNumber),
    item(unit, 413, 710, pageNumber),
    item(unit, 484, 710, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Total revenue from contracts with customers', values: [1876.0, 1766.0] },
    {
      label: 'Government grants and subsidies',
      values: [options.grantsOverride ?? 25.4, 24.3],
    },
    { label: 'Lease revenue', values: [4.6, 3.4] },
  ];
  let y = 682;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 37, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = NOTE_RIGHTS[index];
      if (right === undefined) return;
      if (typeof value === 'number') items.push(money(numberCell(value), right, y, pageNumber));
    });
    y -= 14;
  }
  return {
    page_number: pageNumber,
    text: '2. Revenue Revenue from contracts with customers Total revenue from contracts with customers Government grants and subsidies Lease revenue',
    items,
  };
}

function expensesPage(options: { totalOperatingOverride?: number; unit?: string } = {}): PdfPage {
  const unit = options.unit ?? '$M';
  const pageNumber = 90;
  const items: PdfTextItem[] = [
    item('3. Expenses', 34, 743, pageNumber),
    item('2025', 415, 720, pageNumber),
    item('2024', 486, 720, pageNumber),
    item(unit, 413, 710, pageNumber),
    item(unit, 484, 710, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Transmission Use of System', values: [296.1, 225.2] },
    { label: 'Climate Change Fund contributions', values: [61.3, 59.9] },
    { label: 'NSW Electricity Infrastructure Roadmap contributions', values: [66.7, 27.8] },
    { label: 'Total pass through costs', values: [424.1, 312.9] },
    { label: 'Defined contribution superannuation', values: [70.2, 57.1] },
    { label: 'Defined benefit superannuation', values: [1.3, 0.9] },
    { label: 'Other employee benefits', values: [327.8, 272.3] },
    {
      label: 'Other costs of distribution of energy and other services',
      values: [323.1, 320.7],
    },
    { label: 'Debt write-offs and expected credit losses on receivables', values: [1.3, 1.1] },
    {
      label: 'Total operating expenses',
      values: [options.totalOperatingOverride ?? 723.7, 652.1],
    },
    { label: 'Loss on disposal of property, plant and equipment', values: [59.1, 19.9] },
    { label: '(Gains)/losses on modification of leases', values: [-0.1, 0.3] },
    {
      label: 'Total loss on disposal or write-off of non-financial assets',
      values: [59.0, 20.2],
    },
    { label: 'Depreciation of property, plant and equipment', values: [481.0, 474.0] },
    { label: 'Depreciation of right-of-use assets', values: [5.5, 5.0] },
    { label: 'Plant and equipment depreciation capitalised', values: [-20.4, -20.3] },
    { label: 'Depreciation expense', values: [466.1, 458.7] },
    { label: 'Amortisation of intangible assets', values: [16.3, 17.9] },
    { label: 'Impairment losses', values: [14.8, 60.0] },
    {
      label: 'Total depreciation, amortisation and impairment',
      values: [497.2, 536.6],
    },
  ];
  let y = 700;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 37, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = NOTE_RIGHTS[index];
      if (right === undefined) return;
      if (typeof value === 'number') items.push(money(numberCell(value), right, y, pageNumber));
    });
    y -= 12;
  }
  return {
    page_number: pageNumber,
    text: '3. Expenses Pass through costs Operating expenses Employee benefits Defined contribution superannuation Defined benefit superannuation Other employee benefits Total operating expenses Loss on disposal or write-off of non-financial assets Depreciation, amortisation and impairment Total depreciation, amortisation and impairment',
    items,
  };
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    revenue?: Parameters<typeof revenuePage>[0];
    expenses?: Parameters<typeof expensesPage>[0];
    includeRevenue?: boolean;
    includeExpenses?: boolean;
  } = {},
): PdfExtraction {
  const pages = [statementPage(options.statement)];
  if (options.includeRevenue !== false) pages.push(revenuePage(options.revenue));
  if (options.includeExpenses !== false) pages.push(expensesPage(options.expenses));
  return {
    source: { url: PDF_URL, sha256: 'e'.repeat(64), bytes: 19_147_042 },
    pages,
    text: 'Consolidated Statement of Comprehensive Income for the year ended 30 June 2025',
    tables: [],
    warnings: [],
  };
}

const context: EssentialEnergyParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2024–25',
  fiscal_year: '2024-25',
  archive: {
    local_path: '/archive/essential-energy/essential-energy-ar-2024-25.pdf',
    sha256: 'e'.repeat(64),
    bytes: 19_147_042,
  },
  source_date: '2026-11-17',
};

function recordFor(result: ReturnType<typeof parseEssentialEnergyExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Essential Energy annual-report discovery', () => {
  it('selects the latest annual-report PDF from old and new link styles, ignoring non-annual PDFs', () => {
    const pageHtml = `
      <a href="/-/media/Project/EssentialEnergy/Website/Files/About-Us/Essential-Energy_Annual-Report_2023-24.pdf?rev=abc">2023-24</a>
      <a href="/ext/ar2025/files/2025/11/Essential-Energy_Annual-Report_2024-25.pdf">2024-25</a>
      <a href="/-/media/Project/EssentialEnergy/Website/Files/About-Us/GIPA-Annual-Report.pdf">GIPA</a>
      <a href="/ext/ar2026/files/2026/11/2026-27AnnualPricingProposalOverview.pdf">Pricing</a>
      <a href="/-/media/Project/EssentialEnergy/Website/Files/About-Us/ENSMS-Annual-report-2018-19.pdf">ENSMS</a>`;
    const links = parseEssentialEnergyAnnualReportPdfLinks(
      pageHtml,
      'https://www.essentialenergy.com.au/about-us/corporate-governance/annual-report',
    );
    expect(links[0]).toMatchObject({ fiscal_year: '2024-25', url: PDF_URL });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.some((link) => /gipa|pricing|ensms/i.test(link.filename))).toBe(false);
  });
});

describe('Essential Energy $M guard', () => {
  it('detects an explicit $M unit and converts at 100,000,000 cents per unit', () => {
    const unit = detectEssentialEnergyUnit(['$M 2025 $M 2024']);
    expect(unit.kind).toBe('millions');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseEssentialEnergyExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit millions/i);
  });

  it('rejects a statement read as dollars or thousands instead of $M', () => {
    const dollars = parseEssentialEnergyStatement(statementPage({ unit: '$' }));
    expect(dollars?.unit.kind).toBe('dollars');
    expect(dollars?.errors.join(' ')).toMatch(/not explicit millions/i);

    const thousands = parseEssentialEnergyExtraction(
      extraction({ statement: { unit: "$'000" } }),
      context,
    );
    expect(thousands.records).toHaveLength(0);
    expect(thousands.deferral?.phase).toBe('unit');
  });
});

describe('Essential Energy exact reconciliation and rows', () => {
  it('accepts the derived total expenses and reconciles every printed bridge exactly', () => {
    const result = parseEssentialEnergyExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('millions');
    expect(result.statement?.total_revenue).toBe(1906.0);
    expect(result.statement?.total_expenses).toBe(-2042.7);
    expect(result.statement?.loss_before_tax).toBe(-136.7);
    expect(result.statement?.net_result).toBe(-95.8);
    expect(result.checks.join(' ')).toContain(
      'expense components exact: -424.1 + -723.7 + -59.0 + -497.2 + -338.7 = -2042.7',
    );
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 1906.0 + (-2042.7) = -136.7',
    );
    expect(result.checks.join(' ')).toContain('net-result bridge exact: -136.7 + (40.9) = -95.8');
    expect(result.checks.join(' ')).toContain(
      'Note 3(b) employee benefits exact: 70.2 + 1.3 + 327.8 = 399.3',
    );
  });

  it('maps the required lines with provenance, exact cents and a negative printed sign on the loss', () => {
    const result = parseEssentialEnergyExtraction(extraction(), context);
    expect(result.records).toHaveLength(6);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 204_270_000_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'Essential Energy',
      funding_source: 'Essential Energy',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: ESSENTIAL_ENERGY_ID,
      source_url: PDF_URL,
      source_dataset: 'Essential Energy Annual Report 2024-25',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_millions',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(190_600_000_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(39_930_000_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(49_720_000_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 9_580_000_000,
      soc_printed_sign: 'negative',
    });
    expect(recordFor(result, 'government_grants_and_subsidies')).toMatchObject({
      amount_cents: 2_540_000_000,
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
    });
  });

  it('defers on a one-tenth profit-before-tax mismatch instead of ingesting', () => {
    const result = parseEssentialEnergyExtraction(
      extraction({ statement: { pbtOverride: -136.6 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-tenth expense-component mismatch instead of ingesting', () => {
    const result = parseEssentialEnergyExtraction(
      extraction({ statement: { passThroughOverride: 424.2 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the Note 2(c) grants and lease rows do not reconcile to Other revenue', () => {
    const result = parseEssentialEnergyExtraction(
      extraction({ revenue: { grantsOverride: 25.5 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 2\(c\) other-revenue mismatch/);
  });

  it('defers when the Note 3(b) operating-expenses components do not sum to the statement line', () => {
    const result = parseEssentialEnergyExtraction(
      extraction({ expenses: { totalOperatingOverride: 723.8 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 3\(b\) operating-expenses mismatch/);
  });

  it('defers when the government-grants revenue note is missing', () => {
    const result = parseEssentialEnergyExtraction(extraction({ includeRevenue: false }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('notes');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseEssentialEnergyExtraction(extraction(), {
      ...context,
      fiscal_year: '2023-24',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });

  it('parses the Note 2 and Note 3 tables directly with explicit $M units', () => {
    const revenue = parseEssentialEnergyRevenueNote(revenuePage());
    expect(revenue.unit.kind).toBe('millions');
    expect(revenue.government_grants_and_subsidies).toBe(25.4);
    expect(revenue.lease_revenue).toBe(4.6);

    const expenses = parseEssentialEnergyExpensesNote(expensesPage());
    expect(expenses.unit.kind).toBe('millions');
    expect(expenses.defined_contribution_superannuation).toBe(70.2);
    expect(expenses.other_employee_benefits).toBe(327.8);
    expect(expenses.total_operating_expenses).toBe(723.7);
    expect(expenses.total_depreciation_amortisation_impairment).toBe(497.2);
  });
});

describe('Essential Energy natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = essentialEnergyNaturalKey('Essential Energy', '2024-25', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^essential-energy:[0-9a-f]{40}$/);
    expect(key).toBe(
      essentialEnergyNaturalKey('Essential Energy', '2024-25', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      essentialEnergyNaturalKey('Essential Energy', '2024-25', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      essentialEnergyNaturalKey('Essential Energy', '2023-24', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseEssentialEnergyExtraction(extraction(), context);
    const second = parseEssentialEnergyExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Essential Energy no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseEssentialEnergyExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags the government-grants row but not the own-source revenue/expense/result rows', () => {
    const result = parseEssentialEnergyExtraction(extraction(), context);
    expect(recordFor(result, 'total_revenue')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'total_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'employee_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'depreciation_amortisation')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'net_result')?.potential_double_count).toBe(false);
    const flagged = result.records.filter((record) => record.potential_double_count);
    expect(flagged.map((record) => record.soc_line_item)).toEqual([
      'government_grants_and_subsidies',
    ]);
  });
});
