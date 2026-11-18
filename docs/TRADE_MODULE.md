# Trade module — ABS live, foundation UI

**Status:** ABS International Trade is live through the keyless ABS Data API Beta, and OECD ITIC
CIF/FOB margins are live through the public OECD SDMX endpoint. The `trade_records` model, read-only
`/api/v1/trade` endpoints and separation guards remain separate from spending. The read-only
`/trade` frontend route is live for ABS trade values; OECD CIF/FOB and the deferred sources are not
surfaced there yet.

## Why a separate domain

Trade is not government spending. A trade value is the value of goods crossing a border, not
expenditure by an Australian government; a CIF/FOB margin is a border/transport cost, not a profit
margin; a port interface cost is a port-level cost, not a national total. The trade module therefore
uses its own `trade_records` collection and its own `/api/v1/trade` endpoints. It does not write to,
read from, join to, or reuse `measures` / spending records.

## No profit data

There is **no profit field** in the schema and no profit estimate anywhere in the API or ingest
skeleton. The only cost proxy is `cif_fob_margin`, a border-cost measure expressed by
`measure_type: "cif_fob_margin"` and optionally `margin_percent`. CIF/FOB is **not** profit: it
captures the difference between import values on a CIF and FOB basis (freight and insurance at the
border) and is labelled as a cost. No margin is invented from a missing published value.

## Sources and rationale

The ingest skeleton runs in this fixed priority order:

1. **ABS International Trade** — **live**. Uses the keyless Data API Beta at
   <https://data.api.abs.gov.au/rest/> (not the old `/rest/v1` base and not the key-gated Indicator
   API). Goods: `ITGS` 1.2.0 (`MEASURE=M1` current prices, `TSEST=10` original, `REGION=AUS`,
   `FREQ=M`), including total goods credits/debits (`DATA_ITEM` 1000/2000) and every printed
   commodity category. Services: `TRADE_SERV_CNTRY_FY` 1.0.0 (`EBOPS=TOTAL`, `COUNTRY=TOT`,
   `FREQ=A`), total credits/debits by financial year. Both carry `UNIT_MEASURE=AUD` and
   `UNIT_MULT=6` (millions), converted to integer cents. No `x-api-key` header is sent.
2. **OECD ITIC** — **live**. The OECD International Transport and Insurance Costs dataflow
   (`OECD.SDD.TPS, DSD_ITIC@DF_ITIC`, 1.1) on the public SDMX endpoint
   <https://sdmx.oecd.org/sti-public/rest>. Australia is the reference/importer, `COUNTERPART_AREA`
   is the exporter, `MEASURE=C_F`, `PRODUCT_TYPE=C` and `UNIT_MEASURE=PT_IM_CIF` (percentage of CIF
   import value). It provides partner-total and HS 2017 4-digit product margins, preserving the
   published `OBS_STATUS` and `METHODOLOGY_TYPE`.
3. **BITRE Waterline** — **discovery only; deferred**. The source packet
   ([`docs/source-discovery/bitre-waterline.md`](source-discovery/bitre-waterline.md)) finds
   accessible five-container-port throughput, performance and indicative port-interface-cost data
   under CC BY 4.0, but no trade values, CIF/FOB margins or national port total. A `trade_records`
   builder needs a schema/unit review first; no connector is implemented.
4. **DISR Resources and Energy Quarterly (REQ)** — **discovery only; deferred**. The source packet
   ([`docs/source-discovery/disr-req.md`](source-discovery/disr-req.md)) finds accessible quarterly
   FOB export values and import values (1990Q1–2026Q2) under CC BY 4.0, but the historical tables
   are ABS-derived, contain totals and forecasts, and would double-count with ABS in the current
   trade API. A bounded REQ commodity-aggregate builder needs a source/overlap guard, aggregation
   role, forecast flag and unit fields first; no connector is implemented.
5. **ABARES** — agricultural commodity trade values and volumes.

Each source keeps its own `source_dataset`, `source_url`, `source_date` and `data_quality_flag`.
Rows from different sources are never mixed into one total.

## ABS live ingestion

- Goods are monthly, financial year derived from the ABS July–June year (`2024-07` → `2024-25`).
- Services `TIME_PERIOD` is the start year of the ABS financial year (`2024` → `2024-25`, with the
  dataflow's `REPORTING_YEAR_START_DAY` `--07-01`).
- The connector ingests 12 months of goods observations (`2024-07` to `2025-06`) and the services
  `2024` financial year, satisfying the one-full-financial-year requirement.
- It never derives a goods+services total: goods and services rows remain separate `trade_value`
  observations, and commodity categories are the source's own `DATA_ITEM` hierarchy (parents and
  children are not summed by the connector).
- Ingestion is idempotent: each observation is upserted by its published dimensions
  (`source_dataset`, flow, measure, `commodity_code`, `time_period`, `financial_year`, location).
- No profit field exists. A CIF/FOB margin remains the only cost proxy.

## OECD ITIC live ingestion

The `server/src/connectors/trade/oecd-itic` connector queries the public OECD SDMX endpoint with no
key or secret. It ingests, one year at a time:

- **per-partner totals** for 2019–2022 (`COUNTERPART_AREA` across all partners,
  `COMM_HS2017=_T`), and
- **Australia–World HS 2017 4-digit product margins** for 2019 and 2022 (`COUNTERPART_AREA=W`,
  every `COMM_HS2017` product), which supplies the HS codes and the sanity diagnostic.

Every row is `trade_flow: "import"` (the reference area is the importer), `measure_type:
"cif_fob_margin"` and `margin_percent`; `amount_cents` is `0` because a margin is a percentage, not
a dollar amount. `financial_year` is the calendar year (`2019`, not `2019-20`) because ITIC is an
annual calendar-year dataset; `time_period` carries the same year. Product rows carry the 4-digit HS
code (`HS17_0101` → `0101`); partner totals have no commodity code and use the commodity name
`Total - all products`.

Raw SDMX-JSON responses are fetched once per request and SHA-256 archived **outside the repo** under
`~/ausspend-source-archive/oecd-itic/` before any row is written. Ingestion is idempotent per
published dimension (source, flow, measure, commodity, partner, year, location granularity). If the
public endpoint rate-limits (HTTP 429), `--from-archive` replays those exact archived responses
through the same parser and upsert keys, so a replay cannot change a row or touch another source.

### Sanity flag (2019 ≈ 3.5%, 2022 ≈ 6.4%)

ITIC publishes margins per partner and per HS 4-digit product; it does **not** publish an
all-product World total, and the dataflow carries no trade values. The requested headline is a
CIF-import-value-weighted aggregate, so it cannot be reproduced from ITIC alone. The connector
therefore computes an explicit, reproducible **unweighted mean over the Australia–World HS4 product
margins** and records whether it is within 0.25 percentage points of the headline. A mismatch is
**flagged in the source notes and in the ingest log, and no published value is adjusted**; no
invented weights are applied. This is deliberate: the raw margin rows remain exactly as published.

## Observed vs estimated (OECD)

OECD data contains both reported and estimated values. The connector derives `data_quality_flag`
from `OBS_STATUS` and `METHODOLOGY_TYPE`:

- `OBS_STATUS=I` (imputed) → `estimated`, regardless of methodology;
- `METHODOLOGY_TYPE=ME` (model-based estimation), `IE` (interpolation/extrapolation) or `DE`
  (derivation) → `estimated`;
- `METHODOLOGY_TYPE=AD` (adjustment) → `provisional`;
- `METHODOLOGY_TYPE=AG` (aggregation) with a normal observation status → `observed`.

A modelled, derived, interpolated or adjusted row is never relabelled `observed`, `verified` or
`audited`. The API returns the flag with every row and the summary keeps the separate measure
groups; it does not silently combine estimated and observed rows into a single "official" figure.
The current 2019–2022 Australia extract is labelled `estimated` where the source marks the
observation imputed/aggregated.

## Unit detection (BITRE, DISR, ABARES)

The later connectors must detect the printed unit per table before accepting any number:

- dollar values: whole dollars, `$'000`, `$m` and `$b` are not interchangeable;
- volumes: tonnes/kilotonnes/ML etc. are not dollars;
- prices/index values: separate scalar fields (`price`, `index_value`), never converted to
  `amount_cents`;
- a missing or conflicting unit rejects the table rather than defaulting to dollars.

`amount_cents` is an integer number of cents and is reserved for monetary measures. Volumes, prices
and index values are stored in their own fields and are never summed with monetary measures.

## Model

`server/src/models/trade-record.ts` defines the `trade_records` Mongoose collection:

- `trade_flow`: `import` | `export`
- `measure_type`: `trade_value` | `cif_fob_margin` | `port_interface_cost` | `trade_volume` |
  `trade_price`
- `commodity_name`, `commodity_code` (HS where available)
- `partner_country`, `port_name`
- `jurisdiction_level`: `federal`
- `location`: `{ state, port, granularity: national | port }`
- `amount_cents`, `margin_percent`, `index_value`, `volume`, `price`
- `financial_year`, `time_period`
- `source_dataset`, `source_url`, `source_date`
- `data_quality_flag`: `verified` | `provisional` | `estimated` | `observed`
- `created_at` / `updated_at`

Indexes cover `trade_flow`, `measure_type`, `commodity_name`, `partner_country`,
`financial_year`, `location.state` and `location.port`.

## API

All routes are mounted under both `/api` and `/api/v1`; the versioned contract is
`/api/v1/trade`.

- `GET /api/v1/trade` — filters `trade_flow`, `measure_type`, `commodity`, `partner_country`,
  `port`, `financial_year`; returns rows plus a summary grouped by `measure_type`.
- `GET /api/v1/trade/summary` — grouped by `measure_type` and `trade_flow`; returns
  `additive: false` and an explicit non-additivity warning.
- `GET /api/v1/trade/commodities` — distinct commodity names/codes with counts.
- `GET /api/v1/trade/partners` — distinct partner countries with counts.

Empty state is a valid `200` with empty arrays and zero counts. No endpoint computes a grand total
across measure types. The API reads only `TradeRecordModel`; it never queries `MeasureModel` or any
spending collection.

## Frontend (`/trade`)

The `/trade` page is a read-only ABS view and a top-level nav item. It consumes
`GET /api/trade` with `measure_type=trade_value` and one `trade_flow` at a time, so the OECD
CIF/FOB rows are not mixed into the ABS view. Filters are flow, financial year and commodity/service
label. Rows keep their own published period, unit and `data_quality_flag`; the table renders at most
20 rows per page and the page never computes or displays a combined trade total, a spending total or
a profit figure. The warning copy states that trade value is not spending and not profit, and that
trade measures and commodity parent/child rows are non-additive. Any CIF/FOB figure is labelled a
border cost, not a margin. Empty, loading and API-error states are explicit.

## Separation from spending

The separation is structural, not a filter on a shared collection:

- the trade model writes only to `trade_records`;
- the spending API queries only `measures`;
- no route joins the two collections;
- regression tests seed both collections and prove that neither API returns the other domain's rows.

The trade summary also proves that measure types are not summed, and that a port cost is never
presented as a national total.

## Ingest skeleton and cadence

`npm run ingest:trade` runs `scripts/ingest-trade.ts` in the fixed priority order above. ABS and
OECD ITIC are implemented; the remaining sources are recorded in `data_sources` as `stub` with their
reason. Use `--source=<id>` to run one source only, for example
`npx tsx scripts/ingest-trade.ts --source=oecd-itic`; this neither fetches nor rewrites any other
source.

The batch cadence is:

- ABS: monthly/quarterly releases, keyless Data API Beta;
- OECD ITIC: per OECD release, preserving observed/estimated flags and calendar years;
- BITRE Waterline: per quarterly/annual release, port-level;
- DISR REQ: quarterly;
- ABARES: per quarterly/seasonal release.

Each batch runs through its own source connector and upserts by the published dimensions. No batch
is allowed to create a cross-source or cross-measure total.

## Explicit limitations

- No profit data, no profit estimate and no invented margin.
- CIF/FOB is a border cost, not profit.
- Trade values, CIF/FOB margins, port interface costs, trade volumes and trade prices are different
  measures and are not additive.
- Port costs are not national totals.
- BITRE Waterline is discovery-only and deferred: it covers five container ports and publishes
  volumes and indicative port interface costs, not trade values or CIF/FOB margins.
- DISR REQ is discovery-only and deferred: its historical trade values are ABS-derived and not
  additive with ABS, and its forecast workbook is not an actuals source.
- OECD ITIC margins are calendar-year percentages, not Australian financial-year dollars, and no
  margin is summed into a national total.
- OECD modelled, derived, interpolated and adjusted observations are never relabelled observed.
- The 2019 ≈ 3.5% / 2022 ≈ 6.4% headline is a CIF-import-value-weighted aggregate that ITIC does not
  publish; the connector records an unweighted diagnostic and flags a mismatch without adjusting a
  published value.
- Trade records are never mixed with `measures` / spending records.
- The `/trade` frontend route remains deferred.
