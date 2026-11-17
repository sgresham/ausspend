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
import type { Connector, FetchStrategy, RawRecord } from '../../types.js';
import { resolveSocDocument } from './soc-document-fetch.js';
import type { HeadlessPdfFetcher } from './headless.js';

/**
 * NSW SOC Phase 5 — Essential Energy annual-report adapter.
 *
 * This reuses the established NSW SOC layer: one entity adapter, not a second
 * framework. Essential Energy is the fourth NSW SOC entity after Sydney Water,
 * WaterNSW and Hunter Water.
 *
 * Source gate:
 * - The document is discovered from Essential Energy's own annual-report page
 *   (no PDF URL is hard-coded). Its site is behind a Cloudflare HTML challenge
 *   from the ingestion host, so the operator can supply the exact official PDF
 *   URL via ESSENTIAL_ENERGY_ANNUAL_REPORT_URL; the default path is live page
 *   discovery.
 * - The exact PDF bytes are SHA-256 archived outside the repo.
 * - The consolidated statement of comprehensive income prints an explicit
 *   "$M" unit and the Basis of Preparation states amounts are rounded to the
 *   nearest tenth of a million dollars. A table read as dollars or thousands is
 *   rejected, not converted by magnitude. One $M unit = 100,000,000 cents.
 * - The statement has no single printed "Total expenses" subtotal. Following
 *   the Sydney Water precedent, total expenses is the exact sum of the printed
 *   entity-level expense lines — pass through costs, operating expenses, loss
 *   on disposal or write-off of non-financial assets, depreciation, amortisation
 *   and impairment, and net finance costs — and is accepted only when every
 *   printed bridge reconciles with zero tolerance: revenue components to Total
 *   revenue, EBITDA and EBIT, the expense-component sum, and Total revenue plus
 *   total expenses equals the printed Loss before income tax. A one-tenth-of-a-
 *   million mismatch defers the whole document.
 */

export const ESSENTIAL_ENERGY_ID = 'essential-energy';
export const ESSENTIAL_ENERGY_NAME = 'Essential Energy — Annual Report';
export const ESSENTIAL_ENERGY_PUBLISHER = 'Essential Energy';
export const ESSENTIAL_ENERGY_ENTITY = 'Essential Energy';
export const ESSENTIAL_ENERGY_JURISDICTION = 'NSW';
export const ESSENTIAL_ENERGY_SOURCE_URL =
  'https://www.essentialenergy.com.au/about-us/corporate-governance/annual-report';
export const ESSENTIAL_ENERGY_LICENSE =
  '© Essential Energy. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const ESSENTIAL_ENERGY_UNIT = 'AUD_millions';
export const ESSENTIAL_ENERGY_UNIT_LABEL = '$M';
export const ESSENTIAL_ENERGY_UNIT_TO_CENTS = 100_000_000;
/** Cents per tenth of a million dollars (the printed precision). */
export const ESSENTIAL_ENERGY_TENTH_TO_CENTS = 10_000_000;
export const ESSENTIAL_ENERGY_CAVEAT =
  'Entity-level SOC statement lines for Essential Energy only. Never add to government program spending, to the PNFC sector benchmark, or to each other: total revenue includes the separately shown government grants and subsidies; total expenses is the exact sum of the printed expense lines (pass through costs, operating expenses, loss on disposal/write-off, depreciation/amortisation/impairment and net finance costs); the net result is a loss. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the URL; parse the page. */
export interface EssentialEnergyAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

const ANNUAL_REPORT_FILENAME = /annual[\s_\-–]*report[\s_\-–]*(20\d{2})[\s_\-–]*(\d{2,4})/i;
const NON_ANNUAL_REPORT =
  /crfd|gipa|half[\s_\-–]*year|corporate[\s_\-–]*intent|sustainability|pricing|access[\s_\-–]*undertaking|safety|ensms|annual[\s_\-–]*performance/i;

function fiscalYearFromMatch(start: number, end: number): string | null {
  const endFull = end < 100 ? Math.floor(start / 100) * 100 + end : end;
  if (endFull !== start + 1) return null;
  return `${start}-${String(endFull % 100).padStart(2, '0')}`;
}

/**
 * Parse the annual-report PDF links on the official annual-report page. Both
 * the legacy `/-/media/.../AnnualReportYYYY-YY.pdf` and the newer
 * `/ext/arYYYY/files/.../Essential-Energy_Annual-Report_YYYY-YY.pdf` paths are
 * accepted; non-annual PDFs are rejected. No URL is hard-coded.
 */
export function parseEssentialEnergyAnnualReportPdfLinks(
  html: string,
  pageUrl: string = ESSENTIAL_ENERGY_SOURCE_URL,
): EssentialEnergyAnnualReportLink[] {
  const links: EssentialEnergyAnnualReportLink[] = [];
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
    });
  }
  return links.sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year));
}

/** Fetch the official annual-report page and return its latest annual-report PDF. */
export async function discoverEssentialEnergyAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  pageUrl: string = ESSENTIAL_ENERGY_SOURCE_URL,
): Promise<EssentialEnergyAnnualReportLink> {
  const response = await fetchImpl(pageUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`Essential Energy annual-report page HTTP ${response.status} for ${pageUrl}`);
  }
  const html = await response.text();
  const links = parseEssentialEnergyAnnualReportPdfLinks(html, pageUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Essential Energy annual-report page contains no annual-report PDF link; refusing to hard-code a URL',
    );
  }
  return latest;
}

/** Convert "year ended 30 June 2025" into the API fiscal year "2024-25". */
export function fiscalYearFromEndDate(endDate: string): string | null {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(endDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
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

/** Anchor the current-year money column on the leftmost numeric cell of a printed row. */
function columnAnchor(rows: readonly PageRow[], label: string): number | null {
  const row = rows.find((entry) => labelOf(entry).toLowerCase() === label.toLowerCase());
  if (!row) return null;
  const edges: number[] = [];
  for (const item of row.items) {
    const parsed = parseAmountCell(item.str);
    if (parsed.value === null) continue;
    // Anchors must be large enough not to be a note reference or a tiny residual.
    if (Math.abs(parsed.value) < 100) continue;
    edges.push(item.x + item.width);
  }
  edges.sort((a, b) => a - b);
  return edges[0] ?? null;
}

function valueNear(row: PageRow, anchor: number, tolerance = 14): number | null {
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

/** Detect the printed unit from the statement header/unit rows. */
export function detectEssentialEnergyUnit(samples: readonly string[]): UnitDetection {
  return detectMoneyUnit(samples);
}

function unitSamples(rows: readonly PageRow[]): string[] {
  return rows
    .filter((row) => row.cells.some((cell) => cell.includes('$')))
    .map((row) => row.cells.join(' '));
}

/** Convert a printed millions value to integer tenths of a million. */
function tenths(value: number): number {
  return Math.round(value * 10);
}

function tenthsLabel(value: number): string {
  return (value / 10).toFixed(1);
}

export interface EssentialEnergyStatement {
  page_number: number;
  unit: UnitDetection;
  network_revenue: number;
  other_contract_revenue: number;
  total_contract_revenue: number;
  other_revenue: number;
  total_revenue: number;
  pass_through_costs: number;
  operating_expenses: number;
  loss_on_disposal: number;
  ebitda: number;
  depreciation_amortisation_impairment: number;
  ebit: number;
  net_finance_costs: number;
  loss_before_tax: number;
  income_tax: number;
  net_result: number;
  /** Exact sum of the printed entity-level expense lines (a positive expense). */
  total_expenses: number;
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('consolidated statement of comprehensive income') &&
      text.includes('total revenue') &&
      /(?:loss|profit) before income tax/.test(text)
    ) {
      return page;
    }
  }
  return null;
}

export function parseEssentialEnergyStatement(page: PdfPage): EssentialEnergyStatement | null {
  const rows = groupPageRows(page.items);
  const titleRow = rows.find((row) =>
    /consolidated statement of comprehensive income/i.test(row.cells.join(' ')),
  );
  if (!titleRow) return null;

  const unit = detectMoneyUnit(unitSamples(rows));

  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const anchor = columnAnchor(rows, 'Total revenue');
  if (anchor === null) {
    errors.push(
      'statement current-year money column could not be anchored from the printed Total revenue row',
    );
    return null;
  }
  if (unit.kind !== 'millions') {
    errors.push(
      `printed unit is not explicit millions (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest a $M statement as dollars or thousands`,
    );
  }

  const network = valueFor(rows, 'Network revenue from contracts with customers', anchor);
  const otherContracts = valueFor(rows, 'Other revenue from contracts with customers', anchor);
  const totalContracts = valueFor(rows, 'Total revenue from contracts with customers', anchor);
  const otherRevenue = valueFor(rows, 'Other revenue', anchor);
  const totalRevenue = valueFor(rows, 'Total revenue', anchor);
  const passThrough = valueFor(rows, 'Pass through costs', anchor);
  const operating = valueFor(rows, 'Operating expenses', anchor);
  const lossDisposal = valueFor(
    rows,
    'Loss on disposal or write-off of non-financial assets',
    anchor,
  );
  const ebitda = valueForPattern(
    rows,
    [/^earnings before interest, taxation, depreciation and amortisation/i, /^ebitda$/i],
    anchor,
  );
  const depreciation = valueFor(rows, 'Depreciation, amortisation and impairment', anchor);
  const ebit = valueForPattern(
    rows,
    [/^earnings before interest and taxation/i, /^ebit$/i],
    anchor,
  );
  const netFinance = valueFor(rows, 'Net finance costs', anchor);
  const pbt = valueForPattern(rows, [/^(?:loss|profit) before income tax$/i], anchor);
  const tax = valueForPattern(rows, [/^income tax (?:benefit|expense)$/i], anchor);
  const netResult = valueForPattern(rows, [/^(?:loss|profit) for the year$/i], anchor);

  const required: Array<[string, number | null]> = [
    ['Network revenue from contracts with customers', network],
    ['Other revenue from contracts with customers', otherContracts],
    ['Total revenue from contracts with customers', totalContracts],
    ['Other revenue', otherRevenue],
    ['Total revenue', totalRevenue],
    ['Pass through costs', passThrough],
    ['Operating expenses', operating],
    ['Loss on disposal or write-off of non-financial assets', lossDisposal],
    ['EBITDA', ebitda],
    ['Depreciation, amortisation and impairment', depreciation],
    ['EBIT', ebit],
    ['Net finance costs', netFinance],
    ['Loss/Profit before income tax', pbt],
    ['Income tax benefit/expense', tax],
    ['Loss/Profit for the year', netResult],
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`statement is missing required printed line(s): ${missing.join(', ')}`);
    return {
      page_number: page.page_number,
      unit,
      network_revenue: 0,
      other_contract_revenue: 0,
      total_contract_revenue: 0,
      other_revenue: 0,
      total_revenue: 0,
      pass_through_costs: 0,
      operating_expenses: 0,
      loss_on_disposal: 0,
      ebitda: 0,
      depreciation_amortisation_impairment: 0,
      ebit: 0,
      net_finance_costs: 0,
      loss_before_tax: 0,
      income_tax: 0,
      net_result: 0,
      total_expenses: 0,
      checks,
      warnings,
      errors,
    };
  }

  const t = (value: number): number => tenths(value);
  const totalExpenseTenths =
    t(passThrough as number) +
    t(operating as number) +
    t(lossDisposal as number) +
    t(depreciation as number) +
    t(netFinance as number);
  const totalExpenses = totalExpenseTenths / 10;

  // Zero-tolerance printed bridges, all in integer tenths of a million.
  const contractsTenths = t(network as number) + t(otherContracts as number);
  if (contractsTenths !== t(totalContracts as number)) {
    errors.push(
      `revenue from contracts mismatch: ${tenthsLabel(t(network as number))} + ${tenthsLabel(t(otherContracts as number))} = ${tenthsLabel(contractsTenths)}, printed Total revenue from contracts with customers ${tenthsLabel(t(totalContracts as number))}`,
    );
  } else {
    checks.push(
      `revenue from contracts exact: ${tenthsLabel(t(network as number))} + ${tenthsLabel(t(otherContracts as number))} = ${tenthsLabel(contractsTenths)}`,
    );
  }

  const revenueTenths = t(totalContracts as number) + t(otherRevenue as number);
  if (revenueTenths !== t(totalRevenue as number)) {
    errors.push(
      `revenue components mismatch: ${tenthsLabel(t(totalContracts as number))} + ${tenthsLabel(t(otherRevenue as number))} = ${tenthsLabel(revenueTenths)}, printed Total revenue ${tenthsLabel(t(totalRevenue as number))}`,
    );
  } else {
    checks.push(
      `revenue components exact: ${tenthsLabel(t(totalContracts as number))} + ${tenthsLabel(t(otherRevenue as number))} = ${tenthsLabel(revenueTenths)}`,
    );
  }

  const ebitdaTenths =
    t(totalRevenue as number) +
    t(passThrough as number) +
    t(operating as number) +
    t(lossDisposal as number);
  if (ebitdaTenths !== t(ebitda as number)) {
    errors.push(
      `EBITDA bridge mismatch: ${tenthsLabel(t(totalRevenue as number))} ${tenthsLabel(t(passThrough as number))} ${tenthsLabel(t(operating as number))} ${tenthsLabel(t(lossDisposal as number))} = ${tenthsLabel(ebitdaTenths)}, printed EBITDA ${tenthsLabel(t(ebitda as number))}`,
    );
  } else {
    checks.push(`EBITDA bridge exact: ${tenthsLabel(ebitdaTenths)}`);
  }

  const ebitTenths = t(ebitda as number) + t(depreciation as number);
  if (ebitTenths !== t(ebit as number)) {
    errors.push(
      `EBIT bridge mismatch: ${tenthsLabel(t(ebitda as number))} + ${tenthsLabel(t(depreciation as number))} = ${tenthsLabel(ebitTenths)}, printed EBIT ${tenthsLabel(t(ebit as number))}`,
    );
  } else {
    checks.push(
      `EBIT bridge exact: ${tenthsLabel(t(ebitda as number))} + ${tenthsLabel(t(depreciation as number))} = ${tenthsLabel(ebitTenths)}`,
    );
  }

  checks.push(
    `expense components exact: ${tenthsLabel(t(passThrough as number))} + ${tenthsLabel(t(operating as number))} + ${tenthsLabel(t(lossDisposal as number))} + ${tenthsLabel(t(depreciation as number))} + ${tenthsLabel(t(netFinance as number))} = ${tenthsLabel(totalExpenseTenths)} (the derived total expenses)`,
  );

  const pbtTenths = t(totalRevenue as number) + totalExpenseTenths;
  if (pbtTenths !== t(pbt as number)) {
    errors.push(
      `profit-before-tax bridge mismatch: ${tenthsLabel(t(totalRevenue as number))} + (${tenthsLabel(totalExpenseTenths)}) = ${tenthsLabel(pbtTenths)}, printed Loss/Profit before income tax ${tenthsLabel(t(pbt as number))}`,
    );
  } else {
    checks.push(
      `profit-before-tax bridge exact: ${tenthsLabel(t(totalRevenue as number))} + (${tenthsLabel(totalExpenseTenths)}) = ${tenthsLabel(pbtTenths)}`,
    );
  }

  const netTenths = t(pbt as number) + t(tax as number);
  if (netTenths !== t(netResult as number)) {
    errors.push(
      `net-result bridge mismatch: ${tenthsLabel(t(pbt as number))} + ${tenthsLabel(t(tax as number))} = ${tenthsLabel(netTenths)}, printed Loss/Profit for the year ${tenthsLabel(t(netResult as number))}`,
    );
  } else {
    checks.push(
      `net-result bridge exact: ${tenthsLabel(t(pbt as number))} + (${tenthsLabel(t(tax as number))}) = ${tenthsLabel(netTenths)}`,
    );
  }

  warnings.push(
    'the consolidated statement has no printed Total expenses subtotal; total expenses is the exact sum of the printed entity-level expense lines (pass through costs, operating expenses, loss on disposal/write-off, depreciation/amortisation/impairment and net finance costs) and is accepted only because it bridges to the printed Loss/Profit before income tax with zero tolerance',
  );

  return {
    page_number: page.page_number,
    unit,
    network_revenue: network as number,
    other_contract_revenue: otherContracts as number,
    total_contract_revenue: totalContracts as number,
    other_revenue: otherRevenue as number,
    total_revenue: totalRevenue as number,
    pass_through_costs: passThrough as number,
    operating_expenses: operating as number,
    loss_on_disposal: lossDisposal as number,
    ebitda: ebitda as number,
    depreciation_amortisation_impairment: depreciation as number,
    ebit: ebit as number,
    net_finance_costs: netFinance as number,
    loss_before_tax: pbt as number,
    income_tax: tax as number,
    net_result: netResult as number,
    total_expenses: totalExpenses,
    checks,
    warnings,
    errors,
  };
}

export interface EssentialEnergyRevenueNote {
  page_number: number;
  unit: UnitDetection;
  government_grants_and_subsidies: number | null;
  lease_revenue: number | null;
  errors: string[];
}

export interface EssentialEnergyExpensesNote {
  page_number: number;
  unit: UnitDetection;
  transmission_use_of_system: number | null;
  climate_change_fund: number | null;
  roadmap_contributions: number | null;
  total_pass_through_costs: number | null;
  defined_contribution_superannuation: number | null;
  defined_benefit_superannuation: number | null;
  other_employee_benefits: number | null;
  other_costs_of_distribution: number | null;
  debt_write_offs: number | null;
  total_operating_expenses: number | null;
  loss_on_disposal_ppe: number | null;
  lease_modification_gain_loss: number | null;
  total_loss_on_disposal: number | null;
  depreciation_ppe: number | null;
  depreciation_rou: number | null;
  plant_equipment_depreciation_capitalised: number | null;
  depreciation_expense: number | null;
  amortisation_intangibles: number | null;
  impairment_losses: number | null;
  total_depreciation_amortisation_impairment: number | null;
  errors: string[];
}

function findRevenueNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('revenue from contracts with customers') &&
      text.includes('government grants and subsidies')
    ) {
      return page;
    }
  }
  return null;
}

function findExpensesNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('operating expenses') &&
      text.includes('defined contribution superannuation') &&
      text.includes('depreciation, amortisation and impairment')
    ) {
      return page;
    }
  }
  return null;
}

export function parseEssentialEnergyRevenueNote(page: PdfPage): EssentialEnergyRevenueNote {
  const rows = groupPageRows(page.items);
  const anchor = columnAnchor(rows, 'Total revenue from contracts with customers');
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  if (unit.kind !== 'millions') {
    errors.push(`revenue note unit is not explicit millions (detected ${unit.kind ?? 'none'})`);
  }
  if (anchor === null) errors.push('revenue note current-year money column could not be anchored');
  const grants = anchor === null ? null : valueFor(rows, 'Government grants and subsidies', anchor);
  const lease = anchor === null ? null : valueFor(rows, 'Lease revenue', anchor);
  if (grants === null) errors.push('government grants and subsidies row could not be parsed');
  if (lease === null) errors.push('lease revenue row could not be parsed');
  return {
    page_number: page.page_number,
    unit,
    government_grants_and_subsidies: grants,
    lease_revenue: lease,
    errors,
  };
}

export function parseEssentialEnergyExpensesNote(page: PdfPage): EssentialEnergyExpensesNote {
  const rows = groupPageRows(page.items);
  const anchor = columnAnchor(rows, 'Total operating expenses');
  const unit = detectMoneyUnit(unitSamples(rows));
  const errors: string[] = [];
  if (unit.kind !== 'millions') {
    errors.push(`expenses note unit is not explicit millions (detected ${unit.kind ?? 'none'})`);
  }
  if (anchor === null) errors.push('expenses note current-year money column could not be anchored');
  const read = (label: string): number | null =>
    anchor === null ? null : valueFor(rows, label, anchor);

  const note: EssentialEnergyExpensesNote = {
    page_number: page.page_number,
    unit,
    transmission_use_of_system: read('Transmission Use of System'),
    climate_change_fund: read('Climate Change Fund contributions'),
    roadmap_contributions: read('NSW Electricity Infrastructure Roadmap contributions'),
    total_pass_through_costs: read('Total pass through costs'),
    defined_contribution_superannuation: read('Defined contribution superannuation'),
    defined_benefit_superannuation: read('Defined benefit superannuation'),
    other_employee_benefits: read('Other employee benefits'),
    other_costs_of_distribution: read('Other costs of distribution of energy and other services'),
    debt_write_offs: read('Debt write-offs and expected credit losses on receivables'),
    total_operating_expenses: read('Total operating expenses'),
    loss_on_disposal_ppe: read('Loss on disposal of property, plant and equipment'),
    lease_modification_gain_loss: read('(Gains)/losses on modification of leases'),
    total_loss_on_disposal: read('Total loss on disposal or write-off of non-financial assets'),
    depreciation_ppe: read('Depreciation of property, plant and equipment'),
    depreciation_rou: read('Depreciation of right-of-use assets'),
    plant_equipment_depreciation_capitalised: read('Plant and equipment depreciation capitalised'),
    depreciation_expense: read('Depreciation expense'),
    amortisation_intangibles: read('Amortisation of intangible assets'),
    impairment_losses: read('Impairment losses'),
    total_depreciation_amortisation_impairment: read(
      'Total depreciation, amortisation and impairment',
    ),
    errors,
  };

  const required: Array<[string, number | null]> = [
    ['defined contribution superannuation', note.defined_contribution_superannuation],
    ['defined benefit superannuation', note.defined_benefit_superannuation],
    ['other employee benefits', note.other_employee_benefits],
    ['other costs of distribution of energy and other services', note.other_costs_of_distribution],
    ['debt write-offs and expected credit losses on receivables', note.debt_write_offs],
    ['Total operating expenses', note.total_operating_expenses],
    ['Total pass through costs', note.total_pass_through_costs],
    ['Total loss on disposal or write-off of non-financial assets', note.total_loss_on_disposal],
    [
      'Total depreciation, amortisation and impairment',
      note.total_depreciation_amortisation_impairment,
    ],
  ];
  const missing = required.filter(([, value]) => value === null).map(([label]) => label);
  if (missing.length > 0) {
    errors.push(`one or more printed expense note rows could not be parsed: ${missing.join(', ')}`);
  }
  return note;
}

export interface EssentialEnergyParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export interface EssentialEnergyDeferral {
  reason: string;
  phase: 'discovery' | 'unit' | 'statement' | 'notes' | 'reconciliation';
}

export interface EssentialEnergyParseResult {
  records: SpendingRecord[];
  deferral: EssentialEnergyDeferral | null;
  statement: EssentialEnergyStatement | null;
  revenue_note: EssentialEnergyRevenueNote | null;
  expenses_note: EssentialEnergyExpensesNote | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export interface EssentialEnergyLineSpec {
  line_item: string;
  label: string;
  amount_tenths: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result';
  printed_sign?: 'positive' | 'negative';
  detail: string;
}

export function essentialEnergyNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${ESSENTIAL_ENERGY_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function amountCents(tenthsOfMillion: number): number {
  const cents = Math.abs(tenthsOfMillion) * ESSENTIAL_ENERGY_TENTH_TO_CENTS;
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${tenthsOfMillion} tenths-of-millions exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: EssentialEnergyParseContext,
  spec: EssentialEnergyLineSpec,
  statement: EssentialEnergyStatement,
  revenueNote: EssentialEnergyRevenueNote,
  expensesNote: EssentialEnergyExpensesNote,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${ESSENTIAL_ENERGY_UNIT_LABEL} (${ESSENTIAL_ENERGY_UNIT}; x${ESSENTIAL_ENERGY_UNIT_TO_CENTS} cents per unit; tenths-of-a-million printed precision)`,
    `statement_page: ${statement.page_number}`,
    `revenue_note_page: ${revenueNote.page_number}`,
    `expenses_note_page: ${expensesNote.page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'current-year column; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: EssentialEnergyLineSpec,
  context: EssentialEnergyParseContext,
  statement: EssentialEnergyStatement,
  revenueNote: EssentialEnergyRevenueNote,
  expensesNote: EssentialEnergyExpensesNote,
): SpendingRecord {
  return {
    amount_cents: amountCents(spec.amount_tenths),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: ESSENTIAL_ENERGY_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: essentialEnergyNaturalKey(
      ESSENTIAL_ENERGY_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${ESSENTIAL_ENERGY_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: ESSENTIAL_ENERGY_JURISDICTION,
    delivery_entity: ESSENTIAL_ENERGY_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Essential Energy Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: ESSENTIAL_ENERGY_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: ESSENTIAL_ENERGY_UNIT,
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, revenueNote, expensesNote, {
      section: spec.section,
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

export function parseEssentialEnergyExtraction(
  extraction: PdfExtraction,
  context: EssentialEnergyParseContext,
): EssentialEnergyParseResult {
  const warnings: string[] = [];
  const statementPage = findStatementPage(extraction.pages);
  if (!statementPage) {
    return {
      records: [],
      deferral: {
        reason: 'no parseable consolidated statement of comprehensive income found in the PDF',
        phase: 'statement',
      },
      statement: null,
      revenue_note: null,
      expenses_note: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }
  const statement = parseEssentialEnergyStatement(statementPage);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason: 'consolidated statement page found but required printed lines could not be parsed',
        phase: 'statement',
      },
      statement: null,
      revenue_note: null,
      expenses_note: null,
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
      revenue_note: null,
      expenses_note: null,
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
      revenue_note: null,
      expenses_note: null,
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
      revenue_note: null,
      expenses_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }

  const revenuePage = findRevenueNotePage(extraction.pages);
  if (!revenuePage) {
    return {
      records: [],
      deferral: {
        reason:
          'the Note 2 revenue table needed to verify government grants and subsidies could not be located',
        phase: 'notes',
      },
      statement,
      revenue_note: null,
      expenses_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number],
    };
  }
  const revenueNote = parseEssentialEnergyRevenueNote(revenuePage);
  const expensesPage = findExpensesNotePage(extraction.pages);
  if (!expensesPage) {
    return {
      records: [],
      deferral: {
        reason:
          'the Note 3 expenses table needed to verify employee benefits and expense components could not be located',
        phase: 'notes',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: null,
      checks: statement.checks,
      warnings,
      pages_used: [statementPage.page_number, revenueNote.page_number],
    };
  }
  const expensesNote = parseEssentialEnergyExpensesNote(expensesPage);
  const pagesUsed = [statementPage.page_number, revenueNote.page_number, expensesNote.page_number];
  if (revenueNote.unit.kind !== 'millions') {
    return {
      records: [],
      deferral: {
        reason: `revenue note on page ${revenueNote.page_number} is not explicit millions: ${revenueNote.unit.reason}`,
        phase: 'unit',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: expensesNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  if (expensesNote.unit.kind !== 'millions') {
    return {
      records: [],
      deferral: {
        reason: `expenses note on page ${expensesNote.page_number} is not explicit millions: ${expensesNote.unit.reason}`,
        phase: 'unit',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: expensesNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  if (revenueNote.errors.length > 0) {
    return {
      records: [],
      deferral: {
        reason: `revenue note parse failed: ${revenueNote.errors.join('; ')}`,
        phase: 'notes',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: expensesNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }
  if (expensesNote.errors.length > 0) {
    return {
      records: [],
      deferral: {
        reason: `expenses note parse failed: ${expensesNote.errors.join('; ')}`,
        phase: 'notes',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: expensesNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  // Exact Note 2(c) check: grants + lease revenue = Other revenue in the statement.
  const grants = revenueNote.government_grants_and_subsidies;
  const lease = revenueNote.lease_revenue;
  const otherRevenueTenths = tenths(statement.other_revenue);
  const grantsLeaseTenths = tenths(grants ?? 0) + tenths(lease ?? 0);
  if (grants === null || lease === null || grantsLeaseTenths !== otherRevenueTenths) {
    return {
      records: [],
      deferral: {
        reason: `Note 2(c) other-revenue mismatch: government grants and subsidies ${grants ?? 'missing'} + lease revenue ${lease ?? 'missing'} does not equal statement Other revenue ${statement.other_revenue}`,
        phase: 'reconciliation',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: expensesNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  // Exact Note 3 checks.
  const dc = expensesNote.defined_contribution_superannuation;
  const db = expensesNote.defined_benefit_superannuation;
  const otherEmployee = expensesNote.other_employee_benefits;
  const otherCosts = expensesNote.other_costs_of_distribution;
  const debtWriteOffs = expensesNote.debt_write_offs;
  const totalOperating = expensesNote.total_operating_expenses;
  const totalPassThrough = expensesNote.total_pass_through_costs;
  const totalDisposal = expensesNote.total_loss_on_disposal;
  const totalDepreciation = expensesNote.total_depreciation_amortisation_impairment;
  const totalDepreciationExpense = expensesNote.depreciation_expense;
  const amortisation = expensesNote.amortisation_intangibles;
  const impairment = expensesNote.impairment_losses;

  const employeeBenefitsTenths = tenths(dc ?? 0) + tenths(db ?? 0) + tenths(otherEmployee ?? 0);
  const operatingComponentsTenths =
    employeeBenefitsTenths + tenths(otherCosts ?? 0) + tenths(debtWriteOffs ?? 0);
  if (
    dc === null ||
    db === null ||
    otherEmployee === null ||
    otherCosts === null ||
    debtWriteOffs === null ||
    totalOperating === null ||
    operatingComponentsTenths !== tenths(totalOperating) ||
    tenths(totalOperating) !== Math.abs(tenths(statement.operating_expenses))
  ) {
    return {
      records: [],
      deferral: {
        reason: `Note 3(b) operating-expenses mismatch: employee benefits ${tenthsLabel(employeeBenefitsTenths)} + other costs ${tenthsLabel(tenths(otherCosts ?? 0))} + debt write-offs ${tenthsLabel(tenths(debtWriteOffs ?? 0))} = ${tenthsLabel(operatingComponentsTenths)}, printed Total operating expenses ${totalOperating ?? 'missing'}, statement Operating expenses ${statement.operating_expenses}`,
        phase: 'reconciliation',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: expensesNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  if (
    totalPassThrough === null ||
    tenths(totalPassThrough) !== Math.abs(tenths(statement.pass_through_costs))
  ) {
    return {
      records: [],
      deferral: {
        reason: `Note 3(a) pass-through mismatch: ${totalPassThrough ?? 'missing'}, statement Pass through costs ${statement.pass_through_costs}`,
        phase: 'reconciliation',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: expensesNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  if (
    totalDisposal === null ||
    tenths(totalDisposal) !== Math.abs(tenths(statement.loss_on_disposal))
  ) {
    return {
      records: [],
      deferral: {
        reason: `Note 3(c) loss-on-disposal mismatch: ${totalDisposal ?? 'missing'}, statement Loss on disposal or write-off ${statement.loss_on_disposal}`,
        phase: 'reconciliation',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: expensesNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  const depreciationComponentsTenths =
    tenths(totalDepreciationExpense ?? 0) + tenths(amortisation ?? 0) + tenths(impairment ?? 0);
  if (
    totalDepreciation === null ||
    totalDepreciationExpense === null ||
    amortisation === null ||
    impairment === null ||
    depreciationComponentsTenths !== tenths(totalDepreciation) ||
    tenths(totalDepreciation) !== Math.abs(tenths(statement.depreciation_amortisation_impairment))
  ) {
    return {
      records: [],
      deferral: {
        reason: `Note 3(d) depreciation/amortisation mismatch: depreciation expense ${totalDepreciationExpense ?? 'missing'} + amortisation ${amortisation ?? 'missing'} + impairment ${impairment ?? 'missing'} = ${tenthsLabel(depreciationComponentsTenths)}, printed total ${totalDepreciation ?? 'missing'}, statement line ${statement.depreciation_amortisation_impairment}`,
        phase: 'reconciliation',
      },
      statement,
      revenue_note: revenueNote,
      expenses_note: expensesNote,
      checks: statement.checks,
      warnings,
      pages_used: pagesUsed,
    };
  }

  const checks = [
    ...statement.checks,
    `Note 2(c) other revenue exact: ${tenthsLabel(tenths(grants))} + ${tenthsLabel(tenths(lease))} = ${tenthsLabel(grantsLeaseTenths)} (statement Other revenue)`,
    `Note 3(b) operating-expenses subtotal exact: employee benefits ${tenthsLabel(employeeBenefitsTenths)} + other costs ${tenthsLabel(tenths(otherCosts))} + debt write-offs ${tenthsLabel(tenths(debtWriteOffs))} = ${tenthsLabel(operatingComponentsTenths)}`,
    `Note 3(b) employee benefits exact: ${tenthsLabel(tenths(dc))} + ${tenthsLabel(tenths(db))} + ${tenthsLabel(tenths(otherEmployee))} = ${tenthsLabel(employeeBenefitsTenths)}`,
    `Note 3(d) depreciation/amortisation subtotal exact: ${tenthsLabel(tenths(totalDepreciationExpense))} + ${tenthsLabel(tenths(amortisation))} + ${tenthsLabel(tenths(impairment))} = ${tenthsLabel(depreciationComponentsTenths)}`,
  ];

  const lineSpecs: EssentialEnergyLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_tenths: tenths(statement.total_revenue),
      funding_source: ESSENTIAL_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total revenue. Includes the separately shown Government grants and subsidies line, which is never added again.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses (exact sum of printed expense lines)',
      amount_tenths: tenths(statement.total_expenses),
      funding_source: ESSENTIAL_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'The statement has no single printed Total expenses subtotal. Total expenses is the exact sum of the printed entity-level expense lines: pass through costs + operating expenses + loss on disposal or write-off of non-financial assets + depreciation, amortisation and impairment + net finance costs. Accepted only because that sum equals the printed Loss before income tax bridge with zero tolerance.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expense',
      amount_tenths: employeeBenefitsTenths,
      funding_source: ESSENTIAL_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Note 3(b) Operating expenses — Employee benefits: defined contribution superannuation + defined benefit superannuation + other employee benefits. A component of Operating expenses and therefore of Total expenses; never add to Total expenses. Excludes employee benefits capitalised into property, plant and equipment.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation, amortisation and impairment',
      amount_tenths: tenths(statement.depreciation_amortisation_impairment),
      funding_source: ESSENTIAL_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed statement line Depreciation, amortisation and impairment. The printed Note 3(d) components (depreciation expense + amortisation of intangible assets + impairment losses) sum to it exactly. A component of Total expenses; never add to it.',
    },
    {
      line_item: 'government_grants_and_subsidies',
      label: 'Government grants and subsidies',
      amount_tenths: tenths(grants),
      funding_source: 'NSW Government (agency not itemised)',
      potential_double_count: true,
      extraction_confidence: 'medium',
      section: 'revenue',
      detail:
        'Separately disclosed in Note 2(c) Other revenue and already included in Total revenue. May overlap NSW government program spending; never add it to the total.',
    },
    {
      line_item: 'net_result',
      label: 'Loss for the year',
      amount_tenths: tenths(statement.net_result),
      funding_source: ESSENTIAL_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
      detail:
        'Printed Loss for the year (net result), a printed negative retained as a non-negative magnitude with soc_printed_sign negative. A result line, not an expense component; never add to revenue or expenses.',
    },
  ];

  const records = lineSpecs.map((spec) =>
    mapLine(spec, context, statement, revenueNote, expensesNote),
  );
  warnings.push(
    'SOC entity rows are provisional and unverified; total expenses is the exact sum of the printed expense lines and reconciles exactly to the printed profit-before-tax and net-result bridges.',
  );
  return {
    records,
    deferral: null,
    statement,
    revenue_note: revenueNote,
    expenses_note: expensesNote,
    checks,
    warnings,
    pages_used: pagesUsed,
  };
}

export interface EssentialEnergyConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: EssentialEnergyAnnualReportLink;
  /** Test-only injection point for the last-resort headless browser fetch. */
  headlessFetch?: HeadlessPdfFetcher;
}

/**
 * Operator escape hatch: when ESSENTIAL_ENERGY_ANNUAL_REPORT_URL is set, it is
 * used as the exact official PDF URL. The default path is live discovery from
 * the official annual-report page (which is behind a Cloudflare HTML challenge
 * on some hosts; the PDF endpoint itself is reachable).
 */
function documentFromEnv(): EssentialEnergyAnnualReportLink | null {
  const url = process.env.ESSENTIAL_ENERGY_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Essential-Energy-Annual-Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const yearMatch = ANNUAL_REPORT_FILENAME.exec(filename);
  const fiscalYear = yearMatch
    ? fiscalYearFromMatch(Number(yearMatch[1]), Number(yearMatch[2]))
    : null;
  if (!fiscalYear) {
    throw new Error(
      `ESSENTIAL_ENERGY_ANNUAL_REPORT_URL filename "${filename}" has no report year; cannot derive fiscal year`,
    );
  }
  const [start, end] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${end}`,
    discovery_page: ESSENTIAL_ENERGY_SOURCE_URL,
  };
}

async function recordDeferral(
  document: Pick<EssentialEnergyAnnualReportLink, 'url' | 'fiscal_year' | 'title'>,
  archive: ArchivedSourceRecord | null,
  deferral: EssentialEnergyDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: ESSENTIAL_ENERGY_ID, document_url: document.url },
    {
      $set: {
        entity: ESSENTIAL_ENERGY_ENTITY,
        jurisdiction: ESSENTIAL_ENERGY_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Essential Energy SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Essential Energy connector. */
export function createEssentialEnergyConnector(
  options: EssentialEnergyConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: null as FetchStrategy | null,
  };

  const connector: Connector = {
    id: ESSENTIAL_ENERGY_ID,
    name: ESSENTIAL_ENERGY_NAME,
    publisher: ESSENTIAL_ENERGY_PUBLISHER,
    source_url: ESSENTIAL_ENERGY_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: ESSENTIAL_ENERGY_LICENSE,
    notes:
      'NSW SOC Phase 5: Essential Energy only. The latest annual report is discovered from Essential Energy\'s official annual-report page (no hard-coded PDF URL; an operator PDF-URL override exists for the Cloudflare-blocked HTML page), SHA-256 archived outside the repo, and parsed for the consolidated statement of comprehensive income. The printed unit must be explicit $M; because the statement has no single printed Total expenses subtotal, total expenses is the exact sum of the printed expense lines and is accepted only when revenue, EBITDA/EBIT, expense-component and profit-before-tax/net-result bridges reconcile exactly. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level "soc", aggregation_role "agency_detail"). SOC rows are never added to government program spending, the PNFC benchmark, or each other. Other SOCs are not implemented.',
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      metadata.fetchStrategy = null;
      const override = options.document ?? documentFromEnv() ?? undefined;
      const resolved = await resolveSocDocument({
        source_id: ESSENTIAL_ENERGY_ID,
        source_label: 'Essential Energy',
        fetchImpl,
        discoverDirect: async () =>
          override ?? (await discoverEssentialEnergyAnnualReport(fetchImpl)),
        directDocument: override,
        discoveryPageUrl: ESSENTIAL_ENERGY_SOURCE_URL,
        headlessFetch: options.headlessFetch,
      });
      metadata.fetchStrategy = resolved.strategy;
      const document = resolved.document;
      const archived = await archiveSourceDocument({
        source_id: ESSENTIAL_ENERGY_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: resolved.retrieved_from,
        archived_from: resolved.archived_from,
        filename: resolved.filename,
        content_type: 'application/pdf',
        data: resolved.bytes,
        root: options.archiveRoot,
        notes: resolved.note,
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      const now = options.now?.() ?? new Date();
      const context: EssentialEnergyParseContext = {
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
      const parsed = parseEssentialEnergyExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'essential-energy-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'essential-energy-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not an Essential Energy measure; skipped');
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
