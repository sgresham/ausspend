import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { SpendingRecord } from '@ausspend/shared';
import { extractPdf } from './pdf-extract.js';
import { fetchPdfHeadless } from './soc/nsw/headless.js';
import { archiveSourceDocument, type ArchivedSourceRecord } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Northern Territory Budget 2026-27 — COFOG-A capital works.
 *
 * Budget Paper No. 4 (The Infrastructure Program), Table 3 publishes the
 * 2026-27 capital works program by Classification of the Functions of
 * Government – Australia (COFOG-A) categories, in $ million, with a printed
 * total. It is the usable COFOG-A expenditure table in the NT budget papers.
 *
 * The NT budget site is behind a Cloudflare challenge for plain HTTP clients,
 * so the PDF is retrieved through the documented headless-browser path. The
 * exact bytes are archived outside the repo and hash-verified; the table is
 * parsed from the PDF text, not from an image or manual transcription.
 *
 * Mapping: the ten published COFOG-A category labels are mapped to COFOG
 * divisions by name. Transport and the residual "Economic affairs" category are
 * both COFOG division 04 (Economic affairs); they remain separate published
 * rows, so grouping them to 04 does not double count. No label is invented.
 */

export const NT_BUDGET_ID = 'nt-budget';
export const NT_BUDGET_NAME = 'Northern Territory Budget — COFOG-A capital works';
export const NT_BUDGET_PUBLISHER = 'Northern Territory Treasury';
export const NT_BUDGET_DATASET = '2026-27 Budget Paper No. 4 — The Infrastructure Program';
export const NT_BUDGET_PAPERS_URL = 'https://budget.nt.gov.au/budget-papers';
export const NT_BUDGET_SOURCE_URL =
  'https://budget.nt.gov.au/__data/assets/pdf_file/0004/1609249/2026-27-budget-bp4.pdf';
export const NT_BUDGET_FILENAME = '2026-27-budget-bp4.pdf';
export const NT_BUDGET_EXPECTED_SHA256 =
  'd128f1d8077ed04df1ca5458d31aa59d9fcb2072135d0c73b95f902b515efacd';
export const NT_BUDGET_EXPECTED_BYTES = 493_573;
export const NT_BUDGET_SOURCE_DATE = '2026-06';
export const NT_BUDGET_FISCAL_YEAR = '2026-27';
export const NT_BUDGET_LICENSE =
  'Northern Territory Government budget papers — Crown copyright; derived rows only, PDF not redistributed.';
export const NT_BUDGET_ATTRIBUTION =
  'Northern Territory Government — 2026-27 Budget Paper No. 4, The Infrastructure Program.';
export const NT_BUDGET_UNIT = 'AUD_millions';
export const NT_BUDGET_UNIT_LABEL = '$ million';
export const NT_BUDGET_UNIT_TO_CENTS = 100_000_000;
export const NT_BUDGET_JURISDICTION = 'NT';
export const NT_BUDGET_TABLE = 'Table 3: Capital works by COFOG-A category 2026-27';
export const NT_BUDGET_RECONCILIATION_TOLERANCE = 0.1;
export const NT_BUDGET_CAVEAT =
  'NT Government 2026-27 budget capital works by COFOG-A category, in $ million. Budget measure, not actual expenditure; statewide/territory-wide only. The published TOTAL GENERAL GOVERNMENT row is used only for reconciliation and is never emitted. No cross-source total; the ten category rows are the published table components.';

export interface NtCofogCategory {
  label: string;
  cofog: string;
}

/** Published COFOG-A category labels -> COFOG division. */
export const NT_COFOG_CATEGORIES: readonly NtCofogCategory[] = [
  { label: 'Transport', cofog: '04' },
  { label: 'Housing and community amenities', cofog: '06' },
  { label: 'Economic affairs', cofog: '04' },
  { label: 'Public order and safety', cofog: '03' },
  { label: 'Education', cofog: '09' },
  { label: 'Social protection', cofog: '10' },
  { label: 'Health', cofog: '07' },
  { label: 'Recreation, culture and religion', cofog: '08' },
  { label: 'Environmental protection', cofog: '05' },
  { label: 'General public services', cofog: '01' },
];

export interface NtCofogRow {
  label: string;
  cofog: string;
  amount_millions: number;
  percent: number;
}

export interface NtBudgetParsed {
  rows: NtCofogRow[];
  records: SpendingRecord[];
  total_millions: number;
  total_percent: number;
  unit: string;
  reconciled: {
    amount_sum: number;
    amount_difference: number;
    percent_sum: number;
    percent_difference: number;
  };
}

export function ntBudgetNaturalKey(parts: {
  fiscal_year: string;
  category: string;
  cofog: string;
}): string {
  const digest = createHash('sha256')
    .update([NT_BUDGET_ID, parts.fiscal_year, parts.category, parts.cofog].join('|'))
    .digest('hex');
  return `${NT_BUDGET_ID}:${digest}`;
}

export function ntMillionsToCents(millions: number): number {
  const cents = Math.round(millions * NT_BUDGET_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`NT budget amount ${millions} $m is outside the safe integer cent range`);
  }
  return cents;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAmount(text: string): number {
  return Number(text.replace(/\s+/g, '').replace(/,/g, ''));
}

/** Detect the table unit from the published header. */
export function detectNtBudgetUnit(text: string): string {
  if (/\$\s*M\b/.test(text) || /\$\s*million/i.test(text)) return NT_BUDGET_UNIT;
  throw new Error('NT budget COFOG-A table has no explicit $M / $ million unit');
}

export function parseNtCofogText(text: string): NtBudgetParsed {
  const start = text.indexOf('Table 3: Capital works by COFOG');
  if (start < 0) throw new Error('NT budget COFOG-A Table 3 was not found');
  const endMarker = 'TOTAL GENERAL GOVERNMENT';
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error('NT budget COFOG-A TOTAL GENERAL GOVERNMENT row was not found');
  const section = text.slice(start, end + endMarker.length + 200);
  const unit = detectNtBudgetUnit(section);

  const rows: NtCofogRow[] = [];
  for (const category of NT_COFOG_CATEGORIES) {
    const re = new RegExp(`${escapeRegex(category.label)}\\s+([\\d ]+\\.\\d)\\s+([\\d.]+)`, 'i');
    const match = re.exec(section);
    if (!match) {
      throw new Error(`NT budget COFOG-A row not found: ${category.label}`);
    }
    const amount = parseAmount(match[1]!);
    const percent = Number(match[2]);
    if (!Number.isFinite(amount) || !Number.isFinite(percent)) {
      throw new Error(`NT budget COFOG-A row is not numeric: ${category.label}`);
    }
    rows.push({ label: category.label, cofog: category.cofog, amount_millions: amount, percent });
  }

  const totalMatch = /TOTAL GENERAL GOVERNMENT\s+([\d ]+\.\d)\s+([\d.]+)/i.exec(section);
  if (!totalMatch) throw new Error('NT budget COFOG-A total row is not numeric');
  const totalMillions = parseAmount(totalMatch[1]!);
  const totalPercent = Number(totalMatch[2]);
  const amountSum = rows.reduce((sum, row) => sum + row.amount_millions, 0);
  const percentSum = rows.reduce((sum, row) => sum + row.percent, 0);
  const amountDifference = Math.abs(amountSum - totalMillions);
  const percentDifference = Math.abs(percentSum - totalPercent);
  if (amountDifference > NT_BUDGET_RECONCILIATION_TOLERANCE) {
    throw new Error(
      `NT budget COFOG-A categories sum to ${amountSum} $m, printed total is ${totalMillions} $m`,
    );
  }
  if (percentDifference > NT_BUDGET_RECONCILIATION_TOLERANCE) {
    throw new Error(
      `NT budget COFOG-A percentages sum to ${percentSum}, printed total is ${totalPercent}`,
    );
  }

  const records = rows.map((row): SpendingRecord => ({
    amount_cents: ntMillionsToCents(row.amount_millions),
    measure_type: 'budget',
    fiscal_year: NT_BUDGET_FISCAL_YEAR,
    source_id: NT_BUDGET_ID,
    source_url: NT_BUDGET_SOURCE_URL,
    verified: false,
    natural_key: ntBudgetNaturalKey({
      fiscal_year: NT_BUDGET_FISCAL_YEAR,
      category: row.label,
      cofog: row.cofog,
    }),
    description: `${row.label} — capital works (${NT_BUDGET_FISCAL_YEAR} Budget)`,
    jurisdiction_level: 'territory',
    jurisdiction: NT_BUDGET_JURISDICTION,
    delivery_entity: 'Northern Territory Government',
    funding_source: 'Northern Territory Government',
    source_dataset: NT_BUDGET_DATASET,
    source_date: NT_BUDGET_SOURCE_DATE,
    data_quality_flag: 'provisional',
    aggregation_role: 'additive',
    extraction_confidence: 'medium',
    location: { state: NT_BUDGET_JURISDICTION },
    statement: 'capital',
    gfs_flow: 'expense',
    notes: `${NT_BUDGET_CAVEAT} Source: ${NT_BUDGET_DATASET}, ${NT_BUDGET_TABLE}. Unit ${NT_BUDGET_UNIT_LABEL}. Published percentage share ${row.percent}%.`,
    function_code: row.cofog,
    nt_cofog_category: row.label,
    nt_unit: unit,
    nt_percent_share: row.percent,
    nt_table: NT_BUDGET_TABLE,
  }));

  return {
    rows,
    records,
    total_millions: totalMillions,
    total_percent: totalPercent,
    unit,
    reconciled: {
      amount_sum: amountSum,
      amount_difference: amountDifference,
      percent_sum: percentSum,
      percent_difference: percentDifference,
    },
  };
}

export function assertNtBudgetPremise(parsed: NtBudgetParsed): void {
  if (parsed.rows.length !== NT_COFOG_CATEGORIES.length) {
    throw new Error(`NT budget parsed ${parsed.rows.length} COFOG-A rows, expected 10`);
  }
  if (parsed.reconciled.amount_difference > NT_BUDGET_RECONCILIATION_TOLERANCE) {
    throw new Error('NT budget COFOG-A table does not reconcile to its printed total');
  }
  for (const record of parsed.records) {
    if (record.measure_type !== 'budget') {
      throw new Error(`NT budget row ${record.natural_key} is not budget`);
    }
    if (record.jurisdiction_level !== 'territory' || record.jurisdiction !== 'NT') {
      throw new Error(`NT budget row ${record.natural_key} has the wrong jurisdiction`);
    }
    if (!record.function_code) {
      throw new Error(`NT budget row ${record.natural_key} has no COFOG-A function`);
    }
    if (record.extraction_confidence !== 'medium' || record.data_quality_flag !== 'provisional') {
      throw new Error(`NT budget row ${record.natural_key} lacks provisional/medium confidence`);
    }
  }
}

export interface NtBudgetConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Test/CLI override: parse this PDF text without a network call. */
  text?: string;
  /** Test/CLI override: use this exact PDF instead of the network. */
  pdfPath?: string;
}

export interface NtBudgetLoadedSource {
  records: SpendingRecord[];
  parsed: NtBudgetParsed;
  archive?: ArchivedSourceRecord;
  warnings: string[];
}

async function loadPdfBytes(options: NtBudgetConnectorOptions): Promise<Buffer> {
  if (options.pdfPath) return readFile(options.pdfPath);
  return fetchPdfHeadless(NT_BUDGET_SOURCE_URL, NT_BUDGET_PAPERS_URL);
}

export async function loadNtBudgetSource(
  options: NtBudgetConnectorOptions = {},
): Promise<NtBudgetLoadedSource> {
  let text = options.text;
  let archive: ArchivedSourceRecord | undefined;
  if (!text) {
    const bytes = await loadPdfBytes(options);
    if (!options.pdfPath) {
      const sha = createHash('sha256').update(bytes).digest('hex');
      if (sha !== NT_BUDGET_EXPECTED_SHA256) {
        throw new Error(`NT budget PDF SHA-256 ${sha} does not match ${NT_BUDGET_EXPECTED_SHA256}`);
      }
      if (bytes.length !== NT_BUDGET_EXPECTED_BYTES) {
        throw new Error(
          `NT budget PDF is ${bytes.length} bytes, expected ${NT_BUDGET_EXPECTED_BYTES}`,
        );
      }
    }
    archive = await archiveSourceDocument({
      source_id: NT_BUDGET_ID,
      title: `${NT_BUDGET_DATASET} — ${NT_BUDGET_TABLE}`,
      original_url: NT_BUDGET_SOURCE_URL,
      retrieved_from: NT_BUDGET_SOURCE_URL,
      archived_from: 'direct',
      filename: NT_BUDGET_FILENAME,
      content_type: 'application/pdf',
      data: bytes,
      ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
      notes:
        `Official NT budget papers page: ${NT_BUDGET_PAPERS_URL}. Retrieved through the documented headless-browser path. ` +
        'Crown copyright; PDF archived outside the repo and not redistributed; only derived rows are emitted.',
    });
    text = (await extractPdf(bytes)).text;
  }
  const parsed = parseNtCofogText(text);
  assertNtBudgetPremise(parsed);
  return {
    records: parsed.records,
    parsed,
    ...(archive ? { archive } : {}),
    warnings: [
      `table=${NT_BUDGET_TABLE} rows=${parsed.rows.length} unit=${parsed.unit}`,
      `amount_sum=${parsed.reconciled.amount_sum} total=${parsed.total_millions} diff=${parsed.reconciled.amount_difference}`,
      `percent_sum=${parsed.reconciled.percent_sum} total=${parsed.total_percent} diff=${parsed.reconciled.percent_difference}`,
    ],
  };
}

export interface NtBudgetManifest {
  dataset: string;
  source_url: string;
  papers_url: string;
  source_date: string;
  fiscal_year: string;
  license: string;
  attribution: string;
  caveat: string;
  unit: string;
  unit_label: string;
  table: string;
  rows_emitted: number;
  amount_sum_millions: number;
  printed_total_millions: number;
  amount_difference: number;
  percent_sum: number;
  printed_percent: number;
  percent_difference: number;
  categories: NtCofogRow[];
  sha256?: string;
  bytes?: number;
  notes: string;
}

export function ntBudgetManifest(
  loaded: NtBudgetLoadedSource,
  archive?: Pick<ArchivedSourceRecord, 'sha256' | 'bytes'>,
): NtBudgetManifest {
  return {
    dataset: NT_BUDGET_DATASET,
    source_url: NT_BUDGET_SOURCE_URL,
    papers_url: NT_BUDGET_PAPERS_URL,
    source_date: NT_BUDGET_SOURCE_DATE,
    fiscal_year: NT_BUDGET_FISCAL_YEAR,
    license: NT_BUDGET_LICENSE,
    attribution: NT_BUDGET_ATTRIBUTION,
    caveat: NT_BUDGET_CAVEAT,
    unit: NT_BUDGET_UNIT,
    unit_label: NT_BUDGET_UNIT_LABEL,
    table: NT_BUDGET_TABLE,
    rows_emitted: loaded.records.length,
    amount_sum_millions: loaded.parsed.reconciled.amount_sum,
    printed_total_millions: loaded.parsed.total_millions,
    amount_difference: loaded.parsed.reconciled.amount_difference,
    percent_sum: loaded.parsed.reconciled.percent_sum,
    printed_percent: loaded.parsed.total_percent,
    percent_difference: loaded.parsed.reconciled.percent_difference,
    categories: loaded.parsed.rows,
    ...(archive ? { sha256: archive.sha256, bytes: archive.bytes } : {}),
    notes:
      'Derived COFOG-A rows only; the PDF is not redistributed. The printed TOTAL GENERAL GOVERNMENT row is reconciliation-only and never emitted. No cross-source total.',
  };
}

export function createNtBudgetConnector(options: NtBudgetConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'headless' as const,
  };
  return {
    id: NT_BUDGET_ID,
    name: NT_BUDGET_NAME,
    publisher: NT_BUDGET_PUBLISHER,
    source_url: NT_BUDGET_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'territory',
    license: NT_BUDGET_LICENSE,
    notes: `${NT_BUDGET_CAVEAT} ${NT_BUDGET_ATTRIBUTION}`,
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const loaded = await loadNtBudgetSource(options);
      metadata.warnings = loaded.warnings;
      return loaded.records as unknown as RawRecord[];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      return raw.filter((entry) => entry.source_id === NT_BUDGET_ID) as unknown as SpendingRecord[];
    },
    metadata,
  };
}
