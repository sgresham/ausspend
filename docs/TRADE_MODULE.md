# Trade module — foundation

**Status:** foundation only. There is no live trade connector and no frontend route in this item.
The `/trade` page lands after the ABS end-to-end ingest is working.

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

1. **ABS International Trade** — the official Australian trade statistics source. The ABS Indicator
   API is key-gated: the API root returns HTTP 403 `Missing Authentication Token` and no ABS key is
   present in the application environment. Live ingest is a later, key-gated step.
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
