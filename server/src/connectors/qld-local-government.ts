import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import type { SpendingRecord } from '@ausspend/shared';
import { archiveSourceDocument, verifySourceDocument } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * QLD Local Government Comparative Information (Phase 6.9).
 *
 * CKAN dataset: `queensland-local-government-comparative-information-report`
 * on data.qld.gov.au. Its **Financial Inputs** CSV is the requested resource:
 * one row per council × financial year with reported dollar inputs in $'000.
 *
 * This is deliberately separate from `qld-qgip` (project grants and procured
 * services). These rows are council-level financial inputs, `measure_type`
 * actual and `aggregation_role` agency_detail. They are never summed across
 * councils, years or measures, and never combined with QGIP.
 *
 * Measures ingested (one row per council × year × measure when published):
 * - total_operating_expenses (the printed total operating expenses before
 *   interest; for 2013-14 onward the CSV's "from 2013/14" column)
 * - employee_expenses
 * - depreciation_amortisation
 * - interest_paid_borrowing_costs
 *
 * The three components are flagged as components of total_operating_expenses
 * and are never added to it. Reconciliation: every component must be <= the
 * printed total for the same council-year (a larger component fails
 * ingestion). The CSV has no printed total row, so no cross-council total is
 * computed.
 */

export const QLD_LG_ID = 'qld-local-government';
export const QLD_LG_NAME =
  'Queensland local government comparative information — financial inputs and road data';
export const QLD_LG_PUBLISHER = 'Queensland Department of Local Government, Water and Volunteers';
export const QLD_LG_SOURCE_URL =
  'https://www.data.qld.gov.au/dataset/queensland-local-government-comparative-information-report';
export const QLD_LG_RESOURCE_URL =
  'https://www.data.qld.gov.au/dataset/c7c0c31e-a844-480d-bfbe-4b689179a5cf/resource/2dd25c9b-cc5b-4c81-876f-97d277e88889/download/qld-local-government-comparative-information-report-cdc-financial-inputs.csv';
export const QLD_LG_ROAD_RESOURCE_URL =
  'https://www.data.qld.gov.au/dataset/c7c0c31e-a844-480d-bfbe-4b689179a5cf/resource/d20b3d8b-6813-4266-afaa-1436129c9f23/download/qld-local-government-comparative-information-report-cdc-roads.csv';
export const QLD_LG_LICENSE = 'Creative Commons Attribution 4.0 International (CC BY 4.0)';
export const QLD_LG_DATASET =
  'Queensland local government comparative information report — Financial Inputs';
export const QLD_LG_ROAD_DATASET =
  'Queensland local government comparative information report — Road Data';
export const QLD_LG_UNIT = 'AUD_thousands';
export const QLD_LG_UNIT_LABEL = "$'000";
export const QLD_LG_UNIT_TO_CENTS = 100_000;
export const QLD_LG_CAVEAT =
  'Council-level financial inputs from the Queensland local government comparative information report, actual reported values in $’000. These are not QGIP project grants or procurement. Every row is agency_detail and non-additive: never sum across councils, years or measures, and never add to QGIP.';
export const QLD_LG_ROAD_CAVEAT =
  'Council-level road expenditure from the Queensland local government comparative information report Road Data resource, actual reported values in $’000. Only printed dollar expenditure/depreciation columns are ingested; linear kilometres, bridge and culvert counts/areas, asset replacement/written-down values and the valuation year are not spending and are not ingested. These rows are not QGIP and are never summed across councils, years or measures.';

export const QLD_LG_CKAN_BASE = 'https://www.data.qld.gov.au/api/3/action';
export const QLD_LG_PACKAGE = 'queensland-local-government-comparative-information-report';

const TOTAL_OLD = "Total operating expenses before interest (excl unfunded depreciation) - $'000";
const TOTAL_NEW = "Total operating expenses before interest * - from 2013/14 $'000";
const EMPLOYEE = "Employee expenses - $'000";
const DEPRECIATION = "Depreciation and amortisation expense - $'000";
const INTEREST =
  "Total Interest paid (borrowing costs) to QTC and other financial institutions - $'000";
const NET_RATES = "Net rates and utility charges - $'000";
const TOTAL_OPERATING_INCOME = "Total operating Income - $'000";
const UNFUNDED_DEPRECIATION = "Unfunded depreciation (if available) - $'000";
const TOTAL_EXCL_DEPRECIATION_OLD =
  "Total operating expenses before Interest (excl depreciation and unfunded depreciation) - $'000";
const TOTAL_EXCL_DEPRECIATION_NEW =
  "Total operating expenses before Interest (excl depreciation) * - from 2013/14 $'000";
const INTEREST_QTC = "Interest paid (borrowing costs) - QTC - $'000";
const INTEREST_OTHER = "Interest paid (borrowing costs) - Other financial institutions - $'000";
const REPAYMENTS_QTC = "Repayment of borrowings - QTC - $'000";
const REPAYMENTS_OTHER = "Repayment of borrowings - Other financial institutions - $'000";
const FINANCE_LEASE_REPAYMENTS = "Repayments made on finance leases - $'000";
const CASH_AND_DEPOSITS = "Cash at bank, term deposits (up to 12 months) and on hand - $'000";
const UNSPENT_LOAN_MONIES = "Unspent loan monies drawn down - $'000";
const RECEIVABLES_RATES = "Current assets - Receivables - Rate revenue and utility charges - $'000";
const RECEIVABLES_WATER = "Current assets - Receivables - Water charges not yet levied - $'000";
const TOTAL_CURRENT_ASSETS =
  "Total current assets (excl unspent loan monies drawn down and water charges accrued but not yet levied) - $'000";
const PPE_ADDITIONS = "Property, plant and equipment additions at cost - $'000";
const CAPITAL_WORKS_IN_PROGRESS = "Capital works in progress - $'000";
const CURRENT_LIABILITIES_QTC = "Current liabilities (interest-bearing) - Loans from QTC - $'000";
const CURRENT_LIABILITIES_OTHER =
  "Current liabilities (interest-bearing) - Loans from other financial institutions - $'000";
const CURRENT_LIABILITIES_FINANCE_LEASES =
  "Current liabilities (interest-bearing) - Finance leases - $'000";
const TOTAL_CURRENT_LIABILITIES = "Total current liabilities - $'000";
const NONCURRENT_LIABILITIES_QTC =
  "Non-current liabilities (interest-bearing) - Loans from QTC - $'000";
const NONCURRENT_LIABILITIES_OTHER =
  "Non-current liabilities (interest-bearing) - Loans from other financial institutions - $'000";
const NONCURRENT_LIABILITIES_FINANCE_LEASES =
  "Non-current liabilities (interest-bearing) - Finance leases - $'000";
const COMMUNITY_EQUITY = "Community equity - Closing balance - $'000";
const TOTAL_BORROWINGS = "Total borrowings - $'000";
const COUNCILLOR_REMUNERATION = "Councillor remuneration - $'000";
const COUNCILLOR_REMUNERATION_NET =
  "Councillor remuneration (net of capitalised expenses) ** - from 2013/14 $'000";

export type QldLgMeasure =
  | 'total_operating_expenses'
  | 'employee_expenses'
  | 'depreciation_amortisation'
  | 'interest_paid_borrowing_costs'
  | 'net_rates_and_utility_charges'
  | 'total_operating_income'
  | 'unfunded_depreciation'
  | 'total_operating_expenses_excl_depreciation'
  | 'interest_paid_qtc'
  | 'interest_paid_other_financial_institutions'
  | 'repayments_borrowings_qtc'
  | 'repayments_borrowings_other_financial_institutions'
  | 'finance_lease_repayments'
  | 'cash_and_deposits'
  | 'unspent_loan_monies'
  | 'receivables_rate_revenue'
  | 'receivables_water_charges'
  | 'total_current_assets'
  | 'ppe_additions_at_cost'
  | 'capital_works_in_progress'
  | 'current_liabilities_loans_qtc'
  | 'current_liabilities_loans_other_financial_institutions'
  | 'current_liabilities_finance_leases'
  | 'total_current_liabilities'
  | 'noncurrent_liabilities_loans_qtc'
  | 'noncurrent_liabilities_loans_other_financial_institutions'
  | 'noncurrent_liabilities_finance_leases'
  | 'community_equity_closing_balance'
  | 'total_borrowings'
  | 'councillor_remuneration';

export type QldLgRoadMeasure =
  | 'road_capital_renewal_expenditure'
  | 'road_capital_upgrade_expenditure'
  | 'road_capital_expansion_expenditure'
  | 'road_total_capital_expenditure'
  | 'road_total_maintenance_expenditure'
  | 'road_existing_bridges_culverts_expenditure'
  | 'road_new_bridges_culverts_capital_expenditure'
  | 'road_total_bridges_culverts_expenditure'
  | 'road_depreciation_expense'
  | 'road_total_expenditure_bridges_culverts';

export interface QldLgMeasureSpec {
  measure: QldLgMeasure;
  label: string;
  /** Printed CSV columns, tried in order (old/new label variants). */
  columns: readonly string[];
  componentOf: string | null;
}

export const QLD_LG_MEASURES: readonly QldLgMeasureSpec[] = [
  {
    measure: 'total_operating_expenses',
    label: 'Total operating expenses before interest',
    columns: [TOTAL_OLD, TOTAL_NEW],
    componentOf: null,
  },
  {
    measure: 'employee_expenses',
    label: 'Employee expenses',
    columns: [EMPLOYEE],
    componentOf: 'total_operating_expenses',
  },
  {
    measure: 'depreciation_amortisation',
    label: 'Depreciation and amortisation expense',
    columns: [DEPRECIATION],
    componentOf: 'total_operating_expenses',
  },
  {
    measure: 'interest_paid_borrowing_costs',
    label: 'Interest paid (borrowing costs)',
    columns: [INTEREST],
    componentOf: 'total_operating_expenses',
  },
  {
    measure: 'net_rates_and_utility_charges',
    label: 'Net rates and utility charges',
    columns: [NET_RATES],
    componentOf: null,
  },
  {
    measure: 'total_operating_income',
    label: 'Total operating income',
    columns: [TOTAL_OPERATING_INCOME],
    componentOf: null,
  },
  {
    measure: 'unfunded_depreciation',
    label: 'Unfunded depreciation',
    columns: [UNFUNDED_DEPRECIATION],
    componentOf: null,
  },
  {
    measure: 'total_operating_expenses_excl_depreciation',
    label: 'Total operating expenses before interest excluding depreciation',
    columns: [TOTAL_EXCL_DEPRECIATION_OLD, TOTAL_EXCL_DEPRECIATION_NEW],
    componentOf: null,
  },
  {
    measure: 'interest_paid_qtc',
    label: 'Interest paid to QTC',
    columns: [INTEREST_QTC],
    componentOf: 'interest_paid_borrowing_costs',
  },
  {
    measure: 'interest_paid_other_financial_institutions',
    label: 'Interest paid to other financial institutions',
    columns: [INTEREST_OTHER],
    componentOf: 'interest_paid_borrowing_costs',
  },
  {
    measure: 'repayments_borrowings_qtc',
    label: 'Repayment of borrowings to QTC',
    columns: [REPAYMENTS_QTC],
    componentOf: null,
  },
  {
    measure: 'repayments_borrowings_other_financial_institutions',
    label: 'Repayment of borrowings to other financial institutions',
    columns: [REPAYMENTS_OTHER],
    componentOf: null,
  },
  {
    measure: 'finance_lease_repayments',
    label: 'Repayments made on finance leases',
    columns: [FINANCE_LEASE_REPAYMENTS],
    componentOf: null,
  },
  {
    measure: 'cash_and_deposits',
    label: 'Cash at bank, term deposits and on hand',
    columns: [CASH_AND_DEPOSITS],
    componentOf: null,
  },
  {
    measure: 'unspent_loan_monies',
    label: 'Unspent loan monies drawn down',
    columns: [UNSPENT_LOAN_MONIES],
    componentOf: null,
  },
  {
    measure: 'receivables_rate_revenue',
    label: 'Receivables — rate revenue and utility charges',
    columns: [RECEIVABLES_RATES],
    componentOf: null,
  },
  {
    measure: 'receivables_water_charges',
    label: 'Receivables — water charges not yet levied',
    columns: [RECEIVABLES_WATER],
    componentOf: null,
  },
  {
    measure: 'total_current_assets',
    label: 'Total current assets',
    columns: [TOTAL_CURRENT_ASSETS],
    componentOf: null,
  },
  {
    measure: 'ppe_additions_at_cost',
    label: 'Property, plant and equipment additions at cost',
    columns: [PPE_ADDITIONS],
    componentOf: null,
  },
  {
    measure: 'capital_works_in_progress',
    label: 'Capital works in progress',
    columns: [CAPITAL_WORKS_IN_PROGRESS],
    componentOf: null,
  },
  {
    measure: 'current_liabilities_loans_qtc',
    label: 'Current interest-bearing liabilities — QTC loans',
    columns: [CURRENT_LIABILITIES_QTC],
    componentOf: null,
  },
  {
    measure: 'current_liabilities_loans_other_financial_institutions',
    label: 'Current interest-bearing liabilities — other financial institutions',
    columns: [CURRENT_LIABILITIES_OTHER],
    componentOf: null,
  },
  {
    measure: 'current_liabilities_finance_leases',
    label: 'Current interest-bearing liabilities — finance leases',
    columns: [CURRENT_LIABILITIES_FINANCE_LEASES],
    componentOf: null,
  },
  {
    measure: 'total_current_liabilities',
    label: 'Total current liabilities',
    columns: [TOTAL_CURRENT_LIABILITIES],
    componentOf: null,
  },
  {
    measure: 'noncurrent_liabilities_loans_qtc',
    label: 'Non-current interest-bearing liabilities — QTC loans',
    columns: [NONCURRENT_LIABILITIES_QTC],
    componentOf: null,
  },
  {
    measure: 'noncurrent_liabilities_loans_other_financial_institutions',
    label: 'Non-current interest-bearing liabilities — other financial institutions',
    columns: [NONCURRENT_LIABILITIES_OTHER],
    componentOf: null,
  },
  {
    measure: 'noncurrent_liabilities_finance_leases',
    label: 'Non-current interest-bearing liabilities — finance leases',
    columns: [NONCURRENT_LIABILITIES_FINANCE_LEASES],
    componentOf: null,
  },
  {
    measure: 'community_equity_closing_balance',
    label: 'Community equity — closing balance',
    columns: [COMMUNITY_EQUITY],
    componentOf: null,
  },
  {
    measure: 'total_borrowings',
    label: 'Total borrowings',
    columns: [TOTAL_BORROWINGS],
    componentOf: null,
  },
  {
    measure: 'councillor_remuneration',
    label: 'Councillor remuneration',
    columns: [COUNCILLOR_REMUNERATION, COUNCILLOR_REMUNERATION_NET],
    componentOf: null,
  },
];

export type QldLgCoreMeasure =
  | 'total_operating_expenses'
  | 'employee_expenses'
  | 'depreciation_amortisation'
  | 'interest_paid_borrowing_costs';

const QLD_LG_CORE_MEASURES = new Set<QldLgCoreMeasure>([
  'total_operating_expenses',
  'employee_expenses',
  'depreciation_amortisation',
  'interest_paid_borrowing_costs',
]);

function isQldLgCoreMeasure(measure: QldLgMeasure): measure is QldLgCoreMeasure {
  return QLD_LG_CORE_MEASURES.has(measure as QldLgCoreMeasure);
}

export interface QldLgRoadMeasureSpec {
  measure: QldLgRoadMeasure;
  label: string;
  column: string;
  componentOf: string | null;
}

export const QLD_LG_ROAD_MEASURES: readonly QldLgRoadMeasureSpec[] = [
  {
    measure: 'road_capital_renewal_expenditure',
    label: 'Capital renewal expenditure on existing roads',
    column: "Capital Renewal Expenditure on EXISTING roads (excl depn) - $'000",
    componentOf: 'road_total_capital_expenditure',
  },
  {
    measure: 'road_capital_upgrade_expenditure',
    label: 'Capital upgrade expenditure on existing roads',
    column: "Capital Upgrade Expenditure on EXISTING roads (excl depn) - $'000",
    componentOf: 'road_total_capital_expenditure',
  },
  {
    measure: 'road_capital_expansion_expenditure',
    label: 'Capital expansion expenditure on new roads',
    column: "Capital Expansion Expenditure on NEW roads (excl depn) - $'000",
    componentOf: 'road_total_capital_expenditure',
  },
  {
    measure: 'road_total_capital_expenditure',
    label: 'Total capital expenditure on roads',
    column: "Total Capital Expenditure on roads (excl depn) - $'000",
    componentOf: null,
  },
  {
    measure: 'road_total_maintenance_expenditure',
    label: 'Total maintenance expenditure on roads',
    column: "Total Maintenance Expenditure on roads (excl depn) - $'000",
    componentOf: null,
  },
  {
    measure: 'road_existing_bridges_culverts_expenditure',
    label: 'Expenditure on existing bridges and major culverts',
    column: "Expenditure on EXISTING bridges and major culverts - $'000",
    componentOf: 'road_total_bridges_culverts_expenditure',
  },
  {
    measure: 'road_new_bridges_culverts_capital_expenditure',
    label: 'Capital expenditure on new bridges and major culverts',
    column: "Capital expenditure on NEW bridges and major culverts - $'000",
    componentOf: 'road_total_bridges_culverts_expenditure',
  },
  {
    measure: 'road_total_bridges_culverts_expenditure',
    label: 'Total expenditure — bridges and culverts',
    column: "Total Expenditure - Bridges and Culverts - $'000",
    componentOf: null,
  },
  {
    measure: 'road_depreciation_expense',
    label: 'Depreciation expense for roads',
    column: "Depreciation expense for roads - $'000",
    componentOf: null,
  },
  {
    measure: 'road_total_expenditure_bridges_culverts',
    label: 'Total expenditure — roads, bridges and major culverts',
    column: "Total expenditure - roads, bridges, major culverts - $'000",
    componentOf: null,
  },
];

export function qldLgThousandsToCents(thousands: number): number {
  const cents = Math.round(Math.abs(thousands) * QLD_LG_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`QLD local government amount ${thousands} $'000 is outside the safe range`);
  }
  return cents;
}

export function qldLgNaturalKey(parts: {
  council: string;
  fiscal_year: string;
  measure: string;
}): string {
  const digest = createHash('sha256')
    .update([QLD_LG_ID, parts.council, parts.fiscal_year, parts.measure].join('|'))
    .digest('hex');
  return `${QLD_LG_ID}:${digest}`;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseThousands(raw: unknown): number | null {
  const text = clean(raw).replace(/,/g, '').replace(/\s+/g, '');
  if (!text || /^(?:na|n\/a|-|\.\.\.+)$/i.test(text)) return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function decodeCsvBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function fiscalYear(raw: string): string | null {
  const match = /^(20\d{2})_(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

export interface QldLgSkip {
  row: number;
  reason: string;
}

export interface QldLgParseResult {
  records: SpendingRecord[];
  skipped: QldLgSkip[];
  councils: number;
  years: number;
}

function valueForColumns(row: Record<string, unknown>, columns: readonly string[]): number | null {
  for (const column of columns) {
    const value = parseThousands(row[column]);
    if (value !== null) return value;
  }
  return null;
}

export function parseQldLocalGovernmentCsv(
  csvText: string,
  sourceUrl = QLD_LG_RESOURCE_URL,
): QldLgParseResult {
  const rows = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, unknown>[];

  if (rows.length === 0) throw new Error('QLD local government Financial Inputs CSV is empty');
  const headers = new Set(Object.keys(rows[0]!));
  for (const required of ['Local Government', 'Financial Year']) {
    if (!headers.has(required)) {
      throw new Error(`QLD local government Financial Inputs CSV is missing column ${required}`);
    }
  }
  if (!headers.has(TOTAL_OLD) && !headers.has(TOTAL_NEW)) {
    throw new Error(
      'QLD local government Financial Inputs CSV is missing both printed total operating-expense columns',
    );
  }

  const records: SpendingRecord[] = [];
  const skipped: QldLgSkip[] = [];
  const seen = new Set<string>();
  const councils = new Set<string>();
  const years = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const council = clean(row['Local Government']);
    const year = fiscalYear(clean(row['Financial Year']));
    if (!council) {
      skipped.push({ row: rowNumber, reason: 'missing Local Government' });
      return;
    }
    if (!year) {
      skipped.push({ row: rowNumber, reason: 'invalid Financial Year' });
      return;
    }

    const values = Object.fromEntries(
      QLD_LG_MEASURES.map((spec) => [spec.measure, valueForColumns(row, spec.columns)]),
    ) as Record<QldLgMeasure, number | null>;

    const total = values.total_operating_expenses;
    if (total !== null) {
      const componentSum = QLD_LG_MEASURES.filter(
        (spec) => spec.componentOf === 'total_operating_expenses',
      ).reduce((accumulator, spec) => accumulator + (values[spec.measure] ?? 0), 0);
      if (componentSum > total + 0.5) {
        throw new Error(
          `QLD local government reconciliation failed for ${council} ${year}: components ${componentSum} exceed printed total ${total}`,
        );
      }
    }

    const interestTotal = values.interest_paid_borrowing_costs;
    if (
      interestTotal !== null &&
      values.interest_paid_qtc !== null &&
      values.interest_paid_other_financial_institutions !== null
    ) {
      const interestSplit =
        values.interest_paid_qtc + values.interest_paid_other_financial_institutions;
      if (interestSplit > interestTotal + 0.5) {
        throw new Error(
          `QLD local government interest reconciliation failed for ${council} ${year}: QTC/other split ${interestSplit} exceeds printed total ${interestTotal}`,
        );
      }
    }

    for (const spec of QLD_LG_MEASURES) {
      const value = values[spec.measure];
      if (value === null || value === undefined) continue;
      if (value < 0) {
        skipped.push({ row: rowNumber, reason: `negative ${spec.measure}; not ingested` });
        continue;
      }
      const naturalKey = qldLgNaturalKey({
        council,
        fiscal_year: year,
        measure: spec.measure,
      });
      if (seen.has(naturalKey)) {
        skipped.push({ row: rowNumber, reason: `duplicate ${spec.measure}` });
        continue;
      }
      seen.add(naturalKey);
      councils.add(council);
      years.add(year);
      records.push({
        amount_cents: qldLgThousandsToCents(value),
        measure_type: 'actual',
        fiscal_year: year,
        source_id: QLD_LG_ID,
        source_url: sourceUrl,
        verified: false,
        natural_key: naturalKey,
        project_name: council,
        description: spec.label,
        jurisdiction_level: 'local',
        jurisdiction: 'QLD',
        delivery_entity: council,
        funding_source: 'Queensland local government',
        source_dataset: QLD_LG_DATASET,
        data_quality_flag: 'provisional',
        aggregation_role: 'agency_detail',
        extraction_confidence: 'high',
        location: { state: 'QLD', lga_name: council },
        notes: `${QLD_LG_CAVEAT} Printed column: ${spec.label}. ${
          spec.componentOf
            ? `Component of ${spec.componentOf}; never added to it.`
            : 'Printed council-year financial input; not a cross-council total.'
        }`,
        category: spec.measure,
        ...(isQldLgCoreMeasure(spec.measure) ? { qld_lg_measure: spec.measure } : {}),
        qld_lg_unit: QLD_LG_UNIT,
        ...(spec.componentOf ? { qld_lg_component_of: spec.componentOf } : {}),
      });
    }
  });

  return { records, skipped, councils: councils.size, years: years.size };
}

export function parseQldLocalGovernmentRoadDataCsv(
  csvText: string,
  sourceUrl = QLD_LG_ROAD_RESOURCE_URL,
): QldLgParseResult {
  const rows = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, unknown>[];

  if (rows.length === 0) throw new Error('QLD local government Road Data CSV is empty');
  const headers = new Set(Object.keys(rows[0]!));
  for (const required of ['Council Name', 'Year']) {
    if (!headers.has(required)) {
      throw new Error(`QLD local government Road Data CSV is missing column ${required}`);
    }
  }
  for (const spec of QLD_LG_ROAD_MEASURES) {
    if (!headers.has(spec.column)) {
      throw new Error(`QLD local government Road Data CSV is missing column ${spec.column}`);
    }
  }

  const records: SpendingRecord[] = [];
  const skipped: QldLgSkip[] = [];
  const seen = new Set<string>();
  const councils = new Set<string>();
  const years = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const council = clean(row['Council Name']);
    const year = fiscalYear(clean(row['Year']));
    if (!council) {
      skipped.push({ row: rowNumber, reason: 'missing Council Name' });
      return;
    }
    if (!year) {
      skipped.push({ row: rowNumber, reason: 'invalid Year' });
      return;
    }

    for (const spec of QLD_LG_ROAD_MEASURES) {
      const value = parseThousands(row[spec.column]);
      if (value === null) continue;
      if (value < 0) {
        skipped.push({ row: rowNumber, reason: `negative ${spec.measure}; not ingested` });
        continue;
      }
      const naturalKey = qldLgNaturalKey({
        council,
        fiscal_year: year,
        measure: spec.measure,
      });
      if (seen.has(naturalKey)) {
        skipped.push({ row: rowNumber, reason: `duplicate ${spec.measure}` });
        continue;
      }
      seen.add(naturalKey);
      councils.add(council);
      years.add(year);
      records.push({
        amount_cents: qldLgThousandsToCents(value),
        measure_type: 'actual',
        fiscal_year: year,
        source_id: QLD_LG_ID,
        source_url: sourceUrl,
        verified: false,
        natural_key: naturalKey,
        project_name: council,
        description: spec.label,
        jurisdiction_level: 'local',
        jurisdiction: 'QLD',
        delivery_entity: council,
        funding_source: 'Queensland local government',
        source_dataset: QLD_LG_ROAD_DATASET,
        data_quality_flag: 'provisional',
        aggregation_role: 'agency_detail',
        extraction_confidence: 'high',
        location: { state: 'QLD', lga_name: council },
        notes: `${QLD_LG_ROAD_CAVEAT} Printed column: ${spec.column}. ${
          spec.componentOf
            ? `Component of ${spec.componentOf}; never added to it.`
            : 'Printed council-year road expenditure; not a cross-council total.'
        }`,
        category: spec.measure,
        qld_lg_unit: QLD_LG_UNIT,
        ...(spec.componentOf ? { qld_lg_component_of: spec.componentOf } : {}),
      });
    }
  });

  return { records, skipped, councils: councils.size, years: years.size };
}

// ---------------------------------------------------------------------------
// CKAN discovery
// ---------------------------------------------------------------------------

export interface QldCkanResource {
  name: string;
  format: string;
  url: string;
}

export interface QldCkanPackage {
  name: string;
  title: string;
  resources: QldCkanResource[];
}

export function selectFinancialInputsResource(pkg: QldCkanPackage): QldCkanResource {
  const resource = pkg.resources.find(
    (entry) =>
      entry.format.toLowerCase() === 'csv' && entry.name.toLowerCase().includes('financial inputs'),
  );
  if (!resource) {
    throw new Error('QLD comparative-information package has no Financial Inputs CSV');
  }
  return resource;
}

export function selectRoadDataResource(pkg: QldCkanPackage): QldCkanResource {
  const resource = pkg.resources.find(
    (entry) =>
      entry.format.toLowerCase() === 'csv' && entry.name.toLowerCase().includes('road data'),
  );
  if (!resource) {
    throw new Error('QLD comparative-information package has no Road Data CSV');
  }
  return resource;
}

export interface QldLocalGovernmentDiscovery {
  pkg: QldCkanPackage;
  /** Backwards-compatible alias for the Financial Inputs resource. */
  resource: QldCkanResource;
  financialInputs: QldCkanResource;
  roadData: QldCkanResource;
}

export async function discoverQldLocalGovernment(
  fetchImpl: typeof fetch,
): Promise<QldLocalGovernmentDiscovery> {
  const response = await fetchImpl(
    `${QLD_LG_CKAN_BASE}/package_show?id=${encodeURIComponent(QLD_LG_PACKAGE)}`,
    {
      redirect: 'follow',
      headers: {
        'user-agent':
          'ausspend/0.1 (Australian public spending explorer; contact: ausspend-dev@example.invalid)',
        accept: 'application/json',
      },
    },
  );
  if (!response.ok) throw new Error(`QLD CKAN HTTP ${response.status}`);
  const body = (await response.json()) as { result?: QldCkanPackage };
  if (!body.result) throw new Error('QLD CKAN package_show returned no result');
  const financialInputs = selectFinancialInputsResource(body.result);
  const roadData = selectRoadDataResource(body.result);
  return { pkg: body.result, resource: financialInputs, financialInputs, roadData };
}

export interface QldLocalGovernmentOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override for the Financial Inputs CSV; skips CKAN/network for that resource. */
  financialInputsCsvText?: string;
  /** Test/CLI override for the Road Data CSV; skips CKAN/network for that resource. */
  roadDataCsvText?: string;
  /** Legacy alias for Financial Inputs only (existing tests/backfills). */
  csvText?: string;
}

const QLD_LG_HEADERS = {
  'user-agent':
    'ausspend/0.1 (Australian public spending explorer; contact: ausspend-dev@example.invalid)',
  accept: 'text/csv,application/csv,text/plain;q=0.9,*/*;q=0.8',
} as const;

/** Build the live QLD local-government comparative-information connector. */
export function createQldLocalGovernmentConnector(
  options: QldLocalGovernmentOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };

  const connector: Connector = {
    id: QLD_LG_ID,
    name: QLD_LG_NAME,
    publisher: QLD_LG_PUBLISHER,
    source_url: QLD_LG_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: QLD_LG_LICENSE,
    notes:
      'QLD local government comparative information report (data.qld.gov.au CKAN), Financial Inputs and Road Data CSVs. Council-level actual reported $’000 financial inputs across the printed income/expense/balance-sheet columns, plus the printed $’000 road capital, maintenance, bridge/culvert and depreciation expenditure columns. Non-financial road kilometres, bridge/culvert counts and areas, asset replacement/written-down values and valuation years are not spending and are not ingested. Components are components of their printed totals and never added to them. This source is separate from QGIP project grants/procurement and is never summed across councils, years or measures.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      let financialText = options.financialInputsCsvText ?? options.csvText;
      let roadText = options.roadDataCsvText;
      let financialUrl = QLD_LG_RESOURCE_URL;
      let roadUrl = QLD_LG_ROAD_RESOURCE_URL;
      const legacyFinancialOnly = Boolean(
        options.csvText && !options.financialInputsCsvText && !options.roadDataCsvText,
      );

      const download = async (
        url: string,
        title: string,
        filename: string,
        note: string,
      ): Promise<string> => {
        const response = await fetchImpl(url, {
          redirect: 'follow',
          headers: QLD_LG_HEADERS,
        });
        if (!response.ok)
          throw new Error(`QLD local government CSV HTTP ${response.status} for ${url}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const now = options.now?.() ?? new Date();
        const record = await archiveSourceDocument({
          source_id: QLD_LG_ID,
          title,
          original_url: url,
          retrieved_from: url,
          archived_from: 'direct',
          filename,
          content_type: 'text/csv',
          data: bytes,
          root: options.archiveRoot,
          fetched_at: now,
          notes: note,
        });
        await verifySourceDocument(record);
        return decodeCsvBytes(bytes);
      };

      if (legacyFinancialOnly) {
        roadText = undefined;
      } else if (!financialText || !roadText) {
        const discovery = await discoverQldLocalGovernment(fetchImpl);
        financialUrl = discovery.financialInputs.url;
        roadUrl = discovery.roadData.url;
        if (!financialText) {
          financialText = await download(
            financialUrl,
            'QLD local government comparative information — Financial Inputs',
            'qld-local-government-financial-inputs.csv',
            'Official QLD local government comparative-information Financial Inputs CSV, archived with SHA-256 outside the repo. CC BY 4.0.',
          );
        }
        if (!roadText) {
          roadText = await download(
            roadUrl,
            'QLD local government comparative information — Road Data',
            'qld-local-government-road-data.csv',
            'Official QLD local government comparative-information Road Data CSV, archived with SHA-256 outside the repo. CC BY 4.0.',
          );
        }
      }

      if (!financialText)
        throw new Error('QLD local government Financial Inputs CSV text is missing');
      const financial = parseQldLocalGovernmentCsv(financialText, financialUrl);
      const road = roadText
        ? parseQldLocalGovernmentRoadDataCsv(roadText, roadUrl)
        : { records: [], skipped: [], councils: 0, years: 0 };

      for (const [label, parsed] of [
        ['Financial Inputs', financial],
        ['Road Data', road],
      ] as const) {
        if (parsed.skipped.length > 0) {
          metadata.warnings.push(
            `${parsed.skipped.length} QLD local government ${label} row/measure(s) skipped: ${parsed.skipped
              .slice(0, 5)
              .map((skip) => `row ${skip.row}: ${skip.reason}`)
              .join('; ')}`,
          );
        }
      }

      return [
        {
          kind: 'qld-local-government-records',
          records: [...financial.records, ...road.records],
        },
      ];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const entry = raw.find(
        (value) => value.kind === 'qld-local-government-records' && Array.isArray(value.records),
      );
      if (!entry) {
        metadata.errors.push('QLD local government fetch returned no parsed records');
        return [];
      }
      return (entry.records as SpendingRecord[]).slice();
    },
    metadata,
  };

  return connector;
}
