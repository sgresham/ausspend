import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  COONAMBLE_GPFS_DELIVERY_ENTITY,
  COONAMBLE_GPFS_DOCUMENT_PIN,
  COONAMBLE_GPFS_FISCAL_YEAR,
  COONAMBLE_GPFS_ID,
  COONAMBLE_GPFS_LICENSE,
  COONAMBLE_GPFS_NAME,
  COONAMBLE_GPFS_PUBLISHER,
  COONAMBLE_GPFS_REPORTING_URL,
  coonamblePinnedDocument,
  detectCoonambleGpfsUnit,
  discoverCoonambleGpfsDocument,
  fiscalYearFromCoonambleGpfsLink,
  parseCoonambleGpfsExtraction,
  parseCoonambleGpfsReportLinks,
  selectCoonambleGpfsDocument,
  coonambleGpfsNaturalKey,
} from '../src/connectors/coonamble-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COONAMBLE_COMPREHENSIVE_TEXT,
  COONAMBLE_CONTEXT,
  COONAMBLE_FUNCTIONS_TEXT,
  COONAMBLE_INCOME_TEXT,
  COONAMBLE_PDF_SHA256,
  COONAMBLE_PDF_URL,
  coonambleExtraction,
} from '../src/connectors/coonamble-gpfs/fixture.js';

// Coonamble Shire Council's audited FY2024-25 statements. FY2024-25 is the
// latest audited standalone GPFS published by the council at 2026-11-19; no
// FY2025-26 document is posted, so FY2024-25 is the accepted current-available
// year and the connector never substitutes a 2025-26 or 2023-24 document. The
// Income Statement prints the Original unaudited budget column before the line
// label, with Actual 2025 and Actual 2024 after it. A parser that took the first
// number in the line would read the budget; the expected values are all Actual
// 2025. Coonamble prints eight non-zero revenue lines (including other income and
// a net gain on disposal) and four expense lines (including borrowing costs; no
// net loss on disposal). The net result is positive and the before-capital result
// is negative.

function parsedFixture() {
  return parseCoonambleGpfsExtraction(coonambleExtraction(), COONAMBLE_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Coonamble Shire Council GPFS source discovery', () => {
  const pageHtml = `
    <a class="literature" href="/Annual_Financial_Statements-2025%20final%20audited.pdf"></a>
    <a class="literature" href="/__media_downloads/annual-reports/2023-2024_2_Coonamble_Shire_Council_-_Annual_Financial_Statement.pdf">Annual Financial Statement 2023-24</a>
    <a class="literature" href="/20251128%20Annual%20Report%20-%20FInal%20full.pdf">Annual Report 2025</a>
    <a class="literature" href="/__media_downloads/annual-reports/2022-2023_1_Annual_Report.pdf">Annual Report 2023</a>
    <a href="https://example.com/Annual_Financial_Statements-2025%20final%20audited.pdf">Annual Financial Statements 2025</a>
  `;

  it('discovers FY2024-25 as the current-available statements and never an annual report, prior year or mirror', () => {
    expect(COONAMBLE_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseCoonambleGpfsReportLinks(pageHtml, COONAMBLE_GPFS_REPORTING_URL);
    // Prior years live under the site's annual-reports path and are ignored;
    // only the current-available statements anchor is usable.
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    const current = links.filter((link) => link.fiscal_year === '2024-25');
    expect(current.map((link) => link.url)).toEqual([COONAMBLE_PDF_URL]);
    const selected = selectCoonambleGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(COONAMBLE_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(COONAMBLE_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromCoonambleGpfsLink('Annual_Financial_Statements-2025 final audited.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromCoonambleGpfsLink('Coonamble_Shire_Council_-_Annual_Financial_Statement.pdf'),
    ).toBeNull();
    expect(fiscalYearFromCoonambleGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a class="literature" href="/2023-2024_2_Coonamble_Shire_Council_-_Annual_Financial_Statement.pdf">Annual Financial Statement 2023-24</a>
    `;
    const links = parseCoonambleGpfsReportLinks(priorOnly, COONAMBLE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectCoonambleGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a class="literature" href="/Annual_Financial_Statements-2026%20final%20audited.pdf"></a>
    `;
    const links = parseCoonambleGpfsReportLinks(futureOnly, COONAMBLE_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectCoonambleGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseCoonambleGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      COONAMBLE_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = coonamblePinnedDocument();
    expect(pinned.url).toBe(COONAMBLE_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('Annual_Financial_Statements-2025');
    const discovered = await discoverCoonambleGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(COONAMBLE_GPFS_DOCUMENT_PIN);
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverCoonambleGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Coonamble Shire Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCoonambleGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCoonambleGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = COONAMBLE_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseCoonambleGpfsExtraction(
      extraction({ income: withoutUnit }),
      COONAMBLE_CONTEXT,
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
    source: { sha256: COONAMBLE_PDF_SHA256, bytes: 3_992_002 },
    pages: [
      pdfPage(overrides.income ?? COONAMBLE_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? COONAMBLE_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? COONAMBLE_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Coonamble Shire Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(36_346);
    expect(reconciliation.total_expenses).toBe(34_144);
    expect(reconciliation.employee_expenses).toBe(11_784);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(8_057);
    expect(reconciliation.government_grants_operating).toBe(10_385);
    expect(reconciliation.government_grants_capital).toBe(4_308);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(82);
    expect(reconciliation.net_result).toBe(2_202);
    expect(reconciliation.net_result_before_capital_grants).toBe(-2_106);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(26_087);
    expect(reconciliation.face_expense_bridge).toBe(34_144);
    expect(reconciliation.functions_total_income).toBe(36_346);
    expect(reconciliation.functions_total_expenses).toBe(34_144);
    expect(reconciliation.functions_operating_result).toBe(2_202);
    expect(reconciliation.functions_grants_and_contributions).toBe(14_693);
    expect(reconciliation.comprehensive_income_net_result).toBe(2_202);
    expect(reconciliation.comprehensive_other_income).toBe(10_355);
    expect(reconciliation.comprehensive_total).toBe(12_557);
    expect(reconciliation.comprehensive_revaluation).toBe(10_355);
    expect(reconciliation.revenue_components_sum).toBe(36_346);
    expect(reconciliation.expense_components_sum).toBe(26_087);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_634_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(3_414_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_178_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      805_700_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_038_500_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(430_800_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(8_200_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(3_200_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(796_000_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(182_500_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(11_700_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(220_200_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: COONAMBLE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: COONAMBLE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Coonamble Shire Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: COONAMBLE_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Coonamble Shire Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^coonamble-gpfs:/);
      expect(record.source_url).toContain('Annual_Financial_Statements-2025');
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
    expect(revenueComponents).toHaveLength(8);
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
    expect(
      records.every((record) =>
        ['revenue', 'expenses', 'result'].includes(String(record.gpfs_section)),
      ),
    ).toBe(true);
    expect(records.every((record) => record.jurisdiction_level === 'local')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = COONAMBLE_FUNCTIONS_TEXT.replace(
      'Total functions and activities 36,346 41,009 34,144 29,920',
      'Total functions and activities 36,346 41,009 34,146 29,920',
    );
    const parsed = parseCoonambleGpfsExtraction(extraction({ functions: broken }), COONAMBLE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = COONAMBLE_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 12,557',
      'Total comprehensive income for the year attributable to Council 12,559',
    );
    const parsed = parseCoonambleGpfsExtraction(
      extraction({ comprehensive: broken }),
      COONAMBLE_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = COONAMBLE_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 7,960',
      'Rates and annual charges B2-1 7,962',
    );
    const parsed = parseCoonambleGpfsExtraction(extraction({ income: broken }), COONAMBLE_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = COONAMBLE_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 10,355',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 10,357',
    );
    const parsed = parseCoonambleGpfsExtraction(
      extraction({ comprehensive: broken }),
      COONAMBLE_CONTEXT,
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
    const url = COONAMBLE_CONTEXT.document.url;
    const revenue = coonambleGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = coonambleGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^coonamble-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(coonambleGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(coonambleGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_coonamblegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: COONAMBLE_GPFS_ID,
    name: COONAMBLE_GPFS_NAME,
    publisher: COONAMBLE_GPFS_PUBLISHER,
    source_url: COONAMBLE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: COONAMBLE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'coonamble-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Coonamble Shire Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: COONAMBLE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-coonamble',
        project_name: 'Existing AusTender Coonamble Shire contract',
        delivery_entity: 'COONAMBLE SHIRE COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-coonamble',
        project_name: 'Existing GrantConnect Coonamble Shire grant',
        delivery_entity: 'Coonamble Shire Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-coonamble-school',
        project_name: 'Existing data.nsw Coonamble school row (not a council row)',
        delivery_entity: 'Coonamble High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-coonamble-charity',
        project_name: 'Existing ACNC Coonamble charity row (not the council)',
        delivery_entity: 'Coonamble Community Centre Inc',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2023-24',
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
    expect(await MeasureModel.countDocuments({ source_id: COONAMBLE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: COONAMBLE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: COONAMBLE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: COONAMBLE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: COONAMBLE_GPFS_ID,
        delivery_entity: { $ne: 'Coonamble Shire Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: COONAMBLE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
