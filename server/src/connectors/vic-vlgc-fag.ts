import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { SpendingRecord } from '@ausspend/shared';
import type { ArchivedSourceRecord } from './source-archive.js';
import { archiveSourceDocument, inferContentType } from './source-archive.js';
import { extractPdf } from './pdf-extract.js';
import type { Connector, RawRecord } from './types.js';
import { councilNameFromLabel } from './vic-vlgc-vgc1.js';

/**
 * Victorian Local Government Grants Commission (VLGGC) Commonwealth Financial
 * Assistance Grants (FAG) for FY2024-25 and FY2023-24 — the VIC grants overlay.
 *
 * The FAG is a Commonwealth grant administered by the VLGGC and paid to every
 * Victorian council. It is grant INCOME, not council spending, and it is a
 * component of the grant revenue already reported by councils in their GPFS and
 * in the VLGGC VGC1/ABS questionnaire. Every row therefore carries
 * `potential_double_count: true` and is never added to VGC1/ABS spending or to
 * any other grant source.
 *
 * Rows are one printed total per council per year (79 + 79): the printed
 * `Total Financial Assistance Grants` (2024-25 Appendix 2A) and the printed
 * final FAG total (2023-24, Appendix 1 of the 2024-25 report). We deliberately
 * do NOT sum the printed general-purpose/local-roads components into a new
 * total, and we do NOT publish a cross-council total. The source Totals rows are
 * read for reconciliation and suppressed from the output.
 *
 * LICENCE: the report's copyright page is recorded verbatim. It says the
 * document (except logos/emblems/artwork) is made available under the Creative
 * Commons Attribution 3.0 Australia licence, and the State of Victoria
 * disclaimer applies. The underlying VLGGC questionnaire data collection uses
 * the separate VLGGC attribution/permission Conditions of Use (NOT CC BY). Both
 * are recorded; this is not the CC BY 4.0 assumed for other VIC data. Only
 * derived rows are emitted and the PDFs are not redistributed.
 *
 * UNITS: whole AUD in the printed tables; converted explicitly to integer cents
 * at x100. The unit is never inferred from magnitude.
 */

export const FAG_ID = 'vic-vlgc-fag';
export const FAG_NAME = 'Victorian Local Government Grants Commission Financial Assistance Grants';
export const FAG_PUBLISHER =
  'Victorian Local Government Grants Commission (Local Government Victoria)';
export const FAG_LANDING_URL =
  'https://www.localgovernment.vic.gov.au/funding-programs/victoria-grants-commission/consultation-and-operations';
export const FAG_UNIT = 'AUD';
export const FAG_UNIT_TO_CENTS = 100;
export const FAG_DATA_QUALITY_FLAG = 'provisional/local_government';
export const FAG_MEASURE = 'total_financial_assistance_grant';

export const FAG_ATTRIBUTION =
  'Victorian Local Government Grants Commission Annual Allocation Report — © State of Victoria (Department of Government Services)';
export const FAG_ATTRIBUTION_SHORT = 'Victorian Local Government Grants Commission data collection';
export const FAG_VLGGC_CONDITIONS_OF_USE =
  'Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission data collection.';
export const FAG_VLGGC_DISCLAIMER =
  'The data in these spreadsheets is provided for information purposes only. These spreadsheets are produced from data sourced annually from Local Government (councils) in Victoria. Councils provide permission for this online release. The data has been analysed, but the Victorian Local Government Grants Commission does not guarantee the material to be free from error.';
export const FAG_REPORT_COPYRIGHT_2024 =
  '© Copyright State of Victoria 2024 Department of Government Services';
export const FAG_REPORT_COPYRIGHT_2023 =
  '© Copyright State of Victoria 2023 Department of Government Services';
export const FAG_REPORT_LICENCE_VERBATIM =
  'Except for any logos, emblems, trademarks, artwork and photography this document is made available under the terms of the Creative Commons Attribution 3.0 Australia license.';
export const FAG_REPORT_DISCLAIMER =
  'This publication may be of assistance to you but the State of Victoria and its employees do not guarantee that the publication is without flaw of any kind or is wholly appropriate for your particular purposes and therefore disclaims all liability for any error, loss or other consequence which may arise from you relying on any information in this publication.';
export const FAG_LICENSE =
  `VLGGC attribution/permission — NOT CC BY for the underlying VLGGC data collection. Report copyright page (verbatim): "${FAG_REPORT_COPYRIGHT_2024}"; "${FAG_REPORT_LICENCE_VERBATIM}" ` +
  `The separate VLGGC Conditions of Use are: "${FAG_VLGGC_CONDITIONS_OF_USE}" Councils provide permission for this online release; the Commission does not guarantee the material to be free from error. ` +
  'This is not the CC BY 4.0 licence used for other Victorian data. Derived rows only; the source PDFs are not redistributed.';
export const FAG_CAVEAT =
  'Commonwealth Financial Assistance Grant allocation administered by the VLGGC: grant income, not council spending. One printed total per council per year; no cross-council total and no invented component sum. FAG is a component of council grant revenue and overlaps VGC1 grant revenue/ABS grant lines, so every row is potential_double_count=true and is never added to VGC1/ABS spending or to any other grant source.';

export interface FagReportDescriptor {
  /** Fiscal year the report is named for (also the fiscal_year of its allocation table). */
  fiscal_year: string;
  resource_url: string;
  snapshot_timestamp: string;
  retrieval_url: string;
  sha256: string;
  bytes: number;
  filename: string;
  report_date: string;
  copyright: string;
}

const V = 'https://www.localgovernment.vic.gov.au/__data/assets/pdf_file';

export const FAG_2024_25_REPORT: FagReportDescriptor = {
  fiscal_year: '2024-25',
  resource_url: `${V}/0019/210727/2024-25-VLGGC-Annual-Allocation-Report-Sept-2024.pdf`,
  snapshot_timestamp: '20241020190403',
  retrieval_url: `${V}/0019/210727/2024-25-VLGGC-Annual-Allocation-Report-Sept-2024.pdf`,
  sha256: '9efcc61d5105cdae5353a536759e36470c44af6417fc9c3af4c2990473571788',
  bytes: 1_628_398,
  filename: '2024-25-VLGGC-Annual-Allocation-Report-Sept-2024.pdf',
  report_date: 'September 2024',
  copyright: FAG_REPORT_COPYRIGHT_2024,
};
FAG_2024_25_REPORT.retrieval_url = `https://web.archive.org/web/${FAG_2024_25_REPORT.snapshot_timestamp}id_/${FAG_2024_25_REPORT.resource_url}`;

export const FAG_2023_24_REPORT: FagReportDescriptor = {
  fiscal_year: '2023-24',
  resource_url: `${V}/0023/202496/2023-24-VLGGC-ALLOCATION-REPORT-Sept-2023.pdf`,
  snapshot_timestamp: '20231022163029',
  retrieval_url: '',
  sha256: 'c2a23f7d0e77ae44d3ebb9f2710af612b4df8bb27e3c963b171f4cc8b7968604',
  bytes: 1_605_938,
  filename: '2023-24-VLGGC-ALLOCATION-REPORT-Sept-2023.pdf',
  report_date: 'September 2023',
  copyright: FAG_REPORT_COPYRIGHT_2023,
};
FAG_2023_24_REPORT.retrieval_url = `https://web.archive.org/web/${FAG_2023_24_REPORT.snapshot_timestamp}id_/${FAG_2023_24_REPORT.resource_url}`;

/** The 79 council labels exactly as printed in the VLGGC allocation appendices. */
export const FAG_COUNCIL_LABELS = [
  'Alpine S',
  'Ararat RC',
  'Ballarat C',
  'Banyule C',
  'Bass Coast S',
  'Baw Baw S',
  'Bayside C',
  'Benalla RC',
  'Boroondara C',
  'Brimbank C',
  'Buloke S',
  'Campaspe S',
  'Cardinia S',
  'Casey C',
  'Central Goldfields S',
  'Colac Otway S',
  'Corangamite S',
  'Darebin C',
  'East Gippsland S',
  'Frankston C',
  'Gannawarra S',
  'Glen Eira C',
  'Glenelg S',
  'Golden Plains S',
  'Greater Bendigo C',
  'Greater Dandenong C',
  'Greater Geelong C',
  'Greater Shepparton C',
  'Hepburn S',
  'Hindmarsh S',
  'Hobsons Bay C',
  'Horsham RC',
  'Hume C',
  'Indigo S',
  'Kingston C',
  'Knox C',
  'Latrobe C',
  'Loddon S',
  'Macedon Ranges S',
  'Manningham C',
  'Mansfield S',
  'Maribyrnong C',
  'Maroondah C',
  'Melbourne C',
  'Melton C',
  'Merri-bek C',
  'Mildura RC',
  'Mitchell S',
  'Moira S',
  'Monash C',
  'Moonee Valley C',
  'Moorabool S',
  'Mornington Peninsula S',
  'Mount Alexander S',
  'Moyne S',
  'Murrindindi S',
  'Nillumbik S',
  'Northern Grampians S',
  'Port Phillip C',
  'Pyrenees S',
  'Queenscliffe B',
  'South Gippsland S',
  'Southern Grampians S',
  'Stonnington C',
  'Strathbogie S',
  'Surf Coast S',
  'Swan Hill RC',
  'Towong S',
  'Wangaratta RC',
  'Warrnambool C',
  'Wellington S',
  'West Wimmera S',
  'Whitehorse C',
  'Whittlesea C',
  'Wodonga C',
  'Wyndham C',
  'Yarra C',
  'Yarra Ranges S',
  'Yarriambiack S',
] as const;

/** Councils whose 2024-25 printed row includes a natural-disaster column. */
export const FAG_NATURAL_DISASTER_2024_25 = new Set([
  'Ararat RC',
  'Baw Baw S',
  'Central Goldfields S',
  'East Gippsland S',
  'Gannawarra S',
  'Greater Bendigo C',
  'Hepburn S',
  'Hume C',
  'Latrobe C',
  'Loddon S',
  'Macedon Ranges S',
  'Mitchell S',
  'Moorabool S',
  'Moyne S',
  'Murrindindi S',
  'South Gippsland S',
  'Wellington S',
]);

/** Councils whose 2023-24 printed row includes a natural-disaster column. */
export const FAG_NATURAL_DISASTER_2023_24 = new Set([
  'Baw Baw S',
  'East Gippsland S',
  'Mansfield S',
  'Moorabool S',
  'South Gippsland S',
  'Wellington S',
]);

export interface FagSelection {
  report: FagReportDescriptor;
  ledger: '2024-25-estimated' | '2023-24-final' | '2023-24-estimated-cross-check';
}

export interface FagYearRaw {
  fiscal_year: string;
  allocation_status: 'estimated' | 'final';
  council_label: string;
  council_name: string;
  amount_dollars: number;
  prior_estimate_dollars?: number;
  published_difference_dollars?: number;
  equalisation_dollars?: number;
  natural_disaster_dollars?: number;
  local_roads_dollars?: number;
  data_project_dollars?: number;
}

export interface FagParsedYear {
  fiscal_year: string;
  allocation_status: 'estimated' | 'final';
  rows: FagYearRaw[];
  sum_dollars: number;
  published_total_dollars: number;
  published_initial_dollars?: number;
  published_difference_dollars?: number;
  totals_numbers: number[];
  totals_suppressed: number;
}

export interface FagSectionRows {
  rows: FagYearRaw[];
  sum_dollars: number;
  totals_numbers: number[];
}

export interface FagRaw extends Record<string, unknown> {
  kind: 'fag_total';
  council_label: string;
  council_name: string;
  fiscal_year: string;
  allocation_status: 'estimated' | 'final';
  amount_dollars: number;
  prior_estimate_dollars?: number;
  published_difference_dollars?: number;
  report_fiscal_year: string;
  report_dataset: string;
  source_url: string;
  resource_url: string;
  retrieval_url: string;
  source_sha256: string;
  source_date: string;
  source_report_date: string;
  report_snapshot: string;
}

export interface FagTransformResult {
  records: SpendingRecord[];
  skipped: Array<{ label: string; reason: string }>;
  duplicates: number;
}

export interface FagLoadedSource {
  raw: FagRaw[];
  records: SpendingRecord[];
  archives: ArchivedSourceRecord[];
  warnings: string[];
  parsed: {
    fy2024_25: FagParsedYear;
    fy2023_24_final: FagParsedYear;
    fy2023_24_estimate: FagParsedYear;
  };
}

export interface FagConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  /** Adopt already-downloaded PDFs instead of fetching. */
  source2024_25Path?: string;
  source2023_24Path?: string;
  /** Injected for tests; defaults to pdfjs extraction. */
  readPdfText?: (filePath: string) => Promise<string>;
}

function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LABEL_ALTERNATION = [...FAG_COUNCIL_LABELS]
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join('|');
const LABEL_REGEX = new RegExp(LABEL_ALTERNATION, 'g');

export function fagCouncilName(label: string): string | null {
  const match = /^(.+?) (S|C|RC|B)$/.exec(label.trim());
  if (!match) return null;
  return councilNameFromLabel(`${match[1]} (${match[2]})`);
}

export function fagAmountToCents(
  value: unknown,
): { cents: number; printed_sign: 'positive' | 'negative' } | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/g, '').trim())
        : Number.NaN;
  if (!Number.isFinite(numeric)) return null;
  const cents = Math.round(Math.abs(numeric) * FAG_UNIT_TO_CENTS);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return { cents, printed_sign: numeric < 0 ? 'negative' : 'positive' };
}

export function fagNaturalKey(parts: readonly (string | number | null | undefined)[]): string {
  return `vic-vlgc-fag:${sha256(parts.map((part) => String(part ?? '')).join('\u001f')).slice(0, 40)}`;
}

function sliceSection(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  if (startIndex < 0) throw new Error(`VLGGC FAG PDF section start not found: ${start}`);
  if (end === '\u0000') return text.slice(startIndex);
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error(`VLGGC FAG PDF section end not found: ${end}`);
  return text.slice(startIndex, endIndex);
}

function numbersIn(chunk: string): number[] {
  return [...chunk.matchAll(/\d[\d,]*/g)].map((match) => Number(match[0]!.replace(/,/g, '')));
}

/**
 * Parse one printed allocation table. `expectedNumberCount` is the exact number
 * of numeric cells in each council row; only the first that many numbers after
 * a label are read, so a trailing source Totals row is never mistaken for part
 * of the last council's row.
 */
function parseAllocationTable(
  text: string,
  start: string,
  end: string,
  expectedNumberCount: (label: string) => number,
  makeRow: (label: string, numbers: number[]) => FagYearRaw,
  selectPublishedTotal: (totals: number[]) => number = (totals) => totals[totals.length - 1]!,
): FagSectionRows {
  const section = sliceSection(text, start, end);
  const matches = [...section.matchAll(LABEL_REGEX)];
  const seen = new Set<string>();
  const rows: FagYearRaw[] = [];
  let totalsNumbers: number[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const label = match[0]!;
    if (seen.has(label)) throw new Error(`VLGGC FAG label appears twice in one table: ${label}`);
    seen.add(label);
    const next = matches[index + 1];
    const chunkEnd = next ? next.index : section.length;
    const chunk = section.slice(match.index! + label.length, chunkEnd);
    const numbers = numbersIn(chunk);
    const wanted = expectedNumberCount(label);
    if (numbers.length < wanted) {
      throw new Error(`VLGGC FAG row ${label} has ${numbers.length} numbers, expected ${wanted}`);
    }
    rows.push(makeRow(label, numbers.slice(0, wanted)));
    if (!next) totalsNumbers = numbers.slice(wanted);
  }
  if (rows.length !== FAG_COUNCIL_LABELS.length) {
    throw new Error(
      `VLGGC FAG table has ${rows.length} council rows, expected ${FAG_COUNCIL_LABELS.length} (premise falsified)`,
    );
  }
  if (totalsNumbers.length === 0) {
    throw new Error('VLGGC FAG table has no printed Totals row to reconcile against');
  }
  const sumDollars = rows.reduce((sum, row) => sum + row.amount_dollars, 0);
  const publishedTotalDollars = selectPublishedTotal(totalsNumbers);
  if (sumDollars !== publishedTotalDollars) {
    throw new Error(
      `VLGGC FAG council rows sum to ${sumDollars}, printed total is ${publishedTotalDollars}`,
    );
  }
  return { rows, sum_dollars: sumDollars, totals_numbers: totalsNumbers };
}

export function parseFag2024_25Estimate(text: string): FagParsedYear {
  const parsed = parseAllocationTable(
    text,
    'Appendix 2 2024-25 Allocations A. Estimated Allocations',
    'Appendix 2 2024-25 Allocations B. Payments',
    (label) => (FAG_NATURAL_DISASTER_2024_25.has(label) ? 5 : 4),
    (label, numbers) => {
      const councilName = fagCouncilName(label);
      if (!councilName) throw new Error(`cannot expand FAG council label ${label}`);
      const hasNaturalDisaster = FAG_NATURAL_DISASTER_2024_25.has(label);
      const equalisation = numbers[0]!;
      const naturalDisaster = hasNaturalDisaster ? numbers[1]! : 0;
      const localRoads = numbers[hasNaturalDisaster ? 2 : 1]!;
      const dataProject = numbers[hasNaturalDisaster ? 3 : 2]!;
      const total = numbers[hasNaturalDisaster ? 4 : 3]!;
      if (equalisation + naturalDisaster + localRoads + dataProject !== total) {
        throw new Error(
          `VLGGC FAG 2024-25 components do not sum to the printed total for ${label}`,
        );
      }
      return {
        fiscal_year: '2024-25',
        allocation_status: 'estimated',
        council_label: label,
        council_name: councilName,
        amount_dollars: total,
        equalisation_dollars: equalisation,
        natural_disaster_dollars: naturalDisaster,
        local_roads_dollars: localRoads,
        data_project_dollars: dataProject,
      };
    },
    (totals) => totals[4]!,
  );
  return {
    fiscal_year: '2024-25',
    allocation_status: 'estimated',
    rows: parsed.rows,
    sum_dollars: parsed.sum_dollars,
    published_total_dollars: parsed.totals_numbers[4]!,
    totals_numbers: parsed.totals_numbers,
    totals_suppressed: 1,
  };
}

export function parseFag2023_24Estimate(text: string): FagParsedYear {
  const parsed = parseAllocationTable(
    text,
    'Appendix 2 2023-24 Allocations A. Estimated Allocations',
    'Appendix 2 2023-24 Allocations B. Payments',
    (label) => (FAG_NATURAL_DISASTER_2023_24.has(label) ? 5 : 4),
    (label, numbers) => {
      const councilName = fagCouncilName(label);
      if (!councilName) throw new Error(`cannot expand FAG council label ${label}`);
      const hasNaturalDisaster = FAG_NATURAL_DISASTER_2023_24.has(label);
      const equalisation = numbers[0]!;
      const naturalDisaster = hasNaturalDisaster ? numbers[1]! : 0;
      const gpTotal = numbers[hasNaturalDisaster ? 2 : 1]!;
      const localRoads = numbers[hasNaturalDisaster ? 3 : 2]!;
      const total = numbers[hasNaturalDisaster ? 4 : 3]!;
      if (equalisation + naturalDisaster !== gpTotal) {
        throw new Error(`VLGGC FAG 2023-24 GP components do not sum for ${label}`);
      }
      if (gpTotal + localRoads !== total) {
        throw new Error(`VLGGC FAG 2023-24 GP + roads do not sum to total for ${label}`);
      }
      return {
        fiscal_year: '2023-24',
        allocation_status: 'estimated',
        council_label: label,
        council_name: councilName,
        amount_dollars: total,
        equalisation_dollars: equalisation,
        natural_disaster_dollars: naturalDisaster,
        local_roads_dollars: localRoads,
      };
    },
    (totals) => totals[4]!,
  );
  return {
    fiscal_year: '2023-24',
    allocation_status: 'estimated',
    rows: parsed.rows,
    sum_dollars: parsed.sum_dollars,
    published_total_dollars: parsed.totals_numbers[4]!,
    totals_numbers: parsed.totals_numbers,
    totals_suppressed: 1,
  };
}

/**
 * Parse the FY2023-24 FINAL FAG table from Appendix 1 of the 2024-25 report.
 * That table is split by a general-purpose/local-roads page, so the two printed
 * halves are parsed separately and combined. Only the printed FINAL column is
 * emitted; the initial and difference columns are retained for reconciliation.
 */
export function parseFag2023_24Final(text: string): FagParsedYear {
  const firstHalf = sliceSection(
    text,
    '2023-24 Final Grant Allocations Appendix 1 Financial Assistance Grants',
    'Page 40 Victorian Local Government Grants Commission',
  );
  const secondHalf = sliceSection(
    text,
    'Page 41 OFFICIAL OFFICIAL',
    'Appendix 2 2024-25 Allocations',
  );
  const parsed = parseAllocationTable(
    `${firstHalf}\n${secondHalf}`,
    '2023-24 Final Grant Allocations Appendix 1 Financial Assistance Grants',
    '\u0000',
    () => 3,
    (label, numbers) => {
      const councilName = fagCouncilName(label);
      if (!councilName) throw new Error(`cannot expand FAG council label ${label}`);
      const initial = numbers[0]!;
      const final = numbers[1]!;
      const difference = numbers[2]!;
      if (final - initial !== difference) {
        throw new Error(
          `VLGGC FAG 2023-24 final - initial does not equal the printed difference for ${label}`,
        );
      }
      return {
        fiscal_year: '2023-24',
        allocation_status: 'final',
        council_label: label,
        council_name: councilName,
        amount_dollars: final,
        prior_estimate_dollars: initial,
        published_difference_dollars: difference,
      };
    },
    (totals) => totals[1]!,
  );
  const totals = parsed.totals_numbers;
  if (totals.length < 3) throw new Error('VLGGC FAG 2023-24 final Totals row is incomplete');
  const initialTotal = totals[0]!;
  const finalTotal = totals[1]!;
  const differenceTotal = totals[2]!;
  if (finalTotal - initialTotal !== differenceTotal) {
    throw new Error('VLGGC FAG 2023-24 final Totals row does not balance');
  }
  if (parsed.sum_dollars !== finalTotal) {
    throw new Error('VLGGC FAG 2023-24 final council rows do not sum to the printed total');
  }
  return {
    fiscal_year: '2023-24',
    allocation_status: 'final',
    rows: parsed.rows,
    sum_dollars: parsed.sum_dollars,
    published_total_dollars: finalTotal,
    published_initial_dollars: initialTotal,
    published_difference_dollars: differenceTotal,
    totals_numbers: totals,
    totals_suppressed: 1,
  };
}

/**
 * Reconcile the two independent 2023-24 statements: the September 2023
 * estimated allocation and the final allocation printed in the 2024-25 report.
 * The per-council final-minus-estimate must equal the printed difference, and
 * the totals must equal the published $864,120 adjustment.
 */
export function reconcileFag2023_24(
  estimate: FagParsedYear,
  final: FagParsedYear,
): { checked: number; total_difference_dollars: number } {
  const estimates = new Map(estimate.rows.map((row) => [row.council_label, row.amount_dollars]));
  let totalDifference = 0;
  for (const row of final.rows) {
    const prior = estimates.get(row.council_label);
    if (prior === undefined) {
      throw new Error(`2023-24 final row ${row.council_label} has no prior estimate`);
    }
    totalDifference += row.amount_dollars - prior;
    if (row.amount_dollars - prior !== row.published_difference_dollars) {
      throw new Error(
        `2023-24 final minus estimate differs from the printed difference for ${row.council_label}`,
      );
    }
  }
  if (totalDifference !== final.published_difference_dollars) {
    throw new Error(
      `2023-24 final-minus-estimate total ${totalDifference} does not equal published ${String(
        final.published_difference_dollars,
      )}`,
    );
  }
  return { checked: final.rows.length, total_difference_dollars: totalDifference };
}

export function assertFagPremise(parsed: {
  fy2024_25: FagParsedYear;
  fy2023_24_final: FagParsedYear;
  fy2023_24_estimate: FagParsedYear;
}): void {
  const checkYear = (year: FagParsedYear, expectedTotal: number): void => {
    if (year.rows.length !== 79) {
      throw new Error(`VLGGC FAG ${year.fiscal_year} has ${year.rows.length} rows, expected 79`);
    }
    if (new Set(year.rows.map((row) => row.council_name)).size !== 79) {
      throw new Error(`VLGGC FAG ${year.fiscal_year} council names are not unique`);
    }
    if (year.rows.some((row) => /^totals?$/i.test(row.council_name))) {
      throw new Error(`VLGGC FAG ${year.fiscal_year} emitted a Totals entity`);
    }
    if (year.published_total_dollars !== expectedTotal) {
      throw new Error(
        `VLGGC FAG ${year.fiscal_year} printed total ${year.published_total_dollars}, expected ${expectedTotal}`,
      );
    }
  };
  checkYear(parsed.fy2024_25, 789_162_301);
  checkYear(parsed.fy2023_24_final, 748_241_357);
  checkYear(parsed.fy2023_24_estimate, 747_377_237);
  if (parsed.fy2023_24_final.published_initial_dollars !== 747_377_237) {
    throw new Error('VLGGC FAG 2023-24 final table initial total is not the published estimate');
  }
  if (parsed.fy2023_24_final.published_difference_dollars !== 864_120) {
    throw new Error('VLGGC FAG 2023-24 final table adjustment total is not $864,120');
  }
  reconcileFag2023_24(parsed.fy2023_24_estimate, parsed.fy2023_24_final);
}

function reportDataset(ledger: FagSelection['ledger']): string {
  if (ledger === '2024-25-estimated') {
    return `VLGGC Annual Allocation Report 2024-25 — Appendix 2A: 2024-25 estimated Financial Assistance Grants`;
  }
  if (ledger === '2023-24-final') {
    return `VLGGC Annual Allocation Report 2024-25 — Appendix 1: 2023-24 final Financial Assistance Grants`;
  }
  return `VLGGC Annual Allocation Report 2023-24 — Appendix 2A: 2023-24 estimated Financial Assistance Grants (cross-check)`;
}

export function buildFagRaw(parsed: {
  fy2024_25: FagParsedYear;
  fy2023_24_final: FagParsedYear;
  fy2023_24_estimate: FagParsedYear;
}): FagRaw[] {
  const raw: FagRaw[] = [];
  const emit = (
    year: FagParsedYear,
    ledger: FagSelection['ledger'],
    report: FagReportDescriptor,
  ): void => {
    for (const row of year.rows) {
      raw.push({
        kind: 'fag_total',
        council_label: row.council_label,
        council_name: row.council_name,
        fiscal_year: year.fiscal_year,
        allocation_status: year.allocation_status,
        amount_dollars: row.amount_dollars,
        ...(row.prior_estimate_dollars !== undefined
          ? { prior_estimate_dollars: row.prior_estimate_dollars }
          : {}),
        ...(row.published_difference_dollars !== undefined
          ? { published_difference_dollars: row.published_difference_dollars }
          : {}),
        report_fiscal_year: report.fiscal_year,
        report_dataset: reportDataset(ledger),
        source_url: FAG_LANDING_URL,
        resource_url: report.resource_url,
        retrieval_url: report.retrieval_url,
        source_sha256: report.sha256,
        source_date: report.snapshot_timestamp
          .slice(0, 8)
          .replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        source_report_date: report.report_date,
        report_snapshot: report.snapshot_timestamp,
      });
    }
  };
  emit(parsed.fy2024_25, '2024-25-estimated', FAG_2024_25_REPORT);
  emit(parsed.fy2023_24_final, '2023-24-final', FAG_2024_25_REPORT);
  return raw;
}

function mapFagRaw(raw: FagRaw): SpendingRecord {
  const amount = fagAmountToCents(raw.amount_dollars);
  if (!amount) throw new Error(`unusable FAG whole-AUD amount for ${raw.council_name}`);
  const key = fagNaturalKey([
    raw.fiscal_year,
    raw.council_name,
    FAG_MEASURE,
    raw.allocation_status,
    raw.report_snapshot,
  ]);
  const priorNote =
    raw.prior_estimate_dollars !== undefined
      ? ` Published 2023-24 final allocation ${raw.amount_dollars} vs the September 2023 estimate ${raw.prior_estimate_dollars}; difference ${String(
          raw.published_difference_dollars,
        )} equals the printed adjustment.`
      : '';
  const note = [
    `Source: VLGGC Annual Allocation Report ${raw.report_fiscal_year} (${raw.source_report_date}), ${raw.report_dataset}`,
    `Official landing page: ${FAG_LANDING_URL}`,
    `Official resource: ${raw.resource_url}`,
    `Retrieved from: ${raw.retrieval_url}`,
    `Report SHA-256: ${raw.source_sha256}`,
    `Unit: whole ${FAG_UNIT} converted at ${FAG_UNIT_TO_CENTS} cents per dollar; unit is explicit, never inferred from magnitude`,
    `Printed row: ${raw.council_label} — Total Financial Assistance Grants (${raw.allocation_status})`,
    `Attribution: ${FAG_ATTRIBUTION}. Report copyright page (verbatim): "${raw.report_fiscal_year === '2024-25' ? FAG_REPORT_COPYRIGHT_2024 : FAG_REPORT_COPYRIGHT_2023}"; "${FAG_REPORT_LICENCE_VERBATIM}" The underlying VLGGC data collection Conditions of Use are: "${FAG_VLGGC_CONDITIONS_OF_USE}" This is attribution/permission for the data collection, NOT CC BY; the PDF is not redistributed.`,
    'Commonwealth Financial Assistance Grant income administered by the VLGGC; not council spending and not a project/LGA allocation.',
    `OVERLAP: FAG is a component of council grant revenue and overlaps VGC1 grant revenue and ABS grant lines. potential_double_count=true; never add this row to VGC1/ABS expenditure or to any other grant source, and never sum across councils.${priorNote}`,
    'No cross-council total; one printed total per council per year; no invented component sum.',
  ].join('; ');
  return {
    amount_cents: amount.cents,
    measure_type: 'grant_award',
    fiscal_year: raw.fiscal_year,
    source_id: FAG_ID,
    source_url: FAG_LANDING_URL,
    verified: false,
    natural_key: key,
    jurisdiction_level: 'local',
    jurisdiction: 'VIC',
    delivery_entity: raw.council_name,
    funding_source: 'Victorian Local Government Grants Commission',
    source_dataset: raw.report_dataset,
    source_date: raw.source_date,
    data_quality_flag: FAG_DATA_QUALITY_FLAG,
    aggregation_role: 'agency_detail',
    description: `VLGGC FAG ${raw.fiscal_year} ${raw.allocation_status} allocation — ${raw.council_name}`,
    statement: 'income',
    reconciliation_status: 'published_total_reconciled',
    potential_double_count: true,
    vlgc_measure: FAG_MEASURE,
    vlgc_allocation_status: raw.allocation_status,
    vlgc_council_label: raw.council_label,
    vlgc_unit: FAG_UNIT,
    vlgc_printed_sign: amount.printed_sign,
    notes: note,
  };
}

/** Pure transform: raw FAG cells -> records, de-duplicated on natural_key. */
export function transformFagRaw(raw: readonly RawRecord[]): FagTransformResult {
  const records: SpendingRecord[] = [];
  const skipped: Array<{ label: string; reason: string }> = [];
  const keys = new Set<string>();
  let duplicates = 0;
  for (const entry of raw) {
    if (entry.kind !== 'fag_total') {
      skipped.push({ label: String(entry.council_label ?? 'unknown'), reason: 'unknown raw kind' });
      continue;
    }
    try {
      const record = mapFagRaw(entry as FagRaw);
      if (keys.has(record.natural_key!)) {
        duplicates += 1;
        continue;
      }
      keys.add(record.natural_key!);
      records.push(record);
    } catch (error) {
      skipped.push({
        label: String(entry.council_label ?? 'unknown'),
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { records, skipped, duplicates };
}

export async function readFagPdfText(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  const extraction = await extractPdf(bytes, { local_path: filePath });
  return extraction.text;
}

async function archiveReport(
  report: FagReportDescriptor,
  options: FagConnectorOptions,
  sourcePath: string | undefined,
): Promise<ArchivedSourceRecord> {
  return archiveSourceDocument({
    source_id: FAG_ID,
    title: `VLGGC Annual Allocation Report ${report.fiscal_year}`,
    original_url: report.resource_url,
    retrieved_from: report.retrieval_url,
    archived_from: 'wayback',
    filename: report.filename,
    content_type: inferContentType(report.filename),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
    ...(sourcePath ? { from_path: sourcePath } : {}),
    notes:
      `Official VLGGC landing page: ${FAG_LANDING_URL}. Wayback snapshot ${report.snapshot_timestamp}. ` +
      'Copyright page is CC BY 3.0 Australia for non-logo content; the underlying VLGGC data collection is attribution/permission, NOT CC BY. ' +
      'Bytes archived outside the repo and never redistributed; only derived rows are emitted.',
  });
}

function verifyArchive(report: FagReportDescriptor, archive: ArchivedSourceRecord): void {
  if (archive.sha256 !== report.sha256) {
    throw new Error(
      `VLGGC FAG ${report.fiscal_year} report SHA-256 ${archive.sha256} does not match ${report.sha256}`,
    );
  }
  if (archive.bytes !== report.bytes) {
    throw new Error(
      `VLGGC FAG ${report.fiscal_year} report is ${archive.bytes} bytes, expected ${report.bytes}`,
    );
  }
}

export async function loadFagSources(options: FagConnectorOptions = {}): Promise<FagLoadedSource> {
  const readPdfText = options.readPdfText ?? readFagPdfText;
  const report2024 = await archiveReport(FAG_2024_25_REPORT, options, options.source2024_25Path);
  verifyArchive(FAG_2024_25_REPORT, report2024);
  const report2023 = await archiveReport(FAG_2023_24_REPORT, options, options.source2023_24Path);
  verifyArchive(FAG_2023_24_REPORT, report2023);

  const text2024 = await readPdfText(report2024.local_path);
  const text2023 = await readPdfText(report2023.local_path);
  const parsed = {
    fy2024_25: parseFag2024_25Estimate(text2024),
    fy2023_24_final: parseFag2023_24Final(text2024),
    fy2023_24_estimate: parseFag2023_24Estimate(text2023),
  };
  assertFagPremise(parsed);
  const reconciliation = reconcileFag2023_24(parsed.fy2023_24_estimate, parsed.fy2023_24_final);

  const raw = buildFagRaw(parsed);
  const transformed = transformFagRaw(raw);
  if (transformed.records.length !== 158) {
    throw new Error(`VLGGC FAG produced ${transformed.records.length} records, expected 158`);
  }
  const warnings = [
    `fy2024-25 rows=${parsed.fy2024_25.rows.length} total=${parsed.fy2024_25.published_total_dollars}`,
    `fy2023-24 final rows=${parsed.fy2023_24_final.rows.length} total=${parsed.fy2023_24_final.published_total_dollars}`,
    `fy2023-24 estimate cross-check rows=${parsed.fy2023_24_estimate.rows.length} total=${parsed.fy2023_24_estimate.published_total_dollars}`,
    `fy2023-24 final-minus-estimate checked=${reconciliation.checked} difference=${reconciliation.total_difference_dollars}`,
    `records=${transformed.records.length}; duplicate keys de-duplicated=${transformed.duplicates}; source Totals rows suppressed=3`,
  ];
  return {
    raw,
    records: transformed.records,
    archives: [report2024, report2023],
    warnings,
    parsed,
  };
}

export function fagLicense(report: Pick<FagReportDescriptor, 'copyright'>): string {
  return (
    `VLGGC attribution/permission — NOT CC BY for the underlying VLGGC data collection. Report copyright page (verbatim): "${report.copyright}"; "${FAG_REPORT_LICENCE_VERBATIM}" ` +
    `The separate VLGGC Conditions of Use are: "${FAG_VLGGC_CONDITIONS_OF_USE}" Councils provide permission for this online release; the Commission does not guarantee the material to be free from error. ` +
    'This is not the CC BY 4.0 licence used for other Victorian data. Derived rows only; the source PDFs are not redistributed.'
  );
}

export interface FagManifest {
  dataset: string;
  fiscal_year: string;
  source_url: string;
  resource_url: string;
  retrieved_from: string;
  snapshot_timestamp: string;
  report_date: string;
  license: string;
  attribution: string;
  conditions_of_use: string;
  disclaimer: string;
  copyright: string;
  caveat: string;
  unit: string;
  sha256: string;
  bytes: number;
  role: 'rows' | 'cross_check';
  council_count: number;
  totals_suppressed: number;
  rows_parsed: number;
  rows_emitted: number;
  published_total_cents: number;
  published_initial_cents?: number;
  published_difference_cents?: number;
  final_total_from_2024_25_cents?: number;
  reconciliation_status: string;
  notes: string;
}

export function fagManifest(
  report: FagReportDescriptor,
  role: 'rows' | 'cross_check',
  parsed: FagParsedYear,
  extra: { rows_emitted: number; final_total_from_2024_25?: FagParsedYear; dataset?: string },
): FagManifest {
  return {
    dataset:
      extra.dataset ??
      (role === 'rows'
        ? `VLGGC Annual Allocation Report ${report.fiscal_year} — Financial Assistance Grants`
        : `VLGGC Annual Allocation Report ${report.fiscal_year} — Financial Assistance Grants (cross-check)`),
    fiscal_year: parsed.fiscal_year,
    source_url: FAG_LANDING_URL,
    resource_url: report.resource_url,
    retrieved_from: report.retrieval_url,
    snapshot_timestamp: report.snapshot_timestamp,
    report_date: report.report_date,
    license: fagLicense(report),
    attribution: FAG_ATTRIBUTION,
    conditions_of_use: FAG_VLGGC_CONDITIONS_OF_USE,
    disclaimer: FAG_REPORT_DISCLAIMER,
    copyright: report.copyright,
    caveat: FAG_CAVEAT,
    unit: 'whole AUD (x100 cents)',
    sha256: report.sha256,
    bytes: report.bytes,
    role,
    council_count: parsed.rows.length,
    totals_suppressed: parsed.totals_suppressed,
    rows_parsed: parsed.rows.length,
    rows_emitted: extra.rows_emitted,
    published_total_cents: parsed.published_total_dollars * 100,
    ...(parsed.published_initial_dollars !== undefined
      ? { published_initial_cents: parsed.published_initial_dollars * 100 }
      : {}),
    ...(parsed.published_difference_dollars !== undefined
      ? { published_difference_cents: parsed.published_difference_dollars * 100 }
      : {}),
    ...(extra.final_total_from_2024_25
      ? {
          final_total_from_2024_25_cents:
            extra.final_total_from_2024_25.published_total_dollars * 100,
        }
      : {}),
    reconciliation_status:
      role === 'rows'
        ? '79 council rows sum exactly to the printed Totals row; no cross-council total published'
        : '79 estimated rows parsed only for the final-minus-estimate cross-check; no rows emitted from this report',
    notes:
      'Derived rows only; source PDFs are not redistributed. One printed Total Financial Assistance Grant per council; no component sum, no project/LGA allocation and no cross-council total. FAG overlaps council grant revenue, so every row is potential_double_count=true and is never added to VGC1/ABS spending or other grants.',
  };
}

export function createFagConnector(options: FagConnectorOptions = {}): Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };
  return {
    id: FAG_ID,
    name: FAG_NAME,
    publisher: FAG_PUBLISHER,
    source_url: FAG_LANDING_URL,
    status: 'active',
    jurisdiction_level: 'local',
    license: FAG_LICENSE,
    notes: `${FAG_CAVEAT} ${FAG_ATTRIBUTION}. Report copyright page: "${FAG_REPORT_LICENCE_VERBATIM}" The underlying VLGGC data collection Conditions of Use: "${FAG_VLGGC_CONDITIONS_OF_USE}" Attribution/permission, NOT CC BY for the data collection; derived rows only and PDFs are not redistributed. Whole AUD converted explicitly to cents at x${FAG_UNIT_TO_CENTS}.`,
    async fetch(): Promise<RawRecord[]> {
      metadata.errors = [];
      const loaded = await loadFagSources(options);
      metadata.warnings = loaded.warnings;
      return loaded.raw;
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const result = transformFagRaw(raw);
      if (result.skipped.length > 0) {
        metadata.warnings = [
          ...(metadata.warnings ?? []),
          `${result.skipped.length} FAG row(s) skipped`,
        ];
      }
      return result.records;
    },
    metadata,
  };
}
