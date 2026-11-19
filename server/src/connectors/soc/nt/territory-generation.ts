import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
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
  type MoneyUnitKind,
} from '../../pdf-extract.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../../source-archive.js';
import { DeferredSocDocumentModel } from '../../../models/index.js';
import type { Connector, RawRecord } from '../../types.js';

/**
 * NT SOC — Territory Generation annual-report adapter.
 *
 * Territory Generation is a Northern Territory Government Owned Corporation
 * (GOC) and the Territory's electricity generator. This is the SECOND NT
 * state-owned-entity source, after Jacana Energy. It is deliberately one entity
 * only: the NT GOC list is not authoritatively consolidated here, so no other
 * NT GOC/government business division and no NT/state/national total is
 * claimed or created.
 *
 * Source gate:
 * - The latest report is discovered from the official "Corporate publications"
 *   page; no PDF URL is hard-coded. The `NT_TERRITORY_GENERATION_ANNUAL_REPORT_URL`
 *   environment variable is an operator override, not the default path.
 * - The exact PDF bytes are SHA-256 archived outside the repo, with
 *   `SHA256SUMS` and `retrieval.json` sidecars.
 * - The audited statement and notes print an explicit "$'000" unit. Ambiguous
 *   or missing units are rejected, never guessed.
 * - Five printed lines are read: Total revenue (Revenue + Other income, exact
 *   sum of printed face lines), Total expenses (exact sum of the printed Cost
 *   of energy, Administrative expenses, Other expenses, Impairment and Finance
 *   costs face lines), Employee expenses (the two printed Note 4 Employee
 *   benefits expense lines), Depreciation and amortisation (the two printed
 *   Note 4 lines, equal to the printed Note 20 reconciliation) and Profit for
 *   the year (printed face line). Every printed note subtotal and the
 *   gross-profit, profit-before-income-tax, net-result and comprehensive-income
 *   bridges reconcile at zero tolerance.
 *
 * Every row is an entity-level SOC statement line: jurisdiction "NT",
 * jurisdiction_level "soc", aggregation_role "agency_detail", measure_type
 * "actual", provisional and verified:false. Territory Generation rows are never
 * added to government program spending, the PNFC benchmark, another SOC entity,
 * an NT total, a state total or a national total.
 */

export const TERRITORY_GENERATION_ID = 'nt-territory-generation';
export const TERRITORY_GENERATION_NAME = 'Territory Generation — Annual Report';
export const TERRITORY_GENERATION_PUBLISHER = 'Territory Generation';
export const TERRITORY_GENERATION_ENTITY = 'Territory Generation';
export const TERRITORY_GENERATION_JURISDICTION = 'NT';
export const TERRITORY_GENERATION_LEGAL_CLASS =
  'Northern Territory Government Owned Corporation (GOC) — electricity generator';
export const TERRITORY_GENERATION_SOURCE_URL =
  'https://www.territorygeneration.com.au/news-publications/corporate-publications/';
export const TERRITORY_GENERATION_LICENSE =
  '© Territory Generation. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const TERRITORY_GENERATION_UNIT = 'AUD_thousands';
export const TERRITORY_GENERATION_UNIT_LABEL = "$'000";
export const TERRITORY_GENERATION_UNIT_TO_CENTS = 100_000;
export const TERRITORY_GENERATION_CAVEAT =
  "Entity-level SOC statement lines for Territory Generation only, a Northern Territory Government Owned Corporation and electricity generator (the second NT source after Jacana Energy). The NT GOC list is not claimed to be complete and this source is not an NT total. Never add Territory Generation to government program spending, to the PNFC sector benchmark, to another NT GOC or government business division, to another state's SOC/GTE, to an NT total, a state total or a national total, or to each other: total revenue is the exact sum of the printed face Revenue and Other income lines; total expenses is the exact sum of the printed Cost of energy, Administrative expenses, Other expenses, Impairment and Finance costs lines; employee expenses is the sum of the two printed Note 4 Employee benefits expense lines (Cost of energy and Administrative expenses); depreciation/amortisation is the sum of the two printed Note 4 lines, equal to the printed Note 20 reconciliation; the net result is the printed Profit for the year. Provisional and unverified.";

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface TerritoryGenerationAnnualReportLink {
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

const ANNUAL_REPORT_PDF = /annual[\s_\-–]*report/i;

/** Parse a filename such as "Annual-Report-2025-26.pdf" into "2025-26". */
export function territoryGenerationFiscalYearFromFilename(filename: string): string | null {
  const decoded = decodeURIComponent(filename);
  const range = /(\d{4})[\s_\-–]*(\d{2,4})/.exec(decoded);
  if (!range) return null;
  const start = Number(range[1]);
  const endRaw = range[2] as string;
  const end = endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
  if (!Number.isInteger(start) || start < 2001 || start > 2100) return null;
  if (end !== start + 1) return null;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/** Convert "year ended 30 June 2026" into the API fiscal year "2025-26". */
export function territoryGenerationFiscalYearFromEndDate(endDate: string): string | null {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(endDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/**
 * Parse annual-report PDF links from the official page. Only PDF filenames that
 * contain "annual report" and a start/end year range are accepted, so the page
 * can also list Statements of Corporate Intent and other publications without
 * corrupting the latest selection.
 */
export function parseTerritoryGenerationAnnualReportLinks(
  html: string,
  pageUrl: string = TERRITORY_GENERATION_SOURCE_URL,
): TerritoryGenerationAnnualReportLink[] {
  const links: TerritoryGenerationAnnualReportLink[] = [];
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
    if (!ANNUAL_REPORT_PDF.test(filename)) continue;
    const fiscalYear = territoryGenerationFiscalYearFromFilename(filename);
    if (!fiscalYear) continue;
    const key = `${url.origin}${url.pathname}${url.search}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [start] = fiscalYear.split('-');
    const end = Number(start) + 1;
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

/**
 * Fetch the official corporate-publications page and return its newest
 * annual-report PDF. If no annual-report link is present the adapter fails
 * loudly rather than pinning a URL that can rot.
 */
export async function discoverTerritoryGenerationAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  indexUrl: string = TERRITORY_GENERATION_SOURCE_URL,
): Promise<TerritoryGenerationAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(indexUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `Territory Generation official page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Territory Generation official page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseTerritoryGenerationAnnualReportLinks(html, indexUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Territory Generation official page contains no annual-report PDF link; refusing to hard-code a URL',
    );
  }
  return latest;
}

interface PageRow {
  y: number;
  items: PdfTextItem[];
  cells: string[];
  label: string;
}

function groupPageRows(items: readonly PdfTextItem[], tolerance = 4.5): PageRow[] {
  const groups: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.y - item.y) <= tolerance) last.items.push(item);
    else groups.push({ y: item.y, items: [item] });
  }
  return groups
    .map((group) => {
      const rowItems = [...group.items].sort((a, b) => a.x - b.x);
      const cells = rowItems.map((item) => item.str.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const label = rowItems
        .filter((item) => item.x < 340)
        .map((item) => item.str.replace(/\s+/g, ' ').trim())
        .filter((text) => text.length > 0)
        .filter((text) => !/^\(\w\)$/.test(text) && !/^\d+[a-z]?$/.test(text))
        .join(' ')
        .trim();
      return { y: group.y, items: rowItems, cells, label };
    })
    .filter((row) => row.cells.length > 0)
    .sort((a, b) => b.y - a.y);
}

/** The 2026 money column is anchored from the first printed unit cell. */
function columnAnchor(rows: readonly PageRow[]): number | null {
  const unitItems = rows
    .flatMap((row) => row.items)
    .filter((item) => item.str.includes('$'))
    .sort((a, b) => a.x - b.x);
  const first = unitItems[0];
  return first ? first.x + first.width : null;
}

interface CellValue {
  value: number | null;
  found: boolean;
  nil: boolean;
}

function cellNear(row: PageRow, anchor: number, tolerance = 22): CellValue {
  let best: { value: number | null; distance: number; nil: boolean } | null = null;
  for (const item of row.items) {
    const text = item.str.trim();
    const nil = /^(?:-|–|—)$/.test(text);
    const parsed = parseAmountCell(text);
    if (parsed.value === null && !nil) continue;
    const distance = Math.abs(item.x + item.width - anchor);
    if (distance > tolerance) continue;
    const candidate = { value: parsed.value, distance, nil };
    if (!best || distance < best.distance) best = candidate;
  }
  if (!best) return { value: null, found: false, nil: false };
  return { value: best.nil ? 0 : best.value, found: true, nil: best.nil };
}

function findRow(
  rows: readonly PageRow[],
  label: string,
  options: { withMoney?: boolean } = {},
): PageRow | null {
  const wanted = label.toLowerCase();
  const matches = rows.filter((row) => row.label.toLowerCase() === wanted);
  const usable = options.withMoney
    ? matches.filter((row) => row.items.some((item) => parseAmountCell(item.str).value !== null))
    : matches;
  return usable[0] ?? null;
}

function readValue(
  rows: readonly PageRow[],
  label: string,
  anchor: number,
  options: { withMoney?: boolean } = {},
): CellValue {
  const row = findRow(rows, label, options);
  return row ? cellNear(row, anchor) : { value: null, found: false, nil: false };
}

/** Read every printed row with an exact label, top to bottom. */
function readValuesInOrder(
  rows: readonly PageRow[],
  label: string,
  anchor: number,
): Array<{ value: number; y: number }> {
  const wanted = label.toLowerCase();
  const out: Array<{ value: number; y: number }> = [];
  for (const row of rows) {
    if (row.label.toLowerCase() !== wanted) continue;
    const cell = cellNear(row, anchor);
    if (!cell.found || cell.value === null) continue;
    out.push({ value: cell.value, y: row.y });
  }
  return out;
}

export interface TerritoryGenerationStatement {
  page_number: number;
  note_page_number: number;
  cashflow_page_number: number;
  unit: UnitDetection;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  depreciation_amortisation: number;
  net_result: number;
  profit_before_income_tax: number;
  income_tax_expense: number;
  revenue_components: {
    electricity_sales: number;
    deferred_grant_income: number;
    other_revenue: number;
    claim_recoveries_and_other_income: number;
    interest_income: number;
  };
  expense_components: {
    cost_of_energy: number;
    administrative_expenses: number;
    other_expenses: number;
    impairment_net: number;
    finance_costs: number;
    employee_cost_of_energy: number;
    employee_administrative: number;
    depreciation_cost_of_energy: number;
    depreciation_administrative: number;
  };
  checks: string[];
  warnings: string[];
  errors: string[];
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('statement of profit or loss and other comprehensive income') &&
      text.includes('gross profit') &&
      text.includes('profit before income tax') &&
      text.includes('profit for the year')
    ) {
      return page;
    }
  }
  return null;
}

function findNotesPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('electricity sales') &&
      text.includes('deferred grant income') &&
      text.includes('employee benefits expense') &&
      text.includes('total cost of energy') &&
      text.includes('total administrative expenses')
    ) {
      return page;
    }
  }
  return null;
}

function findCashflowPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('reconciliation of profit after income tax to') &&
      text.includes('net cash from operating activities') &&
      text.includes('depreciation and amortisation')
    ) {
      return page;
    }
  }
  return null;
}

function unitSamples(pages: readonly PdfPage[]): string[] {
  return pages
    .flatMap((page) => page.items)
    .map((item) => item.str.trim())
    .filter((text) => text.includes('$'));
}

function supportedUnit(kind: MoneyUnitKind | null): kind is 'dollars' | 'thousands' | 'millions' {
  return kind === 'dollars' || kind === 'thousands' || kind === 'millions';
}

export function parseTerritoryGenerationStatement(
  facePage: PdfPage,
  notesPage: PdfPage,
  cashflowPage: PdfPage,
  unit: UnitDetection,
): TerritoryGenerationStatement | null {
  const faceRows = groupPageRows(facePage.items);
  const noteRows = groupPageRows(notesPage.items);
  const cashflowRows = groupPageRows(cashflowPage.items);
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const faceAnchor = columnAnchor(faceRows);
  const noteAnchor = columnAnchor(noteRows);
  const cashflowAnchor = columnAnchor(cashflowRows);
  if (faceAnchor === null || noteAnchor === null || cashflowAnchor === null) {
    errors.push('printed money column could not be anchored from the unit header');
    return null;
  }

  const requireValue = (rows: readonly PageRow[], label: string, anchor: number): number | null => {
    const cell = readValue(rows, label, anchor, { withMoney: true });
    if (!cell.found || cell.value === null) {
      errors.push(`statement is missing required printed line: ${label}`);
      return null;
    }
    return cell.value;
  };

  const face = {
    revenue: requireValue(faceRows, 'Revenue', faceAnchor),
    costOfEnergy: requireValue(faceRows, 'Cost of energy', faceAnchor),
    grossProfit: requireValue(faceRows, 'Gross profit', faceAnchor),
    otherIncome: requireValue(faceRows, 'Other income', faceAnchor),
    administrative: requireValue(faceRows, 'Administrative expenses', faceAnchor),
    otherExpenses: requireValue(faceRows, 'Other expenses', faceAnchor),
    impairment: requireValue(faceRows, 'Impairment (reversals)/expenses', faceAnchor),
    financeCosts: requireValue(faceRows, 'Finance costs', faceAnchor),
    profitBeforeTax: requireValue(faceRows, 'Profit before income tax', faceAnchor),
    incomeTax: requireValue(faceRows, 'Income tax expense', faceAnchor),
    netResult: requireValue(faceRows, 'Profit for the year', faceAnchor),
    comprehensive: requireValue(faceRows, 'Total comprehensive income for the year', faceAnchor),
  };

  const notes = {
    electricitySales: requireValue(noteRows, 'Electricity sales', noteAnchor),
    deferredGrant: requireValue(noteRows, 'Deferred grant income', noteAnchor),
    otherRevenue: requireValue(noteRows, 'Other revenue', noteAnchor),
    claimRecoveries: requireValue(noteRows, 'Claim recoveries and other income', noteAnchor),
    interestIncome: requireValue(noteRows, 'Interest income', noteAnchor),
    totalCostOfEnergy: requireValue(noteRows, 'Total cost of energy', noteAnchor),
    totalAdministrative: requireValue(noteRows, 'Total administrative expenses', noteAnchor),
    totalOtherExpenses: requireValue(noteRows, 'Total other expenses', noteAnchor),
    totalImpairment: requireValue(noteRows, 'Total net impairment of assets', noteAnchor),
    totalFinanceCosts: requireValue(noteRows, 'Total finance costs', noteAnchor),
    energyCosts: requireValue(noteRows, 'Energy costs', noteAnchor),
    repairsMaintenance: requireValue(noteRows, 'Repairs and maintenance', noteAnchor),
    propertyCosts: requireValue(noteRows, 'Property costs', noteAnchor),
    otherAdministrativeCosts: readValuesInOrder(noteRows, 'Other administrative costs', noteAnchor),
    inventoryValuation: requireValue(noteRows, 'Inventory valuation', noteAnchor),
    insurance: requireValue(noteRows, 'Insurance', noteAnchor),
    itCommunications: requireValue(noteRows, 'IT and communications', noteAnchor),
    professionalFees: requireValue(noteRows, 'Professional fees', noteAnchor),
    operationalProjects: requireValue(noteRows, 'Operational projects', noteAnchor),
    foreignExchange: requireValue(noteRows, 'Foreign exchange loss/(gain)', noteAnchor),
    impairmentExpense: requireValue(noteRows, 'Impairment expense', noteAnchor),
    impairmentReversal: requireValue(noteRows, 'Impairment reversal', noteAnchor),
    interestFinanceCharges: requireValue(noteRows, 'Interest and finance charges', noteAnchor),
  };

  const employeeRows = readValuesInOrder(noteRows, 'Employee benefits expense', noteAnchor);
  const depreciationRows = readValuesInOrder(noteRows, 'Depreciation and amortisation', noteAnchor);
  if (employeeRows.length !== 2) {
    errors.push(
      `expected two printed Note 4 Employee benefits expense lines (Cost of energy and Administrative expenses), found ${employeeRows.length}`,
    );
  }
  if (depreciationRows.length !== 2) {
    errors.push(
      `expected two printed Note 4 Depreciation and amortisation lines (Cost of energy and Administrative expenses), found ${depreciationRows.length}`,
    );
  }
  const cashflowDepreciation = requireValue(
    cashflowRows,
    'Depreciation and amortisation',
    cashflowAnchor,
  );

  if (errors.length > 0) return null;

  const abs = (value: number | null): number => Math.abs(value as number);
  const faceRevenue = abs(face.revenue);
  const faceCostOfEnergy = abs(face.costOfEnergy);
  const faceGrossProfit = abs(face.grossProfit);
  const faceOtherIncome = abs(face.otherIncome);
  const faceAdministrative = abs(face.administrative);
  const faceOtherExpenses = abs(face.otherExpenses);
  const faceImpairment = face.impairment as number; // printed as a reversal credit
  const faceFinanceCosts = abs(face.financeCosts);
  const profitBeforeTax = abs(face.profitBeforeTax);
  const incomeTax = abs(face.incomeTax);
  const netResult = face.netResult as number;
  const comprehensive = abs(face.comprehensive);

  const electricitySales = abs(notes.electricitySales);
  const deferredGrant = abs(notes.deferredGrant);
  const otherRevenue = abs(notes.otherRevenue);
  const claimRecoveries = abs(notes.claimRecoveries);
  const interestIncome = abs(notes.interestIncome);
  const totalCostOfEnergy = abs(notes.totalCostOfEnergy);
  const totalAdministrative = abs(notes.totalAdministrative);
  const totalOtherExpenses = abs(notes.totalOtherExpenses);
  const totalImpairment = notes.totalImpairment as number;
  const totalFinanceCosts = abs(notes.totalFinanceCosts);
  const energyCosts = abs(notes.energyCosts);
  const repairsMaintenance = abs(notes.repairsMaintenance);
  const propertyCosts = abs(notes.propertyCosts);
  const otherAdministrativeCosts = notes.otherAdministrativeCosts.map((entry) => abs(entry.value));
  const inventoryValuation = abs(notes.inventoryValuation);
  const insurance = abs(notes.insurance);
  const itCommunications = abs(notes.itCommunications);
  const professionalFees = abs(notes.professionalFees);
  const operationalProjects = abs(notes.operationalProjects);
  const foreignExchange = abs(notes.foreignExchange);
  const impairmentExpense = abs(notes.impairmentExpense);
  const impairmentReversal = notes.impairmentReversal as number;
  const interestFinanceCharges = abs(notes.interestFinanceCharges);

  const employeeCostOfEnergy = abs(employeeRows[0]?.value as number);
  const employeeAdministrative = abs(employeeRows[1]?.value as number);
  const employeeExpenses = employeeCostOfEnergy + employeeAdministrative;
  const depreciationCostOfEnergy = abs(depreciationRows[0]?.value as number);
  const depreciationAdministrative = abs(depreciationRows[1]?.value as number);
  const depreciationTotal = depreciationCostOfEnergy + depreciationAdministrative;

  const expectEqual = (label: string, actual: number, printed: number): void => {
    checks.push(`${label}: ${actual} = ${printed}`);
    if (actual !== printed) errors.push(`${label} mismatch: ${actual}, printed ${printed}`);
  };

  // Note 3 revenue components reconcile to the printed face Revenue line.
  expectEqual(
    'Note 3 revenue components = face Revenue',
    electricitySales + deferredGrant + otherRevenue,
    faceRevenue,
  );
  expectEqual(
    'Note 3 other income components = face Other income',
    claimRecoveries + interestIncome,
    faceOtherIncome,
  );

  // Note 4 expense sections reconcile to their printed subtotal lines.
  expectEqual(
    'Note 4 total cost of energy',
    energyCosts +
      repairsMaintenance +
      employeeCostOfEnergy +
      propertyCosts +
      (otherAdministrativeCosts[0] as number) +
      inventoryValuation +
      depreciationCostOfEnergy,
    totalCostOfEnergy,
  );
  expectEqual(
    'Note 4 total administrative expenses',
    employeeAdministrative +
      insurance +
      itCommunications +
      professionalFees +
      (otherAdministrativeCosts[1] as number) +
      depreciationAdministrative,
    totalAdministrative,
  );
  expectEqual(
    'Note 4 total other expenses',
    operationalProjects + foreignExchange,
    totalOtherExpenses,
  );
  expectEqual(
    'Note 4 total net impairment of assets',
    impairmentExpense + impairmentReversal,
    totalImpairment,
  );
  expectEqual('Note 4 total finance costs', interestFinanceCharges, totalFinanceCosts);

  // Note 4 subtotals equal the printed face expense lines.
  expectEqual(
    'Note 4 total cost of energy = face Cost of energy',
    totalCostOfEnergy,
    faceCostOfEnergy,
  );
  expectEqual(
    'Note 4 total administrative expenses = face Administrative expenses',
    totalAdministrative,
    faceAdministrative,
  );
  expectEqual(
    'Note 4 total other expenses = face Other expenses',
    totalOtherExpenses,
    faceOtherExpenses,
  );
  expectEqual(
    'Note 4 total net impairment of assets = face Impairment (reversals)/expenses',
    totalImpairment,
    faceImpairment,
  );
  expectEqual(
    'Note 4 total finance costs = face Finance costs',
    totalFinanceCosts,
    faceFinanceCosts,
  );

  const totalRevenue = faceRevenue + faceOtherIncome;
  const totalExpenses =
    faceCostOfEnergy + faceAdministrative + faceOtherExpenses + faceImpairment + faceFinanceCosts;
  checks.push(
    `total revenue exact: face Revenue ${faceRevenue} + face Other income ${faceOtherIncome} = ${totalRevenue} (derived; no single printed Total revenue line)`,
  );
  checks.push(
    `total expenses exact: face Cost of energy ${faceCostOfEnergy} + Administrative expenses ${faceAdministrative} + Other expenses ${faceOtherExpenses} + Impairment ${faceImpairment} + Finance costs ${faceFinanceCosts} = ${totalExpenses} (derived; no single printed Total expenses line)`,
  );

  expectEqual('gross-profit bridge', faceRevenue - faceCostOfEnergy, faceGrossProfit);

  const preTaxBridge = totalRevenue - totalExpenses;
  checks.push(
    `profit-before-income-tax bridge: ${totalRevenue} - ${totalExpenses} = ${preTaxBridge}`,
  );
  if (preTaxBridge !== profitBeforeTax) {
    errors.push(
      `profit-before-income-tax bridge mismatch: ${totalRevenue} - ${totalExpenses} = ${preTaxBridge}, printed Profit before income tax ${profitBeforeTax}`,
    );
  }

  const netBridge = profitBeforeTax - incomeTax;
  checks.push(`net-result bridge: ${profitBeforeTax} - ${incomeTax} = ${netBridge}`);
  if (netBridge !== netResult) {
    errors.push(
      `net-result bridge mismatch: ${profitBeforeTax} - ${incomeTax} = ${netBridge}, printed Profit for the year ${netResult}`,
    );
  }

  expectEqual('total comprehensive income = net result (OCI nil)', netResult, comprehensive);

  checks.push(
    `employee expenses exact: Note 4(a) ${employeeCostOfEnergy} + Note 4(b) ${employeeAdministrative} = ${employeeExpenses} (two printed component lines; each already reconciles into its printed subtotal)`,
  );
  checks.push(
    `depreciation and amortisation exact: Note 4(a) ${depreciationCostOfEnergy} + Note 4(b) ${depreciationAdministrative} = ${depreciationTotal} (two printed component lines)`,
  );
  expectEqual(
    'Note 4 depreciation total = Note 20 printed reconciliation',
    depreciationTotal,
    abs(cashflowDepreciation),
  );

  warnings.push(
    "the audited statement and notes print an explicit $'000 unit. The face statement prints Revenue, Other income, Cost of energy, Administrative expenses, Other expenses, Impairment (reversals)/expenses, Finance costs, Profit before income tax, Income tax expense, Profit for the year and Total comprehensive income. Notes 3 and 4 print the revenue and expense components and their subtotals; Note 20 prints the depreciation and amortisation reconciliation. There is no single printed Total revenue or Total expenses line, so those two rows are the exact sums of the printed face lines and are accepted only because the gross-profit, profit-before-income-tax, net-result and comprehensive-income bridges agree at zero tolerance. No other entity and no NT total is read or computed.",
  );

  return {
    page_number: facePage.page_number,
    note_page_number: notesPage.page_number,
    cashflow_page_number: cashflowPage.page_number,
    unit,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    employee_expenses: employeeExpenses,
    depreciation_amortisation: depreciationTotal,
    net_result: netResult,
    profit_before_income_tax: profitBeforeTax,
    income_tax_expense: incomeTax,
    revenue_components: {
      electricity_sales: electricitySales,
      deferred_grant_income: deferredGrant,
      other_revenue: otherRevenue,
      claim_recoveries_and_other_income: claimRecoveries,
      interest_income: interestIncome,
    },
    expense_components: {
      cost_of_energy: totalCostOfEnergy,
      administrative_expenses: totalAdministrative,
      other_expenses: totalOtherExpenses,
      impairment_net: totalImpairment,
      finance_costs: totalFinanceCosts,
      employee_cost_of_energy: employeeCostOfEnergy,
      employee_administrative: employeeAdministrative,
      depreciation_cost_of_energy: depreciationCostOfEnergy,
      depreciation_administrative: depreciationAdministrative,
    },
    checks,
    warnings,
    errors,
  };
}

export interface TerritoryGenerationParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export type TerritoryGenerationDeferralPhase =
  'discovery' | 'document' | 'statement' | 'unit' | 'reconciliation';

export interface TerritoryGenerationDeferral {
  reason: string;
  phase: TerritoryGenerationDeferralPhase;
}

export interface TerritoryGenerationLineSpec {
  line_item: string;
  label: string;
  amount_source: number;
  funding_source: string;
  potential_double_count: boolean;
  extraction_confidence: ExtractionConfidence;
  section: 'revenue' | 'expenses' | 'result';
  detail: string;
  printed_sign?: 'positive' | 'negative';
}

export interface TerritoryGenerationParseResult {
  records: SpendingRecord[];
  deferral: TerritoryGenerationDeferral | null;
  statement: TerritoryGenerationStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function territoryGenerationNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${TERRITORY_GENERATION_ID}:${createHash('sha256')
    .update(`${entity}\u001f${fiscalYear}\u001f${lineItem}\u001f${documentUrl}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function unitToCents(kind: MoneyUnitKind): number {
  switch (kind) {
    case 'dollars':
      return 100;
    case 'thousands':
      return 100_000;
    case 'millions':
      return 100_000_000;
    default:
      throw new Error(`unsupported SOC unit ${kind}`);
  }
}

function unitName(kind: MoneyUnitKind): string {
  return kind === 'dollars' ? 'AUD' : kind === 'millions' ? 'AUD_millions' : 'AUD_thousands';
}

function amountCents(sourceUnits: number, kind: MoneyUnitKind): number {
  const cents = Math.abs(sourceUnits) * unitToCents(kind);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`SOC amount ${sourceUnits} ${kind} exceeds safe integer cents`);
  }
  return cents;
}

function notesFor(
  context: TerritoryGenerationParseContext,
  spec: TerritoryGenerationLineSpec,
  statement: TerritoryGenerationStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${statement.unit.kind} (${statement.unit.reason}; x${unitToCents(statement.unit.kind as MoneyUnitKind)} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `notes_page: ${statement.note_page_number}`,
    `cashflow_reconciliation_page: ${statement.cashflow_page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'single Territory Generation entity; NT GOC; second NT source after Jacana Energy; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, another NT GOC, another state SOC/GTE, an NT total, a state total, a national total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: TerritoryGenerationLineSpec,
  context: TerritoryGenerationParseContext,
  statement: TerritoryGenerationStatement,
): SpendingRecord {
  const kind = statement.unit.kind as MoneyUnitKind;
  return {
    amount_cents: amountCents(spec.amount_source, kind),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: TERRITORY_GENERATION_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: territoryGenerationNaturalKey(
      TERRITORY_GENERATION_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${TERRITORY_GENERATION_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: TERRITORY_GENERATION_JURISDICTION,
    delivery_entity: TERRITORY_GENERATION_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Territory Generation Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: TERRITORY_GENERATION_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: unitName(kind),
    soc_section: spec.section,
    soc_note:
      'Statement of profit or loss and other comprehensive income; Note 3 Revenue; Note 4 Expenses; Note 20 depreciation reconciliation',
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      total_revenue_source_units: statement.total_revenue,
      total_expenses_source_units: statement.total_expenses,
      profit_before_income_tax_source_units: statement.profit_before_income_tax,
      net_result_source_units: statement.net_result,
      employee_expenses_source_units: statement.employee_expenses,
      depreciation_amortisation_source_units: statement.depreciation_amortisation,
      checks: statement.checks.join(' | '),
    }),
  };
}

export function parseTerritoryGenerationExtraction(
  extraction: PdfExtraction,
  context: TerritoryGenerationParseContext,
): TerritoryGenerationParseResult {
  const warnings: string[] = [];
  const facePage = findStatementPage(extraction.pages);
  const notesPage = findNotesPage(extraction.pages);
  const cashflowPage = findCashflowPage(extraction.pages);
  if (!facePage || !notesPage || !cashflowPage) {
    return {
      records: [],
      deferral: {
        reason:
          'no parseable statement of profit or loss and other comprehensive income with Note 3 Revenue, Note 4 Expenses and Note 20 depreciation reconciliation found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }

  const unit = detectMoneyUnit(unitSamples([facePage, notesPage, cashflowPage]));
  if (unit.ambiguous || unit.kind === null || !supportedUnit(unit.kind)) {
    return {
      records: [],
      deferral: {
        reason: `printed unit is not one explicit supported unit (detected ${unit.kind ?? 'none'}: ${unit.reason}); refusing to ingest as dollars, thousands or millions by magnitude`,
        phase: 'unit',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [facePage.page_number, notesPage.page_number, cashflowPage.page_number],
    };
  }

  const statement = parseTerritoryGenerationStatement(facePage, notesPage, cashflowPage, unit);
  if (!statement) {
    return {
      records: [],
      deferral: {
        reason:
          'audited statement/notes found but required printed lines or printed subtotals could not be parsed',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [facePage.page_number, notesPage.page_number, cashflowPage.page_number],
    };
  }
  warnings.push(...statement.warnings);
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
      pages_used: [facePage.page_number, notesPage.page_number, cashflowPage.page_number],
    };
  }

  const endDate = /year ended 30 June (\d{4})/i.exec(extraction.text);
  const derivedFiscalYear = endDate
    ? territoryGenerationFiscalYearFromEndDate(`${endDate[1]}-06-30`)
    : null;
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
      pages_used: [facePage.page_number, notesPage.page_number, cashflowPage.page_number],
    };
  }

  const lineSpecs: TerritoryGenerationLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_source: statement.total_revenue,
      funding_source: TERRITORY_GENERATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Exact sum of the printed face Revenue line and Other income line. Note 3 prints the components of each; there is no single printed Total revenue line, so the derived total is accepted only because it bridges to the printed Profit before income tax and Profit for the year. Entity-level revenue; never added to government program spending or another entity.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_source: statement.total_expenses,
      funding_source: TERRITORY_GENERATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Exact sum of the printed face Cost of energy, Administrative expenses, Other expenses, Impairment (reversals)/expenses and Finance costs lines. Note 4 prints each subtotal; there is no single printed Total expenses line, so the derived total is accepted only because it bridges to the printed Profit before income tax and Profit for the year.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expense',
      amount_source: statement.employee_expenses,
      funding_source: TERRITORY_GENERATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Sum of the two printed Note 4 Employee benefits expense component lines (Cost of energy and Administrative expenses). Each printed component already reconciles into its printed note subtotal. A component of Total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_source: statement.depreciation_amortisation,
      funding_source: TERRITORY_GENERATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Sum of the two printed Note 4 Depreciation and amortisation component lines (Cost of energy and Administrative expenses), equal to the printed Note 20 reconciliation total. A component of Total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit for the year',
      amount_source: statement.net_result,
      funding_source: TERRITORY_GENERATION_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit for the year (net result after income tax), which bridges exactly to Profit before income tax - Income tax expense. A result line, not an expense component; never added to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the printed note subtotals and the gross-profit, profit-before-income-tax, net-result and total-comprehensive-income bridges reconcile exactly at zero tolerance.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks: statement.checks,
    warnings,
    pages_used: [facePage.page_number, notesPage.page_number, cashflowPage.page_number],
  };
}

export interface TerritoryGenerationConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: TerritoryGenerationAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'territory-generation-annual-report.pdf';
}

/**
 * Operator escape hatch: when `NT_TERRITORY_GENERATION_ANNUAL_REPORT_URL` is
 * set, it is used as the exact official PDF URL. The default path is live
 * discovery from the official corporate-publications page.
 */
function documentFromEnv(): TerritoryGenerationAnnualReportLink | null {
  const url = process.env.NT_TERRITORY_GENERATION_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Territory Generation Annual Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = territoryGenerationFiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `NT_TERRITORY_GENERATION_ANNUAL_REPORT_URL filename "${filename}" has no annual-report year range; cannot derive fiscal year`,
    );
  }
  const [start] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${Number(start) + 1}`,
    discovery_page: TERRITORY_GENERATION_SOURCE_URL,
  };
}

async function writeArchiveSidecars(
  archived: ArchivedSourceRecord,
  document: TerritoryGenerationAnnualReportLink,
  pdfPages: number,
): Promise<void> {
  const directory = path.dirname(archived.local_path);
  const filename = path.basename(archived.local_path);
  await writeFile(path.join(directory, 'SHA256SUMS'), `${archived.sha256}  ${filename}\n`, 'utf8');
  await writeFile(
    path.join(directory, 'retrieval.json'),
    `${JSON.stringify(
      {
        source_id: TERRITORY_GENERATION_ID,
        entity: TERRITORY_GENERATION_ENTITY,
        jurisdiction: TERRITORY_GENERATION_JURISDICTION,
        legal_class: TERRITORY_GENERATION_LEGAL_CLASS,
        title: document.title,
        document_url: document.url,
        discovery_page: document.discovery_page,
        retrieved_at: new Date().toISOString(),
        fetched_at: archived.fetched_at,
        last_modified: archived.last_modified,
        content_type: archived.content_type,
        bytes: archived.bytes,
        sha256: archived.sha256,
        pdf_pages: pdfPages,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function recordDeferral(
  document: TerritoryGenerationAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: TerritoryGenerationDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: TERRITORY_GENERATION_ID, document_url: document.url },
    {
      $set: {
        entity: TERRITORY_GENERATION_ENTITY,
        jurisdiction: TERRITORY_GENERATION_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Territory Generation SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Territory Generation connector. */
export function createTerritoryGenerationConnector(
  options: TerritoryGenerationConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: TERRITORY_GENERATION_ID,
    name: TERRITORY_GENERATION_NAME,
    publisher: TERRITORY_GENERATION_PUBLISHER,
    source_url: TERRITORY_GENERATION_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: TERRITORY_GENERATION_LICENSE,
    notes:
      "NT SOC (second NT state-owned-entity source, after Jacana Energy): Territory Generation only, a Northern Territory Government Owned Corporation and electricity generator. The latest annual report is discovered from the official 'Corporate publications' page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo with SHA256SUMS and retrieval.json. The audited statement and notes print an explicit $'000 unit; the adapter reads the face Revenue, Other income, Cost of energy, Administrative expenses, Other expenses, Impairment and Finance costs lines, the Note 3 revenue components, the Note 4 expense subtotals and the Note 20 depreciation reconciliation. There is no single printed Total revenue or Total expenses line, so those two rows are the exact sums of the printed face lines and are accepted only because the gross-profit, profit-before-income-tax, net-result and comprehensive-income bridges reconcile exactly at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level 'soc', aggregation_role 'agency_detail'). The NT GOC list is not claimed to be complete; Territory Generation is never added to government program spending, the PNFC benchmark, another NT GOC, another state's SOC/GTE, an NT total, a state total, a national total, or another SOC line.",
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverTerritoryGenerationAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(
          `Territory Generation PDF fetch HTTP ${response.status} for ${document.url}`,
        );
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: TERRITORY_GENERATION_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Territory Generation annual-report PDF; archived for auditable Northern Territory SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      await writeArchiveSidecars(archived, document, extraction.pages.length);
      const now = options.now?.() ?? new Date();
      const context: TerritoryGenerationParseContext = {
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
      const parsed = parseTerritoryGenerationExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'nt-territory-generation-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'nt-territory-generation-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Territory Generation measure; skipped');
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
