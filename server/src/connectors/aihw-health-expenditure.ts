import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import type { SpendingRecord } from '@ausspend/shared';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * AIHW Health Expenditure (Phase 6.2).
 *
 * Source gate and premise test:
 * - AIHW's metadata registry METEOR is metadata-only: its homepage states
 *   "METEOR does not contain any data, reports or statistical information" and
 *   it only serves data-element/indicator metadata. It therefore cannot provide
 *   the required financial-year x state x area x funding-source expenditure
 *   matrix.
 * - The fallback is the official AIHW "health expenditure by area and source"
 *   CSV published on data.gov.au (CKAN) under the AIHW organisation. It is the
 *   AIHW Health Expenditure Database's state/area/source matrix, in constant
 *   (real) millions, from the 2011-12 release. The data.gov.au package notes it
 *   has been superseded by later AIHW releases, so the source is live but its
 *   time coverage ends at 2011-12; that is recorded on the source and in the
 *   row notes rather than guessed forward.
 *
 * Mapping:
 * - one measure per financial_year x state x area_of_expenditure x
 *   broad_source_of_funding x detailed_source_of_funding;
 * - `measure_type: actual`, `function_code: '07'` (COFOG Health);
 * - `amount_cents` from real_expenditure_millions, 1 million = 100,000,000
 *   cents. The 122 negative values (mostly the medical-expense tax rebate) are
 *   stored as non-negative magnitudes with `aihw_printed_sign: 'negative'`.
 * - Government and Non-government are distinct series. Australian Government
 *   rows are jurisdiction_level "federal"/jurisdiction "Australia"; State and
 *   local rows are "state"/the state code; non-government rows are
 *   "other"/the state code (geography only). Every row is agency_detail, so no
 *   total can be computed; `potential_double_count` is true on government rows
 *   because the same service can be funded through both levels and the AIHW
 *   state totals include Commonwealth transfers. The API never sums them.
 */

export const AIHW_ID = 'aihw-health-expenditure';
export const AIHW_NAME = 'Health Expenditure Australia';
export const AIHW_PUBLISHER = 'Australian Institute of Health and Welfare';
export const AIHW_DATASET = 'AIHW Health Expenditure Database';
export const AIHW_SOURCE_URL = 'https://data.gov.au/data/dataset/health-expenditure-in-australia';
export const AIHW_RESOURCE_URL =
  'https://data.gov.au/data/dataset/f84b9baf-c1c1-437c-8c1e-654b2829848c/resource/88399d53-d55c-466c-8f4a-6cb965d24d6d/download/healthexpenditurebyareaandsource.csv';
export const AIHW_LICENSE = 'Creative Commons Attribution 3.0 Australia';
export const AIHW_UNIT = 'AUD_millions';
export const AIHW_UNIT_LABEL = '$m (real, constant 2011-12 prices)';
export const AIHW_UNIT_TO_CENTS = 100_000_000;
export const AIHW_FUNCTION_CODE = '07';
export const AIHW_CAVEAT =
  'AIHW real (constant 2011-12 prices) health expenditure by state, area and funding source. Government and Non-government are separate funding series and are never summed. Australian Government and State and local rows may describe the same services (and state totals include Commonwealth transfers), so every row is non-additive agency detail with potential_double_count on government rows. Do not present total health expenditure as government spending.';

export const AIHW_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
export type AihwState = (typeof AIHW_STATES)[number];

const STATE_SET = new Set<string>(AIHW_STATES);

export interface AihwSourceRule {
  broad: 'Government' | 'Non-government';
  jurisdiction_level: 'federal' | 'state' | 'other';
  /** Federal funding is Australia-wide; all other rows use the state code. */
  fixed_jurisdiction?: string;
}

export const AIHW_DETAILED_SOURCES: Readonly<Record<string, AihwSourceRule>> = {
  'Australian Government': {
    broad: 'Government',
    jurisdiction_level: 'federal',
    fixed_jurisdiction: 'Australia',
  },
  'State and local': { broad: 'Government', jurisdiction_level: 'state' },
  Individuals: { broad: 'Non-government', jurisdiction_level: 'other' },
  'Private health insurance funds': { broad: 'Non-government', jurisdiction_level: 'other' },
  'Other non-government': { broad: 'Non-government', jurisdiction_level: 'other' },
};

export interface AihwCsvRow {
  financial_year?: string;
  state?: string;
  area_of_expenditure?: string;
  broad_source_of_funding?: string;
  detailed_source_of_funding?: string;
  real_expenditure_millions?: string;
}

export interface AihwSkip {
  /** 1-based data row (header is row 1). */
  row: number;
  reason: string;
}

export interface AihwTransformResult {
  records: SpendingRecord[];
  skipped: AihwSkip[];
  duplicates: number;
}

/** Convert a published real $m amount to integer cents without sign-flipping. */
export function aihwMillionsToCents(millions: number): number {
  const cents = Math.round(millions * AIHW_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`AIHW amount ${millions} $m is outside the safe integer cent range`);
  }
  return cents;
}

export function aihwNaturalKey(parts: {
  fiscal_year: string;
  state: string;
  area: string;
  broad: string;
  detailed: string;
}): string {
  const digest = createHash('sha256')
    .update(
      [AIHW_ID, parts.fiscal_year, parts.state, parts.area, parts.broad, parts.detailed].join('|'),
    )
    .digest('hex');
  return `${AIHW_ID}:${digest}`;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseAmount(raw: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse and map the official CSV. Blank/padding rows are skipped; malformed
 * rows are reported, never guessed. A record is not silently dropped once it
 * has a valid fiscal year + state + area + funding pair.
 */
export function parseAihwCsv(csvText: string): AihwTransformResult {
  const rows = parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as AihwCsvRow[];

  const records: SpendingRecord[] = [];
  const skipped: AihwSkip[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  rows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const fiscalYear = clean(raw.financial_year);
    const state = clean(raw.state);
    const area = clean(raw.area_of_expenditure);
    const broad = clean(raw.broad_source_of_funding);
    const detailed = clean(raw.detailed_source_of_funding);
    const amountRaw = clean(raw.real_expenditure_millions);

    // Padding/trailing-comma rows in the publisher CSV.
    if (!fiscalYear && !state && !area && !broad && !detailed && !amountRaw) return;

    if (!/^\d{4}-\d{2}$/.test(fiscalYear)) {
      skipped.push({
        row: rowNumber,
        reason: `invalid financial_year ${JSON.stringify(fiscalYear)}`,
      });
      return;
    }
    if (!STATE_SET.has(state)) {
      skipped.push({ row: rowNumber, reason: `unknown state ${JSON.stringify(state)}` });
      return;
    }
    if (!area) {
      skipped.push({ row: rowNumber, reason: 'missing area_of_expenditure' });
      return;
    }
    const rule = AIHW_DETAILED_SOURCES[detailed];
    if (!rule) {
      skipped.push({
        row: rowNumber,
        reason: `unknown detailed_source_of_funding ${JSON.stringify(detailed)}`,
      });
      return;
    }
    if (broad !== rule.broad) {
      skipped.push({
        row: rowNumber,
        reason: `broad source ${JSON.stringify(broad)} does not match ${JSON.stringify(detailed)} (${rule.broad})`,
      });
      return;
    }
    const amount = parseAmount(amountRaw);
    if (amount === null) {
      skipped.push({
        row: rowNumber,
        reason: `non-numeric real_expenditure_millions ${JSON.stringify(amountRaw)}`,
      });
      return;
    }

    const naturalKey = aihwNaturalKey({
      fiscal_year: fiscalYear,
      state,
      area,
      broad,
      detailed,
    });
    if (seen.has(naturalKey)) {
      duplicates += 1;
      return;
    }
    seen.add(naturalKey);

    const sign: 'positive' | 'negative' = amount < 0 ? 'negative' : 'positive';
    const jurisdiction = rule.fixed_jurisdiction ?? state;
    const record: SpendingRecord = {
      function_code: AIHW_FUNCTION_CODE,
      amount_cents: aihwMillionsToCents(Math.abs(amount)),
      measure_type: 'actual',
      fiscal_year: fiscalYear,
      source_id: AIHW_ID,
      source_url: AIHW_RESOURCE_URL,
      verified: true,
      natural_key: naturalKey,
      description: `${area} — ${broad} funding: ${detailed}`,
      jurisdiction_level: rule.jurisdiction_level,
      jurisdiction,
      funding_source: detailed,
      source_dataset: AIHW_DATASET,
      data_quality_flag: 'verified',
      aggregation_role: 'agency_detail',
      location: { state },
      notes: AIHW_CAVEAT,
      potential_double_count: broad === 'Government',
      aihw_broad_source_of_funding: broad,
      aihw_area_of_expenditure: area,
      aihw_unit: AIHW_UNIT,
      ...(sign === 'negative' ? { aihw_printed_sign: sign } : {}),
    };
    records.push(record);
  });

  return { records, skipped, duplicates };
}

export interface AihwConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; skips the network and uses this CSV text. */
  csvText?: string;
}

const BROWSER_HEADERS = {
  'user-agent':
    'ausspend/0.1 (Australian public spending explorer; contact: ausspend-dev@example.invalid)',
  accept: 'text/csv,application/csv,text/plain;q=0.9,*/*;q=0.8',
} as const;

function archivedRow(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value;
}

/** Build the live AIHW CSV connector. */
export function createAihwHealthExpenditureConnector(
  options: AihwConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };

  let archived: ArchivedSourceRecord | null = null;

  const connector: Connector = {
    id: AIHW_ID,
    name: AIHW_NAME,
    publisher: AIHW_PUBLISHER,
    source_url: AIHW_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'federal',
    license: AIHW_LICENSE,
    notes:
      'AIHW Health Expenditure Database state/area/funding-source matrix. METEOR is metadata-only (it contains no data), so the connector uses the official AIHW CSV published on data.gov.au. Amounts are real (constant 2011-12 prices) AUD millions; government and non-government are separate series, and every row is non-additive agency detail. The data.gov.au package ends at 2011-12 and is documented as superseded; no later year is extrapolated.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      let csvText = options.csvText;
      if (!csvText) {
        const response = await fetchImpl(AIHW_RESOURCE_URL, {
          redirect: 'follow',
          headers: BROWSER_HEADERS,
        });
        if (!response.ok) {
          throw new Error(
            `AIHW health-expenditure CSV HTTP ${response.status} for ${AIHW_RESOURCE_URL}`,
          );
        }
        csvText = await response.text();
        const now = options.now?.() ?? new Date();
        archived = await archiveSourceDocument({
          source_id: AIHW_ID,
          title: 'AIHW health expenditure by area and source',
          original_url: AIHW_RESOURCE_URL,
          retrieved_from: AIHW_RESOURCE_URL,
          archived_from: 'direct',
          filename: 'aihw-health-expenditure-by-area-and-source.csv',
          content_type: 'text/csv',
          data: csvText,
          root: options.archiveRoot,
          fetched_at: now,
          notes:
            'Official AIHW health-expenditure-by-area-and-source CSV, archived with SHA-256 outside the repo. Real/constant 2011-12 prices; superseded data.gov.au package.',
        });
        await verifySourceDocument(archived);
      }
      return [{ kind: 'aihw-health-expenditure-csv', csv: csvText, archived }];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const entry = raw.find(
        (value) => value.kind === 'aihw-health-expenditure-csv' && typeof value.csv === 'string',
      );
      const csvText = archivedRow(entry?.csv);
      if (!csvText) {
        metadata.errors.push('AIHW fetch returned no CSV text');
        return [];
      }
      const parsed = parseAihwCsv(csvText);
      if (parsed.skipped.length > 0) {
        const sample = parsed.skipped
          .slice(0, 5)
          .map((skip) => `row ${skip.row}: ${skip.reason}`)
          .join('; ');
        metadata.warnings.push(
          `${parsed.skipped.length} AIHW row(s) skipped (blank padding is ignored): ${sample}`,
        );
      }
      if (parsed.duplicates > 0) {
        metadata.warnings.push(
          `${parsed.duplicates} duplicate AIHW row(s) collapsed by natural key`,
        );
      }
      if (parsed.records.length === 0) {
        metadata.errors.push('AIHW CSV produced no valid health-expenditure rows');
      }
      return parsed.records;
    },
    metadata,
  };

  return connector;
}
