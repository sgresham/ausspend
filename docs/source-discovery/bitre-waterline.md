# BITRE Waterline — source discovery

- source: **BITRE Waterline** (`bitre-waterline`), Bureau of Infrastructure and Transport Research Economics
- jurisdiction: federal
- generated: 2026-11-18
- packet: [`bitre-waterline.json`](bitre-waterline.json)
- archive root: `/home/steve/ausspend-source-archive/bitre-waterline` (outside the repo)
- checksums: `/home/steve/ausspend-source-archive/bitre-waterline/SHA256SUMS` (19/19 re-hashed and matched)
- status: **discovery only** — no connector, no database write, no `trade_records` rows, no derived margin or port cost.

## 1. Premise falsifier

**Result: PARTIALLY TRUE — the port-level access and licence are real, but the trade-value premise is FALSE.**

Waterline publishes accessible, port-level data for **five major container ports** under **CC BY 4.0** (with exceptions), but the data are **container throughput, operational performance and indicative port interface costs**. It does **not** publish trade values, CIF/FOB margins, customs values, or a national all-ports total. It covers Brisbane, Sydney, Melbourne, Adelaide and Fremantle only; bulk and non-container ports are not covered.

Therefore:

- a **trade-value** or **CIF/FOB margin** builder from Waterline is **not defensible** — document the deferral and keep OECD ITIC as the only CIF/FOB margin source;
- a **`trade_volume`** or **`port_interface_cost`** builder is only defensible after a schema/unit review (see §8–9); otherwise defer.

The old plan URL `https://www.bitre.gov.au/statistics/waterline` is **HTTP 404**. The live series landing page is `https://www.bitre.gov.au/resource/freight/waterline`; the latest issue is `https://www.bitre.gov.au/resource/maritime/waterline-71`.

## 2. Official sources and access

| item                | URL                                                                                 |    HTTP | notes                                                                |
| ------------------- | ----------------------------------------------------------------------------------- | ------: | -------------------------------------------------------------------- |
| series landing      | <https://www.bitre.gov.au/resource/freight/waterline>                               |     200 | official Waterline series page; lists issues 62–71 and release dates |
| latest issue        | <https://www.bitre.gov.au/resource/maritime/waterline-71>                           |     200 | release page for Waterline 71                                        |
| prior issue         | <https://www.bitre.gov.au/resource/maritime/waterline-70>                           |     200 | previous release, 2 Dec 2024                                         |
| old stub / plan URL | <https://www.bitre.gov.au/statistics/waterline>                                     | **404** | stale URL in `scripts/ingest-trade.ts`; do not use                   |
| PDF                 | <https://www.bitre.gov.au/sites/default/files/documents/water_071_0.pdf>            |     200 | 110 pages, 3,964,757 bytes                                           |
| throughput XLSX     | <https://www.bitre.gov.au/sites/default/files/documents/water_071_throughput.xlsx>  |     200 | 6 sheets                                                             |
| performance XLSX    | <https://www.bitre.gov.au/sites/default/files/documents/water_071_performance.xlsx> |     200 | 6 sheets                                                             |
| VBS/TAS XLSX        | <https://www.bitre.gov.au/sites/default/files/documents/water_071_vbs.xlsx>         |     200 | 6 sheets                                                             |
| PICI XLSX           | <https://www.bitre.gov.au/sites/default/files/documents/water_071_pici.xlsx>        |     200 | 5 sheets                                                             |
| time series ZIP     | <https://www.bitre.gov.au/sites/default/files/documents/water_071_timeSeries.zip>   |     200 | 7 CSVs                                                               |
| copyright page      | <https://www.infrastructure.gov.au/copyright>                                       |     200 | department-wide copyright/CC terms                                   |

- **No login** is required and **no API/JSON endpoint** was found. The release page exposes direct PDF/XLSX/ZIP downloads only.
- The site is fronted by a WAF; requests with a browser-like User-Agent returned 200. Plain `curl` without a UA may be challenged.
- The old stub URL is archived as `old-stub-404.html`; the live landing pages and files are archived with SHA-256.

## 3. Release, cadence and coverage

- **Latest issue:** Waterline 71, Statistical Report.
- **Release date:** 25 September 2026.
- **Period covered:** activity up to the **June quarter 2025**.
- **Identifiers:** ISBN 978-1-923111-29-5; ISSN 2208-9101; BITRE ref. 2026-102.
- **Status:** current as at 2026-11-18.

Recent release dates show an **issue-based, irregular annual/biennial cadence**, not a fixed quarterly feed:

| issue | release date | activity covered      |
| ----: | ------------ | --------------------- |
|    71 | 2026-09-25   | June quarter 2025     |
|    70 | 2024-12-02   | June quarter 2023     |
|    69 | 2023-07-21   | June quarter 2022     |
|    68 | 2022-10-04   | June quarter 2021     |
|    67 | 2021-12-22   | December quarter 2020 |
|    66 | 2021-06-11   | June quarter 2020     |
|    65 | 2019-12-17   | June quarter 2019     |
|    64 | 2019-11-02   | December quarter 2018 |
|    63 | 2019-10-02   | June quarter 2018     |
|    62 | 2018-10-02   | December quarter 2017 |
|    61 | 2017-12-02   | June quarter 2017     |

Machine-readable coverage in the latest release:

- quarterly time series: **2011Q1–2025Q2** (58 quarters);
- half-yearly time series: **2011H1–2025H1** (29 half-years);
- TEU capacity/exchange: **2014H2–2025Q2** (66 periods);
- throughput and VBS XLSX: **2023Q1–2025Q2**;
- PICI XLSX: **2023H1–2025H1** (5 half-years; 3 of the 7 national ship-size classes).

## 4. Ports and geography

Waterline 71 covers **five major Australian container ports**:

- Brisbane
- Sydney
- Melbourne
- Adelaide
- Fremantle

It does **not** cover all Australian ports, bulk/commodity ports (e.g. Port Hedland, Dampier, Gladstone, Newcastle, Hay Point), non-containerised port trade values, or customs/CIF/FOB values. The XLSX also has a **Five ports** aggregate sheet: that is a published sum of these five container ports, **not a national all-ports total**.

## 5. What Waterline publishes

### 5.1 Container throughput — a volume measure

The throughput workbook and `wl71_t1qtr`/`wl71_t1str` CSVs publish:

- UCC ships handled / ship visits;
- total containers handled;
- total TEUs handled;
- 40-foot container proportion;
- VBS/TAS trucks and containers moved by road and rail;
- total cargo throughput and non-containerised general cargo throughput (million tonnes);
- TEU full/empty import/export splits.

These are **volumes/throughput**, not dollar trade values. Containers, TEUs, tonnes and ship calls are different units and are never interchangeable.

### 5.2 Container performance — an operational measure

The performance workbook and `wl71_t2qtr`/`wl71_t2str` CSVs publish:

- crane, labour and ship rates (containers/hour and TEUs/hour);
- containers/TEUs per truck, truck and container turnaround times;
- anchorage waiting, ships waiting more than 2 hours, berth availability and occupancy;
- hours at berth, TEUs/lifts per berth hour, lifts per berth visit.

These are **performance indicators**, not trade values, volumes or costs. The current `trade_records` model has no performance measure type.

### 5.3 Port interface costs (PICI) — a cost measure

The PICI workbook and Chapter 4 of the PDF publish **shore-based shipping charges** that approximate the cost of carting containers through the five ports. PICI is computed as a **national average cost per TEU**, in current and constant prices, from per-port charges for imports and exports.

PICI components visible in the per-port XLSX (Tables 4.1–4.5):

- **port call parameters:** total TEUs exchanged, loaded inwards/outwards, empty, number of port calls, elapsed berth time;
- **charges per ship visit ($):** total ship-based charges, empty;
- **ship-based charges ($/TEU):** conservancy, tonnage, pilotage, towage, mooring/unmooring, total;
- **fees and charges for imports:** total ship-based charges; cargo-based charges (wharfage, harbour dues, other charges); stevedoring—wharfside; stevedoring—landside; terminal access charges; road transport charges; customs broker fees; total fees and charges ($/import TEU); port's share in national index (%);
- **fees and charges for exports:** the same structure with export TEU.

Example, **Brisbane, 2025 Jan–Jun, imports** (unrounded XLSX values):

| ship-size class  | total ship-based charges ($/TEU) | total fees and charges ($/TEU) |
| ---------------- | -------------------------------: | -----------------------------: |
| 5,000–20,000 GT  |                            71.20 |                       1,082.71 |
| 35,000–50,000 GT |                            42.97 |                       1,054.49 |
| 65,000–80,000 GT |                            34.61 |                       1,046.12 |

The same Brisbane period for **exports** gives total fees and charges of 1,043.47, 1,015.24 and 1,006.88 $/TEU respectively.

**Important:** PICI is an **indicative** measure. The report says it is not an average of all charges, uses scheduled service prices and does not account for specific commercial arrangements. Estimates are rounded to the nearest whole dollar; a zero means the charge is less than fifty cents. Some components are BITRE estimates. The correct data-quality flag for PICI is therefore **`estimated`**, never `verified` or `observed`.

**PICI is not a CIF/FOB margin.** CIF/FOB is the (CIF − FOB) / CIF share of import value and includes international transport/insurance; PICI is a shore-based port charge in dollars per TEU and excludes ocean freight. PICI is not profit and must not be relabelled as a margin.

### 5.4 What is absent

No **trade value**, **customs value**, **CIF value**, **FOB value**, **CIF/FOB margin**, **duty/tariff**, or **profit** series is published in Waterline. Do not infer any of these from the throughput or PICI tables.

## 6. Units and periods

| measure                  | published unit                                       | caveat                                                                                                         |
| ------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| containers / TEUs (XLSX) | thousands (`'000`)                                   | some CSVs use raw counts (`cont_stev`, `teu_stev`, `vbs_trucks`); per-table unit detection is mandatory        |
| total cargo throughput   | million tonnes                                       | the CSV `all_mt_port`/`bb_mt_port` headers do not print the unit; confirm before use                           |
| ships / trucks           | counts or thousands (`'000`)                         | XLSX uses `'000`; CSV uses raw counts                                                                          |
| rates / turnaround       | containers or TEUs per hour; minutes; hours; percent | operational, not monetary                                                                                      |
| PICI per-port            | AUD per TEU and AUD per ship visit                   | per-port XLSX tables are current-price indicative dollars, rounded                                             |
| national PICI            | AUD per TEU, current and constant prices             | constant prices use the ABS non-farm GDP deflator with Jan–Jun 2025 = 100.0                                    |
| PICI "index"             | dollars per TEU                                      | despite the name, the national table is **not** a unitless base-100 index; values are around $1,000–$1,156/TEU |

Periods are **calendar quarters/half-years** (`2025Q2`, `2025H1`), not Australian financial years. Do not relabel them as `2024-25` style financial years.

## 7. Licence and attribution

The Waterline 71 PDF states:

> © Commonwealth of Australia, 2026

> With the exception of (a) the Coat of Arms; (b) the Department of Infrastructure, Transport, Regional Development, Communications, Sport and the Arts photos and graphics; (c) content supplied by third parties; (d) content otherwise labelled, copyright in this publication is licensed under Creative Commons Attribution 4.0 International.

> An appropriate citation for this report is: Bureau of Infrastructure and Transport Research Economics 2026, Waterline 71, Statistical Report, Canberra, ACT.

The department copyright page adds:

> Material obtained from all websites owned and administered by the department is to be attributed to this department as: © Commonwealth of Australia.

and confirms the **Creative Commons Attribution 4.0 International** licence where material is identified by a CC logo. Source: <https://www.infrastructure.gov.au/copyright>.

Practical reading:

- the report and its tables are CC BY 4.0 **except** the Coat of Arms, departmental photos/graphics, third-party content and content otherwise labelled;
- attribution is required; do not imply Commonwealth endorsement;
- do not redistribute third-party photos/graphics;
- underlying data supplied by stevedores, port authorities and other third parties may carry separate rights even where the publication is CC BY.

## 8. Overlap and non-additivity

**ABS International Trade.** ABS publishes national goods/services **trade values** in AUD by commodity and financial year. Waterline publishes five-port container **volumes** and **port interface cost rates**. There is no shared measure and no additive overlap. Waterline cannot be reconciled to an ABS total because it covers only five container ports and publishes no dollar trade values. Never sum Waterline volumes/rates with ABS values or derive a port share of ABS.

**OECD ITIC.** OECD publishes **CIF/FOB margins** as a percentage of CIF import value, by partner and HS4 product. Waterline PICI publishes **shore-based port charges** in AUD per TEU. They are different concepts: PICI is not a CIF/FOB margin, excludes ocean freight and insurance, and must never be added to or converted into an OECD margin. Keep the `measure_type` groups separate.

**Five ports.** The XLSX `Five ports` sheets are a published sum of five container ports, not a national all-ports total. They must not be presented as Australia-wide.

**Within Waterline:**

- PICI rates ($/TEU, $/ship visit) are **not totals**; do not sum them;
- PICI components are alternative cost components; only the published **Total fees and charges** row is a total;
- current-price and constant-price PICI series are different bases; do not mix them;
- containers, TEUs, tonnes and ship calls are different units; do not add them;
- ports are separate; the five-port aggregate is not national.

## 9. Mapping proposal — `trade_records`

No rows were written. This is the proposed mapping if a future builder is approved.

### 9.1 `trade_volume` candidate

Source: `wl71_t1qtr.csv` / `wl71_t1str.csv` and the throughput workbook.

| `trade_records` field | proposed value                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `measure_type`        | `trade_volume`                                                                                                            |
| `trade_flow`          | `import` / `export` from `teu_full_im`, `teu_empty_im`, `teu_full_ex`, `teu_empty_ex`; total throughput rows have no flow |
| `port_name`           | Brisbane / Sydney / Melbourne / Adelaide / Fremantle                                                                      |
| `location`            | `{ granularity: 'port', port: <port> }`                                                                                   |
| `commodity_name`      | "Containerised cargo (TEU)" or "Total cargo (million tonnes)"                                                             |
| `volume`              | the published number (TEU/containers/tonnes); never converted to cents                                                    |
| `amount_cents`        | `0` (a volume, not money)                                                                                                 |
| `financial_year`      | calendar year, e.g. `2025`                                                                                                |
| `time_period`         | `2025Q2` or `2025H1`                                                                                                      |
| `source_dataset`      | `BITRE Waterline`                                                                                                         |
| `data_quality_flag`   | `provisional` (reported by stevedores/port authorities; not audited)                                                      |

### 9.2 `port_interface_cost` candidate

Source: PICI workbook sheets 4.1–4.5 (optionally PDF Tables 4.6/4.7 for the national series).

| `trade_records` field | proposed value                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `measure_type`        | `port_interface_cost`                                                                          |
| `trade_flow`          | `import` / `export`                                                                            |
| `port_name`           | Brisbane / Sydney / Melbourne / Adelaide / Fremantle                                           |
| `location`            | `{ granularity: 'port', port: <port> }`                                                        |
| `commodity_name`      | "Port interface cost — Total fees and charges" (or a named component after a schema extension) |
| `price`               | AUD per TEU (number in dollars)                                                                |
| `amount_cents`        | `0` (a rate, not a total)                                                                      |
| `financial_year`      | calendar year, e.g. `2025`                                                                     |
| `time_period`         | `2025H1`                                                                                       |
| `source_dataset`      | `BITRE Waterline`                                                                              |
| `data_quality_flag`   | `estimated` (indicative; rounded; some components BITRE estimates)                             |

### 9.3 Blockers

1. **No `cost_component` field** in `trade_records`: PICI has many components (conservancy, tonnage, pilotage, towage, mooring, wharfage, harbour dues, stevedoring, terminal access, road transport, customs broker) that cannot be represented cleanly.
2. **No `unit`/`rate_basis` field**: `price` is ambiguous between $/TEU, $/ship visit and index points; `amount_cents` is a total-money field and must not hold a per-TEU rate.
3. **`trade_flow` has no `total`**: total throughput rows cannot be represented; only import/export splits are safe.
4. **`location.granularity` has no `five_ports`/aggregate value**: the published Five ports rows cannot be stored without mislabelling them national or port.
5. **PICI national current/constant series are in the PDF** (Tables 4.6/4.7), not the XLSX; extracting them needs PDF table extraction.
6. **PICI XLSX covers only 2023H1–2025H1 and 3 of 7 national ship-size classes**; no long PICI series is machine-readable.
7. **Five container ports only**; no bulk ports and no national coverage.
8. **No trade values/CIF/FOB/customs**; the source cannot support a trade-value or margin builder.
9. **Old stub URL is 404**; a future builder must use the live landing/issue URLs.
10. **The data are indicative/estimated**, not audited actuals; `data_quality_flag='estimated'` is mandatory for PICI.

### 9.4 Recommendation

**DEFER a `trade_records` builder in the current schema.**

If the product wants five-port container volumes and port interface cost rates, open a **schema-change item** first to add:

- a cost/measure detail field (e.g. `cost_component`);
- a `unit`/`rate_basis` field;
- `trade_flow='total'` or an explicit aggregation role;
- `location.granularity='five_ports'` or an explicit aggregate label.

Then build a **bounded** connector for:

- (`trade_volume`) five ports × import/export × quarterly/half-yearly, only the full/empty import/export TEU columns; skip total rows until a total flow exists;
- (`port_interface_cost`) five ports × import/export × 3 ship-size classes × 2023H1–2025H1, only the published **Total fees and charges** row; `data_quality_flag='estimated'`; `amount_cents=0`; `price` = $/TEU.

Never: sum rates; multiply rates by throughput to invent a port cost total; convert PICI to CIF/FOB; add Waterline to ABS or OECD; treat five ports as national.

## 10. Archive and checks

- archive root: `/home/steve/ausspend-source-archive/bitre-waterline`
- checksums: `/home/steve/ausspend-source-archive/bitre-waterline/SHA256SUMS`
- **19/19** archived documents re-hashed and matched their SHA-256 records.
- raw bytes: 3 HTML/XML evidence pages (series landing, issue 71, issue 70, old 404, copyright, sitemap), the PDF, 4 XLSX, the time-series ZIP and 7 extracted CSVs.
- no PDFs/XLSX/CSVs are committed to the repo; only this packet and the JSON are committed.

Checks performed:

- all 6 data files, the issue-71 page, the series landing page, the issue-70 page and the copyright page returned **HTTP 200**; the old stub URL returned **HTTP 404**;
- PDF extraction: **110 pages, 108 tables**; licence, units and PICI definitions read from the PDF text;
- XLSX: throughput 6 sheets, performance 6, VBS/TAS 6, PICI 5; sheet names and row labels inspected;
- CSVs: 7 files; quarterly 2011Q1–2025Q2, half-yearly 2011H1–2025H1, TEU capacity/exchange 2014H2–2025Q2;
- archive: **19/19** SHA-256 verified;
- no database write and no connector were made.

## 11. Sources

The full machine-readable record, including every SHA-256, byte length, content type, URL and archive path, is in [`bitre-waterline.json`](bitre-waterline.json). Core documents:

| document             | URL                                                                      | sha256 (first 16)  |     bytes |
| -------------------- | ------------------------------------------------------------------------ | ------------------ | --------: |
| Waterline 71 landing | <https://www.bitre.gov.au/resource/maritime/waterline-71>                | `409bea8234e8e5fd` |    47,921 |
| Series landing       | <https://www.bitre.gov.au/resource/freight/waterline>                    | `215f3c3edaa53c56` |    38,612 |
| Waterline 70 landing | <https://www.bitre.gov.au/resource/maritime/waterline-70>                | `01bd7fd61ec593f5` |    49,034 |
| Old stub 404         | <https://www.bitre.gov.au/statistics/waterline>                          | `3f5cbf9f647b6e51` |    24,730 |
| Copyright page       | <https://www.infrastructure.gov.au/copyright>                            | `a4c303f2e436b967` |   650,141 |
| Sitemap              | <https://www.bitre.gov.au/sitemap.xml>                                   | `7fc6b7f820581a8e` |   175,030 |
| Waterline 71 PDF     | <https://www.bitre.gov.au/sites/default/files/documents/water_071_0.pdf> | `50ce4b5f08f498b0` | 4,064,757 |
| Throughput XLSX      | `.../water_071_throughput.xlsx`                                          | `2312a72f33e98e06` |    43,136 |
| Performance XLSX     | `.../water_071_performance.xlsx`                                         | `2693f150645b91a0` |    57,410 |
| VBS/TAS XLSX         | `.../water_071_vbs.xlsx`                                                 | `299d5b76a2c6c9f7` |    34,835 |
| PICI XLSX            | `.../water_071_pici.xlsx`                                                | `4946728722602701` |    55,002 |
| Time series ZIP      | `.../water_071_timeSeries.zip`                                           | `5ae003832f4a28b4` |   182,057 |

## 12. PREMISE FALSIFIER (summary)

**The premise is partially true only for volumes/costs; it is false for trade values and CIF/FOB.**

If the required output is port-level **trade value**, **CIF/FOB margin**, **customs value**, or a **national port total**, stop: Waterline has no such series and covers only five container ports. Document the deferral; do not invent a port cost or margin. If the required output is **five-port container volume** or **port interface cost rates**, a bounded builder is possible only after the schema/unit changes in §9.4; otherwise defer.
