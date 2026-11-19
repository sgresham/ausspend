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
 * NT SOC — Jacana Energy annual-report adapter.
 *
 * Jacana Energy is the trading name of Power Retail Corporation, a Northern
 * Territory Government Owned Corporation (GOC) under the Power Retail
 * Corporation Act 2014. This is the first NT state-owned-entity source. It is
 * deliberately one entity only: the NT GOC list is not authoritatively
 * consolidated here, so no other NT GOC/government business division and no
 * NT/state/national total is claimed or created.
 *
 * Source gate:
 * - The latest report is discovered from the official "Who we are" page
 *   (which links the annual-report PDFs); no PDF URL is hard-coded. The
 *   `NT_JACANA_ENERGY_ANNUAL_REPORT_URL` environment variable is an operator
 *   override, not the default path.
 * - The exact PDF bytes are SHA-256 archived outside the repo, with
 *   `SHA256SUMS` and `retrieval.json` sidecars.
 * - The audited statement and notes print an explicit "$'000" unit. Ambiguous
 *   or missing units are rejected, never guessed.
 * - Five printed lines are read: Total revenue (Note 4), Total expenses
 *   (Note 5), Employee benefits expense (face statement), Depreciation and
 *   amortisation expense (face statement) and Profit for the year (face
 *   statement). The face statement prints the revenue/expense components and
 *   result subtotals; Notes 4 and 5 print the two totals. Every printed
 *   subtotal and result bridge is reconciled at zero tolerance, and the face
 *   line values are required to equal the note totals.
 *
 * Every row is an entity-level SOC statement line: jurisdiction "NT",
 * jurisdiction_level "soc", aggregation_role "agency_detail", measure_type
 * "actual", provisional and verified:false. Jacana Energy rows are never added
 * to government program spending, the PNFC benchmark, another SOC entity, an
 * NT total, a state total or a national total.
 */

export const JACANA_ENERGY_ID = 'nt-jacana-energy';
export const JACANA_ENERGY_NAME = 'Jacana Energy — Annual Report';
export const JACANA_ENERGY_PUBLISHER = 'Jacana Energy (Power Retail Corporation)';
export const JACANA_ENERGY_ENTITY = 'Jacana Energy';
export const JACANA_ENERGY_JURISDICTION = 'NT';
export const JACANA_ENERGY_LEGAL_CLASS =
  'Northern Territory Government Owned Corporation (GOC) — Power Retail Corporation Act 2014';
export const JACANA_ENERGY_SOURCE_URL = 'https://www.jacanaenergy.com.au/about/who-we-are';
export const JACANA_ENERGY_LICENSE =
  '© Jacana Energy. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const JACANA_ENERGY_UNIT = 'AUD_thousands';
export const JACANA_ENERGY_UNIT_LABEL = "$'000";
export const JACANA_ENERGY_UNIT_TO_CENTS = 100_000;
export const JACANA_ENERGY_CAVEAT =
  "Entity-level SOC statement lines for Jacana Energy only, a Northern Territory Government Owned Corporation (Power Retail Corporation Act 2014). The NT GOC list is not claimed to be complete and this source is not an NT total. Never add Jacana Energy to government program spending, to the PNFC sector benchmark, to another NT GOC or government business division, to another state's SOC/GTE, to an NT total, a state total or a national total, or to each other: total revenue is the printed Note 4 Total revenue line; total expenses is the printed Note 5 Total expenses line; employee expenses and depreciation/amortisation are printed components of total expenses; the net result is the printed Profit for the year. Provisional and unverified.";

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface JacanaEnergyAnnualReportLink {
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

/**
 * Parse a filename such as "Jacana Energy Annual Report 2025-2026.pdf" into
 * the API fiscal year "2025-26". The first year is the reporting-period start.
 */
export function jacanaEnergyFiscalYearFromFilename(filename: string): string | null {
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
export function jacanaEnergyFiscalYearFromEndDate(endDate: string): string | null {
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
 * can also list other publications without corrupting the latest selection.
 */
export function parseJacanaEnergyAnnualReportLinks(
  html: string,
  pageUrl: string = JACANA_ENERGY_SOURCE_URL,
): JacanaEnergyAnnualReportLink[] {
  const links: JacanaEnergyAnnualReportLink[] = [];
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
    const fiscalYear = jacanaEnergyFiscalYearFromFilename(filename);
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
 * Fetch the official "Who we are" page and return its newest annual-report
 * PDF. If no annual-report link is present the adapter fails loudly rather
 * than pinning a URL that can rot.
 */
export async function discoverJacanaEnergyAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  indexUrl: string = JACANA_ENERGY_SOURCE_URL,
): Promise<JacanaEnergyAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(indexUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `Jacana Energy official page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Jacana Energy official page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseJacanaEnergyAnnualReportLinks(html, indexUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Jacana Energy official page contains no annual-report PDF link; refusing to hard-code a URL',
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

function readSectionTotal(
  rows: readonly PageRow[],
  startLabel: string,
  endLabel: string,
  anchor: number,
): { value: number | null; found: boolean; error?: string } {
  const start = findRow(rows, startLabel);
  const end = findRow(rows, endLabel);
  if (!start || !end) {
    return { value: null, found: false, error: `section ${startLabel} not found` };
  }
  const totals = rows.filter(
    (row) => row.label.toLowerCase() === 'total' && row.y < start.y && row.y > end.y,
  );
  if (totals.length !== 1) {
    return {
      value: null,
      found: false,
      error: `expected one Total row in section ${startLabel}, found ${totals.length}`,
    };
  }
  const cell = cellNear(totals[0] as PageRow, anchor);
  return { value: cell.value, found: cell.found, ...(cell.found ? {} : { error: 'no value' }) };
}

export interface JacanaEnergyStatement {
  page_number: number;
  revenue_page_number: number;
  expenses_page_number: number;
  unit: UnitDetection;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  depreciation_amortisation: number;
  net_result: number;
  profit_before_tax: number;
  income_tax_expense: number;
  revenue_components: {
    electricity_revenue: number;
    community_service_obligation_revenue: number;
    interest_income: number;
    electricity_and_energy_retail_services: number;
    other_revenue: number;
    electricity_total: number;
  };
  expense_components: {
    energy_costs_total: number;
    energy_generation_networks: number;
    renewable_energy_certificates: number;
    alternative_control_charges: number;
    prepaid_meter_transaction_costs: number;
    employee_total: number;
    salary_and_wages: number;
    superannuation: number;
    fringe_benefits_tax: number;
    payroll_tax: number;
    contract_labour: number;
    external_service_agreements: number;
    depreciation_and_amortisation: number;
    other_total: number;
    grants_and_subsidies: number;
    provision_for_impaired_receivables: number;
    auditors_remuneration: number;
    rental_expenses: number;
    managed_services: number;
    professional_fees: number;
    it_expenses: number;
    other_other_expenses: number;
    finance_costs: number;
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
      text.includes('profit before tax') &&
      text.includes('profit for the year')
    ) {
      return page;
    }
  }
  return null;
}

function findRevenueNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('4 revenue') &&
      text.includes('total revenue') &&
      text.includes('community service obligation') &&
      text.includes('interest income')
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
      text.includes('5 expenses') &&
      text.includes('total expenses') &&
      text.includes('employee benefits expense') &&
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

export function parseJacanaEnergyStatement(
  facePage: PdfPage,
  revenuePage: PdfPage,
  expensesPage: PdfPage,
  unit: UnitDetection,
): JacanaEnergyStatement | null {
  const faceRows = groupPageRows(facePage.items);
  const revenueRows = groupPageRows(revenuePage.items);
  const expenseRows = groupPageRows(expensesPage.items);
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const faceAnchor = columnAnchor(faceRows);
  const revenueAnchor = columnAnchor(revenueRows);
  const expenseAnchor = columnAnchor(expenseRows);
  if (faceAnchor === null || revenueAnchor === null || expenseAnchor === null) {
    errors.push('printed money column could not be anchored from the unit header');
    return null;
  }

  const requireValue = (
    rows: readonly PageRow[],
    label: string,
    anchor: number,
    options: { withMoney?: boolean } = {},
  ): number | null => {
    const cell = readValue(rows, label, anchor, options);
    if (!cell.found || cell.value === null) {
      errors.push(`statement is missing required printed line: ${label}`);
      return null;
    }
    return cell.value;
  };

  const face = {
    electricityRevenue: requireValue(faceRows, 'Electricity revenue', faceAnchor),
    csoRevenue: requireValue(faceRows, 'Community Service Obligation revenue', faceAnchor),
    interestIncome: requireValue(faceRows, 'Interest income', faceAnchor),
    energyCosts: requireValue(faceRows, 'Energy costs of sales', faceAnchor),
    employeeExpenses: requireValue(faceRows, 'Employee benefits expense', faceAnchor),
    externalServices: requireValue(faceRows, 'External service agreements', faceAnchor),
    depreciation: requireValue(faceRows, 'Depreciation and amortisation expense', faceAnchor),
    otherExpenses: requireValue(faceRows, 'Other expenses', faceAnchor),
    financeCosts: requireValue(faceRows, 'Finance costs', faceAnchor),
    profitBeforeTax: requireValue(faceRows, 'Profit before tax', faceAnchor),
    incomeTaxExpense: requireValue(faceRows, 'Income tax expense', faceAnchor),
    profitForYear: requireValue(faceRows, 'Profit for the year', faceAnchor),
  };

  const revenue = {
    electricityAndEnergyRetailServices: requireValue(
      revenueRows,
      'Electricity and energy retail services',
      revenueAnchor,
    ),
    otherRevenue: requireValue(revenueRows, 'Other revenue', revenueAnchor),
    electricityTotal: requireValue(revenueRows, 'Total', revenueAnchor),
    cso: requireValue(revenueRows, 'Community Service Obligation (CSO)', revenueAnchor),
    interest: requireValue(revenueRows, 'Interest income', revenueAnchor),
    totalRevenue: requireValue(revenueRows, 'Total revenue', revenueAnchor),
  };

  const energyTotal = readSectionTotal(
    expenseRows,
    'Energy costs of sales',
    'Employee benefits expense',
    expenseAnchor,
  );
  const employeeTotal = readSectionTotal(
    expenseRows,
    'Employee benefits expense',
    'Other expenses',
    expenseAnchor,
  );
  const otherTotal = readSectionTotal(
    expenseRows,
    'Other expenses',
    'Finance costs',
    expenseAnchor,
  );
  for (const [name, result] of [
    ['Energy costs of sales', energyTotal],
    ['Employee benefits expense', employeeTotal],
    ['Other expenses', otherTotal],
  ] as const) {
    if (!result.found || result.value === null) {
      errors.push(
        `statement is missing printed subtotal: ${name}${result.error ? ` (${result.error})` : ''}`,
      );
    }
  }

  const expense = {
    energyGenerationNetworks: requireValue(
      expenseRows,
      'Generation, networks and system control, and energy purchased for re-sale',
      expenseAnchor,
    ),
    renewableEnergyCertificates: requireValue(
      expenseRows,
      'Renewable Energy Certificates',
      expenseAnchor,
    ),
    alternativeControlCharges: requireValue(
      expenseRows,
      'Alternative control charges',
      expenseAnchor,
    ),
    prepaidMeterTransactionCosts: requireValue(
      expenseRows,
      'Prepaid meter transaction costs',
      expenseAnchor,
    ),
    salaryAndWages: requireValue(expenseRows, 'Salary and wages', expenseAnchor),
    superannuation: requireValue(expenseRows, 'Superannuation expense', expenseAnchor),
    fringeBenefitsTax: requireValue(expenseRows, 'Fringe Benefits Expense tax', expenseAnchor),
    payrollTax: requireValue(expenseRows, 'Payroll tax', expenseAnchor),
    contractLabour: requireValue(expenseRows, 'Contract labour', expenseAnchor),
    externalServices: requireValue(expenseRows, 'External service agreements', expenseAnchor),
    depreciation: requireValue(
      expenseRows,
      'Depreciation and amortisation expenses',
      expenseAnchor,
    ),
    grantsAndSubsidies: requireValue(expenseRows, 'Grants and subsidies', expenseAnchor),
    provisionForImpairedReceivables: requireValue(
      expenseRows,
      'Provision for impaired receivables',
      expenseAnchor,
    ),
    auditorsRemuneration: requireValue(expenseRows, "Auditors' remuneration", expenseAnchor),
    rentalExpenses: requireValue(expenseRows, 'Rental expenses', expenseAnchor),
    managedServices: requireValue(expenseRows, 'Managed services', expenseAnchor),
    professionalFees: requireValue(expenseRows, 'Professional fees', expenseAnchor),
    itExpenses: requireValue(expenseRows, 'IT expenses', expenseAnchor),
    otherOtherExpenses: requireValue(expenseRows, 'Other expenses', expenseAnchor, {
      withMoney: true,
    }),
    financeCosts: requireValue(expenseRows, 'Finance costs', expenseAnchor),
    totalExpenses: requireValue(expenseRows, 'Total expenses', expenseAnchor),
  };

  if (errors.length > 0) return null;

  const abs = (value: number | null): number => Math.abs(value as number);
  const faceElectricity = abs(face.electricityRevenue);
  const faceCso = abs(face.csoRevenue);
  const faceInterest = abs(face.interestIncome);
  const faceEnergy = abs(face.energyCosts);
  const faceEmployee = abs(face.employeeExpenses);
  const faceExternal = abs(face.externalServices);
  const faceDepreciation = abs(face.depreciation);
  const faceOther = abs(face.otherExpenses);
  const faceFinance = abs(face.financeCosts);
  const profitBeforeTax = face.profitBeforeTax as number;
  const incomeTax = abs(face.incomeTaxExpense);
  const netResult = face.profitForYear as number;

  const revenueRetail = abs(revenue.electricityAndEnergyRetailServices);
  const revenueOther = abs(revenue.otherRevenue);
  const revenueElectricityTotal = abs(revenue.electricityTotal);
  const revenueCso = abs(revenue.cso);
  const revenueInterest = abs(revenue.interest);
  const totalRevenue = abs(revenue.totalRevenue);

  const energyGeneration = abs(expense.energyGenerationNetworks);
  const renewableCertificates = abs(expense.renewableEnergyCertificates);
  const alternativeCharges = abs(expense.alternativeControlCharges);
  const prepaidMeter = abs(expense.prepaidMeterTransactionCosts);
  const energyTotalValue = abs(energyTotal.value);
  const salaryWages = abs(expense.salaryAndWages);
  const superannuation = abs(expense.superannuation);
  const fringeBenefits = abs(expense.fringeBenefitsTax);
  const payrollTax = abs(expense.payrollTax);
  const contractLabour = abs(expense.contractLabour);
  const employeeTotalValue = abs(employeeTotal.value);
  const externalServices = abs(expense.externalServices);
  const depreciation = abs(expense.depreciation);
  const grants = abs(expense.grantsAndSubsidies);
  const impairedReceivables = abs(expense.provisionForImpairedReceivables);
  const auditors = abs(expense.auditorsRemuneration);
  const rental = abs(expense.rentalExpenses);
  const managed = abs(expense.managedServices);
  const professional = abs(expense.professionalFees);
  const itExpenses = abs(expense.itExpenses);
  const otherOther = abs(expense.otherOtherExpenses);
  const otherTotalValue = abs(otherTotal.value);
  const financeCosts = abs(expense.financeCosts);
  const totalExpenses = abs(expense.totalExpenses);

  const expectEqual = (label: string, actual: number, printed: number): void => {
    checks.push(`${label}: ${actual} = ${printed}`);
    if (actual !== printed) {
      errors.push(`${label} mismatch: ${actual}, printed ${printed}`);
    }
  };

  expectEqual(
    'Note 4(a) electricity subtotal',
    revenueRetail + revenueOther,
    revenueElectricityTotal,
  );
  expectEqual(
    'Note 4 Total revenue',
    revenueElectricityTotal + revenueCso + revenueInterest,
    totalRevenue,
  );

  expectEqual(
    'Note 5(a) energy costs subtotal',
    energyGeneration + renewableCertificates + alternativeCharges + prepaidMeter,
    energyTotalValue,
  );
  expectEqual(
    'Note 5(b) employee benefits subtotal',
    salaryWages + superannuation + fringeBenefits + payrollTax + contractLabour,
    employeeTotalValue,
  );
  expectEqual(
    'Note 5(e) other expenses subtotal',
    grants +
      impairedReceivables +
      auditors +
      rental +
      managed +
      professional +
      itExpenses +
      otherOther,
    otherTotalValue,
  );
  expectEqual(
    'Note 5 Total expenses',
    energyTotalValue +
      employeeTotalValue +
      externalServices +
      depreciation +
      otherTotalValue +
      financeCosts,
    totalExpenses,
  );

  expectEqual(
    'face electricity revenue = Note 4(a) subtotal',
    faceElectricity,
    revenueElectricityTotal,
  );
  expectEqual('face CSO revenue = Note 4(b)', faceCso, revenueCso);
  expectEqual('face interest income = Note 4(c)', faceInterest, revenueInterest);
  expectEqual('face energy costs = Note 5(a) subtotal', faceEnergy, energyTotalValue);
  expectEqual('face employee benefits = Note 5(b) subtotal', faceEmployee, employeeTotalValue);
  expectEqual('face external services = Note 5(c)', faceExternal, externalServices);
  expectEqual('face depreciation = Note 5(d)', faceDepreciation, depreciation);
  expectEqual('face other expenses = Note 5(e) subtotal', faceOther, otherTotalValue);
  expectEqual('face finance costs = Note 5(f)', faceFinance, financeCosts);

  const preTaxBridge = totalRevenue - totalExpenses;
  checks.push(`profit-before-tax bridge: ${totalRevenue} - ${totalExpenses} = ${preTaxBridge}`);
  if (preTaxBridge !== profitBeforeTax) {
    errors.push(
      `profit-before-tax bridge mismatch: ${totalRevenue} - ${totalExpenses} = ${preTaxBridge}, printed Profit before tax ${profitBeforeTax}`,
    );
  }

  const netBridge = profitBeforeTax - incomeTax;
  checks.push(`net-result bridge: ${profitBeforeTax} - ${incomeTax} = ${netBridge}`);
  if (netBridge !== netResult) {
    errors.push(
      `net-result bridge mismatch: ${profitBeforeTax} - ${incomeTax} = ${netBridge}, printed Profit for the year ${netResult}`,
    );
  }

  const comprehensive = readValue(faceRows, 'Total comprehensive income for the year', faceAnchor);
  if (comprehensive.found && comprehensive.value !== null) {
    expectEqual(
      'total comprehensive income = net result (OCI nil)',
      netResult,
      Math.abs(comprehensive.value),
    );
  }

  warnings.push(
    "the audited statement and notes print an explicit $'000 unit. The face statement prints the revenue/expense components, Profit before tax and Profit for the year; Notes 4 and 5 print Total revenue and Total expenses. Every printed subtotal and result bridge reconciles exactly at zero tolerance on the FY2025-26 report. No other entity and no NT total is read or computed.",
  );

  return {
    page_number: facePage.page_number,
    revenue_page_number: revenuePage.page_number,
    expenses_page_number: expensesPage.page_number,
    unit,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    employee_expenses: faceEmployee,
    depreciation_amortisation: faceDepreciation,
    net_result: netResult,
    profit_before_tax: profitBeforeTax,
    income_tax_expense: incomeTax,
    revenue_components: {
      electricity_revenue: faceElectricity,
      community_service_obligation_revenue: faceCso,
      interest_income: faceInterest,
      electricity_and_energy_retail_services: revenueRetail,
      other_revenue: revenueOther,
      electricity_total: revenueElectricityTotal,
    },
    expense_components: {
      energy_costs_total: energyTotalValue,
      energy_generation_networks: energyGeneration,
      renewable_energy_certificates: renewableCertificates,
      alternative_control_charges: alternativeCharges,
      prepaid_meter_transaction_costs: prepaidMeter,
      employee_total: employeeTotalValue,
      salary_and_wages: salaryWages,
      superannuation,
      fringe_benefits_tax: fringeBenefits,
      payroll_tax: payrollTax,
      contract_labour: contractLabour,
      external_service_agreements: externalServices,
      depreciation_and_amortisation: depreciation,
      other_total: otherTotalValue,
      grants_and_subsidies: grants,
      provision_for_impaired_receivables: impairedReceivables,
      auditors_remuneration: auditors,
      rental_expenses: rental,
      managed_services: managed,
      professional_fees: professional,
      it_expenses: itExpenses,
      other_other_expenses: otherOther,
      finance_costs: financeCosts,
    },
    checks,
    warnings,
    errors,
  };
}

export interface JacanaEnergyParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export type JacanaEnergyDeferralPhase =
  'discovery' | 'document' | 'statement' | 'unit' | 'reconciliation';

export interface JacanaEnergyDeferral {
  reason: string;
  phase: JacanaEnergyDeferralPhase;
}

export interface JacanaEnergyLineSpec {
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

export interface JacanaEnergyParseResult {
  records: SpendingRecord[];
  deferral: JacanaEnergyDeferral | null;
  statement: JacanaEnergyStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function jacanaEnergyNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${JACANA_ENERGY_ID}:${createHash('sha256')
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
  context: JacanaEnergyParseContext,
  spec: JacanaEnergyLineSpec,
  statement: JacanaEnergyStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${statement.unit.kind} (${statement.unit.reason}; x${unitToCents(statement.unit.kind as MoneyUnitKind)} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `revenue_note_page: ${statement.revenue_page_number}`,
    `expenses_note_page: ${statement.expenses_page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'single Jacana Energy entity; NT GOC; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, another NT GOC, another state SOC/GTE, an NT total, a state total, a national total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: JacanaEnergyLineSpec,
  context: JacanaEnergyParseContext,
  statement: JacanaEnergyStatement,
): SpendingRecord {
  const kind = statement.unit.kind as MoneyUnitKind;
  return {
    amount_cents: amountCents(spec.amount_source, kind),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: JACANA_ENERGY_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: jacanaEnergyNaturalKey(
      JACANA_ENERGY_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${JACANA_ENERGY_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: JACANA_ENERGY_JURISDICTION,
    delivery_entity: JACANA_ENERGY_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Jacana Energy Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: JACANA_ENERGY_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: unitName(kind),
    soc_section: spec.section,
    soc_note:
      'Statement of profit or loss and other comprehensive income; Note 4 Revenue; Note 5 Expenses',
    potential_double_count: spec.potential_double_count,
    ...(spec.printed_sign ? { soc_printed_sign: spec.printed_sign } : {}),
    notes: notesFor(context, spec, statement, {
      total_revenue_source_units: statement.total_revenue,
      total_expenses_source_units: statement.total_expenses,
      profit_before_tax_source_units: statement.profit_before_tax,
      net_result_source_units: statement.net_result,
      checks: statement.checks.join(' | '),
    }),
  };
}

export function parseJacanaEnergyExtraction(
  extraction: PdfExtraction,
  context: JacanaEnergyParseContext,
): JacanaEnergyParseResult {
  const warnings: string[] = [];
  const facePage = findStatementPage(extraction.pages);
  const revenuePage = findRevenueNotePage(extraction.pages);
  const expensesPage = findExpensesNotePage(extraction.pages);
  if (!facePage || !revenuePage || !expensesPage) {
    return {
      records: [],
      deferral: {
        reason:
          'no parseable statement of profit or loss and other comprehensive income with Note 4 Revenue and Note 5 Expenses found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }

  const unit = detectMoneyUnit(unitSamples([facePage, revenuePage, expensesPage]));
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
      pages_used: [facePage.page_number, revenuePage.page_number, expensesPage.page_number],
    };
  }
  const statement = parseJacanaEnergyStatement(facePage, revenuePage, expensesPage, unit);
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
      pages_used: [facePage.page_number, revenuePage.page_number, expensesPage.page_number],
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
      pages_used: [facePage.page_number, revenuePage.page_number, expensesPage.page_number],
    };
  }

  const endDate = /year ended 30 June (\d{4})/i.exec(extraction.text);
  const derivedFiscalYear = endDate
    ? jacanaEnergyFiscalYearFromEndDate(`${endDate[1]}-06-30`)
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
      pages_used: [facePage.page_number, revenuePage.page_number, expensesPage.page_number],
    };
  }

  const lineSpecs: JacanaEnergyLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_source: statement.total_revenue,
      funding_source: JACANA_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Note 4 Total revenue line, which bridges exactly to Note 4(a) electricity revenue + Community Service Obligation revenue + Interest income. Entity-level revenue; never added to government program spending or another entity.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_source: statement.total_expenses,
      funding_source: JACANA_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Note 5 Total expenses line, which bridges exactly to Energy costs of sales + Employee benefits expense + External service agreements + Depreciation and amortisation expense + Other expenses + Finance costs.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits expense',
      amount_source: statement.employee_expenses,
      funding_source: JACANA_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Employee benefits expense line, equal to the Note 5(b) employee benefits subtotal. A component of Total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation expense',
      amount_source: statement.depreciation_amortisation,
      funding_source: JACANA_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed face-statement Depreciation and amortisation expense line, equal to Note 5(d). A component of Total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Profit for the year',
      amount_source: statement.net_result,
      funding_source: JACANA_ENERGY_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Profit for the year (net result after income tax), which bridges exactly to Profit before tax - Income tax expense. A result line, not an expense component; never added to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; the printed revenue and expense subtotals and the profit-before-tax, net-result and total-comprehensive-income bridges reconcile exactly at zero tolerance.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks: statement.checks,
    warnings,
    pages_used: [facePage.page_number, revenuePage.page_number, expensesPage.page_number],
  };
}

export interface JacanaEnergyConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: JacanaEnergyAnnualReportLink;
}

function documentFilename(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(name)) return name.replace(/[^A-Za-z0-9._-]+/g, '-');
  } catch {
    // Fall through.
  }
  return 'jacana-energy-annual-report.pdf';
}

/**
 * Operator escape hatch: when `NT_JACANA_ENERGY_ANNUAL_REPORT_URL` is set, it
 * is used as the exact official PDF URL. The default path is live discovery.
 */
function documentFromEnv(): JacanaEnergyAnnualReportLink | null {
  const url = process.env.NT_JACANA_ENERGY_ANNUAL_REPORT_URL;
  if (!url) return null;
  let filename = 'Jacana Energy Annual Report.pdf';
  try {
    filename = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? filename);
  } catch {
    // Keep the fallback filename.
  }
  const fiscalYear = jacanaEnergyFiscalYearFromFilename(filename);
  if (!fiscalYear) {
    throw new Error(
      `NT_JACANA_ENERGY_ANNUAL_REPORT_URL filename "${filename}" has no annual-report year range; cannot derive fiscal year`,
    );
  }
  const [start] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Annual Report ${start}–${Number(start) + 1}`,
    discovery_page: JACANA_ENERGY_SOURCE_URL,
  };
}

async function writeArchiveSidecars(
  archived: ArchivedSourceRecord,
  document: JacanaEnergyAnnualReportLink,
  pdfPages: number,
): Promise<void> {
  const directory = path.dirname(archived.local_path);
  const filename = path.basename(archived.local_path);
  await writeFile(path.join(directory, 'SHA256SUMS'), `${archived.sha256}  ${filename}\n`, 'utf8');
  await writeFile(
    path.join(directory, 'retrieval.json'),
    `${JSON.stringify(
      {
        source_id: JACANA_ENERGY_ID,
        entity: JACANA_ENERGY_ENTITY,
        jurisdiction: JACANA_ENERGY_JURISDICTION,
        legal_class: JACANA_ENERGY_LEGAL_CLASS,
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
  document: JacanaEnergyAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: JacanaEnergyDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: JACANA_ENERGY_ID, document_url: document.url },
    {
      $set: {
        entity: JACANA_ENERGY_ENTITY,
        jurisdiction: JACANA_ENERGY_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Jacana Energy SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Jacana Energy connector. */
export function createJacanaEnergyConnector(options: JacanaEnergyConnectorOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: JACANA_ENERGY_ID,
    name: JACANA_ENERGY_NAME,
    publisher: JACANA_ENERGY_PUBLISHER,
    source_url: JACANA_ENERGY_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: JACANA_ENERGY_LICENSE,
    notes:
      "NT SOC (first NT state-owned-entity source): Jacana Energy only, a Northern Territory Government Owned Corporation (Power Retail Corporation Act 2014). The latest annual report is discovered from the official 'Who we are' page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo with SHA256SUMS and retrieval.json. The audited statement and notes print an explicit $'000 unit; the adapter reads Note 4 Total revenue, Note 5 Total expenses, and the face-statement Employee benefits expense, Depreciation and amortisation expense and Profit for the year. Every printed revenue/expense subtotal and the profit-before-tax, net-result and total-comprehensive-income bridges must reconcile exactly at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level 'soc', aggregation_role 'agency_detail'). The NT GOC list is not claimed to be complete; Jacana Energy is never added to government program spending, the PNFC benchmark, another NT GOC, another state's SOC/GTE, an NT total, a state total, a national total, or another SOC line.",
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverJacanaEnergyAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Jacana Energy PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: JACANA_ENERGY_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: documentFilename(document.url),
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Jacana Energy annual-report PDF; archived for auditable Northern Territory SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      await writeArchiveSidecars(archived, document, extraction.pages.length);
      const now = options.now?.() ?? new Date();
      const context: JacanaEnergyParseContext = {
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
      const parsed = parseJacanaEnergyExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'nt-jacana-energy-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'nt-jacana-energy-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Jacana Energy measure; skipped');
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
