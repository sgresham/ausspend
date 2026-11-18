import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpendingRecord } from '@ausspend/shared';
import {
  NT_LG_PILOT_ID,
  NT_LG_PILOT_DOCUMENTS,
  createNtLgPilotConnector,
  ntLgPilotNaturalKey,
  parseNtLgPilotExtraction,
  type NtLgPilotContext,
} from '../src/connectors/nt-lg-pilot.js';
import type { PdfExtraction } from '../src/connectors/pdf-extract.js';

const DARWIN_TEXT = [
  'Statement of Comprehensive Income',
  "$ '000 Notes 2026 2025",
  'Income',
  'Rates revenue 2a 90,894 88,517',
  'Statutory charges 2b 4,821 4,069',
  'User charges 2c 35,430 31,104',
  'Grants, subsidies and contributions - operating 2g 9,125 10,014',
  'Investment and interest income 2d 6,194 6,329',
  'Reimbursements 2e 629 366',
  'Other income 2f 1,588 1,025',
  'Total income 148,681 141,424',
  'Expenses',
  'Employee costs 3a 41,138 38,996',
  'Materials, contracts and other expenses 3b 78,541 63,199',
  'Depreciation and amortisation 3c 38,239 34,167',
  'Finance costs 3d 3,724 3,663',
  'Total expenses 161,642 140,025',
].join(' ');

const PALMERSTON_TEXT = [
  'Statement of Comprehensive Income',
  "$ '000 2026 2025",
  'Income',
  'Rates and waste charges 3a 37,790 35,747',
  'Statutory charges 3b 603 109',
  'User charges 3c 865 855',
  'Grants, subsidies and contributions - operating 3f 4,681 4,881',
  'Investment and interest income 3d 2,082 1,947',
  'Other income 3e 592 382',
  'Total income 46,613 43,921',
  'Expenses',
  'Employee costs 4a 13,523 11,872',
  'Materials, contracts and other expenses 4b 28,012 26,035',
  'Depreciation, amortisation and impairment 4c 14,258 13,312',
  'Finance costs 4d 234 283',
  'Total expenses 56,027 51,502',
].join(' ');

const ALICE_TEXT = [
  'Statement of Comprehensive Income',
  "$ '000 Notes 2026 2025",
  'Income',
  'Rates revenue 3a 35,387 33,552',
  'Statutory charges 3b 194 147',
  'User charges 3c 6,679 5,327',
  'Grants, subsidies and contributions - operating 3f 4,151 4,534',
  'Investment and interest income 3d 3,121 3,130',
  'Other income 3e 2,000 1,605',
  'Total income 51,532 48,295',
  'Expenses',
  'Employee costs 4a 22,775 22,291',
  'Materials, contracts and other expenses 4b 20,058 20,045',
  'Depreciation and amortisation 4c 12,792 13,153',
  'Finance costs 4d 676 721',
  'Total expenses 56,301 56,210',
].join(' ');

function extraction(text: string): PdfExtraction {
  return {
    source: { sha256: 'a'.repeat(64), bytes: 1 },
    pages: [{ page_number: 51, text, items: [] }],
    text: '',
    tables: [],
    warnings: [],
  };
}

function context(document = NT_LG_PILOT_DOCUMENTS[0]!): NtLgPilotContext {
  return {
    document,
    sourceDate: '2026-11-18',
    archive: {
      local_path: '/tmp/archive.pdf',
      sha256: document.expectedSha256,
      bytes: document.expectedBytes,
    },
  };
}

describe('NT LG pilot GPFS parsing', () => {
  it('reconciles all three council income/expense components exactly', () => {
    const darwin = parseNtLgPilotExtraction(extraction(DARWIN_TEXT), context());
    const palmerston = parseNtLgPilotExtraction(
      extraction(PALMERSTON_TEXT),
      context(NT_LG_PILOT_DOCUMENTS[1]),
    );
    const alice = parseNtLgPilotExtraction(
      extraction(ALICE_TEXT),
      context(NT_LG_PILOT_DOCUMENTS[2]),
    );
    expect(darwin.reconciliation.total_income).toBe(148_681);
    expect(darwin.reconciliation.total_expenses).toBe(161_642);
    expect(darwin.reconciliation.income_components_sum).toBe(148_681);
    expect(darwin.reconciliation.expense_components_sum).toBe(161_642);
    expect(palmerston.reconciliation.total_income).toBe(46_613);
    expect(palmerston.reconciliation.total_expenses).toBe(56_027);
    expect(alice.reconciliation.total_income).toBe(51_532);
    expect(alice.reconciliation.total_expenses).toBe(56_301);
    expect(
      new Set(
        [...darwin.records, ...palmerston.records, ...alice.records].map((r) => r.delivery_entity),
      ).size,
    ).toBe(3);
  });

  it('maps local/NT/lga provenance, whole $’000 cents and human_spot_check', () => {
    const { records } = parseNtLgPilotExtraction(extraction(DARWIN_TEXT), context());
    const totalIncome = records.find((record) => record.category === 'total_income')!;
    expect(totalIncome.amount_cents).toBe(14_868_100_000);
    expect(totalIncome.jurisdiction_level).toBe('local');
    expect(totalIncome.jurisdiction).toBe('NT');
    expect(totalIncome.delivery_entity).toBe('City of Darwin');
    expect(totalIncome.location).toMatchObject({ state: 'NT', lga_name: 'City of Darwin' });
    expect(totalIncome.data_quality_flag).toBe('provisional');
    expect(totalIncome.reconciliation_status).toBe('printed_totals_reconciled');
    expect(totalIncome.notes).toContain('human_spot_check: required');
    expect(totalIncome.notes).toContain('$');
  });

  it('rejects a missing printed unit or a non-reconciling total', () => {
    expect(() =>
      parseNtLgPilotExtraction(extraction(DARWIN_TEXT.replace("$ '000", '')), context()),
    ).toThrow(/explicit \$'000/);
    expect(() =>
      parseNtLgPilotExtraction(
        extraction(DARWIN_TEXT.replace('Total expenses 161,642', 'Total expenses 161,643')),
        context(),
      ),
    ).toThrow(/expense components/);
  });

  it('derives stable natural keys per council, year and measure', () => {
    const key = ntLgPilotNaturalKey('City of Darwin', '2025-26', 'total_income');
    expect(key).toMatch(/^nt-lg-pilot:[a-f0-9]{40}$/);
    expect(key).toBe(ntLgPilotNaturalKey('City of Darwin', '2025-26', 'total_income'));
    expect(key).not.toBe(ntLgPilotNaturalKey('City of Palmerston', '2025-26', 'total_income'));
  });
});

const TEST_DB_URL =
  process.env.TEST_MONGO_URL ?? `mongodb://localhost:27017/ausspend_test_${process.pid}_ntlg`;

function budgetGuard(): SpendingRecord {
  return {
    amount_cents: 1_000,
    measure_type: 'actual',
    fiscal_year: '2025-26',
    source_id: 'nt-budget',
    source_url: 'https://example.test/nt-budget',
    verified: true,
    natural_key: 'nt-budget:guard',
    project_name: 'NT Budget guard row',
  };
}

describe('NT LG pilot ingestion is idempotent and isolated', { timeout: 20_000 }, () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URL, { serverSelectionTimeoutMS: 5_000 });
    await mongoose.connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('runs twice without duplication and preserves nt-budget', async () => {
    const { MeasureModel } = await import('../src/models/index.js');
    const { runIngestion } = await import('../src/connectors/runner.js');
    await MeasureModel.create(budgetGuard());
    const all = [
      ...parseNtLgPilotExtraction(extraction(DARWIN_TEXT), context()).records,
      ...parseNtLgPilotExtraction(extraction(PALMERSTON_TEXT), context(NT_LG_PILOT_DOCUMENTS[1]))
        .records,
      ...parseNtLgPilotExtraction(extraction(ALICE_TEXT), context(NT_LG_PILOT_DOCUMENTS[2]))
        .records,
    ];
    const fake = {
      ...createNtLgPilotConnector(),
      async fetch() {
        return [{ kind: 'nt-lg-pilot-records', records: all }];
      },
      transform(raw: readonly { kind: string; records?: unknown }[]) {
        return (raw[0]?.records as SpendingRecord[]) ?? [];
      },
    };
    await runIngestion({ connectors: [fake] });
    await runIngestion({ connectors: [fake] });
    expect(await MeasureModel.countDocuments({ source_id: NT_LG_PILOT_ID })).toBe(all.length);
    expect(await MeasureModel.countDocuments({ source_id: 'nt-budget' })).toBe(1);
    expect(
      await MeasureModel.countDocuments({ source_id: NT_LG_PILOT_ID, source_dataset: /Budget/i }),
    ).toBe(0);
  });
});
