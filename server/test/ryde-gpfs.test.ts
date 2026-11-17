import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  RYDE_GPFS_DELIVERY_ENTITY,
  RYDE_GPFS_FISCAL_YEAR,
  RYDE_GPFS_ID,
  RYDE_GPFS_LICENSE,
  RYDE_GPFS_NAME,
  RYDE_GPFS_PUBLISHER,
  RYDE_GPFS_REPORTING_URL,
  detectRydeGpfsUnit,
  discoverRydeGpfsDocument,
  fiscalYearFromRydeGpfsLink,
  rydeGpfsNaturalKey,
  parseRydeGpfsExtraction,
  parseRydeGpfsReportPage,
  type RydeGpfsParseContext,
} from '../src/connectors/ryde-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  COMPREHENSIVE_TEXT,
  DEPRECIATION_TEXT,
  FUNCTIONS_TEXT,
  INCOME_TEXT,
} from './ryde-gpfs.fixture.js';

// The Income Statement prints the Original unaudited budget column before each
// line label, so each emitted value is the second amount after the label (the
// FY2024-25 actual); the first is budget and the third is FY2023-24. The expense
// subtotal contains the phrase "depreciation, amortisation and impairment of
// non-financial assets", so the actual depreciation line is read from the last
// occurrence. Total expenses is the printed face-statement bridge: printed
// expenses excluding depreciation plus printed depreciation. The printed B1-1
// expense total ($178,792 thousand) is $15 thousand below that bridge and its
// operating result is $15 thousand above the face statement; the discrepancy is
// recorded as reconciliation evidence and the face statement is authoritative.

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: '4a70b2a68b47142b79679a4ea4763849d7c07fc76b90a19c7bbc48e635a4bdb5',
      bytes: 12_685_077,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 6),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 7),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 15),
      textPage(DEPRECIATION_TEXT, 27),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.ryde.nsw.gov.au/files/assets/public/v/2/publications/corporate-services/financial-reports/financial-report-2025.pdf';

const CONTEXT: RydeGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statements - Year ended 30 June 2025',
    url: PDF_URL,
    fiscal_year: RYDE_GPFS_FISCAL_YEAR,
    listing_url: RYDE_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/ryde-gpfs/council-of-the-city-of-ryde-financial-statements-2024-25.pdf',
    sha256: '4a70b2a68b47142b79679a4ea4763849d7c07fc76b90a19c7bbc48e635a4bdb5',
    bytes: 12_685_077,
    fetched_at: '2026-11-18T04:40:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: RYDE_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseRydeGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('Ryde GPFS source discovery', () => {
  it('discovers the FY2024-25 audited statements from the official page, not a hard-coded PDF URL', () => {
    const indexHtml = `
      <p><strong>Financial Statements (General and Special Purpose):</strong></p>
      <ul>
        <li><a href="/files/assets/public/v/1/publications/corporate-services/financial-reports/financial-report-2024.pdf" target="_blank" title="Financial-Report-2024.pdf" class="document ext-pdf">Year ended 30 June 2024<span class="file-info">(PDF,&nbsp;10MB)</span></a></li>
        <li><a href="/files/assets/public/v/2/publications/corporate-services/financial-reports/financial-report-2025.pdf" target="_blank" title="Finacial-Report-2025.pdf" class="document ext-pdf">Year ended 30 June 2025<span class="file-info">(PDF,&nbsp;12MB)</span></a></li>
        <li><a href="/files/assets/public/v/2/publications/corporate-services/annual-reports/annual-report-2024-25.pdf">Annual Report 2024-25</a></li>
      </ul>
    `;
    expect(parseRydeGpfsReportPage(indexHtml, RYDE_GPFS_REPORTING_URL, '2024-25')).toEqual({
      pdfUrl: PDF_URL,
      title: 'Financial Statements - Year ended 30 June 2025',
    });
    expect(fiscalYearFromRydeGpfsLink('Year ended 30 June 2025')).toBe('2024-25');
    expect(fiscalYearFromRydeGpfsLink('Financial Statements - 2024-25')).toBe('2024-25');
    expect(fiscalYearFromRydeGpfsLink('Financial Statements - 2025/26')).toBe('2025-26');
    expect(fiscalYearFromRydeGpfsLink('Annual Report 2024 to 2025')).toBe('2024-25');
  });

  it('resolves the PDF through the official reporting page', async () => {
    const discovered = await discoverRydeGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: `<a href="/files/assets/public/v/2/publications/corporate-services/financial-reports/financial-report-2025.pdf" title="Finacial-Report-2025.pdf">Year ended 30 June 2025</a>`,
    });
    expect(discovered.title).toBe('Financial Statements - Year ended 30 June 2025');
    expect(discovered.url).toBe(PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(RYDE_GPFS_REPORTING_URL);
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    expect(
      parseRydeGpfsReportPage(
        '<a href="/files/.../financial-report-2024.pdf">Year ended 30 June 2024</a>',
        RYDE_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseRydeGpfsReportPage(
        '<a href="https://example.com/financial-report-2025.pdf">Year ended 30 June 2025</a>',
        RYDE_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Ryde GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectRydeGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectRydeGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseRydeGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Ryde GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(215_461);
    expect(reconciliation.total_expenses).toBe(178_807);
    expect(reconciliation.employee_expenses).toBe(65_215);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(30_119);
    expect(reconciliation.government_grants_operating).toBe(5_133);
    expect(reconciliation.government_grants_capital).toBe(42_063);
    expect(reconciliation.net_loss_from_disposal_of_assets).toBe(17_882);
    expect(reconciliation.net_result).toBe(36_654);
    expect(reconciliation.operating_result).toBe(36_654);
    expect(reconciliation.net_result_before_capital_grants).toBe(-5_409);
    // The repeated depreciation phrase must read the actual line (30,119), never
    // the expense subtotal (148,688) or the excluding-depreciation result.
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(148_688);
    expect(reconciliation.revenue_components_sum).toBe(215_461);
    expect(reconciliation.expense_components_sum).toBe(148_688);
    expect(reconciliation.face_expense_bridge).toBe(178_807);
    expect(reconciliation.functions_total_income).toBe(215_461);
    expect(reconciliation.functions_total_expenses).toBe(178_792);
    expect(reconciliation.functions_operating_result).toBe(36_669);
    expect(reconciliation.functions_grants_and_contributions).toBe(47_196);
    // Printed function-allocation discrepancy kept as evidence, not smoothed.
    expect(reconciliation.functions_expense_difference).toBe(15);
    expect(reconciliation.functions_operating_result_difference).toBe(15);
    expect(reconciliation.comprehensive_income_net_result).toBe(36_654);
    expect(reconciliation.depreciation_note_total).toBe(30_119);
    expect(reconciliation.income_statement_page).toBe(6);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.comprehensive_income_page).toBe(7);
    expect(reconciliation.depreciation_note_page).toBe(27);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(21_546_100_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(17_880_700_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(6_521_500_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      3_011_900_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(513_300_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(4_206_300_000);
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').amount_cents).toBe(
      1_788_200_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(3_665_400_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      14_868_800_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(11_584_200_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
    // The printed B1-1/face $15 thousand function-allocation discrepancy is a
    // human review gate on the two authoritative totals, not a silent note.
    expect(recordByLine(records, 'total_expenses').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'net_result').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'total_expenses').notes).toMatch(
      /\$15 thousand.*function-allocation discrepancy/,
    );
    expect(recordByLine(records, 'net_result').notes).toMatch(
      /\$15 thousand.*function-allocation discrepancy/,
    );
    expect(recordByLine(records, 'employee_expenses').notes).not.toContain('human_spot_check');
    // The printed before-capital deficit is evidence only and is not a row.
    expect(
      records.some((record) => record.gpfs_line_item === 'net_result_before_capital_grants'),
    ).toBe(false);
  });

  it('emits only printed categories: components point at their printed subtotal and there is no region/LGA allocation', () => {
    const { records } = parsedFixture();
    const keys = records.map((record) => record.gpfs_line_item).sort();
    expect(keys).toEqual(
      [
        'borrowing_costs',
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
        source_id: RYDE_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: RYDE_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Council of the City of Ryde GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Council of the City of Ryde');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^ryde-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_loss_from_disposal_of_assets').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    // Every row is non-additive agency detail; summing the printed rows is never the total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the B1-1 row no longer reconciles internally', () => {
    const broken = FUNCTIONS_TEXT.replace(
      '215,461 215,784 178,792 156,391 36,669 59,393',
      '215,461 215,784 178,702 156,391 36,669 59,393',
    );
    const parsed = parseRydeGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('115,842 110,190', '115,742 110,190');
    const parsed = parseRydeGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 36,654',
      'from Income Statement 36,000',
    );
    const parsed = parseRydeGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
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
    const revenue = rydeGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = rydeGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^ryde-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(rydeGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(rydeGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_rydegpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: RYDE_GPFS_ID,
    name: RYDE_GPFS_NAME,
    publisher: RYDE_GPFS_PUBLISHER,
    source_url: RYDE_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: RYDE_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'ryde-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Ryde GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: RYDE_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 42_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-Council-of-the-City-of-Ryde-existing-1',
        project_name:
          'Existing GrantConnect grant under the exact string Council of the City of Ryde',
        delivery_entity: 'Council of the City of Ryde',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-CITY-OF-RYDE-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase CITY OF RYDE COUNCIL',
        delivery_entity: 'CITY OF RYDE COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-ryde-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Ryde Community Aid Association',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'randwick-gpfs',
        source_url: 'https://www.randwick.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-randwick-gpfs-1',
        project_name: 'Existing Randwick City Council GPFS row',
        delivery_entity: 'Randwick City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-ryde-project',
        project_name: 'Existing NSW Budget project whose name mentions Ryde',
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
    expect(await MeasureModel.countDocuments({ source_id: 'randwick-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: RYDE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'acnc-charity', 'nsw-budget'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 128_500, 999_000, 42_000_000,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: RYDE_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The pre-existing GrantConnect row keeps the exact string and the AusTender
    // row the uppercase form. Both are preserved untouched and never summed
    // with the 17 GPFS rows (which also carry that published entity name but a
    // different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Council of the City of Ryde',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'CITY OF RYDE COUNCIL',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: 'Council of the City of Ryde' }),
    ).toBe(18);
    expect(
      await MeasureModel.countDocuments({ delivery_entity: /^council of the city of ryde$/i }),
    ).toBe(18);

    expect(
      await MeasureModel.countDocuments({
        source_id: RYDE_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: RYDE_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: RYDE_GPFS_ID,
        delivery_entity: { $ne: 'Council of the City of Ryde' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: RYDE_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
