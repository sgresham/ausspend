import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  BREWARRINA_GPFS_DELIVERY_ENTITY,
  BREWARRINA_GPFS_FISCAL_YEAR,
  BREWARRINA_GPFS_ID,
  BREWARRINA_GPFS_LICENSE,
  BREWARRINA_GPFS_NAME,
  BREWARRINA_GPFS_PUBLISHER,
  BREWARRINA_GPFS_REPORTING_URL,
  detectBrewarrinaGpfsUnit,
  fiscalYearFromBrewarrinaGpfsLink,
  parseBrewarrinaGpfsExtraction,
  parseBrewarrinaGpfsMediaLinks,
  selectBrewarrinaGpfsDocument,
  brewarrinaGpfsNaturalKey,
} from '../src/connectors/brewarrina-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  BREWARRINA_COMPREHENSIVE_TEXT,
  BREWARRINA_CONTEXT,
  BREWARRINA_FUNCTIONS_TEXT,
  BREWARRINA_INCOME_TEXT,
  BREWARRINA_PDF_SHA256,
  BREWARRINA_PDF_URL,
  brewarrinaExtraction,
} from '../src/connectors/brewarrina-gpfs/fixture.js';

// Brewarrina Shire Council's official FY2025-26 standalone GPFS. The Income
// Statement prints the Original unaudited budget column before the line label,
// with Actual 2026 and Actual 2025 after it. A parser that took the first number
// in the line would read the budget; the expected values are all Actual 2026.
// The council does not print a borrowing-costs line, so only four expense
// components bridge to the printed expenses-excluding-depreciation subtotal.

function parsedFixture() {
  return parseBrewarrinaGpfsExtraction(brewarrinaExtraction(), BREWARRINA_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

const media = (items: Array<Record<string, unknown>>) => JSON.stringify(items);

describe('Brewarrina Shire Council GPFS source discovery', () => {
  const mediaJson = media([
    {
      source_url:
        'https://brewarrina.nsw.gov.au/wp-content/uploads/2026/11/Annual_Financial_Statements_NotePN_Public_Notice_–_Presentation_of_Financial_Statements.pdf',
      title: { rendered: 'Annual Financial Statements NotePN Public Notice — Presentation' },
      media_type: 'application/pdf',
    },
    {
      source_url: BREWARRINA_PDF_URL,
      title: { rendered: 'Brewarrina Shire Council Financial Statements 2025-26' },
      media_type: 'application/pdf',
    },
    {
      source_url:
        'https://brewarrina.nsw.gov.au/wp-content/uploads/2025/11/Brewarrina-Shire-Council-Financial_Statements-2024-25-audited-301025.pdf',
      title: { rendered: 'Brewarrina Shire Council Financial Statements 2024-25' },
      media_type: 'application/pdf',
    },
    {
      source_url:
        'https://brewarrina.nsw.gov.au/wp-content/uploads/2024/11/Brewarrina-Shire-Council-Financial-Statements-2023-24-audited.pdf',
      title: { rendered: 'Brewarrina Shire Council Financial Statements 2023-24' },
      media_type: 'application/pdf',
    },
    {
      source_url: 'https://brewarrina.nsw.gov.au/wp-content/uploads/2026/11/annual-report-2025-26.pdf',
      title: { rendered: 'Annual Report 2025-26' },
      media_type: 'application/pdf',
    },
    {
      source_url: 'https://brewarrina.nsw.gov.au/wp-content/uploads/2026/11/cover.jpg',
      title: { rendered: 'cover' },
      media_type: 'image',
    },
  ]);

  it('discovers the FY2025-26 standalone GPFS from the council media API, ignoring notices/prior years', () => {
    const links = parseBrewarrinaGpfsMediaLinks(mediaJson, BREWARRINA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year).sort()).toEqual(['2023-24', '2024-25', '2025-26']);
    const current = links.filter((link) => link.fiscal_year === '2025-26');
    expect(current.map((link) => link.url)).toEqual([BREWARRINA_PDF_URL]);
    const selected = selectBrewarrinaGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(BREWARRINA_PDF_URL);
    expect(selected.url).toContain('Financial-Statements-2025-26.pdf');
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(BREWARRINA_GPFS_REPORTING_URL);
    expect(fiscalYearFromBrewarrinaGpfsLink('2025/2026')).toBe('2025-26');
    expect(fiscalYearFromBrewarrinaGpfsLink('year ended 30 June 2026')).toBe('2025-26');
    expect(
      fiscalYearFromBrewarrinaGpfsLink(
        'Brewarrina-Shire-Council-Financial-Statements-2025-26.pdf',
      ),
    ).toBe('2025-26');
    expect(fiscalYearFromBrewarrinaGpfsLink('GPFS-2026.pdf')).toBeNull();
  });

  it('does not substitute a prior year or the presentation notice when the current-year GPFS is absent', () => {
    const priorOnly = media([
      {
        source_url:
          'https://brewarrina.nsw.gov.au/wp-content/uploads/2025/11/Brewarrina-Shire-Council-Financial_Statements-2024-25-audited-301025.pdf',
        title: { rendered: 'Financial Statements 2024-25' },
        media_type: 'application/pdf',
      },
      {
        source_url:
          'https://brewarrina.nsw.gov.au/wp-content/uploads/2026/11/Annual_Financial_Statements_NotePN_Public_Notice_–_Presentation_of_Financial_Statements.pdf',
        title: { rendered: 'Public Notice — Presentation of Financial Statements' },
        media_type: 'application/pdf',
      },
    ]);
    const links = parseBrewarrinaGpfsMediaLinks(priorOnly, BREWARRINA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectBrewarrinaGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('rejects a financial-statements PDF on a non-council host and non-JSON responses', () => {
    const external = media([
      {
        source_url: 'https://example.com/Financial-Statements-2025-26.pdf',
        title: { rendered: 'Financial Statements 2025-26' },
      },
    ]);
    expect(parseBrewarrinaGpfsMediaLinks(external, BREWARRINA_GPFS_REPORTING_URL)).toEqual([]);
    expect(parseBrewarrinaGpfsMediaLinks('<html>blocked</html>', BREWARRINA_GPFS_REPORTING_URL)).toEqual(
      [],
    );
  });
});

describe('Brewarrina Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectBrewarrinaGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectBrewarrinaGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = BREWARRINA_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseBrewarrinaGpfsExtraction(
      extraction({ income: withoutUnit }),
      BREWARRINA_CONTEXT,
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
    source: { sha256: BREWARRINA_PDF_SHA256, bytes: 2_817_948 },
    pages: [
      pdfPage(overrides.income ?? BREWARRINA_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? BREWARRINA_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? BREWARRINA_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Brewarrina Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(16);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(40_798);
    expect(reconciliation.total_expenses).toBe(29_753);
    expect(reconciliation.employee_expenses).toBe(8_022);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(5_702);
    expect(reconciliation.government_grants_operating).toBe(15_818);
    expect(reconciliation.government_grants_capital).toBe(9_041);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(247);
    expect(reconciliation.net_result).toBe(11_045);
    expect(reconciliation.net_result_before_capital_grants).toBe(2_004);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(24_051);
    expect(reconciliation.face_expense_bridge).toBe(29_753);
    expect(reconciliation.functions_total_income).toBe(40_798);
    expect(reconciliation.functions_total_expenses).toBe(29_753);
    expect(reconciliation.functions_operating_result).toBe(11_045);
    expect(reconciliation.functions_grants_and_contributions).toBe(24_859);
    expect(reconciliation.comprehensive_income_net_result).toBe(11_045);
    expect(reconciliation.comprehensive_other_income).toBe(11_270);
    expect(reconciliation.comprehensive_total).toBe(22_315);
    expect(reconciliation.revenue_components_sum).toBe(40_798);
    expect(reconciliation.expense_components_sum).toBe(24_051);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(4_079_800_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(2_975_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(802_200_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      570_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_581_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(904_100_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(24_700_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(309_300_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(89_100_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_104_500_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(records.some((record) => record.gpfs_line_item === 'borrowing_costs')).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: BREWARRINA_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: BREWARRINA_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Brewarrina Shire Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: BREWARRINA_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Brewarrina Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^brewarrina-gpfs:/);
      expect(record.source_url).toContain('Financial-Statements-2025-26.pdf');
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
  });

  it('does not sum components with their printed totals', () => {
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
    expect(natureComponents).toHaveLength(4);
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
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = BREWARRINA_FUNCTIONS_TEXT.replace(
      'Total functions and activities   40,798   26,519   29,753   29,654',
      'Total functions and activities   40,798   26,519   29,755   29,654',
    );
    const parsed = parseBrewarrinaGpfsExtraction(extraction({ functions: broken }), BREWARRINA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = BREWARRINA_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council   22,315',
      'Total comprehensive income for the year attributable to Council   22,317',
    );
    const parsed = parseBrewarrinaGpfsExtraction(
      extraction({ comprehensive: broken }),
      BREWARRINA_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = BREWARRINA_INCOME_TEXT.replace(
      'Rates and annual charges   B2-1   3,093',
      'Rates and annual charges   B2-1   3,095',
    );
    const parsed = parseBrewarrinaGpfsExtraction(extraction({ income: broken }), BREWARRINA_CONTEXT);
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
    const url = BREWARRINA_CONTEXT.document.url;
    const revenue = brewarrinaGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = brewarrinaGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^brewarrina-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(brewarrinaGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(brewarrinaGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_brewarrinagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: BREWARRINA_GPFS_ID,
    name: BREWARRINA_GPFS_NAME,
    publisher: BREWARRINA_GPFS_PUBLISHER,
    source_url: BREWARRINA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: BREWARRINA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'brewarrina-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Brewarrina Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: BREWARRINA_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-brewarrina',
        project_name: 'Existing AusTender Brewarrina Shire contract',
        delivery_entity: 'BREWARRINA SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-brewarrina',
        project_name: 'Existing GrantConnect Brewarrina Shire grant',
        delivery_entity: 'Brewarrina Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-brewarrina-school',
        project_name: 'Existing data.nsw Brewarrina school row (not a council row)',
        delivery_entity: 'Brewarrina Central School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-brewarrina-charity',
        project_name: 'Existing ACNC Brewarrina charity row (not the council)',
        delivery_entity: 'Brewarrina Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'the-hills-gpfs',
        source_url: 'https://www.thehills.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-the-hills-gpfs-1',
        project_name: 'Existing The Hills GPFS row',
        delivery_entity: 'The Hills Shire Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'the-hills-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: BREWARRINA_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: BREWARRINA_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: BREWARRINA_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BREWARRINA_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: BREWARRINA_GPFS_ID,
        delivery_entity: { $ne: 'Brewarrina Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: BREWARRINA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
