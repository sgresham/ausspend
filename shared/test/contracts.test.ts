import { describe, expect, it } from 'vitest';
import {
  COFOG_DIVISIONS,
  COFOGDivisionSchema,
  MEASURE_TYPES,
  MeasureTypeSchema,
  MoneyCentsSchema,
  SourceRefSchema,
  SubdivisionSchema,
} from '../src/index';

describe('MoneyCents', () => {
  it('accepts non-negative integer cents', () => {
    expect(MoneyCentsSchema.parse(0)).toBe(0);
    expect(MoneyCentsSchema.parse(123_456)).toBe(123_456);
  });

  it('rejects negative and fractional cents', () => {
    expect(MoneyCentsSchema.safeParse(-1).success).toBe(false);
    expect(MoneyCentsSchema.safeParse(10.5).success).toBe(false);
  });
});

describe('MeasureType', () => {
  it('exposes budget measures and federal record measures', () => {
    expect(MEASURE_TYPES).toEqual(['actual', 'budget', 'estimate', 'contract', 'grant_award']);
    for (const measure of MEASURE_TYPES) {
      expect(MeasureTypeSchema.parse(measure)).toBe(measure);
    }
    expect(MeasureTypeSchema.safeParse('forecast').success).toBe(false);
  });
});

describe('SourceRef', () => {
  it('requires a source id, a URL and a verified flag', () => {
    const ref = {
      source_id: 'aofm-2024',
      source_url: 'https://www.aofm.gov.au/',
      verified: true,
    };
    expect(SourceRefSchema.parse(ref)).toEqual(ref);
    expect(SourceRefSchema.safeParse({ ...ref, source_url: 'not-a-url' }).success).toBe(false);
    expect(SourceRefSchema.safeParse({ ...ref, verified: 'yes' }).success).toBe(false);
  });
});

describe('COFOG', () => {
  it('defines exactly ten divisions with two-digit codes', () => {
    expect(COFOG_DIVISIONS).toHaveLength(10);
    expect(COFOG_DIVISIONS.map((division) => division.code)).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
    ]);
    for (const division of COFOG_DIVISIONS) {
      expect(COFOGDivisionSchema.parse(division)).toEqual(division);
    }
  });
});

describe('Subdivision', () => {
  it('has a code, name and region id', () => {
    expect(
      SubdivisionSchema.parse({ code: 'NSW', name: 'New South Wales', regionId: 'nsw' }),
    ).toEqual({ code: 'NSW', name: 'New South Wales', regionId: 'nsw' });
    expect(SubdivisionSchema.safeParse({ code: '', name: 'Nowhere', regionId: 'x' }).success).toBe(
      false,
    );
  });
});
