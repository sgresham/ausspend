/**
 * Split a historical AusTender `contractPublished` window into contiguous,
 * non-overlapping chunks.
 *
 * The OCDS feed is paged with a `links.next` cursor and the connector has a
 * bounded page limit. A multi-year window cannot be requested in one run (the
 * 25-page default would truncate it), so the backfill asks for one chunk at a
 * time and raises the page limit for that chunk. Weekly chunks keep even the
 * busiest June week (~2,200 releases, ~22 pages at 100 releases/page) well
 * inside a 100-page bound.
 *
 * Boundaries are half-open `[start, end)` ISO-8601 instants. The function is
 * pure and exported so the chunk plan is pinned by a fixture test: no gaps, no
 * overlaps, and the final chunk ends exactly at the requested end instant.
 */
export interface AusTenderWindowChunk {
  /** 1-based position in the plan. */
  index: number;
  /** Total number of chunks in the plan. */
  total: number;
  startDate: string;
  endDate: string;
}

/** Weekly chunks keep the busiest June week (~22 pages) inside the bound. */
export const AUS_TENDER_BACKFILL_CHUNK_DAYS = 7;
/**
 * Pages per chunk: ~100 releases/page × 100 pages ≈ 10,000 releases/week, more
 * than four times the busiest observed week (2,195 releases). The 25-page
 * default would truncate a peak week, so the backfill always raises it.
 */
export const AUS_TENDER_BACKFILL_PAGE_LIMIT = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseInstant(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is not a valid ISO-8601 instant: ${value}`);
  }
  return date;
}

function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Build the chunk plan for a window. `chunkDays` defaults to 7 (weekly) and must
 * be a positive integer no greater than 31.
 */
export function chunkAusTenderWindow(
  startDate: string,
  endDate: string,
  chunkDays = AUS_TENDER_BACKFILL_CHUNK_DAYS,
): AusTenderWindowChunk[] {
  if (!Number.isInteger(chunkDays) || chunkDays < 1 || chunkDays > 31) {
    throw new Error('chunkDays must be an integer between 1 and 31');
  }
  const start = parseInstant(startDate, 'AUSTENDER_START_DATE');
  const end = parseInstant(endDate, 'AUSTENDER_END_DATE');
  if (end.getTime() <= start.getTime()) {
    throw new Error('AUSTENDER_END_DATE must be after AUSTENDER_START_DATE');
  }

  const boundaries: { startDate: string; endDate: string }[] = [];
  const stepMs = chunkDays * DAY_MS;
  for (let cursor = start.getTime(); cursor < end.getTime(); cursor += stepMs) {
    const next = Math.min(cursor + stepMs, end.getTime());
    boundaries.push({
      startDate: isoSeconds(new Date(cursor)),
      endDate: isoSeconds(new Date(next)),
    });
  }

  return boundaries.map((chunk, position) => ({
    index: position + 1,
    total: boundaries.length,
    ...chunk,
  }));
}
