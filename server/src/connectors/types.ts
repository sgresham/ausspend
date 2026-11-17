import type { SpendingRecord } from '@ausspend/shared';
import type { DeferredResource } from '../models/data-source.js';

export type ConnectorStatus = 'stub' | 'active' | 'degraded';

/**
 * How a source document was obtained on the most recent successful run.
 * `direct` is a normal browser-like HTTP fetch from the publisher; `parliament_fallback`
 * is the NSW Parliament tabled-paper artifact used when the publisher blocks the
 * ingestion host; `headless` means a headless browser was required to pass a
 * Cloudflare challenge before the exact bytes could be read.
 */
export type FetchStrategy = 'direct' | 'parliament_fallback' | 'headless';

export type ConnectorJurisdictionLevel =
  'federal' | 'state' | 'territory' | 'local' | 'charity' | 'pnfc' | 'soc' | 'other';

/** A source-native record before transformation. Connectors decide the shape. */
export type RawRecord = Record<string, unknown>;

/** The coverage metadata preserved from the stub registry. */
export interface ConnectorMetadata {
  id: string;
  name: string;
  publisher: string;
  source_url: string;
  status: ConnectorStatus;
  jurisdiction_level: ConnectorJurisdictionLevel;
  /** Optional source licence text persisted on data_sources by the runner. */
  license?: string;
  /** Optional provenance note persisted on data_sources by the runner. */
  notes?: string;
  /** Resources deliberately deferred (PDF/DOCX) for a later phase. */
  deferredResources?: DeferredResource[];
}

export interface ConnectorRunMetadata {
  lastFetchedAt: string | null;
  recordsIngested: number;
  /** Fatal/partial-run problems; a non-empty list marks the source degraded. */
  errors: string[];
  /**
   * Non-fatal data-quality notes (for example expected PBS `nfp`/negative rows
   * skipped). They are logged but do not mark the source degraded.
   */
  warnings?: string[];
  /** Set by the connector on a successful fetch; null when no document was obtained. */
  fetchStrategy?: FetchStrategy | null;
}

/**
 * Ingestion connector contract. Stubs never leave the process: `fetch` rejects
 * with "not implemented", `transform` returns no records, and the runner logs a
 * skipped source rather than aborting.
 */
export interface Connector extends ConnectorMetadata {
  fetch(): Promise<RawRecord[]>;
  transform(raw: readonly RawRecord[]): SpendingRecord[];
  metadata: ConnectorRunMetadata;
}

/** Serialisable coverage shape for `/api/meta/coverage`; never includes fetch/transform. */
export interface ConnectorSummary extends ConnectorMetadata {
  last_fetched_at: string | null;
  records_ingested: number;
  errors: string[];
  deferred_resources: DeferredResource[];
  fetch_strategy: FetchStrategy | null;
  /** Last successful document fetch (not the last attempt). */
  last_successful_fetch?: string | null;
  /** Whole days since the last successful fetch; null when there has never been one. */
  staleness_days?: number | null;
}

export function notImplemented(connector: Pick<ConnectorMetadata, 'id' | 'name'>): never {
  throw new Error(
    `Connector "${connector.id}" (${connector.name}) is not implemented: no live ingestion in F1`,
  );
}

export function connectorSummary(connector: Connector): ConnectorSummary {
  return {
    id: connector.id,
    name: connector.name,
    publisher: connector.publisher,
    source_url: connector.source_url,
    status: connector.status,
    jurisdiction_level: connector.jurisdiction_level,
    last_fetched_at: connector.metadata.lastFetchedAt,
    records_ingested: connector.metadata.recordsIngested,
    errors: [...connector.metadata.errors],
    deferred_resources: [...(connector.deferredResources ?? [])],
    fetch_strategy: connector.metadata.fetchStrategy ?? null,
  };
}
