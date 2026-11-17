import { describe, expect, it } from 'vitest';
import {
  detectTaheUnit,
  parseTaheAnnualReportPdfLinks,
  parseTaheExtraction,
  parseTaheStatement,
  taheFiscalYearFromReportYear,
  taheNaturalKey,
  TAHE_ID,
  type TaheParseContext,
} from '../src/connectors/soc/nsw/tahe.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.tam.nsw.gov.au/sites/default/files/2025-01/Transport%20Asset%20Holding%20Entity%20of%20NSW%20202324%20Annual%20Report_0.pdf';

function item(str: string, x: number, y: number, page = 1, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 1): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const STATEMENT_RIGHTS = [462.68, 533.12];

function numberCell(value: number): string {
  const text = Math.abs(value).toLocaleString('en-AU');
  return value < 0 ? `(${text})` : text;
}

interface RowSpec {
  label: string;
  continuation?: string;
  note?: string;
  values: Array<number | '-' | null>;
}

function statementPage(
  options: {
    unit?: string;
    totalExpensesOverride?: number;
    netResultOverride?: number;
  } = {},
): PdfPage {
  const unit = options.unit ?? "$'000";
  const pageNumber = 60;
  const items: PdfTextItem[] = [
    item('Transport Asset Holding Entity of New South Wales', 71.88, 801.72, pageNumber),
    item('Statement of comprehensive income', 71.88, 787.92, pageNumber),
    item('for the year ended 30 June 2024', 71.88, 774.48, pageNumber),
    item('Statement of comprehensive income', 70.92, 760.56, pageNumber),
    item('Note', 371.28, 732, pageNumber),
    item('2024', 442.56, 742.32, pageNumber),
    item(unit, 440.52, 732, pageNumber),
    item('2023', 513, 742.32, pageNumber),
    item(unit, 510.96, 732, pageNumber),
    item('Revenue', 76.32, 705.24, pageNumber),
  ];
  const rows: RowSpec[] = [
    {
      label: 'Revenue from contracts with customers',
      note: '2.1',
      values: [557_518, 623_513],
    },
    { label: 'Investment revenue', note: '2.2', values: [490_176, 535_466] },
    { label: 'Grants and contributions', note: '2.3', values: [1_269_799, 113_856] },
    {
      label: 'Valuation increment of property, plant and equipment and',
      continuation: 'intangible assets',
      note: '6.1,8.2',
      values: [17_787_495, '-'],
    },
    { label: 'Other income', note: '2.4', values: [38_952, 17_014] },
    { label: 'Total revenue', values: [20_143_940, 1_289_849] },
    { label: 'Expenses', values: [] },
    { label: 'Employee-related expenses', note: '3.1', values: [10_507, 11_012] },
    { label: 'Other operating expenses', note: '3.2', values: [240_007, 203_749] },
    {
      label: 'Valuation decrement of property, plant and equipment and',
      continuation: 'intangible assets',
      note: '6.1,8.2',
      values: ['-', 1_528_272],
    },
    { label: 'Other expenses', note: '1.13.5', values: [50_072, 71_554] },
    {
      label: 'Depreciation, amortisation and de-recognition',
      note: '6.1,8.2,7.1',
      values: [1_334_576, 770_039],
    },
    { label: 'Finance costs', note: '3.4', values: [86_884, 61_399] },
    {
      label: 'Total expenses',
      values: [options.totalExpensesOverride ?? 1_722_046, 2_646_025],
    },
    { label: 'Net result', values: [options.netResultOverride ?? 18_421_894, -1_356_176] },
  ];
  let y = 692.04;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 76.32, y, pageNumber));
    if (row.note) items.push(item(row.note, 378.72, y, pageNumber));
    if (!row.continuation) {
      row.values.forEach((value, index) => {
        const right = STATEMENT_RIGHTS[index];
        if (right === undefined || value === null) return;
        items.push(money(value === '-' ? '-' : numberCell(value), right, y, pageNumber));
      });
    }
    if (row.continuation) {
      const continuationY = y - 10.32;
      items.push(item(row.continuation, 76.32, continuationY, pageNumber));
      if (row.note) items.push(item(row.note, 363.84, continuationY, pageNumber));
      row.values.forEach((value, index) => {
        const right = STATEMENT_RIGHTS[index];
        if (right === undefined || value === null) return;
        items.push(
          money(value === '-' ? '-' : numberCell(value), right, continuationY, pageNumber),
        );
      });
      y = continuationY;
    }
    y -= 13.2;
  }
  items.push(item('Other comprehensive income', 76.32, y - 10, pageNumber));
  items.push(item('Total comprehensive income', 76.32, y - 50, pageNumber));
  items.push(
    item(
      'The accompanying notes form part of these financial statements.',
      76.32,
      y - 70,
      pageNumber,
    ),
  );
  return {
    page_number: pageNumber,
    text: 'Statement of comprehensive income For the year ended 30 June 2024 Revenue Revenue from contracts with customers Investment revenue Grants and contributions Valuation increment of property, plant and equipment and intangible assets Other income Total revenue Expenses Employee-related expenses Other operating expenses Valuation decrement of property, plant and equipment and intangible assets Other expenses Depreciation, amortisation and de-recognition Finance costs Total expenses Net result Other comprehensive income Total comprehensive income The accompanying notes form part of these financial statements.',
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
    source: { url: PDF_URL, sha256: 't'.repeat(64), bytes: 9_262_428 },
    pages: [statementPage(options.statement), ...(options.extraPages ?? [])],
    text:
      options.text ??
      'Statement of comprehensive income For the year ended 30 June 2024 Total comprehensive income',
    tables: [],
    warnings: [],
  };
}

const context: TaheParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2023–24',
  fiscal_year: '2023-24',
  archive: {
    local_path: '/archive/tahe/Transport-Asset-Holding-Entity-of-NSW-202324-Annual-Report_0.pdf',
    sha256: 't'.repeat(64),
    bytes: 9_262_428,
  },
  source_date: '2026-11-17',
};

function recordFor(result: ReturnType<typeof parseTaheExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('TAHE annual-report discovery', () => {
  it('selects the latest annual-report PDF and ignores the SCI, SOE statement and pricing', () => {
    const pageHtml = `
      <a href="/sites/default/files/2025-01/Transport%20Asset%20Holding%20Entity%20of%20NSW%20202324%20Annual%20Report_0.pdf">2023-24</a>
      <a href="/sites/default/files/2024-05/Transport%20Asset%20Holding%20Entity%20-%20Annual%20Report%202022%20-%202023%20-%20Compressed.pdf">2022-23</a>
      <a href="/sites/default/files/2025-02/TAHE%202024-2025%20Statement%20of%20Corporate%20Intent_Updated%20Final.pdf">SCI</a>
      <a href="/sites/default/files/2023-02/TAHE_SOE_Annual_Statement_Final_August_2022.pdf">SOE</a>
      <a href="/sites/default/files/2024-06/TAHE%20MRN%20Pricing%20Schedule%202024%20June%20for%20website.pdf">Pricing</a>`;
    const links = parseTaheAnnualReportPdfLinks(
      pageHtml,
      'https://www.tam.nsw.gov.au/publications',
    );
    expect(links[0]).toMatchObject({ fiscal_year: '2023-24', url: PDF_URL });
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24', '2022-23']);
    expect(links.some((link) => /Corporate%20Intent|SOE|Pricing/i.test(link.url))).toBe(false);
  });

  it('maps a report year to the API fiscal year', () => {
    expect(taheFiscalYearFromReportYear(2024)).toBe('2023-24');
    expect(taheFiscalYearFromReportYear(2007)).toBe('2006-07');
  });
});

describe("TAHE $'000 guard", () => {
  it('detects an explicit thousands unit and rejects dollars/millions', () => {
    const unit = detectTaheUnit(["$'000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const dollars = parseTaheStatement(statementPage({ unit: '$' }));
    expect(dollars?.unit.kind).toBe('dollars');
    expect(dollars?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const millions = parseTaheExtraction(extraction({ statement: { unit: '$M' } }), context);
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseTaheExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });
});

describe('TAHE exact reconciliation and rows', () => {
  it('reconciles printed totals, components and the net result exactly', () => {
    const result = parseTaheExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(20_143_940);
    expect(result.statement?.total_expenses).toBe(1_722_046);
    expect(result.statement?.net_result).toBe(18_421_894);
    expect(result.statement?.valuation_decrement_nil).toBe(true);
    expect(result.checks.join(' ')).toContain(
      'total-revenue bridge exact: 557518 + 490176 + 1269799 + 17787495 + 38952 = 20143940',
    );
    expect(result.checks.join(' ')).toContain(
      'total-expenses bridge exact: 10507 + 240007 + 0 + 50072 + 1334576 + 86884 = 1722046',
    );
    expect(result.checks.join(' ')).toContain(
      'net-result bridge exact: 20143940 - 1722046 = 18421894',
    );
    expect(result.checks.join(' ')).toContain('printed Valuation decrement is an explicit nil');
  });

  it('maps the six required lines with provenance, exact cents and no verified claim', () => {
    const result = parseTaheExtraction(extraction(), context);
    expect(result.records).toHaveLength(6);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 172_204_600_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'TAHE',
      funding_source: 'TAHE',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2023-24',
      source_id: TAHE_ID,
      source_url: PDF_URL,
      source_dataset: 'TAHE Annual Report 2023-24',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(2_014_394_000_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(1_050_700_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(133_457_600_000);
    expect(recordFor(result, 'government_grants')).toMatchObject({
      amount_cents: 126_979_900_000,
      potential_double_count: true,
      funding_source: 'NSW Government (agency not itemised)',
    });
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 1_842_189_400_000,
      soc_printed_sign: 'positive',
    });
    expect(result.records.every((record) => record.verified === false)).toBe(true);
    expect(recordFor(result, 'total_expenses')?.notes).toContain('human_spot_check: required');
    expect(recordFor(result, 'net_result')?.notes).toContain('human_spot_check: required');
    expect(recordFor(result, 'government_grants')?.notes).toContain(
      'already included in Total revenue',
    );
  });

  it('defers on a one-thousand total-expenses mismatch instead of ingesting', () => {
    const result = parseTaheExtraction(
      extraction({ statement: { totalExpensesOverride: 1_722_047 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand net-result mismatch instead of ingesting', () => {
    const result = parseTaheExtraction(
      extraction({ statement: { netResultOverride: 18_421_895 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseTaheExtraction(extraction(), {
      ...context,
      fiscal_year: '2022-23',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });
});

describe('TAHE natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = taheNaturalKey('TAHE', '2023-24', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^tahe:[0-9a-f]{40}$/);
    expect(key).toBe(taheNaturalKey('TAHE', '2023-24', 'total_expenses', PDF_URL));
    expect(key).not.toBe(taheNaturalKey('TAHE', '2023-24', 'total_revenue', PDF_URL));
    expect(key).not.toBe(taheNaturalKey('TAHE', '2022-23', 'total_expenses', PDF_URL));
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseTaheExtraction(extraction(), context);
    const second = parseTaheExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('TAHE no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseTaheExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags only the separately disclosed grant row as a potential double count', () => {
    const result = parseTaheExtraction(extraction(), context);
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
