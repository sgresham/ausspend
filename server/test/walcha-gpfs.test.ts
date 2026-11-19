import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  WALCHA_GPFS_DELIVERY_ENTITY,
  WALCHA_GPFS_DOCUMENT_PIN,
  WALCHA_GPFS_FISCAL_YEAR,
  WALCHA_GPFS_ID,
  WALCHA_GPFS_LICENSE,
  WALCHA_GPFS_NAME,
  WALCHA_GPFS_PUBLISHER,
  WALCHA_GPFS_REPORTING_URL,
  walchaPinnedDocument,
  detectWalchaGpfsUnit,
  discoverWalchaGpfsDocument,
  fiscalYearFromWalchaGpfsLink,
  parseWalchaGpfsExtraction,
  parseWalchaGpfsReportLinks,
  selectWalchaGpfsDocument,
  walchaGpfsNaturalKey,
} from '../src/connectors/walcha-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  WALCHA_COMPREHENSIVE_TEXT,
  WALCHA_CONTEXT,
  WALCHA_FUNCTIONS_TEXT,
  WALCHA_INCOME_TEXT,
  WALCHA_PDF_SHA256,
  WALCHA_PDF_URL,
  walchaExtraction,
} from '../src/connectors/walcha-gpfs/fixture.js';

// Walcha Council's audited FY2024-25 statements. FY2024-25 is the latest audited
// standalone GPFS published by the council at 2026-11-19; no FY2025-26 document
// is posted and the annual-report page is stale, so FY2024-25 is the accepted
// current-available year and the connector never substitutes a 2025-26 or
// 2023-24 document. The Income Statement prints the Original unaudited budget
// column before the line label, with Actual 2025 and Actual 2024 after it. A
// parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025. Walcha prints seven non-zero revenue lines
// (its net gain on disposal is nil) and five expense lines (including borrowing
// costs and a net loss on disposal), then a below-the-line business-combination
// gain that bridges the operating result to the net result.

function parsedFixture() {
  return parseWalchaGpfsExtraction(walchaExtraction(), WALCHA_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Walcha Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="https://walcha.nsw.gov.au/wp-content/uploads/2025/12/Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf">General Purpose Financial Statements</a>
    <a href="https://walcha.nsw.gov.au/wp-content/uploads/2025/12/Walcha-Council-Special-Purpose-Financial-Statements-20242025.pdf">Special Purpose Financial Statements</a>
    <a href="https://walcha.nsw.gov.au/wp-content/uploads/2025/12/Walcha-Council-Special-Schedules-Financial-Statements-20242025.pdf">Special Schedules Financial Statements</a>
    <a href="https://walcha.nsw.gov.au/wp-content/uploads/2022/11/Walcha-Council-Annual-Report-2022.pdf">Annual Report 2022</a>
    <a href="https://example.com/Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf">General Purpose Financial Statements</a>
  `;

  it('discovers the FY2024-25 GPFS and never the special-purpose, special-schedules or annual report', () => {
    expect(WALCHA_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseWalchaGpfsReportLinks(pageHtml, WALCHA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(links.map((link) => link.url)).toEqual([WALCHA_PDF_URL]);
    const selected = selectWalchaGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(WALCHA_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(WALCHA_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromWalchaGpfsLink(
        'Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromWalchaGpfsLink('Walcha-Council-General-Purpose-Financial-Statements-2023-2024.pdf'),
    ).toBe('2023-24');
    expect(fiscalYearFromWalchaGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="https://walcha.nsw.gov.au/wp-content/uploads/2024/11/Walcha-Council-General-Purpose-Financial-Statements-2023-2024.pdf">General Purpose Financial Statements</a>
    `;
    const links = parseWalchaGpfsReportLinks(priorOnly, WALCHA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectWalchaGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="https://walcha.nsw.gov.au/wp-content/uploads/2026/11/Walcha-Council-General-Purpose-Financial-Statements-20252026.pdf">General Purpose Financial Statements</a>
    `;
    const links = parseWalchaGpfsReportLinks(futureOnly, WALCHA_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectWalchaGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseWalchaGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      WALCHA_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = walchaPinnedDocument();
    expect(pinned.url).toBe(WALCHA_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('General-Purpose-Financial-Statements-20242025.pdf');
    const discovered = await discoverWalchaGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(WALCHA_GPFS_DOCUMENT_PIN);
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverWalchaGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Walcha Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectWalchaGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectWalchaGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = WALCHA_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseWalchaGpfsExtraction(extraction({ income: withoutUnit }), WALCHA_CONTEXT);
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
    source: { sha256: WALCHA_PDF_SHA256, bytes: 1_883_547 },
    pages: [
      pdfPage(overrides.income ?? WALCHA_INCOME_TEXT, 6),
      pdfPage(overrides.comprehensive ?? WALCHA_COMPREHENSIVE_TEXT, 7),
      pdfPage(overrides.functions ?? WALCHA_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Walcha Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(34_522);
    expect(reconciliation.total_expenses).toBe(24_187);
    expect(reconciliation.employee_expenses).toBe(9_214);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(5_112);
    expect(reconciliation.government_grants_operating).toBe(6_598);
    expect(reconciliation.government_grants_capital).toBe(12_185);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(722);
    expect(reconciliation.business_combination_gain).toBe(7_520);
    expect(reconciliation.operating_result).toBe(10_335);
    expect(reconciliation.net_result).toBe(17_855);
    expect(reconciliation.net_result_before_capital_grants).toBe(5_670);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(19_075);
    expect(reconciliation.face_expense_bridge).toBe(24_187);
    expect(reconciliation.functions_total_income).toBe(42_042);
    expect(reconciliation.functions_total_expenses).toBe(24_187);
    expect(reconciliation.functions_operating_result).toBe(17_855);
    expect(reconciliation.functions_grants_and_contributions).toBe(18_783);
    expect(reconciliation.comprehensive_income_net_result).toBe(17_855);
    expect(reconciliation.comprehensive_other_income).toBe(37_537);
    expect(reconciliation.comprehensive_total).toBe(55_392);
    expect(reconciliation.comprehensive_revaluation).toBe(37_537);
    expect(reconciliation.comprehensive_items_not_reclassified).toBe(37_537);
    expect(reconciliation.revenue_components_sum).toBe(34_522);
    expect(reconciliation.expense_components_sum).toBe(19_075);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(3_452_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(2_418_700_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(921_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      511_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(659_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_218_500_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      72_200_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(17_700_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(738_000_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(65_400_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(84_300_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_785_500_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(records.some((record) => record.gpfs_line_item === 'net_gain_from_disposal_of_assets')).toBe(
      false,
    );
    expect(
      records.some((record) => record.gpfs_line_item === 'business_combination_gain'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: WALCHA_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: WALCHA_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Walcha Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: WALCHA_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Walcha Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^walcha-gpfs:/);
      expect(record.source_url).toContain('General-Purpose-Financial-Statements-20242025.pdf');
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
    const broken = WALCHA_FUNCTIONS_TEXT.replace(
      'Total functions and activities 42,042 33,019 24,187 19,353',
      'Total functions and activities 42,042 33,019 24,189 19,353',
    );
    const parsed = parseWalchaGpfsExtraction(extraction({ functions: broken }), WALCHA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = WALCHA_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 55,392',
      'Total comprehensive income for the year attributable to Council 55,394',
    );
    const parsed = parseWalchaGpfsExtraction(extraction({ comprehensive: broken }), WALCHA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = WALCHA_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 7,380',
      'Rates and annual charges B2-1 7,382',
    );
    const parsed = parseWalchaGpfsExtraction(extraction({ income: broken }), WALCHA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the business-combination gain is altered', () => {
    const broken = WALCHA_INCOME_TEXT.replace(
      'Gain from business combinations D3 7,520',
      'Gain from business combinations D3 7,522',
    );
    const parsed = parseWalchaGpfsExtraction(extraction({ income: broken }), WALCHA_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = WALCHA_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 37,537',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 37,539',
    );
    const parsed = parseWalchaGpfsExtraction(extraction({ comprehensive: broken }), WALCHA_CONTEXT);
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
    const url = WALCHA_CONTEXT.document.url;
    const revenue = walchaGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = walchaGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^walcha-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(walchaGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(walchaGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_walchagpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: WALCHA_GPFS_ID,
    name: WALCHA_GPFS_NAME,
    publisher: WALCHA_GPFS_PUBLISHER,
    source_url: WALCHA_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: WALCHA_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'walcha-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Walcha Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: WALCHA_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-walcha',
        project_name: 'Existing AusTender Walcha contract',
        delivery_entity: 'WALCHA COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-walcha',
        project_name: 'Existing GrantConnect Walcha grant',
        delivery_entity: 'Walcha Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-walcha-school',
        project_name: 'Existing data.nsw Walcha school row (not a council row)',
        delivery_entity: 'Walcha Central School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-walcha-charity',
        project_name: 'Existing ACNC Walcha charity row (not the council)',
        delivery_entity: 'Walcha Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: WALCHA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: WALCHA_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: WALCHA_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WALCHA_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: WALCHA_GPFS_ID,
        delivery_entity: { $ne: 'Walcha Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: WALCHA_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
