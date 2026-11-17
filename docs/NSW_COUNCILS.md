# NSW local councils — source inventory, double-count review and pilot plan

**Status:** planning and research only. This document starts no ingestion, creates no schema/API/DB
rows and queues no council PDF jobs. The database baseline is **515,449 measures**, unchanged; this
work touched docs only.

**As at:** 17 November 2026. **Scope:** NSW local government — the 128 general purpose councils —
not state government, and not a cross-council spending total.

---

## 0. Verdict on the premise (read this first)

**Claim under test:** a single official dataset covers all NSW councils at financial-statement
granularity.

**Verdict: false as stated.**

- **What does exist:** the NSW Office of Local Government (OLG) *Your Council* time-series workbook
  for 2024-25 contains **128 general purpose council rows** plus **8 county council rows**, with a
  wide council-level indicator matrix. It is derived from Financial Data Returns (FDRs) / financial
  statements, but it publishes **summary and service-category** figures, **not** General Purpose
  Financial Statement (GPFS) line items. It is also **not openly licensed** (OLG copyright is
  all-rights-reserved).
- **What does not exist:** any single official file, API or CKAN package with GPFS income-statement,
  balance-sheet, cash-flow, note and special-schedule lines for all 128 councils. Searches of
  data.nsw.gov.au CKAN, the OLG site, the Grants Commission pages and the Audit Office did not find
  one. Full statement-line coverage requires the **128 individual council GPFS PDFs**, one per
  council per year.
- **Consequence for the plan:** there is no safe "bulk ingest all councils at statement-line
  granularity" step. The pilot must prove the line-item path on one council first; the all-council
  OLG workbook can only be a summary/benchmark layer, and only if reuse permission is resolved.

This is the premise falsifier the brief asked for. The rest of the document records what each
source actually covers.

---

## 1. The 128 general purpose councils

The 2024-25 OLG time-series workbook has exactly **128** general purpose council rows (sheet 1,
rows 4–131), matching the OLG/Your Council statement that NSW has 128 general purpose councils
(<https://www.yourcouncil.nsw.gov.au/>). The OLG grouping below is read from columns B (OLG group)
and C (classification) of that workbook.

| OLG group | Classification | # | Councils |
| --- | --- | ---: | --- |
| 1 | Metropolitan | 1 | Sydney |
| 2 | Metropolitan | 6 | Burwood, Hunters Hill, Lane Cove, Mosman, Strathfield, Woollahra |
| 3 | Metropolitan | 18 | Bayside, Blacktown, Canada Bay, Canterbury-Bankstown, Cumberland, Fairfield, Georges River, Inner West, Ku-ring-gai, Liverpool, North Sydney, Northern Beaches, Parramatta, Randwick, Ryde, Sutherland, Waverley, Willoughby |
| 4 | Regional Town/City | 26 | Albury, Armidale Regional, Ballina, Bathurst Regional, Bega Valley, Broken Hill, Byron, Cessnock, Clarence Valley, Dubbo Regional, Eurobodalla, Goulburn Mulwaree, Griffith, Kempsey, Kiama, Lismore, Lithgow, Mid-Western Regional, Orange, Queanbeyan-Palerang Regional, Richmond Valley, Singleton, Snowy Monaro Regional, Tamworth Regional, Wagga Wagga, Wingecarribee |
| 5 | Regional Town/City | 11 | Coffs Harbour, Lake Macquarie, Maitland, Mid-Coast, Newcastle, Port Macquarie-Hastings, Port Stephens, Shellharbour, Shoalhaven, Tweed, Wollongong |
| 6 | Metropolitan Fringe | 2 | Hawkesbury, Wollondilly |
| 7 | Metropolitan Fringe | 7 | Blue Mountains, Camden, Campbelltown, Central Coast, Hornsby, Penrith, The Hills |
| 8 | Rural | 1 | Brewarrina |
| 9 | Rural | 14 | Balranald, Bogan, Bourke, Carrathool, Central Darling, Coolamon, Coonamble, Gilgandra, Hay, Lockhart, Murrumbidgee, Walcha, Warren, Weddin |
| 10 | Large Rural | 23 | Berrigan, Bland, Blayney, Cobar, Dungog, Edward River, Forbes, Glen Innes Severn, Gwydir, Junee, Kyogle, Lachlan, Liverpool Plains, Narrandera, Narromine, Oberon, Temora, Tenterfield, Upper Lachlan, Uralla, Walgett, Warrumbungle, Wentworth |
| 11 | Large Rural | 19 | Bellingen, Cabonne, Cootamundra-Gundagai Regional, Cowra, Federation, Greater Hume, Gunnedah, Hilltops, Inverell, Leeton, Moree Plains, Murray River, Muswellbrook, Nambucca Valley, Narrabri, Parkes, Snowy Valleys, Upper Hunter, Yass Valley |

**Count:** 1 + 6 + 18 + 26 + 11 + 2 + 7 + 1 + 14 + 23 + 19 = **128**.

The OLG classification/group definitions are linked from the Your Council data page
(<https://www.yourcouncil.nsw.gov.au/data/>), but the PDF itself was not fetched this pass:
`Australian-Classification-of-Local-Government-and-OLG-group-numbers.pdf` (link only, unverified).

---

## 2. Non-standard entities (not one of the 128)

| Entity class | Count / evidence | Why it is not a general purpose council |
| --- | --- | --- |
| County councils | **8 rows** in the 2024-25 workbook, sheet 2: Castlereagh-Macquarie County, Central Tablelands County, Goldenfields Water County, Hawkesbury River County WSW, Riverina Water County, Rous Water, Upper Hunter County, Upper Macquarie County | Statutory water/sewer (and some other) county councils owned by member councils, not general purpose councils. Their costs can be recovered through member council charges, so adding them to the 128 double counts. The same sheet's chart also names **New England Tablelands County**, so re-check the live count each year. |
| Joint Organisations (JOs) | **13** JOs covering **87 regional councils**: Canberra Region; Central NSW; Far North West; Far South West; Hunter; Illawarra Shoalhaven; Mid North Coast; Namoi; New England; Northern Rivers; Orana; Riverina and Murray; Riverina | Regional collaboration/planning bodies, not councils. Verified at <https://www.olg.nsw.gov.au/programs-and-initiatives/joint-organisations>. JO spending may be funded by member councils; do not add it to council totals. |
| Other non-LGA / state entities | Lord Howe Island Board; Unincorporated Far West (no council); Sydney Olympic Park Authority; Aboriginal Land Councils | Known structural exclusions, **not re-verified in this pass**. Do not assume they are part of the 128. |
| Local Government and Shires Associations / Regional Organisations of Councils | Listed as separate categories in the OLG Local Government directory | Peak/regional bodies, not councils. |

The OLG Local Government directory separately lists **Council**, **County Council**, **Joint
Organisation**, **Local Government and Shires Associations** and **Regional Organisations of
Councils** (<https://www.olg.nsw.gov.au/public/local-government-directory>). Only the first
category is the 128.

---

## 3. Source coverage at a glance

| Source | All 128 councils? | Statement-line GPFS? | Service/program split? | Capital $? | Grants $? | Open licence? | In DB now |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| OLG *Your Council* time-series (2024-25 XLSX) | **Yes** (128 + 8 county) | **No** | 9 service-expenditure categories | **No** (asset ratios only) | **No** (grants % of revenue only) | **No** (all rights reserved) | 0 |
| Individual council GPFS / annual reports | Yes, one PDF per council | **Yes** | Yes (function and nature, notes, special schedules) | Yes | Yes (grant revenue and special schedules) | Per council; usually not open | 0 (Dubbo rows are budget lines, not GPFS) |
| LGGC Financial Assistance Grants | Yes (general purpose councils) | No | No (grant allocation) | No | **Yes** (FAG entitlement) | No (OLG all rights reserved) | 0 |
| data.nsw.gov.au CKAN | No | No | No | No | No | Per dataset (usually CC BY) | 3,472 rows, none council financial |
| Audit Office of NSW local government reports | No (selected audits) | No | Narrative/aggregate | Occasionally | Occasionally | Audit Office terms | 0 |
| ABS GFS (benchmark) | No (local government aggregate) | No | COFOG aggregate | No | No | CC BY | 169 rows, aggregate |
| NSW Budget LGA-tagged projects | No (state projects) | No | Project-level state capital | Yes (state) | No | CC BY 3.0 AU | 1,115 rows, not council |

---

## 4. Source detail

### 4.1 OLG *Your Council* time-series — the only all-128 bulk source

**Official pages**

- Your council data and reports: <https://www.olg.nsw.gov.au/public/your-council-data-and-reports>
  (fetched, HTTP 200).
- Your Council website data page: <https://www.yourcouncil.nsw.gov.au/data/> (fetched, HTTP 200).
- 2024-25 workbook (XLSX):
  <https://www.olg.nsw.gov.au/sites/default/files/2026-05/time-series-data-2024-2025.xlsx>
  (fetched, HTTP 200, 205,895 bytes, SHA-256
  `11d79f8642a7610579dbcfcab68f9acd2c84e17b60ab7544ba846e6ebbc0cdc3`).

**Current rows at source.** Sheet 1 has **128 council rows** (rows 4–131); sheet 2 has **8 county
council rows**. The workbook also publishes 2015-16 through 2023-24 as separate XLSX/XLS files, a
1994–2015 time series XLS, an 2011-12–2013-14 XLSX, and archived comparative reports from 2006-07
to 2012-13. The 2024-25 sheet says (verbatim): *"The councils listed are those that continued
operations and reported for the financial year 2024 to 2025"* (A3).

**Granularity.** Council-level indicator matrix, not GPFS. It contains:

- **Demographics:** population, density, age, Aboriginal and Torres Strait Islander population,
  language, SEIFA, unemployment, taxable income, household size, largest industry employer,
  businesses, development applications.
- **Financial performance (FDR/financial statements):** `Total Expenses from Continuing Operations
  ($)`, `Total Revenue from Continuing Operations ($)`, `Net Operating Result Before Capital ($)`,
  and eight ratios (most marked `#N/A` / "Not Collected 2025" in this edition).
- **Rating revenue:** residential/farmland/business/mining rates, average rates, assessment counts,
  land value, pensioner concession.
- **Expenditure on services (FDR/financial statements):** nine dollar categories plus percentage
  and per-capita views — Governance & Administration; Public Order, Safety & Health; Environmental;
  Community Services, Education, Housing & Community Amenities; Recreational & Cultural; Roads,
  Bridges & Footpaths; Other Services; Water; Sewer.
- **Waste, services and assets:** water/sewer bills, waste charges and tonnages, companion animals,
  road length, open space, pools, halls, libraries, asset maintenance/renewal/backlog ratios.
- **Governance/workforce:** councillor expenses/fees/travel/conferences, GM remuneration, code of
  conduct complaints, councillor demographics, FTE staff.

**What it does not contain.** No employee, materials, depreciation, interest or other expense lines;
no income-statement line items beyond the four totals above; no balance sheet; no cash flow; no
**capital expenditure dollar** line (only "net operating result before capital" and asset ratios);
no **grant dollar** line (only "Grants & Contributions Revenue (%)"); no fund-level General/Water/
Sewer income statement; no project-level capital list.

**Units.** Dollars (`$`) for the financial columns, confirmed from the column headers and values
(e.g. Albury total expenses `179,413,000`). Percentages are stored as fractions (e.g. `0.2008`).
Area is km²; population is a count.

**Reporting dates.** Financial year ended **30 June 2025**; the workbook is published in **2026**
(URL path `2026-05`; XLSX metadata modified `2026-07-16`). Statutory dates from OLG: audited
financial reports to the Departmental Chief Executive by **31 October**; annual report including the
audited financial statements by **30 November** (s.428, Local Government Act 1993), per
<https://www.olg.nsw.gov.au/councils/finance/financial-reporting> (fetched, HTTP 200).

**Licence.** **Not open.** OLG's copyright page says (verbatim): *"All rights reserved. No part of
this publication may be reproduced by any process, electronic or otherwise, in any material form or
transmitted to any other person or stored electronically in any form, without the prior written
permission of the State of New South Wales, except as permitted under the Copyright Act 1968."*
(<https://www.olg.nsw.gov.au/copyright-and-disclaimer>, fetched, HTTP 200). The Your Council site
footer also says "© 2026 | All Rights Reserved | Office of Local Government". The data page adds that
OLG *"does not separately audit the data"* and relies on council returns. **Reuse for publication
requires written permission or a separately licensed copy.** This is a first-order constraint, not
a footnote.

**Feasibility without double counting.** Parsing is easy (one XLSX, stable layout). Publication is
blocked pending licence. The financial semantics are the real trap:

- `Total Expenses from Continuing Operations` (column AI) is the safest council-level operating
  expense total. It is missing for **Bland** (`Not complete FDR: Bland`, A133), leaving 127 values.
- The nine **service-category dollar columns do not reliably reconcile to that total.** Checked on
  all 128 rows: **66/128** reconcile exactly to $1; **73/128** within $1,000; **36/128** differ by
  more than $100,000. Largest absolute differences: **Hawkesbury +$169.979m**, **Waverley
  +$40.519m**, **Orange +$31.586m**, **Hornsby +$23.005m**, **Lismore +$20.045m**, **Kempsey
  +$16.877m**, **Walgett −$11.673m**. For Hawkesbury the Sewer category alone is `$169.979m` while
  total expenses are `$130.704m`, so the service categories are **not** a clean partition of the
  total; they appear to include capital or gross water/sewer transactions. On the rows checked
  (Hawkesbury, Orange, Waverley), the percentage columns sum to 100% while the dollar columns sum to
  a different base — so the dollar and percentage splits are internally consistent with each other,
  but not with `Total Expenses`.
- **Therefore:** publish at most one basis per council-year. If `Total Expenses` is used as the
  council total, do **not** also add the service categories to it. If the service split is used,
  derive its own denominator and label it separately, never as "total expenses".
- County council rows must be kept separate from the 128. Water county councils recover costs from
  member councils; adding both sides double counts.
- The workbook publishes no statewide total row. Do not create one.

**Dubbo reconciliation anchor (FY2024-25):** total expenses `$174,925,000`; total revenue
`$234,927,000`; net operating result before capital `+$276,000`. For Dubbo the nine service
categories *do* sum exactly to the total, which makes Dubbo one of the 66 reconciling rows — a good
pilot property, but not a general guarantee.

### 4.2 Individual council GPFS / annual reports — the only statement-line source

**What it is.** Each of the 128 councils publishes audited GPFS, usually as a standalone PDF or as
part of its annual report. The standard form is set by OLG's *Local Government Code of Accounting
Practice and Financial Reporting*: Section 1 (General Purpose Financial Statements), Section 3
(Special Purpose Financial Statements), Section 4 (Special Schedules) and Section 5 (Appendices).
The 2025-26 Section 1 PDF is linked from
<https://www.olg.nsw.gov.au/councils/finance/financial-reporting> (link only, not fetched this pass).

**Current rows at source.** 128 councils × one GPFS per financial year (plus prior-year
comparatives inside each report). **In DB: 0 GPFS rows.** The existing `dubbo-council` 245 rows are
2026/27 budget/forward-estimate lines, not GPFS actuals.

**Verified example (Dubbo Regional Council, FY2024-25).**

- Reporting page: <https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/reporting>
  (fetched, HTTP 200). It lists standalone financial statements for 2016-17 through 2025-26.
- FY2024-25 GPFS PDF:
  <https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/20242025%20-%20Annual%20Financial%20Statements%20-%20Final%20for%20website.PDF.aspx>
  (fetched, HTTP 200, 1,807,768 bytes, SHA-256
  `d9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f`).
- FY2025-26 GPFS PDF also exists on the same page (not fetched).

**Granularity.** Full statement lines: income statement (revenue by source; expenses by function and
by nature — employee, materials/contracts, depreciation, interest, other), balance sheet, cash-flow
statement, notes (including grant and contribution disclosures and related-party notes), and special
schedules (infrastructure, asset maintenance, borrowings, grants). Council-level consolidated plus,
where published, fund-level General/Water/Sewer statements.

**Units.** Usually `$'000`, but not universally; each PDF header must be read. The existing Dubbo
adapter already rejects ambiguous units, which is the right pattern.

**Licence.** Each council's own copyright. There is no standard open licence across the 128. Some
councils publish topic datasets on data.nsw under CC BY, but the GPFS PDF itself is usually not
explicitly licensed. The existing Dubbo basis is recorded as *"© Dubbo Regional Council. Published
council documents used here for public-interest research; not an open-data licence grant."* Treat
each council as a separate licence decision.

**Reporting dates.** Audited GPFS by **31 October**; annual report by **30 November**; FY ending
30 June. Publication dates and formats vary by council.

**Feasibility without double counting.** **High value, medium-high effort.** There is no central
file: 128 different PDF layouts, sometimes scanned, occasionally XLSX. Feasible only council by
council with a reconciliation gate to the published total. Within one GPFS:

- Expenses by function and expenses by nature are two cuts of the same total — never sum them.
- Consolidated includes General/Water/Sewer components — never sum the fund statements with
  consolidated.
- Grant revenue in the income statement and grant lines in the special schedules can overlap —
  do not add both.
- Capital grants and capital expenditure are not recurrent expense — keep them separate.

### 4.3 NSW Local Government Grants Commission (LGGC) — grants overlay only

**Official page.** <https://www.olg.nsw.gov.au/commissions-and-tribunals/local-government-grants-commission>
(fetched, HTTP 200).

**Current rows at source.** Annual **Financial Assistance Grant (FAG) payment/recommendation
schedules** for 2017-18 through 2025-26, plus annual reports for 2010-11 through 2020-21. The
2025-26 recommendation schedule and payment schedule are PDFs linked from that page (not fetched
this pass). No row-level dataset or API.

**Granularity.** Council-level FAG entitlement (general purpose and roads components, subject to
the schedule's columns); **not** council expenditure, not program/service, not capital.

**Units.** Dollars in PDF tables (verify each schedule).

**Licence.** OLG all-rights-reserved (same copyright page). Reuse needs permission.

**Reporting dates.** Annual, with advance-payment and recommendation schedules published around
March; 2026-27 advance-payment circular in June 2026.

**Feasibility without double counting.** Medium (PDF tables, stable layout). Useful as a **grants
overlay**: the FAG is income to a council and appears inside GPFS grant/contribution revenue, so it
must not be added to expenditure, and it must not be added on top of the same grant revenue line in
a GPFS view. It is also not state government spending in the platform's ordinary sense: it is
Commonwealth financial assistance administered through the NSW process. Keep the jurisdiction and
funding-source labels explicit.

### 4.4 data.nsw.gov.au CKAN — no consolidated council financial dataset

**Official portal/API.** <https://data.nsw.gov.au/data/> and
`https://data.nsw.gov.au/data/api/3/action/`.

**Current rows at source.** The portal has thousands of datasets; a targeted search found **no
consolidated NSW council GPFS dataset**. Council organisations on CKAN mostly publish topic data
(flood, waste, cycling, etc.). The platform's existing `data-nsw-ckan` source is 3,472 rows from
three selected **state** datasets:

| Dataset | Rows in DB | What it is |
| --- | ---: | --- |
| NSW public schools Resource Allocation Model (RAM) | 2,211 | School-level state funding allocation |
| NSW Budget Paper 2 capital allocations | 1,251 | State capital budget allocations |
| Fleet Vehicle expenditure FY18-19 | 10 | State fleet invoices |
| **Total** | **3,472** | **No council financial rows** |

**Granularity.** State agency/school/project/invoice, not council reporting. 855 rows carry an LGA
tag, but an LGA tag is a **location**, not a reporting entity.

**Units.** Per resource (`$`, `$'000` assumed for BP2). Licence is per dataset (the portal commonly
uses CC BY); the source register records a pointer, not a verified licence for every resource.

**Reporting dates.** Varies by dataset; the selected rows span 2014-15 to 2025-26.

**Feasibility without double counting.** Not a council spending source. The safe rule: **never sum
LGA-tagged state rows with council rows**; they are different reporting entities even when they
share a place label. Searching CKAN is still worth doing per council for machine-readable GPFS, but
do not assume a council's CKAN presence includes its financial statements.

### 4.5 Audit Office of NSW — context/validation, not a dataset

**Official page.** <https://www.audit.nsw.gov.au/our-work/reports> (fetched, HTTP 200). The site's
Local Government sector facet currently lists **59 reports**.

**Granularity.** Narrative audit reports, sometimes with council-level tables or aggregate sector
analysis; no row-level financial dataset. Not a bulk source.

**Use.** Validation/context (e.g. financial sustainability, audit findings) and a pointer to
councils with qualifications. Do not extract spending rows from audit narratives.

### 4.6 ABS GFS and state budget rows — benchmarks, not council spending

- **ABS GFS (`abs-gfs`, 169 rows in DB):** an aggregate government-finance benchmark, including a
  local-government aggregate in some tables. It is **not council-level** and cannot be split into
  the 128 councils. Use only as a macro cross-check; never add it to council rows.
- **NSW Budget / ArcGIS (`nsw-budget`, 1,115 rows in DB):** 312 state statement lines and 803 state
  capital projects. 560 project rows carry a single LGA and 243 publish `VARIOUS` (left absent).
  These are **state** projects located in an LGA, not council projects. Never sum them with council
  spending or treat an LGA tag as a council attribution.

---

## 5. Existing DB rows: overlap and double-count review

Read-only checks against `ausspend_dev` on 17 November 2026:

```text
db.measures.countDocuments({})                         -> 515449
db.measures.countDocuments({source_id:"dubbo-council"}) -> 245
db.measures.countDocuments({source_id:"data-nsw-ckan"}) -> 3472
```

### 5.1 Dubbo Regional Council (`dubbo-council`, 245 rows)

- **Source:** adopted 2026/27 Budget and Forward Forecasts PDF; fund-level Income and Expenditure
  Summary plus a capital-expenditure section; `$'000`; `measure_type` for 2026-27 is `budget`, the
  other years are `estimate`.
- **Fiscal years in DB:** 2025-26 (43 estimate rows), 2026-27 (72 budget rows), 2027-28 (44),
  2028-29 (44), 2029-30 (42).
- **Composition:** 124 income lines, 91 expense lines, 30 capital categories. Income rows are stored
  as measures but are **not spending**.
- **Fund double-count (important):** the 245 rows cover **Consolidated, General, Water and Sewer**.
  Consolidated includes the General/Water/Sewer components, so **summing all 245 rows double counts**.
  The fund is recorded in `notes` / `description` (e.g. `Income line item — Consolidated`), **not**
  as a structured field. Any council-level total must select one basis (Consolidated, or the
  components with elimination), never all rows.
- **Overlap with OLG 2024-25:** same council, different year and different granularity. OLG FY2024-25
  actual total expenses for Dubbo are `$174.925m`; Dubbo's DB rows are FY2025-26 forward estimate and
  FY2026-27 budget. They must never be summed or presented as one series. A same-year comparison is
  only possible after the FY2024-25 GPFS is extracted.
- **Overlap with the proposed GPFS pilot:** if Dubbo's FY2024-25 GPFS is ingested, the existing 245
  budget/estimate rows remain a **different measure type and year**; no row-level duplicate, but a
  UI "Dubbo spending" figure must choose one source/year and say which.

### 5.2 data.nsw.gov.au CKAN (`data-nsw-ckan`, 3,472 rows)

- **No council financial rows.** The three selected datasets are state RAM, state BP2 and state
  fleet. 855 rows have `location.lga_name`, but those are state programs located in an LGA.
- **Double count:** none with council spending at the row level, but an LGA-based filter that unions
  state and council rows would create a false "LGA spending" total. Keep the entity type visible.

### 5.3 NSW Budget (`nsw-budget`, 1,115 rows)

- 803 state capital projects; 560 with a single LGA, 243 `VARIOUS` left absent. Not council
  spending. A council-level view must exclude these rows even when the LGA matches.

---

## 6. Double-count map (the rules to carry into any future connector)

| A | B | Relationship | Rule |
| --- | --- | --- | --- |
| OLG `Total Expenses` | Council GPFS total expenses | Same underlying FDR/GPFS population | Use **one** as the authority per council-year; never add. |
| OLG service-category dollars | OLG `Total Expenses` | Not a clean partition (61/128 differ; up to +$169.979m) | Never add; label the service split on its own base. |
| OLG service categories | Each other | Intended partition, but not guaranteed | Only sum if the council-year reconciles; otherwise show components separately. |
| Dubbo Consolidated | Dubbo General/Water/Sewer | Consolidated includes components | Never sum; pick one basis. |
| Dubbo income lines | Dubbo expense lines | Income is not spending | Filter income out of any spending view. |
| Dubbo 2025-26 estimate / 2026-27 budget | OLG FY2024-25 actual | Different measure type and year | Never sum; show separately. |
| data.nsw LGA-tagged state rows | Council rows | Different reporting entity | Never sum; LGA is a location. |
| NSW Budget LGA-tagged projects | Council capital | State projects, not council | Never sum or attribute to a council budget. |
| LGGC FAG | GPFS grant revenue | FAG is a component of council grant income | Do not add to expenditure; do not double count inside grants. |
| County council water/sewer | Member council water/sewer | Cost recovery through member charges | Keep separate; adding both double counts. |
| Joint Organisation spend | Member council spend | JO funded by members/state | Keep separate. |
| ABS GFS local-government aggregate | Council rows | Aggregate vs entity | Never add; benchmark only. |

---

## 7. Pilot recommendation (one pilot)

**Pilot: Dubbo Regional Council, audited GPFS for FY2024-25 — line-item extraction, no ingestion.**

**Why this pilot, and not a 128-council bulk job:**

1. It is the **only way to get statement-line granularity**; the premise falsifier shows no official
   bulk dataset provides it for all 128.
2. Dubbo is already the one council in the DB (245 budget/estimate rows), so it is the cheapest
   reconciliation: same council identity, and the OLG FY2024-25 row gives an independent total
   (`$174,925,000` expenses / `$234,927,000` revenue) to reconcile against.
3. The GPFS is a **standalone, verified PDF** (1.8 MB, SHA-256 above), not a 200-page annual report.
4. It forces the platform to solve the real problems first: income vs expense, consolidated vs fund
   elimination, operating vs capital, grant revenue vs special schedules, `$'000` vs `$`.
5. It avoids taking a publication decision on the all-rights-reserved OLG workbook in the first step.

**Pilot scope (next item, not this one):**

- Parse the FY2024-25 income statement (revenue by source; expenses by function and by nature),
  the notes' grant/contribution disclosures and the special schedules.
- Emit rows with an explicit `fund`, `statement`, `line_item`, `measure_type: "actual"`,
  `fiscal_year: "2024-25"`, `source_id: "dubbo-council"` and a reconciliation flag.
- Reconcile total expenses to `$174,925,000` and total revenue to `$234,927,000` (OLG FY2024-25).
- Demonstrate the income/expense split and the Consolidated-vs-fund elimination.
- Success criterion: every emitted line reconciles to a published subtotal; no cross-council total;
  no mixing with the existing 2025-26/2026-27 budget rows.

**Fallback:** if Dubbo's PDF proves too irregular, use another single council with a clean,
machine-readable GPFS (prefer one that publishes XLSX or a text-layer PDF), but keep the same
reconciliation discipline.

---

## 8. Prioritised rollout (after the pilot)

1. **P0 — Dubbo FY2024-25 GPFS (pilot).** Prove statement-line extraction and reconciliation.
2. **P1 — OLG FY2024-25 bulk summary for all 128 (conditional).** Only if written permission or an
   openly licensed copy exists. Ingest only the safe columns: total expenses, total revenue, net
   operating result before capital, plus the service split as a **separate non-additive table**.
   Keep the 8 county councils separate. Flag Bland as incomplete. Do not create a statewide total.
3. **P2 — LGGC 2025-26 FAG council-level overlay (conditional on OLG permission).** Grants only;
   reconcile to GPFS grant revenue; label Commonwealth-funded, state-administered.
4. **P3 — GPFS expansion by materiality.** Rank the 128 by FY2024-25 `Total Expenses` (from the OLG
   workbook, after permission) and take the top 20 first; within that, prefer councils with
   machine-readable GPFS. Then regional cities, then rural. One adapter/mapping per council; never a
   blind 128-PDF batch.
5. **P4 — data.nsw sweep per council.** Check each council's CKAN organisation for machine-readable
   financial data; most will not have it; do not infer.
6. **Do not** ingest County Councils or Joint Organisations into the 128-council population. If they
   are ever added, model them as separate entity types with their own no-double-count rules.

**Presentation rules for any later UI:** council spending is **not** state spending; no cross-council
total; no ranking that implies a like-for-like total (the OLG page itself warns that circumstances
differ); always show the source, year, measure type and fund/basis.

---

## 9. Verification log

**Fetched successfully (HTTP 200) this pass:**

- OLG Your council data and reports — <https://www.olg.nsw.gov.au/public/your-council-data-and-reports>
- OLG 2024-25 time-series XLSX — <https://www.olg.nsw.gov.au/sites/default/files/2026-05/time-series-data-2024-2025.xlsx>
  (205,895 bytes; SHA-256 `11d79f8642a7610579dbcfcab68f9acd2c84e17b60ab7544ba846e6ebbc0cdc3`)
- OLG copyright — <https://www.olg.nsw.gov.au/copyright-and-disclaimer>
- OLG financial reporting — <https://www.olg.nsw.gov.au/councils/finance/financial-reporting>
- OLG Joint Organisations — <https://www.olg.nsw.gov.au/programs-and-initiatives/joint-organisations>
- OLG Local Government directory — <https://www.olg.nsw.gov.au/public/local-government-directory>
- OLG LGGC — <https://www.olg.nsw.gov.au/commissions-and-tribunals/local-government-grants-commission>
- Your Council home — <https://www.yourcouncil.nsw.gov.au/>
- Your Council data — <https://www.yourcouncil.nsw.gov.au/data/>
- Dubbo reporting page — <https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/reporting>
- Dubbo FY2024-25 GPFS PDF — URL above (1,807,768 bytes; SHA-256
  `d9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f`)
- Audit Office reports — <https://www.audit.nsw.gov.au/our-work/reports>
- data.nsw CKAN API — `package_search` queries for "local government council", "local government
  financial", "time series council", "council expenditure", "financial data return", "grants
  commission council".

**Workbook checks run (read-only, local):**

- Sheet 1 rows 4–131 = 128 council names; sheet 2 rows 4–11 = 8 county council names.
- Financial column AI (`Total Expenses from Continuing Operations`) present for 127/128; Bland
  missing (`Not complete FDR: Bland`).
- Nine service-category dollar columns compared with AI: 66 exact to $1, 73 within $1,000,
  36 differ by > $100,000; largest differences listed in §4.1.
- Dubbo FY2024-25: total expenses `$174,925,000`; total revenue `$234,927,000`; net operating result
  before capital `+$276,000`; nine categories sum exactly to total expenses.

**DB checks (read-only):**

```bash
mongosh "mongodb://10.10.10.30:27017/ausspend_dev" --quiet --eval \
  'print(db.measures.countDocuments({})); print(db.measures.countDocuments({source_id:"dubbo-council"})); print(db.measures.countDocuments({source_id:"data-nsw-ckan"}));'
# 515449
# 245
# 3472
```

No write, update, delete, index or schema operation was performed. The worktree diff for this item
is docs-only.

---

## 10. Ambiguities / open questions (verbatim where possible)

1. **OLG licence.** *"All rights reserved. No part of this publication may be reproduced by any
   process, electronic or otherwise, in any material form or transmitted to any other person or
   stored electronically in any form, without the prior written permission of the State of New South
   Wales..."* — Can the owner obtain written permission, or is there an openly licensed copy of the
   time-series? Without this, P1 cannot be published.
2. **OLG data quality.** *"The accuracy of this website is largely dependent upon the accuracy and
   completeness of data returns lodged by councils. The Office of Local Government (OLG) does not
   separately audit the data, but we do conduct extensive testing for validity and reasonableness."*
   — FDR-derived totals are not audited by OLG; the GPFS is the audited source. Which is the
   authority for a published council total?
3. **Service-category semantics.** The workbook labels them *"Your Council's Expenditure on
   Services- FDR/financial statements"*, but the dollar columns do not reconcile to *"Total Expenses
   from Continuing Operations"* for 61/128 councils (Hawkesbury Sewer `$169.979m` vs total
   `$130.704m`). Are they operating, capital-inclusive, or gross water/sewer? The definitions PDF was
   not parsed this pass; this is unresolved.
4. **Bland.** *"Not complete FDR: Bland"* (A133), *"* Includes Termination Payout"* (A134), *"Note:
   Performance Ratios not collected due to reported COP"* (A135). Should Bland be excluded, carried
   forward, or shown as incomplete?
5. **County councils.** The 2024-25 sheet has 8 rows, but the chart names New England Tablelands
   County as well. What is the current legal list, and should water county councils be modelled
   separately (likely yes)?
6. **Dubbo fund separation.** The 245 existing rows include Consolidated, General, Water and Sewer,
   but the fund is only in `notes`/`description`, not a structured field. Should the platform add a
   fund field and select one basis before any council total?
7. **Dubbo licence.** *"© Dubbo Regional Council. Published council documents used here for
   public-interest research; not an open-data licence grant."* — the same question applies to the
   other 127 councils; is per-council public-interest use acceptable, or is permission needed?
8. **No cross-council totals.** The brief says no aggregate across councils. Does the platform need
   any sector-level view at all, and if so, can it be a clearly labelled OLG benchmark rather than a
   computed total?
9. **Council vs state.** Council spending is not state spending. Should council rows live under a new
   `jurisdiction_level: "local"` (or similar) so they can never be summed with state/federal rows by
   accident?

---

## 11. What this document deliberately does not do

- It does not ingest, parse or queue any council PDF.
- It does not add schema fields, API endpoints, DB rows, indexes or migrations.
- It does not create a cross-council or state-plus-council total.
- It does not assert a licence for the OLG or council documents beyond the quoted terms.
- It does not claim the 128 list is frozen: boundary changes, amalgamations and administrators can
  change the population, so re-read the OLG workbook each year.
