import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  HILLTOPS_GPFS_DELIVERY_ENTITY,
  HILLTOPS_GPFS_DOCUMENT_PIN,
  HILLTOPS_GPFS_FISCAL_YEAR,
  HILLTOPS_GPFS_ID,
  HILLTOPS_GPFS_LICENSE,
  HILLTOPS_GPFS_NAME,
  HILLTOPS_GPFS_PUBLISHER,
  HILLTOPS_GPFS_REPORTING_URL,
  hilltopsPinnedDocument,
  detectHilltopsGpfsUnit,
  discoverHilltopsGpfsDocument,
  fiscalYearFromHilltopsGpfsLink,
  parseHilltopsGpfsExtraction,
  parseHilltopsGpfsReportLinks,
  selectHilltopsGpfsDocument,
  hilltopsGpfsNaturalKey,
} from '../src/connectors/hilltops-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  HILLTOPS_COMPREHENSIVE_TEXT,
  HILLTOPS_CONTEXT,
  HILLTOPS_FUNCTIONS_TEXT,
  HILLTOPS_INCOME_TEXT,
  HILLTOPS_PDF_SHA256,
  HILLTOPS_PDF_URL,
  hilltopsExtraction,
} from '../src/connectors/hilltops-gpfs/fixture.js';

// Hilltops Council's audited FY2024-25 statements. This is the latest audited
// standalone GPFS published by the council at 2026-11-19 (there is no FY2025-26
// document yet), so FY2024-25 is the accepted current-available year and the
// connector never substitutes a different year. The Income Statement prints the
// Original unaudited budget column before the line label, with Actual 2025 and
// Actual 2024 after it. A parser that took the first number in the line would
// read the budget; the expected values are all Actual 2025. Hilltops prints eight
// revenue lines (including other income and a net gain on disposal) and four
// expense lines (including borrowing costs; net loss on disposal is nil). Its
// net result is the standalone "Operating result from continuing operations"
// line, read from the last occurrence because the phrase also appears in the
// "excluding depreciation..." line.

function parsedFixture() {
  return parseHilltopsGpfsExtraction(hilltopsExtraction(), HILLTOPS_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Hilltops Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="https://www.hilltops.nsw.gov.au/wp-content/uploads/2025/08/Hilltops-Council-Annual-Financial-Statements-2025.pdf">
      Hilltops Council Annual Financial Statements 2025
    </a>
    <a href="https://www.hilltops.nsw.gov.au/wp-content/uploads/2024/10/Annual_Financial_Statements-2023-2024.pdf">
      Annual Financial Statements 2023-2024
    </a>
    <a href="https://www.hilltops.nsw.gov.au/wp-content/uploads/2025/08/Hilltops-Council-Annual-Report-2024-2025.pdf">
      Hilltops Council Annual Report 2024-2025
    </a>
    <a href="https://www.hilltops.nsw.gov.au/wp-content/uploads/2025/01/Public_Notice_-_Presentation_of_Financial_Statements.pdf">
      Public Notice - Presentation of Financial Statements
    </a>
    <a href="https://example.com/Hilltops-Council-Annual-Financial-Statements-2025.pdf">
      Hilltops Council Annual Financial Statements 2025
    </a>
  `;

  it('accepts FY2024-25 as the brief current-available year and discovers the audited statements', () => {
    expect(HILLTOPS_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseHilltopsGpfsReportLinks(pageHtml, HILLTOPS_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year).sort()).toEqual(['2023-24', '2024-25']);
    const current = links.filter((link) => link.fiscal_year === '2024-25');
    expect(current.map((link) => link.url)).toEqual([HILLTOPS_PDF_URL]);
    const selected = selectHilltopsGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(HILLTOPS_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(HILLTOPS_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromHilltopsGpfsLink('Hilltops-Council-Annual-Financial-Statements-2025.pdf'),
    ).toBe('2024-25');
    expect(fiscalYearFromHilltopsGpfsLink('Annual_Financial_Statements-2023-2024.pdf')).toBe(
      '2023-24',
    );
    expect(fiscalYearFromHilltopsGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale year and never silently substitutes 2023-24 for the target 2024-25', () => {
    const staleOnly = `
      <a href="https://www.hilltops.nsw.gov.au/wp-content/uploads/2024/10/Annual_Financial_Statements-2023-2024.pdf">Annual Financial Statements 2023-2024</a>
    `;
    const links = parseHilltopsGpfsReportLinks(staleOnly, HILLTOPS_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectHilltopsGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="https://www.hilltops.nsw.gov.au/wp-content/uploads/2026/09/Hilltops-Council-Annual-Financial-Statements-2026.pdf">Hilltops Council Annual Financial Statements 2026</a>
    `;
    const links = parseHilltopsGpfsReportLinks(futureOnly, HILLTOPS_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectHilltopsGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no usable anchor', async () => {
    const links = parseHilltopsGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      HILLTOPS_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = hilltopsPinnedDocument();
    expect(pinned.url).toBe(HILLTOPS_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('Hilltops-Council-Annual-Financial-Statements-2025.pdf');
    const discovered = await discoverHilltopsGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(HILLTOPS_GPFS_DOCUMENT_PIN);
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverHilltopsGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Hilltops Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectHilltopsGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectHilltopsGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = HILLTOPS_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseHilltopsGpfsExtraction(
      extraction({ income: withoutUnit }),
      HILLTOPS_CONTEXT,
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
    source: { sha256: HILLTOPS_PDF_SHA256, bytes: 5_068_393 },
    pages: [
      pdfPage(overrides.income ?? HILLTOPS_INCOME_TEXT, 5),
      pdfPage(overrides.comprehensive ?? HILLTOPS_COMPREHENSIVE_TEXT, 6),
      pdfPage(overrides.functions ?? HILLTOPS_FUNCTIONS_TEXT, 15),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Hilltops Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(86_723);
    expect(reconciliation.total_expenses).toBe(78_018);
    expect(reconciliation.employee_expenses).toBe(23_947);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(24_161);
    expect(reconciliation.government_grants_operating).toBe(15_478);
    expect(reconciliation.government_grants_capital).toBe(20_985);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(83);
    expect(reconciliation.net_result).toBe(8_705);
    expect(reconciliation.net_result_before_capital_grants).toBe(-12_280);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(53_857);
    expect(reconciliation.face_expense_bridge).toBe(78_018);
    expect(reconciliation.functions_total_income).toBe(86_723);
    expect(reconciliation.functions_total_expenses).toBe(78_018);
    expect(reconciliation.functions_operating_result).toBe(8_705);
    expect(reconciliation.functions_grants_and_contributions).toBe(36_463);
    expect(reconciliation.comprehensive_income_net_result).toBe(8_705);
    expect(reconciliation.comprehensive_other_income).toBe(24_300);
    expect(reconciliation.comprehensive_total).toBe(33_005);
    expect(reconciliation.revenue_components_sum).toBe(86_723);
    expect(reconciliation.expense_components_sum).toBe(53_857);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(8_672_300_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(7_801_800_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_394_700_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_416_100_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_547_800_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(2_098_500_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(8_300_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(108_400_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(2_804_200_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(151_400_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(72_400_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(870_500_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(records.every((record) => record.fiscal_year === '2024-25')).toBe(true);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: HILLTOPS_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: HILLTOPS_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Hilltops Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: HILLTOPS_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Hilltops Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^hilltops-gpfs:/);
      expect(record.source_url).toContain('Hilltops-Council-Annual-Financial-Statements-2025.pdf');
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
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = HILLTOPS_FUNCTIONS_TEXT.replace(
      'Total functions and activities   86,723   88,339   78,018   73,404',
      'Total functions and activities   86,723   88,339   78,020   73,404',
    );
    const parsed = parseHilltopsGpfsExtraction(extraction({ functions: broken }), HILLTOPS_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = HILLTOPS_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council   33,005',
      'Total comprehensive income for the year attributable to Council   33,007',
    );
    const parsed = parseHilltopsGpfsExtraction(
      extraction({ comprehensive: broken }),
      HILLTOPS_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = HILLTOPS_INCOME_TEXT.replace(
      'Rates and annual charges   B2-1   28,042',
      'Rates and annual charges   B2-1   28,044',
    );
    const parsed = parseHilltopsGpfsExtraction(extraction({ income: broken }), HILLTOPS_CONTEXT);
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
    const url = HILLTOPS_CONTEXT.document.url;
    const revenue = hilltopsGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = hilltopsGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^hilltops-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(hilltopsGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(hilltopsGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_hilltopsgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: HILLTOPS_GPFS_ID,
    name: HILLTOPS_GPFS_NAME,
    publisher: HILLTOPS_GPFS_PUBLISHER,
    source_url: HILLTOPS_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: HILLTOPS_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'hilltops-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Hilltops Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: HILLTOPS_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-hilltops',
        project_name: 'Existing AusTender Hilltops contract',
        delivery_entity: 'HILLTOPS COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-hilltops',
        project_name: 'Existing GrantConnect Hilltops grant',
        delivery_entity: 'Hilltops Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-hilltops-school',
        project_name: 'Existing data.nsw Hilltops school row (not a council row)',
        delivery_entity: 'Hilltops High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-hilltops-charity',
        project_name: 'Existing ACNC Hilltops charity row (not the council)',
        delivery_entity: 'Hilltops Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: HILLTOPS_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: HILLTOPS_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: HILLTOPS_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: HILLTOPS_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: HILLTOPS_GPFS_ID,
        delivery_entity: { $ne: 'Hilltops Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: HILLTOPS_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
