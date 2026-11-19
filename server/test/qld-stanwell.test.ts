import { describe, expect, it } from 'vitest';
import {
  STANWELL_ID,
  detectStanwellUnit,
  parseStanwellAnnualReportPdfLinks,
  parseStanwellExtraction,
  parseStanwellStatement,
  stanwellFiscalYearFromFilename,
  stanwellNaturalKey,
  type StanwellParseContext,
} from '../src/connectors/soc/qld/stanwell.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://assets.ctfassets.net/g6959sqmk0wu/6tf7j1YqIxYVp19TAh4H5n/34c80c2ffcf28585b9786885a3cdb6d3/Stanwell-Corporation--Annual-Report-2025-26.pdf';

function item(str: string, x: number, y: number, page = 69, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 69): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const CURRENT = 470;
const PRIOR = 540;

interface RowSpec {
  label: string;
  values: Array<number | string | null>;
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
  const unit = options.unit ?? '$’000';
  const pageNumber = 69;
  const items: PdfTextItem[] = [
    item('Stanwell Corporation Limited', 58, 728, pageNumber),
    item(
      'Consolidated statement of profit or loss and other comprehensive income',
      58,
      718,
      pageNumber,
    ),
    item('For the year ended 30 June 2026', 58, 709, pageNumber),
    item('Consolidated', 444, 689, pageNumber),
    item('2026', 445, 674, pageNumber),
    item('2025', 516, 674, pageNumber),
    item('Note', 375, 665, pageNumber),
    item(unit, 441, 665, pageNumber),
    item(unit, 512, 665, pageNumber),
  ];
  const rows: RowSpec[] = [
    {
      label: 'Revenue and other income',
      values: [options.revenueOverride ?? 3_173_199, 3_377_924],
    },
    { label: 'Finance income', values: [69_327, 75_225] },
    { label: 'Electricity and energy services expense', values: [-1_358_558, -1_558_030] },
    { label: 'Fuel costs', values: [-425_112, -436_467] },
    { label: 'Raw materials and consumables used', values: [-102_288, -80_419] },
    {
      label: 'Employee benefits expense',
      values: [-(options.employeeOverride ?? 228_716), -210_032],
    },
    { label: 'Depreciation and amortisation expense', values: [-270_134, -195_761] },
    { label: 'Other expenses', values: [-327_004, -236_174] },
    { label: 'Finance costs', values: [-96_982, -65_548] },
    {
      label: 'Expected credit loss (expense)/reversal on receivables',
      values: [117_155, -117_252],
    },
    {
      label: 'Loss arising from the renegotiation of supply contract',
      values: [-661_559, -32_192],
    },
    { label: 'Impairment reversal', values: ['-', 411_628] },
    {
      label: 'Non hedge accounted change in fair value of derivative instruments',
      values: [-492_083, -300_151],
    },
    {
      label: 'Profit/(loss) before income tax equivalent (expense)/benefit',
      values: [options.pbtOverride ?? -602_755, 632_751],
    },
    { label: 'Income tax equivalent (expense)/benefit', values: [188_091, -203_519] },
    {
      label: 'Profit/(loss) after income tax equivalent (expense)/benefit for the year',
      values: [options.netOverride ?? -414_664, 429_232],
    },
  ];
  let y = 648;
  for (const row of rows) {
    items.push(item(row.label, 58, y, pageNumber));
    row.values.forEach((value, index) => {
      const right = index === 0 ? CURRENT : PRIOR;
      if (value === null) return;
      const text =
        typeof value === 'string'
          ? value
          : value < 0
            ? `(${numberCell(Math.abs(value))})`
            : numberCell(value);
      items.push(money(text, right, y, pageNumber));
    });
    y -= 12;
  }
  return {
    page_number: pageNumber,
    text: `Stanwell Corporation Limited Consolidated statement of profit or loss and other comprehensive income For the year ended 30 June 2026 2026 2025 Note $’000 $’000 Revenue and other income Finance income Electricity and energy services expense Fuel costs Raw materials and consumables used Employee benefits expense Depreciation and amortisation expense Other expenses Finance costs Expected credit loss (expense)/reversal on receivables Loss arising from the renegotiation of supply contract Impairment reversal Non hedge accounted change in fair value of derivative instruments Profit/(loss) before income tax equivalent (expense)/benefit Income tax equivalent (expense)/benefit Profit/(loss) after income tax equivalent (expense)/benefit for the year`,
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
    source: { url: PDF_URL, sha256: 'a'.repeat(64), bytes: 7_405_029 },
    pages: [statementPage(options.statement)],
    text: options.text ?? 'For the year ended 30 June 2026',
    tables: [],
    warnings: [],
  };
}

const context: StanwellParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/qld-stanwell/Stanwell-Corporation-Annual-Report-2025-26.pdf',
    sha256: 'a'.repeat(64),
    bytes: 7_405_029,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseStanwellExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Stanwell annual-report discovery', () => {
  it('selects the latest annual-report PDF and ignores sustainability, submissions and newsletters', () => {
    const html = `
      <a href="https://assets.ctfassets.net/x/1/Stanwell-Corporation--Annual-Report-2023-24.pdf">2023-24</a>
      <a href="https://assets.ctfassets.net/x/2/Stanwell-Corporation--Annual-Report-2024-25.pdf">2024-25</a>
      <a href="https://assets.ctfassets.net/x/3/Stanwell-Corporation--Annual-Report-2025-26.pdf">2025-26</a>
      <a href="https://assets.ctfassets.net/x/4/Stanwell-Sustainability-Report-2025-26.pdf">Sustainability</a>
      <a href="https://assets.ctfassets.net/x/5/Stanwell_Submission_-_Annual_Report_2025-26.pdf">Submission</a>
      <a href="https://assets.ctfassets.net/x/6/Community_Newsletter_August_2026.pdf">Newsletter</a>`;
    const links = parseStanwellAnnualReportPdfLinks(html, 'https://www.stanwell.com/about-us');
    expect(links[0]).toMatchObject({
      fiscal_year: '2025-26',
      discovery_page: 'https://www.stanwell.com/about-us',
      url: 'https://assets.ctfassets.net/x/3/Stanwell-Corporation--Annual-Report-2025-26.pdf',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25', '2023-24']);
    expect(links.some((link) => /sustainability|submission|newsletter/i.test(link.filename))).toBe(
      false,
    );
  });

  it('maps a filename fiscal-year span to the API fiscal year and rejects impossible spans', () => {
    expect(stanwellFiscalYearFromFilename('Stanwell-Corporation--Annual-Report-2025-26.pdf')).toBe(
      '2025-26',
    );
    expect(stanwellFiscalYearFromFilename('Stanwell-Corporation--Annual-Report-2024-25.pdf')).toBe(
      '2024-25',
    );
    expect(
      stanwellFiscalYearFromFilename('Stanwell-Corporation--Annual-Report-2025-27.pdf'),
    ).toBeNull();
    expect(stanwellFiscalYearFromFilename('Stanwell-Sustainability-Report-2025-26.pdf')).toBeNull();
  });
});

describe('Stanwell $000 unit guard', () => {
  it('detects the printed $’000 unit at 100,000 cents per unit', () => {
    const unit = detectStanwellUnit(['$’000 2026 $’000 2025']);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseStanwellExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });

  it('rejects a statement read as dollars or millions instead of $000', () => {
    const millions = parseStanwellStatement(statementPage({ unit: '$m' }));
    expect(millions?.unit.kind).toBe('millions');
    expect(millions?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const thousands = parseStanwellExtraction(extraction({ statement: { unit: '$' } }), context);
    expect(thousands.records).toHaveLength(0);
    expect(thousands.deferral?.phase).toBe('unit');
  });
});

describe('Stanwell exact reconciliation and rows', () => {
  it('derives total revenue and total expenses and reconciles the printed bridges exactly', () => {
    const result = parseStanwellExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(3_242_526);
    expect(result.statement?.total_expenses).toBe(3_845_281);
    expect(result.statement?.profit_before_tax).toBe(-602_755);
    expect(result.statement?.net_result).toBe(-414_664);
    expect(result.statement?.employee_benefits_expense).toBe(228_716);
    expect(result.statement?.depreciation_and_amortisation).toBe(270_134);
    expect(result.checks.join(' ')).toContain('income components exact: 3173199 + 69327 = 3242526');
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 3242526 - 3845281 = -602755',
    );
    expect(result.checks.join(' ')).toContain(
      'net-result bridge exact: -602755 + 188091 = -414664',
    );
    expect(result.checks.join(' ')).toContain(
      'Impairment reversal printed as a nil marker ("-"), read as 0',
    );
  });

  it('maps the five required lines with provenance, exact cents and a negative printed sign on the loss', () => {
    const result = parseStanwellExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 384_528_100_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'QLD',
      delivery_entity: 'Stanwell Corporation',
      funding_source: 'Stanwell Corporation',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: STANWELL_ID,
      source_url: PDF_URL,
      source_dataset: 'Stanwell Corporation Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      soc_section: 'expenses',
      soc_note: 'Face statement',
      extraction_confidence: 'high',
      location: { state: 'QLD' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(324_252_600_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(22_871_600_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(27_013_400_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 41_466_400_000,
      soc_printed_sign: 'negative',
    });
  });

  it('defers on a one-thousand profit-before-tax mismatch instead of ingesting', () => {
    const result = parseStanwellExtraction(
      extraction({ statement: { pbtOverride: -602_754 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand expense-component mismatch instead of ingesting', () => {
    const result = parseStanwellExtraction(
      extraction({ statement: { employeeOverride: 228_717 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the net-result bridge does not reconcile', () => {
    const result = parseStanwellExtraction(
      extraction({ statement: { netOverride: -414_665 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseStanwellExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Stanwell natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = stanwellNaturalKey('Stanwell Corporation', '2025-26', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^qld-stanwell:[0-9a-f]{40}$/);
    expect(key).toBe(
      stanwellNaturalKey('Stanwell Corporation', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      stanwellNaturalKey('Stanwell Corporation', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      stanwellNaturalKey('Stanwell Corporation', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseStanwellExtraction(extraction(), context);
    const second = parseStanwellExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Stanwell no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseStanwellExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Stanwell Corporation']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['QLD']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(STANWELL_ID);
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
