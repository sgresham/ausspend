import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import type { PdfExtraction, PdfPage } from '../src/connectors/pdf-extract.js';
import {
  KU_RING_GAI_GPFS_DELIVERY_ENTITY,
  KU_RING_GAI_GPFS_FISCAL_YEAR,
  KU_RING_GAI_GPFS_ID,
  KU_RING_GAI_GPFS_LICENSE,
  KU_RING_GAI_GPFS_NAME,
  KU_RING_GAI_GPFS_PUBLISHER,
  KU_RING_GAI_GPFS_REPORTING_URL,
  detectKuRingGaiGpfsUnit,
  discoverKuRingGaiGpfsDocument,
  fiscalYearFromKuRingGaiGpfsLink,
  kuRingGaiGpfsNaturalKey,
  parseKuRingGaiGpfsExtraction,
  parseKuRingGaiGpfsReportPage,
  type KuRingGaiGpfsParseContext,
} from '../src/connectors/ku-ring-gai-gpfs.js';
import { runIngestion } from '../src/connectors/runner.js';
import type { Connector } from '../src/connectors/types.js';
import { DataSourceModel, MeasureModel } from '../src/models/index.js';
import {
  KU_RING_GAI_PDF_BYTES,
  KU_RING_GAI_PDF_SHA256,
  KU_RING_GAI_PDF_URL,
  kuRingGaiExtraction,
  kuRingGaiIncomePage,
} from './ku-ring-gai-gpfs.fixture.js';

// Ku-ring-gai publishes a standalone Annual Financial Statements PDF linked
// from its official Finance page under the printed link text "Financial
// statements 2024-2025". Its Income Statement prints the Original unaudited
// budget column first, the FY2024-25 Actual column second and the FY2023-24
// column third, each row's label and amounts on the same printed line. The
// audited GPFS prints the borrowed-costs and net-gain-on-disposal lines
// non-nil, so both are emitted.

const CONTEXT: KuRingGaiGpfsParseContext = {
  document: {
    id: 'gpfs-2024-25',
    title: 'Ku-ring-gai Council Annual Financial Statements 2024-25',
    url: KU_RING_GAI_PDF_URL,
    fiscal_year: KU_RING_GAI_GPFS_FISCAL_YEAR,
    listing_url: KU_RING_GAI_GPFS_REPORTING_URL,
  },
  archive: {
    local_path:
      '/home/steve/ausspend-source-archive/ku-ring-gai-gpfs/ku-ring-gai-council-annual-financial-statements-2024-25.pdf',
    sha256: KU_RING_GAI_PDF_SHA256,
    bytes: KU_RING_GAI_PDF_BYTES,
    fetched_at: '2026-11-18T00:00:00.000Z',
  },
  sourceDate: '2026-11-18',
  reporting_url: KU_RING_GAI_GPFS_REPORTING_URL,
};

function parsedFixture() {
  return parseKuRingGaiGpfsExtraction(kuRingGaiExtraction(), CONTEXT);
}

function recordByLine(records: SpendingRecord[], lineItem: string): SpendingRecord {
  const record = records.find((entry) => entry.gpfs_line_item === lineItem);
  if (!record) throw new Error(`missing ${lineItem}`);
  return record;
}

function mutatePage(page: PdfPage, from: string, to: string): PdfPage {
  return {
    ...page,
    text: page.text.split(from).join(to),
    items: page.items.map((entry) => (entry.str === from ? { ...entry, str: to } : entry)),
  };
}

function extractionWith(pageNumber: number, mutate: (page: PdfPage) => PdfPage): PdfExtraction {
  const base = kuRingGaiExtraction();
  const pages = base.pages.map((page) => (page.page_number === pageNumber ? mutate(page) : page));
  return { ...base, pages, text: pages.map((page) => page.text).join('\n') };
}

describe('Ku-ring-gai Council GPFS source discovery', () => {
  const pageHtml = `
    <a href="/files/assets/public/v/1/hptrim/information-management-publications-public-website-ku-ring-gai-council-website-council/annual-financial-statements-for-the-year-ending-30-6-2026.pdf">Financial statements 2025-2026<span class="file-info">(PDF,&nbsp;3MB)</span></a>
    <a href="/files/assets/public/v/1/hptrim/information-management-publications-public-website-ku-ring-gai-council-website-council/annual-financial-statements-for-the-year-ending-30-06-2025.pdf">Financial statements 2024-2025<span class="file-info">(PDF,&nbsp;2MB)</span></a>
    <a href="/files/assets/public/v/2/hptrim/information-management-publications-public-website-ku-ring-gai-council-website-council/annual-financial-statements-year-ending-30-06-2024.pdf">Financial statements 2023-2024<span class="file-info">(PDF,&nbsp;3MB)</span></a>
    <a href="/files/assets/public/v/1/hptrim/information-management-publications-public-website-ku-ring-gai-council-website-council/annual-report-2024-2025.pdf">Annual Report 2024-2025<span class="file-info">(PDF,&nbsp;23MB)</span></a>
  `;

  it('discovers the FY2024-25 financial statements from the official page, not a hard-coded PDF URL', () => {
    expect(
      parseKuRingGaiGpfsReportPage(pageHtml, KU_RING_GAI_GPFS_REPORTING_URL, '2024-25'),
    ).toEqual({
      pdfUrl: KU_RING_GAI_PDF_URL,
      title: 'Ku-ring-gai Council Annual Financial Statements 2024-25',
    });
    expect(fiscalYearFromKuRingGaiGpfsLink('Financial statements 2024-2025')).toBe('2024-25');
    expect(
      fiscalYearFromKuRingGaiGpfsLink(
        'annual-financial-statements-for-the-year-ending-30-06-2025.pdf',
      ),
    ).toBe('2024-25');
    expect(fiscalYearFromKuRingGaiGpfsLink('Financial statements 2023/24')).toBe('2023-24');
  });

  it('resolves the PDF through the official listing HTML', async () => {
    const discovered = await discoverKuRingGaiGpfsDocument(globalThis.fetch, '2024-25', {
      listingHtml: pageHtml,
    });
    expect(discovered.title).toBe('Ku-ring-gai Council Annual Financial Statements 2024-25');
    expect(discovered.url).toBe(KU_RING_GAI_PDF_URL);
    expect(discovered.fiscal_year).toBe('2024-25');
    expect(discovered.listing_url).toBe(KU_RING_GAI_GPFS_REPORTING_URL);
  });

  it('does not select a future-year or prior-year statement', () => {
    expect(
      parseKuRingGaiGpfsReportPage(
        `<a href="/annual-financial-statements-for-the-year-ending-30-6-2026.pdf">Financial statements 2025-2026</a>`,
        KU_RING_GAI_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
    expect(
      parseKuRingGaiGpfsReportPage(
        `<a href="/annual-financial-statements-year-ending-30-06-2024.pdf">Financial statements 2023-2024</a>`,
        KU_RING_GAI_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });

  it('rejects a financial-statements link on a non-council host', () => {
    expect(
      parseKuRingGaiGpfsReportPage(
        `<a href="https://example.com/annual-financial-statements-2024-25.pdf">Financial statements 2024-2025</a>`,
        KU_RING_GAI_GPFS_REPORTING_URL,
        '2024-25',
      ),
    ).toBeNull();
  });
});

describe('Ku-ring-gai Council GPFS unit guard', () => {
  it("reads $ '000 as thousands and never defaults a missing unit to dollars", () => {
    const unit = detectKuRingGaiGpfsUnit(["$ '000"]);
    expect(unit.kind).toBe('thousands');
    expect(unit.ambiguous).toBe(false);
    expect(unit.multiplier_to_cents).toBe(100_000);

    const missing = detectKuRingGaiGpfsUnit(['Income Statement 2025 2024']);
    expect(missing.kind).toBeNull();
    expect(missing.ambiguous).toBe(true);
  });

  it('rejects the whole extraction when the printed unit is missing', () => {
    const withoutUnit = mutatePage(kuRingGaiIncomePage(), "$ '000", '');
    const base = kuRingGaiExtraction();
    const pages = base.pages.map((page) => (page.page_number === 7 ? withoutUnit : page));
    const parsed = parseKuRingGaiGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/no unambiguous printed currency unit/);
  });
});

describe('Ku-ring-gai Council GPFS exact reconciliation', () => {
  it('reads the printed top-level lines and reconciles the face statement, B1-1, comprehensive income and note B3-4 exactly', () => {
    const parsed = parsedFixture();
    expect(parsed.records).toHaveLength(17);
    const reconciliation = parsed.reconciliation!;
    expect(reconciliation.unit).toBe('thousands');
    expect(reconciliation.total_revenue).toBe(182_600);
    expect(reconciliation.total_expenses).toBe(160_603);
    expect(reconciliation.employee_expenses).toBe(51_963);
    expect(reconciliation.depreciation_amortisation_impairment).toBe(27_062);
    expect(reconciliation.government_grants_operating).toBe(8_459);
    expect(reconciliation.government_grants_capital).toBe(18_043);
    expect(reconciliation.borrowing_costs).toBe(1_173);
    expect(reconciliation.net_gain_from_disposal_of_assets).toBe(3_675);
    expect(reconciliation.net_result).toBe(21_997);
    expect(reconciliation.operating_result).toBe(21_997);
    expect(reconciliation.operating_result_excluding_depreciation).toBe(49_059);
    expect(reconciliation.net_result_before_capital_grants).toBe(3_954);
    expect(reconciliation.printed_total_expenses_excluding_depreciation).toBe(133_541);
    expect(reconciliation.revenue_components_sum).toBe(182_600);
    expect(reconciliation.expense_components_sum).toBe(133_541);
    expect(reconciliation.face_expense_bridge).toBe(160_603);
    expect(reconciliation.functions_total_income).toBe(182_600);
    expect(reconciliation.functions_total_expenses).toBe(160_603);
    expect(reconciliation.functions_operating_result).toBe(21_997);
    expect(reconciliation.functions_grants_and_contributions).toBe(26_502);
    expect(reconciliation.comprehensive_income_net_result).toBe(21_997);
    expect(reconciliation.comprehensive_income_other).toBe(48_118);
    expect(reconciliation.comprehensive_income_total).toBe(70_115);
    expect(reconciliation.depreciation_impairment_note_total).toBe(27_062);
    expect(reconciliation.income_statement_page).toBe(7);
    expect(reconciliation.functions_page).toBe(16);
    expect(reconciliation.comprehensive_income_page).toBe(8);
    expect(reconciliation.depreciation_note_page).toBe(27);
    expect(reconciliation.conduct_report).toMatchObject({
      page_number: 72,
      operating_result_millions: 21.9,
      prior_year_operating_result_millions: 21.7,
      operating_result_change_millions: 0.31,
      graph_operating_result_millions: 21.99,
      operating_grants_millions: 8.4,
      capital_grants_millions: 18.0,
      rates_and_annual_charges_millions: 103.5,
      depreciation_millions: 27.06,
      materials_and_services_millions: 75.1,
      net_result_before_capital_millions: 3.94,
      total_expenses_millions: null,
    });
    expect(reconciliation.conduct_report_narrative_discrepancies.length).toBe(2);
    expect(reconciliation.conduct_report_narrative_discrepancies.join(' ')).toMatch(
      /operating result narrative/,
    );
    expect(reconciliation.conduct_report_narrative_discrepancies.join(' ')).toMatch(
      /operating grants narrative/,
    );
    expect(reconciliation.conduct_report_internal_discrepancies.length).toBe(2);
    expect(reconciliation.conduct_report_internal_discrepancies.join(' ')).toMatch(/21\.99/);
    expect(reconciliation.human_spot_check_required).toBe(true);

    const records = parsed.records;
    expect(recordByLine(records, 'total_revenue').amount_cents).toBe(18_260_000_000);
    expect(recordByLine(records, 'total_expenses').amount_cents).toBe(16_060_300_000);
    expect(recordByLine(records, 'employee_expenses').amount_cents).toBe(5_196_300_000);
    expect(recordByLine(records, 'depreciation_amortisation_impairment').amount_cents).toBe(
      2_706_200_000,
    );
    expect(recordByLine(records, 'government_grants_operating').amount_cents).toBe(845_900_000);
    expect(recordByLine(records, 'government_grants_capital').amount_cents).toBe(1_804_300_000);
    expect(recordByLine(records, 'borrowing_costs').amount_cents).toBe(117_300_000);
    expect(recordByLine(records, 'net_gain_from_disposal_of_assets').amount_cents).toBe(
      367_500_000,
    );
    expect(recordByLine(records, 'net_result').amount_cents).toBe(2_199_700_000);
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').amount_cents).toBe(
      13_354_100_000,
    );
    expect(recordByLine(records, 'rates_and_annual_charges').amount_cents).toBe(10_347_900_000);
    expect(recordByLine(records, 'net_result').gpfs_printed_sign).toBeUndefined();
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
        'net_gain_from_disposal_of_assets',
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
        source_id: KU_RING_GAI_GPFS_ID,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        jurisdiction_level: 'local',
        jurisdiction: 'NSW',
        delivery_entity: KU_RING_GAI_GPFS_DELIVERY_ENTITY,
        source_dataset: 'Ku-ring-gai Council GPFS 2024-25',
        data_quality_flag: 'provisional/local_government',
        aggregation_role: 'agency_detail',
        verified: false,
        source_url: CONTEXT.document.url,
      });
      expect(record.delivery_entity).toBe('Ku-ring-gai Council');
      expect(record.gpfs_unit).toBe('AUD_thousands');
      expect(record.region_id).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.natural_key).toMatch(/^ku-ring-gai-gpfs:[a-f0-9]{40}$/);
    }
    expect(recordByLine(records, 'government_grants_operating').potential_double_count).toBe(true);
    expect(recordByLine(records, 'government_grants_capital').potential_double_count).toBe(true);
    expect(recordByLine(records, 'rates_and_annual_charges').gpfs_component_of).toBe(
      'total_revenue',
    );
    expect(recordByLine(records, 'borrowing_costs').gpfs_component_of).toBe(
      'total_expenses_excluding_depreciation',
    );
    expect(recordByLine(records, 'depreciation_amortisation_impairment').gpfs_component_of).toBe(
      'total_expenses',
    );
    expect(recordByLine(records, 'total_expenses').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'total_expenses_excluding_depreciation').notes).toContain(
      'human_spot_check: required',
    );
    expect(recordByLine(records, 'net_result').notes).toContain('human_spot_check: required');
    expect(recordByLine(records, 'employee_expenses').notes).not.toContain('human_spot_check');
    expect(recordByLine(records, 'net_result').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_revenue').potential_double_count).toBeUndefined();
    expect(recordByLine(records, 'total_expenses').potential_double_count).toBeUndefined();
    expect(records.every((record) => record.aggregation_role === 'agency_detail')).toBe(true);
  });

  it('retains a printed narrative total-expenses difference for a human without rejecting the exact face/B1-1 reconciliation', () => {
    const base = kuRingGaiExtraction();
    const pages = base.pages.map((page) =>
      page.page_number === 72
        ? {
            ...page,
            text: `${page.text} total expenses from continuing operations including depreciation ($161.0 million)`,
          }
        : page,
    );
    const parsed = parseKuRingGaiGpfsExtraction(
      { ...base, pages, text: pages.map((page) => page.text).join('\n') },
      CONTEXT,
    );
    expect(parsed.records).toHaveLength(17);
    expect(parsed.reconciliation!.conduct_report_total_expenses_discrepancy_thousands).toBe(397);
    expect(parsed.reconciliation!.conduct_report_narrative_discrepancies.length).toBe(3);
    expect(recordByLine(parsed.records, 'total_expenses').notes).toContain(
      'human_spot_check: required',
    );
    expect(recordByLine(parsed.records, 'net_result').notes).toContain(
      'human_spot_check: required',
    );
    expect(recordByLine(parsed.records, 'employee_expenses').notes).not.toContain(
      'human_spot_check',
    );
  });

  it('rejects the whole extraction when the B1-1 total row disagrees with the face statement', () => {
    const parsed = parseKuRingGaiGpfsExtraction(
      extractionWith(16, (page) => mutatePage(page, '160,603', '160,693')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when a face revenue component is altered', () => {
    const parsed = parseKuRingGaiGpfsExtraction(
      extractionWith(7, (page) => mutatePage(page, '103,479', '103,379')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/reconciliation failed/);
  });

  it('rejects the whole extraction when the comprehensive-income net result disagrees', () => {
    const parsed = parseKuRingGaiGpfsExtraction(
      extractionWith(8, (page) => mutatePage(page, '21,997', '21,900')),
      CONTEXT,
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.reconciliation).toBeNull();
    expect(parsed.rejections[0]!.reason).toMatch(/failed/);
  });

  it('rejects the whole extraction when note B3-4 depreciation no longer bridges', () => {
    const parsed = parseKuRingGaiGpfsExtraction(
      extractionWith(27, (page) => mutatePage(page, '27,062', '27,162')),
      CONTEXT,
    );
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
    const revenue = kuRingGaiGpfsNaturalKey(url, 'total_revenue', '2024-25');
    const expenses = kuRingGaiGpfsNaturalKey(url, 'total_expenses', '2024-25');
    expect(revenue).toMatch(/^ku-ring-gai-gpfs:[a-f0-9]{40}$/);
    expect(revenue).not.toBe(expenses);
    expect(revenue).toBe(kuRingGaiGpfsNaturalKey(url, 'total_revenue', '2024-25'));
    expect(revenue).not.toBe(kuRingGaiGpfsNaturalKey(url, 'total_revenue', '2025-26'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ??
  `mongodb://10.10.10.30:27017/ausspend_test_${process.pid}_kuringgaigpfs`;

function fakeConnector(records: SpendingRecord[]): Connector {
  return {
    id: KU_RING_GAI_GPFS_ID,
    name: KU_RING_GAI_GPFS_NAME,
    publisher: KU_RING_GAI_GPFS_PUBLISHER,
    source_url: KU_RING_GAI_GPFS_REPORTING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: KU_RING_GAI_GPFS_LICENSE,
    notes: 'test fixture',
    async fetch() {
      return records.map((record) => ({ kind: 'ku-ring-gai-gpfs-measure', record }));
    },
    transform(raw) {
      return raw.map((entry) => entry.record as SpendingRecord);
    },
    metadata: { lastFetchedAt: null, recordsIngested: 0, errors: [], warnings: [] },
  };
}

describe('Ku-ring-gai Council GPFS ingestion is additive-only and idempotent', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
    expect(await MeasureModel.countDocuments({ source_id: KU_RING_GAI_GPFS_ID })).toBe(0);
    await MeasureModel.insertMany([
      {
        amount_cents: 52_000_000,
        measure_type: 'grant_award',
        fiscal_year: '2024-25',
        source_id: 'grantconnect',
        source_url: 'https://www.grants.gov.au/example1',
        verified: false,
        natural_key: 'grantconnect-ku-ring-gai-council-existing-1',
        project_name: 'Existing GrantConnect grant under the exact string Ku-ring-gai Council',
        delivery_entity: 'Ku-ring-gai Council',
      },
      {
        amount_cents: 128_500,
        measure_type: 'contract',
        fiscal_year: '2024-25',
        source_id: 'aus-tender',
        source_url: 'https://www.tenders.gov.au/example',
        verified: false,
        natural_key: 'aus-tender-KU-RING-GAI-COUNCIL-existing',
        project_name: 'Existing AusTender contract under the uppercase KU-RING-GAI COUNCIL',
        delivery_entity: 'KU-RING-GAI COUNCIL',
      },
      {
        amount_cents: 654_321,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'acnc-charity',
        source_url: 'https://www.acnc.gov.au/example',
        verified: false,
        natural_key: 'acnc-existing-ku-ring-gai-charity',
        project_name: 'Existing ACNC charity row (not the council)',
        delivery_entity: 'Ku-ring-gai Neighbourhood Centre Incorporated',
      },
      {
        amount_cents: 777_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'liverpool-gpfs',
        source_url: 'https://www.liverpool.nsw.gov.au/example.pdf',
        verified: false,
        natural_key: 'existing-liverpool-gpfs-1',
        project_name: 'Existing Liverpool City Council GPFS row',
        delivery_entity: 'Liverpool City Council',
      },
      {
        amount_cents: 999_000,
        measure_type: 'actual',
        fiscal_year: '2024-25',
        source_id: 'nsw-budget',
        source_url: 'https://www.nsw.gov.au/example',
        verified: false,
        natural_key: 'existing-nsw-budget-ku-ring-gai-project',
        project_name: 'Existing NSW Budget project whose name mentions Ku-ring-gai',
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
    expect(await MeasureModel.countDocuments({ source_id: 'liverpool-gpfs' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: 'nsw-budget' })).toBe(1);
    expect(await MeasureModel.countDocuments({ source_id: KU_RING_GAI_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);

    await runIngestion({ connectors: [connector] });
    expect(await MeasureModel.countDocuments({ source_id: KU_RING_GAI_GPFS_ID })).toBe(17);
    expect(await MeasureModel.countDocuments({})).toBe(22);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'grantconnect',
        delivery_entity: 'Ku-ring-gai Council',
      }),
    ).toBe(1);
    expect(
      await MeasureModel.countDocuments({
        source_id: 'aus-tender',
        delivery_entity: 'KU-RING-GAI COUNCIL',
      }),
    ).toBe(1);
    expect(await MeasureModel.countDocuments({ delivery_entity: 'Ku-ring-gai Council' })).toBe(18);
    expect(await MeasureModel.countDocuments({ delivery_entity: /^ku-ring-gai council$/i })).toBe(
      19,
    );
    expect(await MeasureModel.countDocuments({ delivery_entity: /ku-ring-gai/i })).toBe(20);

    expect(
      await MeasureModel.countDocuments({
        source_id: KU_RING_GAI_GPFS_ID,
        aggregation_role: { $ne: 'agency_detail' },
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: KU_RING_GAI_GPFS_ID,
        $or: [{ region_id: { $exists: true } }, { location: { $exists: true } }],
      }),
    ).toBe(0);
    expect(
      await MeasureModel.countDocuments({
        source_id: KU_RING_GAI_GPFS_ID,
        delivery_entity: { $ne: 'Ku-ring-gai Council' },
      }),
    ).toBe(0);

    const source = await DataSourceModel.findOne({ source_id: KU_RING_GAI_GPFS_ID }).lean();
    expect(source?.status).toBe('active');
    expect(source?.records_ingested).toBe(17);
  });
});
