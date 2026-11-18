import { createHash } from 'node:crypto';
import type { SpendingRecord } from '@ausspend/shared';
import {
  detectMoneyUnit,
  extractArchivedPdf,
  moneyToCents,
  parseAmountCell,
  type MoneyUnitKind,
  type PdfExtraction,
  type PdfPage,
} from './pdf-extract.js';
import { archiveSourceDocument, verifySourceDocument } from './source-archive.js';
import type { Connector, RawRecord } from './types.js';

/**
 * Northern Territory local government pilot — three councils only.
 *
 * City of Darwin, City of Palmerston and Alice Springs Town Council publish
 * audited General Purpose Financial Statements inside their annual reports.
 * This connector reads the Statement of Comprehensive Income from each latest
 * report, requires an explicit `$ '000` unit, and reconciles printed income and
 * expense components to the printed totals with zero tolerance. It is a
 * three-council pilot, not statewide NT coverage.
 */

export const NT_LG_PILOT_ID = 'nt-lg-pilot';
export const NT_LG_PILOT_NAME = 'Northern Territory local government GPFS pilot (3 councils)';
export const NT_LG_PILOT_PUBLISHER =
  'City of Darwin / City of Palmerston / Alice Springs Town Council';
export const NT_LG_PILOT_LICENSE =
  '© City of Darwin, City of Palmerston and Alice Springs Town Council. Audited GPFS used for public-interest research; not an open-data licence grant.';
export const NT_LG_PILOT_FISCAL_YEAR = '2025-26';
export const NT_LG_PILOT_UNIT = 'AUD_thousands';
export const NT_LG_PILOT_UNIT_LABEL = "$'000";
export const NT_LG_PILOT_UNIT_TO_CENTS = 100_000;
export const NT_LG_PILOT_CAVEAT =
  'NT local government three-council pilot. Council-level audited GPFS actuals, entity-level only; never sum across councils, measures or years, and never add to nt-budget or territory spending.';

export interface NtLgPilotDocument {
  council: string;
  shortName: string;
  title: string;
  url: string;
  fiscalYear: string;
  expectedSha256: string;
  expectedBytes: number;
}

export const NT_LG_PILOT_DOCUMENTS: readonly NtLgPilotDocument[] = [
  {
    council: 'City of Darwin',
    shortName: 'Darwin',
    title: 'City of Darwin Annual Report 2025-26',
    url: 'https://www.darwin.nt.gov.au/sites/default/files/2026-11/109572%20City%20of%20Darwin%20Annual%20Report%202025%20-%2026_FA%20Pages.pdf',
    fiscalYear: '2025-26',
    expectedSha256: '7291498d18748194e2eb8d5e4a8d1ff7d3eaee7f2f6583c4a55a76f456d0ef79',
    expectedBytes: 28_591_026,
  },
  {
    council: 'City of Palmerston',
    shortName: 'Palmerston',
    title: 'City of Palmerston Annual Report 2025-26',
    url: 'https://palmerston.nt.gov.au/sites/default/files/uploads/files/2026/COP_Annual%20Report%202025-26_WEB%20-%20Final.pdf',
    fiscalYear: '2025-26',
    expectedSha256: '57c33a4d90e682ffef0c86b5f3380aa9c814b9e183fe098b290cb5b9f3f271eb',
    expectedBytes: 7_910_758,
  },
  {
    council: 'Alice Springs Town Council',
    shortName: 'Alice Springs',
    title: 'Alice Springs Town Council Annual Report 2025-26',
    url: 'https://www.alicesprings.nt.gov.au/documents/1041/annual-report-2025-2026',
    fiscalYear: '2025-26',
    expectedSha256: '68944b6d82f1ab443e3c5a235785767985dae061606c364699618016f535c48b',
    expectedBytes: 11_640_642,
  },
];

export type NtLgMeasureSection = 'income' | 'expenses';

export interface NtLgMeasureSpec {
  key: string;
  label: string;
  labels: readonly string[];
  section: NtLgMeasureSection;
  componentOf: string | null;
  /** Some councils do not print this category; treat absence as zero, not an error. */
  optional?: boolean;
}

export const NT_LG_MEASURES: readonly NtLgMeasureSpec[] = [
  {
    key: 'rates_revenue',
    label: 'Rates revenue',
    labels: ['Rates revenue', 'Rates and waste charges'],
    section: 'income',
    componentOf: 'total_income',
  },
  {
    key: 'statutory_charges',
    label: 'Statutory charges',
    labels: ['Statutory charges'],
    section: 'income',
    componentOf: 'total_income',
  },
  {
    key: 'user_charges',
    label: 'User charges',
    labels: ['User charges'],
    section: 'income',
    componentOf: 'total_income',
  },
  {
    key: 'operating_grants',
    label: 'Grants, subsidies and contributions — operating',
    labels: ['Grants, subsidies and contributions - operating'],
    section: 'income',
    componentOf: 'total_income',
  },
  {
    key: 'investment_interest_income',
    label: 'Investment and interest income',
    labels: ['Investment and interest income'],
    section: 'income',
    componentOf: 'total_income',
  },
  {
    key: 'other_income',
    label: 'Other income',
    labels: ['Other income'],
    section: 'income',
    componentOf: 'total_income',
  },
  {
    key: 'reimbursements',
    label: 'Reimbursements',
    labels: ['Reimbursements'],
    section: 'income',
    componentOf: 'total_income',
    optional: true,
  },
  {
    key: 'total_income',
    label: 'Total income',
    labels: ['Total income'],
    section: 'income',
    componentOf: null,
  },
  {
    key: 'employee_costs',
    label: 'Employee costs',
    labels: ['Employee costs'],
    section: 'expenses',
    componentOf: 'total_expenses',
  },
  {
    key: 'materials_contracts_other',
    label: 'Materials, contracts and other expenses',
    labels: ['Materials, contracts and other expenses'],
    section: 'expenses',
    componentOf: 'total_expenses',
  },
  {
    key: 'depreciation_amortisation',
    label: 'Depreciation and amortisation',
    labels: ['Depreciation and amortisation', 'Depreciation, amortisation and impairment'],
    section: 'expenses',
    componentOf: 'total_expenses',
  },
  {
    key: 'finance_costs',
    label: 'Finance costs',
    labels: ['Finance costs'],
    section: 'expenses',
    componentOf: 'total_expenses',
  },
  {
    key: 'total_expenses',
    label: 'Total expenses',
    labels: ['Total expenses'],
    section: 'expenses',
    componentOf: null,
  },
];

const MONEY_TOKEN = /(?:\(\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\))?/g;

function normalizeText(text: string): string {
  return text
    .replace(/\b\d+[a-z]\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstAmountAfter(text: string, labels: readonly string[]): number | null {
  for (const label of labels) {
    const index = text.indexOf(label);
    if (index < 0) continue;
    const rest = text.slice(index + label.length);
    const match = rest.match(MONEY_TOKEN);
    if (!match) continue;
    const parsed = parseAmountCell(match[0]);
    if (parsed?.value !== null && parsed?.value !== undefined) return parsed.value;
  }
  return null;
}

export interface NtLgPilotReconciliation {
  council: string;
  fiscal_year: string;
  unit: MoneyUnitKind;
  page: number;
  total_income: number;
  total_expenses: number;
  income_components_sum: number;
  expense_components_sum: number;
  checks: string[];
}

export interface NtLgPilotParseResult {
  records: SpendingRecord[];
  reconciliation: NtLgPilotReconciliation;
}

export interface NtLgPilotContext {
  document: NtLgPilotDocument;
  sourceDate: string;
  archive: { local_path: string; sha256: string; bytes: number };
}

function findStatementPage(pages: readonly PdfPage[]): PdfPage | null {
  for (const page of pages) {
    const text = normalizeText(page.text);
    if (
      text.includes('Statement of Comprehensive Income') &&
      text.includes('Total income') &&
      text.includes('Total expenses')
    ) {
      return page;
    }
  }
  return null;
}

export function ntLgPilotNaturalKey(council: string, fiscalYear: string, measure: string): string {
  const digest = createHash('sha256')
    .update([NT_LG_PILOT_ID, council, fiscalYear, measure].join('|'))
    .digest('hex')
    .slice(0, 40);
  return `${NT_LG_PILOT_ID}:${digest}`;
}

export function parseNtLgPilotExtraction(
  extraction: PdfExtraction,
  context: NtLgPilotContext,
): NtLgPilotParseResult {
  const page = findStatementPage(extraction.pages);
  if (!page) {
    throw new Error(
      `${context.document.council}: Statement of Comprehensive Income page not found`,
    );
  }
  const text = normalizeText(page.text);
  const unit = detectMoneyUnit([text]);
  if (unit.kind !== 'thousands' || unit.ambiguous) {
    throw new Error(
      `${context.document.council}: explicit $'000 unit not found (${unit.reason}); refusing to guess`,
    );
  }
  const values = new Map<string, number>();
  for (const spec of NT_LG_MEASURES) {
    const value = firstAmountAfter(text, spec.labels);
    if (value === null) {
      if (spec.optional) {
        values.set(spec.key, 0);
        continue;
      }
      throw new Error(
        `${context.document.council}: could not read printed value for ${spec.label}`,
      );
    }
    values.set(spec.key, value);
  }
  const incomeComponents = NT_LG_MEASURES.filter(
    (spec) => spec.section === 'income' && spec.componentOf,
  );
  const expenseComponents = NT_LG_MEASURES.filter(
    (spec) => spec.section === 'expenses' && spec.componentOf,
  );
  const incomeSum = incomeComponents.reduce((sum, spec) => sum + values.get(spec.key)!, 0);
  const expenseSum = expenseComponents.reduce((sum, spec) => sum + values.get(spec.key)!, 0);
  const totalIncome = values.get('total_income')!;
  const totalExpenses = values.get('total_expenses')!;
  if (incomeSum !== totalIncome) {
    throw new Error(
      `${context.document.council}: income components ${incomeSum} != printed Total income ${totalIncome}`,
    );
  }
  if (expenseSum !== totalExpenses) {
    throw new Error(
      `${context.document.council}: expense components ${expenseSum} != printed Total expenses ${totalExpenses}`,
    );
  }
  const records: SpendingRecord[] = NT_LG_MEASURES.filter(
    (spec) => !(spec.optional && values.get(spec.key) === 0),
  ).map((spec) => {
    const value = values.get(spec.key)!;
    return {
      amount_cents: moneyToCents(Math.abs(value), 'thousands'),
      measure_type: 'actual',
      fiscal_year: context.document.fiscalYear,
      source_id: NT_LG_PILOT_ID,
      source_url: context.document.url,
      verified: false,
      natural_key: ntLgPilotNaturalKey(
        context.document.council,
        context.document.fiscalYear,
        spec.key,
      ),
      project_name: context.document.council,
      description: spec.label,
      jurisdiction_level: 'local',
      jurisdiction: 'NT',
      delivery_entity: context.document.council,
      funding_source: 'Northern Territory local government',
      source_dataset: `NT local government pilot — ${context.document.council}`,
      source_date: context.sourceDate,
      data_quality_flag: 'provisional',
      aggregation_role: 'agency_detail',
      extraction_confidence: 'high',
      reconciliation_status: 'printed_totals_reconciled',
      location: { state: 'NT', lga_name: context.document.council },
      category: spec.key,
      notes: `${NT_LG_PILOT_CAVEAT} Document: ${context.document.title}; archive: ${context.archive.local_path}; sha256: ${context.archive.sha256}; statement page: ${page.page_number}; printed column: ${spec.label}; unit: $'000; ${spec.componentOf ? `component of ${spec.componentOf}; ` : ''}human_spot_check: required.`,
    };
  });
  return {
    records,
    reconciliation: {
      council: context.document.council,
      fiscal_year: context.document.fiscalYear,
      unit: 'thousands',
      page: page.page_number,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      income_components_sum: incomeSum,
      expense_components_sum: expenseSum,
      checks: [
        'income components equal printed Total income (zero tolerance)',
        'expense components equal printed Total expenses (zero tolerance)',
      ],
    },
  };
}

export interface NtLgPilotOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  now?: () => Date;
}

export function createNtLgPilotConnector(options: NtLgPilotOptions = {}): Connector {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
    fetchStrategy: 'direct' as const,
  };
  return {
    id: NT_LG_PILOT_ID,
    name: NT_LG_PILOT_NAME,
    publisher: NT_LG_PILOT_PUBLISHER,
    source_url: 'https://www.darwin.nt.gov.au/',
    status: 'active',
    jurisdiction_level: 'local',
    license: NT_LG_PILOT_LICENSE,
    notes:
      "Northern Territory three-council GPFS pilot: City of Darwin, City of Palmerston and Alice Springs Town Council FY2025-26 audited Statements of Comprehensive Income. Explicit $'000 guard, zero-tolerance component/total reconciliation, provisional rows with human_spot_check required. Not statewide NT coverage; never added to nt-budget or other councils.",
    deferredResources: [],
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      const records: SpendingRecord[] = [];
      for (const document of NT_LG_PILOT_DOCUMENTS) {
        const response = await fetchImpl(document.url, { headers: { accept: 'application/pdf' } });
        if (!response.ok) {
          metadata.errors.push(`${document.council}: GPFS fetch HTTP ${response.status}`);
          continue;
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        const now = options.now?.() ?? new Date();
        const archived = await archiveSourceDocument({
          source_id: NT_LG_PILOT_ID,
          title: document.title,
          original_url: document.url,
          retrieved_from: document.url,
          archived_from: 'direct',
          filename: `${document.shortName.replace(/\s+/g, '-')}-annual-report-${document.fiscalYear}.pdf`,
          content_type: 'application/pdf',
          data: bytes,
          root: options.archiveRoot,
          fetched_at: now,
          notes: `${document.council} audited FY${document.fiscalYear} General Purpose Financial Statements, archived with SHA-256 outside the repo.`,
        });
        await verifySourceDocument(archived);
        const extraction = await extractArchivedPdf(archived);
        const parsed = parseNtLgPilotExtraction(extraction, {
          document,
          sourceDate: archived.fetched_at.slice(0, 10),
          archive: {
            local_path: archived.local_path,
            sha256: archived.sha256,
            bytes: archived.bytes,
          },
        });
        records.push(...parsed.records);
        metadata.warnings.push(
          `${document.council}: page=${parsed.reconciliation.page} income=${parsed.reconciliation.total_income} expenses=${parsed.reconciliation.total_expenses} ($'000); zero-tolerance reconciliation passed`,
        );
      }
      return [{ kind: 'nt-lg-pilot-records', records }];
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const entry = raw.find(
        (value) => value.kind === 'nt-lg-pilot-records' && Array.isArray(value.records),
      );
      if (!entry) {
        metadata.errors.push('NT LG pilot fetch returned no parsed records');
        return [];
      }
      return (entry.records as SpendingRecord[]).slice();
    },
    metadata,
  };
}
