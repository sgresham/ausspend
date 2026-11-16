import { describe, expect, it } from 'vitest';
import {
  AUS_TENDER_BACKFILL_CHUNK_DAYS,
  AUS_TENDER_BACKFILL_PAGE_LIMIT,
  chunkAusTenderWindow,
} from '../src/connectors/index.js';

const TWO_FY_START = '2024-07-01T00:00:00Z';
const TWO_FY_END = '2026-07-01T00:00:00Z';

describe('AusTender backfill chunking fixture', () => {
  it('splits the last two financial years into contiguous weekly chunks', () => {
    const chunks = chunkAusTenderWindow(TWO_FY_START, TWO_FY_END);

    // 2024-07-01 .. 2026-07-01 is 730 days; 730 / 7 = 104.28 -> 105 weeks.
    expect(chunks).toHaveLength(105);
    expect(chunks[0]).toMatchObject({
      index: 1,
      total: 105,
      startDate: '2024-07-01T00:00:00Z',
      endDate: '2024-07-08T00:00:00Z',
    });
    expect(chunks.at(-1)).toMatchObject({
      index: 105,
      total: 105,
      // 104 full weeks from 2024-07-01 land on 2026-06-29; the final chunk is
      // the two remaining days up to 2026-07-01.
      startDate: '2026-06-29T00:00:00Z',
      endDate: '2026-07-01T00:00:00Z',
    });
  });

  it('has no gaps and no overlaps, and ends exactly at the requested end', () => {
    const chunks = chunkAusTenderWindow(TWO_FY_START, TWO_FY_END);
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]!;
      expect(new Date(chunk.endDate).getTime()).toBeGreaterThan(
        new Date(chunk.startDate).getTime(),
      );
      if (i > 0) {
        expect(chunk.startDate).toBe(chunks[i - 1]!.endDate);
      }
    }
    expect(chunks[0]!.startDate).toBe(TWO_FY_START);
    expect(chunks.at(-1)!.endDate).toBe(TWO_FY_END);
  });

  it('crosses the 30 June financial-year boundary in one final weekly step', () => {
    const chunks = chunkAusTenderWindow('2025-06-16T00:00:00Z', '2025-07-14T00:00:00Z');
    const boundary = chunks.find((chunk) => chunk.startDate === '2025-06-30T00:00:00Z');
    expect(boundary).toMatchObject({
      startDate: '2025-06-30T00:00:00Z',
      endDate: '2025-07-07T00:00:00Z',
    });
  });

  it('supports monthly chunks when explicitly requested', () => {
    const chunks = chunkAusTenderWindow('2024-07-01T00:00:00Z', '2024-10-01T00:00:00Z', 31);
    expect(chunks.map((chunk) => `${chunk.startDate}..${chunk.endDate}`)).toEqual([
      '2024-07-01T00:00:00Z..2024-08-01T00:00:00Z',
      '2024-08-01T00:00:00Z..2024-09-01T00:00:00Z',
      '2024-09-01T00:00:00Z..2024-10-01T00:00:00Z',
    ]);
  });

  it('rejects an inverted or invalid window and an out-of-range chunk size', () => {
    expect(() => chunkAusTenderWindow(TWO_FY_END, TWO_FY_START)).toThrow(/must be after/);
    expect(() => chunkAusTenderWindow('not-a-date', TWO_FY_END)).toThrow(/valid ISO-8601/);
    expect(() => chunkAusTenderWindow(TWO_FY_START, TWO_FY_END, 0)).toThrow(/between 1 and 31/);
    expect(() => chunkAusTenderWindow(TWO_FY_START, TWO_FY_END, 32)).toThrow(/between 1 and 31/);
  });

  it('documents a page bound with headroom over a peak week', () => {
    // The busiest week observed while planning the backfill (late June 2025)
    // returned 2,195 releases, i.e. ~22 pages at ~100 releases/page.
    const observedPeakReleases = 2_195;
    const releasesPerPage = 100;
    const boundReleases = AUS_TENDER_BACKFILL_PAGE_LIMIT * releasesPerPage;
    expect(AUS_TENDER_BACKFILL_CHUNK_DAYS).toBe(7);
    expect(boundReleases).toBeGreaterThanOrEqual(observedPeakReleases * 4);
  });
});
