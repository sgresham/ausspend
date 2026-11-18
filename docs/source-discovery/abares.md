# ABARES agricultural commodity trade — source discovery

- source id proposed: `abares`
- publisher: **Australian Bureau of Agricultural and Resource Economics and Sciences (ABARES)**, Department of Agriculture, Fisheries and Forestry (DAFF)
- jurisdiction: federal
- generated: 2026-11-18
- packet: [`abares.json`](abares.json)
- archive root: `/home/steve/ausspend-source-archive/abares` (outside the repo)
- checksums: `/home/steve/ausspend-source-archive/abares/SHA256SUMS` (9/9 downloaded files re-hashed)
- status: **discovery only** — no connector, no database write, no `trade_records` rows.

## 1. Premise falsifier

**Result: PARTIAL / CONDITIONAL — DEFER a trade builder under the current schema.**

ABARES does publish accessible agricultural trade **values**, and some commodity tables publish export **volumes** and **unit values**, under CC BY 4.0. But the usable series are not a clean, independent, additive agricultural trade dataset:

- the AFF export/import reference tables are **ABS-derived** (ABS International Trade in Goods, cat. no. 5368.0) and are **not additive with ABS**;
- the AFF reference tables carry **values only**; their volume columns are `-` / `Not Recorded`;
- the Agricultural Commodities statistical tables carry **chain-volume and price indices**, not absolute volumes, and label **2024-25 `s` (estimate), 2025-26 `f` (forecast) and 2026-27 `f` (forecast)**;
- the Agricultural Commodity Statistics chapters carry long, commodity-specific **volumes, unit values and destination values**, but mix **fiscal year, October–September marketing year and calendar year**, mix ABS/ABARES/FAO/USDA sources, and include ABARES estimates (for example `s. ABARES estimate 2025`);
- ABS confidentiality suppression means ABARES totals can **understate** the true value, and ABARES creates unofficial sugar/rice estimates.

The record-level premise is therefore only true for a **bounded, source-scoped actual-value series** (AFF FY values, no volumes, no forecasts, explicit ABS overlap guard). The broad premise — a defensible long agricultural trade value **and volume** series that can be mapped cleanly into `trade_records` — is **not** met. Recommendation: **defer**.

## 2. Official sources and access

| item                                      | URL                                                                                               | HTTP | notes                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ---: | ------------------------------------------------------------------------------------------------ |
| ABARES data landing                       | <https://www.agriculture.gov.au/abares/data>                                                      |  200 | lists agricultural forecasting/trade data and the AFF trade dashboard                            |
| Commodities and trade data                | <https://www.agriculture.gov.au/abares/research-topics/agricultural-outlook/data>                 |  200 | Agricultural Commodities XLSX (statistical + outlook) and Agricultural Commodity Statistics XLSX |
| AFF trade reference tables                | <https://www.agriculture.gov.au/biosecurity-trade/market-access-trade/trade-tips>                 |  200 | eight Excel summaries: AFF exports/imports, by partner/commodity, FY/CY                          |
| Trade dashboard                           | <https://www.agriculture.gov.au/abares/research-topics/trade/dashboard>                           |  200 | interactive only; no bulk download or API found                                                  |
| Definitions                               | <https://www.agriculture.gov.au/abares/research-topics/agricultural-outlook/definitions>          |  200 | FOB/customs-value definitions, ABARES classification, confidentiality treatment                  |
| Historical agricultural forecast database | <https://www.agriculture.gov.au/abares/research-topics/agricultural-outlook/historical-forecasts> |  200 | first release 2000–2019; last updated 22 February 2023; no settled update schedule               |
| Copyright / licence                       | <https://www.agriculture.gov.au/about/copyright>                                                  |  200 | CC BY 4.0 unless otherwise stated; third-party exclusions                                        |
| Agricultural Commodities Report (latest)  | <https://www.agriculture.gov.au/abares/research-topics/agricultural-outlook/september-2026>       |  200 | September 2026 report page                                                                       |

- **No login** is required for any source above.
- **No API** was found. The usable formats are XLSX; the report series also publishes PDF. The trade dashboard is interactive only.
- The AFF page and the commodities/trade data page returned HTTP 200 to a normal browser-like request on 2026-11-18.

## 3. Cadence and coverage

| product                                              | cadence                             | latest observed                                               | coverage                                                                                | actual/estimate/forecast                                                            |
| ---------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AFF export/import reference tables                   | monthly, following ABS monthly ITGS | files retrieved 9–11 November 2026, latest month **Sep-2026** | **FY2021-22–2025-26** complete + **2026-27 incomplete** (Jul–Sep); CY equivalents exist | ABS-published actuals; current FY marked incomplete                                 |
| Agricultural Commodities Report — statistical tables | quarterly                           | September Quarter 2026                                        | **FY1994-95–2026-27**                                                                   | actual to **2023-24**; **2024-25 `s` (estimate)**; **2025-26 `f`**; **2026-27 `f`** |
| Agricultural Commodities Report — outlook tables     | quarterly                           | September Quarter 2026                                        | **2024-25 `s`, 2025-26 `s`, 2026-27 `f`** (most commodity tables)                       | estimates and forecasts, not actuals                                                |
| Agricultural Commodity Statistics                    | annual                              | **2024-25**, released 30 April 2026                           | commodity chapters mostly from the 1970s to 2024-25                                     | mixed actuals and ABARES estimates; marketing-year dependent                        |
| Historical agricultural forecast database            | irregular; not settled              | last updated 22 February 2023                                 | first release 2000–2019                                                                 | forecasts plus observed outcomes, for forecast-accuracy analysis only               |

The **only** actual agricultural trade values with a current, machine-readable FY series are the AFF reference tables. Their complete FYs are 2021-22 to 2025-26; 2026-27 is partial. They do not carry volumes.

## 4. What ABARES publishes

### 4.1 AFF export/import reference tables (actual values, ABS-derived)

- Exports and imports by **partner** and by **commodity (TopN)**, for both **financial year** and **calendar year**.
- Units: `AUD million` for totals and most commodities; `AUD thousand` in some small-value commodity sheets. The unit is printed per sheet in column `Value Unit`; it is not a global unit.
- Valuation basis (from the ABARES definitions page):
  - **Australian merchandise exports are valued FOB** at the Australian port of export; freight, insurance and other distributive services beyond the customs border are excluded.
  - **Australian merchandise imports are valued on a customs value for duty basis**, identical to FOB; freight and insurance to the Australian port of destination are excluded.
- Volume columns exist but are **not populated** (`-` / `Not Recorded`) in all four FY workbooks inspected. Volume is not available from this product.
- Commodity grouping is ABARES' own **AFF trade classification**, based on **AHECC 8-digit** codes; the Reference sheet maps each `Commodity (TopN)` to AHECC codes. It is not HS at the row level.
- Partner values include special buckets such as `EU` (EU as one), `Other`, `No Country Details` and `Australia (Re-Imports)`. These are published categories, not ISO country codes.

Exact observations from the archived workbooks (AUD million, FY):

| sheet                             |         2021-22 |         2022-23 |         2023-24 |         2024-25 |         2025-26 | 2026-27 (incomplete) |
| --------------------------------- | --------------: | --------------: | --------------: | --------------: | --------------: | -------------------: |
| AFF exports, Total (by partner)   |   68,960.487345 |   80,395.836073 |   72,550.209334 |   78,097.181523 |   83,042.913304 |        20,096.603721 |
| AFF imports, Total (by partner)   | 30,621.69101093 | 34,287.36129599 | 33,777.45397314 | 37,393.57319252 | 37,952.29521814 |       9,496.31287156 |
| AFF exports, Total (by commodity) |   68,960.487345 |   80,395.836073 |   72,550.209334 |   78,097.181523 |   83,042.913304 |        20,096.603721 |

The export-by-partner and export-by-commodity totals agree exactly; the imports workbook is a separate flow.

### 4.2 Agricultural Commodities Report — statistical tables

- Table 4, **Agricultural exports: value, volume and price indicators, Australia**, runs **1994-95 to 2026-27**.
- Nominal value is `$m`.
- Volume and price are **chain-volume and price indices** (`index`), base **2025-26 = 100**; they are not tonnes, litres or dollars per tonne.
- The last three columns are explicitly labelled **`2024-25 s`**, **`2025-26 f`** and **`2026-27 f`**.
- Exact anchors:

| series                                         |   2023-24 |  2024-25 s |  2025-26 f |  2026-27 f |
| ---------------------------------------------- | --------: | ---------: | ---------: | ---------: |
| Total agricultural exports, nominal value `$m` | 71,576.86 | 75,832.795 | 80,608.893 | 76,257.693 |
| Total agricultural exports, volume index       |    92.025 |     95.683 |        100 |      94.75 |
| Total agricultural exports, price index        |    96.491 |     98.319 |        100 |     99.844 |

The AFF 2024-25 total (78,097.181523) and Table 4's 2024-25 estimate (75,832.795) are **not the same measure**: AFF includes agriculture, fisheries and forestry; Table 4 is agricultural exports and is an estimate. They must never be added or treated as revisions of one another.

### 4.3 Agricultural Commodity Statistics (historical commodity chapters)

- Annual publication; the 2024-25 edition has separate XLSX chapters (wheat, dairy, coarse grains, cotton, fisheries, forestry, horticulture, meat, oilseeds, pulses, rice, sugar, wool, wine, farm inputs, etc.).
- Each chapter has a machine-readable header block: `Table`, `Activity`, `Commodity`, `Reporter`, `Location`, `Measure`, `Unit`, `Frequency`, `Notes`, `Identifier`.
- Example — wheat (chapter 21):
  - exports (including re-exports) **quantity** in `kt`, frequency **Oct-Sep Year**;
  - export **unit value** in `$/t`, frequency **Oct-Sep Year**;
  - production, area, yield and gross unit value on **Fiscal Year**;
  - markets/destinations and world balance sheets in separate tables.
- Example — dairy (chapter 6):
  - export **unit value** in `$/t` for butter/cheese;
  - export **value** in `$m` by destination (China, Hong Kong, Japan, Korea, Malaysia, New Zealand, Philippines, Singapore, …), frequency **Fiscal Year**;
  - world production/consumption/trade in `kt`/`Mt`, frequency **Calendar Year**.
- Sources are mixed (ABARES, ABS, FAO, USDA, industry bodies), and notes include `s. ABARES estimate 2025`. Rows are therefore not uniformly official observed statistics.
- The commodity and period dimensions vary by chapter: fiscal year, October–September marketing year and calendar year all appear. A single national “agricultural exports” row is not published here.

### 4.4 Outlook and forecast products

- The Agricultural Commodities **outlook tables** give forecasts for value (`A$m`), volume (`kt`, `ML`, `Mt`, etc.) and price (`$/t`, `US$/t`, indices) for 2024-25 `s`, 2025-26 `s` and 2026-27 `f`.
- The labels are `s` = estimate, `f` = forecast. They are **not actuals** and must never be stored as `verified`/`observed` actual outcomes.
- The historical forecast database (2000–2019 first release) is explicitly a forecast-accuracy resource; it includes observed outcomes alongside vintage forecasts and is not an actuals series.

## 5. Overlap with existing sources

| other source                                                | overlap                                                                                                                                                            | consequence                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **ABS International Trade in Goods (ITGS, 5368.0)**         | AFF reference tables are compiled **from ABS ITGS**; Table 4 agricultural values and commodity-statistics trade values are also ABS-derived                        | **Not additive with ABS.** Loading both without a source-overlap guard would double-count.             |
| **DISR Resources and Energy Quarterly (REQ)**               | REQ historical trade tables are also **ABS-derived**; REQ covers resource/energy commodities, not agriculture                                                      | Not additive with ABARES or ABS; different commodity scope.                                            |
| **OECD ITIC**                                               | OECD publishes **CIF/FOB margins**, not trade values; ABARES publishes values and (some) volumes                                                                   | Different measure; never sum a margin with a value.                                                    |
| **AFF vs Agricultural Commodities vs Commodity Statistics** | AFF includes agriculture, fisheries and forestry; Table 4 is agriculture-only; Commodity Statistics chapters are commodity-specific and often marketing-year based | Not additive across ABARES products. Totals and components within a product must not be summed either. |
| **World data inside Commodity Statistics**                  | World production/consumption/trade from FAO/USDA/other sources                                                                                                     | Not Australian trade; never mix into an Australian total.                                              |

Additional overlap caveats:

- **Confidentiality suppression:** ABS suppresses some commodity detail. ABARES states that published agricultural trade estimates can therefore **underestimate** the true value; for sugar and rice ABARES creates its own **unofficial** volume/value estimates. These must not be labelled official ABS statistics.
- **Vintage:** AFF tables are current ABS vintages; Table 4/outlook tables are ABARES estimates/forecasts prepared at a particular release. Comparing an AFF actual with an ABARES forecast is not a revision comparison.

## 6. Licence and attribution (verbatim)

From <https://www.agriculture.gov.au/about/copyright>:

> Material on this website is copyright Department of Agriculture, Fisheries and Forestry except as otherwise stated.
>
> Unless otherwise specified, you can use our material under a Creative Commons Attribution (CC-BY) 4.0 International licence.

Excluded from that licence: the Commonwealth Coat of Arms, the Department logo, and content specified as third-party copyright or other licence terms.

Required attribution:

> Department of Agriculture, Fisheries and Forestry. 2026. _[Insert name of publication and include website link]_.
>
> © Department of Agriculture, Fisheries and Forestry 2026

Third-party material: charts, photographs, maps and some tables may carry separate rights; the copyright page says third-party rights remain with their owner. A builder must not relicense third-party content.

## 7. Archive

All files were downloaded on 2026-11-18 to `/home/steve/ausspend-source-archive/abares` (outside the repo). Exact byte lengths and SHA-256:

| file                                                              |     bytes | SHA-256                                                            |
| ----------------------------------------------------------------- | --------: | ------------------------------------------------------------------ |
| `aff-exports-by-partner-fy-jan-2021-to-sep-2026.xlsx`             |   818,552 | `025bb4241804ddb137f617128655a76756e543105e8abcf853bbe18a9ebe8908` |
| `aff-exports-by-commodity-topn-fy-jan-2021-to-sep-2026.xlsx`      | 1,727,543 | `29c33ac080425c96dea11ea5516afc2bd1d8525d8d6132a0310d8b7ff53deb6c` |
| `aff-imports-by-partner-fy-jan-2021-to-sep-2026.xlsx`             |   848,800 | `a6b119087fa1f85402f53f57f136e608c46d9bbb91276aa6adb7e5dbc13e4d08` |
| `aff-imports-by-commodity-topn-fy-jan-2021-to-sep-2026.xlsx`      | 1,642,580 | `0f347a0dd72ce554da46da0ae3161fe8220fc782e2f811d123f62a0995f2a795` |
| `agricultural-commodities-september-2026-statistical-tables.xlsx` |   508,825 | `971ab4702970b1297981880374a6ef73993fb2552ea194dfe84c575b7e1cf4f3` |
| `agricultural-commodities-september-2026-outlook-tables.xlsx`     |   219,979 | `2a7872eb91ae59efb916caf73b9bec6404c0df1ca4ba799f3454d012fe6feef4` |
| `agricultural-commodity-statistics-2024-25-wheat.xlsx`            |   131,381 | `c00da1f1a7a246a6aeed75885858b804a0625ee2c3b15319c22b435ba6f0c995` |
| `agricultural-commodity-statistics-2024-25-dairy.xlsx`            |   236,508 | `928af28734b9c69275c2b8bf4660fc0348f10fd4f031c5bac02c67064609d790` |
| `agricultural-commodity-statistics-2024-25-farm-sector.xlsx`      |   257,181 | `b696ddca9001811ea505e0b71f878baa09d6ab5269abda85c2848c3c4d509163` |

The calendar-year AFF export/import workbooks (four further files) exist on the same page and were not archived; they are not needed to establish the FY mapping.

## 8. Mapping proposal for `trade_records`

### 8.1 Bounded AFF actual-value phase (the only defensible first slice)

| trade_records field                 | proposed value / treatment                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `source_dataset`                    | e.g. `ABARES AFF exports by partner (FY)` / `ABARES AFF imports by commodity (FY)`                                                   |
| `source_id`                         | `abares` (new source; do not reuse `abs-trade`)                                                                                      |
| `trade_flow`                        | `export` or `import` from the workbook                                                                                               |
| `measure_type`                      | `trade_value`                                                                                                                        |
| `commodity_name` / `commodity_code` | AFF `Commodity (TopN)`; keep the AHECC reference in notes or a new `commodity_classification` field; do not invent HS codes          |
| `partner_country`                   | AFF partner label exactly, including `EU`, `Other`, `No Country Details`, `Australia (Re-Imports)`; no ISO conversion without review |
| `financial_year`                    | AFF FY column (`2021-22` … `2026-27`); mark the partial year                                                                         |
| `time_period`                       | the FY label                                                                                                                         |
| `amount_cents`                      | value × unit multiplier (`AUD million` = ×100,000,000 cents; `AUD thousand` = ×100,000 cents)                                        |
| `volume`, `price`                   | **null**; AFF does not publish populated volumes or prices                                                                           |
| `location`                          | national/Australia only; no state/port                                                                                               |
| `data_quality_flag`                 | `observed` for complete ABS-published FYs; `provisional` for the incomplete FY                                                       |
| provenance                          | official landing URL, exact archive path and SHA-256, retrieval date, source row/sheet                                               |

Do **not** load both the partner and commodity sheets as if they were independent observations; they are alternative breakdowns of the same flow. Store one breakdown per `source_dataset`.

### 8.2 Commodity-statistics phase (later, only if the schema is extended)

| concept           | proposed treatment                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `measure_type`    | `trade_volume` for export quantity; `trade_price` for unit value; `trade_value` for destination values                         |
| commodity         | commodity chapter (wheat, dairy, …) and ABARES identifier (`AG…` / `AB…`)                                                      |
| period            | preserve the printed **frequency** and **marketing year**; do not silently convert Oct–Sep to FY                               |
| units             | print and store the unit (`kt`, `ML`, `Mt`, `$/t`, `$m`) in new unit fields                                                    |
| data_quality_flag | `observed` only where the note is an ABS/ABARES actual; `estimated` where the note is `s. ABARES estimate …`; never `verified` |
| totals/components | commodity subtotals and destination rows are separate; never sum them with AFF or with each other                              |

## 9. Schema blockers

The current `trade_records` schema cannot safely represent this source without changes:

1. **No volume/price units.** `volume` and `price` exist but there is no `volume_unit`, `price_unit` or `unit_multiplier`; kt, ML, Mt, `$/t`, `US$/t` and indices would be ambiguous.
2. **No period basis.** `financial_year` cannot represent an October–September marketing year or a calendar year without loss; a `period_basis` / `marketing_year` field is needed.
3. **No forecast/estimate vintage.** `data_quality_flag` has `estimated`, but there is no `forecast_vintage`, `release_id` or `estimate_status` (`s`/`f`/`z`). A forecast must be distinguishable from an actual and from a later revised estimate.
4. **No source-overlap/additivity guard.** The API would happily sum ABARES rows with `abs-trade` or another ABS-derived source. A per-source `additive_with` / `overlap_group` or an explicit `aggregation_role` is needed.
5. **No classification system field.** AFF uses an ABARES/AHECC TopN grouping; Commodity Statistics use ABARES commodity chapters/identifiers. `commodity_code` alone cannot say which system a code belongs to.
6. **Partner codes are not ISO.** `EU as one`, `Other`, `No Country Details` and re-import buckets are not countries; storing them in `partner_country` without a `partner_type`/`partner_code` field will corrupt country grouping.
7. **Totals vs components.** AFF publishes a Total sheet plus per-partner and per-commodity sheets; Table 4 publishes category rows plus totals; Commodity Statistics publishes subtotals. The current API has no explicit “this row is a total / component / index” marker.
8. **Confidentiality and unofficial estimates.** The source can undercount due to ABS suppression, and ABARES sugar/rice estimates are unofficial. A note field alone is not enough to stop a downstream sum treating them as official actuals.

## 10. Recommendation

**DEFER the ABARES `trade_records` builder.** No connector and no rows in this item.

If a future item is scoped, the bounded sequence should be:

1. **Phase A — AFF actual values only.** One source dataset at a time (exports by partner **or** by commodity; imports separately), FY 2021-22–2025-26 complete plus the partial 2026-27 flagged `provisional`. `measure_type=trade_value`, `data_quality_flag=observed`/`provisional`, no volumes, no forecasts. Add the source-overlap guard first.
2. **Phase B — commodity volumes/unit values.** Only after adding `volume_unit`, `price_unit`, `period_basis`/marketing-year and `classification_system`; one commodity chapter at a time; keep ABARES estimates `estimated`; never derive a national total.
3. **Forecasts — separate product, never actuals.** Outlook tables and the historical forecast database may be ingested only with a vintage/forecast flag and must never be mixed with AFF actuals.

**Do not** ingest the Agricultural Commodities statistical Table 4 index rows as `trade_volume` or `trade_price`; they are indices, not quantities or dollar prices. **Do not** treat the AFF Total sheet and the partner/commodity sheets as additive. **Do not** add ABARES to ABS, DISR REQ or any other source without an explicit overlap decision.

## 11. Premise falsifier (restated)

ABARES publishes accessible agricultural trade values and some commodity volumes/unit values under CC BY 4.0. **However**, the usable value series is ABS-derived and non-additive with ABS; the AFF volumes are empty; the statistical volume/price series are indices with estimates/forecasts; the long commodity series mix marketing years, sources and ABARES estimates; and ABS suppression/ABARES unofficial estimates break a clean “official actual” series. The broad premise is therefore **not** satisfied. The packet records the gap and recommends **deferral**, not an invented series.
