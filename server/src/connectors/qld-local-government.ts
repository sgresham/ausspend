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
export const QLD_LG_NAME = 'Queensland local government comparative information — financial inputs';
export const QLD_LG_PUBLISHER = 'Queensland Department of Local Government, Water and Volunteers';
export const QLD_LG_SOURCE_URL =
  'https://www.data.qld.gov.au/dataset/queensland-local-government-comparative-information-report';
export const QLD_LG_RESOURCE_URL =
  'https://www.data.qld.gov.au/dataset/c7c0c31e-a844-480d-bfbe-4b689179a5cf/resource/2dd25c9b-cc5b-4c81-876f-97d277e88889/download/qld-local-government-comparative-information-report-cdc-financial-inputs.csv';
export const QLD_LG_LICENSE = 'Creative Commons Attribution 4.0 International (CC BY 4.0)';
export const QLD_LG_DATASET =
  'Queensland local government comparative information report — Financial Inputs';
export const QLD_LG_UNIT = 'AUD_thousands';
export const QLD_LG_UNIT_LABEL = "$'000";
export const QLD_LG_UNIT_TO_CENTS = 100_000;
export const QLD_LG_CAVEAT =
  'Council-level financial inputs from the Queensland local government comparative information report, actual reported values in $’000. These are not QGIP project grants or procurement. Every row is agency_detail and non-additive: never sum across councils, years or measures, and never add to QGIP.';

export const QLD_LG_CKAN_BASE = 'https://www.data.qld.gov.au/api/3/action';
export const QLD_LG_PACKAGE = 'queensland-local-government-comparative-information-report';

const TOTAL_OLD = "Total operating expenses before interest (excl unfunded depreciation) - $'000";
const TOTAL_NEW = "Total operating expenses before interest * - from 2013/14 $'000";
const EMPLOYEE = "Employee expenses - $'000";
const DEPRECIATION = "Depreciation and amortisation expense - $'000";
const INTEREST =
  "Total Interest paid (borrowing costs) to QTC and other financial institutions - $'000";

export type QldLgMeasure =
  | 'total_operating_expenses'
  | 'employee_expenses'
  | 'depreciation_amortisation'
  | 'interest_paid_borrowing_costs';

export interface QldLgMeasureSpec {
  measure: QldLgMeasure;
  label: string;
  componentOf: string | null;
}

export const QLD_LG_MEASURES: readonly QldLgMeasureSpec[] = [
  {
    measure: 'total_operating_expenses',
    label: 'Total operating expenses before interest',
    componentOf: null,
  },
  {
    measure: 'employee_expenses',
    label: 'Employee expenses',
    componentOf: 'total_operating_expenses',
  },
  {
    measure: 'depreciation_amortisation',
    label: 'Depreciation and amortisation expense',
    componentOf: 'total_operating_expenses',
  },
  {
    measure: 'interest_paid_borrowing_costs',
    label: 'Interest paid (borrowing costs)',
    componentOf: 'total_operating_expenses',
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
  for (const required of ['Local Government', 'Financial Year', TOTAL_OLD, TOTAL_NEW]) {
    if (!headers.has(required)) {
      throw new Error(`QLD local government Financial Inputs CSV is missing column ${required}`);
    }
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

    const total = parseThousands(row[TOTAL_OLD]) ?? parseThousands(row[TOTAL_NEW]);
    const componentValues: Record<string, number | null> = {
      total_operating_expenses: total,
      employee_expenses: parseThousands(row[EMPLOYEE]),
      depreciation_amortisation: parseThousands(row[DEPRECIATION]),
      interest_paid_borrowing_costs: parseThousands(row[INTEREST]),
    };

    if (total !== null) {
      const componentSum = QLD_LG_MEASURES.filter((spec) => spec.componentOf).reduce(
        (accumulator, spec) => accumulator + (componentValues[spec.measure] ?? 0),
        0,
      );
      if (componentSum > total + 0.5) {
        throw new Error(
          `QLD local government reconciliation failed for ${council} ${year}: components ${componentSum} exceed printed total ${total}`,
        );
      }
    }

    for (const spec of QLD_LG_MEASURES) {
      const value = componentValues[spec.measure];
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
            : 'Printed total operating expenses for the council-year.'
        }`,
        qld_lg_measure: spec.measure,
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

export async function discoverQldLocalGovernment(
  fetchImpl: typeof fetch,
): Promise<{ pkg: QldCkanPackage; resource: QldCkanResource }> {
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
  return { pkg: body.result, resource: selectFinancialInputsResource(body.result) };
}

export interface QldLocalGovernmentOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override: use this CSV text and skip CKAN/network. */
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
      'QLD local government comparative information report, Financial Inputs CSV (data.qld.gov.au CKAN). Council-level actual reported dollar inputs in $’000: total operating expenses, employee expenses, depreciation/amortisation and interest paid. Components are components of the printed total and never added to it. This source is separate from QGIP project grants/procurement and is never summed across councils, years or measures.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      let csvText = options.csvText;
      let resourceUrl = QLD_LG_RESOURCE_URL;
      if (!csvText) {
        const discovery = await discoverQldLocalGovernment(fetchImpl);
        resourceUrl = discovery.resource.url;
        const response = await fetchImpl(resourceUrl, {
          redirect: 'follow',
          headers: QLD_LG_HEADERS,
        });
        if (!response.ok) {
          throw new Error(`QLD local government CSV HTTP ${response.status}`);
        }
        csvText = await response.text();
        const now = options.now?.() ?? new Date();
        const record = await archiveSourceDocument({
          source_id: QLD_LG_ID,
          title: 'QLD local government comparative information — Financial Inputs',
          original_url: resourceUrl,
          retrieved_from: resourceUrl,
          archived_from: 'direct',
          filename: 'qld-local-government-financial-inputs.csv',
          content_type: 'text/csv',
          data: csvText,
          root: options.archiveRoot,
          fetched_at: now,
          notes:
            'Official QLD local government comparative-information Financial Inputs CSV, archived with SHA-256 outside the repo. CC BY 4.0.',
        });
        await verifySourceDocument(record);
      }
      const parsed = parseQldLocalGovernmentCsv(csvText, resourceUrl);
      if (parsed.skipped.length > 0) {
        metadata.warnings.push(
          `${parsed.skipped.length} QLD local government row/measure(s) skipped: ${parsed.skipped
            .slice(0, 5)
            .map((skip) => `row ${skip.row}: ${skip.reason}`)
            .join('; ')}`,
        );
      }
      return [{ kind: 'qld-local-government-records', records: parsed.records }];
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
