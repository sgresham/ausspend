import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import { extractPdf, type ExtractedPdfTable, type PdfExtraction } from './pdf-extract.js';
import { archiveSourceDocument, verifySourceDocument } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * TAS Budget (Phase 6.7).
 *
 * The Tasmanian budget is document-heavy. Budget Paper No. 1 is a digital PDF
 * (selectable text, not a scan). It contains one COFOG-A classified expense
 * table:
 *
 *   Table 9.16: General Government Expenses from Transactions by Purpose
 *   (chapter 9, page 245), six year columns, explicit `$m`, and a printed total.
 *
 * The connector extracts exactly that table. It does not invent agency detail:
 * agency-level tables are in Budget Paper No. 2, which is outside this item.
 * COFOG mapping uses the printed category labels only; the non-COFOG
 * "Nominal interest on superannuation" line is retained as a reconciliation
 * line with no function code and flagged in its notes.
 *
 * Unit guard: the header must print `$m` for all six columns.
 * Reconciliation: the 11 printed category lines must sum to the printed total
 * for every year (rounding tolerance 0.2 $m). A mismatch fails ingestion.
 */

export const TAS_ID = 'tas-budget';
export const TAS_NAME = 'Tasmanian Budget';
export const TAS_PUBLISHER = 'Tasmanian Department of Treasury and Finance';
export const TAS_SOURCE_URL =
  'https://www.treasury.tas.gov.au/budget-and-financial-management/2026-27-tasmanian-budget';
export const TAS_BP1_PDF_URL =
  'https://www.treasury.tas.gov.au/Documents/2026-27%20Budget%20Paper%20No.%201%2c%20Budget%20Strategy%20and%20Estimates.PDF';
export const TAS_LICENSE =
  '© Government of Tasmania. Budget Paper No. 1 PDF used for public-interest research; no open-data licence statement found on the page.';
export const TAS_DATASET = '2026-27 TAS Budget Paper No. 1 — Budget Strategy and Estimates';
export const TAS_TABLE = 'Table 9.16';
export const TAS_UNIT = 'AUD_millions';
export const TAS_UNIT_LABEL = '$m';
export const TAS_UNIT_TO_CENTS = 100_000_000;
export const TAS_CAVEAT =
  '2026-27 TAS Budget Paper No. 1, Table 9.16: General Government Expenses from Transactions by Purpose, COFOG-A classified. Values are $m; the 11 printed category lines reconcile to the printed total for each year. Nominal interest on superannuation is not a COFOG function and is retained only as a printed reconciliation line. Rows are provisional benchmark aggregates; never sum across years or with other sources.';

export interface TasColumn {
  fiscal_year: string;
  measure_type: 'budget' | 'estimate';
  label: string;
}

export const TAS_COLUMNS: readonly TasColumn[] = [
  { fiscal_year: '2025-26', measure_type: 'estimate', label: '2025-26 Estimated Outcome' },
  { fiscal_year: '2025-26', measure_type: 'budget', label: '2025-26 Budget' },
  { fiscal_year: '2026-27', measure_type: 'budget', label: '2026-27 Budget' },
  { fiscal_year: '2027-28', measure_type: 'estimate', label: '2027-28 Forward Estimate' },
  { fiscal_year: '2028-29', measure_type: 'estimate', label: '2028-29 Forward Estimate' },
  { fiscal_year: '2029-30', measure_type: 'estimate', label: '2029-30 Forward Estimate' },
];

/** COFOG-A codes for the printed Table 9.16 categories. */
export const TAS_COFOG: Readonly<Record<string, string | null>> = {
  'General public services': '01',
  'Public order and safety': '03',
  'Economic affairs': '04',
  'Environmental protection': '05',
  'Housing and community amenities': '06',
  Health: '07',
  'Recreation, culture and religion': '08',
  Education: '09',
  'Social protection': '10',
  Transport: '045',
  // Not a COFOG function; printed only to reconcile to total expenses.
  'Nominal interest on superannuation': null,
};

export const TAS_CATEGORIES = Object.keys(TAS_COFOG) as readonly string[];

export function tasMoneyToCents(millions: number): number {
  const cents = Math.round(Math.abs(millions) * TAS_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`TAS amount ${millions} $m is outside the safe integer cent range`);
  }
  return cents;
}

export function tasNaturalKey(parts: {
  category: string;
  fiscal_year: string;
  measure_type: string;
  column: string;
}): string {
  const digest = createHash('sha256')
    .update(
      [TAS_ID, TAS_TABLE, parts.category, parts.fiscal_year, parts.measure_type, parts.column].join(
        '|',
      ),
    )
    .digest('hex');
  return `${TAS_ID}:${digest}`;
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseMillions(raw: string): number | null {
  let text = clean(raw).replace(/\u00a0/g, ' ');
  if (!text) return null;
  if (/^(?:\.{2,}|[-–—])$/.test(text)) return 0;
  text = text.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\s,]/g, '');
  if (/^\(.+\)$/.test(text)) text = `-${text.slice(1, -1)}`;
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  return Number(text);
}

function moneyTokens(text: string): number[] {
  const matches = text.match(/\d{1,3}(?: \d{3})*\.\d/g) ?? [];
  return matches.map((token) => Number(token.replace(/ /g, '')));
}

export interface TasCofogParseResult {
  records: SpendingRecord[];
  categories: number;
  reconciled_years: number;
  total_millions: number[];
}

/**
 * Parse the extracted Table 9.16 rows. Exported for tests; the live connector
 * calls it with the table extracted from the archived PDF.
 */
export function parseTasCofogTable(
  rows: readonly (readonly string[])[],
  pageText: string,
  sourceUrl = TAS_BP1_PDF_URL,
): TasCofogParseResult {
  const headerText = rows.slice(0, 3).flat().join(' ');
  const unitCount = (headerText.match(/\$m/g) ?? []).length;
  if (unitCount < 6) {
    throw new Error(
      `TAS Table 9.16 unit guard failed: expected six $m column headers, found ${unitCount}`,
    );
  }

  const valuesByCategory = new Map<string, number[]>();
  for (const row of rows) {
    const cells = row.map(clean).filter((cell) => cell !== '');
    if (cells.length === 0) continue;
    const label = cells[0]!;
    if (!(label in TAS_COFOG)) continue;
    const values = cells.slice(1, 7).map(parseMillions);
    if (values.length !== 6 || values.some((value) => value === null)) {
      throw new Error(`TAS Table 9.16 row ${label} does not carry six numeric $m values`);
    }
    valuesByCategory.set(label, values as number[]);
  }

  const missing = TAS_CATEGORIES.filter((category) => !valuesByCategory.has(category));
  if (missing.length > 0) {
    throw new Error(`TAS Table 9.16 is missing printed categories: ${missing.join(', ')}`);
  }

  // The extractor currently drops the unlabelled printed total row; read the
  // final six money values from the page text after the last category label.
  const marker = 'Nominal interest on superannuation';
  const markerAt = pageText.lastIndexOf(marker);
  if (markerAt < 0) throw new Error('TAS Table 9.16 page text has no printed total');
  const tail = pageText.slice(markerAt + marker.length);
  const tailValues = moneyTokens(tail);
  const total = tailValues.slice(-6);
  if (total.length !== 6) throw new Error('TAS Table 9.16 printed total has fewer than six values');

  let reconciledYears = 0;
  for (let index = 0; index < 6; index += 1) {
    const sum = TAS_CATEGORIES.reduce(
      (accumulator, category) => accumulator + (valuesByCategory.get(category)?.[index] ?? 0),
      0,
    );
    if (Math.abs(sum - total[index]!) > 0.2) {
      throw new Error(
        `TAS Table 9.16 total reconciliation failed for ${TAS_COLUMNS[index]?.label}: categories ${sum} != printed total ${total[index]}`,
      );
    }
    reconciledYears += 1;
  }

  const records: SpendingRecord[] = [];
  for (const category of TAS_CATEGORIES) {
    const values = valuesByCategory.get(category)!;
    const functionCode = TAS_COFOG[category] ?? undefined;
    for (let index = 0; index < TAS_COLUMNS.length; index += 1) {
      const column = TAS_COLUMNS[index]!;
      records.push({
        ...(functionCode ? { function_code: functionCode } : {}),
        amount_cents: tasMoneyToCents(values[index]!),
        measure_type: column.measure_type,
        fiscal_year: column.fiscal_year,
        source_id: TAS_ID,
        source_url: sourceUrl,
        verified: false,
        natural_key: tasNaturalKey({
          category,
          fiscal_year: column.fiscal_year,
          measure_type: column.measure_type,
          column: column.label,
        }),
        project_name: category,
        description: category,
        jurisdiction_level: 'state',
        jurisdiction: 'TAS',
        funding_source: 'Tasmanian Government',
        source_dataset: TAS_DATASET,
        data_quality_flag: 'provisional',
        aggregation_role: 'benchmark',
        extraction_confidence: 'high',
        location: { state: 'TAS' },
        notes: `${TAS_CAVEAT} Printed column: ${column.label}. ${
          functionCode
            ? `COFOG-A ${functionCode}.`
            : 'Non-COFOG line: not counted as a COFOG function; retained for the printed-total reconciliation only.'
        }`,
        tas_budget_table: TAS_TABLE,
        tas_budget_column: column.label,
        tas_budget_unit: TAS_UNIT,
      });
    }
  }

  return {
    records,
    categories: TAS_CATEGORIES.length,
    reconciled_years: reconciledYears,
    total_millions: total,
  };
}

/** Extract Table 9.16 from a parsed BP1 PDF. */
export function parseTasBp1(extraction: PdfExtraction): TasCofogParseResult {
  const page = extraction.pages.find(
    (entry) =>
      entry.text.includes('Table 9.16') &&
      entry.text.includes('General Government Expenses from Transactions by Purpose'),
  );
  if (!page) throw new Error('TAS BP1 PDF has no Table 9.16 page');
  const table = extraction.tables.find(
    (entry: ExtractedPdfTable) =>
      entry.page_number === page.page_number &&
      entry.rows.some((row) => row.cells.map(clean).includes('General public services')),
  );
  if (!table) throw new Error('TAS BP1 PDF has no extractable Table 9.16 rows');
  return parseTasCofogTable(
    table.rows.map((row) => row.cells),
    page.text,
    extraction.source.url ?? TAS_BP1_PDF_URL,
  );
}

export interface TasBudgetConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override: a pre-extracted PDF (avoids PDF generation in tests). */
  pdfExtraction?: PdfExtraction;
  /** Test/CLI override: exact BP1 PDF bytes. */
  pdfBuffer?: Buffer;
}

const TAS_BROWSER_HEADERS = {
  'user-agent':
    'ausspend/0.1 (Australian public spending explorer; contact: ausspend-dev@example.invalid)',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

/** Discover the current BP1 PDF from the official TAS Budget page. */
export async function discoverTasBp1(fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(TAS_SOURCE_URL, {
    redirect: 'follow',
    headers: TAS_BROWSER_HEADERS,
  });
  if (!response.ok) throw new Error(`TAS Budget page HTTP ${response.status}`);
  const html = await response.text();
  const match = /href="([^"]*Budget(?:%20|\s)+Paper(?:%20|\s)+No\.?(?:%20|\s)*1[^"]*\.PDF)"/i.exec(
    html,
  );
  if (!match) return TAS_BP1_PDF_URL;
  return new URL(match[1]!.replace(/&amp;/g, '&'), TAS_SOURCE_URL).toString();
}

async function downloadPdf(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  const response = await fetchImpl(url, { redirect: 'follow', headers: TAS_BROWSER_HEADERS });
  if (!response.ok) throw new Error(`TAS BP1 PDF HTTP ${response.status} for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.subarray(0, 4).toString('latin1') !== '%PDF') {
    throw new Error('TAS BP1 response is not a PDF');
  }
  return bytes;
}

/** Build the live TAS Budget connector. */
export function createTasBudgetConnector(options: TasBudgetConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };

  let pdfUrl = TAS_BP1_PDF_URL;

  const connector: Connector = {
    id: TAS_ID,
    name: TAS_NAME,
    publisher: TAS_PUBLISHER,
    source_url: TAS_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'state',
    license: TAS_LICENSE,
    notes:
      'TAS Budget Paper No. 1 (2026-27) digital PDF. Extracts Table 9.16 General Government Expenses from Transactions by Purpose: COFOG-A categories, six $m columns (2025-26 Estimated Outcome/Budget, 2026-27 Budget, 2027-28..2029-30 Forward Estimates) and a printed total reconciled for every year. Agency-level tables are in BP2 and are not part of this item. No COFOG mapping is invented; nominal interest on superannuation is a non-COFOG reconciliation line. Rows are provisional benchmark aggregates, never summed across years or with other sources.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      let extraction = options.pdfExtraction;
      if (!extraction) {
        let buffer = options.pdfBuffer;
        if (!buffer) {
          pdfUrl = await discoverTasBp1(fetchImpl);
          buffer = await downloadPdf(pdfUrl, fetchImpl);
          const now = options.now?.() ?? new Date();
          const record = await archiveSourceDocument({
            source_id: TAS_ID,
            title: '2026-27 TAS Budget Paper No. 1 — Budget Strategy and Estimates',
            original_url: pdfUrl,
            retrieved_from: pdfUrl,
            archived_from: 'direct',
            filename: '2026-27-tas-budget-paper-1.pdf',
            content_type: 'application/pdf',
            data: buffer,
            root: options.archiveRoot,
            fetched_at: now,
            notes:
              'TAS Budget Paper No. 1 digital PDF archived with SHA-256 outside the repo for Table 9.16 extraction. Crown copyright; public-interest research.',
          });
          await verifySourceDocument(record);
        }
        extraction = await extractPdf(buffer, { source_url: pdfUrl });
      }
      const parsed = parseTasBp1(extraction);
      metadata.warnings.push(
        `TAS Table 9.16: ${parsed.categories} categories × 6 columns, ${parsed.reconciled_years}/6 years reconciled to the printed total.`,
      );
      return [{ kind: 'tas-budget-records', records: parsed.records }];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const entry = raw.find(
        (value) => value.kind === 'tas-budget-records' && Array.isArray(value.records),
      );
      if (!entry) {
        metadata.errors.push('TAS fetch returned no parsed records');
        return [];
      }
      return (entry.records as SpendingRecord[]).slice();
    },
    metadata,
  };

  return connector;
}
