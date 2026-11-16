# Federal ingestion — AusTender (F2) and data.gov.au PBS (F3)

Two federal sources are live:

1. **AusTender** contract notices from the Australian Government's public OCDS API (F2).
2. **Portfolio Budget Statements (PBS)** budget line items from the data.gov.au CKAN dataset,
   streamed from the 2025-26 program-expense CSV (F3).

Both are unverified (`verified: false`) and neither is a single government total. GrantConnect
remains a blocked stub (F4: the cited Track A adaptor does not exist and the only public Apify
alternative needs a paid token; see [GrantConnect (F4)](#grantconnect-f4--track-a-adaptor-blocked)),
as do the state/territory connectors.

> **PBS caveat.** The PBS CSV is built from individual entity program-expense tables. Its line
> items do **not** sum to the Budget Paper 1 "Estimates of General Government Expenses" total.
> Never present a PBS sum as the federal total.

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

## PBS (data.gov.au) — source, CSV and streaming parse

- CKAN API base: <https://data.gov.au/data/api/3/action/>. Read-only, no API key.
- Dataset id: `4f025f38-0c70-45e2-8106-4c29a5e48637`
  (<https://data.gov.au/data/dataset/4f025f38-0c70-45e2-8106-4c29a5e48637>).
- The connector calls `package_show?id=...`, then selects the CSV resource named
  **"2025-26 PBS Program Expenses Line Items"** (resource id
  `7cc8640f-b5d4-41de-a665-3197739b965f`). The ZIP/Excel bundles and the Budget Paper 1/4
  resources are ignored.
- The CSV is decoded as **Windows-1252** (the source has 0x92 curly quotes, not valid UTF-8) and
  parsed with a **streaming CSV parser** (`csv-parse`, pinned exactly). Chunks are fed straight
  from the HTTP body; the file is never loaded as a single string.
- CKAN and download calls are 500 ms apart. A `429` honours `Retry-After` (seconds or HTTP date,
  capped at 60 s) with bounded exponential backoff.

### PBS row mapping

| Target field         | Source / rule                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `source_id`          | literal `"data-gov-au-pbs"`                                                                                          |
| `source_dataset`     | literal `"2025-26 Portfolio Budget Statements (data.gov.au)"`                                                        |
| `measure_type`       | literal `"budget"`                                                                                                   |
| `jurisdiction_level` | literal `"federal"`; `jurisdiction` literal `"Commonwealth"`                                                         |
| `project_name`       | `Program` (whitespace/NBSP-normalised)                                                                               |
| `description`        | `Outcome`                                                                                                            |
| `delivery_entity`    | `Department/Agency`                                                                                                  |
| `funding_source`     | `Portfolio`                                                                                                          |
| `amount_cents`       | `2025-26` column × 1,000 (published `$'000`) × 100, safe integer; `nfp`, blank, negative or invalid rows are skipped |
| `fiscal_year`        | literal `"2025-26"`                                                                                                  |
| `source_url`         | the data.gov.au resource page URL                                                                                    |
| `source_date`        | resource `last_modified` / release date (`2025-03-26`)                                                               |
| `function_code`      | COFOG-A division only where the portfolio has one defensible functional area (see below)                             |
| `data_quality_flag`  | `statewide_only` when a COFOG division is mapped; `provisional` when it is not                                       |
| `location`           | `{ state: "Commonwealth" }` only; PBS is not geographically tagged                                                   |
| `natural_key`        | `4f025f38-...:<stable row hash>`; exact duplicate rows add an occurrence suffix                                      |
| `verified`           | `false`                                                                                                              |
| `notes`              | expense/appropriation/source table, the `$'000` unit rule, the CSV download URL and the caveat                       |

**Units.** The CSV has bare integers and no unit column. The referenced PBS program tables publish
`$'000`, so the raw value is thousands of dollars: `2,500` → `$2,500,000` → `250,000,000` cents.
The mapping is documented in every record's `notes`; other amount columns (`2024-25`, `2026-27`,
etc.) are ignored and not comparable across years in this ingestion.

**COFOG mapping is conservative.** Only portfolios with a single defensible functional area are
mapped (for example Health and Aged Care → `07`, Defence → `02`, Education → `09`, Social Services
and Veterans' Affairs → `10`, Attorney-General's and Home Affairs → `03`, Agriculture/Industry/
Employment → `04`, Treasury/Finance/PM&C/Parliament/Foreign Affairs → `01`). Mixed portfolios
such as Infrastructure/Transport/Communications/Arts and Climate/Energy/Environment are left
`function_code: null` and flagged `provisional`; no function is invented. The row's location is
never an LGA, SA2 or coordinate.

### PBS natural key and idempotency

`natural_key = dataset_id + SHA-256 of the canonical source row` (field names sorted; whitespace
normalised). Exact duplicate source rows in the published file get a stable `-1`, `-2`, … occurrence
suffix so they are not silently collapsed and re-runs stay byte-identical. The runner upserts on
`natural_key`, so re-running the PBS connector updates the same documents and never duplicates.

### PBS caveat in the app

`/api/v1/spending?...&measure_type=budget`, `/api/v1/meta/coverage` and both `/search` and
`/data-sources` state the caveat. The budget per-measure-type total is the PBS line-item sum only,
not a federal total. The coverage API exposes `federal_ingestion.pbs_caveat` and
`pbs_last_ingested_at`.

### PBS tests and live smoke

`server/test/data-gov-au-pbs.test.ts` covers CKAN resource selection, chunked Windows-1252 parsing,
mapping/row hash/idempotency, unmappable COFOG → provisional, integer amounts, `nfp`/negative skips,
duplicate occurrence keys and the connector fetch/transform. The opt-in live smoke runs the real
CKAN call and CSV stream:

```bash
PBS_LIVE_TEST=1 npx vitest run server/test/data-gov-au-pbs.test.ts
```

### PBS live run

```bash
INGEST_SOURCES=data-gov-au-pbs \
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
npm run ingest:federal
```

The runner writes `ingestion_logs`, updates `data_sources` (`active`/`degraded`,
`last_ingested_at`, `records_ingested`, `errors`) and continues with the next source on failure.
A PBS failure marks the source `degraded` and logs an `error`; it never aborts the run.

## GrantConnect (F4) — Track A adaptor: **BLOCKED**

GrantConnect has **no public award API and no CSV/RSS/JSON feed**. F4 therefore considered only
Track A, a third-party adaptor, and explicitly did **not** build Track B (a direct scraper of
`grants.gov.au`). Track A is blocked: the adaptor cited by the task does not exist, and the only
public Apify alternative requires an Apify token and per-event payment. `grantconnect` therefore
remains a **stub** — no live records, no fake records, no scraper.

### Verification (2026-11-16, public HTTP, no credentials)

| Check                                          | Request                                                                    | Result                                                                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cited actor store page                         | `GET https://apify.com/australia-grantconnect-monitor`                     | **HTTP 404**                                                                                                                                      |
| Cited actor API                                | `GET https://api.apify.com/v2/acts/australia-grantconnect-monitor`         | **HTTP 404**                                                                                                                                      |
| Store search                                   | `GET https://api.apify.com/v2/store?search=grantconnect&limit=20`          | `total: 1`, only `tacps126/grants-radar`                                                                                                          |
| Run the only related actor without credentials | `POST https://api.apify.com/v2/acts/tacps126~grants-radar/runs` (no token) | **HTTP 402** `x402-payment-required`: "Request not authenticated. Add your Apify API token, or a PAYMENT-SIGNATURE header for x402 payment."      |
| Pricing of the only related actor              | store item `currentPricingInfo`                                            | `PAY_PER_EVENT`: grant call **$0.003 each** on FREE tier (≈ **$3 per 1,000 calls**), plus actor-start `$0.001`/GB and optional AI insight `$0.01` |

Two further disqualifiers for the one surviving actor:

1. **Credential/paid access.** Every Apify actor run needs an Apify API token (and credits); the
   unauthenticated run above is rejected with `402`. Billing is per delivered call, not free.
2. **Wrong shape.** "Grants Radar" advertises _open and upcoming funding calls/opportunities_ from
   several jurisdictions, not published GrantConnect **award** records. Mapping calls to
   `measure_type: "grant_award"` (recipient, awarded value, award date) would invent an award that
   the source does not supply.

The cited actor's claimed features (server-side filters, delta mode, normalised ABN/date/AUD
fields) could not be verified because no actor with that name is publicly listed.

### Decision recorded

- `source_id: "grantconnect"` stays registered as `status: "stub"`; `fetch()` rejects with
  "not implemented", `transform()` returns `[]`, and no request leaves the process.
- An `INGEST_SOURCES=grantconnect` run logs `status: "skipped"` (0 fetched, 0 upserted) and writes
  `data_sources.status: "stub"`, `records_ingested: 0`, `errors: []`. It does not abort the rest of
  the run. A future wired adaptor whose token is missing is exercised as `error`/`degraded` with
  zero records (see `server/test/f4-grantconnect-blocked.test.ts`).
- `/api/v1/meta/coverage` keeps `grantconnect` in `federal_ingestion.pending`; `/api/v1/spending`
  can be filtered by `measure_type=grant_award` but returns an honest empty set (no grant rows).
- `/search` and `/data-sources` state that GrantConnect is blocked pending a usable adaptor and that
  no direct scraper is built. No grant provenance is claimed anywhere.

### Unblock conditions (for a future item)

Track A can only be implemented if **one** of these becomes true:

1. GrantConnect publishes a documented award API/feed with no paid third-party dependency (then map
   awards directly), **or**
2. the user explicitly approves a paid Apify plan/token (for example `APIFY_TOKEN` plus credits)
   **and** accepts that the available actor delivers funding _calls_ rather than award records, with
   a separately agreed `measure_type` and mapping.

Until then the backfill (separate p70 item) must not run GrantConnect and no grant rows are seeded.

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

For PBS, run `INGEST_SOURCES=data-gov-au-pbs` (no date window) and check:

```bash
mongosh 'mongodb://10.10.10.30:27017/ausspend_dev' --quiet --eval '
  db.measures.countDocuments({source_id:"data-gov-au-pbs"}),
  db.measures.distinct("natural_key", {source_id:"data-gov-au-pbs"}).length,
  db.measures.countDocuments({source_id:"synthetic-seed"}),
  db.measures.countDocuments({source_id:"aus-tender"})
'
```

Re-run the ingestion command and compare the counts: they should not grow except for genuinely new
`ocid`s in the same window, and PBS natural keys stay stable.

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

## Backup before a historical backfill

**Do not start a historical AusTender backfill until the user/approver explicitly confirms it.**
The current live baseline is 810 synthetic seed measures plus 861 AusTender contract measures. A
historical backfill would replace/expand that live data, so it is gated on a verified snapshot.

### Take and restore a verified backup

The backup/restore tools use the existing Mongo driver; they do not require `mongodump`.

```bash
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
npm run db:backup -- --prune 14
# [backup] wrote /home/steve/backups/ausspend/<ISO>
# [backup] natural_key count=<n> distinct=<n> checksum=<sha256>
```

- Writes every collection as Extended JSON to a timestamped directory outside the repository
  (default `/home/steve/backups/ausspend`).
- Refuses any database except `ausspend_dev`; `--scratch` additionally permits an explicit
  `ausspend_test_*` / `ausspend_restore_test_*` database for tests.
- The manifest records collection counts and indexes, `data_sources` statuses, and the
  `natural_key` count, distinct count and SHA-256 checksum.
- Never prints credentials. `--prune 14` deletes only old timestamped backup directories.

Restore to a scratch database by default:

```bash
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
  npm run db:restore -- /home/steve/backups/ausspend/<ISO> \
  --target ausspend_restore_test_<timestamp>
```

The restore verifies collection counts, `natural_key` uniqueness and checksum, and data-source
statuses, then prints the target database. A restore into `ausspend_dev` is only possible with
`--target ausspend_dev --confirm ausspend_dev`, a matching backup, and explicit user/approver
approval; it is never part of the test routine.

The round trip has been demonstrated on a scratch database: the restored copy had the same 810
synthetic rows, 861 AusTender contracts, 2,902 total measures and the same 2,092 distinct
`natural_key` values/checksum as `ausspend_dev`, while the source database was unchanged.

### Seed restart proof

The safe seed deletes only `source_id: synthetic-seed` measures. A scratch database was seeded,
given one fake `aus-tender` contract, and then re-seeded both locally and through the compose
`seed` service. Before/after were identical: 810 synthetic, 1 contract, 811 total, one row for the
fake `natural_key`, and no duplicate natural keys. A normal restart therefore preserves ingested
rows. The only destructive path remains the explicit `npm run seed -- --reset`.

### Gate a historical AusTender backfill

`npm run ingest:federal -- --backfill` requires all of:

1. `BACKFILL_CONFIRM=yes`;
2. `BACKUP_DIR` (or `--backup-dir`) pointing at a complete, recent backup of `ausspend_dev`
   (default maximum age 60 minutes: `BACKFILL_MAX_BACKUP_AGE_MINUTES`);
3. explicit `AUSTENDER_START_DATE` and `AUSTENDER_END_DATE` for a real run;
4. `INGEST_SOURCES` including `aus-tender`.

The gate refuses a missing, stale, corrupt or checksum-mismatched backup **before any fetch**, and
records the refused attempt in `ingestion_logs` (`status: skipped`, `records_fetched: 0`). A
successful gated run also records the verified backup path in `ingestion_logs.backup_path`.

Validate the gate without fetching data:

```bash
BACKFILL_CONFIRM=yes BACKUP_DIR=/home/steve/backups/ausspend/<ISO> \
  npm run ingest:federal -- --backfill --dry-run
```

The dry run validates the backup, logs `backfill gate passed (dry run); no fetch performed`, and
exits. The real historical backfill has **not** been run in this safety item; only the refusal and
a fake-backup success were tested.

### Daily backup timer

`scripts/systemd/ausspend-db-backup.service` and `.timer` run the backup daily at 03:15 with a
randomized delay, `Persistent=true`, journal logging and 14-backup retention. The installer creates
a self-contained runner snapshot under `~/.local/share/ausspend-backup` (including its own
`node_modules`) so the timer does not depend on the Docker stack or on host `/opt/ausspend`
dependencies. Re-run it after changing the backup script. Then check:

```bash
systemctl --user list-timers ausspend-db-backup.timer
systemctl --user status ausspend-db-backup.service
journalctl --user -u ausspend-db-backup.service -n 20
```

## Remaining caveats

- **PBS is not a federal total.** The CSV line items come from entity program tables and do not
  sum to the Budget Paper 1 total general government expense. The app shows the PBS sum only as a
  per-measure-type line-item total.
- **PBS units are `$'000`.** The raw CSV value is multiplied by 1,000 to dollars and 100 to cents.
- **PBS has no geography.** `location.state` is literally `"Commonwealth"`; COFOG is mapped only
  where the portfolio is defensible, otherwise the row is `provisional` with no function.
- **GrantConnect is blocked, not merely pending.** GrantConnect has no public award API/feed. The
  cited Track A Apify actor `australia-grantconnect-monitor` does not exist (HTTP 404) and the only
  public Apify alternative requires a paid token (`402` unauthenticated) and delivers funding calls,
  not awards. No direct scraper (Track B) was built; `grantconnect` stays a stub with zero records.
- **State/territory connectors are stubs.** NSW/VIC/QLD/WA remain uningested.
- **No human verification.** Both the synthetic seed and AusTender rows carry `verified: false`.
- **No cross-measure totals.** Contract and budget/actual/estimate rows are never summed together;
  the API groups by `measure_type` and returns `total_cents: null` for mixed responses.
- The public `tenders.gov.au` contract page may reject automated requests at the WAF; `source_url`
  is the canonical human-facing contract-notice URL, constructed from the contract id.
