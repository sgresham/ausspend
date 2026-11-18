import { describe, expect, it } from 'vitest';
import {
  ENERGY_QUEENSLAND_ID,
  ENERGY_QUEENSLAND_PARLIAMENT_FALLBACK_URL,
  detectEnergyQueenslandUnit,
  discoverEnergyQueenslandAnnualReport,
  energyQueenslandNaturalKey,
  parseEnergyQueenslandAnnualReportPdfLinks,
  parseEnergyQueenslandExtraction,
  parseEnergyQueenslandStatement,
  type EnergyQueenslandParseContext,
} from '../src/connectors/soc/qld/energy-queensland.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1808/5826t1808.pdf';

function item(str: string, x: number, y: number, page = 30, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 30): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const CURRENT = 468;
const PRIOR = 540;

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
    revenueOverride?: number;
  } = {},
): PdfPage {
  const unit = options.unit ?? 'In millions of dollars';
  const pageNumber = 30;
  const items: PdfTextItem[] = [
    item('Consolidated statement of profit or loss', 34, 788, pageNumber),
    item('For the year ended 30 June 2026', 34, 772, pageNumber),
    item(unit, 38, 738, pageNumber),
    item('Note', 372, 738, pageNumber),
    item('2026', 445, 738, pageNumber),
    item('2025', 516, 738, pageNumber),
  ];
  const rows: RowSpec[] = [
    { label: 'Revenue', values: [options.revenueOverride ?? 6698, 6682] },
    { label: 'Transmission charges and electricity purchases', values: [1423, 1653] },
    { label: 'Solar photovoltaic feed in tariff', values: [272, 308] },
    { label: 'Employee expenses', values: [options.employeeOverride ?? 1354, 1408] },
    { label: 'Materials and services', values: [768, 949] },
    { label: 'Depreciation, amortisation and impairments', values: [1325, 1187] },
    { label: 'Net impairment losses on financial assets', values: [28, 26] },
    { label: 'Finance costs', values: [994, 860] },
    { label: 'Fair value losses', values: [299, 31] },
    { label: 'Other expenses', values: [337, 392] },
    {
      label: 'Loss before income tax equivalent benefit',
      values: [options.pbtOverride ?? -102, -132],
    },
    { label: 'Income tax equivalent benefit', values: [35, 38] },
    { label: 'Loss after income tax equivalent benefit', values: [-67, -94] },
  ];
  let y = 718;
  for (const row of rows) {
    items.push(item(row.label, 38, y, pageNumber));
    row.values.forEach((value, index) => {
      const right = index === 0 ? CURRENT : PRIOR;
      if (value === null) return;
      items.push(money(value < 0 ? `(${numberCell(Math.abs(value))})` : numberCell(value), right, y, pageNumber));
    });
    y -= 17;
  }
  return {
    page_number: pageNumber,
    text: `Consolidated statement of profit or loss For the year ended 30 June 2026 In millions of dollars Revenue Expenses Transmission charges and electricity purchases Solar photovoltaic feed in tariff Employee expenses Materials and services Depreciation, amortisation and impairments Net impairment losses on financial assets Finance costs Fair value losses Other expenses Loss before income tax equivalent benefit Income tax equivalent benefit Loss after income tax equivalent benefit`,
    items,
  };
}

function prosePage(total = 6800): PdfPage {
  return {
    page_number: 26,
    text: `Directors' report Expenditure Total expenses for the year (excluding income tax) of $${total.toLocaleString('en-AU')} million (2025: $6,814 million) was contained.`,
    items: [],
  };
}

function extraction(
  options: {
    statement?: Parameters<typeof statementPage>[0];
    proseTotal?: number | null;
    includeProse?: boolean;
    text?: string;
  } = {},
): PdfExtraction {
  const pages = [statementPage(options.statement)];
  if (options.includeProse !== false) pages.push(prosePage(options.proseTotal ?? 6800));
  return {
    source: { url: PDF_URL, sha256: 'f'.repeat(64), bytes: 2_150_680 },
    pages,
    text: options.text ?? 'Consolidated statement of profit or loss For the year ended 30 June 2026',
    tables: [],
    warnings: [],
  };
}

const context: EnergyQueenslandParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2025–26',
  fiscal_year: '2025-26',
  archive: {
    local_path: '/archive/qld-energy-queensland/energy-queensland-ar-2025-26.pdf',
    sha256: 'f'.repeat(64),
    bytes: 2_150_680,
  },
  source_date: '2026-11-19',
};

function recordFor(result: ReturnType<typeof parseEnergyQueenslandExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('Energy Queensland annual-report discovery', () => {
  it('selects the latest Energy Queensland annual-report PDF and ignores other report types', () => {
    const html = `
      <a href="/__data/assets/pdf_file/0006/2065830/Energy-Queensland-Limited-Annual-Report-2024-25.pdf">2024-25</a>
      <a href="/__data/assets/pdf_file/0004/2143372/Energy-Queensland-Limited-Annual-Report-2025-26.pdf">2025-26</a>
      <a href="/__data/assets/pdf_file/0007/2065831/Energy-Queensland-Limited-Statement-of-Corporate-Intent-2024-25.pdf">SCI</a>
      <a href="/__data/assets/pdf_file/0010/1234567/Ergon-Energy-Queensland-Annual-Financial-Report-2025-26.pdf">Ergon</a>
      <a href="/__data/assets/pdf_file/0011/1234567/Energy-Queensland-Sustainability-Report-2025-26.pdf">Sustainability</a>`;
    const links = parseEnergyQueenslandAnnualReportPdfLinks(
      html,
      'https://www.energyq.com.au/about-us/corporate-reports',
    );
    expect(links[0]).toMatchObject({
      fiscal_year: '2025-26',
      access: 'official',
      url: 'https://www.energyq.com.au/__data/assets/pdf_file/0004/2143372/Energy-Queensland-Limited-Annual-Report-2025-26.pdf',
    });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.some((link) => /intent|ergon|sustainability/i.test(link.filename))).toBe(false);
  });

  it('falls back to the verified Queensland Parliament tabled-paper copy when the corporate site is blocked', async () => {
    const fetchImpl = (async () =>
      new Response('cloudflare challenge', { status: 403 })) as unknown as typeof fetch;
    const document = await discoverEnergyQueenslandAnnualReport(
      fetchImpl,
      'https://www.energyq.com.au/about-us/corporate-reports',
    );
    expect(document).toMatchObject({
      url: ENERGY_QUEENSLAND_PARLIAMENT_FALLBACK_URL,
      fiscal_year: '2025-26',
      access: 'qld-parliament-fallback',
    });
  });
});

describe('Energy Queensland $m unit guard', () => {
  it('detects the printed "In millions of dollars" unit at 100,000,000 cents per unit', () => {
    const unit = detectEnergyQueenslandUnit(['In millions of dollars Note 2026 2025']);
    expect(unit.kind).toBe('millions');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000_000);
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseEnergyQueenslandExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit millions/i);
  });

  it('rejects a statement read as dollars or thousands instead of $m', () => {
    const dollars = parseEnergyQueenslandStatement(statementPage({ unit: '$' }));
    expect(dollars?.unit.kind).toBe('dollars');
    expect(dollars?.errors.join(' ')).toMatch(/not explicit millions/i);

    const thousands = parseEnergyQueenslandExtraction(
      extraction({ statement: { unit: "$'000" } }),
      context,
    );
    expect(thousands.records).toHaveLength(0);
    expect(thousands.deferral?.phase).toBe('unit');
  });
});

describe('Energy Queensland exact reconciliation and rows', () => {
  it('derives total expenses and reconciles the face statement and Directors-report total exactly', () => {
    const result = parseEnergyQueenslandExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('millions');
    expect(result.statement?.total_revenue).toBe(6698);
    expect(result.statement?.total_expenses).toBe(6800);
    expect(result.statement?.printed_total_expenses).toBe(6800);
    expect(result.statement?.loss_before_tax).toBe(-102);
    expect(result.statement?.net_result).toBe(-67);
    expect(result.checks.join(' ')).toContain(
      'expense components exact: 1423 + 272 + 1354 + 768 + 1325 + 28 + 994 + 299 + 337 = 6800',
    );
    expect(result.checks.join(' ')).toContain(
      'profit-before-tax bridge exact: 6698 - 6800 = -102',
    );
    expect(result.checks.join(' ')).toContain('net-result bridge exact: -102 + 35 = -67');
    expect(result.checks.join(' ')).toContain(
      "Directors' report printed total expenses agrees: 6800 = statement expense-component sum 6800",
    );
  });

  it('maps the five required lines with provenance, exact cents and a negative printed sign on the loss', () => {
    const result = parseEnergyQueenslandExtraction(extraction(), context);
    expect(result.records).toHaveLength(5);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 680_000_000_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'QLD',
      delivery_entity: 'Energy Queensland',
      funding_source: 'Energy Queensland',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2025-26',
      source_id: ENERGY_QUEENSLAND_ID,
      source_url: PDF_URL,
      source_dataset: 'Energy Queensland Annual Report 2025-26',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_millions',
      soc_section: 'expenses',
      soc_note: 'Face statement',
      extraction_confidence: 'high',
      location: { state: 'QLD' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(669_800_000_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(135_400_000_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(132_500_000_000);
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 6_700_000_000,
      soc_printed_sign: 'negative',
    });
  });

  it('defers on a one-million profit-before-tax mismatch instead of ingesting', () => {
    const result = parseEnergyQueenslandExtraction(
      extraction({ statement: { pbtOverride: -101 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-million expense-component mismatch instead of ingesting', () => {
    const result = parseEnergyQueenslandExtraction(
      extraction({ statement: { employeeOverride: 1355 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the Directors-report total does not match the face statement', () => {
    const result = parseEnergyQueenslandExtraction(extraction({ proseTotal: 6801 }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
    expect(result.deferral?.reason).toMatch(/Directors' report printed total expenses/);
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseEnergyQueenslandExtraction(extraction(), {
      ...context,
      fiscal_year: '2024-25',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('Energy Queensland natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = energyQueenslandNaturalKey(
      'Energy Queensland',
      '2025-26',
      'total_expenses',
      PDF_URL,
    );
    expect(key).toMatch(/^qld-energy-queensland:[0-9a-f]{40}$/);
    expect(key).toBe(
      energyQueenslandNaturalKey('Energy Queensland', '2025-26', 'total_expenses', PDF_URL),
    );
    expect(key).not.toBe(
      energyQueenslandNaturalKey('Energy Queensland', '2025-26', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      energyQueenslandNaturalKey('Energy Queensland', '2024-25', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseEnergyQueenslandExtraction(extraction(), context);
    const second = parseEnergyQueenslandExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('Energy Queensland no-sum / no-cross-entity-total separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseEnergyQueenslandExtraction(extraction(), context);
    expect(new Set(result.records.map((record) => record.delivery_entity))).toEqual(
      new Set(['Energy Queensland']),
    );
    expect(new Set(result.records.map((record) => record.jurisdiction))).toEqual(new Set(['QLD']));
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(record.source_id).toBe(ENERGY_QUEENSLAND_ID);
      expect(record.potential_double_count).toBe(false);
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
    expect(result.records.some((record) => /total.*qld|qld.*total/i.test(record.soc_line_item ?? ''))).toBe(false);
  });
});
