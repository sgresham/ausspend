import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  SINGLETON_GPFS_DELIVERY_ENTITY,
  SINGLETON_GPFS_DOCUMENT_PIN,
  SINGLETON_GPFS_FISCAL_YEAR,
  SINGLETON_GPFS_ID,
  SINGLETON_GPFS_LICENSE,
  SINGLETON_GPFS_NAME,
  SINGLETON_GPFS_PUBLISHER,
  SINGLETON_GPFS_REPORTING_URL,
  SINGLETON_GPFS_REQUEST_HEADERS,
  singletonPinnedDocument,
  detectSingletonGpfsUnit,
  discoverSingletonGpfsDocument,
  fiscalYearFromSingletonGpfsLink,
  parseSingletonGpfsExtraction,
  parseSingletonGpfsReportLinks,
  selectSingletonGpfsDocument,
  singletonGpfsNaturalKey,
} from '../src/connectors/singleton-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  SINGLETON_COMPREHENSIVE_TEXT,
  SINGLETON_CONTEXT,
  SINGLETON_FUNCTIONS_TEXT,
  SINGLETON_INCOME_TEXT,
  SINGLETON_PDF_SHA256,
  SINGLETON_PDF_URL,
  singletonExtraction,
} from '../src/connectors/singleton-gpfs/fixture.js';

// Singleton Council's audited FY2025-26 standalone financial statements.
// FY2025-26 is the current year for this source; the connector targets 2025-26
// only and never substitutes the prior 2024-25 or 2023-24 documents. The
// statement source is the standalone annual financial statements (not the
// narrative annual report). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2026 and Actual 2025 after
// it. A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2026. Singleton prints seven revenue lines
// and five expense lines (including a real net loss on disposal of 1,721). The
// net result and the printed before-capital result are both positive.

function parsedFixture() {
  return parseSingletonGpfsExtraction(singletonExtraction(), SINGLETON_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Singleton Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="https://docs.singleton.nsw.gov.au/default.aspx?DocID=cVK9GDcvrvY%3d">2025/2026</a>
    <a href="https://docs.singleton.nsw.gov.au/default.aspx?DocID=f25B6S3%2fUeI%3d">2024/2025</a>
    <a href="https://online.flippingbook.com/view/963868174/">Annual Financial Statements 2026-2026</a>
    <a href="https://docs.singleton.nsw.gov.au/default.aspx?DocID=eKbDb4SSjY8%3d">2025/2026 Annual Report</a>
    <a href="https://example.com/default.aspx?DocID=cVK9GDcvrvY%3d">2025/2026 mirror</a>
  `;

  it('discovers the FY2025-26 DocID statements and never the annual report, flippingbook or a mirror', () => {
    expect(SINGLETON_GPFS_FISCAL_YEAR).toBe('2025-26');
    const links = parseSingletonGpfsReportLinks(pageHtml, SINGLETON_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26', '2024-25']);
    expect(links.map((link) => link.url)).toEqual([
      SINGLETON_PDF_URL,
      'https://docs.singleton.nsw.gov.au/default.aspx?DocID=f25B6S3%2fUeI%3d',
    ]);
    const selected = selectSingletonGpfsDocument(links, '2025-26');
    expect(selected.url).toBe(SINGLETON_PDF_URL);
    expect(selected.fiscal_year).toBe('2025-26');
    expect(selected.listing_url).toBe(SINGLETON_GPFS_REPORTING_URL);
    expect(fiscalYearFromSingletonGpfsLink('2025/2026')).toBe('2025-26');
    expect(fiscalYearFromSingletonGpfsLink('2024/2025')).toBe('2024-25');
    expect(
      fiscalYearFromSingletonGpfsLink('Annual Financial Statements for the year ended 30 June 2026'),
    ).toBe('2025-26');
    expect(fiscalYearFromSingletonGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2024-25 for the target 2025-26', () => {
    const priorOnly = `
      <a href="https://docs.singleton.nsw.gov.au/default.aspx?DocID=f25B6S3%2fUeI%3d">2024/2025</a>
    `;
    const links = parseSingletonGpfsReportLinks(priorOnly, SINGLETON_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25']);
    expect(() => selectSingletonGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('does not substitute a 2026-27 link for the FY2025-26 target', () => {
    const futureOnly = `
      <a href="https://docs.singleton.nsw.gov.au/default.aspx?DocID=future2027token">2026/2027</a>
    `;
    const links = parseSingletonGpfsReportLinks(futureOnly, SINGLETON_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2026-27']);
    expect(() => selectSingletonGpfsDocument(links, '2025-26')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseSingletonGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      SINGLETON_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = singletonPinnedDocument();
    expect(pinned.url).toBe(SINGLETON_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2025-26');
    expect(pinned.url).toContain('DocID=cVK9GDcvrvY%3d');
    const discovered = await discoverSingletonGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2025-26',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(SINGLETON_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(SINGLETON_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverSingletonGpfsDocument(
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
      discoverSingletonGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2024-25',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Singleton Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectSingletonGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectSingletonGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = SINGLETON_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseSingletonGpfsExtraction(
      extraction({ income: withoutUnit }),
      SINGLETON_CONTEXT,
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
    source: { sha256: SINGLETON_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? SINGLETON_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? SINGLETON_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? SINGLETON_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Singleton Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2025-26');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(114_512);
    expect(reconciliation.total_expenses).toBe(97_902);
    expect(reconciliation.employee_expenses).toBe(33_954);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(20_508);
    expect(reconciliation.government_grants_operating).toBe(13_603);
    expect(reconciliation.government_grants_capital).toBe(15_937);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(1_721);
    expect(reconciliation.net_result).toBe(16_610);
    expect(reconciliation.net_result_before_capital_grants).toBe(673);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(77_394);
    expect(reconciliation.face_expense_bridge).toBe(97_902);
    expect(reconciliation.functions_total_income).toBe(114_512);
    expect(reconciliation.functions_total_expenses).toBe(97_902);
    expect(reconciliation.functions_operating_result).toBe(16_610);
    expect(reconciliation.functions_grants_and_contributions).toBe(29_540);
    expect(reconciliation.comprehensive_income_net_result).toBe(16_610);
    expect(reconciliation.comprehensive_other_income).toBe(40_307);
    expect(reconciliation.comprehensive_total).toBe(56_917);
    expect(reconciliation.comprehensive_revaluation).toBe(34_798);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_other_movements).toBe(5_509);
    expect(reconciliation.revenue_components_sum).toBe(114_512);
    expect(reconciliation.expense_components_sum).toBe(77_394);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(11_451_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(9_790_200_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(3_395_400_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_050_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(1_360_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_593_700_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      172_100_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(133_900_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(4_173_900_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(369_600_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(422_900_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_661_000_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
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
        source_id: SINGLETON_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2025-26',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: SINGLETON_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Singleton Council GPFS 2025-26',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: SINGLETON_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Singleton Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^singleton-gpfs:/);
      expect(record.source_url).toContain('DocID=cVK9GDcvrvY%3d');
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
    const broken = SINGLETON_FUNCTIONS_TEXT.replace(
      'Total functions and activities 114,512 113,350 97,902 87,500',
      'Total functions and activities 114,512 113,350 97,904 87,500',
    );
    const parsed = parseSingletonGpfsExtraction(
      extraction({ functions: broken }),
      SINGLETON_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = SINGLETON_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 56,917',
      'Total comprehensive income for the year attributable to Council 56,919',
    );
    const parsed = parseSingletonGpfsExtraction(
      extraction({ comprehensive: broken }),
      SINGLETON_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = SINGLETON_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 41,739',
      'Rates and annual charges B2-1 41,741',
    );
    const parsed = parseSingletonGpfsExtraction(extraction({ income: broken }), SINGLETON_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = SINGLETON_COMPREHENSIVE_TEXT.replace(
      'Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-6 34,798',
      'Gain/(loss) on revaluation of infrastructure, property, plant and equipment C1-6 34,800',
    );
    const parsed = parseSingletonGpfsExtraction(
      extraction({ comprehensive: broken }),
      SINGLETON_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the remediation-provision OCI component is altered', () => {
    const broken = SINGLETON_COMPREHENSIVE_TEXT.replace(
      'Re-measurement of remediation provision C2-5 5,509',
      'Re-measurement of remediation provision C2-5 5,511',
    );
    const parsed = parseSingletonGpfsExtraction(
      extraction({ comprehensive: broken }),
      SINGLETON_CONTEXT,
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
    const url = SINGLETON_CONTEXT.document.url;
    const revenue = singletonGpfsNaturalKey(url, 'total_revenue', '2025-26');
    const expenses = singletonGpfsNaturalKey(url, 'total_expenses', '2025-26');
    expect(revenue).toMatch(/^singleton-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(singletonGpfsNaturalKey(url, 'total_revenue', '2025-26'));
    expect(revenue).not.toBe(singletonGpfsNaturalKey(url, 'total_revenue', '2024-25'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_singletongpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: SINGLETON_GPFS_ID,
    name: SINGLETON_GPFS_NAME,
    publisher: SINGLETON_GPFS_PUBLISHER,
    source_url: SINGLETON_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: SINGLETON_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'singleton-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Singleton Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: SINGLETON_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2025-26',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-singleton',
        project_name: 'Existing AusTender Singleton contract',
        delivery_entity: 'SINGLETON COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-singleton',
        project_name: 'Existing GrantConnect Singleton grant',
        delivery_entity: 'Singleton Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-singleton-school',
        project_name: 'Existing data.nsw Singleton school row (not a council row)',
        delivery_entity: 'Singleton High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-singleton-charity',
        project_name: 'Existing ACNC Singleton charity row (not the council)',
        delivery_entity: 'Singleton Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: SINGLETON_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: SINGLETON_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: SINGLETON_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: SINGLETON_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: SINGLETON_GPFS_ID,
        delivery_entity: { $ne: 'Singleton Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: SINGLETON_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
