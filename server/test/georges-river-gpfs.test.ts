import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  GEORGES_RIVER_GPFS_DELIVERY_ENTITY,
  GEORGES_RIVER_GPFS_FISCAL_YEAR,
  GEORGES_RIVER_GPFS_ID,
  GEORGES_RIVER_GPFS_LICENSE,
  GEORGES_RIVER_GPFS_NAME,
  GEORGES_RIVER_GPFS_PUBLISHER,
  GEORGES_RIVER_GPFS_REPORTING_URL,
  detectGeorgesRiverGpfsUnit,
  discoverGeorgesRiverGpfsDocument,
  fiscalYearFromGeorgesRiverGpfsLink,
  georgesRiverGpfsNaturalKey,
  parseGeorgesRiverGpfsExtraction,
  parseGeorgesRiverGpfsReportPage,
  type GeorgesRiverGpfsParseContext,
} from '../src/connectors/georges-river-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  CONDUCT_REPORT_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './georges-river-gpfs.fixture.js';

// Georges River publishes a standalone Audited Financial Statement and Auditors
// Report PDF. The Income Statement prints the Original unaudited budget amount
// before each line label in the PDF text stream, so each emitted value is the
// first amount after the label (the FY2024-25 actual). The expense subtotal
// contains the phrase "depreciation, amortisation and impairment of non-financial
// assets", so the actual depreciation line is read from the last occurrence. The
// printed borrowing-costs line is nil and not emitted. Total expenses is the
// printed B1-1 total, which equals the printed face bridge exactly; the
// auditor's conduct-report narrative prints a different rounded figure and is
// flagged for a human spot check.

function textPage(text: string, pageNumber: number, items: PdfPage['items'] = []): PdfPage {
  return { page_number: pageNumber, text, items };
}

function extraction(
  overrides: {
    income?: string;
    functions?: string;
    comprehensive?: string;
    depreciation?: string;
    conductReport?: string;
  } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '97a46898f9fe5a0e2e8ea6e15817562217cfa6568bbdf7825f8d72a4da856a9f',
      bytes: 2_589_670,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 5),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 6),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 14),
      textPage(overrides.depreciation ?? DEPRECIATION_TEXT, 26),
      textPage(overrides.conductReport ?? CONDUCT_REPORT_TEXT, 77),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.georgesriver.nsw.gov.au/StGeorge/media/Documents/Council/Publications/Audited-Financial-Statements-and-Auditors-Report-2024-2025.PDF';

const CONTEXT: GeorgesRiverGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025',
    url: PDF_URL,
    fiscal_year: GEORGES_RIVER_GPFS_FISCAL_YEAR,
    listing_url: GEORGES_RIVER_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/georges-river-gpfs/georges-river-council-audited-financial-statements-2024-25.pdf',
    sha256: '97a46898f9fe5a0e2e8ea6e15817562217cfa6568bbdf7825f8d72a4da856a9f',
    bytes: 2_589_670,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: GEORGES_RIVER_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseGeorgesRiverGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Georges River Council GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official Other Corporate Documents page, not a hard-coded PDF URL', () => {
    const pageHtml = `
      <a href="/StGeorge/media/Documents/Council/Publications/Audited-Financial-Statements-and-Auditors-Report-2023-2024.PDF">Audited Financial Statement and Auditors Report for 1 July 2023 - 30 June 2024</a>
      <a href="/StGeorge/media/Documents/Council/Publications/Georges-River-Council-Annual-Report-2024-2025.pdf" title="Georges River Council Annual Report 2024-2025">Georges River Council Annual Report 2024-2025</a>
      <a href="/StGeorge/media/Documents/Council/Publications/Audited-Financial-Statements-and-Auditors-Report-2024-2025.PDF" title="Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025">Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025</a>
    `;
    expect(
      parseGeorgesRiverGpfsReportPage(pageHtml, GEORGES_RIVER_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: PDF_URL,
      title: 'Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025',
    });
    expect(
      fiscalYearFromGeorgesRiverGpfsLink(
        'Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025',
      ),
    ).toBe('2024-25');
    expect(
      fiscalYearFromGeorgesRiverGpfsLink(
        'Audited Financial Statement and Auditors Report for 1 July 2023 - 30 June 2024',
      ),
    ).toBe('2023-24');
    expect(fiscalYearFromGeorgesRiverGpfsLink('Annual Financial Statements 2025/26')).toBe(
      '2025-26',
    );
    expect(fiscalYearFromGeorgesRiverGpfsLink('Annual Financial Statements 2024 to 2025')).toBe(
      '2024-25',
    );
    expect(fiscalYearFromGeorgesRiverGpfsLink('Financial statements year ended 30 June 2025')).toBe(
      '2024-25',
    );
  });

  it('resolves the PDF through the official listing', async () => {
    const discovered = await discoverGeorgesRiverGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="${PDF_URL}">Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025</a>`,
    });
    expect(discovered.title).toBe(
      'Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025',
    );
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(GEORGES_RIVER_GPFS_REPORTING_URL);
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseGeorgesRiverGpfsReportPage(
        '<a href="/StGeorge/media/Documents/Council/Publications/Audited-Financial-Statements-and-Auditors-Report-2023-2024.PDF">Audited Financial Statement and Auditors Report for 1 July 2023 - 30 June 2024</a>',
        GEORGES_RIVER_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseGeorgesRiverGpfsReportPage(
        '<a href="https://example.com/Audited-Financial-Statements-and-Auditors-Report-2024-2025.PDF">Audited Financial Statement and Auditors Report for 1 July 2024 - 30 June 2025</a>',
        GEORGES_RIVER_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Georges River Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectGeorgesRiverGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectGeorgesRiverGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseGeorgesRiverGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Georges River Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and note B3-3 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(16);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(204_366);
    expect(reconciliation.total_expenses).toBe(185_429);
    expect(reconciliation.employee_expenses).toBe(70_638);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(30_773);
    expect(reconciliation.government_grants_operating).toBe(7_653);
    expect(reconciliation.government_grants_capital).toBe(13_482);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(2_141);
    expect(reconciliation.net_result).toBe(18_937);
    expect(reconciliation.operating_result).toBe(18_937);
    expect(reconciliation.net_result_before_capital_grants).toBe(5_455);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(154_656);
    expect(reconciliation.revenue_components_sum).toBe(204_366);
    expect(reconciliation.expense_components_sum).toBe(154_656);
    expect(reconciliation.face_expense_bridge).toBe(185_429);
    expect(reconciliation.functions_total_income).toBe(204_366);
    expect(reconciliation.functions_total_expenses).toBe(185_429);
    expect(reconciliation.functions_operating_result).toBe(18_937);
    expect(reconciliation.functions_grants_and_contributions).toBe(21_135);
    expect(reconciliation.comprehensive_income_net_result).toBe(18_937);
    expect(reconciliation.comprehensive_income_other).toBe(60_495);
    expect(reconciliation.comprehensive_income_total).toBe(79_432);
    expect(reconciliation.depreciation_impairment_note_total).toBe(30_773);
    expect(reconciliation.income_statement_page).toBe(5);
    expect(reconciliation.functions_page).toBe(14);
    expect(reconciliation.comprehensive_income_page).toBe(6);
    expect(reconciliation.depreciation_note_page).toBe(26);
    expect(reconciliation.conduct_report).toEqual({
      page_number: 77,
      total_expenses_millions: 185.5,
    });
    expect(reconciliation.conduct_report_total_expenses_discrepancy_thousands).toBe(71);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(20_436_600_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(18_542_900_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(7_063_800_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_077_300_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(765_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_348_200_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      214_100_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(1_893_700_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      15_465_600_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(12_911_600_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    // The printed before-capital surplus is evidence only and is not a row.
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
    // The printed borrowing-costs line is nil and is not emitted.
    expect(records.some((record) => record.gpfs_line_item === 'borrowing_costs')).toBe(false);
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'depreciation_amortisation_impairment',
        'employee_expenses',
        'government_grants_capital',
        'government_grants_operating',
        'interest_and_investment_income',
        'materials_and_services',
        'net_loss_from_disposal_of_assets',
        'net_result',
        'other_expenses',
        'other_income',
        'other_revenues',
        'rates_and_annual_charges',
        'total_expenses',
        'total_expenses_excluding_depreciation',
        'total_revenue',
        'user_charges_and_fees',
      ].sort(),
    );
    for (const record of records) {
      expect(record).toMatchObject({
        source_id: GEORGES_RIVER_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: GEORGES_RIVER_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Georges River Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Georges River Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^georges-river-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'total_expenses').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'net_result').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'total_expenses').notes).toContain('185.5');
    expect(recordByLine(records, 'employee_expenses').notes).not.toContain('human_spot_check');
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('does not flag a human spot check when the auditor narrative agrees with the GPFS total', () => {
    const agreeingConductReport = CONDUCT_REPORT_TEXT.replace('$185.5 million', '$185.429 million');
    const parsed = parseGeorgesRiverGpfsExtraction(
      extraction({ conductReport: agreeingConductReport }),
      CONTEXT,
    );
    expect(parsed.records).toHaveLength(16);
    expect(parsed.reconciliation!.conduct_report_total_expenses_discrepancy_thousands).toBeNull();
    expect(recordByLine(parsed.records, 'total_expenses').notes).not.toContain(
      'human_spot_check: required',
    );
    expect(recordByLine(parsed.records, 'net_result').notes).not.toContain(
      'human_spot_check: required',
    );
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const broken = FUNCTIONS_TEXT.replace(
      'Total functions and activities 204,366 194,920 185,429',
      'Total functions and activities 204,366 194,920 185,529',
    );
    const parsed = parseGeorgesRiverGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('129,116 116,884', '129,216 116,884');
    const parsed = parseGeorgesRiverGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 18,937',
      'from Income Statement 18,900',
    );
    const parsed = parseGeorgesRiverGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-3 depreciation no longer bridges', () => {
    const broken = DEPRECIATION_TEXT.replace(
      'Total depreciation, amortisation and impairment for non-financial assets 30,773',
      'Total depreciation, amortisation and impairment for non-financial assets 30,673',
    );
    const parsed = parseGeorgesRiverGpfsExtraction(extraction({ depreciation: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('is deterministic and derives stable, line-specific natural keys', () => {
    const first = parsedFixture();
    const second = parsedFixture();
    expect(first.records.map((record) => record.natural_key)).toEqual(
      second.records.map((record) => record.natural_key),
    );
    expect(first.records.map((record) => record.amount_cents)).toEqual(
      second.records.map((record) => record.amount_cents),
    );
    const url = CONTEXT.document.url;
    const revenue = georgesRiverGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = georgesRiverGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^georges-river-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(georgesRiverGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(georgesRiverGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_georgesrivergpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: GEORGES_RIVER_GPFS_ID,
    name: GEORGES_RIVER_GPFS_NAME,
    publisher: GEORGES_RIVER_GPFS_PUBLISHER,
    source_url: GEORGES_RIVER_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: GEORGES_RIVER_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'georges-river-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Georges River Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: GEORGES_RIVER_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-georges-river-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Georges River Council',
        delivery_entity: 'Georges River Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-GEORGES-RIVER-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase GEORGES RIVER COUNCIL',
        delivery_entity: 'GEORGES RIVER COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-georges-river-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Georges River Community Radio Incorporated',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'cumberland-gpfs',
        source_url: 'https://www.cumberland.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-cumberland-gpfs-1',
        project_name: 'Existing Cumberland City Council GPFS row',
        delivery_entity: 'Cumberland City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-georges-river-project',
        project_name: 'Existing NSW Budget project whose name mentions Georges River',
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
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'cumberland-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: GEORGES_RIVER_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: GEORGES_RIVER_GPFS_ID })).toBe(16);
    expect(await MeasureModel.countDocuments({})).toBe(21);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Georges River Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'GEORGES RIVER COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Georges River Council' })).toBe(
      17,
    );
    expect(await MeasureModel.countDocuments({ delivery_entity: /^georges river council$/i })).toBe(
      18,
    );

    expect(
      await MeasureModel.countDocuments({
        source_id: GEORGES_RIVER_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GEORGES_RIVER_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: GEORGES_RIVER_GPFS_ID,
        delivery_entity: { $ne: 'Georges River Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: GEORGES_RIVER_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(16);
  });
});
