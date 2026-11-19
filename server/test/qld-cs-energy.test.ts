import { describe, expect, it } from 'vitest';
import {
  CS_ENERGY_ID,
  csEnergyFiscalYearFromReportYear,
  csEnergyNaturalKey,
  detectCsEnergyUnit,
  parseCsEnergyAnnualReportPdfLinks,
  parseCsEnergyExtraction,
  parseCsEnergyStatement,
  type CsEnergyParseContext,
} from '../src/connectors/soc/qld/cs-energy.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.csenergy.com.au/ArticleDocuments/276/CS%20ENERGY%20ANNUAL%20REPORT%202026.pdf.aspx';

function item(str: string, x: number, y: number, page = 37, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 37): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const CURRENT = 478;
const PRIOR = 538;

interface RowSpec {
  label: string;
  values: Array<number | null>;
}

function numberCell(value: number): string {
  return value.toLocaleString('en-AU');
}

function statementPage(
  options: {
    unit?: string;
    pbtOverride?: number;
    employeeOverride?: number;
    netOverride?: number;
    revenueOverride?: number;
  } = {},
): PdfPage {
  const unit = options.unit ?? "$'000";
  const pageNumber = 37;
  const items: PdfTextItem[] = [
    item('CS Energy Limited', 58, 728, pageNumber),
    item('Consolidated statement of profit or loss and other comprehensive income', 58, 718, pageNumber),
    item('For the year ended 30 June 2026', 58, 709, pageNumber),
    item('2026', 471, 689, pageNumber),
    item('2025', 531, 689, pageNumber),
    item('Note', 411, 677, pageNumber),
    item(unit, 469, 677, pageNumber),
    item(unit, 529, 677, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Revenue', values: [options.revenueOverride ?? 1_856_656, 1_904_008] },
    { label: 'Loss on disposed assets', values: [-33_188, -260] },
    { label: 'Interest income', values: [20_866, 37_466] },
    { label: 'Other income', values: [236_097, 4_858] },
    { label: 'Fuel', values: [-211_428, -172_456] },
    { label: 'Electricity and energy services expense', values: [-751_653, -875_361] },
    { label: 'Services and consultants', values: [-304_841, -337_736] },
    { label: 'Finance costs', values: [-103_865, -99_336] },
    {
      label: 'Employee benefit expense',
      values: [-(options.employeeOverride ?? 218_087), -202_071],
    },
    { label: 'Raw materials and consumables', values: [-90_546, -61_976] },
    { label: 'Capacity payments and operating leases', values: [-51_379, -49_973] },
    { label: 'Other expenses', values: [-151_784, -115_080] },
    { label: 'Fair value through profit/(loss)', values: [-63_561, -123_781] },
    { label: 'Depreciation and amortisation', values: [-120_268, -147_341] },
    { label: 'Impairment (losses)', values: [-11_311, -82_906] },
    { label: 'Provision remeasurements', values: [-12_284, 109_861] },
    {
      label: 'Loss before income tax expense',
      values: [options.pbtOverride ?? -10_576, -212_084],
    },
    { label: 'Income tax expense', values: [-16_851, -112_299] },
    {
      label: 'Loss after income tax expense for the year',
      values: [options.netOverride ?? -27_427, -324_383],
    },
  ];
  let y = 658;
  for (const row of rows) {
    items.push(item(row.label, 58, y, pageNumber));
    row.values.forEach((value, index) => {
      const right = index === 0 ? CURRENT : PRIOR;
      if (value === null) return;
      items.push(
        money(
          value < 0 ? `(${numberCell(Math.abs(value))})` : numberCell(value),
          right,
          y,
          pageNumber,
        ),
      );
    });
    y -= 12;
  }
  return {
    page_number: pageNumber,
    text: `CS Energy Limited Consolidated statement of profit or loss and other comprehensive income For the year ended 30 June 2026 2026 2025 Note $'000 $'000 Revenue Loss on disposed assets Interest income Other income Expenses Fuel Electricity and energy services expense Services and consultants Finance costs Employee benefit expense Raw materials and consumables Capacity payments and operating leases Other expenses Fair value through profit/(loss) Depreciation and amortisation Impairment (losses) Provision remeasurements Loss before income tax expense Income tax expense Loss after income tax expense for the year`,
    items,
  };
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    text?: string;
  } = {},
): PdfExtraction {
  return {
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 2_712_680 },
    pages: [statementPage(options.statement)],
    text: options.text ?? 'For the year ended 30 June 2026',
    tables: [],
    warnings: [],
  };
}

const context: CsEnergyParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/qld-cs-energy/cs-energy-ar-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 2_712_680,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseCsEnergyExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('CS Energy annual-report discovery', () => {
  it('selects the latest annual-report PDF and ignores sustainability and corporate-intent files', () => {
    const html = `
      <a href="/ArticleDocuments/276/CS%20ENERGY%20ANNUAL%20REPORT%202024%20ONLINE%202024.pdf.aspx">2024</a>
      <a href="/ArticleDocuments/191/CS%20ENERGY%20ANNUAL%20REPORT%202025%20FULL%20COLOUR%2020250926.pdf.aspx">2025</a>
      <a href="/ArticleDocuments/276/CS%20ENERGY%20ANNUAL%20REPORT%202026.pdf.aspx">2026</a>
      <a href="/ArticleDocuments/276/CS%20ENERGY%20SUSTAINABILITY%20REPORT%202026.pdf.aspx">Sustainability</a>
      <a href="/ArticleDocuments/276/CS%20ENERGY%20STATEMENT%20OF%20CORPORATE%20INTENT%202026.pdf.aspx">SCI</a>`;
    const links = parseCsEnergyAnnualReportPdfLinks(
      html,
      'https://www.csenergy.com.au/who-we-are/reports-and-publications/annual-reports',
    );
    expect(links[0]).toMatchObject({
      fiscal_year: '2025-26',
      url: 'https://www.csenergy.com.au/ArticleDocuments/276/CS%20ENERGY%20ANNUAL%20REPORT%202026.pdf.aspx',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.some((link) => /sustainability|corporate|intent/i.test(link.filename))).toBe(false);
  });

  it('maps report year 2026 to FY2025-26 and rejects impossible years', () => {
    expect(csEnergyFiscalYearFromReportYear(2026)).toBe('2025-26');
    expect(csEnergyFiscalYearFromReportYear(2025)).toBe('2024-25');
    expect(csEnergyFiscalYearFromReportYear(1999)).toBeNull();
  });
});

describe('CS Energy $000 unit guard', () => {
  it("detects the printed $'000 unit at 100,000 cents per unit", () => {
    const unit = detectCsEnergyUnit(["$'000 2026 $'000 2025"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseCsEnergyExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseCsEnergyStatement(statementPage({ unit: '$m' }));
    expect(millions?.unit.kind).toBe('millions');
    expect(millions?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const thousands = parseCsEnergyExtraction(
      extraction({ statement: { unit: '$' } }),
      context,
    );
    expect(thousands.records).toHaveLength(0);
    expect(thousands.deferral?.phase).toBe('unit');
  });
});

describe('CS Energy exact reconciliation and rows', () => {
  it('derives total revenue and total expenses and reconciles the printed bridges exactly', () => {
    const result = parseCsEnergyExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(2_113_619);
    expect(result.statement?.total_expenses).toBe(2_124_195);
    expect(result.statement?.loss_before_tax).toBe(-10_576);
    expect(result.statement?.net_result).toBe(-27_427);
    expect(result.statement?.employee_benefit_expense).toBe(218_087);
    expect(result.statement?.depreciation_and_amortisation).toBe(120_268);
    expect(result.checks.join(' ')).toContain(
      'income components exact: 1856656 + 20866 + 236097 = 2113619',
    );
    expect(result.checks.join(' ')).toContain(
      'expense components exact: 33188 + 211428 + 751653 + 304841 + 103865 + 218087 + 90546 + 51379 + 151784 + 63561 + 120268 + 11311 + 12284 = 2124195',
    );
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 2113619 - 2124195 = -10576',
    );
    expect(result.checks.join(' ')).toContain('net-result bridge exact: -10576 + -16851 = -27427');
  });

  it('maps the five required lines with provenance, exact cents and a negative printed sign on the loss', () => {
    const result = parseCsEnergyExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 212_419_500_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'QLD',
      delivery_entity: 'CS Energy',
      funding_source: 'CS Energy',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: CS_ENERGY_ID,
      source_url: PDF_URL,
      source_dataset: 'CS Energy Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Face statement',
      extraction_confidence: 'high',
      location: { state: 'QLD' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(211_361_900_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(21_808_700_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(12_026_800_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 2_742_700_000,
      soc_printed_sign: 'negative',
    });
  });

  it('defers on a one-thousand profit-before-tax mismatch instead of ingesting', () => {
    const result = parseCsEnergyExtraction(
      extraction({ statement: { pbtOverride: -10_575 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand expense-component mismatch instead of ingesting', () => {
    const result = parseCsEnergyExtraction(
      extraction({ statement: { employeeOverride: 218_088 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the net-result bridge does not reconcile', () => {
    const result = parseCsEnergyExtraction(
      extraction({ statement: { netOverride: -27_428 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseCsEnergyExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('CS Energy natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = csEnergyNaturalKey('CS Energy', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^qld-cs-energy:[0-9a-f]{40}$/);
    expect(key).toBe(csEnergyNaturalKey('CS Energy', '2025-26', 'total_expenses', PDF_URL));
    expect(key).not.toBe(csEnergyNaturalKey('CS Energy', '2025-26', 'total_revenue', PDF_URL));
    expect(key).not.toBe(csEnergyNaturalKey('CS Energy', '2024-25', 'total_expenses', PDF_URL));
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseCsEnergyExtraction(extraction(), context);
    const second = parseCsEnergyExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('CS Energy no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseCsEnergyExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['CS Energy']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['QLD']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(CS_ENERGY_ID);
      expect(record.potential_double_count).toBe(false);
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
    expect(
      result.records.some((record) => /total.*qld|qld.*total/i.test(record.soc_line_item ?? '')),
    ).toBe(false);
  });
});
