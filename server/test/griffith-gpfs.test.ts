import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  GRIFFITH_GPFS_DELIVERY_ENTITY,
  GRIFFITH_GPFS_DOCUMENT_PIN,
  GRIFFITH_GPFS_FISCAL_YEAR,
  GRIFFITH_GPFS_ID,
  GRIFFITH_GPFS_LICENSE,
  GRIFFITH_GPFS_NAME,
  GRIFFITH_GPFS_PUBLISHER,
  GRIFFITH_GPFS_REPORTING_URL,
  GRIFFITH_GPFS_REQUEST_HEADERS,
  griffithPinnedDocument,
  detectGriffithGpfsUnit,
  discoverGriffithGpfsDocument,
  fiscalYearFromGriffithGpfsLink,
  parseGriffithGpfsExtraction,
  parseGriffithGpfsReportLinks,
  selectGriffithGpfsDocument,
  griffithGpfsNaturalKey,
} from '../src/connectors/griffith-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  GRIFFITH_COMPREHENSIVE_TEXT,
  GRIFFITH_CONTEXT,
  GRIFFITH_FUNCTIONS_TEXT,
  GRIFFITH_INCOME_TEXT,
  GRIFFITH_PDF_SHA256,
  GRIFFITH_PDF_URL,
  griffithExtraction,
} from '../src/connectors/griffith-gpfs/fixture.js';

// Griffith City Council's audited FY2024-25 standalone financial statements.
// FY2024-25 is the latest audited year published by the council at 2026-11-19;
// no FY2025-26 GPFS is posted, so FY2024-25 is the accepted current-available
// year and the connector never substitutes a 2025-26 or 2023-24 document. The
// statement source is the standalone audited financial statements (not the
// narrative annual report). The Income Statement prints the Original unaudited
// budget column before the line label, with Actual 2025 and Actual 2024 after
// it. A parser that took the first number in the line would read the budget; the
// expected values are all Actual 2025 (the FY2024-25 reporting year). Griffith
// prints eight revenue lines (including a real net gain on disposal of 131) and
// four expense lines (no net disposal expense). The net result and the printed
// before-capital result are both positive.

function parsedFixture() {
  return parseGriffithGpfsExtraction(griffithExtraction(), GRIFFITH_CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Griffith City Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2024-25.pdf" title="Griffith-City-Council-Financial-Statements-2024-25.pdf" class="document ext-pdf">Griffith-City-Council-Financial-Statements-2024-25.pdf (PDF, 4MB)</a>
    <a href="/files/sharedassets/public/v/1/cm-documents/griffith-city-council-annual-report-2024-25-final-adopted-26-nov-2025.pdf" title="Annual Report 2024/25" class="document ext-pdf">Annual Report 2024/25 (PDF, 32MB)</a>
    <a href="/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2023-24.pdf" title="Griffith-City-Council-Financial-Statements-2023-24.pdf" class="document ext-pdf">Griffith-City-Council-Financial-Statements-2023-24.pdf (PDF, 4MB)</a>
    <a href="https://example.com/griffith-city-council-financial-statements-2024-25.pdf">Griffith-City-Council-Financial-Statements-2024-25.pdf</a>
  `;

  it('discovers the FY2024-25 financial statements and never the annual report or a mirror', () => {
    expect(GRIFFITH_GPFS_FISCAL_YEAR).toBe('2024-25');
    const links = parseGriffithGpfsReportLinks(pageHtml, GRIFFITH_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2024-25', '2023-24']);
    expect(links.map((link) => link.url)).toEqual([
      GRIFFITH_PDF_URL,
      'https://www.griffith.nsw.gov.au/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2023-24.pdf',
    ]);
    const selected = selectGriffithGpfsDocument(links, '2024-25');
    expect(selected.url).toBe(GRIFFITH_PDF_URL);
    expect(selected.fiscal_year).toBe('2024-25');
    expect(selected.listing_url).toBe(GRIFFITH_GPFS_REPORTING_URL);
    expect(
      fiscalYearFromGriffithGpfsLink('Griffith-City-Council-Financial-Statements-2024-25.pdf'),
    ).toBe('2024-25');
    expect(
      fiscalYearFromGriffithGpfsLink(
        'https://www.griffith.nsw.gov.au/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2024-25.pdf',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromGriffithGpfsLink(
        'https://www.griffith.nsw.gov.au/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2023-24.pdf',
      ),
    ).toBe('2023-24');
    expect(fiscalYearFromGriffithGpfsLink('Long Term Financial Plan 2021-2034.pdf')).toBeNull();
  });

  it('rejects a stale prior year and never substitutes 2023-24 for the target 2024-25', () => {
    const priorOnly = `
      <a href="/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2023-24.pdf" title="Griffith-City-Council-Financial-Statements-2023-24.pdf">Griffith-City-Council-Financial-Statements-2023-24.pdf</a>
    `;
    const links = parseGriffithGpfsReportLinks(priorOnly, GRIFFITH_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2023-24']);
    expect(() => selectGriffithGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('does not substitute a 2025-26 link for the FY2024-25 target', () => {
    const futureOnly = `
      <a href="/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2025-26.pdf" title="Griffith-City-Council-Financial-Statements-2025-26.pdf">Griffith-City-Council-Financial-Statements-2025-26.pdf</a>
    `;
    const links = parseGriffithGpfsReportLinks(futureOnly, GRIFFITH_GPFS_REPORTING_URL);
    expect(links.map((link) => link.fiscal_year)).toEqual(['2025-26']);
    expect(() => selectGriffithGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });

  it('uses the documented official pin when the listing yields no current anchor', async () => {
    const links = parseGriffithGpfsReportLinks(
      '<html><body>No document links here</body></html>',
      GRIFFITH_GPFS_REPORTING_URL,
    );
    expect(links).toEqual([]);
    const pinned = griffithPinnedDocument();
    expect(pinned.url).toBe(GRIFFITH_GPFS_DOCUMENT_PIN);
    expect(pinned.fiscal_year).toBe('2024-25');
    expect(pinned.url).toContain('griffith-city-council-financial-statements-2024-25.pdf');
    const discovered = await discoverGriffithGpfsDocument(
      (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
      '2024-25',
      '<html>no links</html>',
    );
    expect(discovered.url).toBe(GRIFFITH_GPFS_DOCUMENT_PIN);
  });

  it('sends a plain client UA so the Akamai WAF does not return 403', async () => {
    expect(GRIFFITH_GPFS_REQUEST_HEADERS['user-agent']).toBe('curl/8.5.0');
    let seenHeaders: Record<string, string> | undefined;
    await discoverGriffithGpfsDocument(
      (async (_input: RequestInfo | URL, init?: RequestInit) => {
        seenHeaders = init?.headers as Record<string, string>;
        return new Response('<html>no links</html>', { status: 200 });
      }) as typeof fetch,
      '2024-25',
    );
    expect(seenHeaders?.['user-agent']).toBe('curl/8.5.0');
    expect(seenHeaders?.['user-agent']).not.toContain('Chrome');
  });

  it('refuses to use the pin for a different year', async () => {
    await expect(
      discoverGriffithGpfsDocument(
        (async () => new Response('<html>no links</html>', { status: 200 })) as typeof fetch,
        '2025-26',
        '<html>no links</html>',
      ),
    ).rejects.toThrow(/No published/);
  });
});

describe('Griffith City Council GPFS unit guard', () => {
  it("reads $'000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectGriffithGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectGriffithGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = GRIFFITH_INCOME_TEXT.split("$ '000").join('');
    const parsed = parseGriffithGpfsExtraction(
      extraction({ income: withoutUnit }),
      GRIFFITH_CONTEXT,
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
    source: { sha256: GRIFFITH_PDF_SHA256, bytes: 1_063_092 },
    pages: [
      pdfPage(overrides.income ?? GRIFFITH_INCOME_TEXT, 4),
      pdfPage(overrides.comprehensive ?? GRIFFITH_COMPREHENSIVE_TEXT, 5),
      pdfPage(overrides.functions ?? GRIFFITH_FUNCTIONS_TEXT, 13),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

describe('Griffith City Council GPFS exact reconciliation', () => {
  it('reads the printed lines and reconciles the face statement, B1-1 and comprehensive income exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    expect(parsed.rejections).toEqual([]);
    expect(parsed.warnings[0]).toMatch(/reconciled exactly/);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.fiscal_year).toBe('2024-25');
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(90_434);
    expect(reconciliation.total_expenses).toBe(72_804);
    expect(reconciliation.employee_expenses).toBe(29_395);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(19_188);
    expect(reconciliation.government_grants_operating).toBe(7_179);
    expect(reconciliation.government_grants_capital).toBe(13_839);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(131);
    expect(reconciliation.net_result).toBe(17_630);
    expect(reconciliation.net_result_before_capital_grants).toBe(3_791);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(53_616);
    expect(reconciliation.face_expense_bridge).toBe(72_804);
    expect(reconciliation.functions_total_income).toBe(90_434);
    expect(reconciliation.functions_total_expenses).toBe(72_804);
    expect(reconciliation.functions_operating_result).toBe(17_630);
    expect(reconciliation.functions_grants_and_contributions).toBe(21_018);
    expect(reconciliation.comprehensive_income_net_result).toBe(17_630);
    expect(reconciliation.comprehensive_other_income).toBe(906);
    expect(reconciliation.comprehensive_total).toBe(18_536);
    expect(reconciliation.comprehensive_revaluation).toBe(-22);
    expect(reconciliation.comprehensive_impairment).toBeNull();
    expect(reconciliation.comprehensive_intangible_revaluation).toBe(928);
    expect(reconciliation.revenue_components_sum).toBe(90_434);
    expect(reconciliation.expense_components_sum).toBe(53_616);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(9_043_400_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(7_280_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(2_939_500_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      1_918_800_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(717_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_383_900_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      13_100_000,
    );
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(97_200_000);
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(4_065_800_000);
    expect(recordByLine(records, 'other_revenues').amount_cents).toBe(170_400_000);
    expect(recordByLine(records, 'other_income').amount_cents).toBe(56_500_000);
    const netResult = recordByLine(records, 'net_result');
    expect(netResult.amount_cents).toBe(1_763_000_000);
    expect(netResult.gpfs_printed_sign).toBeUndefined();
    expect(
      records.some((record) => record.gpfs_line_item === 'net_loss_from_disposal_of_assets'),
    ).toBe(false);
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('maps provenance and keeps every row non-additive with no region/LGA allocation', () => {
    const { records } = parsedFixture();
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: GRIFFITH_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: GRIFFITH_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Griffith City Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: GRIFFITH_CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Griffith City Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.gpfs_line_item).toBeTruthy();
      expect(record.gpfs_line_label).toBeTruthy();
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^griffith-gpfs:/);
      expect(record.source_url).toContain('griffith-city-council-financial-statements-2024-25.pdf');
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
    const broken = GRIFFITH_FUNCTIONS_TEXT.replace(
      'Total functions and activities 90,434 97,800 72,804 78,075',
      'Total functions and activities 90,434 97,800 72,806 78,075',
    );
    const parsed = parseGriffithGpfsExtraction(
      extraction({ functions: broken }),
      GRIFFITH_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income total disagrees', () => {
    const broken = GRIFFITH_COMPREHENSIVE_TEXT.replace(
      'Total comprehensive income for the year attributable to Council 18,536',
      'Total comprehensive income for the year attributable to Council 18,538',
    );
    const parsed = parseGriffithGpfsExtraction(
      extraction({ comprehensive: broken }),
      GRIFFITH_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = GRIFFITH_INCOME_TEXT.replace(
      'Rates and annual charges B2-1 40,658',
      'Rates and annual charges B2-1 40,660',
    );
    const parsed = parseGriffithGpfsExtraction(extraction({ income: broken }), GRIFFITH_CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the revaluation other comprehensive income is altered', () => {
    const broken = GRIFFITH_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 (22)',
      'Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-6 (24)',
    );
    const parsed = parseGriffithGpfsExtraction(
      extraction({ comprehensive: broken }),
      GRIFFITH_CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the intangible revaluation other comprehensive income is altered', () => {
    const broken = GRIFFITH_COMPREHENSIVE_TEXT.replace(
      'Gain (loss) on revaluation of intangible assets C1-7 928',
      'Gain (loss) on revaluation of intangible assets C1-7 930',
    );
    const parsed = parseGriffithGpfsExtraction(
      extraction({ comprehensive: broken }),
      GRIFFITH_CONTEXT,
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
    const url = GRIFFITH_CONTEXT.document.url;
    const revenue = griffithGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = griffithGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^griffith-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(griffithGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(griffithGpfsNaturalKey(url, 'total_revenue', '2023-24'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_griffithgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: GRIFFITH_GPFS_ID,
    name: GRIFFITH_GPFS_NAME,
    publisher: GRIFFITH_GPFS_PUBLISHER,
    source_url: GRIFFITH_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: GRIFFITH_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'griffith-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Griffith City Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: GRIFFITH_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 12_345_000,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'prod-existing-aus-tender-griffith',
        project_name: 'Existing AusTender Griffith contract',
        delivery_entity: 'GRIFFITH CITY COUNCIL',
      },
      {
        amount_cents: 502_773_441,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect:GA-existing-griffith',
        project_name: 'Existing GrantConnect Griffith grant',
        delivery_entity: 'Griffith City Council',
      },
      {
        amount_cents: 123_456,
        measure_type: 'budget',
        fiscal_year: '2024-25',
        source_id: 'data-nsw-ckan',
        source_url: 'https://data.nsw.gov.au/example',
        verified: false,
        natural_key: 'data-nsw-existing-griffith-school',
        project_name: 'Existing data.nsw Griffith school row (not a council row)',
        delivery_entity: 'Griffith High School',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-griffith-charity',
        project_name: 'Existing ACNC Griffith charity row (not the council)',
        delivery_entity: 'Griffith Community Centre Inc',
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
    expect(await MeasureModel.countDocuments({ source_id: GRIFFITH_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: GRIFFITH_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    expect(
      await MeasureModel.countDocuments({
        source_id: GRIFFITH_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GRIFFITH_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GRIFFITH_GPFS_ID,
        delivery_entity: { $ne: 'Griffith City Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: GRIFFITH_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
