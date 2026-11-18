import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MODULAR_CONNECTOR_IDS } from '../src/connectors/generated-connectors.js';
import { GPFS_FIXTURES } from './generated-gpfs-fixtures.js';

interface GoldenFixture {
  ROW_COUNT: number;
  GOLDEN_DIGEST: string;
  goldenRecords: () => Array<{ natural_key?: string; amount_cents: number }>;
}

function digest(records: Array<{ natural_key?: string; amount_cents: number }>): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        records.map((record) => ({
          natural_key: record.natural_key,
          amount_cents: record.amount_cents,
        })),
      ),
    )
    .digest('hex');
}

describe('GPFS module migration golden proofs', () => {
  it("matches each GPFS module's row count and key/amount digest", () => {
    const gpfsModuleIds = MODULAR_CONNECTOR_IDS.filter((id) => id.endsWith('-gpfs'));
    const legacy = GPFS_FIXTURES.filter((entry) => entry.id !== 'blacktown-gpfs');
    expect(legacy).toHaveLength(gpfsModuleIds.length - 1);
    for (const entry of legacy) {
      const fixture = entry.fixture as unknown as GoldenFixture;
      expect(typeof fixture.goldenRecords, entry.id).toBe('function');
      const records = fixture.goldenRecords();
      expect(records.length, entry.id).toBe(fixture.ROW_COUNT);
      expect(digest(records), entry.id).toBe(fixture.GOLDEN_DIGEST);
    }
  });
});
