import { describe, expect, it } from 'vitest';
import { MeasureRecordSchema, SpendingRecordSchema } from '../src/index';

const contractRecord = {
  amount_cents: 12_345_600,
  measure_type: 'contract' as const,
  fiscal_year: '2024-25',
  source_id: 'aus-tender',
  source_url: 'https://www.tenders.gov.au/Contract/Details/12345',
  verified: false,
  natural_key: 'aus-tender:12345',
  project_name: 'Example contract',
  jurisdiction_level: 'federal' as const,
  jurisdiction: 'Australia',
  delivery_entity: 'Department of Example',
  funding_source: 'Consolidated Revenue Fund',
  source_dataset: 'AusTender contract notices',
  source_date: '2024-08-01',
  data_quality_flag: 'source-reported',
  unspsc: '80101500',
  location: { state: 'NSW' },
};

describe('SpendingRecordSchema', () => {
  it('accepts a contract-shaped record with no region or COFOG function', () => {
    expect(MeasureRecordSchema.parse(contractRecord)).toEqual(contractRecord);
    expect(SpendingRecordSchema.parse(contractRecord)).toEqual(contractRecord);
  });

  it('requires a natural_key for ingested records', () => {
    const withoutKey: Record<string, unknown> = { ...contractRecord };
    delete withoutKey.natural_key;
    expect(MeasureRecordSchema.safeParse(withoutKey).success).toBe(false);
  });

  it('accepts contract and grant_award measure types', () => {
    expect(
      MeasureRecordSchema.safeParse({ ...contractRecord, measure_type: 'grant_award' }).success,
    ).toBe(true);
    expect(
      MeasureRecordSchema.safeParse({ ...contractRecord, measure_type: 'grant' }).success,
    ).toBe(false);
  });
});
