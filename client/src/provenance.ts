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
