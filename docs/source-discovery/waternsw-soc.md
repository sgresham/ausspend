# WaterNSW — source discovery (historical annual reports)

- entity: **WaterNSW** (Water NSW), NSW State Owned Corporation
- jurisdiction: **NSW**
- scope: **source discovery only** — no connector, DB/`measures` write, no schema/API change, no cross-year or cross-entity total
- generated: 2026-11-18
- official annual-reports page: <https://www.waternsw.com.au/about-us/our-business/corporate-governance/annual-reports> — **HTTP 403 to curl** on 2026-11-18 (Cloudflare challenge)
- archive root (outside the repo): `~/.pool-worktrees/ausspend/waternsw-soc-archive`
- checksums: `~/.pool-worktrees/ausspend/waternsw-soc-archive/SHA256SUMS` (10/10 re-hashed and matched)
- existing source: `waternsw` is active with **47 rows, FY2024-25 only**; DB total 693,427 (cheap check supplied with the item)
- prior packet: none (`docs/source-discovery/` had Dubbo/BITRE/DISR only before this packet)

## 1. Premise falsifier

**Result: the premise is TRUE, with one documented gap.**

WaterNSW publishes full annual reports containing audited general-purpose financial statements with printed statement faces and printed `$'000` totals. Ten such reports are retrievable for FY2014-15 and FY2016-17 through FY2024-25 (nine consecutive full years plus the formation-year report). They are not summaries, not whole-of-government consolidated statements, and not predecessor-entity statements. The FY2014-15 report is the entity's first report (WaterNSW was formed on 1 January 2015) and carries a State Water 2014 predecessor comparative column; it is retained as context and **deferred** for a builder.

The one gap is **FY2015-16**: the report was published (data.nsw/dataset `nsw-3-15447-waternsw-annual-report-2015-16`; NLA catalogue), but no retrievable byte copy was found. The official PDF URL returns HTTP 403, the data.nsw resource URL returns HTTP 404, the Archive-It mirror presents a JavaScript session challenge, and the Wayback Machine has no capture of the official `WaterNSW-AR-2015-16.pdf`. FY2015-16 is therefore **deferred**, not invented. Its restated comparative appears in the FY2016-17 report (revenue 341,542; expenses 287,695; net result 53,626) but is not an own-year document and must not seed the FY2015-16 series.

So the usable audited entity-level series is **FY2016-17 to FY2024-25 (9 years)**, with FY2014-15 as a transition-year context and FY2015-16 as a documented gap. That is enough to reject the "summaries/whole-of-government only" falsifier, and it is not enough to justify inventing a complete FY2015-16-to-now series.

## 2. Method and access

- The official host presents a Cloudflare challenge to ordinary `curl` for both the HTML page and the PDF paths (HTTP 403). The NSW Parliament file service (`files.parliament.nsw.gov.au`) is reachable and serves the FY2024-25 artifact byte-for-byte.
- For historical years the exact official PDFs were read from the **Wayback Machine raw capture** (`https://web.archive.org/web/<timestamp>id_/<official-url>`, HTTP 200), because the official host blocks direct download. The archived bytes were written outside the repo and SHA-256 pinned in `SHA256SUMS`.
- The FY2017-18 capture at `20190923004735` is **truncated at exactly 1,048,576 bytes (no `%%EOF`)** and was rejected; the full capture at `20200126152225` (6,638,773 bytes) is the one archived. This is a real historical trap: a discovery pass that trusts the first Wayback hit will read a partial file.
- Text was extracted with `pdfjs-dist` 6.5.438 (no OCR) from the archived bytes. The printed unit and total lines were read from the statement page, not inferred from magnitude. Where a page is image-only (auditor's report/certification pages), it is recorded as image-only rather than guessed.

## 3. Inventory

All ten retrievable reports are **audited statutory annual reports** containing the GPFS and an independent auditor's report. Printed unit is `$'000` in every statement face. "Boundary" is the reporting boundary used by the face statement.

| source_id      | FY      | title / document               |      bytes | pages |    HTTP | printed unit | audited         | boundary                                        | statement page    | status                              |
| -------------- | ------- | ------------------------------ | ---------: | ----: | ------: | ------------ | --------------- | ----------------------------------------------- | ----------------- | ----------------------------------- |
| `wnsw-2014-15` | 2014-15 | WaterNSW Annual Report 2014-15 |  5,010,529 |   110 |     200 | `$'000`      | yes             | WaterNSW single entity (State Water 2014 comp.) | p.18 (printed 17) | accepted (defer builder)            |
| `wnsw-2015-16` | 2015-16 | WaterNSW Annual Report 2015-16 |          — |     — | 403/404 | not assessed | yes (published) | WaterNSW single entity                          | not retrievable   | **deferred — no retrievable bytes** |
| `wnsw-2016-17` | 2016-17 | WaterNSW Annual Report 2016-17 |  3,113,158 |   126 |     200 | `$'000`      | yes             | WaterNSW single entity                          | p.16              | accepted                            |
| `wnsw-2017-18` | 2017-18 | WaterNSW Annual Report 2017-18 |  6,638,773 |   118 |     200 | `$'000`      | yes             | WaterNSW single entity                          | p.21              | accepted                            |
| `wnsw-2018-19` | 2018-19 | WaterNSW Annual Report 2018-19 |  3,138,284 |   142 |     200 | `$'000`      | yes             | consolidated (first year) + parent              | p.60              | accepted                            |
| `wnsw-2019-20` | 2019-20 | WaterNSW Annual Report 2019-20 |  2,535,047 |   156 |     200 | `$'000`      | yes             | consolidated + parent                           | p.67              | accepted                            |
| `wnsw-2020-21` | 2020-21 | WaterNSW Annual Report 2020-21 |  7,719,011 |   176 |     200 | `$'000`      | yes             | consolidated + parent                           | p.85              | accepted                            |
| `wnsw-2021-22` | 2021-22 | WaterNSW Annual Report 2021-22 |  6,669,517 |   152 |     200 | `$'000`      | yes             | consolidated + parent                           | p.77              | accepted                            |
| `wnsw-2022-23` | 2022-23 | WaterNSW Annual Report 2022-23 | 13,981,455 |   169 |     200 | `$'000`      | yes             | consolidated + parent                           | p.94              | accepted                            |
| `wnsw-2023-24` | 2023-24 | WaterNSW Annual Report 2023-24 |  8,947,163 |    86 |     200 | `$'000`      | yes             | consolidated + parent                           | p.47              | accepted                            |
| `wnsw-2024-25` | 2024-25 | WaterNSW Annual Report 2024-25 | 42,917,371 |   101 |     200 | `$'000`      | yes             | consolidated + parent                           | p.59              | accepted — already in source        |
| `wnsw-2025-26` | 2025-26 | WaterNSW Annual Report 2025-26 |          — |     — |       — | —            | —               | —                                               | —                 | **not published as at 2026-11-18**  |

Notes:

- FY2014-15 is the formation year: WaterNSW commenced 1 January 2015; the face covers 12 months of the former State Water result plus 6 months of the former Sydney Catchment Authority result. The second column is the **State Water 2014** predecessor comparative, not WaterNSW.
- FY2016-17 and FY2017-18 are **single-entity** reports (WaterNSW only); there is no consolidation because WaterNSW had no controlled entity until FY2018-19.
- FY2018-19 is the first **consolidated** report (WaterNSW + WaterNSW Infrastructure Pty Ltd). Its face prints Consolidated 2019, Parent 2019 and Parent 2018 only — there is **no consolidated 2018 comparative**.
- FY2019-20 onward print four columns: Consolidated current/prior and Parent current/prior.
- FY2024-25 is the same document already archived in `docs/source-archive/waternsw-annual-report.json` (42,917,371 B; SHA-256 `6240e733…338b09`); the Parliament artifact fetched here is byte-identical.
- FY2025-26 was not found: no official link on the latest archived annual-reports page (snapshot 2025-12-05), no Wayback CDX capture, and no search hit. Treat as not yet published.

## 4. Access routes and source URLs

The discovery must not hard-code one dead URL. For every year the official URL is kept as row provenance, with a documented fallback:

- Official annual-reports page: <https://www.waternsw.com.au/about-us/our-business/corporate-governance/annual-reports> (403 to curl; archived copies exist).
- NSW Parliament file service: <https://files.parliament.nsw.gov.au/fileapi/ParlFiles/GetArtifact?serverRelativeUrl=…> (reachable, HTTP 200; used for FY2024-25, paper 192122; the FY2016-17 Parliament artifact `…/tp/files/72405/WaterNSW%20Annual%20Report%202016-17.pdf` appears in search results but was not fetched in this pass).
- Wayback raw capture: `https://web.archive.org/web/<timestamp>id_/<official-url>` (HTTP 200; used for historical years).
- data.nsw CKAN dataset for FY2015-16: <https://data.nsw.gov.au/data/dataset/nsw-3-15447-waternsw-annual-report-2015-16> (metadata resolves; its resource URL is currently 404 and its canonical mirror is Archive-It, which presents a JavaScript session challenge).

Official PDF URLs (direct download is 403; the archived fallback is what was read):

- `wnsw-2014-15` — <https://www.waternsw.com.au/__data/assets/pdf_file/0013/70150/Final-WaterNSW-2014-15-Annual-Report.pdf> (Wayback 20240513235227)
- `wnsw-2015-16` — <https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-AR-2015-16.pdf> (no Wayback capture; data.nsw resource 404)
- `wnsw-2016-17` — <https://www.waternsw.com.au/__data/assets/pdf_file/0003/128982/WaterNSW-Annual-Report-2016-17.pdf> (Wayback 20190618073609)
- `wnsw-2017-18` — <https://www.waternsw.com.au/__data/assets/pdf_file/0008/137276/WaterNSW-Annual-Report-2017-18.pdf> (Wayback 20200126152225; do **not** use the truncated 20190923004735 capture)
- `wnsw-2018-19` — <https://www.waternsw.com.au/__data/assets/pdf_file/0014/152060/WaterNSW-Annual-Report-2018-19.pdf> (Wayback 20200730093502)
- `wnsw-2019-20` — <https://www.waternsw.com.au/__data/assets/pdf_file/0010/164584/WaterNSW-Annual-Report-2019-20.pdf> (Wayback 20210315121730)
- `wnsw-2020-21` — <https://www.waternsw.com.au/__data/assets/pdf_file/0005/216428/WaterNSW-Annual-Report-2020-21.PDF.pdf> (Wayback 20221017214414)
- `wnsw-2021-22` — <https://www.waternsw.com.au/__data/assets/pdf_file/0005/232178/WaterNSW-Annual-Report-2021-22.pdf> (Wayback 20230308025054)
- `wnsw-2022-23` — <https://www.waternsw.com.au/__data/assets/pdf_file/0009/244557/WaterNSW_Annual-Report-2022-23.pdf> (Wayback 20231202033734)
- `wnsw-2023-24` — <https://www.waternsw.com.au/__data/assets/pdf_file/0004/256387/WaterNSW-Annual-Report-2023-24.pdf> (Wayback 20241216121319)
- `wnsw-2024-25` — <https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf> (official; Parliament artifact 192122 fetched 200, byte-identical)

## 5. Deep verify

All figures are printed in `$'000`; no scaling, arithmetic derivation or cross-entity sum was applied. Components are shown so a reviewer can re-add the printed totals.

### 5.1 Earliest available — FY2016-17

- document: `wnsw-2016-17` (Wayback 20190618073609)
- sha256: `0d87c644ad34f1d197c1bc020e24878e26848daded8772acb8eec9a33453b847`
- printed: Statement of comprehensive income, PDF p.16 / printed p.16; `$'000`; columns **2017** and **2016**; single entity (no consolidated heading)
- proposed: source_id `waternsw`, fiscal_year `2016-17`, measure_type `actual`, boundary `parent`

| printed line                                           |  2017 ($'000) | 2016 ($'000, restated) |
| ------------------------------------------------------ | ------------: | ---------------------: |
| Revenue from water supply and delivery (note 4)        |       290,273 |                261,564 |
| Grants and subsidies (note 4)                          |        49,229 |                 51,488 |
| Other revenue (note 4)                                 |        44,814 |                 28,490 |
| Revaluation of property, plant and equipment (note 14) |        34,305 |                      — |
| **Revenue** (printed total)                            |   **418,621** |            **341,542** |
| Employee related expenses (note 5)                     |      (93,024) |               (72,667) |
| Depreciation and amortisation (note 6)                 |      (58,537) |               (53,165) |
| Other operating expenses (note 6)                      |      (91,106) |               (90,085) |
| Finance costs (note 7)                                 |      (32,871) |               (29,937) |
| Revaluation of property, plant and equipment (note 14) |             — |               (41,841) |
| **Expenses** (printed total)                           | **(275,538)** |          **(287,695)** |
| Gains/(losses) on disposal (note 8)                    |         (108) |                  (163) |
| **Profit before income tax**                           |   **142,975** |             **53,684** |
| Income tax equivalent expense (note 9)                 |      (42,913) |                   (58) |
| **Profit/(loss)**                                      |   **100,062** |             **53,626** |

Reconciliation:

- revenue: 290,273 + 49,229 + 44,814 + 34,305 = **418,621**
- expenses: 93,024 + 58,537 + 91,106 + 32,871 = **275,538**
- result: 418,621 − 275,538 − 108 = **142,975** before tax; 142,975 − 42,913 = **100,062**
- the 2016 column is a **restated comparative**, not the FY2015-16 own-year document; it is shown for boundary/period context only.

Traps: no "Total revenue"/"Total expenses" labels — the printed total is the unlabelled line after the last component; `Revaluation of property, plant and equipment` sits **inside revenue** (2017 gain 34,305) and **inside expenses** in the 2016 comparative (41,841); the report is single entity, so the two printed columns are current-year and restated prior-year, not consolidated.

### 5.2 Middle year — FY2019-20

- document: `wnsw-2019-20` (Wayback 20210315121730)
- sha256: `ff51949c6b0964f8dfacae0c278d785569b7468bd8b63132392947b39ffdcf49`
- printed: Statements of comprehensive income, PDF p.67 / printed p.67; `$'000`; columns Consolidated 2020/2019, Parent 2020/2019
- proposed: source_id `waternsw`, fiscal_year `2019-20`, measure_type `actual`, boundary `consolidated`

| printed line                                    | Consolidated 2020 | Consolidated 2019 (restated) |   Parent 2020 |   Parent 2019 |
| ----------------------------------------------- | ----------------: | ---------------------------: | ------------: | ------------: |
| Revenue from water supply and delivery (note 2) |           310,082 |                      301,016 |       284,917 |       295,199 |
| Grants and contributions (note 3)               |            50,896 |                       49,629 |        50,896 |        49,629 |
| Other revenue (note 4)                          |            48,783 |                       66,229 |        53,380 |        66,296 |
| **Total revenue**                               |       **409,761** |                  **416,874** |   **389,193** |   **411,124** |
| Employee related expenses (note 5)              |         (107,747) |                     (99,635) |     (107,747) |      (99,635) |
| Depreciation and amortization (note 7)          |          (81,470) |                     (60,179) |      (76,589) |      (58,953) |
| Other operating expenses (note 6)               |         (116,017) |                    (132,111) |     (111,313) |     (131,140) |
| Finance costs (note 8)                          |          (66,767) |                     (61,335) |      (56,177) |      (58,920) |
| **Total expenses**                              |     **(372,001)** |                **(353,260)** | **(351,826)** | **(348,648)** |
| Operating profit/(loss)                         |            37,760 |                       63,614 |        37,367 |        62,476 |
| Gains/(losses) on disposal (note 9)             |           (1,117) |                      (2,592) |       (1,117) |       (2,592) |
| Other gains/(losses) (note 10)                  |           (1,921) |                            — |       (1,921) |             — |
| Gains/(losses) on revaluation of PP&E (note 15) |          (77,286) |                       38,268 |      (77,286) |        38,268 |
| **Profit/(loss) before income tax**             |      **(42,564)** |                   **99,290** |  **(42,957)** |    **98,152** |
| Income tax (expense)/benefit (note 11)          |            13,082 |                     (30,706) |        14,551 |      (30,364) |
| **Profit/(loss) after income tax**              |      **(29,482)** |                   **68,584** |  **(28,406)** |    **67,788** |

Reconciliation:

- revenue: 310,082 + 50,896 + 48,783 = **409,761**
- expenses: 107,747 + 81,470 + 116,017 + 66,767 = **372,001**
- operating result: 409,761 − 372,001 = **37,760**
- below-the-line: 37,760 − 1,117 − 1,921 − 77,286 = **−42,564** before tax; +13,082 tax = **−29,482**
- checks: revenue components = 409,761; expense components = 372,001; 409,761 − 372,001 = 37,760; 37,760 − 1,117 − 1,921 − 77,286 = −42,564; −42,564 + 13,082 = −29,482

Traps:

- The 2019 comparative is **restated** (total revenue 416,874, total expenses 353,260, operating profit 63,614, net 68,584) and differs from the FY2018-19 own-year face (455,142 / 353,260 / 101,882 / 68,584). The difference is the `Revaluation of PP&E` revenue line (38,268) moving below operating profit. Ingest each year from its **own** report.
- `Depreciation and amortization` uses the z spelling here; later years use `amortisation`.
- There are four columns; choose `Consolidated 2020` for the entity group and never add the Parent columns.
- FY2019-20 is a **net loss** year: the printed net result is negative and must be stored with its printed sign.

### 5.3 Latest — FY2024-25

- document: `wnsw-2024-25` (Parliament artifact 192122; byte-identical to the official PDF)
- sha256: `6240e733e2d2e5562553a15398b1dbe63c8ab454b6fe78a9d5000f354f338b09`
- printed: Statements of comprehensive income, PDF p.59 / printed p.59; `$'000`; columns Consolidated 2025/2024, Parent 2025/2024
- proposed: source_id `waternsw`, fiscal_year `2024-25`, measure_type `actual`, boundary `consolidated`

| printed line                                    | Consolidated 2025 | Consolidated 2024 |   Parent 2025 |   Parent 2024 |
| ----------------------------------------------- | ----------------: | ----------------: | ------------: | ------------: |
| Revenue from water supply and delivery (note 2) |           379,720 |           376,490 |       355,516 |       353,038 |
| Grants and subsidies (note 3)                   |            65,336 |            67,109 |        65,336 |        67,109 |
| Other revenue (note 4)                          |            49,948 |            54,089 |        51,300 |        55,470 |
| **Total revenue**                               |       **495,004** |       **497,688** |   **472,152** |   **475,617** |
| Employee related expenses (note 5)              |         (163,654) |         (141,587) |     (163,654) |     (141,587) |
| Depreciation and amortisation (note 7)          |         (107,530) |         (105,418) |     (101,800) |      (99,911) |
| Other operating expenses (note 6)               |         (113,348) |         (119,595) |     (109,488) |     (115,984) |
| Finance costs (note 8)                          |          (88,299) |          (67,497) |      (74,233) |      (54,928) |
| **Total expenses**                              |     **(472,831)** |     **(434,097)** | **(449,175)** | **(412,410)** |
| Operating profit                                |            22,173 |            63,590 |        22,977 |        63,208 |
| Other gains/(losses) (note 9)                   |             1,607 |               384 |         1,607 |           384 |
| Gains/(losses) on revaluation of PP&E (note 14) |              (12) |               188 |            84 |           187 |
| **Profit before income tax expense**            |        **23,768** |        **64,163** |    **24,668** |    **63,778** |
| Income tax expense (note 10)                    |           (7,117) |          (19,224) |       (7,388) |      (19,108) |
| **Profit after income tax expense**             |        **16,651** |        **44,939** |    **17,280** |    **44,670** |

Reconciliation:

- revenue: 379,720 + 65,336 + 49,948 = **495,004**
- expenses: 163,654 + 107,530 + 113,348 + 88,299 = **472,831**
- operating result: 495,004 − 472,831 = **22,173**
- below-the-line: 22,173 + 1,607 − 12 = **23,768** before tax; 23,768 − 7,117 = **16,651**
- checks: revenue components = 495,004; expense components = 472,831; 495,004 − 472,831 = 22,173; 22,173 + 1,607 − 12 = 23,768; 23,768 − 7,117 = 16,651

Traps: the 2025 finance-cost line is 88,299, a large rise from 67,497; `Other gains/(losses)` (1,607) replaces the prior year's disposal line; the revaluation line is a small net loss (12). The Parent 2025 net result is 17,280 and must never be added to the consolidated 16,651.

### 5.4 Formation year — FY2014-15 (context, deferred for builder)

- document: `wnsw-2014-15` (Wayback 20240513235227)
- sha256: `be5f6eac8c169bf4496a926b79ce8f7344271103c46b3a10855ad39ac219640f`
- printed: Water NSW Statement of comprehensive income, PDF p.18 / printed p.17; `$'000`; columns **WaterNSW 2015** and **State Water 2014**
- proposed: **defer** (formation/partial period; predecessor comparative; revaluation inside expenses)

| printed line                                           | WaterNSW 2015 ($'000) | State Water 2014 ($'000) |
| ------------------------------------------------------ | --------------------: | -----------------------: |
| Revenue from water supply (note 4)                     |               150,853 |                   75,431 |
| Other revenue (note 4)                                 |                87,695 |                   96,150 |
| **Revenue** (printed total)                            |           **238,548** |              **171,581** |
| Employee related expenses (note 5)                     |              (65,144) |                 (33,819) |
| Other operating expenses (note 6)                      |             (126,989) |                 (83,059) |
| Finance costs (note 7)                                 |              (18,016) |                 (10,425) |
| Revaluation of property, plant and equipment (note 13) |              (73,168) |                   15,058 |
| **Expenses** (printed total)                           |         **(283,317)** |            **(112,245)** |
| **Profit before income tax**                           |          **(44,769)** |               **59,336** |
| Income tax equivalent expense (note 8)                 |                70,233 |                 (17,299) |
| **Profit/(loss)**                                      |            **25,464** |               **42,037** |

Reconciliation: revenue 150,853 + 87,695 = **238,548**; expenses 65,144 + 126,989 + 18,016 + 73,168 = **283,317**; 238,548 − 283,317 = **−44,769**; +70,233 tax benefit = **25,464**.

Traps: the 73,168 revaluation expense is a valuation write-down inside expenses, not operating spend; the State Water 2014 column is a predecessor comparative with a different period/entity and must not be added to WaterNSW 2015; the report covers the 1 January 2015 formation plus 12 months of State Water and 6 months of the former Sydney Catchment Authority.

## 6. Reconciliation to the existing 47-row `waternsw` extract

The existing source is FY2024-25 only. `docs/DATA_GRANULARITY.md` documents the 8 top-level entity rows (total revenue, total expenses, employee, depreciation/amortisation, net result and three government contribution/grant lines); the 47-row count is the top-level rows plus the note-table components attached as `soc_component_of` subtotals (Notes 2, 4, 5, 6, 7, 8 and the cash-flow capital-expenditure bridge). Nothing in this packet changes that source.

The FY2024-25 printed anchors match the existing extract exactly:

- total revenue **495,004** (`$'000`)
- total expenses **472,831** (`$'000`)
- employee related expenses **163,654**
- depreciation and amortisation **107,530**
- net result **16,651**
- grants and subsidies **65,336**
- operating profit **22,173**; profit before tax **23,768**; tax **7,117**
- note subtotals: Note 2 water-supply revenue **379,720**; Note 4 other revenue **49,948**; Note 5 employee **163,654**; Note 6 other operating **113,348**; Note 7 depreciation **107,530**; Note 8 finance costs **88,299**
- cash-flow capital-expenditure outflow **170,828** (investing bridge −170,828 + 3,267 = −167,561)

The existing `waternsw` source is therefore consistent with this discovery, but it is a **single-year** extract; the 9 earlier accessible years are absent.

## 7. Historical layout variants and note-table availability

| FY      | columns                                 | total labels                       | grants label               | D&A label                       | revaluation position    | disposal/other                                        | note numbering                                                                                                                |
| ------- | --------------------------------------- | ---------------------------------- | -------------------------- | ------------------------------- | ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2014-15 | 2 (WaterNSW/State Water)                | `Revenue` / `Expenses`             | not separate               | none                            | inside expenses         | none                                                  | 4 revenue, 5 employee, 6 other operating, 7 finance, 13 revaluation                                                           |
| 2016-17 | 2 (2017/2016)                           | `Revenue` / `Expenses`             | `Grants and subsidies`     | `Depreciation and amortisation` | inside revenue/expenses | `Gains/(losses) on disposal`                          | 4 revenue, 5 employee, 6 expenses (D&A + other), 7 finance, 8 disposal, 9 tax                                                 |
| 2017-18 | 2 (2018/2017)                           | unlabelled totals                  | `Grants and subsidies`     | `Depreciation and amortisation` | inside revenue          | `Losses on disposal`                                  | 4 revenue, 5 employee, 6 D&A, 7 finance, 8 disposal, 9 tax                                                                    |
| 2018-19 | 3 (Cons 2019, Parent 2019, Parent 2018) | `Total revenue` / `Total expenses` | `Grants and subsidies`     | `Depreciation and amortisation` | inside revenue          | `Gains/(losses) on disposal`                          | 1 revenue, 2 grants, 3 other revenue, 4 employee, 5 other operating, 6 D&A, 7 finance, 8 disposal, 9 tax                      |
| 2019-20 | 4 (Cons/Parent × 2020/2019)             | `Total revenue` / `Total expenses` | `Grants and contributions` | `Depreciation and amortization` | below operating profit  | `Gains/(losses) on disposal` + `Other gains/(losses)` | 2 revenue, 3 grants, 4 other revenue, 5 employee, 6 other operating, 7 D&A, 8 finance, 9 disposal, 10 other, 11 tax, 15 PP&E  |
| 2020-21 | 4                                       | `Total revenue` / `Total expenses` | `Grants and subsidies`     | `Depreciation and amortisation` | below operating profit  | `Gains/(losses) on disposal` + `Other gains/losses`   | 3 revenue, 4 grants, 5 other revenue, 6 employee, 7 other operating, 8 D&A, 9 finance, 10 disposal, 11 other, 12 tax, 16 PP&E |
| 2021-22 | 4                                       | `Total revenue` / `Total expenses` | `Grants and subsidies`     | `Depreciation and amortisation` | below operating profit  | `Gains/(losses) on disposal` + `Other gains`          | 2 revenue, 3 grants, 4 other revenue, 5 employee, 6 other operating, 7 D&A, 8 finance, 9 disposal, 10 other, 11 tax, 15 PP&E  |
| 2022-23 | 4                                       | `Total revenue` / `Total expenses` | `Grants and subsidies`     | `Depreciation and amortisation` | below operating profit  | `Losses on disposal`                                  | 2 revenue, 3 grants, 4 other revenue, 5 employee, 6 other operating, 7 D&A, 8 finance, 9 disposal, 10 tax, 14 PP&E            |
| 2023-24 | 4                                       | `Total revenue` / `Total expenses` | `Grants and subsidies`     | `Depreciation and amortisation` | below operating profit  | `Gains/(losses) on disposal`                          | 2 revenue, 3 grants, 4 other revenue, 5 employee, 6 other operating, 7 D&A, 8 finance, 9 disposal, 10 tax, 14 PP&E            |
| 2024-25 | 4                                       | `Total revenue` / `Total expenses` | `Grants and subsidies`     | `Depreciation and amortisation` | below operating profit  | `Other gains/(losses)`                                | 2 revenue, 3 grants, 4 other revenue, 5 employee, 6 other operating, 7 D&A, 8 finance, 9 other gains, 10 tax, 14 PP&E         |

Note tables exist in every year, but note numbering is not stable. FY2024-25's notes 2/4/5/6/7/8 are already parsed by the existing connector; the historical notes are present but need per-year specs. The auditor's report/certification pages are **image-only** in FY2014-15 (PDF pages 14–17) and FY2022-23 (PDF pages 166–168); the statement faces and notes are text.

## 8. Overlap and no-double-count rules

- **Entity only.** Never add WaterNSW rows to government program spending, the PNFC sector benchmark, Sydney Water, Hunter Water, or each other. No cross-entity and no cross-year totals.
- **Face vs notes.** The face statement is the control total. Note components are `soc_component_of` their printed note subtotal; never add a note component to a face total.
- **Consolidated vs parent.** From FY2018-19 choose the consolidated column; before FY2018-19 the report is parent-only. Never add parent and consolidated in the same year.
- **Own-year only.** Read each year from its own report. Do not ingest the restated comparative of a later report as the earlier year (e.g. FY2019-20's 2019 comparative is 416,874 revenue / 63,614 operating profit, not the FY2018-19 own-year 455,142 / 101,882).
- **Summary vs audited.** The narrative "financial outcomes" and "summary financial performance" tables (e.g. FY2014-15 p.12) are summaries; do not use them for totals.
- **Revaluation.** Revaluation gains/losses are printed within revenue/expenses in FY2014-15–FY2018-19 and below operating profit from FY2019-20. Do not move them between years or treat them as cash spend.
- **Grants.** Grants are included in total revenue; do not add the grant lines to total revenue again. They are flagged as potential double-count in the existing source.
- **Formation year.** FY2014-15's State Water 2014 column is a predecessor comparative; never add it to WaterNSW 2015.
- **No profit/margin derivation.** Store printed net result as printed (including a negative sign); do not derive margins or before-capital results.

## 9. What the existing connector/source lacks

- `waternsw` is a FY2024-25-only extract; it has no historical years.
- Discovery currently returns the **latest** annual report only (`discoverWaterNswAnnualReport`); the parser can enumerate links (`parseWaterNswAnnualReportLinks`) but the emit path is not year-parameterised.
- There are no Parliament registry entries for historical years (only FY2024-25, paper 192122).
- There is no fallback registry for the historical official URLs, which are 403 to the ingestion host; this packet supplies the archived URLs/timestamps.
- There are no per-year layout specs for the 2-column single-entity years, the 3-column FY2018-19 year, or the 4-column consolidated years.
- The source lacks a `boundary`/`fiscal_year` parse context and does not handle the FY2015-16 gap or the FY2014-15 formation-year predecessor comparative.

## 10. Bounded builder sequence and exact anchors

Recommended sequence (one source id `waternsw`, natural keys already include fiscal year; do not create per-year source ids):

1. **Year-parameterise discovery** for FY2016-17..FY2024-25 using the archived URLs/timestamps in §4, keeping the official URL as provenance and the Wayback/Parliament artifact as `retrieved_from`. Do not hard-code a single page or PDF URL.
2. **Layout family A — FY2019-20..FY2024-25** (4 columns, consolidated/parent, `Total revenue`/`Total expenses`, revaluation below operating profit). This covers 6 years and is the most regular family; build it first.
3. **Layout family B — FY2018-19** (3 columns, first consolidated, Parent 2018 only, revaluation inside revenue). Build second.
4. **Layout family C — FY2016-17 and FY2017-18** (2 columns, parent-only, unlabelled totals, revaluation inside revenue). Build third.
5. **Defer FY2014-15** (formation/partial period, State Water predecessor comparative, revaluation expense) until a dedicated transition-year spec is scoped.
6. **Defer FY2015-16** (no retrievable own-year bytes) and **FY2025-26** (not published as at 2026-11-18).

Exact year-by-year anchors (consolidated from FY2018-19; parent-only before; printed `$'000`):

| FY      |      revenue | total expenses | operating profit | profit before tax | net result |           grants | employee |                    D&A | finance costs | statement page |
| ------- | -----------: | -------------: | ---------------: | ----------------: | ---------: | ---------------: | -------: | ---------------------: | ------------: | -------------- |
| 2014-15 |      238,548 |        283,317 |                — |          (44,769) |     25,464 | — (not separate) |   65,144 | — (revaluation 73,168) |        18,016 | p.18           |
| 2015-16 | **deferred** |              — |                — |                 — |          — |                — |        — |                      — |             — | —              |
| 2016-17 |      418,621 |        275,538 |                — |           142,975 |    100,062 |           49,229 |   93,024 |                 58,537 |        32,871 | p.16           |
| 2017-18 |      423,810 |        311,266 |                — |           112,268 |     83,337 |           45,572 |   94,460 |                 56,008 |        47,553 | p.21           |
| 2018-19 |      455,142 |        353,260 |          101,882 |            99,290 |     68,584 |           49,629 |   99,635 |                 60,179 |        61,335 | p.60           |
| 2019-20 |      409,761 |        372,001 |           37,760 |          (42,564) |   (29,482) |           50,896 |  107,747 |                 81,470 |        66,767 | p.67           |
| 2020-21 |      448,888 |        446,429 |            2,459 |            52,127 |     34,811 |          125,511 |  126,794 |                 82,463 |        60,412 | p.85           |
| 2021-22 |      411,955 |        396,986 |           14,969 |             (683) |      (455) |           67,114 |  132,530 |                 89,327 |        57,122 | p.77           |
| 2022-23 |      436,595 |        426,665 |            9,930 |             2,867 |      1,968 |           71,287 |  139,553 |                 95,440 |        61,465 | p.94           |
| 2023-24 |      497,688 |        434,097 |           63,590 |            64,163 |     44,939 |           67,109 |  141,587 |                105,418 |        67,497 | p.47           |
| 2024-25 |      495,004 |        472,831 |           22,173 |            23,768 |     16,651 |           65,336 |  163,654 |                107,530 |        88,299 | p.59           |

Notes for the builder:

- FY2014-15 has no "operating profit" line; the printed bridge is Revenue − Expenses = profit before tax, then tax to net result.
- FY2016-17 and FY2017-18 also have no "operating profit" line; use the printed profit before tax after the disposal line.
- FY2019-20 is the first year with the revaluation below operating profit; do not compare its operating profit with FY2018-19's 101,882 without restating.
- Every anchor above is the **printed** number; no scaling or derivation.

## 11. Licence / attribution

The FY2024-25 report prints:

> © 2025 WaterNSW (ABN 21 147 934 787) This publication is copyright and is the property of WaterNSW. The information contained in this publication may not be reproduced in whole or in part except with WaterNSW's prior written consent.

Earlier reports carry the same WaterNSW copyright/attribution. This is **not an open-data licence grant**. Archived bytes are retained for public-interest research and verification only; no PDF/XLSX/CSV is committed to the repository, and only metadata/SHA-256 is written to the packet.

Third-party/personal content: the annual reports contain photographs, commissioned artwork (e.g. the Kheely Turner artwork in FY2022-23), Acknowledgement of Country text, and names/remuneration of board members and executives. These are not extracted as measures and must not be redistributed.

## 12. Archive manifest

All paths are outside the repository under `~/.pool-worktrees/ausspend/waternsw-soc-archive/`. Each file was re-hashed from the archive on write; `SHA256SUMS` matches the table below (10/10).

| source_id      | local path                                   |      bytes | sha256                                                             |
| -------------- | -------------------------------------------- | ---------: | ------------------------------------------------------------------ |
| `wnsw-2014-15` | `2014-15/waternsw-annual-report-2014-15.pdf` |  5,010,529 | `be5f6eac8c169bf4496a926b79ce8f7344271103c46b3a10855ad39ac219640f` |
| `wnsw-2016-17` | `2016-17/waternsw-annual-report-2016-17.pdf` |  3,113,158 | `0d87c644ad34f1d197c1bc020e24878e26848daded8772acb8eec9a33453b847` |
| `wnsw-2017-18` | `2017-18/waternsw-annual-report-2017-18.pdf` |  6,638,773 | `25f88f3ed8ec1071aecbb25f6e1d31018b3cd4c8417ebf83ad646783fa644e88` |
| `wnsw-2018-19` | `2018-19/waternsw-annual-report-2018-19.pdf` |  3,138,284 | `54687d91b79289b2cbc6d82c7221fd5ebca8d0a4bc54d071625d9d29a8ef238b` |
| `wnsw-2019-20` | `2019-20/waternsw-annual-report-2019-20.pdf` |  2,535,047 | `ff51949c6b0964f8dfacae0c278d785569b7468bd8b63132392947b39ffdcf49` |
| `wnsw-2020-21` | `2020-21/waternsw-annual-report-2020-21.pdf` |  7,719,011 | `9f2b8abf37790fae2bc0506f8396cfbbbc2f76096bacd62e4099587b7e1a24df` |
| `wnsw-2021-22` | `2021-22/waternsw-annual-report-2021-22.pdf` |  6,669,517 | `cbb1440f6de59acf18825e68d04cb1c274f11f6a003397de5f0b0739232143a2` |
| `wnsw-2022-23` | `2022-23/waternsw-annual-report-2022-23.pdf` | 13,981,455 | `aea8ec0ca790fd6e99e0f0bd421ff252922e027b6cc32bbab6f80e4aa55efa68` |
| `wnsw-2023-24` | `2023-24/waternsw-annual-report-2023-24.pdf` |  8,947,163 | `567bb2120a8b42fc38f770d3193739644a4a210f28bb215673531b5b23f05c80` |
| `wnsw-2024-25` | `2024-25/waternsw-annual-report-2024-25.pdf` | 42,917,371 | `6240e733e2d2e5562553a15398b1dbe63c8ab454b6fe78a9d5000f354f338b09` |

FY2015-16 is absent from the manifest because no retrievable byte copy was found. The FY2024-25 SHA-256 is the same hash already pinned in `docs/source-archive/waternsw-annual-report.json` and in the `waternsw` connector fixture.
