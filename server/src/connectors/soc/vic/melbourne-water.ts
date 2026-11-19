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
 * VIC SOC — Melbourne Water annual-report adapter (first Victorian
 * water-corporation source).
 *
 * Melbourne Water Corporation is a **statutory water corporation** established
 * under the Water Act 1989 (Vic). It is **not** a Government Business Enterprise
 * or State business corporation under the State Owned Enterprises Act 1992
 * (Vic). This adapter is deliberately one entity only: it does not claim a
 * complete Victorian water-corporation set, and it creates no VIC, water-sector
 * or national total.
 *
 * Source gate:
 * - The latest report is discovered from the official annual-report page; no
 *   PDF URL is hard-coded. The `VIC_MELBOURNE_WATER_ANNUAL_REPORT_URL`
 *   environment variable is an operator override, not the default path.
 * - The exact PDF bytes are SHA-256 archived outside the repo, with
 *   `SHA256SUMS` and `retrieval.json` sidecars.
 * - The audited statement prints an explicit "($ thousands)" unit. Ambiguous or
 *   missing units are rejected, never guessed.
 * - Five printed lines are read directly from the audited statement: Total
 *   revenue, Total expenses, Employee benefits, Depreciation and amortisation,
 *   and Net profit for the period after tax. No total is derived: every line is
 *   a printed face line and all printed subtotals and result bridges reconcile
 *   at zero tolerance. The employee and depreciation lines are cross-checked
 *   against Notes 3.2 and 4.1.3.
 *
 * Every row is an entity-level SOC statement line: jurisdiction "VIC",
 * jurisdiction_level "soc", aggregation_role "agency_detail", measure_type
 * "actual", provisional and verified:false. Melbourne Water rows are never
 * added to government program spending, the PNFC benchmark, any other
 * Victorian water corporation, a VIC total or a national total.
 */

export const MELBOURNE_WATER_ID = 'vic-melbourne-water';
export const MELBOURNE_WATER_NAME = 'Melbourne Water — Annual Report';
export const MELBOURNE_WATER_PUBLISHER = 'Melbourne Water Corporation';
export const MELBOURNE_WATER_ENTITY = 'Melbourne Water';
export const MELBOURNE_WATER_JURISDICTION = 'VIC';
export const MELBOURNE_WATER_LEGAL_CLASS =
  'Victorian statutory water corporation under the Water Act 1989 (Vic) — not a Government Business Enterprise / State business corporation under the State Owned Enterprises Act 1992';
export const MELBOURNE_WATER_SOURCE_URL =
  'https://www.melbournewater.com.au/about/publications/annual-report';
export const MELBOURNE_WATER_LICENSE =
  '© Melbourne Water Corporation. Published annual-report PDF used here for public-interest research; not an open-data licence grant.';
export const MELBOURNE_WATER_UNIT = 'AUD_thousands';
export const MELBOURNE_WATER_UNIT_LABEL = '($ thousands)';
export const MELBOURNE_WATER_UNIT_TO_CENTS = 100_000;
export const MELBOURNE_WATER_CAVEAT =
  'Entity-level SOC statement lines for Melbourne Water only, a Victorian statutory water corporation established under the Water Act 1989 (Vic). Melbourne Water is not a Government Business Enterprise or State business corporation under the State Owned Enterprises Act 1992 (Vic), and this source is not a VIC total. No Victorian water-corporation set total exists here and no other VIC water corporation, GBE, statutory authority, or any other state or national entity is included. Never add Melbourne Water to government program spending, to the PNFC sector benchmark, to another water corporation or state-owned entity, to a VIC total, a state total or a national total. All five rows are printed audited face lines: Total revenue, Total expenses, Employee benefits, Depreciation and amortisation and Net profit for the period after tax; every printed subtotal and result bridge reconciles exactly at zero tolerance. Employee benefits and depreciation/amortisation are each cross-checked to their printed notes. Provisional and unverified.';

/** A discovered annual-report PDF. Never hard-code the PDF URL; parse the page. */
export interface MelbourneWaterAnnualReportLink {
  url: string;
  filename: string;
  fiscal_year: string;
  title: string;
  discovery_page: string;
  accessible: boolean;
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

const ANNUAL_REPORT_TEXT = /annual[\s_\-–]*report/i;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#0?39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** Parse a year range such as "Annual Report 2025-26" into "2025-26". */
export function melbourneWaterFiscalYearFromText(text: string): string | null {
  const decoded = decodeHtmlEntities(text).replace(/\s+/g, ' ');
  const range = /(\d{4})\s*[-–]\s*(\d{2,4})/.exec(decoded);
  if (!range) return null;
  const start = Number(range[1]);
  const endRaw = range[2] as string;
  const end = endRaw.length === 2 ? Math.floor(start / 100) * 100 + Number(endRaw) : Number(endRaw);
  if (!Number.isInteger(start) || start < 2001 || start > 2100) return null;
  if (end !== start + 1) return null;
  return `${start}-${String(end % 100).padStart(2, '0')}`;
}

/** Parse a filename such as "Melbourne-Water-Annual-Report-2025-26.pdf". */
export function melbourneWaterFiscalYearFromFilename(filename: string): string | null {
  try {
    return melbourneWaterFiscalYearFromText(decodeURIComponent(filename));
  } catch {
    return melbourneWaterFiscalYearFromText(filename);
  }
}

/** Convert "year ended 30 June 2026" into the API fiscal year "2025-26". */
export function melbourneWaterFiscalYearFromEndDate(endDate: string): string | null {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(endDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function filenameFromTitle(title: string): string {
  const base = title
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return `${base || 'melbourne-water-annual-report'}.pdf`;
}

/**
 * Parse annual-report media/downloads links from the official page. The page
 * exposes official `/media/<encoded>/downloads` links whose anchor text carries
 * the report year (the media URL itself does not). Only links whose text names
 * an annual report and a start/end year range are accepted, so older reports and
 * non-annual publications do not corrupt the latest selection. Where both a
 * standard and an "Accessible version" exist for the same year, the accessible
 * PDF is preferred (it is the exact PDF cheap-checked for this source).
 */
export function parseMelbourneWaterAnnualReportLinks(
  html: string,
  pageUrl: string = MELBOURNE_WATER_SOURCE_URL,
): MelbourneWaterAnnualReportLink[] {
  const links: MelbourneWaterAnnualReportLink[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const attributes = match[1] ?? '';
    const inner = match[2] ?? '';
    const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(attributes);
    if (!hrefMatch) continue;
    const rawHref = (hrefMatch[1] as string).trim();
    if (!rawHref) continue;
    if (!/(?:\/downloads(?:$|[?#])|\.pdf(?:$|[?#]))/i.test(rawHref)) continue;
    const title = decodeHtmlEntities(inner.replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (!ANNUAL_REPORT_TEXT.test(title)) continue;
    const fiscalYear = melbourneWaterFiscalYearFromText(title);
    if (!fiscalYear) continue;
    let resolved: URL;
    try {
      resolved = new URL(rawHref, pageUrl);
    } catch {
      continue;
    }
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') continue;
    // The page double-encodes the base64 media token (%253D). Decode one layer
    // so the archived URL is the canonical official `/media/...%3D/downloads`.
    const key = resolved.toString().replace(/%25([0-9A-Fa-f]{2})/g, '%$1');
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      url: key,
      filename: filenameFromTitle(title),
      fiscal_year: fiscalYear,
      title,
      discovery_page: pageUrl,
      accessible: /accessible/i.test(title),
    });
  }
  return links.sort(
    (a, b) =>
      b.fiscal_year.localeCompare(a.fiscal_year) || Number(b.accessible) - Number(a.accessible),
  );
}

/**
 * Fetch the official annual-report page and return its newest annual-report PDF.
 * If no annual-report link is present the adapter fails loudly rather than
 * pinning a URL that can rot.
 */
export async function discoverMelbourneWaterAnnualReport(
  fetchImpl: typeof fetch = globalThis.fetch,
  indexUrl: string = MELBOURNE_WATER_SOURCE_URL,
): Promise<MelbourneWaterAnnualReportLink> {
  let response: Response;
  try {
    response = await fetchImpl(indexUrl, { redirect: 'follow', headers: BROWSER_HEADERS });
  } catch (error) {
    throw new Error(
      `Melbourne Water official annual-report page could not be fetched; refusing to hard-code a PDF URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Melbourne Water official annual-report page HTTP ${response.status}; refusing to hard-code a PDF URL`,
    );
  }
  const html = await response.text();
  const links = parseMelbourneWaterAnnualReportLinks(html, indexUrl);
  const latest = links[0];
  if (!latest) {
    throw new Error(
      'Melbourne Water official annual-report page contains no annual-report download link; refusing to hard-code a URL',
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

/**
 * Anchor the 2026 money column from the first printed "2026" / "2025" column
 * header. Melbourne Water's unit header is right-aligned over the 2025 column,
 * so the unit itself is not a usable anchor; the year header is.
 */
function columnAnchor(rows: readonly PageRow[]): number | null {
  for (const row of rows) {
    const first = row.items.find((item) => item.str.trim() === '2026' && item.x > 300);
    const second = row.items.find((item) => item.str.trim() === '2025' && item.x > 300);
    if (first && second) return first.x + first.width;
  }
  return null;
}

interface CellValue {
  value: number | null;
  found: boolean;
  nil: boolean;
}

function cellNear(row: PageRow, anchor: number, tolerance = 8): CellValue {
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

export interface MelbourneWaterStatement {
  page_number: number;
  employee_note_page_number: number;
  depreciation_note_page_number: number;
  unit: UnitDetection;
  total_revenue: number;
  total_expenses: number;
  employee_expenses: number;
  depreciation_amortisation: number;
  net_result: number;
  profit_before_income_tax: number;
  income_tax_expense: number;
  total_comprehensive_income: number;
  other_comprehensive_income: number;
  revenue_components: {
    contracts_with_customers: number;
    other_revenue: number;
  };
  expense_components: {
    depreciation_amortisation: number;
    operational_expenses: number;
    employee_benefits: number;
    repairs_and_maintenance: number;
    administrative_expenses: number;
    finance_expenses: number;
    government_rates_and_taxes: number;
    asset_transfers_to_councils: number;
    other_expenses: number;
    net_loss_on_revaluation: number;
  };
  employee_components: {
    total: number;
    salary_and_wages: number;
    leave_expenses: number;
    defined_contribution: number;
    other_employee_expenses: number;
  };
  depreciation_components: {
    total: number;
    total_depreciation: number;
    total_amortisation: number;
    buildings: number;
    leasehold_improvements: number;
    plant_and_equipment: number;
    fleet_vehicles: number;
    infrastructure_assets: number;
    vdp_service_concession_asset: number;
    right_of_use_assets: number;
    intangible_assets: number;
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
      text.includes('total revenue') &&
      text.includes('total expenses') &&
      text.includes('net profit for the period after tax')
    ) {
      return page;
    }
  }
  return null;
}

function findEmployeeNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('3.2 employee benefits expenses') &&
      text.includes('total employee benefits expenses') &&
      text.includes('salary and wages expenses')
    ) {
      return page;
    }
  }
  return null;
}

function findDepreciationNotePage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = page.text.toLowerCase();
    if (
      text.includes('4.1.3 depreciation, amortisation and impairment') &&
      text.includes('total depreciation and amortisation') &&
      text.includes('total amortisation')
    ) {
      return page;
    }
  }
  return null;
}

function unitSamples(pages: readonly PdfPage[]): string[] {
  const samples: string[] = [];
  for (const item of pages.flatMap((page) => page.items)) {
    const text = item.str.trim();
    if (!text || text.length > 24 || !text.includes('$')) continue;
    // Ignore narrative footnotes such as "$3.0 million"; only short standalone
    // unit headers are unit evidence.
    if (/\d+\s*(?:million|billion)/i.test(text)) continue;
    samples.push(text);
  }
  return samples;
}

function supportedUnit(kind: MoneyUnitKind | null): kind is 'dollars' | 'thousands' | 'millions' {
  return kind === 'dollars' || kind === 'thousands' || kind === 'millions';
}

export function parseMelbourneWaterStatement(
  facePage: PdfPage,
  employeePage: PdfPage,
  depreciationPage: PdfPage,
  unit: UnitDetection,
): MelbourneWaterStatement | null {
  const faceRows = groupPageRows(facePage.items);
  const employeeRows = groupPageRows(employeePage.items);
  const depreciationRows = groupPageRows(depreciationPage.items);
  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const faceAnchor = columnAnchor(faceRows);
  const employeeAnchor = columnAnchor(employeeRows);
  const depreciationAnchor = columnAnchor(depreciationRows);
  if (faceAnchor === null || employeeAnchor === null || depreciationAnchor === null) {
    errors.push('printed 2026 money column could not be anchored from the year header');
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
    contracts: requireValue(faceRows, 'Revenue from contracts with customers', faceAnchor),
    otherRevenue: requireValue(faceRows, 'Other revenue', faceAnchor),
    totalRevenue: requireValue(faceRows, 'Total revenue', faceAnchor),
    depreciation: requireValue(faceRows, 'Depreciation and amortisation', faceAnchor),
    operational: requireValue(faceRows, 'Operational expenses', faceAnchor),
    employeeBenefits: requireValue(faceRows, 'Employee benefits', faceAnchor),
    repairsMaintenance: requireValue(faceRows, 'Repairs and maintenance', faceAnchor),
    administrative: requireValue(faceRows, 'Administrative expenses', faceAnchor),
    finance: requireValue(faceRows, 'Finance expenses', faceAnchor),
    governmentRates: requireValue(faceRows, 'Government rates and taxes', faceAnchor),
    assetTransfers: requireValue(faceRows, 'Asset transfers to Councils', faceAnchor),
    otherExpenses: requireValue(faceRows, 'Other expenses', faceAnchor),
    revaluationLoss: requireValue(
      faceRows,
      'Net loss on revaluation of non-financial assets',
      faceAnchor,
    ),
    totalExpenses: requireValue(faceRows, 'Total expenses', faceAnchor),
    profitBeforeTax: requireValue(faceRows, 'Net profit from operations before tax', faceAnchor),
    taxExpense: requireValue(faceRows, 'Tax expense', faceAnchor),
    netResult: requireValue(faceRows, 'Net profit for the period after tax', faceAnchor),
    otherComprehensive: requireValue(
      faceRows,
      'Other comprehensive income/(loss) for the period after tax',
      faceAnchor,
    ),
    totalComprehensive: requireValue(
      faceRows,
      'Total comprehensive income for the period after tax',
      faceAnchor,
    ),
  };

  const employee = {
    total: requireValue(employeeRows, 'Total employee benefits expenses', employeeAnchor),
    salaryAndWages: requireValue(employeeRows, 'Salary and wages expenses', employeeAnchor),
    leaveExpenses: requireValue(
      employeeRows,
      'Annual, long service and shift leave expenses',
      employeeAnchor,
    ),
    definedContribution: requireValue(
      employeeRows,
      'Defined contribution plans (superannuation accumulation fund) expense',
      employeeAnchor,
    ),
    other: requireValue(employeeRows, 'Other employee expenses', employeeAnchor),
  };

  const depreciation = {
    total: requireValue(
      depreciationRows,
      'Total depreciation and amortisation',
      depreciationAnchor,
    ),
    totalDepreciation: requireValue(depreciationRows, 'Total depreciation', depreciationAnchor),
    totalAmortisation: requireValue(depreciationRows, 'Total amortisation', depreciationAnchor),
    buildings: requireValue(depreciationRows, 'Buildings', depreciationAnchor),
    leaseholdImprovements: requireValue(
      depreciationRows,
      'Leasehold improvements',
      depreciationAnchor,
    ),
    plantAndEquipment: requireValue(depreciationRows, 'Plant and equipment', depreciationAnchor),
    fleetVehicles: requireValue(depreciationRows, 'Fleet vehicles', depreciationAnchor),
    infrastructureAssets: requireValue(
      depreciationRows,
      'Infrastructure assets',
      depreciationAnchor,
    ),
    vdpServiceConcessionAsset: requireValue(
      depreciationRows,
      'VDP service concession asset',
      depreciationAnchor,
    ),
    rightOfUseAssets: requireValue(depreciationRows, 'Right of use assets', depreciationAnchor),
    intangibleAssets: requireValue(depreciationRows, 'Intangible assets', depreciationAnchor),
  };

  if (errors.length > 0) return null;

  const abs = (value: number | null): number => Math.abs(value as number);
  const faceRevenue = abs(face.totalRevenue);
  const faceTotalExpenses = abs(face.totalExpenses);
  const netResult = face.netResult as number;
  const profitBeforeTax = abs(face.profitBeforeTax);
  const taxExpense = abs(face.taxExpense);

  const contracts = abs(face.contracts);
  const otherRevenue = abs(face.otherRevenue);
  const depOnFace = abs(face.depreciation);
  const operational = abs(face.operational);
  const employeeOnFace = abs(face.employeeBenefits);
  const repairsMaintenance = abs(face.repairsMaintenance);
  const administrative = abs(face.administrative);
  const finance = abs(face.finance);
  const governmentRates = abs(face.governmentRates);
  const assetTransfers = abs(face.assetTransfers);
  const otherExpenses = abs(face.otherExpenses);
  const revaluationLoss = abs(face.revaluationLoss);

  const employeeTotal = abs(employee.total);
  const salaryAndWages = abs(employee.salaryAndWages);
  const leaveExpenses = abs(employee.leaveExpenses);
  const definedContribution = abs(employee.definedContribution);
  const otherEmployee = abs(employee.other);

  const depreciationTotal = abs(depreciation.total);
  const totalDepreciation = abs(depreciation.totalDepreciation);
  const totalAmortisation = abs(depreciation.totalAmortisation);
  const buildings = abs(depreciation.buildings);
  const leaseholdImprovements = abs(depreciation.leaseholdImprovements);
  const plantAndEquipment = abs(depreciation.plantAndEquipment);
  const fleetVehicles = abs(depreciation.fleetVehicles);
  const infrastructureAssets = abs(depreciation.infrastructureAssets);
  const vdpServiceConcessionAsset = abs(depreciation.vdpServiceConcessionAsset);
  const rightOfUseAssets = abs(depreciation.rightOfUseAssets);
  const intangibleAssets = abs(depreciation.intangibleAssets);

  const otherComprehensive = face.otherComprehensive as number;
  const totalComprehensive = abs(face.totalComprehensive);

  const expectEqual = (label: string, actual: number, printed: number): void => {
    checks.push(`${label}: ${actual} = ${printed}`);
    if (actual !== printed) errors.push(`${label} mismatch: ${actual}, printed ${printed}`);
  };

  expectEqual('revenue components = printed Total revenue', contracts + otherRevenue, faceRevenue);

  const expenseComponents = [
    depOnFace,
    operational,
    employeeOnFace,
    repairsMaintenance,
    administrative,
    finance,
    governmentRates,
    assetTransfers,
    otherExpenses,
    revaluationLoss,
  ];
  expectEqual(
    'sum of printed expense lines = printed Total expenses',
    expenseComponents.reduce((sum, value) => sum + value, 0),
    faceTotalExpenses,
  );

  expectEqual(
    'Net profit from operations before tax = Total revenue - Total expenses',
    faceRevenue - faceTotalExpenses,
    profitBeforeTax,
  );

  expectEqual(
    'Net profit for the period after tax = Net profit before tax - Tax expense',
    profitBeforeTax - taxExpense,
    netResult,
  );

  expectEqual(
    'Note 3.2 employee benefit components = printed Total employee benefits expenses',
    salaryAndWages + leaveExpenses + definedContribution + otherEmployee,
    employeeTotal,
  );
  expectEqual(
    'Note 3.2 Total employee benefits expenses = face Employee benefits',
    employeeTotal,
    employeeOnFace,
  );

  expectEqual(
    'Note 4.1.3 depreciation components = printed Total depreciation',
    buildings +
      leaseholdImprovements +
      plantAndEquipment +
      fleetVehicles +
      infrastructureAssets +
      vdpServiceConcessionAsset +
      rightOfUseAssets,
    totalDepreciation,
  );
  expectEqual(
    'Note 4.1.3 intangible amortisation = printed Total amortisation',
    intangibleAssets,
    totalAmortisation,
  );
  expectEqual(
    'Note 4.1.3 Total depreciation + Total amortisation = printed Total depreciation and amortisation',
    totalDepreciation + totalAmortisation,
    depreciationTotal,
  );
  expectEqual(
    'Note 4.1.3 Total depreciation and amortisation = face Depreciation and amortisation',
    depreciationTotal,
    depOnFace,
  );

  expectEqual(
    'Total comprehensive income = Net profit after tax + Other comprehensive income',
    netResult + otherComprehensive,
    totalComprehensive,
  );

  warnings.push(
    "the audited statement prints an explicit '($ thousands)' unit. The face Statement of Profit or Loss and Other Comprehensive Income prints Revenue from contracts with customers, Other revenue, Total revenue, the ten expense lines including Depreciation and amortisation, Employee benefits, Total expenses, Net profit from operations before tax, Tax expense and Net profit for the period after tax. Total revenue and Total expenses are printed subtotal lines, not derived totals. Employee benefits is cross-checked to Note 3.2 and Depreciation and amortisation to Note 4.1.3; every component sum, printed subtotal and result bridge reconciles at zero tolerance. No other entity and no VIC total is read or computed.",
  );

  return {
    page_number: facePage.page_number,
    employee_note_page_number: employeePage.page_number,
    depreciation_note_page_number: depreciationPage.page_number,
    unit,
    total_revenue: faceRevenue,
    total_expenses: faceTotalExpenses,
    employee_expenses: employeeTotal,
    depreciation_amortisation: depreciationTotal,
    net_result: netResult,
    profit_before_income_tax: profitBeforeTax,
    income_tax_expense: taxExpense,
    total_comprehensive_income: totalComprehensive,
    other_comprehensive_income: otherComprehensive,
    revenue_components: {
      contracts_with_customers: contracts,
      other_revenue: otherRevenue,
    },
    expense_components: {
      depreciation_amortisation: depOnFace,
      operational_expenses: operational,
      employee_benefits: employeeOnFace,
      repairs_and_maintenance: repairsMaintenance,
      administrative_expenses: administrative,
      finance_expenses: finance,
      government_rates_and_taxes: governmentRates,
      asset_transfers_to_councils: assetTransfers,
      other_expenses: otherExpenses,
      net_loss_on_revaluation: revaluationLoss,
    },
    employee_components: {
      total: employeeTotal,
      salary_and_wages: salaryAndWages,
      leave_expenses: leaveExpenses,
      defined_contribution: definedContribution,
      other_employee_expenses: otherEmployee,
    },
    depreciation_components: {
      total: depreciationTotal,
      total_depreciation: totalDepreciation,
      total_amortisation: totalAmortisation,
      buildings,
      leasehold_improvements: leaseholdImprovements,
      plant_and_equipment: plantAndEquipment,
      fleet_vehicles: fleetVehicles,
      infrastructure_assets: infrastructureAssets,
      vdp_service_concession_asset: vdpServiceConcessionAsset,
      right_of_use_assets: rightOfUseAssets,
      intangible_assets: intangibleAssets,
    },
    checks,
    warnings,
    errors,
  };
}

export interface MelbourneWaterParseContext {
  document_url: string;
  document_title: string;
  fiscal_year: string;
  archive: { local_path: string; sha256: string; bytes: number };
  source_date: string;
}

export type MelbourneWaterDeferralPhase =
  'discovery' | 'document' | 'statement' | 'unit' | 'reconciliation';

export interface MelbourneWaterDeferral {
  reason: string;
  phase: MelbourneWaterDeferralPhase;
}

export interface MelbourneWaterLineSpec {
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

export interface MelbourneWaterParseResult {
  records: SpendingRecord[];
  deferral: MelbourneWaterDeferral | null;
  statement: MelbourneWaterStatement | null;
  checks: string[];
  warnings: string[];
  pages_used: number[];
}

export function melbourneWaterNaturalKey(
  entity: string,
  fiscalYear: string,
  lineItem: string,
  documentUrl: string,
): string {
  return `${MELBOURNE_WATER_ID}:${createHash('sha256')
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
  context: MelbourneWaterParseContext,
  spec: MelbourneWaterLineSpec,
  statement: MelbourneWaterStatement,
  extra: Record<string, string | number>,
): string {
  return [
    `source_detail: ${context.archive.local_path}`,
    `sha256: ${context.archive.sha256}`,
    `document: ${context.document_title}`,
    `document_url: ${context.document_url}`,
    `printed_unit: ${statement.unit.kind} (${statement.unit.reason}; x${unitToCents(statement.unit.kind as MoneyUnitKind)} cents per unit)`,
    `statement_page: ${statement.page_number}`,
    `employee_note_page: ${statement.employee_note_page_number}`,
    `depreciation_note_page: ${statement.depreciation_note_page_number}`,
    `line: ${spec.line_item}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${value}`),
    'single Melbourne Water entity; Victorian statutory water corporation under the Water Act 1989 (Vic); not a GBE/State business corporation under the State Owned Enterprises Act 1992; first Victorian water-corporation source; entity-level SOC statement line; provisional; unverified; statewide only (no project/LGA/SA2/postcode/coordinate); never add to government program spending, PNFC benchmark, another water corporation or state-owned entity, a VIC total, a water-corporation set total, a state total, a national total, or any other SOC line',
    ...(statement.warnings.length > 0 ? [`warnings: ${statement.warnings.join(' | ')}`] : []),
  ].join('; ');
}

function mapLine(
  spec: MelbourneWaterLineSpec,
  context: MelbourneWaterParseContext,
  statement: MelbourneWaterStatement,
): SpendingRecord {
  const kind = statement.unit.kind as MoneyUnitKind;
  return {
    amount_cents: amountCents(spec.amount_source, kind),
    measure_type: 'actual',
    fiscal_year: context.fiscal_year,
    source_id: MELBOURNE_WATER_ID,
    source_url: context.document_url,
    verified: false,
    natural_key: melbourneWaterNaturalKey(
      MELBOURNE_WATER_ENTITY,
      context.fiscal_year,
      spec.line_item,
      context.document_url,
    ),
    project_name: `${spec.label} — ${MELBOURNE_WATER_ENTITY}`,
    description: spec.detail,
    jurisdiction_level: 'soc',
    jurisdiction: MELBOURNE_WATER_JURISDICTION,
    delivery_entity: MELBOURNE_WATER_ENTITY,
    funding_source: spec.funding_source,
    source_dataset: `Melbourne Water Annual Report ${context.fiscal_year}`,
    source_date: context.source_date,
    data_quality_flag: 'provisional',
    aggregation_role: 'agency_detail',
    extraction_confidence: spec.extraction_confidence,
    location: { state: MELBOURNE_WATER_JURISDICTION },
    soc_line_item: spec.line_item,
    soc_line_label: spec.label,
    soc_unit: unitName(kind),
    soc_section: spec.section,
    soc_note:
      'Statement of Profit or Loss and Other Comprehensive Income; Note 3.2 Employee benefits expenses; Note 4.1.3 Depreciation, amortisation and impairment',
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

export function parseMelbourneWaterExtraction(
  extraction: PdfExtraction,
  context: MelbourneWaterParseContext,
): MelbourneWaterParseResult {
  const warnings: string[] = [];
  const facePage = findStatementPage(extraction.pages);
  const employeePage = findEmployeeNotePage(extraction.pages);
  const depreciationPage = findDepreciationNotePage(extraction.pages);
  if (!facePage || !employeePage || !depreciationPage) {
    return {
      records: [],
      deferral: {
        reason:
          'no parseable Statement of Profit or Loss and Other Comprehensive Income with Note 3.2 Employee benefits expenses and Note 4.1.3 Depreciation, amortisation and impairment found in the PDF',
        phase: 'statement',
      },
      statement: null,
      checks: [],
      warnings,
      pages_used: [],
    };
  }

  const unit = detectMoneyUnit(unitSamples([facePage, employeePage, depreciationPage]));
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
      pages_used: [facePage.page_number, employeePage.page_number, depreciationPage.page_number],
    };
  }

  const statement = parseMelbourneWaterStatement(facePage, employeePage, depreciationPage, unit);
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
      pages_used: [facePage.page_number, employeePage.page_number, depreciationPage.page_number],
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
      pages_used: [facePage.page_number, employeePage.page_number, depreciationPage.page_number],
    };
  }

  const endDate = /year ended 30 June (\d{4})/i.exec(extraction.text);
  const derivedFiscalYear = endDate
    ? melbourneWaterFiscalYearFromEndDate(`${endDate[1]}-06-30`)
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
      pages_used: [facePage.page_number, employeePage.page_number, depreciationPage.page_number],
    };
  }

  const lineSpecs: MelbourneWaterLineSpec[] = [
    {
      line_item: 'total_revenue',
      label: 'Total revenue',
      amount_source: statement.total_revenue,
      funding_source: MELBOURNE_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'revenue',
      detail:
        'Printed Total revenue on the audited Statement of Profit or Loss and Other Comprehensive Income, equal to the exact sum of the printed Revenue from contracts with customers and Other revenue lines. A printed subtotal, not a derived total. Entity-level revenue; never added to government program spending or another entity.',
    },
    {
      line_item: 'total_expenses',
      label: 'Total expenses',
      amount_source: statement.total_expenses,
      funding_source: MELBOURNE_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Total expenses on the audited statement, equal to the exact sum of the ten printed expense lines (Depreciation and amortisation, Operational expenses, Employee benefits, Repairs and maintenance, Administrative expenses, Finance expenses, Government rates and taxes, Asset transfers to Councils, Other expenses and Net loss on revaluation of non-financial assets). A printed subtotal, not a derived total.',
    },
    {
      line_item: 'employee_expenses',
      label: 'Employee benefits',
      amount_source: statement.employee_expenses,
      funding_source: MELBOURNE_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Employee benefits line on the audited statement, which equals the printed Total employee benefits expenses in Note 3.2 and the exact sum of its four printed components (salary and wages, leave, defined contribution and other employee expenses). A component of Total expenses; recorded once as a component, never added on top of total expenses.',
    },
    {
      line_item: 'depreciation_amortisation',
      label: 'Depreciation and amortisation',
      amount_source: statement.depreciation_amortisation,
      funding_source: MELBOURNE_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'expenses',
      detail:
        'Printed Depreciation and amortisation line on the audited statement, equal to the printed Total depreciation plus Total amortisation in Note 4.1.3 and to its printed component lines. A component of Total expenses; never added to it.',
    },
    {
      line_item: 'net_result',
      label: 'Net profit for the period after tax',
      amount_source: statement.net_result,
      funding_source: MELBOURNE_WATER_ENTITY,
      potential_double_count: false,
      extraction_confidence: 'high',
      section: 'result',
      detail:
        'Printed Net profit for the period after tax (the net result), which bridges exactly to Net profit from operations before tax minus Tax expense, and to Total comprehensive income minus Other comprehensive income. A result line, not an expense component; never added to revenue or expenses.',
      printed_sign: statement.net_result < 0 ? 'negative' : 'positive',
    },
  ];

  const records = lineSpecs.map((spec) => mapLine(spec, context, statement));
  warnings.push(
    'SOC entity rows are provisional and unverified; every printed subtotal, note component sum and result bridge reconciles exactly at zero tolerance.',
  );
  return {
    records,
    deferral: null,
    statement,
    checks: statement.checks,
    warnings,
    pages_used: [facePage.page_number, employeePage.page_number, depreciationPage.page_number],
  };
}

export interface MelbourneWaterConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
  /** Test/CLI override; the live connector normally discovers the latest PDF. */
  document?: MelbourneWaterAnnualReportLink;
}

function documentFromEnv(): MelbourneWaterAnnualReportLink | null {
  const url = process.env.VIC_MELBOURNE_WATER_ANNUAL_REPORT_URL;
  if (!url) return null;
  const fiscalYear =
    melbourneWaterFiscalYearFromFilename(url) ??
    process.env.VIC_MELBOURNE_WATER_ANNUAL_REPORT_FISCAL_YEAR ??
    null;
  if (!fiscalYear) {
    throw new Error(
      'VIC_MELBOURNE_WATER_ANNUAL_REPORT_URL is set but no fiscal year can be derived from the URL; set VIC_MELBOURNE_WATER_ANNUAL_REPORT_FISCAL_YEAR (for example 2025-26)',
    );
  }
  let filename = 'Melbourne Water Annual Report.pdf';
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (/\.pdf$/i.test(last)) filename = last;
  } catch {
    // Keep the fallback filename.
  }
  const [start] = fiscalYear.split('-');
  return {
    url,
    filename,
    fiscal_year: fiscalYear,
    title: `Melbourne Water Annual Report ${start}-${Number(start) + 1}`,
    discovery_page: MELBOURNE_WATER_SOURCE_URL,
    accessible: false,
  };
}

async function writeArchiveSidecars(
  archived: ArchivedSourceRecord,
  document: MelbourneWaterAnnualReportLink,
  pdfPages: number,
): Promise<void> {
  const directory = path.dirname(archived.local_path);
  const filename = path.basename(archived.local_path);
  await writeFile(path.join(directory, 'SHA256SUMS'), `${archived.sha256}  ${filename}\n`, 'utf8');
  await writeFile(
    path.join(directory, 'retrieval.json'),
    `${JSON.stringify(
      {
        source_id: MELBOURNE_WATER_ID,
        entity: MELBOURNE_WATER_ENTITY,
        jurisdiction: MELBOURNE_WATER_JURISDICTION,
        legal_class: MELBOURNE_WATER_LEGAL_CLASS,
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
  document: MelbourneWaterAnnualReportLink,
  archive: ArchivedSourceRecord | null,
  deferral: MelbourneWaterDeferral,
): Promise<void> {
  await DeferredSocDocumentModel.updateOne(
    { source_id: MELBOURNE_WATER_ID, document_url: document.url },
    {
      $set: {
        entity: MELBOURNE_WATER_ENTITY,
        jurisdiction: MELBOURNE_WATER_JURISDICTION,
        fiscal_year: document.fiscal_year,
        title: document.title,
        ...(archive ? { sha256: archive.sha256 } : {}),
        reason: `${deferral.phase}: ${deferral.reason}`,
        discovered_at: new Date(),
        status: 'deferred',
        notes:
          'Deferred by the Melbourne Water SOC adapter; no row from this document was ingested. A human must resolve the unit/table/reconciliation reason before re-parsing.',
      },
    },
    { upsert: true },
  );
}

/** Build the live Melbourne Water connector. */
export function createMelbourneWaterConnector(
  options: MelbourneWaterConnectorOptions = {},
): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  const connector: Connector = {
    id: MELBOURNE_WATER_ID,
    name: MELBOURNE_WATER_NAME,
    publisher: MELBOURNE_WATER_PUBLISHER,
    source_url: MELBOURNE_WATER_SOURCE_URL,
    status: 'active',
    jurisdiction_level: 'soc',
    license: MELBOURNE_WATER_LICENSE,
    notes:
      "VIC SOC (first Victorian water-corporation source): Melbourne Water Corporation only, a Victorian statutory water corporation under the Water Act 1989 (Vic) — not a Government Business Enterprise or State business corporation under the State Owned Enterprises Act 1992. The latest annual report is discovered from the official annual-report page (no hard-coded PDF URL) and the exact PDF is SHA-256 archived outside the repo with SHA256SUMS and retrieval.json. The audited statement prints an explicit '($ thousands)' unit; the adapter reads the printed Total revenue, Total expenses, Employee benefits, Depreciation and amortisation and Net profit for the period after tax lines and cross-checks Employee benefits to Note 3.2 and Depreciation and amortisation to Note 4.1.3. Every printed component sum, printed subtotal and result bridge reconciles exactly at zero tolerance. Every row is a provisional, unverified entity-level SOC statement line (jurisdiction_level 'soc', aggregation_role 'agency_detail'). No VIC total, water-corporation set total, state total or national total is created, and Melbourne Water is never added to government program spending, the PNFC benchmark, another water corporation or state-owned entity, or another SOC line.",
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const document =
        options.document ??
        documentFromEnv() ??
        (await discoverMelbourneWaterAnnualReport(fetchImpl));
      const response = await fetchImpl(document.url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        throw new Error(`Melbourne Water PDF fetch HTTP ${response.status} for ${document.url}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const archived = await archiveSourceDocument({
        source_id: MELBOURNE_WATER_ID,
        title: document.title,
        original_url: document.url,
        retrieved_from: document.url,
        archived_from: 'direct',
        filename: document.filename,
        content_type: 'application/pdf',
        data: bytes,
        root: options.archiveRoot,
        notes:
          'Melbourne Water annual-report PDF; archived for auditable Victorian SOC entity-statement extraction.',
      });
      await verifySourceDocument(archived);
      const extraction = await extractArchivedPdf(archived);
      await writeArchiveSidecars(archived, document, extraction.pages.length);
      const now = options.now?.() ?? new Date();
      const context: MelbourneWaterParseContext = {
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
      const parsed = parseMelbourneWaterExtraction(extraction, context);
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
      return parsed.records.map((record) => ({ kind: 'vic-melbourne-water-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'vic-melbourne-water-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Melbourne Water measure; skipped');
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
