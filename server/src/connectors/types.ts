/**
 * Phase 1 ingestion connectors are deliberately inert: there is no network
 * access, no credentials and no ingestion pipeline yet. Each connector carries
 * the metadata the coverage endpoint publishes and a `fetch` that always throws
 * "not implemented". The TODO comments name the real endpoint/format to wire up
 * in a later milestone.
 */
export type ConnectorStatus = 'stub';

export interface ConnectorMetadata {
  id: string;
  name: string;
  publisher: string;
  source_url: string;
  status: ConnectorStatus;
}

export interface Connector extends ConnectorMetadata {
  /** Always rejects; connectors are not wired to any network in Phase 1. */
  fetch(): Promise<never>;
}

export function notImplemented(connector: ConnectorMetadata): never {
  throw new Error(
    `Connector "${connector.id}" (${connector.name}) is not implemented: no live ingestion in Phase 1`,
  );
}

/** Serialisable summary for `/api/meta/coverage`; never includes `fetch`. */
export function connectorSummary(connector: Connector): ConnectorMetadata {
  return {
    id: connector.id,
    name: connector.name,
    publisher: connector.publisher,
    source_url: connector.source_url,
    status: connector.status,
  };
}
