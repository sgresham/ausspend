# Phase 6.5 — SA statewide local government: DEFERRED

Item: `w-mwl8joiy-9vrm`. Decision: **defer, do not ingest**, per the brief's
premise falsifier and the orchestrator's confirmation.

## Why

The only statewide SA local-government dataset is
`api-statewide-local-government-datasets`, present on both data.sa and the
data.gov.au mirror. Its complete resource list is:

1. `Statewide Local Government datasets API` → `https://parse.com` (dead API)
2. `Parse - API Instruction Document` (PDF)
3. `Local Council Names` (1,807-byte CSV; council names only)

The legacy Parse endpoint is dead: `https://api.parse.com` returns **HTTP 410
Gone**, and `https://parse.com` redirects to `https://parseplatform.org/`. The
package notes say the Metabase covered Elected Members, Events, Libraries,
Parks and Councils — **no expense rows**. There is no other LGA-SA dataset on
data.sa or data.gov.au and no expense mirror.

The acceptance criterion (≥50 council-level expense rows with a valid
`lga_name`) therefore cannot be met without inventing data. The names-only CSV
is deliberately **not** ingested.

## What was not changed

- No `sa-local-government` rows were added.
- No existing source, row, measure or data source record was deleted or
  altered.
- The DB was left at its current total; this work is documentation only.

## If this is revisited

A future item must name a specific SA local-government **expense** source (for
example a published LGA SA financial dataset). Do not guess a Parse replacement
endpoint and do not treat council geometry or council names as expenditure.
