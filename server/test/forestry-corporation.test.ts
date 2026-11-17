import { describe, expect, it } from 'vitest';
import {
  detectForestryCorporationUnit,
  forestryCorporationNaturalKey,
  parseForestryCorporationAnnualReportPdfLinks,
  parseForestryCorporationEmployeeBenefitsNote,
  parseForestryCorporationExtraction,
  parseForestryCorporationFinanceCostsNote,
  parseForestryCorporationOperatingExpensesNote,
  parseForestryCorporationOtherIncomeNote,
  parseForestryCorporationStatement,
  FORESTRY_CORPORATION_ID,
  type ForestryCorporationParseContext,
} from '../src/connectors/soc/nsw/forestry-corporation.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.forestrycorporation.com.au/__data/assets/pdf_file/0009/1650285/annual-report-2024-25.pdf';

function item(str: string, x: number, y: number, page = 1, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 1): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const STATEMENT_RIGHTS = [463.9, 534.8];
const NOTE_RIGHTS = [479.1, 549.9];
const OPERATING_RIGHTS = [464.9, 535.7];
const EMPLOYEE_RIGHTS = [463.7, 534.6];

interface RowSpec {
  label?: string | string[];
  values?: Array<number | null>;
  right?: number;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function cellFor(value: number | null): string {
  if (value === null) return '-';
  const text = numberCell(Math.abs(value));
  return value < 0 ? `(${text})` : text;
}

function statementPage(
  options: {
    unit?: string;
    pbtOverride?: number;
    totalExpensesOverride?: number;
    employeeOverride?: number;
  } = {},
): PdfPage {
  const unit = options.unit ?? '$‘000';
  const pageNumber = 50;
  const items: PdfTextItem[] = [
    item('Forestry Corporation of New South Wales', 43, 788.9, pageNumber),
    item('Statement of profit or loss and other comprehensive income', 43, 765.3, pageNumber),
    item('For the year ended 30 June 2025', 43, 748.4, pageNumber),
    item('Note', 364, 711.9, pageNumber),
    item('30 June 2025', 402, 717.1, pageNumber),
    item('30 June 2024', 473, 717.1, pageNumber),
    item(unit, 437, 706.6, pageNumber),
    item(unit, 508, 706.6, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Revenue from transactions' },
    { label: 'Revenue from contracts with customers', values: [335995, 339253] },
    { label: 'Other income', values: [48833, 49601] },
    { label: 'Investment revenue', values: [3729, 5445] },
    { label: 'Total revenue', values: [388557, 394299] },
    { label: 'Expenses from transactions' },
    { label: 'Other operating expenses', values: [-279691, -301524] },
    {
      label: 'Employee benefits expense',
      values: [options.employeeOverride ?? -89610, -90226],
    },
    { label: 'Depreciation and amortisation expense', values: [-12163, -11824] },
    { label: 'Finance costs', values: [-3068, -2319] },
    {
      label: 'Total expenses',
      values: [options.totalExpensesOverride ?? -384532, -405893],
    },
    { label: 'Other gains/(losses)', values: [33809, 136093] },
    { label: 'Net impairment (loss) of right-of-use asset', values: [-82, -363] },
    { label: 'Net impairment (loss) of property, plant and equipment', values: [-8274, -4019] },
    {
      label: 'Fair value Gain/(loss) on revaluation of non-current assets',
      values: [-171, 1159],
    },
    { label: 'Reversal/Impairment (Loss) on receivables', values: [-474, 322] },
    { label: 'Impairment (loss) of easement', values: [null, -500] },
    {
      label: 'Net profit/(loss) before income tax benefit/(expense)',
      values: [options.pbtOverride ?? 28833, 121098],
    },
    { label: 'Income tax benefit/(expense)', values: [-8995, -36838] },
    { label: 'Net profit/(loss) after income tax benefit/(expense)' },
    { label: 'for the year attributable to the owners of Forestry' },
    { label: 'Corporation of New South Wales', values: [19838, 84260] },
  ];
  let y = 686.7;
  for (const row of rows) {
    if (row.label) {
      const labels = Array.isArray(row.label) ? row.label : [row.label];
      let x = 45;
      for (const label of labels) {
        items.push(item(label, x, y, pageNumber));
        x += label.length * 5.5;
      }
    }
    (row.values ?? []).forEach((value, index) => {
      const right = STATEMENT_RIGHTS[index];
      if (right === undefined) return;
      items.push(money(cellFor(value), right, y, pageNumber));
    });
    y -= 15.5;
  }
  return {
    page_number: pageNumber,
    text: 'Forestry Corporation of New South Wales Statement of profit or loss and other comprehensive income For the year ended 30 June 2025 Note 30 June 2025 $‘000 30 June 2024 $‘000 Revenue from transactions Revenue from contracts with customers Other income Investment revenue Total revenue Expenses from transactions Other operating expenses Employee benefits expense Depreciation and amortisation expense Finance costs Total expenses Other gains/(losses) Net impairment (loss) of right-of-use asset Net impairment (loss) of property, plant and equipment Fair value Gain/(loss) on revaluation of non-current assets Reversal/Impairment (Loss) on receivables Impairment (loss) of easement Net profit/(loss) before income tax benefit/(expense) Income tax benefit/(expense) Net profit/(loss) after income tax benefit/(expense)',
    items,
  };
}

function otherIncomePage(options: { csoOverride?: number; unit?: string } = {}): PdfPage {
  const unit = options.unit ?? '$‘000';
  const pageNumber = 59;
  const items: PdfTextItem[] = [
    item('Forestry Corporation of New South Wales', 57, 788.9, pageNumber),
    item('Note 5. Other income', 57, 716.2, pageNumber),
    item('30 June 2025', 418, 695.1, pageNumber),
    item('30 June 2024', 489, 695.1, pageNumber),
    item(unit, 452, 684.6, pageNumber),
    item(unit, 523, 684.6, pageNumber),
  ];
  const rows: RowSpec[] = [
    {
      label: ['Grants revenue -', 'community service obligations'],
      values: [options.csoOverride ?? 31511, 36850],
    },
    {
      label: ['Grants revenue -', 'other state government grants'],
      values: [12192, 5364],
    },
    { label: 'Section 44 reimbursement*', values: [null, 3012] },
    { label: 'Other services rendered', values: [5130, 4375] },
    { values: [48833, 49601] },
  ];
  let y = 661.8;
  for (const row of rows) {
    if (row.label) {
      const labels = Array.isArray(row.label) ? row.label : [row.label];
      let x = 60;
      for (const label of labels) {
        items.push(item(label, x, y, pageNumber));
        x += label.length * 5.5;
      }
    }
    (row.values ?? []).forEach((value, index) => {
      const right = NOTE_RIGHTS[index];
      if (right === undefined) return;
      items.push(money(cellFor(value), right, y, pageNumber));
    });
    y -= 15.6;
  }
  return {
    page_number: pageNumber,
    text: 'Note 5. Other income 30 June 2025 $‘000 30 June 2024 $‘000 Grants revenue - community service obligations Grants revenue - other state government grants Section 44 reimbursement Other services rendered',
    items,
  };
}

function operatingExpensesPage(
  options: { salariesOverride?: number; totalOperatingOverride?: number; unit?: string } = {},
): PdfPage {
  const unit = options.unit ?? '$‘000';
  const pageNumber = 60;
  const items: PdfTextItem[] = [
    item('Forestry Corporation of New South Wales', 43, 788.9, pageNumber),
    item('Note 8. Other operating expenses', 43, 565.6, pageNumber),
    item('Note 9. Employee benefits expense', 43, 259.9, pageNumber),
    item('30 June 2025', 403, 544.5, pageNumber),
    item('30 June 2024', 474, 544.5, pageNumber),
    item(unit, 438, 534.0, pageNumber),
    item(unit, 509, 534.0, pageNumber),
    item('30 June 2025', 403, 238.9, pageNumber),
    item('30 June 2024', 474, 238.9, pageNumber),
    item(unit, 438, 228.4, pageNumber),
    item(unit, 509, 228.4, pageNumber),
  ];
  const operating: RowSpec[] = [
    { label: 'Contract harvest and haulage', values: [159656, 166451] },
    { label: 'External contractor costs', values: [69270, 85703] },
    {
      label: 'Other operating expenses',
      values: [options.totalOperatingOverride ?? 22759, 17406],
    },
    { label: 'Materials', values: [15180, 17144] },
    { label: 'Occupancy costs other than long-term leases', values: [1831, 1790] },
    { label: 'Forest management and licence costs', values: [1014, 956] },
    { label: 'Travel and accommodation', values: [2011, 2164] },
    { label: 'Communication and computer costs', values: [5334, 4523] },
    { label: 'Insurance and state taxes', values: [2416, 2003] },
    { label: 'Consultants', values: [220, 3384] },
    { values: [279691, 301524] },
  ];
  let y = 511.2;
  for (const row of operating) {
    if (row.label) items.push(item(row.label, 45, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = OPERATING_RIGHTS[index];
      if (right === undefined) return;
      items.push(money(cellFor(value), right, y, pageNumber));
    });
    y -= 15.6;
  }
  const employee: RowSpec[] = [
    {
      label: 'Salaries, wages, and on-costs*',
      values: [options.salariesOverride ?? 80800, 81957],
    },
    { label: 'Defined contribution superannuation expense', values: [7255, 6643] },
    { label: 'Defined benefit contributions', values: [1555, 1626] },
    { values: [89610, 90226] },
  ];
  y = 205.3;
  for (const row of employee) {
    if (row.label) items.push(item(row.label, 47, y, pageNumber));
    (row.values ?? []).forEach((value, index) => {
      const right = EMPLOYEE_RIGHTS[index];
      if (right === undefined) return;
      items.push(money(cellFor(value), right, y, pageNumber));
    });
    y -= 16.5;
  }
  return {
    page_number: pageNumber,
    text: 'Note 8. Other operating expenses Contract harvest and haulage External contractor costs Other operating expenses Materials Occupancy costs other than long-term leases Forest management and licence costs Travel and accommodation Communication and computer costs Insurance and state taxes Consultants Note 9. Employee benefits expense Salaries, wages, and on-costs Defined contribution superannuation expense Defined benefit contributions $‘000',
    items,
  };
}

function financeCostsPage(options: { unit?: string } = {}): PdfPage {
  const unit = options.unit ?? '$‘000';
  const pageNumber = 61;
  const items: PdfTextItem[] = [
    item('Forestry Corporation of New South Wales', 57, 788.9, pageNumber),
    item('Note 10. Finance costs', 57, 716.2, pageNumber),
    item('30 June 2025', 418, 695.1, pageNumber),
    item('30 June 2024', 489, 695.1, pageNumber),
    item(unit, 452, 684.6, pageNumber),
    item(unit, 523, 684.6, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: ['Amortisation -', 'Premium on borrowings'], values: [-101, -171] },
    { label: 'Government guarantee fee', values: [950, 774] },
    { label: 'Interest expenses', values: [1982, 1445] },
    { label: 'Lease interest', values: [237, 271] },
    { values: [3068, 2319] },
  ];
  let y = 661.8;
  for (const row of rows) {
    if (row.label) {
      const labels = Array.isArray(row.label) ? row.label : [row.label];
      let x = 60;
      for (const label of labels) {
        items.push(item(label, x, y, pageNumber));
        x += label.length * 5.5;
      }
    }
    (row.values ?? []).forEach((value, index) => {
      const right = NOTE_RIGHTS[index];
      if (right === undefined) return;
      items.push(money(cellFor(value), right, y, pageNumber));
    });
    y -= 15.6;
  }
  return {
    page_number: pageNumber,
    text: 'Note 10. Finance costs 30 June 2025 $‘000 Government guarantee fee Amortisation - Premium on borrowings Interest expenses Lease interest',
    items,
  };
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    otherIncome?: Parameters<typeof otherIncomePage>[0];
    operating?: Parameters<typeof operatingExpensesPage>[0];
    finance?: Parameters<typeof financeCostsPage>[0];
    includeOtherIncome?: boolean;
    includeOperating?: boolean;
    includeFinance?: boolean;
  } = {},
): PdfExtraction {
  const pages = [statementPage(options.statement)];
  if (options.includeOtherIncome !== false) pages.push(otherIncomePage(options.otherIncome));
  if (options.includeOperating !== false) pages.push(operatingExpensesPage(options.operating));
  if (options.includeFinance !== false) pages.push(financeCostsPage(options.finance));
  return {
    source: { url: PDF_URL, sha256: 'f'.repeat(64), bytes: 6_448_775 },
    pages,
    text: 'Statement of profit or loss and other comprehensive income For the year ended 30 June 2025',
    tables: [],
    warnings: [],
  };
}

const context: ForestryCorporationParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2024–25',
  fiscal_year: '2024-25',
  archive: {
    local_path: '/archive/forestry-corporation/forestry-corporation-ar-2024-25.pdf',
    sha256: 'f'.repeat(64),
    bytes: 6_448_775,
  },
  source_date: '2026-11-17',
};

function recordFor(
  result: ReturnType<typeof parseForestryCorporationExtraction>,
  lineItem: string,
) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Forestry Corporation annual-report discovery', () => {
  it('selects the latest annual-report PDF and ignores non-annual PDFs', () => {
    const pageHtml = `
      <a href="/__data/assets/pdf_file/0008/1499255/forestry-corporation-nsw-annual-report-2022-23.pdf">2022-23</a>
      <a href="/__data/assets/pdf_file/0009/1591362/annual-report-2023-24.pdf">2023-24</a>
      <a href="/__data/assets/pdf_file/0009/1650285/annual-report-2024-25.pdf">2024-25</a>
      <a href="/__data/assets/pdf_file/0007/1278340/FCNSW_Fraud-and-Corruption-Annual-Report.pdf">Fraud</a>
      <a href="/__data/assets/pdf_file/0008/1436390/forestry-corporation-annual-report_FY22.pdf">FY22</a>
      <a href="/__data/assets/pdf_file/9999/sustainability-report-2024.pdf">Sustainability</a>`;
    const links = parseForestryCorporationAnnualReportPdfLinks(
      pageHtml,
      'https://www.forestrycorporation.com.au/about/pubs/corporate/annual-report',
    );
    expect(links[0]).toMatchObject({ fiscal_year: '2024-25', url: PDF_URL });
    expect(links.map((link) => link.fiscal_year)).toEqual([
      '2024-25',
      '2023-24',
      '2022-23',
      '2021-22',
    ]);
    expect(links.some((link) => /fraud|sustainability/i.test(link.filename))).toBe(false);
  });
});

describe("Forestry Corporation $'000 unit guard", () => {
  it('detects an explicit curly-quote $‘000 unit and converts at 100,000 cents per unit', () => {
    const unit = detectForestryCorporationUnit(['$‘000 30 June 2025 $‘000 30 June 2024']);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseForestryCorporationExtraction(
      extraction({ statement: { unit: '' } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it("rejects a statement read as dollars or millions instead of $'000", () => {
    const dollars = parseForestryCorporationStatement(statementPage({ unit: '$' }));
    expect(dollars?.unit.kind).toBe('dollars');
    expect(dollars?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const millions = parseForestryCorporationExtraction(
      extraction({ statement: { unit: '$M' } }),
      context,
    );
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
  });
});

describe('Forestry Corporation exact reconciliation and rows', () => {
  it('accepts the printed total expenses and reconciles every printed bridge exactly', () => {
    const result = parseForestryCorporationExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(388557);
    expect(result.statement?.total_expenses).toBe(384532);
    expect(result.statement?.pbt).toBe(28833);
    expect(result.statement?.net_result).toBe(19838);
    expect(result.checks.join(' ')).toContain(
      'expense components exact: 279691 + 89610 + 12163 + 3068 = 384532 (printed Total expenses)',
    );
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 388557 + (384532) + 33809 + -82 + -8274 + -171 + -474 + 0 = 28833',
    );
    expect(result.checks.join(' ')).toContain('net-result bridge exact: 28833 + (-8995) = 19838');
    expect(result.checks.join(' ')).toContain(
      'Note 9 Employee benefits exact: 80800 + 7255 + 1555 = 89610',
    );
  });

  it('maps the required lines with provenance, exact cents and a positive net result', () => {
    const result = parseForestryCorporationExtraction(extraction(), context);
    expect(result.records).toHaveLength(7);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 38_453_200_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'Forestry Corporation of NSW',
      funding_source: 'Forestry Corporation of NSW',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: FORESTRY_CORPORATION_ID,
      source_url: PDF_URL,
      source_dataset: 'Forestry Corporation of NSW Annual Report 2024-25',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(38_855_700_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(8_961_000_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(1_216_300_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 1_983_800_000,
      soc_printed_sign: 'positive',
    });
    expect(recordFor(result, 'government_grants_community_service_obligations')).toMatchObject({
      amount_cents: 3_151_100_000,
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
    });
    expect(recordFor(result, 'government_grants_other_state_government')).toMatchObject({
      amount_cents: 1_219_200_000,
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
    });
    expect(recordFor(result, 'total_expenses')?.notes).toMatch(/human_spot_check: required/);
    expect(recordFor(result, 'net_result')?.notes).toMatch(/human_spot_check: required/);
  });

  it('defers on a one-thousand expense-component mismatch instead of ingesting', () => {
    const result = parseForestryCorporationExtraction(
      extraction({ statement: { totalExpensesOverride: -384533 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand profit-before-tax mismatch instead of ingesting', () => {
    const result = parseForestryCorporationExtraction(
      extraction({ statement: { pbtOverride: 28834 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the Note 5 grant rows do not reconcile to Other income', () => {
    const result = parseForestryCorporationExtraction(
      extraction({ otherIncome: { csoOverride: 31512 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 5 Other income mismatch/);
  });

  it('defers when the Note 9 employee-benefit components do not sum to the statement line', () => {
    const result = parseForestryCorporationExtraction(
      extraction({ operating: { salariesOverride: 80801 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Note 9 Employee benefits mismatch/);
  });

  it('defers when the Note 5 Other income table is missing', () => {
    const result = parseForestryCorporationExtraction(
      extraction({ includeOtherIncome: false }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('notes');
  });

  it('defers when the Note 10 Finance costs table is missing', () => {
    const result = parseForestryCorporationExtraction(
      extraction({ includeFinance: false }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('notes');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseForestryCorporationExtraction(extraction(), {
      ...context,
      fiscal_year: '2023-24',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });

  it("parses the Note 5, 8, 9 and 10 tables directly with explicit $'000 units", () => {
    const otherIncome = parseForestryCorporationOtherIncomeNote(otherIncomePage());
    expect(otherIncome.unit.kind).toBe('thousands');
    expect(otherIncome.cso_grants).toBe(31511);
    expect(otherIncome.other_state_grants).toBe(12192);
    expect(otherIncome.section44_reimbursement).toBe(0);
    expect(otherIncome.other_services_rendered).toBe(5130);

    const operating = parseForestryCorporationOperatingExpensesNote(operatingExpensesPage());
    expect(operating.unit.kind).toBe('thousands');
    expect(operating.contract_harvest_haulage).toBe(159656);
    expect(operating.consultants).toBe(220);

    const employee = parseForestryCorporationEmployeeBenefitsNote(operatingExpensesPage());
    expect(employee.salaries_wages_oncosts).toBe(80800);
    expect(employee.defined_contribution_superannuation).toBe(7255);
    expect(employee.defined_benefit_contributions).toBe(1555);

    const finance = parseForestryCorporationFinanceCostsNote(financeCostsPage());
    expect(finance.amortisation_premium_on_borrowings).toBe(-101);
    expect(finance.government_guarantee_fee).toBe(950);
    expect(finance.interest_expenses).toBe(1982);
    expect(finance.lease_interest).toBe(237);
  });
});

describe('Forestry Corporation natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = forestryCorporationNaturalKey(
      'Forestry Corporation of NSW',
      '2024-25',
      'total_expenses',
      PDF_URL,
    );
    expect(key).toMatch(/^forestry-corporation:[0-9a-f]{40}$/);
    expect(key).toBe(
      forestryCorporationNaturalKey(
        'Forestry Corporation of NSW',
        '2024-25',
        'total_expenses',
        PDF_URL,
      ),
    );
    expect(key).not.toBe(
      forestryCorporationNaturalKey(
        'Forestry Corporation of NSW',
        '2024-25',
        'total_revenue',
        PDF_URL,
      ),
    );
    expect(key).not.toBe(
      forestryCorporationNaturalKey(
        'Forestry Corporation of NSW',
        '2023-24',
        'total_expenses',
        PDF_URL,
      ),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseForestryCorporationExtraction(extraction(), context);
    const second = parseForestryCorporationExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Forestry Corporation no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseForestryCorporationExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags the two government-grant rows but not the own-source revenue/expense/result rows', () => {
    const result = parseForestryCorporationExtraction(extraction(), context);
    expect(recordFor(result, 'total_revenue')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'total_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'employee_expenses')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'depreciation_amortisation')?.potential_double_count).toBe(false);
    expect(recordFor(result, 'net_result')?.potential_double_count).toBe(false);
    const flagged = result.records.filter((record) => record.potential_double_count);
    expect(flagged.map((record) => record.soc_line_item)).toEqual([
      'government_grants_community_service_obligations',
      'government_grants_other_state_government',
    ]);
  });
});
