# NSW granular expenditure sources — investigation

**Status:** research only. No connector, no database write, no `spending_records` change, no PDF data extraction.
**Date:** 2026-11-18. **Scope:** NSW only. **Evidence:** `docs/source-discovery/nsw-granular/api-calls.json`.

## 1. Executive summary

There is **no clean, current, statewide multi-year internal-function expenditure dataset** in the
NSW open-data estate at low/medium ingestion effort.

- The old **Budget Data Visualisation** dataset is real and granular at **Service Group /
  Sub-service group / Account Type** level, but it is a **stale FY13-14–FY16-17 archive** for the
  **Finance cluster only** (26 agencies, 42 service groups, 400 rows). It has **no Account
  Description** (all null) and no successor dataset found in data.nsw. It is a historical archive,
  not a current statewide source.
- Current **Budget Papers (BP1/BP2/BP3)** are PDFs and the paper structure has changed: BP2 is the
  **Performance and Wellbeing Statement**, BP3 is the **Infrastructure Statement**. There is no
  current machine-readable service-group expenditure CSV. PDF extraction is high effort and was not
  attempted in this phase.
- The strongest current proxies are narrow: **Fleet Vehicle expenditure** (FY16-17–FY22-23, XLSX,
  Operations/Logistics proxy) and **Media Expenditure by Agency** (many years, latest DOCX,
  Communications proxy). Neither is an internal-function expenditure series.
- **ICT Metrics** is too short (2013-14–2015-16; 2016-17 PDF outside CKAN) and its datastore sample
  is a summary FTE series.
- **Consultancy/contractor** has no current machine-readable spend series; the package points to a
  single PDF via Wayback.
- **Workforce Profile** is aggregate/gender-diversity only; no agency-level HR expenditure.

**Recommendation:** do not build a NSW granular-expenditure ingestion connector now. If a build is
authorised, start with a **scoping/parser prototype** for current Budget Papers (high effort), or a
bounded **Fleet** or **Media** proxy; treat Budget Data Visualisation as historical archive only.

## 2. Structured findings A–G

### A. Budget Data Visualisation — verified stale; partial cluster only

- package: `bc0a3d68-52ab-4110-acf9-d3bc3769b8ca`
- metadata modified: **2021-12-23**; licence **CC BY**; update frequency annually
- resources:
  - CSV `0769f5e8-b1a8-45d1-b795-896bdded9cf4`
  - XLS `7b5c759a-0e96-41f4-938c-aa2fbcbc9485`
  - Data Quality Statement PDF, key-budget-charts link, open-data link
- `datastore_search` total: **400 rows**, **4 fiscal years**: FY13-14 (79), FY14-15 (116),
  FY15-16 (86), FY16-17 (119).
- Dimensions: Cluster (3 labels), Agency (26), Service Group (42), Sub-service group (8),
  Account Type (4: Business Expenses 194, Capital Expenditure 78, All Expenses 78, Revenue 50).
- **Account Description is null for all 400 rows.** There is no line-item description, vendor,
  program or project detail.
- Clusters are only **Finance, Services and Innovation / Treasury and Finance Cluster / Finance and
  Services** — this is a Finance-cluster visualisation, **not statewide all-agency expenditure**.
- Unit handling is ambiguous: `Amount (m)` carries millions (e.g. `10.1`) while
  `Amount in millions` carries whole dollars (e.g. `10,055,000.00`). Any future use must select one
  and document it; never ingest both.
- Overlap: Finance-cluster agencies only; overlaps `nsw-budget`/`data-nsw-ckan` for those agencies
  and adds no other cluster. Historical only.

**Successor check:** `package_search` for the title returns only this package; the official Budget
site now offers 2026-27 Budget Papers/key charts/open data, not a replacement CSV. No successor was
found. Therefore the FY13-17 lead is **verified as stale**; recommend only as a historical archive.

### B. NSW Government ICT Metrics

- package: `nsw-government-ict-metrics`; modified **2021-04-20**; licence **CC BY**.
- Resources cover **2013-14, 2014-15, 2015-16** only: XLS/CSV/DQS. The 2016-17 report is a
  digital.nsw PDF, not in this CKAN package.
- Datastore sample (`6d4afa6d-...`): only 6 rows, fields `Year`, `No. of FTEs` — summary, not
  agency × category × spend. The XLS workbook may carry more sheets, but the package is too short
  and not a multi-year agency spend series.
- Granularity promised by the title is metrics/categories (Applications/Infrastructure/Service
  Desk), not internal-function expenditure. **Low priority.**

### C. Fleet Vehicle Expenditure

- packages exist for FY16-17, FY17-18, FY18-19, FY19-20, FY20-21, FY21-22, FY22-23
  (7 years). Latest package `82e324c0-d22f-4699-b32e-d61cf09e04d6` (FY22-23), XLSX + PDF,
  licence **not specified** for the latest; FY16-17/FY17-18 are CC BY.
- Notes: “fleet vehicle spend data and a count of fleet units for NSW Government”.
- Useful only as an **Operations/Logistics proxy** at agency/fleet level; no internal-function
  taxonomy and no FY23-24+ coverage found. Medium effort, narrow additionality.

### D. Consultancy and contractor expenditure

- Package `1c36207e-816d-43af-884e-95dd54d40ec8` “Procurement and reporting of consultancy
  services” has **one PDF resource via Wayback** and licence **lsba**.
- No machine-readable multi-year agency-level consultancy spend series was found in the CKAN
  search. Not a viable external-labour spend source in this phase; document as a gap.

### E. Media Expenditure by Agency

- 46 packages; latest **2024/2025** `a1a350b5-2c9a-4055-8030-7b570364421d` has one **DOCX**
  (`202407-202506-q4-expenditure-by-agency.docx`), licence not specified. Older years are
  agency-level.
- This is a **Communications/Advertising proxy**, not internal-function expenditure; DOCX parsing
  and inconsistent licences make it medium/high effort.

### F. Workforce Profile

- Search count 2; package `30bc9bcf-fd3e-4477-86ea-32652ba8a311` “Gender and diversity Workforce
  Profile data”, 2006–2015 XLS datastore, CC BY.
- Datastore sample: 10 rows of **total public-sector staff**, gender/disability/minority
  percentages — **no agency dimension and no expenditure**. Aggregate-only limitation confirmed.
- HR expenditure is not available from this source; Budget Paper employee expenses are only a
  whole-of-agency proxy at best.

### G. Budget Paper No. 2 / No. 3

- Current Budget Papers landing page (2026-27) returns 200; no direct XLSX/CSV links in the page
  shell. Key Budget Charts page returns the same shell and no `.xlsx/.xls/.csv` links.
- Current structure: **BP1 Budget Statement**, **BP2 Performance and Wellbeing Statement**,
  **BP3 Infrastructure Statement**. The old service-group expenditure tables are not present in the
  current BP2/BP3 titles; BP3 is capital/infrastructure.
- Attempts to download the three current Parliament-tabled PDFs returned **HTTP 403** to curl
  (Cloudflare), so page count/table layout could not be verified in this phase. No PDF was parsed.
- Assessment: **high extraction effort**, structural change from the old BP2/BP3, and no
  machine-readable current alternative. A PDF parser would need page-level table discovery and
  multi-year Actual/Budget/Forward Estimates handling.

## 3. Gap analysis

- **No current statewide multi-year agency × internal-function (ICT, Finance, HR, Operations)
  expenditure dataset.**
- **No statewide line-item/account-description expenditure.** The only granular historical dataset
  (Budget Data Visualisation) has null Account Description and covers Finance-cluster agencies only.
- **HR expenditure:** Workforce Profile is aggregate-only; no agency-level HR spend. Only Budget
  Paper employee-expense lines/proxies.
- **Consultancy/contractor:** no current machine-readable agency series; one PDF via Wayback.
- **Operations/Logistics:** Fleet gives a narrow fleet-spend proxy only; not all operations.
- **Communications:** Media Expenditure gives an advertising proxy, not communications function
  expenditure.
- **Current Budget Papers:** PDF-only/structural change; not low/medium effort.
- **COFOG:** Service Groups are not COFOG; no defensible automatic COFOG mapping. COFOG should stay
  blank/provisional in any future build.

## 4. Recommended priorities (if a build is later authorised)

1. **Current Budget Papers scoping prototype (BP1/BP2/BP3).** Only current whole-of-government
   multi-year source; high effort due PDFs and changed paper structure. Do not build ingestion until
   a table/page inventory and extraction proof are approved.
2. **Fleet Vehicle FY16-17–FY22-23.** Best current machine-readable proxy for Operations/Logistics
   at agency level; medium effort, narrow scope, licence inconsistency needs resolution.
3. **Media Expenditure by Agency.** Long history/Communications proxy; medium-high effort because
   latest year is DOCX and older resources vary.
4. **Budget Data Visualisation FY13-17 (historical archive only).** Low/medium effort to ingest but
   low additionality: Finance cluster only, 4 stale years, no Account Description. Use only for
   historical Finance-cluster analysis, not as a current statewide layer.
5. **ICT Metrics.** Low priority: 3 years, summary/limited agency detail, 2016-17 outside CKAN.

**Do not prioritise** Consultancy (PDF-only) or Workforce Profile (aggregate-only) as spend
sources.

## 5. Data dictionary extracts (real samples)

### Budget Data Visualisation — fields and real rows

Fields: `Fiscal Year`, `Cluster`, `Agency`, `Service Group`, `Sub-service group`, `Account Type`,
`Account Description`, `Amount (m)`, `Amount in millions`.

```json
{"Fiscal Year":"FY16-17","Cluster":"Finance, Services and Innovation","Agency":"DFSI","Service Group":"ICT, Digital and Innovation","Sub-service group":null,"Account Type":"Capital Expenditure","Account Description":null,"Amount (m)":"10.1","Amount in millions":"10,055,000.00"}
{"Fiscal Year":"FY16-17","Cluster":"Finance, Services and Innovation","Agency":"DFSI","Service Group":"Government Services","Sub-service group":null,"Account Type":"Capital Expenditure","Account Description":null,"Amount (m)":"1.7","Amount in millions":"1,722,000.00"}
```

Distinct value counts: FY13-14 79, FY14-15 116, FY15-16 86, FY16-17 119; 26 agencies; 42 service
groups; Account Type Business Expenses 194, Capital Expenditure 78, All Expenses 78, Revenue 50.

### ICT Metrics — summary datastore sample

Fields: `Year`, `No. of FTEs`.

```json
{"Year":"2012-2013","No. of FTEs":78}
{"Year":"2013-2014","No. of FTEs":84}
{"Year":"2014-2015","No. of FTEs":92}
```

### Workforce Profile — aggregate sample

Fields include `Year Code`, `Total Staff`, `Males`, `Female`, percentage columns for disability,
minority and first language. Sample: 2006 Total Staff 323,912; 2007 329,319; 2008 335,885. No
agency or expenditure field.

## 6. Appendix — API and PDF log

Full structured log: `docs/source-discovery/nsw-granular/api-calls.json` (timestamps, URLs, HTTP,
bytes/counts, IDs, samples).

Key calls:

- `package_show?id=bc0a3d68-52ab-4110-acf9-d3bc3769b8ca` → 200, 8,628 B, modified 2021-12-23,
  5 resources.
- `package_search?q=Budget%20Data%20Visualisation&rows=20` → 200, count 121, only the same package
  for that title.
- `datastore_search?resource_id=0769f5e8-b1a8-45d1-b795-896bdded9cf4&limit=3` → 200, total 400.
- `datastore_search?resource_id=0769f5e8-b1a8-45d1-b795-896bdded9cf4&limit=1000` → 200, 400 rows;
  distinct values above.
- `package_show?id=nsw-government-ict-metrics` → 200, 11,522 B, resources for 2013-14..2015-16.
- `datastore_search?resource_id=6d4afa6d-55e2-4dd5-9c1b-956210b70909` → 200, 6 summary rows.
- `package_search?q=fleet%20vehicle&rows=100` → 200, count 10; FY16-17..FY22-23.
- `package_show?id=82e324c0-d22f-4699-b32e-d61cf09e04d6` → 200, XLSX + PDF, licence not specified.
- `package_search?q=media%20expenditure%20agency&rows=10` → 200, count 46.
- `package_show?id=a1a350b5-2c9a-4055-8030-7b570364421d` → 200, one DOCX, 2024/2025.
- `package_show?id=1c36207e-816d-43af-884e-95dd54d40ec8` → 200, one PDF via Wayback.
- `package_show?id=30bc9bcf-fd3e-4477-86ea-32652ba8a311` → 200, aggregate workforce data.
- `datastore_search?resource_id=76a17820-2b8b-4771-a08e-68e220d052ea` → 200, 10 aggregate rows.
- Budget site 2026-27 landing + key charts → 200, 161,508 B each; no xlsx/xls/csv links.
- Parliament BP1/BP2/BP3 artifact attempts → **HTTP 403**, no PDF downloaded or parsed.

PDF inspection status: **no PDF was parsed or scraped**. The only PDFs relevant to G were blocked at
HTTP 403; no page counts/table extraction are claimed.
