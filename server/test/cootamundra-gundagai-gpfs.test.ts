import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  COOTAMUNDRA_GUNDAGAI_GPFS_DELIVERY_ENTITY,
  COOTAMUNDRA_GUNDAGAI_GPFS_DOCUMENT_PIN,
  COOTAMUNDRA_GUNDAGAI_GPFS_FISCAL_YEAR,
  COOTAMUNDRA_GUNDAGAI_GPFS_ID,
  COOTAMUNDRA_GUNDAGAI_GPFS_LICENSE,
  COOTAMUNDRA_GUNDAGAI_GPFS_NAME,
  COOTAMUNDRA_GUNDAGAI_GPFS_PUBLISHER,
  COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL,
  cgrcPinnedDocument,
  detectCgrcGpfsUnit,
  discoverCgrcGpfsDocument,
  fiscalYearFromCgrcGpfsLink,
  parseCgrcGpfsExtraction,
  parseCgrcGpfsReportLinks,
  selectCgrcGpfsDocument,
  cgrcGpfsNaturalKey,
} from '../src/connectors/cootamundra-gundagai-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COOTAMUNDRA_GUNDAGAI_COMPREHENSIVE_TEXT,
  COOTAMUNDRA_GUNDAGAI_CONTEXT,
  COOTAMUNDRA_GUNDAGAI_FUNCTIONS_TEXT,
  COOTAMUNDRA_GUNDAGAI_INCOME_TEXT,
  COOTAMUNDRA_GUNDAGAI_PDF_SHA256,
  COOTAMUNDRA_GUNDAGAI_PDF_URL,
  cgrcExtraction,
} from '../src/connectors/cootamundra-gundagai-gpfs/fixture.js';

// Cootamundra-Gundagai Regional Council's audited FY2024-25 statements. This is
// the latest audited standalone GPFS published by the council at 2026-11-19
// (there is no FY2025-26 document yet), so FY2024-25 is the brief's accepted
// current-available year and the connector never substitutes a different year.
// The Income Statement prints the Original unaudited budget column before the
// line label, with Actual 2025 and Actual 2024 after it. A parser that took the
// first number in the line would read the budget; the expected values are all
// Actual 2025. CGRC prints seven revenue lines (including other income; its net
// gain on disposal is nil) and five expense lines (including borrowing costs and
// a net loss on disposal). The net result and before-capital result are negative.

function parsedFixture() {
  return parseCgrcGpfsExtraction(cgrcExtraction(), COOTAMUNDRA_GUNDAGAI_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Cootamundra-Gundagai Regional Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="https://www.cgrc.nsw.gov.au/wp-content/uploads/2026/01/Cootamundra-Gundagai-Regional-Council-Financial-Statements-2024-25-Audited.pdf">
      Cootamundra-Gundagai Regional Council Financial Statements 2024-25 Audited
    </a>
    <a href="https://www.cgrc.nsw.gov.au/wp-content/uploads/2024/12/CGRC-Annual_Financial_Statements-2024.pdf">
      CGRC Annual Financial Statements 2024
    </a>
    <a href="https://www.cgrc.nsw.gov.au/wp-content/uploads/2020/12/Annual_Financial_Statements_NotePN_Public_Notice_%E2%80%93_Presentation_of_Financial_Statements.pdf">
      Public Notice - Presentation of Financial Statements
    </a>
    <a href="https://www.cgrc.nsw.gov.au/wp-content/uploads/2024/11/Annual-Report-2023-24.pdf">
      Annual Report 2023-24
    </a>
    <a href="https://example.com/Cootamundra-Gundagai-Regional-Council-Financial-Statements-2024-25-Audited.pdf">
      Financial Statements 2024-25 Audited
    </a>
  `;

  it('accepts FY2024-25 as the brief current-available year and discovers the audited statements', () => {
    expect(COOTAMUNDRA_GUNDAGAI_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseCgrcGpfsReportLinks(pageHtml, COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year).sort()).toEqual(['2023-24', '2024-25']);
    const current = links.filter((link) => link.fiscal_year === '2024-25');
    expect(current.map((link) => link.url)).toEqual([COOTAMUNDRA_GUNDAGAI_PDF_URL]);
    const selected = selectCgrcGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(COOTAMUNDRA_GUNDAGAI_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromCgrcGpfsLink(
        'Cootamundra-Gundagai-Regional-Council-Financial-Statements-2024-25-Audited.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromCgrcGpfsLink('CGRC-Annual_Financial_Statements-2024.pdf')).toBe('2023-24');
    expect(fiscalYearFromCgrcGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale year and never silently substitutes 2023-24 for the target 2024-25', () => {
    const staleOnly = `
      <a href="https://www.cgrc.nsw.gov.au/wp-content/uploads/2024/12/CGRC-Annual_Financial_Statements-2024.pdf">CGRC Annual Financial Statements 2024</a>
    `;
    const links = parseCgrcGpfsReportLinks(staleOnly, COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectCgrcGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureLink = `
      <a href="https://www.cgrc.nsw.gov.au/wp-content/uploads/2027/01/Cootamundra-Gundagai-Regional-Council-Financial-Statements-2025-26-Audited.pdf">Financial Statements 2025-26 Audited</a>
    `;
    const links = parseCgrcGpfsReportLinks(futureLink, COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectCgrcGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseCgrcGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = cgrcPinnedDocument();
    expect(pinned.url).toBe(COOTAMUNDRA_GUNDAGAI_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('Financial-Statements-2024-25-Audited.pdf');
    const discovered = await discoverCgrcGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(COOTAMUNDRA_GUNDAGAI_GPFS_DOCUMENT_PIN);
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverCgrcGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Cootamundra-Gundagai Regional Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectCgrcGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectCgrcGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = COOTAMUNDRA_GUNDAGAI_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseCgrcGpfsExtraction(
      extraction({ income: withoutUnit }),
      COOTAMUNDRA_GUNDAGAI_CONTEXT,
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
    source: { sha256: COOTAMUNDRA_GUNDAGAI_PDF_SHA256, bytes: 2_565_827 },
    pages: [
      pdfPage(overrides.income ?? COOTAMUNDRA_GUNDAGAI_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? COOTAMUNDRA_GUNDAGAI_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? COOTAMUNDRA_GUNDAGAI_FUNCTIONS_TEXT, 14),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Cootamundra-Gundagai Regional Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(53_114);
    expect(reconciliation.total_expenses).toBe(55_332);
    expect(reconciliation.employee_expenses).toBe(14_801);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(13_274);
    expect(reconciliation.government_grants_operating).toBe(9_263);
    expect(reconciliation.government_grants_capital).toBe(6_300);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(2_242);
    expect(reconciliation.net_result).toBe(-2_218);
    expect(reconciliation.net_result_before_capital_grants).toBe(-8_518);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(42_058);
    expect(reconciliation.face_expense_bridge).toBe(55_332);
    expect(reconciliation.functions_total_income).toBe(53_114);
    expect(reconciliation.functions_total_expenses).toBe(55_332);
    expect(reconciliation.functions_operating_result).toBe(-2_218);
    expect(reconciliation.functions_grants_and_contributions).toBe(15_563);
    expect(reconciliation.comprehensive_income_net_result).toBe(-2_218);
    expect(reconciliation.comprehensive_other_income).toBe(17_777);
    expect(reconciliation.comprehensive_total).toBe(15_559);
    expect(reconciliation.revenue_components_sum).toBe(53_114);
    expect(reconciliation.expense_components_sum).toBe(42_058);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(5_311_400_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(5_533_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(1_480_100_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_327_400_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(926_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(630_000_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      224_200_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(29_800_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(1_980_700_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(88_500_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(99_400_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(221_800_000);
    expect(netResult.gpfs_printed_sign).toBe('negative');
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: COOTAMUNDRA_GUNDAGAI_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: COOTAMUNDRA_GUNDAGAI_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Cootamundra-Gundagai Regional Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: COOTAMUNDRA_GUNDAGAI_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Cootamundra-Gundagai Regional Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^cootamundra-gundagai-gpfs:/);
      expect(record.source_url).toContain('Financial-Statements-2024-25-Audited.pdf');
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
    const broken = COOTAMUNDRA_GUNDAGAI_FUNCTIONS_TEXT.replace(
      'Total functions and activities   53,114   58,168   55,332   62,281',
      'Total functions and activities   53,114   58,168   55,334   62,281',
    );
    const parsed = parseCgrcGpfsExtraction(
      extraction({ functions: broken }),
      COOTAMUNDRA_GUNDAGAI_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = COOTAMUNDRA_GUNDAGAI_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council   15,559',
      'Total comprehensive income for the year attributable to Council   15,561',
    );
    const parsed = parseCgrcGpfsExtraction(
      extraction({ comprehensive: broken }),
      COOTAMUNDRA_GUNDAGAI_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = COOTAMUNDRA_GUNDAGAI_INCOME_TEXT.replace(
      'Rates and annual charges   B2-1   19,807',
      'Rates and annual charges   B2-1   19,809',
    );
    const parsed = parseCgrcGpfsExtraction(
      extraction({ income: broken }),
      COOTAMUNDRA_GUNDAGAI_CONTEXT,
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
    const url = COOTAMUNDRA_GUNDAGAI_CONTEXT.document.url;
    const revenue = cgrcGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = cgrcGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^cootamundra-gundagai-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(cgrcGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(cgrcGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_cgrcgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: COOTAMUNDRA_GUNDAGAI_GPFS_ID,
    name: COOTAMUNDRA_GUNDAGAI_GPFS_NAME,
    publisher: COOTAMUNDRA_GUNDAGAI_GPFS_PUBLISHER,
    source_url: COOTAMUNDRA_GUNDAGAI_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: COOTAMUNDRA_GUNDAGAI_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'cootamundra-gundagai-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Cootamundra-Gundagai Regional Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: COOTAMUNDRA_GUNDAGAI_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-cgrc',
        project_name: 'Existing AusTender Cootamundra-Gundagai contract',
        delivery_entity: 'COOTAMUNDRA-GUNDAGAI REGIONAL COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-cgrc',
        project_name: 'Existing GrantConnect Cootamundra-Gundagai grant',
        delivery_entity: 'Cootamundra-Gundagai Regional Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-cgrc-school',
        project_name: 'Existing data.nsw Cootamundra-Gundagai school row (not a council row)',
        delivery_entity: 'Cootamundra High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-cgrc-charity',
        project_name: 'Existing ACNC Cootamundra-Gundagai charity row (not the council)',
        delivery_entity: 'Cootamundra Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: COOTAMUNDRA_GUNDAGAI_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: COOTAMUNDRA_GUNDAGAI_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: COOTAMUNDRA_GUNDAGAI_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: COOTAMUNDRA_GUNDAGAI_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: COOTAMUNDRA_GUNDAGAI_GPFS_ID,
        delivery_entity: { $ne: 'Cootamundra-Gundagai Regional Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({
      source_id: COOTAMUNDRA_GUNDAGAI_GPFS_ID,
    }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
