import { describe, expect, it } from 'vitest';
import {
  AUSTRALIAN_REGIONS,
  COFOG_DIVISIONS,
  COFOGSubdivisionSchema,
  COFOG_SUBDIVISIONS,
  SYNTHETIC_SOURCE,
  SYNTHETIC_SOURCE_URL_PATH,
} from '../src/index';

describe('COFOG subdivisions', () => {
  it('is a curated, non-empty set nested under the ten divisions', () => {
    expect(COFOG_SUBDIVISIONS.length).toBeGreaterThanOrEqual(20);

    const divisionCodes = new Set(COFOG_DIVISIONS.map((division) => division.code));
    const subdivisionCodes = new Set<string>();

    for (const subdivision of COFOG_SUBDIVISIONS) {
      expect(COFOGSubdivisionSchema.parse(subdivision)).toEqual(subdivision);
      expect(subdivision.code.slice(0, 2)).toBe(subdivision.parent_code);
      expect(divisionCodes.has(subdivision.parent_code)).toBe(true);
      expect(subdivisionCodes.has(subdivision.code)).toBe(false);
      subdivisionCodes.add(subdivision.code);
    }
  });

  it('covers every division with at least one subdivision', () => {
    for (const division of COFOG_DIVISIONS) {
      expect(
        COFOG_SUBDIVISIONS.some((subdivision) => subdivision.parent_code === division.code),
      ).toBe(true);
    }
  });
});

describe('Australian regions', () => {
  it('has a national row and the eight states/territories', () => {
    expect(AUSTRALIAN_REGIONS).toHaveLength(9);
    expect(AUSTRALIAN_REGIONS.filter((region) => region.level === 'national')).toHaveLength(1);
    expect(AUSTRALIAN_REGIONS.filter((region) => region.level === 'state')).toHaveLength(8);
    expect(AUSTRALIAN_REGIONS.map((region) => region.code)).toEqual([
      'AUS',
      'NSW',
      'VIC',
      'QLD',
      'WA',
      'SA',
      'TAS',
      'ACT',
      'NT',
    ]);
  });
});

describe('synthetic source', () => {
  it('is verified false and anchored at /data-sources#synthetic-seed', () => {
    expect(SYNTHETIC_SOURCE.source_id).toBe('synthetic-seed');
    expect(SYNTHETIC_SOURCE.source_url).toBe(SYNTHETIC_SOURCE_URL_PATH);
    expect(SYNTHETIC_SOURCE.source_url).toBe('/data-sources#synthetic-seed');
    expect(SYNTHETIC_SOURCE.verified).toBe(false);
  });
});
