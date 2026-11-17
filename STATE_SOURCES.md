# State source reconnaissance: VIC, QLD, WA, SA, TAS, ACT, NT

**Status: research only. No connector was started, no state data was fetched into the database, and
no row was written.** All checks below are read-only page/API probes made on **2026-11-17** from the
pool worktree. The app database stayed at **124,767 measures** (read-only count, no ingestion run).

This document answers three questions for each state: where the current budget/open-data material
lives, what format it is in, and what it would cost (technically and legally) to ingest it after the
NSW/local phase. It deliberately does **not** assume a national local-government (LGA) dataset
exists: local pilots are one council at a time, and each state's local availability is described
separately.

Legend: ✅ read verified keyless · ⚠️ readable but fragile/needs archiving · ⛔ blocked, stale or
unavailable · — not applicable.

## Summary table

| State   | Official budget page (current)                                                                       | Budget statements / capital / history formats                                                                              | Open-data API (read keyless?)                                                                                                   | Capital source                                                                                            | Local-government data                                                                                                                | Licence / attribution                                                                                         | Cadence                                                                          | Automation risk                                             | Recommended rank |
| ------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------- |
| **QLD** | <https://budget.qld.gov.au/> (2026-27)                                                               | PDF papers on budget site; **CSV** for BP3 Capital Statement and BP4 Budget Measures on data.qld (history back to 2013-14) | CKAN `https://www.data.qld.gov.au/api/3/action` ✅                                                                              | **BP3 Capital Statement CSV** (project-level, with SA4/coords)                                            | data.qld has local-government loan borrowings CSV, contacts XLS, local laws CSV                                                      | Datasets **CC BY 4.0**; PDFs © State of Queensland (check page notice)                                        | Annual budget (June); CSVs refreshed after release (BP3 CSV modified 2026-08-21) | **Low** — clean CSV + data dictionary                       | **1**            |
| **VIC** | <https://www.dtf.vic.gov.au/state-budget> (2026-27, delivered 5 May 2026)                            | **XLSX** statements/capital/macro on data.vic; PDF/DOCX on DTF/S3; historical XLSX datasets                                | CKAN `https://discover.data.vic.gov.au/api/3/action` ✅                                                                         | **State Capital Program XLSX** (`state-budget-2026-27-state-capital-program-budget-paper-no-4`); VIP XLSX | Know Your Council performance XLSX (2020-25); council waste dashboard                                                                | Datasets **CC BY 4.0**; PDFs © State Government of Victoria                                                   | Annual budget; quarterly financial reports; data.vic updated at release          | **Low-medium** — XLSX multi-sheet parsing                   | **2**            |
| **ACT** | <https://www.treasury.act.gov.au/budget> (2026-27)                                                   | **XLSX** "Budget tables"; PDF/DOCX statements; historical capital-works datasets on Socrata                                | Socrata `https://www.data.act.gov.au/api/catalog/v1` ✅ (also `/resource/<id>.json`)                                            | **2026-27 ACT Budget tables XLSX** (capital in Statement B + tables)                                      | **None** — ACT has no local-government tier (ACT Government is state + local)                                                        | Socrata datasets **CC BY 4.0** (verified on a capital-works dataset); budget tables © ACT Government (verify) | Annual budget (June); quarterly reports                                          | **Low-medium** — direct XLSX, but unstructured tables       | **3**            |
| **WA**  | <https://www.ourstatebudget.wa.gov.au/> (2026-27)                                                    | **XLSX** per-chapter BP3; PDF BP1/BP2; economic/fiscal outlook pages                                                       | CKAN `https://catalogue.data.wa.gov.au/api/3/action` ✅ but **no state-budget datasets found**                                  | **BP3 chapter XLSX** (`2026-27-chapterN.xlsx`) + BP2 PDF                                                  | MyCouncil XML API (CC BY 4.0); LGA boundaries ArcGIS feature service                                                                 | data.wa per-dataset (CC BY / CC BY-SA); budget © Government of WA (verify)                                    | Annual budget (May); quarterly reports                                           | **Medium** — yearly path churn, no CKAN budget catalogue    | **4**            |
| **SA**  | <https://www.statebudget.sa.gov.au/> (2026-27)                                                       | **PDF only** for current budget (Budget Statement, agency statements); CKAN budget XLSX is stale (2015-16 to 2017-18)      | CKAN `https://data.sa.gov.au/data/api/3/action` ✅ but budget datasets stale ⛔                                                 | **Budget Statement PDF** + agency statements (capital in Budget Statement)                                | LGA geometry (SHP/KML/GeoJSON); "Statewide Local Government datasets API" points at dead parse.com ⛔; council names CSV ✅          | Datasets CC BY; budget PDFs Crown copyright, no open licence found — archive/attribute only until verified    | Annual budget (June); quarterly reports                                          | **High** — PDF extraction + asset-managed URLs + stale CKAN | **5**            |
| **TAS** | <https://www.treasury.tas.gov.au/budget-and-financial-management/2026-27-tasmanian-budget> (2026-27) | **PDF only** (BP1 Budget Strategy and Estimates, BP2/BP3 agency information)                                               | **No state CKAN** — `data.tas.gov.au` does not resolve (DNS NXDOMAIN) ⛔; open data is the LIST (ArcGIS REST) ✅                | **BP1/BP2 PDF** (no XLSX/CSV capital file found)                                                          | LIST Local Government Areas/Reserves (Esri REST); Tasmanian LG Consolidated Data Collection (HTML/vector, no open licence specified) | LISTdata **CC BY 3.0 AU**; budget PDFs Crown copyright                                                        | Annual budget (May/June); quarterly financial reports                            | **High** — PDFs, legacy ASP.NET pages, no state catalogue   | **6**            |
| **NT**  | <https://budget.nt.gov.au/> (2026-27)                                                                | **PDF only** (BP1 speech/bill, BP2 strategy, BP3 agency, **BP4 Infrastructure Program**, economy)                          | CKAN `https://data.nt.gov.au/api/3/action` ✅ keyless, but **zero budget/capital datasets** (`q=budget` and `q=capital` both 0) | **BP4 Infrastructure Program PDF**                                                                        | No consolidated LG dataset; data.nt has roads/housing; 17 councils require council-by-council pilots                                 | data.nt datasets **CC BY**; budget PDFs Crown copyright                                                       | Annual budget (May)                                                              | **High** — WAF returns **403 to curl/urllib**; PDF only     | **7**            |

## Per-state detail and sample URLs

All URLs below returned HTTP 200/206 (or JSON) on 2026-11-17 unless marked ⛔. Where a direct file
link is year-stamped, treat it as "archive at retrieval" rather than permanently stable.

### Queensland — recommended next state

> **Phase 4 update (2026-11-17): ingested.** `qld-budget` is live from data.qld CKAN: BP3 Capital
> Statement (943 additive project-level capital rows) and BP4 Budget Measures (108 expense/capital
> policy measures). Units are confirmed by the archived BP3/BP4 dictionaries as `$'000` (x100,000
> cents). BP4 rows are non-additive (`aggregation_role: policy_measure`) because policy measures
> overlap the BP3 capital program (7 project names appear in both); the additive QLD total is BP3
> only (3,174,540,400,000 cents) and BP4 (396,974,700,000 cents) is shown separately. BP4 revenue
> measures and blank/zero/negative 2026-27 amounts are excluded. No COFOG function; rows are
> provisional. See [QLD_INGESTION.md](QLD_INGESTION.md).
>
> **QGIP update (2026-11-17): ingested as a separate source `qld-qgip`.** QLD QGIP
> grant/contract payment-level rows cover **2018-19 through 2024-25** (200,387 rows): the
> latest annual consolidated QGIP expenditure CSV (2024-25) plus the 2018-19..2023-24 years
> and the data dictionary are archived and parsed. 2019-20 is partial because the publisher
> left annual expenditure blank on most rows (a source gap, not a spending fall). Units are
> whole AUD per the dictionary. Only Grant (`grant_award`, 27,658 rows for 2024-25) and
> Frontline service procurement (`contract`, 6,342 rows for 2024-25) are ingested; Concession,
> Loan and Direct government investment (1,031 rows) and zero-dollar rows (21) are rejected.
> Grants and contracts are never summed and data remain provisional and unverified. See
> [PHASE4_INGESTION.md](PHASE4_INGESTION.md) and
> [docs/DATA_GRANULARITY.md](docs/DATA_GRANULARITY.md).

- **Budget:** <https://budget.qld.gov.au/> (2026-27). Papers index
  <https://budget.qld.gov.au/budget-papers/> exposes BP1–BP4 PDFs and Service Delivery Statements.
- **Open data:** CKAN at <https://www.data.qld.gov.au>, API base
  <https://www.data.qld.gov.au/api/3/action> — **keyless** (`package_search` returned 200 JSON).
- **Capital source (best of the seven):** _2026-27 State Budget — Budget Paper 3 — Capital
  Statement_, CSV + data dictionary:
  - <https://www.data.qld.gov.au/dataset/fb0df743-a719-476e-a3ae-4d4e3a0d9124/resource/aa894f86-6f57-4e81-8f95-8c1541bcd819/download/capital-statement-bp3-2026-27-budget.csv>
  - Data dictionary: same dataset, resource `bb5d4369-…/download/data-dictionary-and-explanatory-notes-capital-statement-budget-paper-3-2026-27.csv`
- **Measures source:** _BP4 Budget Measures_ CSV at
  <https://www.data.qld.gov.au/dataset/e37910f7-0ae5-4a20-9e59-dcaa30517080/resource/1eb033d0-a344-4c24-821a-96fc0a0d57fa/download/bp4-open-data-budget-2026-27.csv>
  (plus data dictionary and explanatory notes CSVs).
- **Capital map:** <https://delivering-map.initiatives.qld.gov.au/#/> (interactive project map,
  separate from the CSV; do not treat as the ingestion source).
- **Local government:** `local-government-loan-borrowings` (CSV), `local-government-contacts` (XLS),
  `queensland-local-government-local-laws` (CSV) on data.qld. No national LGA dataset; a council
  pilot still needs its own annual report/statement source.
- **Licence/cadence:** datasets are **CC BY 4.0** with attribution "© State of Queensland
  (Queensland Treasury)". Annual budget; the BP3 CSV metadata showed a post-budget refresh
  (2026-08-21), so re-check after each budget/update.
- **Observed columns (BP3 CSV header):** `Portfolio, Agency, Asset Type, Header 1..3, Project Name,
SA4 Name, Total Estimated Cost, Expenditure to 30-06-26, Budget 2026-27, Post 2026-27, Latitude,
Longitude`. Values use quoted thousands (`"1,805"`) and literal `N/A`; multiple SA4s and multiple
  coordinate pairs can appear in one cell; `Post 2026-27` may be `Ongoing`. **Units appear to be
  $'000 but are not stated in the CSV — confirm against the data dictionary/PDF before cents
  conversion.**
- **Risk:** low. Stable numeric dataset IDs, ETag redirects, keyless reads. Archive the exact CSV
  bytes (the `/download/` URL carries an ETag and redirects to an attachments host).

### Victoria

> **Phase 4 update (2026-11-17): ingested.** `vic-budget` is now live from DataVic CKAN: the
> 2026-27 COFOG-A general government expenses workbook (2025-26 and 2026-27 budget columns; 20
> additive rows) plus the Department of Treasury and Finance statement as 8 explicitly
> non-additive agency-detail rows (`aggregation_role: agency_detail`), excluded from all totals.
> Units are explicit `($ million)`; Transport is tagged `045` provisionally and must not be rolled
> into `04`; a human must confirm the mapping. See
> [PHASE4_INGESTION.md](PHASE4_INGESTION.md).

> **VIC council pilot A (2026-11-18): ingested.** `vic-vlgc-vgc1` adds the VLGGC 2024-25 VGC1
> Expenditure and Revenue questionnaire for all 79 Victorian councils: 5,401 non-additive rows
> (income statement by 9 functions × 5 expense natures, revenue by function and the printed
> bridges/totals). It is a council-supplied, unaudited questionnaire, not the GPFS; every row is
> `aggregation_role: agency_detail`, `provisional/local_government`, `verified: false`, and the
> source Totals row is suppressed (no cross-council total). VLGGC is **attribution/permission, not
> CC BY**. Whole AUD is converted explicitly to cents. City of Greater Bendigo FY2024-25 total
> expenditure `$252,760,999.96` and revenue `$277,002,000.17` reconcile to its audited GPFS
> (`$252,761k` / `$277,002k`) at the printed $1,000 rounding. See
> [docs/VIC_COUNCILS.md](docs/VIC_COUNCILS.md) §11.

- **Budget:** <https://www.dtf.vic.gov.au/state-budget>; 2026-27 delivered 5 May 2026. Capital
  program page <https://www.dtf.vic.gov.au/2026-27-state-capital-program>.
- **Open data:** CKAN <https://discover.data.vic.gov.au>, API
  <https://discover.data.vic.gov.au/api/3/action> — **keyless** (492 budget hits).
- **Capital source:** _State Budget 2026-27 — State Capital Program (Budget Paper No. 4)_ XLSX:
  - <https://discover.data.vic.gov.au/dataset/5ffca2c7-e400-4284-95a8-b654fec25443/resource/4944932c-0d87-4ad1-a0e8-a2c4a9ea93d8/download/2026-27-state-capital-program.xlsx>
  - Page also links PDF/DOCX copies on S3 (`vicbudgetfiles2026.27vicbudget`) for cross-checks.
- **Statements/history:** `state-budget-2026-27-departmental-statements` (one XLSX per department),
  `state-budget-2026-27-aggregate-financial-statements` (XLSX+DOCX),
  `state-budget-2026-27-macroeconomic-indicators` (XLSX):
  - <https://discover.data.vic.gov.au/dataset/a2cdb279-d961-4c54-80a4-3a7e5120d633/resource/7bc98af0-ece6-4d22-8137-ef9167875244/download/macroeconomic-data_2026-27-budget.xlsx>
- **Capital pipeline:** <https://www.dtf.vic.gov.au/sites/default/files/2026-08/2026-27-Victorian-Infrastructure-Pipeline-data.xlsx>
  (2.7 MB XLSX, verified 200).
- **Local government:** _Know Your Council — Local Government Performance Reporting_ full data set
  2020-25 (XLSX, CC BY):
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0019/191008/LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx>.
  Council waste dashboard also on data.vic. One-council pilots remain separate.
- **Licence/cadence:** data.vic datasets **CC BY 4.0** (verified `license_id: cc-by`). Annual budget
  plus quarterly financial reports; data.vic metadata updated per release.
- **Risk:** low-medium. CKAN metadata is good; XLSX workbooks are multi-sheet and each department is
  a separate resource. Do not assume units across sheets — confirm `$m` vs `$'000` per workbook
  (NSW experience: statements `$m`, capital `$'000`). Archive every workbook by SHA-256.

### Australian Capital Territory

- **Budget:** <https://www.treasury.act.gov.au/budget>; 2026-27 page
  <https://www.treasury.act.gov.au/budget/budget-2026-27>; papers/statements
  <https://www.treasury.act.gov.au/budget/budget-2026-27/budget-papers-and-statements>.
- **Direct XLSX:** _2026-27 ACT Budget tables_ —
  <https://www.treasury.act.gov.au/__data/assets/excel_doc/0009/3081492/ACT-Government-2026-27-Budget-tables.xlsx>
  (172 KB, verified). Budget Outlook/Statements A–G are PDF+DOCX.
- **Open data:** Socrata portal <https://www.data.act.gov.au>; API base
  <https://www.data.act.gov.au/api/catalog/v1>, row reads
  `https://www.data.act.gov.au/resource/<id>.json` — **keyless** (verified 200). Historical capital
  works datasets exist, e.g. _Budget 2018-2019 capital works_ (`n6n7-29sh`) and 2019-20/2020-21
  variants; the catalogue search is fuzzy, so query by dataset id/title rather than `q=budget`.
- **Capital source:** the Budget tables XLSX plus Statement B (capital). Historical capital-works
  datasets can backfill project-level history.
- **Observed columns (Socrata `n6n7-29sh`):** `project_name, directorate, project_estimated_physical,
project_classification, category_construction_design, project_type, government_priority, region,
_2017_18_budgeted_financing, …, total_budgeted_financing, _2017_18_re_profiling_000, …` — the
  `_000` suffix confirms **$'000** for those fields; other fields need the column metadata.
- **Local government:** **none** — the ACT has no local-government tier. Do not schedule an ACT
  council pilot.
- **Licence/cadence:** Socrata datasets **CC BY 4.0**, attribution "ACT Government". Budget tables
  licence is not stated on the page — verify before redistributing. Annual budget (June) +
  quarterly reports.
- **Risk:** low-medium. Direct XLSX is easy to archive; the tables are presentation-oriented, so
  column/header detection is the main work. Socrata is stable and keyless.

### Western Australia

- **Budget:** <https://www.ourstatebudget.wa.gov.au/>; papers
  <https://www.ourstatebudget.wa.gov.au/budget-papers.html>. 2026-27 BP1/BP2 PDFs and BP3 chapter
  XLSX live under `/2026-27/budget-papers/`.
- **Capital source:** BP3 chapter XLSX, e.g.
  <https://www.ourstatebudget.wa.gov.au/2026-27/budget-papers/bp3/2026-27-chapter1.xlsx>
  (chapters 1–7 and appendices 1–12 all exist as XLSX; verified 206 on chapter1). BP2 is PDF
  (Vol 1 Parts 1–6, Vol 2 Parts 7–12).
- **Open data:** CKAN <https://catalogue.data.wa.gov.au>, API
  <https://catalogue.data.wa.gov.au/api/3/action> — **keyless** (200), but a search for
  `budget 2026-27` returned only one unrelated WAMSI PDF: **there is no state-budget catalogue
  entry on data.wa**. Budget data must be taken from ourstatebudget paths.
- **Local government:** _MyCouncil — WA Local Government Data_ (XML/SOAP-ish service,
  <https://prod-mycouncil-services.azurewebsites.net/data.svc/>, CC BY 4.0, verified 200) and LGA
  boundaries as an ArcGIS feature service on data.wa.
- **Licence/cadence:** data.wa licences vary per dataset (CC BY and CC BY-SA both observed) —
  check each. Budget papers are © Government of Western Australia; confirm reuse terms. Annual
  budget (May) plus quarterly reports.
- **Risk:** medium. The XLSX paths are year-stamped and the index is hand-maintained HTML; expect
  annual path churn and no API discovery. Archive the chapter workbooks.

### South Australia

- **Budget:** <https://www.statebudget.sa.gov.au/>; papers
  <https://www.statebudget.sa.gov.au/budget-papers>; Treasury index
  <https://www.treasury.sa.gov.au/budget/current-budget/budget-papers>. 2026-27 is **PDF only**:
  Budget Overview, Budget Speech, Budget Statement, Agency Statements Vol 1–4, Budget Measures
  Statement.
- **Capital source:** the **Budget Statement PDF** (and agency statements) — no XLSX/CSV capital
  file on the current pages.
- **Open data:** Data.SA is a **Drupal 11** portal, not CKAN at the root. The legacy CKAN API still
  answers at <https://data.sa.gov.au/data/api/3/action> — **keyless** (verified 200) — but budget
  data is **stale**: `south-australian-state-budget-2017-18` (PDF), `budget-2015-16-data` (XLSX),
  `general-government-sector-expenses-by-function-and-economic-type` (XLSX, 2017). Do not present
  these as current.
- **Local government:** _Local Government Areas_ (SHP/KML/GeoJSON/map viewer, CC BY, modified
  2024-07-16); _Local Council Names_ CSV. The dataset _API Statewide Local Government Datasets_
  points at **parse.com** (dead service, 2021) — mark ⛔ BLOCKED/stale; do not build on it.
- **Licence/cadence:** Data.SA datasets CC BY; budget PDFs are asset-managed
  (`treasury.sa.gov.au/__data/assets/pdf_file/...`) and carry no open-data licence statement found
  on the pages — archive with attribution and treat redistribution as restricted until verified.
- **Risk:** **high**. Current content is PDF-only and asset-managed; the CKAN catalogue is a decade
  stale; local API is dead. The existing PDF extraction/archive toolchain is mandatory here.

### Tasmania

- **Budget:** <https://www.treasury.tas.gov.au/budget-and-financial-management/2026-27-tasmanian-budget>;
  archive <https://www.treasury.tas.gov.au/budget-and-financial-management/2026-27-tasmanian-budget/budget-papers-archive>.
  2026-27 BP1–BP4 are **PDF only**:
  - <https://www.treasury.tas.gov.au/Documents/2026-27%20Budget%20Paper%20No.%201%2c%20Budget%20Strategy%20and%20Estimates.PDF>
  - BP2/BP3 agency information PDFs; BP4 Supplementary Budget Reports PDF.
- **No state CKAN:** `https://data.tas.gov.au` and `https://www.data.tas.gov.au` **do not resolve**
  (curl error 6, DNS NXDOMAIN, 2026-11-17). The working open-data surface is the LIST:
  - <https://listdata.thelist.tas.gov.au/opendata/> (licence link points to **CC BY 3.0 AU**)
  - ArcGIS REST <https://services.thelist.tas.gov.au/arcgis/rest/services/Public/OpenDataWFS/MapServer?f=json>
    — **keyless** (200)
  - data.gov.au organisation `tas-government-the-list` (keyless CKAN) mirrors 794+ LIST datasets.
- **Capital source:** BP1/BP2 PDFs (capital statement/agency capital). No XLSX/CSV found.
- **Local government:** LIST _Local Government Areas_ and _Local Government Reserves_ (Esri REST,
  HTML) plus _Tasmanian local government Consolidated Data Collection (CDC)_ — the CDC is exposed
  as a LIST map/vector layer, licence "not specified" on data.gov.au, so treat it as restricted and
  pilot-specific. No consolidated council financial dataset.
- **Licence/cadence:** LISTdata **CC BY 3.0 AU**; Treasury PDFs Crown copyright. Annual budget
  (May/June) + quarterly financial reports.
- **Risk:** **high**. PDF-only fiscal data, legacy ASP.NET `budget-site/Pages/*.aspx` URLs that
  redirect, and no state CKAN. Spatial local data is usable, but fiscal local data is not.

### Northern Territory

- **Budget:** <https://budget.nt.gov.au/>; papers <https://budget.nt.gov.au/budget-papers> (2026-27).
  All **PDF**: BP1 speech/appropriation bill, BP2 strategy, BP3 agency statements, **BP4
  Infrastructure Program**, NT Economy, regional overview.
  - BP4 (capital) sample: <https://budget.nt.gov.au/__data/assets/pdf_file/0004/1609249/2026-27-budget-bp4.pdf>
- **Open data:** CKAN <https://data.nt.gov.au>, API <https://data.nt.gov.au/api/3/action> —
  **keyless** (200). However `package_search?q=budget` and `q=capital` both returned **0**;
  `q=treasury` returns MyFuel NT fuel-price XLSX, not budget data. There is no NT budget dataset
  to ingest.
- **Local government:** no consolidated local-government dataset on data.nt; results under
  "local government" are housing/roads. 17 councils, so any pilot must be council-by-council.
- **Licence/cadence:** data.nt datasets **CC BY** (verified `myfuel-nt-august-2024`); budget PDFs
  Crown copyright. Annual budget (May).
- **Risk:** **high**. Both `budget.nt.gov.au` and `treasury.nt.gov.au` return **HTTP 403** to
  curl/urllib with a normal UA; only the proxied browser-style fetch returned 200. Any NT connector
  needs a browser-compatible client/proxy and must be treated as WAF-fragile. PDF extraction is
  required for all fiscal data.

## Recommended ingestion order (after NSW/local)

1. **QLD** — the only state with project-level **CSV** capital data plus a published data
   dictionary. First sources:
   - BP3 Capital Statement CSV (project-level, SA4, lat/long, `$'000` to confirm).
   - BP4 Budget Measures CSV (new/changed measures).
   - Data dictionary CSVs (units/definitions) as provenance checks.
     Caveats: values are budgeted only; `N/A`/`Ongoing` sentinels; multiple regions/coords per row;
     confirm `$'000` before cents conversion; archive bytes because the download redirect carries an
     ETag.
2. **VIC** — strong CKAN metadata and XLSX everywhere. First sources:
   - `state-budget-2026-27-state-capital-program-budget-paper-no-4` XLSX.
   - `state-budget-2026-27-departmental-statements` XLSX (one per department).
   - `state-budget-2026-27-macroeconomic-indicators` XLSX (history).
     Caveats: multi-sheet workbooks, separate resource per department, units differ by workbook;
     cross-check against the S3 PDF/DOCX.
3. **ACT** — one clean XLSX plus Socrata. First sources:
   - 2026-27 ACT Budget tables XLSX.
   - Budget Statement B PDF (capital detail) as a check.
   - Historical Socrata capital-works datasets for backfill.
     Caveats: presentation-style tables; no local-government tier; verify the tables' licence.
4. **WA** — usable XLSX but no API discovery. First sources:
   - BP3 chapter XLSX (chapters + appendices).
   - BP1/BP2 PDFs for statement context.
     Caveats: year-stamped paths; hand-maintained index; confirm BP3 is the capital-bearing paper
     for the chosen year before mapping.
5. **SA** — defer until the PDF toolchain is the primary path. First sources:
   - Budget Statement PDF (capital + aggregates).
   - Agency Statements PDFs (department detail).
   - Data.SA `general-government-sector-expenses-by-function-and-economic-type` only as historical
     context (2017, not current).
     Caveats: stale CKAN, dead local API, asset-managed PDF URLs, unclear budget-PDF licence.
6. **TAS** — PDF-only fiscal data and no state catalogue. First sources:
   - BP1 Budget Strategy and Estimates PDF.
   - BP2 agency information PDFs.
   - LIST ArcGIS only for geography, not fiscal rows.
     Caveats: `data.tas.gov.au` dead; local CDC layer has no specified licence; legacy URLs.
7. **NT** — last. First sources:
   - BP4 Infrastructure Program PDF (capital).
   - BP3 Agency Budget Statements PDF.
   - BP2 Budget Strategy and Outlook PDF.
     Caveats: WAF 403 for non-browser clients; no budget dataset in data.nt; PDF-only.

**Next state to actually ingest: QLD.** It is the only one where capital projects, budget measures
and definitions are all keyless CSV with stable dataset IDs. VIC is the natural second because its
CKAN catalogue is equally reliable and adds departmental statements.

## PDF / source-archive toolchain assessment

| State | PDF toolchain needed?     | Why                                                                      |
| ----- | ------------------------- | ------------------------------------------------------------------------ |
| QLD   | No (optional cross-check) | CSV is authoritative for BP3/BP4; PDFs only for narrative checks.        |
| VIC   | No (optional cross-check) | XLSX on data.vic; PDF/DOCX on DTF/S3 are reference copies.               |
| ACT   | Partial                   | XLSX tables are primary; Statement B PDF holds narrative capital detail. |
| WA    | Partial                   | BP3 XLSX is primary; BP1/BP2 remain PDF for statement rules.             |
| SA    | **Yes**                   | Current budget is PDF-only; PDF extractor must handle tables + units.    |
| TAS   | **Yes**                   | All budget papers are PDF.                                               |
| NT    | **Yes**                   | All budget papers are PDF.                                               |

Every state's files should still be archived (URL + SHA-256 + bytes) before parsing, because
year-stamped paths and asset-managed URLs are replaced. The repository already has that foundation
in [`docs/SOURCE_ARCHIVE_AND_PDF.md`](./SOURCE_ARCHIVE_AND_PDF.md).

## Gaps, blockers and things deliberately not assumed

- **No national LGA dataset** was found or assumed. Local-government coverage differs sharply:
  VIC has a performance dataset, QLD has loan/contacts/laws, WA has MyCouncil + boundaries, SA has
  geometry but a dead local API, TAS has spatial layers only, ACT has no local tier, NT has no
  consolidated local dataset.
- **SA** `API Statewide Local Government Datasets` → `https://parse.com` is dead/stale: ⛔ **BLOCKED**
  as an automation source (do not guess a replacement endpoint).
- **TAS** `data.tas.gov.au` does not resolve: ⛔ **BLOCKED** as a catalogue; use the LIST/data.gov.au
  mirror instead.
- **NT** budget/treasury sites return 403 to non-browser clients: ⛔ **BLOCKED for plain HTTP
  automation** until a WAF-compatible fetch path is proven. Do not fake a workaround.
- **SA/TAS/NT/WA budget PDF licences** are Crown copyright without a clear open-data statement on
  the page: archive with attribution, do not redistribute or mark `verified` until confirmed.
- **Units were not forced.** QLD/ACT show `$'000` patterns; VIC/WA workbook units must be confirmed
  per sheet. No cents conversion was attempted in this research item.
- **No live rows, no connectors, no DB writes.** The database count check returned `124767` before
  and after this research; nothing in `server/`, `client/`, `shared/` or `scripts/` was changed.

## How to re-check a claim in this document

```bash
# CKAN keyless read (example: QLD budget search)
curl -sS 'https://www.data.qld.gov.au/api/3/action/package_search?q=budget%202026-27&rows=1' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["count"])'

# Socrata keyless read (ACT capital-works dataset)
curl -sS 'https://www.data.act.gov.au/resource/n6n7-29sh.json?$limit=1'

# LIST ArcGIS keyless read (TAS)
curl -sS 'https://services.thelist.tas.gov.au/arcgis/rest/services/Public/OpenDataWFS/MapServer?f=json'

# NT WAF check (expect 403 from curl, 200 via a browser-style/proxied fetch)
curl -sS -o /dev/null -w '%{http_code}\n' https://budget.nt.gov.au/
```
