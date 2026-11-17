import { describe, expect, it } from 'vitest';
import {
  detectNswTrainlinkUnit,
  nswTrainlinkFiscalYearFromReportYear,
  nswTrainlinkNaturalKey,
  nswTrainlinkVolumeFromFilename,
  parseNswTrainlinkAnnualReportPdfLinks,
  parseNswTrainlinkExtraction,
  parseNswTrainlinkStatement,
  selectNswTrainlinkAnnualReport,
  NSW_TRAINLINK_ID,
  type NswTrainlinkParseContext,
} from '../src/connectors/soc/nsw/nsw-trainlink.js';
import type { PdfExtraction, PdfPage, PdfTextItem } from '../src/connectors/pdf-extract.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const PDF_URL =
  'https://www.transport.nsw.gov.au/system/files/media/documents/2025/nsw-trainlink-annual-report-2024%E2%80%9325-volume-2.pdf';

function item(str: string, x: number, y: number, page = 1, width = 0): PdfTextItem {
  return { page_number: page, str, x, y, width, height: 10 };
}

function money(str: string, right: number, y: number, page = 1): PdfTextItem {
  const width = Math.max(6, str.length * 5.5);
  return item(str, right - width, y, page, width);
}

const STATEMENT_RIGHTS = [466.9, 536.1];

function numberCell(value: number): string {
  if (value === 0) return '-';
  const text = Math.abs(value).toLocaleString('en-AU');
  return value < 0 ? `(${text})` : text;
}

interface RowSpec {
  label: string;
  note?: string;
  values: Array<number | null>;
}

function statementPage(
  options: {
    unit?: string;
    totalExpensesOverride?: number;
    netResultOverride?: number;
    omitGrants?: boolean;
  } = {},
): PdfPage {
  const unit = options.unit ?? "$'000";
  const pageNumber = 6;
  const items: PdfTextItem[] = [
    item('NSW Trains', 53.9, 793.8, pageNumber),
    item('Statement of comprehensive income', 53.9, 780.0, pageNumber),
    item('for the year ended 30 June 2025', 53.9, 766.5, pageNumber),
    item('Statement of comprehensive income', 53.9, 737.5, pageNumber),
    item('2025', 446.8, 723.4, pageNumber),
    item('2024', 516.0, 723.4, pageNumber),
    item('Notes', 372.6, 713.1, pageNumber),
    item(unit, 444.8, 713.1, pageNumber),
    item(unit, 513.9, 713.1, pageNumber),
    item('Revenue', 59.3, 689.5, pageNumber),
  ];
  const rows: RowSpec[] = [
    {
      label: 'Sale of goods and services from contracts with customers',
      note: '2(a)',
      values: [93_258, 160_212],
    },
    { label: 'Investment revenue', note: '2(b)', values: [3_803, 4_182] },
    { label: 'Other income', values: [19, 4] },
    { label: 'Total revenue', values: [97_080, 164_398] },
    { label: 'Expenses excluding losses', values: [] },
    { label: 'Employee-related expenses', note: '3(a)', values: [140_911, 328_863] },
    { label: 'Personnel services', note: '3(b)', values: [8_106, 13_589] },
    { label: 'Other operating expenses', note: '3(c)', values: [183_622, 871_405] },
    { label: 'Depreciation and amortisation', note: '3(d)', values: [35_419, 66_576] },
    { label: 'Finance costs', note: '3(e)', values: [9_684, 23_953] },
    {
      label: 'Total expenses excluding losses',
      values: [options.totalExpensesOverride ?? 377_742, 1_304_386],
    },
    {
      label: 'Deficit from operations before grants and contributions',
      values: [-280_662, -1_139_988],
    },
    { label: 'Grants and contributions', note: '2(c)', values: [395_366, 1_042_174] },
    { label: 'Surplus/(deficit) from operations', values: [114_704, -97_814] },
    { label: 'Gains/(losses) on disposal', values: [-887, 0] },
    { label: 'Impairment reversals/(losses) on financial assets', note: '5', values: [0, -4] },
    { label: 'Net result', values: [options.netResultOverride ?? 113_817, -97_818] },
    { label: 'Other comprehensive income', values: [] },
    {
      label: 'Remeasurement of defined benefit superannuation schemes',
      note: '16',
      values: [1_251, 7_533],
    },
    { label: 'Total other comprehensive income', values: [1_251, 7_533] },
    { label: 'Total comprehensive income', values: [115_068, -90_285] },
  ];
  if (options.omitGrants) {
    const index = rows.findIndex((row) => row.label === 'Grants and contributions');
    if (index >= 0) rows.splice(index, 1);
  }
  let y = 678;
  for (const row of rows) {
    if (row.label) items.push(item(row.label, 59.3, y, pageNumber));
    if (row.note) items.push(item(row.note, 381.6, y, pageNumber));
    row.values.forEach((value, index) => {
      const right = STATEMENT_RIGHTS[index];
      if (right === undefined || value === null) return;
      items.push(money(numberCell(value), right, y, pageNumber));
    });
    y -= 11.65;
  }
  items.push(
    item(
      'The accompanying notes form part of these financial statements.',
      53.9,
      383.0,
      pageNumber,
    ),
  );
  return {
    page_number: pageNumber,
    text: 'NSW Trains Statement of comprehensive income for the year ended 30 June 2025 4 Statement of comprehensive income Notes 2025 $’000 2024 $’000 Revenue Sale of goods and services from contracts with customers 2(a) 93,258 160,212 Investment revenue 2(b) 3,803 4,182 Other income 19 4 Total revenue 97,080 164,398 Expenses excluding losses Employee-related expenses 3(a) 140,911 328,863 Personnel services 3(b) 8,106 13,589 Other operating expenses 3(c) 183,622 871,405 Depreciation and amortisation 3(d) 35,419 66,576 Finance costs 3(e) 9,684 23,953 Total expenses excluding losses 377,742 1,304,386 Deficit from operations before grants and contributions (280,662) (1,139,988) Grants and contributions 2(c) 395,366 1,042,174 Surplus/(deficit) from operations 114,704 (97,814) Gains/(losses) on disposal (887) - Impairment reversals/(losses) on financial assets 5 - (4) Net result 113,817 (97,818) Other comprehensive income Remeasurement of defined benefit superannuation schemes 16 1,251 7,533 Total other comprehensive income 1,251 7,533 Total comprehensive income 115,068 (90,285) The accompanying notes form part of these financial statements.',
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
    source: { url: PDF_URL, sha256: 's'.repeat(64), bytes: 1_682_671 },
    pages: [statementPage(options.statement)],
    text:
      options.text ??
      'Statement of comprehensive income For the year ended 30 June 2025 Total comprehensive income',
    tables: [],
    warnings: [],
  };
}

const context: NswTrainlinkParseContext = {
  document_url: PDF_URL,
  document_title: 'Annual Report 2024–25 — audited financial statements',
  fiscal_year: '2024-25',
  archive: {
    local_path: '/archive/nsw-trainlink/nsw-trainlink-annual-report-2024-25-volume-2.pdf',
    sha256: 's'.repeat(64),
    bytes: 1_682_671,
  },
  source_date: '2026-11-17',
};

function recordFor(result: ReturnType<typeof parseNswTrainlinkExtraction>, lineItem: string) {
  return result.records.find((record) => record.soc_line_item === lineItem);
}

describe('NSW TrainLink annual-report discovery', () => {
  it('selects the latest report year and its Volume 2 financial statements', () => {
    const pageHtml = `
      <a href="/system/files/media/documents/2025/nsw-trainlink-annual-report-2024%E2%80%9325-volume-1.pdf">2024-25 Vol 1</a>
      <a href="/system/files/media/documents/2025/nsw-trainlink-annual-report-2024%E2%80%9325-volume-2.pdf">2024-25 Vol 2</a>
      <a href="/system/files/media/documents/2024/nsw-trainlink-annual-report-2023-24-volume-2.pdf">2023-24 Vol 2</a>
      <a href="/system/files/media/documents/2017/nsw-trains-annual-report-2014-15-vol-2.pdf">2014-15 Vol 2</a>
      <a href="/newsroom-and-events/reports-and-publications/nsw-trainlink-corporate-plan">Corporate plan</a>
      <a href="/sites/default/files/2024/nsw-trainlink-safety-management-system.pdf">Safety</a>`;
    const links = parseNswTrainlinkAnnualReportPdfLinks(
      pageHtml,
      'https://www.transport.nsw.gov.au/news-and-events/reports-and-publications/nsw-trainlink-annual-reports',
    );
    expect(links.map((link) => link.fiscal_year)).toEqual([
      '2024-25',
      '2024-25',
      '2023-24',
      '2014-15',
    ]);
    const latest = selectNswTrainlinkAnnualReport(links);
    expect(latest).toMatchObject({ fiscal_year: '2024-25', volume: 2, url: PDF_URL });
    expect(links.some((link) => /corporate|safety/i.test(link.url))).toBe(false);
  });

  it('maps report years and single-PDF report volumes', () => {
    expect(nswTrainlinkVolumeFromFilename('NSW Trains Annual Report 2017-18.pdf')).toBeNull();
    expect(nswTrainlinkVolumeFromFilename('NSW-Trains-Annual-Report-V2-2018-19.pdf')).toBe(2);
    expect(
      nswTrainlinkVolumeFromFilename(
        'NSW-TrainLink-Annual-Report-2021-22-Volume-2- Audited-Financial-Statements.pdf',
      ),
    ).toBe(2);
    expect(nswTrainlinkFiscalYearFromReportYear(2025)).toBe('2024-25');
    expect(nswTrainlinkFiscalYearFromReportYear(2018)).toBe('2017-18');
  });
});

describe("NSW TrainLink $'000 guard", () => {
  it('detects an explicit thousands unit and rejects dollars/millions', () => {
    const unit = detectNswTrainlinkUnit(["$'000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const dollars = parseNswTrainlinkStatement(statementPage({ unit: '$' }));
    expect(dollars?.unit.kind).toBe('dollars');
    expect(dollars?.errors.join(' ')).toMatch(/not explicit thousands/i);

    const millions = parseNswTrainlinkExtraction(
      extraction({ statement: { unit: '$M' } }),
      context,
    );
    expect(millions.records).toHaveLength(0);
    expect(millions.deferral?.phase).toBe('unit');
  });

  it('defers when the printed unit is absent rather than guessing dollars', () => {
    const result = parseNswTrainlinkExtraction(extraction({ statement: { unit: '' } }), context);
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('unit');
    expect(result.deferral?.reason).toMatch(/not explicit thousands/i);
  });
});

describe('NSW TrainLink exact reconciliation and rows', () => {
  it('reconciles printed totals, components, operations and the net result exactly', () => {
    const result = parseNswTrainlinkExtraction(extraction(), context);
    expect(result.deferral).toBeNull();
    expect(result.statement?.unit.kind).toBe('thousands');
    expect(result.statement?.total_revenue).toBe(97_080);
    expect(result.statement?.total_expenses).toBe(377_742);
    expect(result.statement?.net_result).toBe(113_817);
    expect(result.checks.join(' ')).toContain(
      'total-revenue bridge exact: 93258 + 3803 + 19 = 97080',
    );
    expect(result.checks.join(' ')).toContain(
      'total-expenses bridge exact: 140911 + 8106 + 183622 + 35419 + 9684 = 377742',
    );
    expect(result.checks.join(' ')).toContain(
      'deficit-before-grants bridge exact: 97080 - 377742 = -280662',
    );
    expect(result.checks.join(' ')).toContain(
      'operations-result bridge exact: -280662 + 395366 = 114704',
    );
    expect(result.checks.join(' ')).toContain(
      'net-result bridge exact: 114704 + -887 + 0 = 113817',
    );
  });

  it('maps the six required lines with provenance, exact cents and no verified claim', () => {
    const result = parseNswTrainlinkExtraction(extraction(), context);
    expect(result.records).toHaveLength(6);
    expect(recordFor(result, 'total_expenses')).toMatchObject({
      amount_cents: 37_774_200_000,
      jurisdiction_level: 'soc',
      jurisdiction: 'NSW',
      delivery_entity: 'NSW TrainLink',
      funding_source: 'NSW TrainLink',
      potential_double_count: false,
      measure_type: 'actual',
      fiscal_year: '2024-25',
      source_id: NSW_TRAINLINK_ID,
      source_url: PDF_URL,
      source_dataset: 'NSW TrainLink Annual Report 2024-25',
      verified: false,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      soc_unit: 'AUD_thousands',
      extraction_confidence: 'high',
      location: { state: 'NSW' },
    });
    expect(recordFor(result, 'total_revenue')?.amount_cents).toBe(9_708_000_000);
    expect(recordFor(result, 'employee_expenses')?.amount_cents).toBe(14_091_100_000);
    expect(recordFor(result, 'depreciation_amortisation')?.amount_cents).toBe(3_541_900_000);
    expect(recordFor(result, 'government_grants')).toMatchObject({
      amount_cents: 39_536_600_000,
      potential_double_count: true,
      funding_source: 'NSW Government — Transport for NSW',
    });
    expect(recordFor(result, 'net_result')).toMatchObject({
      amount_cents: 11_381_700_000,
      soc_printed_sign: 'positive',
    });
    expect(result.records.every((record) => record.verified === false)).toBe(true);
    expect(recordFor(result, 'total_expenses')?.notes).toContain('human_spot_check: required');
    expect(recordFor(result, 'net_result')?.notes).toContain('human_spot_check: required');
    expect(recordFor(result, 'total_expenses')?.notes).toContain('Total expenses excluding losses');
    expect(recordFor(result, 'government_grants')?.notes).toContain(
      'presented below Total revenue',
    );
    expect(recordFor(result, 'total_expenses')?.notes).toContain('entity_legal_name: NSW Trains');
  });

  it('records the NSW TrainLink brand over the NSW Trains legal entity as a provenance caveat', () => {
    const result = parseNswTrainlinkExtraction(extraction(), context);
    expect(result.statement?.legal_entity_mismatch).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/branded NSW TrainLink.*legal entity "NSW Trains"/i);
    expect(recordFor(result, 'total_expenses')?.notes).toMatch(/entity_legal_name: NSW Trains/);
  });

  it('defers on a one-thousand total-expenses mismatch instead of ingesting', () => {
    const result = parseNswTrainlinkExtraction(
      extraction({ statement: { totalExpensesOverride: 377_743 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers on a one-thousand net-result mismatch instead of ingesting', () => {
    const result = parseNswTrainlinkExtraction(
      extraction({ statement: { netResultOverride: 113_818 } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('reconciliation');
  });

  it('defers when the report period does not match the discovered report year', () => {
    const result = parseNswTrainlinkExtraction(extraction(), {
      ...context,
      fiscal_year: '2023-24',
    });
    expect(result.records).toHaveLength(0);
    expect(result.deferral?.phase).toBe('statement');
  });

  it('defers rather than guessing when a required printed line is absent', () => {
    const result = parseNswTrainlinkExtraction(
      extraction({ statement: { omitGrants: true } }),
      context,
    );
    expect(result.records).toHaveLength(0);
    expect(result.deferral).not.toBeNull();
  });
});

describe('NSW TrainLink natural key and idempotency', () => {
  it('builds a stable hash from entity + fiscal year + line item + document URL', () => {
    const key = nswTrainlinkNaturalKey('NSW TrainLink', '2024-25', 'total_expenses', PDF_URL);
    expect(key).toMatch(/^nsw-trainlink:[0-9a-f]{40}$/);
    expect(key).toBe(nswTrainlinkNaturalKey('NSW TrainLink', '2024-25', 'total_expenses', PDF_URL));
    expect(key).not.toBe(
      nswTrainlinkNaturalKey('NSW TrainLink', '2024-25', 'total_revenue', PDF_URL),
    );
    expect(key).not.toBe(
      nswTrainlinkNaturalKey('NSW TrainLink', '2023-24', 'total_expenses', PDF_URL),
    );
  });

  it('is idempotent: re-parsing yields exactly the same natural keys', () => {
    const first = parseNswTrainlinkExtraction(extraction(), context);
    const second = parseNswTrainlinkExtraction(extraction(), context);
    expect(second.records.map((record) => record.natural_key)).toEqual(
      first.records.map((record) => record.natural_key),
    );
  });
});

describe('NSW TrainLink no-sum / double-count separation', () => {
  it('marks every row non-additive and excludes SOC from the generic spending query', () => {
    const result = parseNswTrainlinkExtraction(extraction(), context);
    for (const record of result.records) {
      expect(record.jurisdiction_level).toBe('soc');
      expect(record.aggregation_role).toBe('agency_detail');
      expect(isAdditiveMeasure(record)).toBe(false);
    }
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
  });

  it('flags only the separately disclosed grant row as a potential double count', () => {
    const result = parseNswTrainlinkExtraction(extraction(), context);
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
