import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  NARRANDERA_GPFS_DELIVERY_ENTITY,
  NARRANDERA_GPFS_DOCUMENT_PIN,
  NARRANDERA_GPFS_FISCAL_YEAR,
  NARRANDERA_GPFS_ID,
  NARRANDERA_GPFS_LICENSE,
  NARRANDERA_GPFS_NAME,
  NARRANDERA_GPFS_PUBLISHER,
  NARRANDERA_GPFS_REPORTING_URL,
  NARRANDERA_GPFS_REQUEST_HEADERS,
  narranderaPinnedDocument,
  detectNarranderaGpfsUnit,
  discoverNarranderaGpfsDocument,
  fiscalYearFromNarranderaGpfsLink,
  parseNarranderaGpfsExtraction,
  parseNarranderaGpfsReportLinks,
  selectNarranderaGpfsDocument,
  narranderaGpfsNaturalKey,
} from '../src/connectors/narrandera-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  NARRANDERA_COMPREHENSIVE_TEXT,
  NARRANDERA_CONTEXT,
  NARRANDERA_FUNCTIONS_TEXT,
  NARRANDERA_INCOME_TEXT,
  NARRANDERA_PDF_SHA256,
  NARRANDERA_PDF_URL,
  narranderaExtraction,
} from '../src/connectors/narrandera-gpfs/fixture.js';

// Narrandera Shire Council's audited FY2025-26 standalone General Purpose
// Financial Statements. FY2025-26 is the current reporting year and the official
// Integrated planning and reporting page lists Annexure F — Audited financial
// statements for 2025-26 as the newest audited standalone statements as at
// 2026-11-19; no later audited statements were published. The connector targets
// 2025-26 and never substitutes the earlier 2024-25/2023-24 document. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2026 and Actual 2025 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2026.
// Narrandera prints seven revenue components (including "Other income") and
// five expense components including a real net loss on disposal of 818. The net
// result is positive (3,604) and the before-capital result is also positive
// (2,515). Other comprehensive income prints a single 2026 revaluation component
// of 17,143.

function parsedFixture() {
  return parseNarranderaGpfsExtraction(narranderaExtraction(), NARRANDERA_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Narrandera Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/content/public/v/34/council/governance-and-transparency/integrated-planning-and-reporting/2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf">Annexure F (PDF,&nbsp;3MB)</a>
    <a href="/files/content/public/v/34/council/governance-and-transparency/integrated-planning-and-reporting/2026-11-11-2025-26-annual-report.pdf">2025-26 Annual Report (PDF,&nbsp;35MB)</a>
    <a href="https://example.com/2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf">Narrandera financial statements mirror</a>
  `;

  it('discovers the FY2025-26 standalone statements and never the annual report, prior year or a mirror', () => {
    expect(NARRANDERA_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseNarranderaGpfsReportLinks(pageHtml, NARRANDERA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(links.map((link) => link.url)).toEqual([NARRANDERA_PDF_URL]);
    const selected = selectNarranderaGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(NARRANDERA_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(NARRANDERA_GPFS_REPORTING_URL);
    expect(selected.title).toContain('Annexure F');
    expect(
      fiscalYearFromNarranderaGpfsLink(
        '2026-11-11-annexure-f-audited-financial-statements-for-2025-26.pdf',
      ),
    ).toBe('2025-26');
    expect(
      fiscalYearFromNarranderaGpfsLink(
        '2025-10-annexure-f-audited-financial-statements-for-2024-25.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromNarranderaGpfsLink(
        'Financial Statements for the year ended 30 June 2026',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromNarranderaGpfsLink('Long Term Financial Plan 2023-2033.pdf')).toBeNull();
  });

  it('rejects a prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="/files/content/public/v/33/council/governance-and-transparency/integrated-planning-and-reporting/2025-10-annexure-f-audited-financial-statements-for-2024-25.pdf">Annexure F (PDF,&nbsp;3MB)</a>
    `;
    const links = parseNarranderaGpfsReportLinks(priorOnly, NARRANDERA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectNarranderaGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="/files/content/public/v/35/council/governance-and-transparency/integrated-planning-and-reporting/2027-10-annexure-f-audited-financial-statements-for-2026-27.pdf">Annexure F (PDF,&nbsp;3MB)</a>
    `;
    const links = parseNarranderaGpfsReportLinks(futureOnly, NARRANDERA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectNarranderaGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseNarranderaGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      NARRANDERA_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = narranderaPinnedDocument();
    expect(pinned.url).toBe(NARRANDERA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('annexure-f-audited-financial-statements-for-2025-26.pdf');
    const discovered = await discoverNarranderaGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(NARRANDERA_GPFS_DOCUMENT_PIN);
  });

  it('falls back to the pin when the WAF returns a 403 challenge', async () => {
    const discovered = await discoverNarranderaGpfsDocument(
      (async () => new Response('Just a moment...', { status: 403 })) as typeof fetch,
      '2025-26',
    );
    expect(discovered.url).toBe(NARRANDERA_GPFS_DOCUMENT_PIN);
    expect(discovered.fiscal_year).toBe('2025-26');
  });

  it('sends a plain client UA for deterministic discovery and download', async () => {
    expect(NARRANDERA_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverNarranderaGpfsDocument(
      (async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = init?.headers as Record<string, string>;
        return new Response('<html>no links</html>', { status: 200 });
      }) as typeof fetch,
      '2025-26',
    );
    expect(seenHeaders?.['user-agent']).toBe('curl/8.5.0');
    expect(seenHeaders?.['user-agent']).not.toContain('Chrome');
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverNarranderaGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Narrandera Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectNarranderaGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectNarranderaGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = NARRANDERA_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseNarranderaGpfsExtraction(
      extraction({ income: withoutUnit }),
      NARRANDERA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

function pdfPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; comprehensive?: string; functions?: string } = {},
): PdfExtraction {
  return {
    source: { sha256: NARRANDERA_PDF_SHA256, bytes: 2_679_914 },
    pages: [
      pdfPage(overrides.income ?? NARRANDERA_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? NARRANDERA_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? NARRANDERA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Narrandera Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(31_516);
    expect(reconciliation.total_expenses).toBe(27_912);
    expect(reconciliation.employee_expenses).toBe(10_572);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(6_667);
    expect(reconciliation.government_grants_operating).toBe(11_972);
    expect(reconciliation.government_grants_capital).toBe(1_089);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(818);
    expect(reconciliation.net_result).toBe(3_604);
    expect(reconciliation.net_result_before_capital_grants).toBe(2_515);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(21_245);
    expect(reconciliation.face_expense_bridge).toBe(27_912);
    expect(reconciliation.functions_total_income).toBe(31_516);
    expect(reconciliation.functions_total_expenses).toBe(27_912);
    expect(reconciliation.functions_operating_result).toBe(3_604);
    expect(reconciliation.functions_grants_and_contributions).toBe(13_061);
    expect(reconciliation.comprehensive_income_net_result).toBe(3_604);
    expect(reconciliation.comprehensive_other_income).toBe(17_143);
    expect(reconciliation.comprehensive_total).toBe(20_747);
    expect(reconciliation.comprehensive_revaluation).toBe(17_143);
    expect(reconciliation.revenue_components_sum).toBe(31_516);
    expect(reconciliation.expense_components_sum).toBe(21_245);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_151_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(2_791_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_057_200_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      666_700_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_197_200_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(108_900_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      81_800_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(15_100_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_212_700_000);
    expect(recordByLine(records, 'other_revenue').amount_cents).toBe(135_400_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(25_700_000);
    expect(recordByLine(records, 'interest_and_investment_income').amount_cents).toBe(
      155_100_000,
    );
    expect(recordByLine(records, 'other_expenses').amount_cents).toBe(44_500_000);
    expect(recordByLine(records, 'materials_and_services').amount_cents).toBe(925_900_000);
    expect(recordByLine(records, 'user_charges_and_fees').amount_cents).toBe(316_600_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(360_400_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'other_income'),
    ).toBe(true);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_gain_from_disposal_of_assets'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: NARRANDERA_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: NARRANDERA_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Narrandera Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: NARRANDERA_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Narrandera Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^narrandera-gpfs:/);
      expect(record.source_url).toContain('annexure-f-audited-financial-statements-for-2025-26.pdf');
      expect(record.notes).not.toContain('document_resolved_url: ');
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
  });

  it('does not sum components with their printed totals and emits no council-total aggregate row', () => {
    const { records } = parsedFixture();
    const totalRevenue = recordByLine(records, 'total_revenue');
    const revenueComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_revenue',
    );
    expect(revenueComponents).toHaveLength(7);
    expect(revenueComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalRevenue.amount_cents,
    );

    const expensesExDepreciation = recordByLine(records, 'total_expenses_excluding_depreciation');
    const natureComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses_excluding_depreciation',
    );
    expect(natureComponents).toHaveLength(5);
    expect(natureComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      expensesExDepreciation.amount_cents,
    );

    const totalExpenses = recordByLine(records, 'total_expenses');
    const bridgeComponents = records.filter(
      (record) => record.gpfs_component_of === 'total_expenses',
    );
    expect(bridgeComponents).toHaveLength(2);
    expect(bridgeComponents.reduce((sum, record) => sum + record.amount_cents, 0)).toBe(
      totalExpenses.amount_cents,
    );

    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
    expect(
      records.every((record) =>
        ['revenue', 'expenses', 'result'].includes(String(record.gpfs_section)),
      ),
    ).toBe(true);
    expect(records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = NARRANDERA_FUNCTIONS_TEXT.replace(
      'Total functions and activities 31,516 31,720 27,912 29,451',
      'Total functions and activities 31,516 31,720 27,914 29,451',
    );
    const parsed = parseNarranderaGpfsExtraction(
      extraction({ functions: broken }),
      NARRANDERA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = NARRANDERA_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 20,747',
      'Total comprehensive income for the year attributable to Council 20,749',
    );
    const parsed = parseNarranderaGpfsExtraction(
      extraction({ comprehensive: broken }),
      NARRANDERA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = NARRANDERA_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 12,127',
      'Rates and annual charges B2-1 12,129',
    );
    const parsed = parseNarranderaGpfsExtraction(extraction({ income: broken }), NARRANDERA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the net loss on disposal is altered', () => {
    const broken = NARRANDERA_INCOME_TEXT.replace(
      'Net loss from the disposal of assets B4-1 818',
      'Net loss from the disposal of assets B4-1 820',
    );
    const parsed = parseNarranderaGpfsExtraction(extraction({ income: broken }), NARRANDERA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the OCI component is altered', () => {
    const broken = NARRANDERA_COMPREHENSIVE_TEXT.replace(
      'Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-7 17,143 6,005',
      'Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-7 17,145 6,005',
    );
    const parsed = parseNarranderaGpfsExtraction(
      extraction({ comprehensive: broken }),
      NARRANDERA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic and derives stable, line-specific, fiscal-year-specific natural keys', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
    const url = NARRANDERA_CONTEXT.document.url;
    const revenue = narranderaGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = narranderaGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^narrandera-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(narranderaGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(narranderaGpfsNaturalKey(url, 'total_revenue', '2026-27'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_narranderagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: NARRANDERA_GPFS_ID,
    name: NARRANDERA_GPFS_NAME,
    publisher: NARRANDERA_GPFS_PUBLISHER,
    source_url: NARRANDERA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: NARRANDERA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'narrandera-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Narrandera Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: NARRANDERA_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-narrandera',
        project_name: 'Existing AusTender Narrandera contract',
        delivery_entity: 'UPPER LACHLAN SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-narrandera',
        project_name: 'Existing GrantConnect Narrandera grant',
        delivery_entity: 'Narrandera Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-narrandera-school',
        project_name: 'Existing data.nsw Narrandera school row (not a council row)',
        delivery_entity: 'Narrandera High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-narrandera-charity',
        project_name: 'Existing ACNC Narrandera charity row (not the council)',
        delivery_entity: 'Narrandera Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
        source_id: 'edward-river-gpfs',
        source_url: 'https://www.edwardriver.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-edward-river-gpfs-1',
        project_name: 'Existing Edward River GPFS row',
        delivery_entity: 'Edward River Council',
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('preserves existing rows and never double counts on re-run', async () => {
    const { records } = parsedFixture();
    const connector = fakeConnector(records);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'data-nsw-ckan' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'edward-river-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: NARRANDERA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: NARRANDERA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: NARRANDERA_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NARRANDERA_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: NARRANDERA_GPFS_ID,
        delivery_entity: { $ne: 'Narrandera Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: NARRANDERA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
