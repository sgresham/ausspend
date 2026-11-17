import { describe, expect, it } from 'vitest';
import { SpendingQuerySchema, SpendingSummarySchema } from '../src/index';

describe('SpendingQuery', () => {
  it('applies pagination and sort defaults', () => {
    expect(SpendingQuerySchema.parse({})).toEqual({
      page: 1,
      page_size: 20,
      sort: 'amount_desc',
    });
  });

  it('coerces numeric query strings and accepts every filter', () => {
    const parsed = SpendingQuerySchema.parse({
      fiscal_year: '2024-25',
      measure_type: 'actual',
      function: '074',
      region: '6afaa24c06cd1221b0f07291',
      min_amount: '100',
      max_amount: '200',
      page: '2',
      page_size: '50',
      sort: 'fiscal_year_asc',
    });

    expect(parsed).toMatchObject({
      fiscal_year: '2024-25',
      measure_type: 'actual',
      function: '074',
      region: '6afaa24c06cd1221b0f07291',
      min_amount: 100,
      max_amount: 200,
      page: 2,
      page_size: 50,
      sort: 'fiscal_year_asc',
    });
  });

  it('accepts a region slug/name and an explicit area slug (contract C)', () => {
    expect(SpendingQuerySchema.parse({ region: 'Dubbo' }).region).toBe('Dubbo');
    expect(SpendingQuerySchema.parse({ region: 'dubbo' }).region).toBe('dubbo');
    expect(SpendingQuerySchema.parse({ area: 'dubbo' }).area).toBe('dubbo');
  });

  it('trims and bounds the project/item text filter q, treating empty as no filter', () => {
    expect(SpendingQuerySchema.parse({ q: '  New Dubbo Bridge  ' }).q).toBe('New Dubbo Bridge');
    expect(SpendingQuerySchema.parse({ q: '' }).q).toBe('');
    expect(SpendingQuerySchema.safeParse({ q: 'a'.repeat(100) }).success).toBe(true);
    expect(SpendingQuerySchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false);
  });

  it('rejects bad codes, amounts, pages and sorts', () => {
    const bad = [
      { fiscal_year: '2024' },
      { measure_type: 'forecast' },
      { function: '7' },
      { function: '0111' },
      { min_amount: '-1' },
      { max_amount: '10.5' },
      { page: '0' },
      { page_size: '0' },
      { page_size: '101' },
      { sort: 'name' },
      { min_amount: '200', max_amount: '100' },
    ];
    for (const query of bad) {
      expect(SpendingQuerySchema.safeParse(query).success, JSON.stringify(query)).toBe(false);
    }
  });
});

describe('SpendingSummary', () => {
  it('accepts a mixed summary with null total and per-type totals', () => {
    const summary = {
      count: 2,
      currency: 'AUD',
      total_cents: null,
      total_measure_type: null,
      total_by_measure_type: [
        { measure_type: 'actual', count: 1, total_cents: 10 },
        { measure_type: 'budget', count: 1, total_cents: 20 },
      ],
      measure_types: ['actual', 'budget'],
      mixed: true,
      breakdown_by_function: [],
      breakdown_by_region: [],
    };
    expect(SpendingSummarySchema.parse(summary)).toEqual(summary);
  });
});
