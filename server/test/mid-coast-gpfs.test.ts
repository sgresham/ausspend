import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  MID_COAST_GPFS_DELIVERY_ENTITY,
  MID_COAST_GPFS_FISCAL_YEAR,
  MID_COAST_GPFS_ID,
  MID_COAST_GPFS_LICENSE,
  MID_COAST_GPFS_NAME,
  MID_COAST_GPFS_PUBLISHER,
  MID_COAST_GPFS_REPORTING_URL,
  detectMidCoastGpfsUnit,
  fiscalYearFromMidCoastGpfsLink,
  midCoastGpfsNaturalKey,
  parseMidCoastGpfsExtraction,
  parseMidCoastGpfsReportLinks,
  selectMidCoastGpfsDocument,
  type MidCoastGpfsParseContext,
} from '../src/connectors/mid-coast-gpfs/index.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';

// Exact text extracted from the archived FY2024-25 General Purpose Financial
// Statements (Income Statement PDF page 6, printed page 4). The Original
// unaudited budget column precedes each line label, so each value read is the
// first amount after the label (the FY2024-25 actual). The Income Statement does
// not print a combined total-expenses line; total expenses is the printed B1-1
// "Total functions and activities" total, which equals the printed
// expenses-excluding-depreciation line plus the printed depreciation line.
const INCOME_TEXT = `MidCoast Council | Income Statement | for the year ended 30 June 2025 §Statement§ Original unaudited budget Actual Actual 2025 $ '000 Notes 2025 2024 Income from continuing operations 181,335 Rates and annual charges B2-1 184,721 175,073 59,042 User charges and fees B2-2 54,668 59,688 3,912 Other revenues B2-3 5,130 5,473 34,337 Grants and contributions provided for operating purposes B2-4 32,764 48,904 48,197 Grants and contributions provided for capital purposes B2-4 70,923 85,790 11,688 Interest and investment income B2-5 18,518 15,202 2,730 Other income B2-6 7,428 11,375 341,241 Total income from continuing operations 374,152 401,505 Expenses from continuing operations 96,141 Employee benefits and on-costs B3-1 96,581 93,390 95,260 Materials and services B3-2 100,060 91,847 8,413 Borrowing costs B3-3 9,625 9,879 12,709 Other expenses B3-5 13,415 19,254 – Net loss from the disposal of assets B4-1 20,723 20,737 212,523 Total expenses from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 240,404 235,107 128,718 Operating result from continuing operations excluding depreciation, amortisation and impairment of non-financial assets 133,748 166,398 90,556 Depreciation, amortisation and impairment of non-financial assets B3-4 94,690 94,015 38,162 Operating result from continuing operations 39,058 72,383 38,162 Net operating result for the year attributable to Council 39,058 72,383 (10,035) Net operating result for the year before grants and contributions provided for capital purposes (31,865) (13,407) The above Income Statement should be read in conjunction with the accompanying notes. MidCoast Council Income Statement for the year ended 30 June 2025 Page 4 of 92`;

const COMPREHENSIVE_TEXT = `MidCoast Council | Statement of Comprehensive Income | for the year ended 30 June 2025 §Note/Subtotal§ $ '000 Notes 2025 2024 Net operating result for the year - from Income Statement 39,058 72,383 §Subnote§ Other comprehensive income: Amounts which will not be reclassified subsequent to operating result Gain (loss) on revaluation of infrastructure, property, plant and equipment C1-7 102,270 197,382 Total items which will not be reclassified subsequent to operating result 102,270 197,382 Total other comprehensive income for the year 102,270 197,382 Total comprehensive income for the year attributable to Council 141,328 269,765 The above Statement of Comprehensive Income should be read in conjunction with the accompanying notes. MidCoast Council Statement of Comprehensive Income for the year ended 30 June 2025 Page 5 of 92`;

const FUNCTIONS_TEXT = `§Note/Subtotal§ §TocItem§ §TocItem§ §Subnote§ Income, expenses and assets have been directly attributed to the following functions or activities. Details of those functions or activities are provided in Note B1-2. Income Expenses Operating result Grants and contributions Carrying amount of assets $ '000 2025 2024 2025 2024 2025 2024 2025 2024 2025 2024 Functions or activities Our Wellbeing 22,666 24,323 36,707 36,053 (14,041) (11,730) 5,477 7,115 286,923 280,646 Our Natural Environment 9,002 9,660 15,207 14,936 (6,205) (5,276) 2,506 3,256 27,527 26,925 Our Places & Infrastructure 206,361 221,447 228,342 224,272 (21,981) (2,825) 76,396 99,241 4,499,155 4,400,721 Our Economic Prosperity 4,477 4,804 7,764 7,626 (3,287) (2,822) 1,527 1,984 65,796 64,356 Our Leadership 131,646 141,271 47,074 46,235 84,572 95,036 17,781 23,098 213,574 208,902 Total functions and activities 374,152 401,505 335,094 329,122 39,058 72,383 103,687 134,694 5,092,975 4,981,550 B Financial Performance B1 Functions or activities B1-1 Functions or activities – income, expenses and assets Page 13 of 92 MidCoast Council | Notes to the Financial Statements 30 June 2025`;

const DEPRECIATION_TEXT = `§Note/Subtotal§ $ '000 Notes 2025 2024 Depreciation and amortisation Plant and equipment 5,187 5,408 Office equipment 14 16 Furniture and fittings 282 211 Computer equipment 1,008 1,281 Land improvements (depreciable) 384 369 Infrastructure: C1-7 – Buildings 11,867 12,168 – Other structures 1,278 888 – Roads 32,641 30,242 – Bridges 2,377 2,234 – Footpaths 664 594 – Stormwater drainage 5,605 5,252 – Water supply network 16,649 15,485 – Sewerage network 11,529 10,849 – Swimming pools 290 270 – Other open space/recreational assets 2,697 2,485 Right of use assets C2-1 706 706 Other assets: – Library books 378 354 – Cemetery assets 27 27 Reinstatement, rehabilitation and restoration assets: – Tip assets C3-5,C1-7 1,107 1,154 Total depreciation and amortisation costs 94,690 89,993 Impairment / revaluation decrement of IPPE and other non-financial assets Non-current assets held for sale C1-6 – 4,022 Total IPPE and other non-financial assets impairment / revaluation decrement costs charged to Income Statement – 4,022 Total depreciation, amortisation and impairment for non-financial assets 94,690 94,015 Material accounting policy information Depreciation and amortisation Depreciation and amortisation are calculated using the straight line method to allocate their cost, net of their residual values, over their estimated useful lives. Council assets held at fair value that are not held primarily for their ability to generate net cash flow, and that are deemed to be specialised, are not assessed for impairment since these assets are assessed on an annual basis to ensure that the carrying amount is not materially different from fair value and therefore, an impairment loss would be captured during this assessment. Impairment of non-financial assets Other non-financial assets that do not meet the criteria above are tested for impairment whenever events or changes in circumstances indicate that the carrying amount may not be recoverable. An impairment loss is recognised for the amount by which the asset’s carrying amount exceeds its recoverable amount. The recoverable amount is the higher of an asset’s fair value less costs to sell and value in use For the purposes of assessing impairment, assets are grouped at the lowest levels for which there are separately identifiable cash inflows that are largely independent of the cash inflows from other assets or groups of assets (cash-generating units). Impairment losses for revalued assets are firstly offset against the amount in the revaluation surplus for the class of asset, with only the excess to be recognised in the Income Statement. B3-4 Depreciation, amortisation and impairment of non-financial assets Page 24 of 92 MidCoast Council | Notes to the Financial Statements 30 June 2025`;

function textPage(text: string, pageNumber: number): PdfPage {
  return { page_number: pageNumber, text, items: [] };
}

function extraction(
  overrides: { income?: string; functions?: string; comprehensive?: string } = {},
): PdfExtraction {
  return {
    source: {
      sha256: 'f8f7ede3d8c09467e5f1aea72e697a9278d4d78fd527778c63ccb0d9e3a5e3fe',
      bytes: 2_972_797,
    },
    pages: [
      textPage(overrides.income ?? INCOME_TEXT, 6),
      textPage(overrides.comprehensive ?? COMPREHENSIVE_TEXT, 7),
      textPage(overrides.functions ?? FUNCTIONS_TEXT, 15),
      textPage(DEPRECIATION_TEXT, 26),
    ],
    text: '',
    tables: [],
    warnings: [],
  };
}

const PDF_URL =
  'https://www.midcoast.nsw.gov.au/files/assets/public/v/1/document-resources/council/plans-amp-publications/operational-plans-amp-fees-amp-charges/financial-statements/financial-statements-2024-2025.pdf';

const CONTEXT: MidCoastGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Financial Statement 2024-2025 (PDF, 3MB)',
    url: PDF_URL,
    fiscal_year: MID_COAST_GPFS_FISCAL_YEAR,
    listing_url: MID_COAST_GPFS_REPORTING_URL,
  },
  archive: {
    local_path: '/tmp/ausspend-source-archive/mid-coast-gpfs/financial-statements-2024-2025.pdf',
    sha256: 'f8f7ede3d8c09467e5f1aea72e697a9278d4d78fd527778c63ccb0d9e3a5e3fe',
    bytes: 2_972_797,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: MID_COAST_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseMidCoastGpfsExtraction(extraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

describe('MidCoast GPFS source discovery', () => {
  it('discovers the FY2024-25 audited financial statements from the official page, not a hard-coded URL', () => {
    const indexHtml = `
      <a href="/Your-Council/About-MidCoast-Council/Plans-strategies-and-policies/Reporting-our-progress">Reporting our progress</a>
      <a href="https://online.flippingbook.com/view/216918777/">Annual Report 2024-25</a>
      <a href="/files/assets/public/v/1/document-resources/council/plans-amp-publications/operational-plans-amp-fees-amp-charges/financial-statements/financial-statements-2024-2025.pdf" title="financial-statements-2024-2025.pdf">Financial Statement 2024-2025 (PDF,&nbsp;3MB)</a>
      <a href="/files/assets/public/v/2/document-resources/council/plans-amp-publications/operational-plans-amp-fees-amp-charges/financial-statements/financial-statement-2023-2024.pdf" title="financial-statement-2023-2024.pdf">Financial Statement 2023-2024 (PDF,&nbsp;3MB)</a>
      <a href="/files/assets/public/v/2/document-resources/council/plans-amp-publications/annualreport-summary-2024-25.pdf">Download a summary of the 2024-25 annual report (PDF,&nbsp;1MB)</a>
    `;
    const links = parseMidCoastGpfsReportLinks(indexHtml, MID_COAST_GPFS_REPORTING_URL);
    const fy2425 = links.filter((link) => link.fiscal_year === '2024-25');
    expect(fy2425).toHaveLength(1);
    expect(fy2425[0]!.url).toBe(PDF_URL);
    expect(fy2425[0]!.listing_url).toBe(MID_COAST_GPFS_REPORTING_URL);
    expect(selectMidCoastGpfsDocument(links, '2024-25').url).toBe(PDF_URL);
    expect(fiscalYearFromMidCoastGpfsLink('Financial Statement 2024-2025')).toBe('2024-25');
    expect(fiscalYearFromMidCoastGpfsLink('financial-statements-2024-2025.pdf')).toBe('2024-25');
    expect(fiscalYearFromMidCoastGpfsLink('2024/2025 Financial Statements')).toBe('2024-25');
    expect(fiscalYearFromMidCoastGpfsLink('2023-2024')).toBe('2023-24');
  });

  it('refuses to guess when the requested fiscal year is absent', () => {
    const links = parseMidCoastGpfsReportLinks(
      '<a href="/files/assets/public/v/1/document-resources/council/plans-amp-publications/operational-plans-amp-fees-amp-charges/financial-statements/financial-statements-2022-23.pdf">Financial Statement 2022-2023 (PDF, 4MB)</a>',
      MID_COAST_GPFS_REPORTING_URL,
    );
    expect(() => selectMidCoastGpfsDocument(links, '2024-25')).toThrow(/No published/);
  });
});

describe('MidCoast GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectMidCoastGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectMidCoastGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = INCOME_TEXT.split("$ '000").join('');
    const parsed = parseMidCoastGpfsExtraction(extraction({ income: withoutUnit }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('MidCoast GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles them exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(374_152);
    expect(reconciliation.total_expenses).toBe(335_094);
    expect(reconciliation.employee_expenses).toBe(96_581);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(94_690);
    expect(reconciliation.government_grants_operating).toBe(32_764);
    expect(reconciliation.government_grants_capital).toBe(70_923);
    expect(reconciliation.net_result).toBe(39_058);
    expect(reconciliation.operating_result).toBe(39_058);
    expect(reconciliation.net_result_before_capital_grants).toBe(-31_865);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(240_404);
    expect(reconciliation.revenue_components_sum).toBe(374_152);
    expect(reconciliation.expense_components_sum).toBe(240_404);
    expect(reconciliation.face_expense_bridge).toBe(335_094);
    expect(reconciliation.functions_total_income).toBe(374_152);
    expect(reconciliation.functions_total_expenses).toBe(335_094);
    expect(reconciliation.functions_operating_result).toBe(39_058);
    expect(reconciliation.functions_grants_and_contributions).toBe(103_687);
    expect(reconciliation.comprehensive_income_net_result).toBe(39_058);
    expect(reconciliation.depreciation_note_total).toBe(94_690);
    expect(reconciliation.income_statement_page).toBe(6);
    expect(reconciliation.functions_page).toBe(15);
    expect(reconciliation.comprehensive_income_page).toBe(7);
    expect(reconciliation.depreciation_note_page).toBe(26);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(37_415_200_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(33_509_400_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(9_658_100_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      9_469_000_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(3_276_400_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(7_092_300_000);
    expect(recordByLine(records, 'net_result').amount_cents).toBe(3_905_800_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
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
        source_id: MID_COAST_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: MID_COAST_GPFS_DELIVERY_ENTITY,
        source_dataset: 'MidCoast Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('MidCoast Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^mid-coast-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    // Every row is non-additive agency detail; summing the printed rows is never the total.
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('rejects the whole extraction when the printed B1-1 expense total disagrees', () => {
    const broken = FUNCTIONS_TEXT.replace('335,094 329,122', '335,900 329,122');
    const parsed = parseMidCoastGpfsExtraction(extraction({ functions: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const broken = INCOME_TEXT.replace('184,721 175,073', '184,821 175,073');
    const parsed = parseMidCoastGpfsExtraction(extraction({ income: broken }), CONTEXT);
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const broken = COMPREHENSIVE_TEXT.replace(
      'from Income Statement 39,058',
      'from Income Statement 39,000',
    );
    const parsed = parseMidCoastGpfsExtraction(extraction({ comprehensive: broken }), CONTEXT);
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
    const revenue = midCoastGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = midCoastGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^mid-coast-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(midCoastGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(midCoastGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://localhost:27017/ausspend_test_${process.pid}_midcoastgpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: MID_COAST_GPFS_ID,
    name: MID_COAST_GPFS_NAME,
    publisher: MID_COAST_GPFS_PUBLISHER,
    source_url: MID_COAST_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: MID_COAST_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'mid-coast-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('MidCoast GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: MID_COAST_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 96_692_800,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example1',
        verified: false,
        natural_key: 'aus-tender-MidCoast-Council-existing-1',
        project_name: 'Existing AusTender contract under the exact string MidCoast Council',
        delivery_entity: 'MidCoast Council',
      },
      {
        amount_cents: 58_850,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example2',
        verified: false,
        natural_key: 'aus-tender-MidCoast-Council-existing-2',
        project_name: 'Second existing AusTender contract under MidCoast Council',
        delivery_entity: 'MidCoast Council',
      },
      {
        amount_cents: 215_259_600,
        measure_type: 'grant_award',
        fiscal_year: '2025-26',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example',
        verified: false,
        natural_key: 'grantconnect-MIDCOAST-MARINE-existing',
        project_name: 'Existing GrantConnect grant to a different MidCoast business',
        delivery_entity: 'MIDCOAST MARINE INTERNATIONAL PTY LTD',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-midcoast-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'MidCoast Christian College, Taree',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'coffs-harbour-gpfs',
        source_url: 'https://www.coffsharbour.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-coffs-harbour-gpfs-1',
        project_name: 'Existing Coffs Harbour GPFS row',
        delivery_entity: 'Coffs Harbour City Council',
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
    expect(await MeasureModel.countDocuments({ source_id: 'aus-tender' })).toBe(2);
    expect(await MeasureModel.countDocuments({ source_id: 'grantconnect' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'acnc-charity' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'coffs-harbour-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: MID_COAST_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    const existing = await MeasureModel.find({
      source_id: { $in: ['aus-tender', 'grantconnect', 'acnc-charity'] },
    })
      .sort({ natural_key: 1 })
      .lean();
    expect(existing.map((row) => row.amount_cents)).toEqual([
      654_321, 96_692_800, 58_850, 215_259_600,
    ]);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: MID_COAST_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    // The two pre-existing AusTender rows keep the exact string "MidCoast Council".
    // They are preserved untouched and are never summed with the 17 GPFS rows
    // (which also carry that published entity name but a different source id).
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'MidCoast Council',
      }),
    ).toBe(2);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'MidCoast Council' })).toBe(19);

    expect(
      await MeasureModel.countDocuments({
        source_id: MID_COAST_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MID_COAST_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: MID_COAST_GPFS_ID,
        delivery_entity: { $ne: 'MidCoast Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: MID_COAST_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
