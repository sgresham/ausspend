/** The minimum provenance carried by any figure in the API. */
export interface ProvenanceSourceRef {
  source_id: string;
  source_url: string;
  verified: boolean;
  notes?: string;
}

/** De-duplicate source references by source_id, preserving first-seen order. */
export function uniqueSources(rows: readonly ProvenanceSourceRef[]): ProvenanceSourceRef[] {
  const byId = new Map<string, ProvenanceSourceRef>();
  for (const row of rows) {
    if (!byId.has(row.source_id)) byId.set(row.source_id, row);
  }
  return [...byId.values()];
}

/**
 * The PBS caveat shown wherever PBS budget figures appear. The published CSV is
 * built from individual entity program tables; its total is not the Budget
 * Paper 1 general government expense total.
 */
export const PBS_CAVEAT =
  'PBS CSV line items are entity program tables; their sum does not equal the Budget Paper 1 total general government expense, so it is not the federal total.';

/**
 * GrantConnect caveat shown on /search and /data-sources. The source is a
 * human-downloaded, SHA-256-archived XLSX export, not an API or a scraper, and
 * wide exports are capped at 50,000 results (so coverage may be partial).
 */
export const GRANTCONNECT_CAVEAT =
  'GrantConnect is a manual file export, not an API and not a live scraper. The archived XLSX is fingerprinted with SHA-256. Exports above the 50,000-result cap are rejected, so grant coverage is partial until complete date-range chunks cover the period. No grant row is estimated or zero-filled.';
