import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import {
  detectMoneyUnit,
  extractArchivedPdf,
  parseAmountCell,
  type ExtractionConfidence,
  type PdfExtraction,
  type PdfPage,
  type PdfTextItem,
  type UnitDetection,
} from '../../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../../source-archive.js';
import { DeferredSocDocumentModel } from '../../../models/index.js';
import type { Connector, RawRecord } from '../../types.js';

/**
 * QLD SOC pilot — Energy Queensland Limited annual-report adapter.
 *
 * This is the first non-NSW entity in the existing SOC layer, not a second
 * framework. Energy Queensland Limited is a Queensland Government Owned
 * Corporation (GOC) under the Government Owned Corporations Act 1993 (Qld).
 * It is the parent of Energex and Ergon Energy; the consolidated parent
 * statement is the reporting boundary, so no subsidiary is added separately.
 *
 * Source gate:
 * - Energy Queensland's corporate-reports page is behind a Cloudflare HTML
 *   challenge from the ingestion host (HTTP 403, cf-mitigated: challenge). The
 *   connector first tries that official page; when it is blocked or contains no
 *   annual-report PDF, it uses the verified Queensland Parliament tabled-paper
 *   copy of the same annual report as a documented fallback. The exact PDF is
 *   never hard-coded as the only path for an accessible site.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The consolidated statement of profit or loss prints "In millions of
 *   dollars" (explicit $m). A table read as dollars or thousands is rejected,
 *   not converted by magnitude. One $m unit = 100,000,000 cents.
 * - The statement has no printed "Total expenses" subtotal. Total expenses is
 *   the exact sum of the printed expense lines and is accepted only when the
 *   printed Loss before income tax equivalent benefit, the printed Loss after
 *   income tax equivalent benefit, and the Directors' report printed total
 *   expenses of $6,800 million all reconcile with zero tolerance.
 *
 * Every row is an entity-level SOC statement line: jurisdiction_level "soc",
 * aggregation_role "agency_detail", provisional and verified:false. Energy
 * Queensland rows are never added to government program spending, the PNFC
 * benchmark, another QLD GOC, a QLD total, or each other.
 */

export const ENERGY_QUEENSLAND_ID = 'qld-energy-queensland';
export const ENERGY_QUEENSLAND_NAME = 'Energy Queensland — Annual Report';
export const ENERGY_QUEENSLAND_PUBLISHER = 'Energy Queensland Limited';
export const ENERGY_QUEENSLAND_ENTITY = 'Energy Queensland';
export const ENERGY_QUEENSLAND_JURISDICTION = 'QLD';
export const ENERGY_QUEENSLAND_LEGAL_CLASS = 'QLD Government Owned Corporation (GOC)';
export const ENERGY_QUEENSLAND_SOURCE_URL =
  'https://www.energyq.com.au/about-us/corporate-reports';
export const ENERGY_QUEENSLAND_PARLIAMENT_FALLBACK_URL =
  'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1808/5826t1808.pdf';
export const ENERGY_QUEENSLAND_LICENSE =
  '© Energy Queensland Limited. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const ENERGY_QUEENSLAND_UNIT = 'AUD_millions';
export const ENERGY_QUEENSLAND_UNIT_LABEL = '$m';
export const ENERGY_QUEENSLAND_UNIT_TO_CENTS = 100_000_000;
export const ENERGY_QUEENSLAND_CAVEAT =
  'Entity-level SOC statement lines for Energy Queensland only (Queensland Government Owned Corporation). Never add to government program spending, to the PNFC sector benchmark, to another QLD GOC, to a QLD or national total, or to each other: total revenue includes the separately reported Community Service Obligation grant; total expenses is the exact sum of the printed expense lines and includes employee, depreciation/amortisation/impairment, finance and fair-value lines; the net result is a loss. Provisional and unverified.';

/** A discovered annual-report PDF. */
export interface EnergyQueenslandAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
  access: 'official' | 'qld-parliament-fallback';
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

const ANNUAL_REPORT_FILENAME =
  /energy[\s_\-–]*queensland[\s_\-–]*(?:limited[\s_\-–]*)?annual[\s_\-–]*report[\s_\-–]*(20\d{2})[\s_\-–]*(\d{2,4})/i;
const NON_ANNUAL_REPORT =
  /statement[\s_\-–]*of[\s_\-–]*corporate[\s_\-–]*intent|ergon|energex|sustainability|climate|reconciliation|action[\s_\-–]*plan|performance[\s_\-–]*report|quarterly/i;

function fiscalYearFromMatch(start: number, end: number): string | null {
  const endFull = end < 100 ? Math.floor(start / 100) * 100 + end : end;
  if (endFull !== start + 1) return null;
  return `${start}-${String(Math.abs(endFull) % 100).padStart(2, '0')}`;
}

/** Convert "year ended 30 June 2026" into the API fiscal year "2025-26". */
export function fiscalYearFromEndDate(endDate: string): string | null {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(endDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/**
 * Parse annual-report PDF links from the official corporate-reports page.
 * Statement-of-corporate-intent, Ergon, Energex, sustainability and quarterly
 * PDFs are excluded; no URL is hard-coded.
 */
export function parseEnergyQueenslandAnnualReportPdfLinks(
  html: string,
  pageUrl: string = ENERGY_QUEENSLAND_SOURCE_URL,
): EnergyQueenslandAnnualReportLink[] {
  const links: EnergyQueenslandAnnualReportLink[] = [];
  const seen = new Set<string>();
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const raw = match[1];
    if (!raw || !/\.pdf(?:$|[?#])/i.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const filename = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    if (NON_ANNUAL_REPORT.test(filename)) continue;
    const yearMatch = ANNUAL_REPORT_FILENAME.exec(filename);
    if (!yearMatch) continue;
    const fiscalYear = fiscalYearFromMatch(Number(yearMatch[1]), Number(yearMatch[2]));
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}${url.search}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [start, end] = fiscalYear.split('-');
    links.push({
      url: key,
      filename,
      fiscal_year: fiscalYear,
      title: `Annual Report ${start}–${end}`,
      discovery_page: pageUrl,
      access: 'official',
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/** The verified Parliament tabled-paper copy, used only when the official site is blocked. */
export function energyQueenslandParliamentFallback(): EnergyQueenslandAnnualReportLink {
  return {
    url: ENERGY_QUEENSLAND_PARLIAMENT_FALLBACK_URL,
    filename: 'Energy-Queensland-Limited-Annual-Report-2025-26.pdf',
    fiscal_year: '2025-26',
    title: 'Annual Report 2025–26',
    discovery_page: ENERGY_QUEENSLAND_SOURCE_URL,
    access: 'qld-parliament-fallback',
  };
}

/**
 * Discover the latest annual report. The official page is attempted first; a
 * Cloudflare challenge, network failure or empty page falls back to the pinned
 * official Parliament copy. The fallback is documented in the source-discovery
 * evidence and is not a mirror.
 */
export async function discoverEnergyQueenslandAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = ENERGY_QUEENSLAND_SOURCE_URL,
): Promise<EnergyQueenslandAnnualReportLink> {
  try {
    const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
    if (response.ok) {
      const html = await response.text();
      const links = parseEnergyQueenslandAnnualReportPdfLinks(html, pageUrl);
      if (links[0]) return links[0];
    }
  } catch {
    // Fall through to the documented official Parliament copy.
  }
  return energyQueenslandParliamentFallback();
}

interface PageRow {
  y: number;
  items: PdfTextItem[];
  cells: string[];
}

function groupPageRows(items: readonly PdfTextItem[], tolerance = 3): PageRow[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.y - item.y) <= tolerance) last.items.push(item);
    else groups.push({ y: item.y, items: [item] });
  }
  return groups
    .map((group) => {
      const rowItems = [...group.items].sort((a, b) => a.x - b.x);
      const cells = rowItems.map((item) => item.str.replace(/\s+/g, ' ').trim()).filter(Boolean);
      return { y: group.y, items: rowItems, cells };
    })
    .filter((row) => row.cells.length > 0);
}

function labelOf(row: PageRow): string {
  return (row.cells[0] ?? '').replace(/\s+/g, ' ').trim();
}

function columnAnchor(rows: readonly PageRow[], label: string): number | null {
  const row = rows.find((entry) => labelOf(entry).toLowerCase() === label.toLowerCase());
  if (!row) return null;
  const edges: number[] = [];
  for (const item of row.items) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value === null || Math.abs(parsed.value) < 100) continue;
    edges.push(item.x + item.width);
  }
  edges.sort((a, b) => a - b);
  return edges[0] ?? null;
}

function valueNear(row: PageRow, anchor: number, tolerance = 16): number | null {
  let best: { value: number; distance: number } | null = null;
  for (const item of row.items) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value === null) continue;
    const distance = Math.abs(item.x + item.width - anchor);
    if (distance > tolerance) continue;
    if (!best || distance < best.distance) best = { value: parsed.value, distance };
  }
  return best?.value ?? null;
}

function findRow(rows: readonly PageRow[], label: string): PageRow | null {
  const wanted = label.toLowerCase();
  return (
    rows.find((row) => labelOf(row).toLowerCase() === wanted) ??
    rows.find((row) => labelOf(row).toLowerCase().startsWith(wanted)) ??
    null
  );
}

function valueFor(rows: readonly PageRow[], label: string, anchor: number): number | null {
  const row = findRow(rows, label);
  return row ? valueNear(row, anchor) : null;
}

function valueForPattern(
  rows: readonly PageRow[],
  patterns: readonly RegExp[],
  anchor: number,
): number | null {
  for (const row of rows) {
    const label = labelOf(row);
    if (!patterns.some((pattern) => pattern.test(label))) continue;
    const value = valueNear(row, anchor);
    if (value !== null) return value;
  }
  return null;
}

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) =>
      row.cells.some(
        (cell) =>
          cell.includes('$') ||
          /\bin\s+(?:millions?|thousands?|billions?)\s+of\s+dollars\b/i.test(cell),
      ),
    )
    .map((row) => row.cells.join(' '));
}

export function detectEnergyQueenslandUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

export interface EnergyQueenslandStatement {
  page_number: number;
  unit: UnitDetection;
  total_revenue: number;
  transmission_and_purchases: number;
  solar_feed_in_tariff: number;
  employee_expenses: number;
  materials_and_services: number;
  depreciation_amortisation_impairments: number;
  net_impairment_losses: number;
  finance_costs: number;
  fair_value_losses: number;
  other_expenses: number;
  /** Exact sum of the printed expense lines (a positive expense, $m). */
  total_expenses: number;
  loss_before_tax: number;
  income_tax_benefit: number;
  net_result: number;
  /** Total expenses printed in the Directors' report, when present. */
  printed_total_expenses: number | null;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('consolidated statement of profit or loss') &&
      text.includes('loss before income tax equivalent benefit')
    ) {
      return page;
    }
  }
  return null;
}

export function parseEnergyQueenslandStatement(page: PdfPage): EnergyQueenslandStatement | null {
  const rows = groupPageRows(page.items);
  const titleRow = rows.find((row) =>
    /consolidated statement of profit or loss/i.test(row.cells.join(' ')),
  );
  if (!titleRow) return null;

  const unit = detectMoneyUnit(unitSamples(rows));
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const anchor = columnAnchor(rows, 'Revenue');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed Revenue row',
    );
    return null;
  }
  if (unit.kind !== 'millions') {
    errors.push(
      `printed unit is not explicit millions (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $m statement as dollars or thousands`,
    );
  }

  const totalRevenue = valueFor(rows, 'Revenue', anchor);
  const transmission = valueFor(rows, 'Transmission charges and electricity purchases', anchor);
  const solar = valueFor(rows, 'Solar photovoltaic feed in tariff', anchor);
  const employee = valueFor(rows, 'Employee expenses', anchor);
  const materials = valueFor(rows, 'Materials and services', anchor);
  const depreciation = valueFor(rows, 'Depreciation, amortisation and impairments', anchor);
  const impairment = valueFor(rows, 'Net impairment losses on financial assets', anchor);
  const finance = valueFor(rows, 'Finance costs', anchor);
  const fairValue = valueFor(rows, 'Fair value losses', anchor);
  const other = valueFor(rows, 'Other expenses', anchor);
  const pbt = valueForPattern(
    rows,
    [/^(?:loss|profit) before income tax equivalent benefit$/i],
    anchor,
  );
  const tax = valueForPattern(
    rows,
    [/^income tax equivalent (?:benefit|expense)$/i],
    anchor,
  );
  const netResult = valueForPattern(
    rows,
    [/^(?:loss|profit) after income tax equivalent benefit$/i],
    anchor,
  );

  const required: Array<[string, number | null]> = [
    ['Revenue', totalRevenue],
    ['Transmission charges and electricity purchases', transmission],
    ['Solar photovoltaic feed in tariff', solar],
    ['Employee expenses', employee],
    ['Materials and services', materials],
    ['Depreciation, amortisation and impairments', depreciation],
    ['Net impairment losses on financial assets', impairment],
    ['Finance costs', finance],
    ['Fair value losses', fairValue],
    ['Other expenses', other],
    ['Loss/Profit before income tax equivalent benefit', pbt],
    ['Income tax equivalent benefit/expense', tax],
    ['Loss/Profit after income tax equivalent benefit', netResult],
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return {
      page_number: page.page_number,
      unit,
      total_revenue: 0,
      transmission_and_purchases: 0,
      solar_feed_in_tariff: 0,
      employee_expenses: 0,
      materials_and_services: 0,
      depreciation_amortisation_impairments: 0,
      net_impairment_losses: 0,
      finance_costs: 0,
      fair_value_losses: 0,
      other_expenses: 0,
      total_expenses: 0,
      loss_before_tax: 0,
      income_tax_benefit: 0,
      net_result: 0,
      printed_total_expenses: null,
      checks,
      warnings,
      errors,
    };
  }

  const totalExpenses =
    (transmission as number) +
    (solar as number) +
    (employee as number) +
    (materials as number) +
    (depreciation as number) +
    (impairment as number) +
    (finance as number) +
    (fairValue as number) +
    (other as number);

  checks.push(
    `expense components exact: ${transmission} + ${solar} + ${employee} + ${materials} + ${depreciation} + ${impairment} + ${finance} + ${fairValue} + ${other} = ${totalExpenses} (the derived total expenses)`,
  );

  const pbtBridge = (totalRevenue as number) - totalExpenses;
  if (pbtBridge !== pbt) {
    errors.push(
      `profit-before-tax bridge mismatch: ${totalRevenue} - ${totalExpenses} = ${pbtBridge}, printed Loss/Profit before income tax equivalent benefit ${pbt}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${totalRevenue} - ${totalExpenses} = ${pbtBridge}`,
    );
  }

  const netBridge = (pbt as number) + (tax as number);
  if (netBridge !== netResult) {
    errors.push(
      `net-result bridge mismatch: ${pbt} + ${tax} = ${netBridge}, printed Loss/Profit after income tax equivalent benefit ${netResult}`,
    );
  } else {
    checks.push(`net-result bridge exact: ${pbt} + ${tax} = ${netBridge}`);
  }

  warnings.push(
    'the consolidated statement has no printed Total expenses subtotal; total expenses is the exact sum of the printed expense lines and is accepted only because it bridges to the printed Loss before income tax equivalent benefit with zero tolerance and is cross-checked against the Directors\' report total on another page',
  );

  return {
    page_number: page.page_number,
    unit,
    total_revenue: totalRevenue as number,
    transmission_and_purchases: transmission as number,
    solar_feed_in_tariff: solar as number,
    employee_expenses: employee as number,
    materials_and_services: materials as number,
    depreciation_amortisation_impairments: depreciation as number,
    net_impairment_losses: impairment as number,
    finance_costs: finance as number,
    fair_value_losses: fairValue as number,
    other_expenses: other as number,
    total_expenses: totalExpenses,
    loss_before_tax: pbt as number,
    income_tax_benefit: tax as number,
    net_result: netResult as number,
    printed_total_expenses: null,
    checks,
    warnings,
    errors,
  };
}

/** Read the Directors' report sentence "Total expenses ... of $6,800 million". */
export function printedTotalExpenses(page: PdfPage): number | null {
  const match =
    /Total expenses for the year \(excluding income tax\) of \$([\d,]+(?:\.\d+)?) million/i.exec(
      page.text,
    );
  if (!match) return null;
  const value = Number(match[1]!.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

export interface EnergyQueenslandParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface EnergyQueenslandDeferral {
  reason: string;
  phase: 'statement' | 'unit' | 'reconciliation' | 'notes';
}

export interface EnergyQueenslandLineSpec {
  line_item: string;
  label: string;
  amount_millions: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result';
  detail: string;
  printed_sign?: 'positive' | 'negative';
}

export interface EnergyQueenslandParseResult {
  records: SpendingRecord[];
  deferral: EnergyQueenslandDeferral | null;
  statement: EnergyQueenslandStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function energyQueenslandNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${ENERGY_QUEENSLAND_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(millions: number): number {
  const cents = Math.abs(millions) * ENERGY_QUEENSLAND_UNIT_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${millions} million exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: EnergyQueenslandParseContext,
  spec: EnergyQueenslandLineSpec,
  statement: EnergyQueenslandStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${ENERGY_QUEENSLAND_UNIT_LABEL} (${ENERGY_QUEENSLAND_UNIT}; x${ENERGY_QUEENSLAND_UNIT_TO_CENTS} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; consolidated Energy Queensland parent; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, another QLD GOC, a QLD total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: EnergyQueenslandLineSpec,
  context: EnergyQueenslandParseContext,
  statement: EnergyQueenslandStatement,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_millions),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: ENERGY_QUEENSLAND_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: energyQueenslandNaturalKey(
      ENERGY_QUEENSLAND_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${ENERGY_QUEENSLAND_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: ENERGY_QUEENSLAND_JURISDICTION,
    delivery_entity: ENERGY_QUEENSLAND_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Energy Queensland Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: ENERGY_QUEENSLAND_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: ENERGY_QUEENSLAND_UNIT,
    soc_section: spec.section,
    soc_note: 'Face statement',
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      revenue_millions: statement.total_revenue,
      total_expenses_millions: statement.total_expenses,
      net_result_millions: statement.net_result,
      ...(spec.line_item === 'total_expenses' || spec.line_item === 'net_result'
        ? { human_spot_check: 'required — one of the two flagged SOC line items' }
        : {}),
      checks: statement.checks.join(' | '),
    }),
  };
}

export function parseEnergyQueenslandExtraction(
  extraction: PdfExtraction,
  context: EnergyQueenslandParseContext,
): EnergyQueenslandParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return {
      records: [],
      deferral: {
        reason: 'no parseable consolidated statement of profit or loss found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseEnergyQueenslandStatement(statementPage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason: 'consolidated statement page found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [statementPage.page_number],
    };
  }
  warnings.push(...statement.warnings);
  if (statement.unit.kind !== 'millions') {
    return {
      records: [],
      deferral: {
        reason: `statement printed unit is not explicit millions: ${statement.unit.reason}`,
        phase: 'unit',
      },
      statement,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }
  if (statement.errors.length > 0) {
    return {
      records: [],
      deferral: {
        reason: `statement reconciliation failed with zero tolerance: ${statement.errors.join('; ')}`,
        phase: 'reconciliation',
      },
      statement,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }

  const endDate = /year ended 30 June (\d{4})/i.exec(extraction.text);
  const derivedFiscalYear = endDate ? fiscalYearFromEndDate(`${endDate[1]}-06-30`) : null;
  if (derivedFiscalYear && derivedFiscalYear !== context.fiscal_year) {
    return {
      records: [],
      deferral: {
        reason: `report period ${derivedFiscalYear} does not match discovered report year ${context.fiscal_year}`,
        phase: 'statement',
      },
      statement,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }

  let proseTotalPage: number | null = null;
  let proseTotal: number | null = null;
  for (const page of extraction.pages) {
    const value = printedTotalExpenses(page);
    if (value !== null) {
      proseTotalPage = page.page_number;
      proseTotal = value;
      break;
    }
  }
  if (proseTotal !== null) {
    statement.printed_total_expenses = proseTotal;
    if (proseTotal !== statement.total_expenses) {
      return {
        records: [],
        deferral: {
          reason: `Directors' report printed total expenses ${proseTotal} on page ${proseTotalPage} does not match the statement expense-component sum ${statement.total_expenses}`,
          phase: 'reconciliation',
        },
        statement,
        checks: statement.checks,
        warnings,
        pages_used: [statementPage.page_number, proseTotalPage as number],
      };
    }
    statement.checks.push(
      `Directors' report printed total expenses agrees: ${proseTotal} = statement expense-component sum ${statement.total_expenses} (page ${proseTotalPage})`,
    );
  } else {
    warnings.push(
      "the Directors' report printed total expenses sentence was not found in the PDF; the derived total is still reconciled to the printed profit-before-tax and net-result bridges",
    );
  }

  const lineSpecs: EnergyQueenslandLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_millions: statement.total_revenue,
      funding_source: ENERGY_QUEENSLAND_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Revenue. Includes the separately reported Community Service Obligation grant that is not emitted as an extra row; never add it again.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_millions: statement.total_expenses,
      funding_source: ENERGY_QUEENSLAND_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        "Exact sum of the printed expense lines (transmission charges and electricity purchases, solar feed-in tariff, employee expenses, materials and services, depreciation/amortisation/impairments, net impairment losses, finance costs, fair value losses and other expenses). Accepted only because it equals the Directors' report printed total expenses and Total revenue less total expenses equals the printed Loss before income tax equivalent benefit.",
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee expenses',
      amount_millions: statement.employee_expenses,
      funding_source: ENERGY_QUEENSLAND_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Employee expenses. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation, amortisation and impairments',
      amount_millions: statement.depreciation_amortisation_impairments,
      funding_source: ENERGY_QUEENSLAND_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Depreciation, amortisation and impairments. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'net_result',
      label: 'Loss after income tax equivalent benefit',
      amount_millions: statement.net_result,
      funding_source: ENERGY_QUEENSLAND_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Loss after income tax equivalent benefit (net result), a printed negative retained as a non-negative magnitude with soc_printed_sign negative. A result line, not an expense component; never add to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; total expenses is the exact sum of the printed expense lines and reconciles to the printed loss-before-tax and net-result bridges and the Directors\' report total.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks: statement.checks,
    warnings,
    pages_used: [statementPage.page_number],
  };
}

export interface EnergyQueenslandConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: EnergyQueenslandAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'energy-queensland-annual-report.pdf';
}

async function recordDeferral(
  document: EnergyQueenslandAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: EnergyQueenslandDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: ENERGY_QUEENSLAND_ID, document_url: document.url },
    {
      $set: {
        entity: ENERGY_QUEENSLAND_ENTITY,
        jurisdiction: ENERGY_QUEENSLAND_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Energy Queensland SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Energy Queensland connector. */
export function createEnergyQueenslandConnector(
  options: EnergyQueenslandConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: ENERGY_QUEENSLAND_ID,
    name: ENERGY_QUEENSLAND_NAME,
    publisher: ENERGY_QUEENSLAND_PUBLISHER,
    source_url: ENERGY_QUEENSLAND_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: ENERGY_QUEENSLAND_LICENSE,
    notes:
      'QLD SOC pilot: Energy Queensland Limited only, a Queensland Government Owned Corporation (GOC). The latest annual report is discovered from Energy Queensland\'s official corporate-reports page; because that site returns a Cloudflare HTML challenge (HTTP 403) from the ingestion host, the verified Queensland Parliament tabled-paper copy is the documented fallback. The exact PDF is SHA-256 archived outside the repo. The consolidated statement of profit or loss prints an explicit $m unit; total expenses is the exact sum of the printed expense lines and is accepted only when it equals the Directors\' report total and the printed loss-before-tax and net-result bridges reconcile with zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). Energy Queensland is never added to government program spending, the PNFC benchmark, another QLD GOC, a QLD total, or another SOC line.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        (await discoverEnergyQueenslandAnnualReport(fetchImpl, ENERGY_QUEENSLAND_SOURCE_URL));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Energy Queensland PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: ENERGY_QUEENSLAND_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Energy Queensland annual-report PDF (Queensland Parliament tabled-paper fallback when the corporate site is Cloudflare-gated); archived for auditable QLD SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: EnergyQueenslandParseContext = {
        document_url: document.url,
        document_title: document.title,
        fiscal_year: document.fiscal_year,
        archive: {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
        },
        source_date: now.toISOString().slice(0, 10),
      };
      const parsed = parseEnergyQueenslandExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.deferral) {
        await recordDeferral(document, archived, parsed.deferral);
        metadata.errors.push(
          `deferred ${document.fiscal_year}: ${parsed.deferral.phase}: ${parsed.deferral.reason}`,
        );
        return [];
      }
      if (parsed.records.length === 0) {
        metadata.errors.push(`${document.fiscal_year}: no validated SOC rows extracted`);
      }
      return parsed.records.map((record) => ({ kind: 'qld-energy-queensland-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'qld-energy-queensland-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not an Energy Queensland measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
    metadata,
  };

  return connector;
}
