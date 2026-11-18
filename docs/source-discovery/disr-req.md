# DISR Resources and Energy Quarterly — source discovery

- source: **DISR Resources and Energy Quarterly (REQ)** (`disr-req`), Office of the Chief Economist
- jurisdiction: federal
- generated: 2026-11-18
- packet: [`disr-req.json`](disr-req.json)
- archive root: `/home/steve/ausspend-source-archive/disr-req` (outside the repo)
- checksums: `/home/steve/ausspend-source-archive/disr-req/SHA256SUMS` (6/6 re-hashed and matched)
- status: **discovery only** — no connector, no database write, no `trade_records` rows.

## 1. Premise falsifier

**Result: TRUE for historical quarterly trade values, with overlap and schema caveats.**

REQ publishes accessible **quarterly FOB export values** and **import values** by REQ commodity for **1990Q1–2026Q2**, under **CC BY 4.0**, with a clear period/commodity structure. That is a defensible trade-value series.

It is **not** a clean independent value source:

- the historical trade tables are **ABS-derived** (ABS International Trade in Goods and Services, Cat. No. 5368.0) and are not additive with ABS;
- the tables mix **published totals with commodity components**;
- the forecast workbook is **forecasts/estimates/projections**, not actuals;
- the commodity groups are **REQ-specific**, not HS/ANZSIC;
- the **import valuation basis is not stated**;
- the current trade API would sum REQ `trade_value` rows with ABS `trade_value` rows, causing double-counting.

**Recommendation: DEFER a trade-value builder in the current schema.** A bounded builder becomes defensible only after the source/overlap guard, aggregation role, forecast flag and unit fields exist (see §10).

## 2. Official sources and access

| item            | URL                                                                                                                          |           HTTP | notes                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------: | -------------------------------------------------------------- |
| series landing  | <https://www.industry.gov.au/publications/resources-and-energy-quarterly>                                                    |            200 | official REQ series page; lists quarterly issues               |
| old stub URL    | <https://www.industry.gov.au/data-and-publications/resources-and-energy-quarterly>                                           | redirect → 200 | redirects to the live series landing page                      |
| latest release  | <https://www.industry.gov.au/publications/resources-and-energy-quarterly-september-2026>                                     |            200 | September 2026 release page; **date published 2 October 2026** |
| prior release   | <https://www.industry.gov.au/publications/resources-and-energy-quarterly-june-2026>                                          |            200 | June 2026 release; **date published 3 July 2026**              |
| PDF             | <https://www.industry.gov.au/sites/default/files/2026-10/resources-and-energy-quarterly-september-2026.pdf>                  |            200 | 147 pages, 5,739,545 bytes                                     |
| forecast XLSX   | <https://www.industry.gov.au/sites/default/files/2026-10/resources-and-energy-quarterly-september-2026-forecast-data.xlsx>   |            200 | 24 sheets, 849,083 bytes                                       |
| historical XLSX | <https://www.industry.gov.au/sites/default/files/2026-10/resources-and-energy-quarterly-september-2026-historical-data.xlsx> |            200 | 48 sheets, 3,426,384 bytes                                     |

- **No login** is required; the release page exposes direct PDF/XLSX downloads only.
- **No API/JSON endpoint** was found; there is no CSV alternative.
- The old stub URL redirects to the live series page.

## 3. Release, cadence and coverage

- **Latest release:** September 2026, published **2 October 2026**; data and developments to **20 September 2026**.
- **Prior release:** June 2026, published **3 July 2026**.
- **Cadence:** quarterly (March, June, September, December), not a live feed.
- **Report metadata:** 147 pages, 213 tables detected, **Vol. 15, no. 3**, **ISSN 1839-5007**, © Commonwealth of Australia 2026.
- **XLSX metadata caveat:** the forecast XLSX About sheet says “Vol. 13, no 2” and the historical XLSX About sheet says “Vol. 13, no 3”. The PDF front matter (Vol. 15, no. 3) and the release page are authoritative; this looks like an XLSX metadata defect, not a different release.

Coverage in the historical workbook:

- **quarterly** Tables 16–19: **1990Q1–2026Q2** (146 quarters; latest quarter preliminary);
- **annual** Tables 1–4: **1989–90–2025–26** (37 financial years);
- Table 21/22: monthly export unit values and benchmark prices.

Coverage in the forecast workbook:

- **Dec-25–Dec-31** quarterly columns;
- `s` = estimate, `f` = forecast, `z` = projection;
- it includes some historical quarters, but it is not the actuals source.

## 4. What REQ publishes

### 4.1 Historical FOB export values — Table 17

- title: **Quarterly commodity exports, by value (fob), Australia**
- unit: **$m** (millions of Australian dollars), explicitly **FOB**
- period: 1990Q1–2026Q2
- commodities: REQ resource/energy groups plus published totals
- note: “Data for the most recent period is preliminary.”
- source: ABS International Trade in Goods and Services, Cat. No. 5368.0

Example, latest historical quarter **2026Q2** (unrounded $m):

| series                         |         2026Q2 |
| ------------------------------ | -------------: |
| Total resources                |      67,966.49 |
| Total energy                   |      37,492.41 |
| **Total resources and energy** | **105,458.90** |
| Total merchandise              |        138,985 |
| Total goods and services       |        172,885 |
| LNG                            |      13,286.42 |
| Metallurgical coal             |      10,705.73 |
| Thermal coal                   |       8,197.43 |

### 4.2 Historical import values — Table 19

- title: **Quarterly commodity imports, Australia**
- unit: **$m** for values; quantities in kt, ML, `'000 ct` etc.
- period: 1990Q1–2026Q2
- example: **Total imports 2026Q2 = $33,340.63m**
- **Import valuation basis is not stated** (customs value/FOB vs CIF). Resolve before treating imports as FOB or CIF; do not infer.

### 4.3 Historical volumes — Table 16

- title: **Quarterly commodity exports, by volume, Australia**
- units vary by commodity: **Mt**, **kt**, **t**, **ML**, **LCE kt**, `'000 ct`
- period: 1990Q1–2026Q2
- volumes are not dollars and are not interchangeable across commodities.

### 4.4 Historical export unit values — Table 18 / annual Table 3

- title: **Quarterly resources and energy export unit values Australia**
- **this is an index**, base **September 2026 = 100**, not a US$/t price series;
- annual Table 3 is also labelled **“Annual indexes”**;
- do not treat Table 18 as a price or a dollar unit value.

### 4.5 Forecast workbook — values, volumes and spot prices

The forecast workbook contains:

- **Quarterly export values, nominal quarterly** ($m);
- **Quarterly prices, nominal quarterly average** (US$/t, US$/bbl, US$/MMBtu, etc.);
- **Quarterly export volumes** (Mt, kt, t, ML, LCE kt);
- commodity-specific sheets and macro sheets.

It is explicitly labelled:

- `s` = **Estimate**
- `f` = **Forecast**
- `z` = **Projection**

The PDF executive summary gives, for example, R&E exports forecast at **$422b in 2026–27**, **$391b in 2027–28** and **$379b in 2030–31**. These are forecasts, not actuals.

## 5. Actual vs estimate vs forecast

| source                          | status                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Historical workbook Tables 1–22 | ABS-derived actual/historical data; latest period preliminary; some rows marked `s` = estimate |
| Forecast workbook               | `s` estimate, `f` forecast, `z` projection; **never** treat `f`/`z` as actual                  |
| PDF narrative                   | mixes historical discussion and forecasts; the 2026–27/2027–28 figures are forecasts           |

**Rule:** never treat a forecast as an actual. Never mix a forecast vintage with a historical actual series. The current `trade_records` model has no `forecast` flag or release vintage, so a forecast builder needs a schema change.

## 6. Units and periods

| measure                | unit                                                                                    | caveat                                                   |
| ---------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| export values          | $m AUD, FOB                                                                             | explicit FOB in Table 17                                 |
| import values          | $m AUD                                                                                  | import basis (customs/FOB/CIF) **not stated**            |
| volumes                | Mt / kt / t / ML / LCE kt / `'000 ct                                                    | varies by commodity; no `volume_unit` field in the model |
| historical unit values | index, base September 2026 = 100                                                        | not a price; do not treat as US$/t                       |
| forecast spot prices   | US$/t, US$/bbl, US$/MMBtu                                                               | USD, not AUD trade values; forecasts                     |
| periods                | quarterly: calendar Mar/Jun/Sep/Dec; annual: Australian financial years 1989–90…2025–26 | do not mix calendar quarters with FY labels              |

## 7. Commodity classification and geography

**Commodity classification:** REQ custom groups, not HS or ANZSIC. Examples:

- Resources: aluminium (bauxite, alumina, ingot), copper, diamonds/gemstones, gold, iron ore, lead, lithium, nickel, silver, steel, tin, zinc, titanium, zircon, other resources.
- Energy: metallurgical coal, thermal coal, crude oil/refinery feedstock, LPG, refinery products, LNG, other energy.
- Published totals: Total resources, Total energy, Total resources and energy, Total merchandise, Total goods and services.

There is **no HS commodity code**. A `commodity_name` can store the REQ label, but joins to ABS HS-level goods or OECD HS4 margins need a crosswalk.

**Geography:** Australia national only. Tables 38–41 add principal export markets by value/volume (FY/CY), but they are a market summary, not complete bilateral trade values. No state/port/region detail.

## 8. Licence and attribution

From the PDF front matter and the XLSX About sheets:

> © Commonwealth of Australia 2026

> ISSN 1839-5007 Vol. 15, no. 3

> All material in this publication is licensed under a Creative Commons Attribution 4.0 International License, with the exception of: • the Commonwealth Coat of Arms • content supplied by third parties • logos • any material protected by trademark or otherwise noted in this publication.

> Content contained herein should be attributed as follows: Department of Industry, Science and Resources, Commonwealth of Australia Resources and Energy Quarterly September 2026

> The Commonwealth of Australia does not necessarily endorse the content of this publication.

Practical reading:

- CC BY 4.0 with the stated exceptions; attribution is required;
- third-party content, logos and trademark-protected material are excluded;
- underlying ABS data may carry ABS terms;
- the XLSX About sheets say “Vol. 13” while the PDF says Vol. 15, no. 3; use the PDF/release page as authoritative.

## 9. Overlap and non-additivity

**ABS International Trade.** The REQ historical trade tables (16–19) cite **ABS International Trade in Goods and Services, Cat. No. 5368.0** and are ABS-derived commodity aggregates. They are **not additive** with ABS. The current trade API summary groups by `measure_type`/`trade_flow` and sums `amount_cents` across all sources; adding REQ `trade_value` rows alongside ABS would **double-count**. This is the primary blocker.

**OECD ITIC.** OECD publishes CIF/FOB margins as a percentage of CIF import value. REQ publishes FOB export values and import values; no CIF/FOB margin. Do not derive a margin by combining REQ exports and imports; that would be a cross-source derivation. Keep the measure groups separate.

**Within REQ:**

- Tables 16/17/19 contain **published totals alongside commodity components**; never sum totals with components.
- The forecast workbook is **not actuals**; never mix forecast vintages with historical actuals.
- Volumes (Mt/kt/t/ML) are not dollars; never add volumes to values.
- Table 18 is an **index**, not a price; forecast spot prices are USD, not AUD trade values.

## 10. Mapping proposal and blockers

### 10.1 `trade_value` candidate (Tables 17 and 19 only)

| `trade_records` field | proposed value                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `measure_type`        | `trade_value`                                                                                              |
| `trade_flow`          | `export` for Table 17; `import` for Table 19                                                               |
| `commodity_name`      | REQ label, e.g. “Iron ore”, “LNG”, “Metallurgical coal”                                                    |
| `commodity_code`      | undefined — no HS code                                                                                     |
| `amount_cents`        | value_m × 100,000,000 (1 $m = 100,000,000 cents)                                                           |
| `financial_year`      | calendar year for quarterly rows (e.g. `2026`); FY label for annual FY rows (e.g. `2025-26`)               |
| `time_period`         | `2026Q2` for quarterly rows; `2025-26` for annual FY rows                                                  |
| `location`            | `{ granularity: 'national' }`                                                                              |
| `jurisdiction_level`  | `federal`                                                                                                  |
| `source_dataset`      | `DISR REQ`                                                                                                 |
| `source_url`          | exact historical XLSX URL                                                                                  |
| `source_date`         | `2026-10-02`                                                                                               |
| `data_quality_flag`   | `provisional` for historical ABS-derived rows (latest period preliminary); `estimated` for rows marked `s` |

### 10.2 Volume and price candidates

- **Table 16 volumes:** `measure_type='trade_volume'`, `volume` in the published unit, `amount_cents=0`. Blocker: no `volume_unit` field.
- **Table 18 export unit values:** an **index** (base September 2026 = 100), not a price. Could use `index_value`; blocker: no `index_base`/unit field and the model has no `trade_price` unit semantics.
- **Forecast spot prices:** `measure_type='trade_price'`, USD units. Blocker: no `currency`/`price_unit` and no forecast flag.

### 10.3 Blockers

1. **Cross-source additivity.** The `/api/v1/trade/summary` groups by `measure_type`/`trade_flow` and sums `amount_cents` across sources. REQ values would double-count with ABS.
2. **No `aggregation_role`/`is_total`.** REQ tables publish totals and components together; ingesting both would double-count within REQ.
3. **No forecast flag/vintage.** `f`/`z` forecasts cannot be distinguished from actuals/estimates except by `estimated`/`provisional`; forecasts need a separate flag and release vintage.
4. **No `volume_unit`/`price_unit`/`currency`/`index_base`.** Volumes and prices cannot be represented unambiguously.
5. **No HS/REQ commodity code.** `commodity_name` only; joins to ABS/OECD need a crosswalk.
6. **Import valuation basis unstated.** Customs/FOB/CIF must be resolved before the import series is used.
7. **Mixed period semantics.** Quarterly calendar periods and annual Australian financial years are both present; `financial_year`/`time_period` must not mix them.
8. **XLSX metadata inconsistency.** Vol. 13 in the XLSX About sheets vs Vol. 15 in the PDF; use the PDF/release page.

### 10.4 Recommendation

**DEFER a trade-value builder in the current schema.**

The data are defensible (historical FOB export values and import values, 1990Q1–2026Q2), but the current trade API would double-count REQ values with ABS and would sum REQ totals with components. If the product wants a REQ commodity-aggregate view, first:

1. add a **source/overlap group** (e.g. `abs-itgs-5368`) and group the trade summary by it, or exclude derived sources from ABS-inclusive sums;
2. add an **`aggregation_role`/`is_total`** field so published totals are not summed with components;
3. add a **forecast flag and release vintage** (or exclude the forecast workbook entirely);
4. add **`volume_unit`/`price_unit`/`currency`/`index_base`** fields;
5. confirm the **import valuation basis**.

Then build a **bounded connector** for historical Tables 17 and 19 only (component rows, not totals), or for a defined subset. Otherwise use ABS for trade values and treat REQ as context/forecast material.

**Deferral conditions**

- If the product requires a single additive national trade total across ABS + REQ → **defer**.
- If the product requires forecasts as actuals → **defer**.
- If the product requires HS-level or partner-country values → **defer**.
- If the import valuation basis cannot be confirmed → **defer the import series**; exports are explicitly FOB and can be considered separately.
- If the trade API summary is not changed to separate sources and totals → **defer**.

## 11. Archive and checks

- archive root: `/home/steve/ausspend-source-archive/disr-req`
- checksums: `/home/steve/ausspend-source-archive/disr-req/SHA256SUMS`
- **6/6** archived documents re-hashed and matched their SHA-256 records.
- raw bytes: series landing HTML, September 2026 release HTML, June 2026 release HTML, PDF, forecast XLSX, historical XLSX.
- no PDFs/XLSX are committed to the repo; only this packet and the JSON are committed.

Checks performed:

- all three pages and all three data files returned **HTTP 200**; the old stub URL redirects to the live series page;
- PDF extraction: **147 pages, 213 tables**; licence, volume, attribution and forecast/historical language read from the text;
- historical XLSX: **48 sheets**; Table 17/19 quarterly dates **1990Q1–2026Q2**; annual Tables 1/2/3/4 **1989–90–2025–26**;
- forecast XLSX: **24 sheets**; `s`/`f`/`z` labels and units inspected;
- archive: **6/6** SHA-256 verified;
- no database write and no connector were made.

## 12. Sources

The full machine-readable record, including every SHA-256, byte length, content type, URL and archive path, is in [`disr-req.json`](disr-req.json). Core documents:

| document                       | URL                                                                                      | sha256 (first 16)  |     bytes |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ------------------ | --------: |
| Series landing                 | <https://www.industry.gov.au/publications/resources-and-energy-quarterly>                | `3b9033c4cd9318a5` |   137,813 |
| September 2026 release         | <https://www.industry.gov.au/publications/resources-and-energy-quarterly-september-2026> | `bbf83a79316107c3` |   196,925 |
| June 2026 release              | <https://www.industry.gov.au/publications/resources-and-energy-quarterly-june-2026>      | `91a98d59f11a7d9d` |   197,155 |
| September 2026 PDF             | `.../resources-and-energy-quarterly-september-2026.pdf`                                  | `eb9dd61c43654a43` | 5,739,545 |
| September 2026 forecast XLSX   | `.../resources-and-energy-quarterly-september-2026-forecast-data.xlsx`                   | `010ee389273048f9` |   849,083 |
| September 2026 historical XLSX | `.../resources-and-energy-quarterly-september-2026-historical-data.xlsx`                 | `4181789a95f2ad47` | 3,426,384 |

## 13. PREMISE FALSIFIER (summary)

**The premise is TRUE for historical quarterly FOB export values and import values, with overlap and schema caveats.**

If the required output is a **single additive national trade total** across ABS + REQ, a **forecast treated as an actual**, an **HS-level or partner-level series**, or an **import series with an unconfirmed CIF/FOB basis**, the premise fails for that use. Document the deferral; do not invent a value series or derive a margin. A bounded REQ commodity-aggregate builder is defensible only after the source/overlap guard and schema fields in §10.4 exist.
