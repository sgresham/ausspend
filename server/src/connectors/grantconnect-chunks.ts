/**
 * GrantConnect manual-export chunk helpers.
 *
 * The public GrantConnect DownloadResult export is capped: a wide date range
 * returns a workbook whose criteria block says "Your search returned more than
 * 50000 results. Please narrow the date range and run multiple searches to
 * return all records." A wide export is therefore NOT a complete period and
 * must never be imported as one. This module holds the date/chunk/coverage
 * arithmetic and the cap-warning detector; it performs no I/O and no network
 * call, so it is safe to unit test and to reuse from the connector and the
 * `scripts/grantconnect-chunks.ts` helper.
 */

export const GRANTCONNECT_LIST_URL =
  'https://www.grants.gov.au/Ga/ListResult?Type=Ga&AgencyStatus=-1&KeywordTypeSearch=AllWord&DateType=Publish%20Date';

export const GRANTCONNECT_DOWNLOAD_RESULT_URL = 'https://www.grants.gov.au/Ga/DownloadResult';

/** Text GrantConnect prints above the table when the result set is capped. */
export const GRANTCONNECT_CAP_WARNING_PATTERN =
  /more than\s*50[,.]?000 results|narrow the date range and run multiple searches/i;

export const GRANTCONNECT_DEFAULT_TARGET_FY = '2025-26';
export const GRANTCONNECT_DEFAULT_CHUNK_DAYS = 31;

const MONTHS: Readonly<Record<string, number>> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** A calendar day in UTC, represented as an ISO `YYYY-MM-DD` string. */
export type IsoDay = string;

export interface DayRange {
  start: IsoDay;
  end: IsoDay;
}

export interface GrantConnectChunk extends DayRange {
  index: number;
  total: number;
}

export interface CoverageReport {
  target: DayRange;
  /** Accepted, non-capped chunks that actually cover target days. */
  covered: DayRange[];
  /** Target sub-ranges not covered by any accepted chunk. */
  missing: DayRange[];
  complete: boolean;
  covered_days: number;
  target_days: number;
}

export interface CapWarningCheck {
  cap_warning: boolean;
  text: string | null;
}

export function isCapWarning(value: string): boolean {
  return GRANTCONNECT_CAP_WARNING_PATTERN.test(value);
}

/**
 * Search the criteria rows (everything above the real header) for the cap
 * warning. Returns the offending text so a rejection can be logged verbatim.
 */
export function detectCapWarning(rows: ReadonlyArray<ReadonlyArray<unknown>>): CapWarningCheck {
  for (const row of rows) {
    for (const cell of row) {
      const text = typeof cell === 'string' ? cell : cell == null ? '' : String(cell);
      if (text && isCapWarning(text)) return { cap_warning: true, text };
    }
  }
  return { cap_warning: false, text: null };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function isoDay(year: number, monthIndex: number, day: number): IsoDay {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/**
 * Parse the date tokens GrantConnect prints in its criteria summary:
 * `1-Jul-2025`, `01 July 2025`, `2025-07-01`, `1/7/2025` or `1/07/2025`.
 * Returns null rather than guessing when the token is not a date.
 */
export function parseLooseDate(raw: string): IsoDay | null {
  const text = raw.trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return isoDay(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const dmyDash = /^(\d{1,2})-([A-Za-z]{3,4})-(\d{4})$/.exec(text);
  if (dmyDash) {
    const month = MONTHS[dmyDash[2]!.toLowerCase()];
    if (month === undefined) return null;
    return isoDay(Number(dmyDash[3]), month, Number(dmyDash[1]));
  }

  const dmySpace = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/.exec(text);
  if (dmySpace) {
    const month = MONTHS[dmySpace[2]!.toLowerCase().slice(0, 3)];
    if (month === undefined) return null;
    return isoDay(Number(dmySpace[3]), month, Number(dmySpace[1]));
  }

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (slash) return isoDay(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]));

  return null;
}

/**
 * Parse a GrantConnect Date Range line such as `1-Jul-2025 to 30-Jun-2026`.
 * Returns null for `All` or anything without two parseable endpoints.
 */
export function parseDateRange(raw: string | null | undefined): DayRange | null {
  if (!raw) return null;
  const match = /^(.*?)\s+to\s+(.*?)$/i.exec(raw.trim());
  if (!match) return null;
  const start = parseLooseDate(match[1]!);
  const end = parseLooseDate(match[2]!);
  if (!start || !end || start > end) return null;
  return { start, end };
}

export function dayNumber(day: IsoDay): number {
  return Math.floor(Date.parse(`${day}T00:00:00.000Z`) / 86_400_000);
}

export function dayFromNumber(value: number): IsoDay {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(day: IsoDay, days: number): IsoDay {
  return dayFromNumber(dayNumber(day) + days);
}

/** Inclusive number of days in a range. */
export function rangeDays(range: DayRange): number {
  return dayNumber(range.end) - dayNumber(range.start) + 1;
}

/** Australian financial-year label (`2025-26`) for a calendar day. */
export function australianFiscalYearOf(day: IsoDay): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${pad2((startYear + 1) % 100)}`;
}

/** The 1 July – 30 June window for an Australian financial-year label. */
export function fiscalYearRange(fiscalYear: string): DayRange {
  const match = /^(\d{4})-(\d{2})$/.exec(fiscalYear.trim());
  if (!match) throw new Error(`invalid Australian financial year ${JSON.stringify(fiscalYear)}`);
  const startYear = Number(match[1]);
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

/**
 * Split a window into inclusive day chunks. The final chunk is clamped to the
 * end day, so a range is fully covered with no overlap and no gap.
 */
export function planChunks(range: DayRange, chunkDays: number): GrantConnectChunk[] {
  if (!Number.isInteger(chunkDays) || chunkDays < 1) {
    throw new Error(`chunkDays must be a positive integer (got ${chunkDays})`);
  }
  if (range.start > range.end) throw new Error(`range start ${range.start} is after ${range.end}`);
  const startNumber = dayNumber(range.start);
  const endNumber = dayNumber(range.end);
  const total = Math.ceil((endNumber - startNumber + 1) / chunkDays);
  const chunks: GrantConnectChunk[] = [];
  for (let index = 1; index <= total; index += 1) {
    const chunkStart = startNumber + (index - 1) * chunkDays;
    const chunkEnd = Math.min(endNumber, chunkStart + chunkDays - 1);
    chunks.push({
      index,
      total,
      start: dayFromNumber(chunkStart),
      end: dayFromNumber(chunkEnd),
    });
  }
  return chunks;
}

/** Merge overlapping/adjacent day ranges into the minimal set of intervals. */
export function mergeRanges(ranges: ReadonlyArray<DayRange>): DayRange[] {
  const sorted = ranges
    .filter((range) => range.start <= range.end)
    .map((range) => ({ start: range.start, end: range.end }))
    .sort((a, b) =>
      a.start === b.start ? a.end.localeCompare(b.end) : a.start.localeCompare(b.start),
    );
  const merged: DayRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && dayNumber(range.start) <= dayNumber(last.end) + 1) {
      if (range.end > last.end) last.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/** Subtract `covered` from `target`, returning the uncovered sub-ranges. */
export function subtractRanges(target: DayRange, covered: ReadonlyArray<DayRange>): DayRange[] {
  const merged = mergeRanges(
    covered.filter((range) => range.end >= target.start && range.start <= target.end),
  );
  const missing: DayRange[] = [];
  let cursor = dayNumber(target.start);
  const endNumber = dayNumber(target.end);
  for (const range of merged) {
    const rangeStart = Math.max(dayNumber(range.start), dayNumber(target.start));
    if (rangeStart > cursor) {
      missing.push({ start: dayFromNumber(cursor), end: dayFromNumber(rangeStart - 1) });
    }
    cursor = Math.max(cursor, dayNumber(range.end) + 1);
    if (cursor > endNumber) break;
  }
  if (cursor <= endNumber) {
    missing.push({ start: dayFromNumber(cursor), end: target.end });
  }
  return missing;
}

/** Coverage of `target` by the accepted chunk ranges. */
export function coverageOf(target: DayRange, accepted: ReadonlyArray<DayRange>): CoverageReport {
  const covered = mergeRanges(
    accepted.filter((range) => range.end >= target.start && range.start <= target.end),
  );
  const missing = subtractRanges(target, covered);
  return {
    target,
    covered,
    missing,
    complete: missing.length === 0,
    covered_days: rangeDays(target) - missing.reduce((sum, range) => sum + rangeDays(range), 0),
    target_days: rangeDays(target),
  };
}

const MONTH_TOKENS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function formatDateToken(day: IsoDay): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  const dayNumberValue = date.getUTCDate();
  // GrantConnect expects three-letter month tokens. Never use ICU's en-AU
  // short name here: Node renders September as "Sept", which the public
  // DownloadResult endpoint rejects with HTTP 500.
  const month = MONTH_TOKENS[date.getUTCMonth()]!;
  return `${dayNumberValue}-${month}-${date.getUTCFullYear()}`;
}

/**
 * Public, unauthenticated DownloadResult URL for one chunk. The query mirrors
 * the public list page filters; an override template can be supplied for a
 * future GrantConnect change without editing code:
 *
 *   GRANTCONNECT_DOWNLOAD_URL_TEMPLATE=https://.../DownloadResult?DateStart={start}&DateEnd={end}
 */
export function buildDownloadResultUrl(range: DayRange, template?: string): string {
  const base = template ?? process.env.GRANTCONNECT_DOWNLOAD_URL_TEMPLATE ?? '';
  const startToken = encodeURIComponent(formatDateToken(range.start));
  const endToken = encodeURIComponent(formatDateToken(range.end));
  if (base) {
    return base.replaceAll('{start}', startToken).replaceAll('{end}', endToken);
  }
  return (
    `${GRANTCONNECT_DOWNLOAD_RESULT_URL}?Type=Ga&AgencyStatus=-1` +
    `&KeywordTypeSearch=AllWord&DateType=Publish%20Date` +
    `&DateStart=${startToken}&DateEnd=${endToken}`
  );
}

/** Parse `--start=YYYY-MM-DD` / `--end=YYYY-MM-DD` / `--fy=2025-26` style args. */
export function resolveRequestedRange(options: {
  start?: string;
  end?: string;
  fiscalYear?: string;
}): DayRange {
  if (options.start || options.end) {
    if (!options.start || !options.end) {
      throw new Error('both start and end are required when either is supplied');
    }
    const start = parseLooseDate(options.start);
    const end = parseLooseDate(options.end);
    if (!start || !end) throw new Error(`invalid start/end date (${options.start}/${options.end})`);
    if (start > end) throw new Error(`start ${start} is after end ${end}`);
    return { start, end };
  }
  return fiscalYearRange(options.fiscalYear ?? GRANTCONNECT_DEFAULT_TARGET_FY);
}

export function formatRange(range: DayRange): string {
  return `${range.start}..${range.end}`;
}

export function formatCoverage(coverage: CoverageReport): string {
  if (coverage.complete) {
    return `complete ${formatRange(coverage.target)} (${coverage.target_days}/${coverage.target_days} days)`;
  }
  const missing = coverage.missing.map(formatRange).join(', ');
  return (
    `partial ${coverage.covered_days}/${coverage.target_days} days of ${formatRange(coverage.target)}; ` +
    `missing ${missing}`
  );
}
