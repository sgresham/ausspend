import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  KYOGLE_GPFS_DELIVERY_ENTITY,
  KYOGLE_GPFS_DOCUMENT_PIN,
  KYOGLE_GPFS_ID,
  KYOGLE_GPFS_LICENSE,
  KYOGLE_GPFS_NAME,
  KYOGLE_GPFS_PUBLISHER,
  KYOGLE_GPFS_REPORTING_URL,
  kyoglePinnedDocument,
  detectKyogleGpfsUnit,
  discoverKyogleGpfsDocument,
  fiscalYearFromKyogleGpfsLink,
  parseKyogleGpfsExtraction,
  parseKyogleGpfsReportLinks,
  selectKyogleGpfsDocument,
  kyogleGpfsNaturalKey,
} from '../src/connectors/kyogle-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  KYOGLE_COMPREHENSIVE_TEXT,
  KYOGLE_CONTEXT,
  KYOGLE_FUNCTIONS_TEXT,
  KYOGLE_INCOME_TEXT,
  KYOGLE_PDF_SHA256,
  KYOGLE_PDF_URL,
  kyogleExtraction,
} from '../src/connectors/kyogle-gpfs/fixture.js';

// Kyogle Council's official FY2025-26 standalone GPFS. The Income Statement
// prints the Original unaudited budget column before the line label, with Actual
// 2026 and Actual 2025 after it. A parser that took the first number in the line
// would read the budget; the expected values are all Actual 2026. Kyogle prints
// six non-zero revenue lines (net gain on disposal is nil) and five expense
// lines (including borrowing costs and a net loss on disposal).

function parsedFixture() {
  return parseKyogleGpfsExtraction(kyogleExtraction(), KYOGLE_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Kyogle Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/sites/default/files/2026-10/Kyogle%20Council%20Annual%20Financial%20Statements%202026.pdf">
      Kyogle Council Annual Financial Statements 2026
    </a>
    <a href="/sites/default/files/2026-11/2025-2026%20Annual%20Financial%20Statements.pdf">
      2025-2026 Annual Financial Statements
    </a>
    <a href="/sites/default/files/2026-08/Kyogle-Council-Financial-Statements-2024-2025.pdf">
      Kyogle Council Financial Statements 2024-2025
    </a>
    <a href="/sites/default/files/2026-11/Final%20approved%20Annual%20Report%202025-2026.pdf">
      Final approved Annual Report 2025-2026
    </a>
    <a href="https://example.com/2025-2026%20Annual%20Financial%20Statements.pdf">
      2025-2026 Annual Financial Statements
    </a>
  `;

  it('discovers the latest FY2025-26 statements upload and ignores the annual report/prior year', () => {
    const links = parseKyogleGpfsReportLinks(pageHtml, KYOGLE_GPFS_REPORTING_URL);
    const current = links.filter((link) => link.fiscal_year === '2025-26');
    expect(current.map((link) => link.url).sort()).toEqual(
      [
        'https://www.kyogle.nsw.gov.au/sites/default/files/2026-10/Kyogle%20Council%20Annual%20Financial%20Statements%202026.pdf',
        KYOGLE_PDF_URL,
      ].sort(),
    );
    const selected = selectKyogleGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(KYOGLE_PDF_URL);
    expect(selected.url).toContain('2026-11');
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(KYOGLE_GPFS_REPORTING_URL);
    expect(fiscalYearFromKyogleGpfsLink('2025-2026 Annual Financial Statements')).toBe('2025-26');
    expect(
      fiscalYearFromKyogleGpfsLink('Kyogle Council Annual Financial Statements 2026.pdf'),
    ).toBe('2025-26');
    expect(fiscalYearFromKyogleGpfsLink('2025/2026')).toBe('2025-26');
    expect(fiscalYearFromKyogleGpfsLink('Kyogle-Council-Financial-Statements-2024-2025.pdf')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromKyogleGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseKyogleGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      KYOGLE_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = kyoglePinnedDocument();
    expect(pinned.url).toBe(KYOGLE_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('kyogle.nsw.gov.au/sites/default/files/2026-11/');
    const discovered = await discoverKyogleGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(KYOGLE_GPFS_DOCUMENT_PIN);
  });

  it('does not substitute a prior year for the current-year statements', () => {
    const priorOnly = `
      <a href="/sites/default/files/2026-08/Kyogle-Council-Financial-Statements-2024-2025.pdf">Kyogle Council Financial Statements 2024-2025</a>
    `;
    const links = parseKyogleGpfsReportLinks(priorOnly, KYOGLE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectKyogleGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('refuses to guess another fiscal year when the listing has none and no pin applies', async () => {
    await expect(
      discoverKyogleGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2026-27',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Kyogle Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectKyogleGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectKyogleGpfsUnit(['Income Statement 2026 2025']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = KYOGLE_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseKyogleGpfsExtraction(extraction({ income: withoutUnit }), KYOGLE_CONTEXT);
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
    source: { sha256: KYOGLE_PDF_SHA256, bytes: 3_552_048 },
    pages: [
      pdfPage(overrides.income ?? KYOGLE_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? KYOGLE_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? KYOGLE_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Kyogle Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(16);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(107_050);
    expect(reconciliation.total_expenses).toBe(40_352);
    expect(reconciliation.employee_expenses).toBe(11_945);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(11_342);
    expect(reconciliation.government_grants_operating).toBe(13_212);
    expect(reconciliation.government_grants_capital).toBe(63_823);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(66);
    expect(reconciliation.net_result).toBe(66_698);
    expect(reconciliation.net_result_before_capital_grants).toBe(2_875);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(29_010);
    expect(reconciliation.face_expense_bridge).toBe(40_352);
    expect(reconciliation.functions_total_income).toBe(107_050);
    expect(reconciliation.functions_total_expenses).toBe(40_352);
    expect(reconciliation.functions_operating_result).toBe(66_698);
    expect(reconciliation.functions_grants_and_contributions).toBe(77_035);
    expect(reconciliation.comprehensive_income_net_result).toBe(66_698);
    expect(reconciliation.comprehensive_other_income).toBe(34_623);
    expect(reconciliation.comprehensive_total).toBe(101_321);
    expect(reconciliation.revenue_components_sum).toBe(107_050);
    expect(reconciliation.expense_components_sum).toBe(29_010);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(10_705_000_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(4_035_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_194_500_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_134_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_321_200_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(6_382_300_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(6_600_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(20_400_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_401_900_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(8_400_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(6_669_800_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: KYOGLE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: KYOGLE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Kyogle Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: KYOGLE_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Kyogle Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^kyogle-gpfs:/);
      expect(record.source_url).toContain('2025-2026%20Annual%20Financial%20Statements.pdf');
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
    expect(revenueComponents).toHaveLength(6);
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
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = KYOGLE_FUNCTIONS_TEXT.replace(
      'Total functions and activities   107,050   92,806   40,352   41,126',
      'Total functions and activities   107,050   92,806   40,354   41,126',
    );
    const parsed = parseKyogleGpfsExtraction(extraction({ functions: broken }), KYOGLE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = KYOGLE_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council   101,321',
      'Total comprehensive income for the year attributable to Council   101,323',
    );
    const parsed = parseKyogleGpfsExtraction(extraction({ comprehensive: broken }), KYOGLE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = KYOGLE_INCOME_TEXT.replace(
      'Rates and annual charges   B2-1   14,019',
      'Rates and annual charges   B2-1   14,021',
    );
    const parsed = parseKyogleGpfsExtraction(extraction({ income: broken }), KYOGLE_CONTEXT);
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
    const url = KYOGLE_CONTEXT.document.url;
    const revenue = kyogleGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = kyogleGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^kyogle-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(kyogleGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(kyogleGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_kyoglegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: KYOGLE_GPFS_ID,
    name: KYOGLE_GPFS_NAME,
    publisher: KYOGLE_GPFS_PUBLISHER,
    source_url: KYOGLE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: KYOGLE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'kyogle-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Kyogle Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: KYOGLE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-kyogle',
        project_name: 'Existing AusTender Kyogle Council contract',
        delivery_entity: 'KYOGLE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-kyogle',
        project_name: 'Existing GrantConnect Kyogle Council grant',
        delivery_entity: 'Kyogle Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2025-26',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-kyogle-school',
        project_name: 'Existing data.nsw Kyogle school row (not a council row)',
        delivery_entity: 'Kyogle High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-kyogle-charity',
        project_name: 'Existing ACNC Kyogle charity row (not the council)',
        delivery_entity: 'Kyogle Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: KYOGLE_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: KYOGLE_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    expect(
      await MeasureModel.countDocuments({
        source_id: KYOGLE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: KYOGLE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: KYOGLE_GPFS_ID,
        delivery_entity: { $ne: 'Kyogle Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: KYOGLE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
