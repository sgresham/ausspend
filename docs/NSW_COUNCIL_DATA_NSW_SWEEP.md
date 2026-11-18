# NSW council financial data on data.nsw — catalogue sweep (P4)

**As at:** 17 November 2026. **Status:** planning/research only. **Scope:** the data.nsw CKAN
catalogue (`data.nsw.gov.au/data`), checked per organisation for machine-readable NSW local
government financial data. No ingestion, no schema/API/DB writes, no individual council PDF
extraction, no OLG all-rights workbook.

**Question.** Does data.nsw carry council-level audited financial statements at statement-line
granularity, so a connector can target a real dataset instead of blind PDFs?

**Answer: no — the premise is falsified.** data.nsw carries no council financial-statement dataset
at all, in any format. What exists is a small set of **annual-report PDFs** for **10 of the 128**
general purpose councils, mostly pre-2018, hosted as Internet Archive snapshots. There is no CSV,
XLSX or API resource with council statement lines, and no consolidated council dataset. The next
step remains individual council GPFS batches from council websites, not a data.nsw connector.

---

## 1. Method and reproducible queries

All calls are unauthenticated GETs against the CKAN 3 action API:

```bash
BASE='https://data.nsw.gov.au/data/api/3/action'
```

| Purpose                             | Query                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Portal size                         | `curl -s "$BASE/package_search?q=*:*&rows=0" \| jq '.result.count'` → `17247`                                                                                                  |
| Organisations (facet)               | `curl -s "$BASE/package_search?q=*:*&rows=0&facet.field=%5B%22organization%22%5D&facet.limit=300" \| jq '.result.search_facets.organization.items \| length'` → `219`          |
| Organisations (`organization_list`) | `curl -s "$BASE/organization_list?all_fields=true&limit=1000" \| jq '.result \| length'` → `25` (see §6: API inconsistency)                                                    |
| One council org's packages          | `curl -s "$BASE/package_search?q=*:*&fq=organization:%22wollongong-city-council%22&rows=1000" \| jq '.result.count'`                                                           |
| Title search                        | `curl -s "$BASE/package_search?q=title%3A%28council%20annual%20report%29&rows=1000" \| jq '.result.count'` → `155`                                                             |
| Financial-statement titles          | `curl -s "$BASE/package_search?q=title%3A%28financial%20statements%29&rows=1000" \| jq '.result.results[] \| .title'` → 19 titles, all state agencies                          |
| Keyword premise check               | `curl -s "$BASE/package_search?q=council%20financial%20statements&rows=400"` → `395` noisy hits, 61 with "council" in the title, all PDFs and none a council financial dataset |

`package_search` returns at most **1,000 rows per request** (`rows=5000` is capped at 1,000). The
per-organisation sweep therefore fetched each council organisation separately with `rows=1000`.
Raw responses were kept outside the repository; the counts below are reproducible from the queries
shown.

**Organisation coverage.** The `organization` facet lists **219** organisations. Filtering display
names on `council|shire|municipal|city of` gives **125** council-like organisations, containing
**3,025** packages. Matching those organisations to the 128 names in
[NSW_COUNCILS.md §1](./NSW_COUNCILS.md#1-the-128-general-purpose-councils) gives:

- **120 of 128** councils have a data.nsw organisation;
- **8** councils have **no** organisation: Lane Cove, Shellharbour, Gilgandra, Cobar,
  Glen Innes Severn, Gwydir, Oberon, Inverell;
- 5 council-like organisations are duplicates/legacy bodies and were matched to the current council
  or left out: `city-of-sydney` (duplicate of `council-of-the-city-of-sydney`), `city-of-ryde`
  (duplicate of `ryde-city-council`), `hornsby-shire-council` (legacy; current org is
  `the-council-of-the-shire-of-hornsby`), `rous-county-council` (county water, not one of the 128) and `ssroc` (a regional organisation of councils, not a council).

## 2. Premise test — what the catalogue actually contains

Metadata scan of all **3,025** packages in the 125 council organisations:

| Check                                                                                                                                                                             | Result                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Package titles containing "financial", "financial statement", "budget", "expenditure", "income statement", "balance sheet", "revenue", "ledger", "procurement", "general purpose" | **0**                                                                                                                             |
| Resources whose name/description contains the same financial terms                                                                                                                | **0**                                                                                                                             |
| Packages titled "annual report" inside a council organisation                                                                                                                     | **0**                                                                                                                             |
| Loose keyword hits (audit/statement/rates/fees etc.)                                                                                                                              | 87, all flood studies, levee audits, GIS/environmental datasets or City of Sydney operational price data                          |
| CSV/XLSX/XLS resources with "council" in the title, portal-wide                                                                                                                   | 5 CSV + 1 XLSX, none financial (4 Lake Macquarie environmental sensors, 1 parliament member list, 1 parking-penalty notice count) |

Examples of the loose hits, all **not** council financial data: "Visual Audit of Urban Levees",
"South Albury Levee Rehabilitation — Statement of Environmental Effects", "Business rate category"
(City of Sydney rate _category definition_), "Ticket parking rates" (price schedule). None contains
council revenue or expense dollars.

**Financial-statement datasets on the portal are state-agency PDFs.** The 19 titles matching
`title:(financial statements)` are Macquarie Generation, UTS, Integral Energy, FACS/DCJ and the NSW
Institute of Psychiatry — every one a state entity, every one a PDF. None is a council. The same is
true of the 18 `title:(annual financial statements)` hits.

## 3. Candidate table — annual reports (PDF only, not statement-line)

The only council-level financial content found is **annual-report PDFs** for **10 current councils**
(**63 packages**), published under the catch-all `nsw-government` organisation, not under the
council's own organisation. Every package has exactly **one PDF resource** and **no** CSV/XLSX/API
resource. Licence is `Licence Specified by Agency` (`license_id: lsba`) — not an open licence. The
resource URLs are Internet Archive snapshots of the former `opengov.nsw.gov.au` download service.

| Council           | Packages | Years (range present)     | Format | Granularity                                      | Unit    | Licence                     | Machine-readable |
| ----------------- | -------: | ------------------------- | ------ | ------------------------------------------------ | ------- | --------------------------- | ---------------- |
| Bathurst Regional |        1 | 2014-15                   | PDF    | annual report (narrative; statements unverified) | unknown | Licence Specified by Agency | No               |
| Cabonne           |        3 | 2013-14, 2014-15, 2015/16 | PDF    | annual report incl. annexures                    | unknown | Licence Specified by Agency | No               |
| Campbelltown      |       26 | 1986-87 → 2014-15         | PDF    | annual report                                    | unknown | Licence Specified by Agency | No               |
| Cowra             |        1 | 2021-22                   | PDF    | annual report                                    | unknown | Licence Specified by Agency | No               |
| Kempsey           |        1 | 2014-15                   | PDF    | annual report                                    | unknown | Licence Specified by Agency | No               |
| Kiama             |        2 | 2017-18, 2018-19          | PDF    | annual report                                    | unknown | Licence Specified by Agency | No               |
| Lake Macquarie    |        1 | 2021-22                   | PDF    | annual report                                    | unknown | Licence Specified by Agency | No               |
| Port Stephens     |        1 | 2019-20                   | PDF    | annual report                                    | unknown | Licence Specified by Agency | No               |
| Strathfield       |        9 | 2006-07 → 2014-15         | PDF    | annual report                                    | unknown | Licence Specified by Agency | No               |
| Wollongong        |       18 | 2000-01 → 2017-18         | PDF    | annual report                                    | unknown | Licence Specified by Agency | No               |

Sample canonical package and resource (link-checked §7):

- Cowra 2021-22: <https://data.nsw.gov.au/data/dataset/3-19691-cowra-shire-council-annual-report-2021-22>
- Lake Macquarie 2021-22: <https://data.nsw.gov.au/data/dataset/3-19667-lake-macquarie-city-council-annual-report-2021-2022>
- Resource pattern: `https://wayback.archive-it.org/22771/20240423201346/https://www.opengov.nsw.gov.au/download/<id>`

**They are candidates only in the weak sense** that they are council documents on data.nsw. They are
not audited-financial-statement datasets: whether a given annual report embeds the full GPFS, a
summary, or only narrative is **not verified** in this pass (opening 63 PDFs would be an extraction
job, which this item excludes). Granularity is therefore recorded as "annual report, not a
statement-line dataset", not as statement lines.

## 4. Near-misses considered and rejected

| Dataset(s)                                                                                                                                                   | Why it is not a council financial source                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| "Financial audit report: Local Government 2019–2022", "Report on Local Government 2017/2018", "Monitoring Local Government" (Audit Office, `nsw-government`) | Narrative audit reports; no row-level council financial data. Context/validation only. |
| "Department of Local Government Annual Report 2003–04/2004–05", "Office of Local Government Annual Report 2014-15"                                           | Annual reports of the **state agency**, not council financial data.                    |
| 2008 Local Government Election council reports (~150 PDFs, `nsw-government`)                                                                                 | Election results/administration, not financial statements.                             |
| City of Sydney operational datasets (198 packages: business rate category, ticket parking rates, venues for hire, parking meters)                            | Rate _categories_ and price schedules, not revenue/expense statement lines.            |
| Lake Macquarie Netvox/Decentlab CSV/JSON                                                                                                                     | Environmental sensor telemetry.                                                        |
| "Penalty Notices for parking offences issued by Councils and NSW Police" (XLSX)                                                                              | State revenue/penalty counts, not council financial statements.                        |
| "NSW Council Roadside Reserves Conservation Values" (`local-government-nsw`)                                                                                 | Environmental/GIS data.                                                                |
| ABS and Treasury organisation datasets                                                                                                                       | State/aggregate benchmarks, not council-level.                                         |

## 5. Zero-result list

- **All 128 councils: zero statement-line financial datasets** on data.nsw (no CSV, XLSX, API or
  PDF financial-statement _dataset_).
- **118 of 128 councils: zero annual-report packages** whose title names the council. The 10 with
  PDFs are in §3; an ambiguously titled "Annual Report YYYY" was not counted as a council document.
- **8 councils have no data.nsw organisation at all:** Lane Cove, Shellharbour, Gilgandra, Cobar,
  Glen Innes Severn, Gwydir, Oberon, Inverell.
- **0 council organisations** publish a budget, expenditure, revenue, ledger, fees-and-charges or
  procurement dataset in machine-readable form.

## 6. API limits and ambiguities

1. **`organization_list` disagrees with the search facet.** `organization_list?all_fields=true`
   returns only **25** organisations, while `package_search` facets list **219**. The facet list is
   consistent with the 17,247-package total and includes every council organisation found, so the
   facet was used for enumeration. Anyone reproducing this must not assume `organization_list` is
   complete. (Root cause not investigated; likely a site configuration/indexing issue.)
2. **1,000-row cap.** `package_search` silently caps results at 1,000 regardless of `rows`; paging or
   per-organisation queries are required.
3. **Keyword search is unreliable.** `q=council financial statements` returns 395 hits that are
   mostly state entities, audits, flood studies and environmental statements. A hit is not evidence
   of council financial data; every candidate in this sweep was checked at title **and** resource
   level.
4. **Historical/legacy organisations.** Several council organisations are pre-merger bodies
   (e.g. `hornsby-shire-council`, `nambucca-shire-council`, `the-council-of-the-municipality-of-kiama`)
   and two current councils have duplicate organisations (`city-of-sydney`, `city-of-ryde`). Package
   counts per organisation are not a clean proxy for current-council coverage.
5. **Annual-report hosting is fragile and non-authoritative.** Resources point at Internet Archive
   snapshots of OpenGov NSW, not council sites; the snapshot is 2024 and may not match the council's
   current published GPFS. Licence is agency-specified, not CC BY.
6. **Contents not opened.** No PDF was parsed, so "not statement-line" is a metadata-level finding,
   not a page-level audit. It does not need to be resolved: a PDF-only source cannot supply
   machine-readable statement lines without the same per-council PDF work this item excludes.

## 7. Verification log

Run 17 November 2026. All requests HTTP 200 unless stated.

- `package_search q=*:*` — count `17247`.
- `organization` facet — `219` organisations; council-like filter — `125`; packages — `3025`.
- 128-council coverage — `120` matched, `8` without an organisation (list in §5).
- Per-organisation title/resource scan — `0` financial-statement/budget/expenditure datasets.
- `q=council financial statements` — `395` hits, `61` with "council" in the title, `0` council
  financial datasets.
- `title:(financial statements)` — `19`, all state agencies, all PDF.
- `title:(annual financial statements)` — `18`, all state agencies, all PDF.
- `title:(council annual report)` — `155`; `154` have both words; `63` are the 10 current councils
  in §3, all one-PDF packages, licence `lsba`.
- Dataset page `https://data.nsw.gov.au/data/dataset/3-19691-cowra-shire-council-annual-report-2021-22`
  — HTTP `200 text/html`.
- Dataset page `https://data.nsw.gov.au/data/dataset/3-19667-lake-macquarie-city-council-annual-report-2021-2022`
  — HTTP `200 text/html`.
- Resource `https://wayback.archive-it.org/22771/20240423201346/https://www.opengov.nsw.gov.au/download/20215`
  — HTTP `200 application/pdf`, 30,570,433 bytes (redirect 302 followed).
- DB unchanged, read-only check:

```bash
mongosh "mongodb://localhost:27017/ausspend_dev" --quiet --eval \
  'print(db.measures.countDocuments({})); print(db.measures.countDocuments({source_id:"dubbo-council"})); print(db.measures.countDocuments({source_id:"dubbo-council-gpfs"})); print(db.measures.countDocuments({source_id:"data-nsw-ckan"}));'
# 515467
# 245
# 18
# 3472
```

## 8. Overlap and double-count rules

- **Dubbo (`dubbo-council` / `dubbo-council-gpfs`):** no overlap. Dubbo is not one of the 10 councils
  with annual-report PDFs, and data.nsw has no Dubbo financial dataset. Nothing in this sweep is
  ingested, so the 245 budget/estimate rows and the 18 GPFS rows are untouched.
- **`data-nsw-ckan` (3,472 rows):** no overlap. Those rows are three **state** datasets (school RAM,
  Budget Paper 2 capital, state fleet). The annual-report PDFs in §3 are a different entity type and
  are not in the database; they must never be summed with state rows.
- **OLG `Your Council`:** different source and different licence (all rights reserved); not used here.
- **Rule for any later UI:** council spending ≠ state spending; never create a cross-council total
  or a state-plus-council total; a data.nsw annual report is a council document, not a state program.

## 9. Recommendation — no data.nsw extraction pilot

**Recommendation: NO-GO for a data.nsw council-financial extraction.** There is no machine-readable
candidate to pilot. The strongest available item (Cowra 2021-22, the most recent annual-report PDF)
is still a single PDF under a non-open "Licence Specified by Agency", with unverified statement
contents, and would require exactly the per-council PDF work the GPFS path already does — with worse
provenance than the council's own site.

**Next step:** continue **individual council GPFS batches** from council websites (P3 in
[NSW_COUNCILS.md §8](./NSW_COUNCILS.md#8-prioritised-rollout-after-the-pilot)), ranked by materiality,
one adapter/mapping per council. Keep `dubbo-council-gpfs` as the reference implementation. Treat
data.nsw annual reports as a **fallback index** for the 10 councils in §3 only, not as an ingestion
source, and do not add a data.nsw council connector.
