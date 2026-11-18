# Trade module — ABS live, foundation UI

**Status:** ABS International Trade is live through the keyless ABS Data API Beta. The
`trade_records` model, read-only `/api/v1/trade` endpoints and separation guards remain separate from
spending. The `/trade` frontend route is still deferred.

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
2. **OECD ITIC** — the OECD International Trade in Goods and Services dataflow, useful for
   cross-country partner comparisons. The dataflow is reachable (HTTP 200); no connector is
   implemented yet.
3. **BITRE Waterline** — port-level Australian trade statistics, the best fit for
   `location.granularity: "port"` and port interface costs.
4. **DISR Resources and Energy Quarterly (REQ)** — quarterly resources and energy trade values,
   volumes and prices.
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

## Observed vs estimated (OECD)

OECD data can contain both observed values and estimates/forecasts. The model stores the published
quality in `data_quality_flag` (`observed`, `estimated`, `provisional` or `verified`). A later OECD
connector must preserve the published distinction rather than relabelling an estimate as observed.
The API returns the flag with every row and the summary keeps the separate measure groups; it does
not silently combine estimated and observed rows into a single "official" figure.

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

## Separation from spending

The separation is structural, not a filter on a shared collection:

- the trade model writes only to `trade_records`;
- the spending API queries only `measures`;
- no route joins the two collections;
- regression tests seed both collections and prove that neither API returns the other domain's rows.

The trade summary also proves that measure types are not summed, and that a port cost is never
presented as a national total.

## Ingest skeleton and cadence

`npm run ingest:trade` runs `scripts/ingest-trade.ts` in the fixed priority order above. Every
source is currently recorded in `data_sources` as a `stub` with its reason; the script exits non-zero
if any source is unimplemented. It never marks a planned source as active and never writes a trade
row.

The planned batch cadence is:

- ABS: monthly/quarterly releases, key-gated;
- OECD ITIC: per OECD release, preserving observed/estimated flags;
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
- Trade records are never mixed with `measures` / spending records.
- No live trade connector and no frontend route ship in this foundation item.
