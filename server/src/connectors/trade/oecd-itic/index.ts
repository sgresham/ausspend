import { DataSourceModel, TradeRecordModel } from '../../../models/index.js';
import { archiveSourceDocument, type ArchivedSourceRecord } from '../../source-archive.js';
import {
  fetchOecdIticRecords,
  readOecdIticArchivedDocuments,
  type OecdIticFetchOptions,
  type OecdIticFetchResult,
  type OecdIticSourceDocument,
} from './client.js';
import {
  OECD_ITIC_DATAFLOW,
  OECD_ITIC_DATAFLOW_URL,
  OECD_ITIC_LICENSE,
  OECD_ITIC_NAME,
  OECD_ITIC_PUBLISHER,
  OECD_ITIC_SOURCE_DATASET,
  OECD_ITIC_SOURCE_ID,
  OECD_ITIC_VERSION,
} from './meta.js';
import {
  parseIticData,
  sanityCheckAustraliaMargins,
  type OecdIticRecordInput,
  type OecdIticSanityResult,
  type SdmxDataJson,
} from './parse.js';

export * from './meta.js';
export * from './parse.js';
export * from './client.js';

export interface OecdIticIngestResult extends OecdIticFetchResult {
  archived: ArchivedSourceRecord[];
  upserted: number;
  matched: number;
  total: number;
  sanity: OecdIticSanityResult[];
}

export interface OecdIticIngestOptions extends OecdIticFetchOptions {
  archive?: boolean;
  /** Replay the raw responses already SHA-256 archived outside the repo. */
  fromArchive?: boolean;
  /** Archive root override; defaults to ~/ausspend-source-archive. */
  archiveRoot?: string;
}

function dedupeRecords(records: readonly OecdIticRecordInput[]): OecdIticRecordInput[] {
  const seen = new Set<string>();
  const unique: OecdIticRecordInput[] = [];
  for (const record of records) {
    const key = [
      record.source_dataset,
      record.trade_flow,
      record.measure_type,
      record.commodity_code ?? '',
      record.partner_country ?? '',
      record.time_period ?? '',
      record.financial_year,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

function recordsFromDocuments(
  documents: readonly OecdIticSourceDocument[],
  sourceDate: string,
): OecdIticRecordInput[] {
  return dedupeRecords(
    documents.flatMap((document) =>
      parseIticData(JSON.parse(document.data) as SdmxDataJson, {
        sourceDate,
        sourceUrl: document.url,
      }),
    ),
  );
}

function naturalFilter(record: OecdIticRecordInput): Record<string, unknown> {
  return {
    source_dataset: record.source_dataset,
    trade_flow: record.trade_flow,
    measure_type: record.measure_type,
    commodity_code: record.commodity_code ?? null,
    partner_country: record.partner_country ?? null,
    time_period: record.time_period ?? null,
    financial_year: record.financial_year,
    'location.granularity': record.location.granularity,
  };
}

/**
 * Upsert OECD ITIC margin observations by their published dimensions. Nothing
 * is summed: each row is one importer–exporter–product–year margin.
 */
export async function upsertOecdIticRecords(
  records: readonly OecdIticRecordInput[],
): Promise<{ upserted: number; matched: number }> {
  if (records.length === 0) return { upserted: 0, matched: 0 };
  const result = await TradeRecordModel.bulkWrite(
    records.map((record) => ({
      updateOne: {
        filter: naturalFilter(record),
        update: { $set: record },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  return { upserted: result.upsertedCount, matched: result.matchedCount };
}

/** Archive raw SDMX responses outside the repo (bytes + SHA-256 record). */
export async function archiveOecdIticDocuments(
  documents: readonly OecdIticSourceDocument[],
): Promise<ArchivedSourceRecord[]> {
  const archived: ArchivedSourceRecord[] = [];
  for (const document of documents) {
    archived.push(
      await archiveSourceDocument({
        source_id: OECD_ITIC_SOURCE_ID,
        title: document.title,
        original_url: document.url,
        archived_from: 'direct',
        filename: document.filename,
        content_type: 'application/json',
        data: document.data,
        notes: `OECD ITIC ${OECD_ITIC_DATAFLOW} ${OECD_ITIC_VERSION}; raw SDMX-JSON response`,
      }),
    );
  }
  return archived;
}

function sanityNote(sanity: readonly OecdIticSanityResult[]): string {
  if (sanity.length === 0) return 'No sanity diagnostic was produced.';
  return sanity
    .map((result) => {
      const state = result.matched ? 'matched' : 'FLAGGED mismatch';
      return `${result.year}: unweighted HS4 mean ${result.observed_unweighted_mean_percent.toFixed(
        2,
      )}% vs headline ${result.expected_percent}% (${state}; ${result.rows} rows; no value adjusted)`;
    })
    .join('; ');
}

export async function recordOecdIticSource(
  recordCount: number,
  sanity: readonly OecdIticSanityResult[] = [],
): Promise<void> {
  const now = new Date();
  const sanityText = sanityNote(sanity);
  await DataSourceModel.updateOne(
    { source_id: OECD_ITIC_SOURCE_ID },
    {
      $set: {
        name: OECD_ITIC_NAME,
        publisher: OECD_ITIC_PUBLISHER,
        source_url: OECD_ITIC_DATAFLOW_URL,
        retrieved_at: now.toISOString(),
        license: OECD_ITIC_LICENSE,
        verified: true,
        status: 'active',
        last_ingested_at: now,
        fetch_strategy: 'direct',
        last_successful_fetch: now,
        records_ingested: recordCount,
        errors: [],
        deferred_resources: [],
        notes:
          `OECD ITIC ${OECD_ITIC_DATAFLOW} ${OECD_ITIC_VERSION} via the public OECD SDMX endpoint. ` +
          'Australia is the reference/importer and the counterpart is the exporter; every row is an import CIF/FOB margin (percentage of CIF value), not profit and not spending. ' +
          'Observed versus estimated is preserved from OBS_STATUS/METHODOLOGY_TYPE; model-based, derived, interpolated and adjusted observations are never relabelled observed. ' +
          'Margins, trade values, port costs, volumes and prices are never summed. ' +
          `Sanity diagnostic: ${sanityText}`,
      },
    },
    { upsert: true },
  );
}

/** Fetch, archive and upsert OECD ITIC. Returns the observed row count. */
export async function ingestOecdItic(
  options: OecdIticIngestOptions = {},
): Promise<OecdIticIngestResult> {
  let fetched: OecdIticFetchResult;
  let archived: ArchivedSourceRecord[] = [];
  if (options.fromArchive) {
    const documents = await readOecdIticArchivedDocuments(options.archiveRoot);
    if (documents.length === 0) {
      throw new Error('no archived OECD ITIC responses found to replay');
    }
    const sourceDate =
      options.now?.().toISOString().slice(0, 10) ??
      documents.find((document) => document.fetched_at)?.fetched_at?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10);
    fetched = {
      documents,
      records: recordsFromDocuments(documents, sourceDate),
      sourceDate,
    };
  } else {
    fetched = await fetchOecdIticRecords(options);
    if (options.archive !== false) {
      archived = await archiveOecdIticDocuments(fetched.documents);
    }
  }
  const sanity = sanityCheckAustraliaMargins(fetched.records);
  const { upserted, matched } = await upsertOecdIticRecords(fetched.records);
  const total = await TradeRecordModel.countDocuments({
    source_dataset: OECD_ITIC_SOURCE_DATASET,
  });
  await recordOecdIticSource(total, sanity);
  return { ...fetched, archived, upserted, matched, total, sanity };
}

/** Discovery metadata used by scripts/generate-source-docs.ts. */
export const connectorModule = {
  id: OECD_ITIC_SOURCE_ID,
  doc_id: 'oecd-itic',
  create: () => ({
    id: OECD_ITIC_SOURCE_ID,
    doc_id: 'oecd-itic',
    name: OECD_ITIC_NAME,
    publisher: OECD_ITIC_PUBLISHER,
    source_url: OECD_ITIC_DATAFLOW_URL,
    jurisdiction_level: 'federal' as const,
    status: 'active' as const,
    license: OECD_ITIC_LICENSE,
    notes:
      'OECD ITIC CIF/FOB margins from the public OECD SDMX dataflow (OECD.SDD.TPS, DSD_ITIC@DF_ITIC, 1.1). Australia is the reference/importer, COUNTERPART_AREA the exporter, MEASURE=C_F and UNIT_MEASURE=PT_IM_CIF (percentage of CIF import value). The connector ingests per-partner totals (COMM_HS2017=_T) for 2019–2022 and Australia–World HS 2017 4-digit product margins for 2019 and 2022. Every row is a border cost (`cif_fob_margin`), never profit, and margins are non-additive with trade values and port costs. OBS_STATUS/METHODOLOGY_TYPE are preserved so modelled, derived, interpolated and adjusted observations are flagged estimated/provisional, never observed. Raw SDMX-JSON is SHA-256 archived outside the repo. The requested 2019 ≈ 3.5% / 2022 ≈ 6.4% headline is a CIF-import-value-weighted aggregate that ITIC does not publish and cannot be reproduced without trade values: the connector records the unweighted HS4 diagnostic and flags any mismatch instead of adjusting a value.',
  }),
} as const;
