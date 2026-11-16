# Federal ingestion — AusTender (F2)

This milestone makes **one** federal source live: **AusTender** contract notices from the
Australian Government's public OCDS API. It deliberately does **not** implement the data.gov.au
Portfolio Budget Statements (PBS) feed or GrantConnect; both remain pending stubs. The state and
territory connectors remain stubs too.

## Source and endpoint

- Base API: <https://api.tenders.gov.au/ocds>
- Feed: `GET /ocds/findByDates/contractPublished/{startDate}/{endDate}`
- Public and unauthenticated. Every request sends `Accept: application/json` and an explicit
  `User-Agent` identifying ausspend.
- Dates are **ISO-8601 instants in the URL path**, not query parameters, for example
  `/ocds/findByDates/contractPublished/2026-11-02T00:00:00Z/2026-11-09T00:00:00Z`.
- The envelope is `{ "releases": [ ... ], "links": { "next": "...?cursor=..." } }` with about
  100 releases per page.

### `contractPublished` nuance

The feed is **date-of-publication of the contract notice**, not the contract's start date or the
date the tender was advertised. A one-week window therefore yields the contract notices published
in that week; `contracts[0].dateSigned` can fall just outside the window (for example, an
adjustment published later for a contract signed earlier). This is why the fiscal year is derived
from the contract/release date, not from the fetch window, and why re-running the same window is
idempotent on `ocid` rather than "new records each run".

## Mapping (critical)

Each release maps to one `measures` document with `measure_type: "contract"`.

| Target field         | Source                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `project_name`       | `contracts[0].title` (omitted when null/empty; never invented)                                   |
| `description`        | `contracts[0].description`                                                                       |
| `jurisdiction_level` | literal `"federal"`                                                                              |
| `jurisdiction`       | literal `"Commonwealth"`                                                                         |
| `funding_source`     | the `parties[]` entry whose `roles` contains **`buyer` or `procuringEntity`** (buyer)            |
| `delivery_entity`    | the `parties[]` entry whose `roles` contains **`supplier` or `tenderer`** (supplier)             |
| `amount_cents`       | `contracts[0].value.amount` (decimal-dollar string) × 100, rounded to a **safe integer**         |
| `fiscal_year`        | derived from `contracts[0].dateSigned`, falling back to the release `date` (Australian FY)       |
| `measure_type`       | literal `"contract"`                                                                             |
| `source_dataset`     | literal `"AusTender OCDS API"`                                                                   |
| `source_url`         | `https://www.tenders.gov.au/Contract/Details/{contracts[0].id}`                                  |
| `source_date`        | `contracts[0].dateSigned` or the release `date` (ISO-8601)                                       |
| `location`           | `parties[]` address `region` only (supplier first, then buyer); postcode is kept in `notes`      |
| `data_quality_flag`  | `location_approximate` (state + postcode), `statewide_only` (state only), or `location_unknown`  |
| `unspsc`             | `contracts[0].items[].classification.id` where `scheme == "UNSPSC"`, de-duplicated, comma-joined |
| `natural_key`        | `ocid`                                                                                           |
| `verified`           | `false` — no human verification step exists yet                                                  |

**Never `parties[0]`.** The live feed's first party is frequently the supplier, and the top-level
`buyer` field is `null`. The buyer _must_ be looked up by role (`buyer` / `procuringEntity`) and the
supplier by role (`supplier` / `tenderer`). The fixture test
`server/test/aus-tender.test.ts` deliberately puts the supplier first so a `parties[0]` regression
fails.

Invalid amounts (missing, non-numeric, negative, not a safe integer) are **skipped**, not written
with a guessed or rounded-down value; the reason is recorded on the connector run and the run is
logged `partial` with the source marked `degraded`.

### UNSPSC, not COFOG

AusTender classifies goods/services with **UNSPSC** codes. They are stored verbatim in the
`unspsc` field and are **never** translated to a COFOG function. Federal contract rows therefore
have `function_code: null` and are omitted from COFOG breakdowns; the API tolerates a null
function/region rather than inventing one.

### Date and financial-year rule

Australian financial years run **1 July – 30 June**, formatted `YYYY-YY`:

| Date (UTC) | FY      |
| ---------- | ------- |
| 2025-06-30 | 2024-25 |
| 2025-07-01 | 2025-26 |
| 2026-01-01 | 2025-26 |

The date used is `contracts[0].dateSigned`; if absent, the release `date`. A release with neither is
skipped.

### Location quality flags

Only a `parties[]` address state is stored in `location.state`. A postcode, when present, is kept
in `notes`. ausspend never invents an LGA, SA2 or coordinate:

- `location_approximate` — state and postcode were present.
- `statewide_only` — state only.
- `location_unknown` — no party address state.

## Pagination and rate policy

- The returned `links.next` cursor is followed page by page.
- A **1 second** delay is applied between pages (not before the first page).
- `429` responses honour `Retry-After` (seconds or HTTP date, capped at 60 s); otherwise the
  connector backs off exponentially (1 s, 2 s, 4 s, …) up to four retries, then fails the source.
- A bounded page limit (`AUSTENDER_PAGE_LIMIT`, default 25) protects the run. If the limit is hit
  while a cursor remains, the connector reports `page limit N reached; results truncated`.
- The next cursor is rejected if it leaves `api.tenders.gov.au`.

## Natural key and idempotency

`natural_key = ocid`. The runner upserts with
`MeasureModel.updateOne({ natural_key }, { $set: record }, { upsert: true })`, so re-running the
same window updates the same documents: counts stay stable and there are no duplicate natural keys.
Releases sharing an `ocid` within one batch are de-duplicated, keeping the newest `source_date`.

## Narrow live run

The acceptance run ingests **one recent full week** into
`mongodb://10.10.10.30:27017/ausspend_dev` (never the pool Mongo):

```bash
AUSTENDER_START_DATE=2026-11-02T00:00:00Z \
AUSTENDER_END_DATE=2026-11-09T00:00:00Z \
INGEST_SOURCES=aus-tender \
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
npm run ingest:federal
```

Defaults without `AUSTENDER_START_DATE`/`AUSTENDER_END_DATE` are the seven complete days before
today (UTC). `INGEST_SOURCES=aus-tender` limits the run to the live connector; without it, the other
registered sources are logged as `skipped`. Per-source status lands in `data_sources` (status,
`last_ingested_at`, `records_ingested`, `errors`) and each run writes an `ingestion_logs` row.

To verify:

```bash
mongosh 'mongodb://10.10.10.30:27017/ausspend_dev' --quiet --eval '
  db.measures.countDocuments({jurisdiction_level:"federal", measure_type:"contract"}),
  db.measures.distinct("natural_key", {jurisdiction_level:"federal"}).length
'

curl -s 'http://localhost:3101/api/v1/spending?jurisdiction_level=federal&measure_type=contract'
curl -s 'http://localhost:3101/api/v1/data-sources'
curl -s 'http://localhost:3101/api/v1/meta/coverage'
```

Re-run the ingestion command and compare the counts: they should not grow except for genuinely new
`ocid`s in the same window.

## Restart safety (seed vs live ingestion)

The development seed is **non-destructive by default**. On a normal run it deletes only measures
whose `source_id` is `synthetic-seed`, upserts the synthetic source/regions/functions, and leaves
every ingested AusTender contract, every other `data_sources` register entry and every
`ingestion_logs` document untouched. That is why `docker compose up` (which runs the one-shot
`seed` service) can be repeated without losing the 861 live contracts.

The only destructive path is explicit and opt-in:

```bash
npm run seed -- --reset          # wipes measures, functions, regions and data sources first
```

There is no compose profile or default that runs `--reset`.

### Re-ingest after a restart

The `ingest` compose service is an opt-in profile, so a plain `docker compose up` never runs it:

```bash
# default window (seven complete days before today, UTC)
docker compose --profile ingest run --rm ingest

# narrow acceptance window
AUSTENDER_START_DATE=2026-11-02T00:00:00Z \
AUSTENDER_END_DATE=2026-11-09T00:00:00Z \
INGEST_SOURCES=aus-tender \
docker compose --profile ingest run --rm ingest
```

Without Docker, run the same `npm run ingest:federal` command from the previous section. Both
paths wait for the safe seed and upsert on `natural_key`, so a re-run never duplicates contracts
and a subsequent seed never removes them.

### Expected coexistence after the narrow run

```text
810 synthetic measures (source_id: synthetic-seed)
861 AusTender contract measures (source_id: aus-tender, measure_type: contract)
861 distinct federal natural_key values
data_sources: synthetic-seed active, aus-tender active
```

## Remaining caveats

- **PBS (data.gov.au) is pending.** Portfolio Budget Statements are budget/actual measures, not
  contracts; the budget-total and PDF/XLSX-format questions are unresolved. This milestone does
  not implement them.
- **GrantConnect is pending.** No grant feed is implemented.
- **State/territory connectors are stubs.** NSW/VIC/QLD/WA remain uningested.
- **No human verification.** Both the synthetic seed and AusTender rows carry `verified: false`.
- **No cross-measure totals.** Contract and budget/actual/estimate rows are never summed together;
  the API groups by `measure_type` and returns `total_cents: null` for mixed responses.
- The public `tenders.gov.au` contract page may reject automated requests at the WAF; `source_url`
  is the canonical human-facing contract-notice URL, constructed from the contract id.
