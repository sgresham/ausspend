# NSW local councils — source inventory, double-count review and pilot plan

**Status:** the inventory and plan below are unchanged. Five council GPFS extractions have landed as
separate non-additive sources. The Dubbo FY2024-25 pilot (§7.1) added exactly **18**
`dubbo-council-gpfs` rows (baseline **515,449** → **515,467**); the City of Sydney FY2024-25 GPFS
(**§7.2**) then added exactly **18** `city-of-sydney-gpfs` rows (**515,467** → **515,485**); the
Blacktown City Council FY2024-25 GPFS (**§7.3**) then added exactly **17** `blacktown-gpfs` rows
(**515,485** → **515,502**); the City of Parramatta FY2024-25 GPFS (**§7.4**) then added exactly
**17** `parramatta-gpfs` rows (**515,502** → **515,519**); Northern Beaches Council FY2024-25 GPFS
(**§7.5**) then added exactly **18** `northern-beaches-gpfs` rows (**515,519** → **515,537**). The
existing 245 `dubbo-council` budget/estimate rows, the 2 pre-existing AusTender federal contract rows
whose `delivery_entity` happens to be "City of Sydney", the 2 AusTender + 1 GrantConnect rows whose
`delivery_entity` happens to be "Blacktown City Council", the 215
AusTender/data.nsw/GrantConnect/QGIP/ACNC rows whose `delivery_entity` mentions "Parramatta", the 179
AusTender/data.nsw/GrantConnect/QGIP/ACNC rows whose `delivery_entity` mentions "Northern Beaches",
and every other source are preserved untouched and are never summed with the GPFS rows.

**As at:** 17 November 2026. **Scope:** NSW local government — the 128 general purpose councils —
not state government, and not a cross-council spending total.

---

## 0. Verdict on the premise (read this first)

**Claim under test:** a single official dataset covers all NSW councils at financial-statement
granularity.

**Verdict: false as stated.**

- **What does exist:** the NSW Office of Local Government (OLG) _Your Council_ time-series workbook
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

| OLG group | Classification      |   # | Councils                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------- | --: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Metropolitan        |   1 | Sydney                                                                                                                                                                                                                                                                                                                                                                      |
| 2         | Metropolitan        |   6 | Burwood, Hunters Hill, Lane Cove, Mosman, Strathfield, Woollahra                                                                                                                                                                                                                                                                                                            |
| 3         | Metropolitan        |  18 | Bayside, Blacktown, Canada Bay, Canterbury-Bankstown, Cumberland, Fairfield, Georges River, Inner West, Ku-ring-gai, Liverpool, North Sydney, Northern Beaches, Parramatta, Randwick, Ryde, Sutherland, Waverley, Willoughby                                                                                                                                                |
| 4         | Regional Town/City  |  26 | Albury, Armidale Regional, Ballina, Bathurst Regional, Bega Valley, Broken Hill, Byron, Cessnock, Clarence Valley, Dubbo Regional, Eurobodalla, Goulburn Mulwaree, Griffith, Kempsey, Kiama, Lismore, Lithgow, Mid-Western Regional, Orange, Queanbeyan-Palerang Regional, Richmond Valley, Singleton, Snowy Monaro Regional, Tamworth Regional, Wagga Wagga, Wingecarribee |
| 5         | Regional Town/City  |  11 | Coffs Harbour, Lake Macquarie, Maitland, Mid-Coast, Newcastle, Port Macquarie-Hastings, Port Stephens, Shellharbour, Shoalhaven, Tweed, Wollongong                                                                                                                                                                                                                          |
| 6         | Metropolitan Fringe |   2 | Hawkesbury, Wollondilly                                                                                                                                                                                                                                                                                                                                                     |
| 7         | Metropolitan Fringe |   7 | Blue Mountains, Camden, Campbelltown, Central Coast, Hornsby, Penrith, The Hills                                                                                                                                                                                                                                                                                            |
| 8         | Rural               |   1 | Brewarrina                                                                                                                                                                                                                                                                                                                                                                  |
| 9         | Rural               |  14 | Balranald, Bogan, Bourke, Carrathool, Central Darling, Coolamon, Coonamble, Gilgandra, Hay, Lockhart, Murrumbidgee, Walcha, Warren, Weddin                                                                                                                                                                                                                                  |
| 10        | Large Rural         |  23 | Berrigan, Bland, Blayney, Cobar, Dungog, Edward River, Forbes, Glen Innes Severn, Gwydir, Junee, Kyogle, Lachlan, Liverpool Plains, Narrandera, Narromine, Oberon, Temora, Tenterfield, Upper Lachlan, Uralla, Walgett, Warrumbungle, Wentworth                                                                                                                             |
| 11        | Large Rural         |  19 | Bellingen, Cabonne, Cootamundra-Gundagai Regional, Cowra, Federation, Greater Hume, Gunnedah, Hilltops, Inverell, Leeton, Moree Plains, Murray River, Muswellbrook, Nambucca Valley, Narrabri, Parkes, Snowy Valleys, Upper Hunter, Yass Valley                                                                                                                             |

**Count:** 1 + 6 + 18 + 26 + 11 + 2 + 7 + 1 + 14 + 23 + 19 = **128**.

The OLG classification/group definitions are linked from the Your Council data page
(<https://www.yourcouncil.nsw.gov.au/data/>), but the PDF itself was not fetched this pass:
`Australian-Classification-of-Local-Government-and-OLG-group-numbers.pdf` (link only, unverified).

---

## 2. Non-standard entities (not one of the 128)

| Entity class                                                                  | Count / evidence                                                                                                                                                                                                                             | Why it is not a general purpose council                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| County councils                                                               | **8 rows** in the 2024-25 workbook, sheet 2: Castlereagh-Macquarie County, Central Tablelands County, Goldenfields Water County, Hawkesbury River County WSW, Riverina Water County, Rous Water, Upper Hunter County, Upper Macquarie County | Statutory water/sewer (and some other) county councils owned by member councils, not general purpose councils. Their costs can be recovered through member council charges, so adding them to the 128 double counts. The same sheet's chart also names **New England Tablelands County**, so re-check the live count each year. |
| Joint Organisations (JOs)                                                     | **13** JOs covering **87 regional councils**: Canberra Region; Central NSW; Far North West; Far South West; Hunter; Illawarra Shoalhaven; Mid North Coast; Namoi; New England; Northern Rivers; Orana; Riverina and Murray; Riverina         | Regional collaboration/planning bodies, not councils. Verified at <https://www.olg.nsw.gov.au/programs-and-initiatives/joint-organisations>. JO spending may be funded by member councils; do not add it to council totals.                                                                                                     |
| Other non-LGA / state entities                                                | Lord Howe Island Board; Unincorporated Far West (no council); Sydney Olympic Park Authority; Aboriginal Land Councils                                                                                                                        | Known structural exclusions, **not re-verified in this pass**. Do not assume they are part of the 128.                                                                                                                                                                                                                          |
| Local Government and Shires Associations / Regional Organisations of Councils | Listed as separate categories in the OLG Local Government directory                                                                                                                                                                          | Peak/regional bodies, not councils.                                                                                                                                                                                                                                                                                             |

The OLG Local Government directory separately lists **Council**, **County Council**, **Joint
Organisation**, **Local Government and Shires Associations** and **Regional Organisations of
Councils** (<https://www.olg.nsw.gov.au/public/local-government-directory>). Only the first
category is the 128.

---

## 3. Source coverage at a glance

| Source                                        | All 128 councils?               | Statement-line GPFS? | Service/program split?                              | Capital $?                 | Grants $?                                 | Open licence?                 |                                                         In DB now |
| --------------------------------------------- | ------------------------------- | -------------------- | --------------------------------------------------- | -------------------------- | ----------------------------------------- | ----------------------------- | ----------------------------------------------------------------: |
| OLG _Your Council_ time-series (2024-25 XLSX) | **Yes** (128 + 8 county)        | **No**               | 9 service-expenditure categories                    | **No** (asset ratios only) | **No** (grants % of revenue only)         | **No** (all rights reserved)  |                                                                 0 |
| Individual council GPFS / annual reports      | Yes, one PDF per council        | **Yes**              | Yes (function and nature, notes, special schedules) | Yes                        | Yes (grant revenue and special schedules) | Per council; usually not open | **18** (Dubbo FY2024-25 GPFS pilot; separate non-additive source) |
| LGGC Financial Assistance Grants              | Yes (general purpose councils)  | No                   | No (grant allocation)                               | No                         | **Yes** (FAG entitlement)                 | No (OLG all rights reserved)  |                                                                 0 |
| data.nsw.gov.au CKAN                          | No                              | No                   | No                                                  | No                         | No                                        | Per dataset (usually CC BY)   |                                3,472 rows, none council financial |
| Audit Office of NSW local government reports  | No (selected audits)            | No                   | Narrative/aggregate                                 | Occasionally               | Occasionally                              | Audit Office terms            |                                                                 0 |
| ABS GFS (benchmark)                           | No (local government aggregate) | No                   | COFOG aggregate                                     | No                         | No                                        | CC BY                         |                                               169 rows, aggregate |
| NSW Budget LGA-tagged projects                | No (state projects)             | No                   | Project-level state capital                         | Yes (state)                | No                                        | CC BY 3.0 AU                  |                                           1,115 rows, not council |

---

## 4. Source detail

### 4.1 OLG _Your Council_ time-series — the only all-128 bulk source

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
to 2012-13. The 2024-25 sheet says (verbatim): _"The councils listed are those that continued
operations and reported for the financial year 2024 to 2025"_ (A3).

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

**Licence.** **Not open.** OLG's copyright page says (verbatim): _"All rights reserved. No part of
this publication may be reproduced by any process, electronic or otherwise, in any material form or
transmitted to any other person or stored electronically in any form, without the prior written
permission of the State of New South Wales, except as permitted under the Copyright Act 1968."_
(<https://www.olg.nsw.gov.au/copyright-and-disclaimer>, fetched, HTTP 200). The Your Council site
footer also says "© 2026 | All Rights Reserved | Office of Local Government". The data page adds that
OLG _"does not separately audit the data"_ and relies on council returns. **Reuse for publication
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
categories _do_ sum exactly to the total, which makes Dubbo one of the 66 reconciling rows — a good
pilot property, but not a general guarantee.

### 4.2 Individual council GPFS / annual reports — the only statement-line source

**What it is.** Each of the 128 councils publishes audited GPFS, usually as a standalone PDF or as
part of its annual report. The standard form is set by OLG's _Local Government Code of Accounting
Practice and Financial Reporting_: Section 1 (General Purpose Financial Statements), Section 3
(Special Purpose Financial Statements), Section 4 (Special Schedules) and Section 5 (Appendices).
The 2025-26 Section 1 PDF is linked from
<https://www.olg.nsw.gov.au/councils/finance/financial-reporting> (link only, not fetched this pass).

**Current rows at source.** 128 councils × one GPFS per financial year (plus prior-year
comparatives inside each report). **In DB: 88 GPFS rows** — 18 for Dubbo FY2024-25
(`dubbo-council-gpfs`, §7.1), 18 for the City of Sydney FY2024-25 (`city-of-sydney-gpfs`, §7.2), 17
for Blacktown City Council FY2024-25 (`blacktown-gpfs`, §7.3), 17 for City of Parramatta FY2024-25
(`parramatta-gpfs`, §7.4) and 18 for Northern Beaches Council FY2024-25 (`northern-beaches-gpfs`,
§7.5) — all separate source ids. The
existing `dubbo-council` 245 rows are 2026/27 budget/forward-estimate lines, not GPFS actuals, and
are not touched or summed with the GPFS rows.

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
explicitly licensed. The existing Dubbo basis is recorded as _"© Dubbo Regional Council. Published
council documents used here for public-interest research; not an open-data licence grant."_ Treat
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

| Dataset                                            | Rows in DB | What it is                            |
| -------------------------------------------------- | ---------: | ------------------------------------- |
| NSW public schools Resource Allocation Model (RAM) |      2,211 | School-level state funding allocation |
| NSW Budget Paper 2 capital allocations             |      1,251 | State capital budget allocations      |
| Fleet Vehicle expenditure FY18-19                  |         10 | State fleet invoices                  |
| **Total**                                          |  **3,472** | **No council financial rows**         |

**Granularity.** State agency/school/project/invoice, not council reporting. 855 rows carry an LGA
tag, but an LGA tag is a **location**, not a reporting entity.

**Units.** Per resource (`$`, `$'000` assumed for BP2). Licence is per dataset (the portal commonly
uses CC BY); the source register records a pointer, not a verified licence for every resource.

**Reporting dates.** Varies by dataset; the selected rows span 2014-15 to 2025-26.

**Feasibility without double counting.** Not a council spending source. The safe rule: **never sum
LGA-tagged state rows with council rows**; they are different reporting entities even when they
share a place label. Searching CKAN is still worth doing per council for machine-readable GPFS, but
do not assume a council's CKAN presence includes its financial statements. The P4 per-organisation
sweep found **no** council financial-statement dataset in any format (only 63 annual-report PDFs for
10 councils); see [NSW_COUNCIL_DATA_NSW_SWEEP.md](./NSW_COUNCIL_DATA_NSW_SWEEP.md).

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
- **Overlap with the GPFS pilot:** the pilot is now ingested as a **distinct source**
  (`dubbo-council-gpfs`) with 18 non-additive `agency_detail` rows. The existing 245 budget/estimate
  rows remain a different measure type year; no row-level duplicate. The GPFS rows carry no
  `region_id`/LGA field, so the Dubbo area panel cannot sum them with the 245 summary rows; any UI
  "Dubbo spending" figure must choose one source/year and say which.

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

| A                                       | B                           | Relationship                                            | Rule                                                                           |
| --------------------------------------- | --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| OLG `Total Expenses`                    | Council GPFS total expenses | Same underlying FDR/GPFS population                     | Use **one** as the authority per council-year; never add.                      |
| OLG service-category dollars            | OLG `Total Expenses`        | Not a clean partition (61/128 differ; up to +$169.979m) | Never add; label the service split on its own base.                            |
| OLG service categories                  | Each other                  | Intended partition, but not guaranteed                  | Only sum if the council-year reconciles; otherwise show components separately. |
| Dubbo Consolidated                      | Dubbo General/Water/Sewer   | Consolidated includes components                        | Never sum; pick one basis.                                                     |
| Dubbo income lines                      | Dubbo expense lines         | Income is not spending                                  | Filter income out of any spending view.                                        |
| Dubbo 2025-26 estimate / 2026-27 budget | OLG FY2024-25 actual        | Different measure type and year                         | Never sum; show separately.                                                    |
| data.nsw LGA-tagged state rows          | Council rows                | Different reporting entity                              | Never sum; LGA is a location.                                                  |
| NSW Budget LGA-tagged projects          | Council capital             | State projects, not council                             | Never sum or attribute to a council budget.                                    |
| LGGC FAG                                | GPFS grant revenue          | FAG is a component of council grant income              | Do not add to expenditure; do not double count inside grants.                  |
| County council water/sewer              | Member council water/sewer  | Cost recovery through member charges                    | Keep separate; adding both double counts.                                      |
| Joint Organisation spend                | Member council spend        | JO funded by members/state                              | Keep separate.                                                                 |
| ABS GFS local-government aggregate      | Council rows                | Aggregate vs entity                                     | Never add; benchmark only.                                                     |

---

## 7. Pilot recommendation (one pilot)

**Pilot: Dubbo Regional Council, audited GPFS for FY2024-25 — line-item extraction (landed; see §7.1).**

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

**Pilot scope (landed 2026-11-17; see §7.1):**

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

### 7.1 Pilot result — Dubbo FY2024-25 GPFS (landed 2026-11-17)

**Source.** Discovered from the official reporting page
<https://www.dubbo.nsw.gov.au/About-Council/Our-Responsibilities/reporting> (no hard-coded PDF URL):
the link text **"2024/2025 Dubbo Regional Council Financial Statements"** resolves to
<https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/20242025%20-%20Annual%20Financial%20Statements%20-%20Final%20for%20website.PDF.aspx>.
Exact bytes archived outside the repo at
`~/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2024-25.pdf`: **1,807,768
bytes**, SHA-256
`d9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f`. The printed unit is explicit
`$ '000` (thousands) on both the income statement (p4 of 79) and note B1-1 (p13 of 79); a missing or
conflicting unit rejects the whole extraction.

**Exact reconciliation.** The PDF prints the income statement total revenue and a separate total
expenses excluding depreciation; note B1-1 prints the full expense total. The connector accepts the
rows only when all of these agree exactly:

| Check                                                                                                                       |                               Printed / derived | Result                                    |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------: | ----------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                  |                             `$234,927` thousand | = `$234,927,000`                          |
| B1-1 Total functions and activities — income                                                                                |                             `$234,927` thousand | = face statement                          |
| Revenue components sum (rates + user charges + other revenue + operating grants + capital grants + interest + other income) |                             `$234,927` thousand | = printed total                           |
| Total expenses excluding depreciation (printed) + depreciation/amortisation/impairment (printed)                            |    `$117,066` + `$57,859` = `$174,925` thousand | = B1-1 expense total                      |
| B1-1 Total functions and activities — expenses                                                                              |                             `$174,925` thousand | = `$174,925,000` (OLG)                    |
| Operating result / net operating result                                                                                     |                              `$60,002` thousand | = income − expenses                       |
| Net result before capital grants                                                                                            |                                 `$276` thousand | = `$60,002` − `$59,726` capital grants    |
| B1-1 grants and contributions                                                                                               |                              `$79,787` thousand | = operating `$20,061` + capital `$59,726` |
| OLG FY2024-25 anchors                                                                                                       | expenses `$174,925,000`; revenue `$234,927,000` | **exact match**                           |

**Rows.** 18 rows, source id `dubbo-council-gpfs`, `source_dataset` "Dubbo Regional Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Dubbo Regional Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$234,927,000`, total expenses `$174,925,000`, employee expenses `$49,204,000`,
depreciation/amortisation/impairment `$57,859,000`, operating government grants `$20,061,000`,
capital government grants `$59,726,000` and net result `$60,002,000`; the face-statement revenue and
expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and the Dubbo area panel therefore
exclude them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be
summed into the existing 245 `dubbo-council` budget/estimate rows. The 245 rows are preserved exactly
(count 245 before and after). A second ingest run upserted the same 18 natural keys and left the DB
total unchanged (idempotent). Government grant rows carry `potential_double_count: true` because they
may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-17).** `measures` 515,449 → **515,467** (exactly +18); `dubbo-council`
still **245**; `dubbo-council-gpfs` **18**; `data_sources` 26 → **27**. No deletes or updates to any
other source.

### 7.2 Second council — City of Sydney FY2024-25 GPFS (landed 2026-11-17)

**Source.** Discovered from the official annual-report page
<https://www.cityofsydney.nsw.gov.au/research-reports/annual-report> (no hard-coded document URL):
the link text **"Financial statements 2024/25"** resolves to
<https://www.cityofsydney.nsw.gov.au/-/media/corporate/files/publications/research-and-reports/annual-reports/city-of-sydney-financial-statements-2024-2025.pdf?download=true>
(published 20 November 2025; statements authorised for issue by Council on 27 October 2025). Exact
bytes archived outside the repo at
`~/ausspend-source-archive/city-of-sydney-gpfs/city-of-sydney-financial-statements-2024-25.pdf`:
**2,285,656 bytes**, SHA-256
`b52e7a1ecdde5bea6937f2d3040e04ed340a6db8cceb959d51c73e84504f623b`. The printed unit is explicit
`$ '000` (thousands) on the income statement (p6), the Statement of Comprehensive Income (p7) and
note B1-1 (p16); a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The PDF prints a three-column income statement (Budget 2025 before the
line label; Actual 2025 and Actual 2024 after it). The connector takes the first amount after each
printed label, i.e. the FY2024-25 actual, and emits nothing unless all of these agree exactly:

| Check                                                                                                                       |                             Printed / derived | Result                                     |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------: | ------------------------------------------ |
| Total income from continuing operations (Income Statement p6)                                                               |                           `$909,748` thousand | = `$909,748,000`                           |
| Revenue components sum (rates + user charges + other revenue + operating grants + capital grants + interest + other income) |                           `$909,748` thousand | = printed total                            |
| B1-1 Total functions and activities — income                                                                                |                           `$909,748` thousand | = face statement                           |
| Total expenses excluding depreciation (printed p6)                                                                          |                           `$646,072` thousand | = expense components sum                   |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$130,214`)                         | `$646,072` + `$130,214` = `$776,286` thousand | = B1-1 expense total                       |
| B1-1 Total functions and activities — expenses                                                                              |                           `$776,286` thousand | printed total (not component-summed)       |
| B1-1 operating result / Income Statement net operating result                                                               |                           `$133,462` thousand | = `$909,748 − $776,286`                    |
| Statement of Comprehensive Income net result                                                                                |                           `$133,462` thousand | = Income Statement net result              |
| B1-1 grants and contributions                                                                                               |                           `$126,983` thousand | = operating `$15,652` + capital `$111,331` |
| Net operating result before capital grants                                                                                  |                            `$22,131` thousand | = `$133,462 − $111,331`                    |

The City of Sydney connector does **not** use OLG all-rights data as an anchor: the reconciliation is
internal to the audited document (face statement, B1-1 and the Statement of Comprehensive Income).

**Rows.** 18 rows, source id `city-of-sydney-gpfs`, `source_dataset` "City of Sydney GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "City of Sydney"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$909,748,000`, total expenses `$776,286,000`, employee expenses `$306,623,000`,
depreciation/amortisation/impairment `$130,214,000`, operating government grants `$15,652,000`,
capital government grants `$111,331,000`, net result `$133,462,000` and net result before capital
grants `$22,131,000`; the printed face-statement revenue and expense components are included for
provenance. The B1-1 function/activity split is used only to source the printed total expenses, not
emitted as rows (its three-column budget/actual layout has dash-valued cells that cannot be
positioned reliably from text, so it is not summed).

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and area panels therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The 2 pre-existing rows whose `delivery_entity` is "City of
Sydney" are **AusTender federal contracts** (not council financial rows); they are preserved exactly
and never summed with the GPFS rows. Government grant rows carry `potential_double_count: true`
because they may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-17).** `measures` 515,467 → **515,485** (exactly +18); `city-of-sydney-gpfs`
**18**; `dubbo-council` still **245**; `dubbo-council-gpfs` **18**; `data-nsw-ckan` still **3,472**;
`data_sources` 27 → **28**. A second ingest run upserted the same 18 natural keys and left the DB
total unchanged (idempotent). No deletes or updates to any other source.

### 7.3 Third council — Blacktown City Council FY2024-25 GPFS (landed 2026-11-17)

**Source.** Discovered from the official annual/audit/financial-report page
<https://www.blacktown.nsw.gov.au/About-Council/Plans-policies-and-reports/Annual-audit-and-financial-reports>
(no hard-coded document URL). The page's Financial Reports section links the anchor text **"latest
financial statements"** with `title="2024 to 2025 Financial Statements.pdf"` to
<https://www.blacktown.nsw.gov.au/files/assets/public/v/1/finance/2024-to-2025-financial-statements.pdf.pdf>
(HTTP 200, 3,873,391 bytes). Exact bytes archived outside the repo at
`~/ausspend-source-archive/blacktown-gpfs/2024-to-2025-financial-statements.pdf.pdf`, SHA-256
`74d7c880b4e795ea1cc9d17bb786eb9c1878cf9a1127c4d3f5b4d01f94e11b31`. The printed unit is explicit
`$ '000` (thousands) on the Consolidated Income Statement (printed p6), the Consolidated Statement of
Comprehensive Income (p7) and note B1-1 (p15); a missing or conflicting unit rejects the whole
extraction.

**Exact reconciliation.** The Blacktown income statement prints a three-column layout (Original
unaudited budget before the line label; Actual 2025 and Actual 2024 after it). The connector takes
the first amount after each printed label, i.e. the FY2024-25 actual, and emits nothing unless all
of these agree exactly:

| Check                                                                                                                                               |                             Printed / derived | Result                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------: | ------------------------------------------ |
| Total income from continuing operations (Consolidated Income Statement p6)                                                                          |                           `$762,437` thousand | = `$762,437,000`                           |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) |                           `$762,437` thousand | = printed total                            |
| B1-1 Total functions and activities — income                                                                                                        |                           `$762,437` thousand | = face statement                           |
| Total expenses excluding depreciation (printed p6)                                                                                                  |                           `$401,065` thousand | = expense components sum                   |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$114,905`)                                                 | `$401,065` + `$114,905` = `$515,970` thousand | = B1-1 expense total                       |
| B1-1 Total functions and activities — expenses                                                                                                      |                           `$515,970` thousand | printed total (not component-summed)       |
| B1-1 operating result / Income Statement net operating result                                                                                       |                           `$246,467` thousand | = `$762,437 − $515,970`                    |
| Statement of Comprehensive Income net result                                                                                                        |                           `$246,467` thousand | = Income Statement net result              |
| B1-1 grants and contributions                                                                                                                       |                           `$289,851` thousand | = operating `$28,952` + capital `$260,899` |
| Net operating result before capital grants                                                                                                          |                          `($14,432)` thousand | = `$246,467 − $260,899`                    |

The Blacktown connector does **not** use OLG all-rights data as an anchor: the reconciliation is
internal to the audited document (face statement, B1-1 and the Statement of Comprehensive Income).

**Rows.** **17 rows**, source id `blacktown-gpfs`, `source_dataset` "Blacktown City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Blacktown City Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$762,437,000`, total expenses `$515,970,000`, employee expenses `$195,736,000`,
depreciation/amortisation/impairment `$114,905,000`, operating government grants `$28,952,000`,
capital government grants `$260,899,000`, net gain on disposal of assets `$3,995,000` and net result
`$246,467,000`; the printed face-statement revenue and expense components are included for
provenance. The printed nil "Net loss from the disposal of assets" expense line is not emitted (nil
is not zero), and the printed negative before-capital result `($14,432,000)` is kept in the
reconciliation evidence only, because the measure model stores non-negative integer cents.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and area panels therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The 3 pre-existing rows whose `delivery_entity` is "Blacktown
City Council" are **2 AusTender federal contracts and 1 GrantConnect grant** (not council financial
rows); they are preserved exactly and never summed with the GPFS rows. Government grant rows carry
`potential_double_count: true` because they may overlap government program data; they are not added
to expenditure.

**Database evidence (2026-11-17).** `measures` 515,485 → **515,502** (exactly +17); `blacktown-gpfs`
**17**; `city-of-sydney-gpfs` still **18**; `dubbo-council` still **245**; `dubbo-council-gpfs`
still **18**; `data-nsw-ckan` still **3,472**; `data_sources` 28 → **29**. A second ingest run
upserted the same 17 natural keys and left the DB total unchanged (idempotent). No deletes or
updates to any other source.

### 7.4 Fourth council — City of Parramatta FY2024-25 GPFS (landed 2026-11-17)

**Source.** Discovered from the official financial-statements page
<https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements>
(no hard-coded document URL). That page links a dedicated FY2024-25 page,
<https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements/2024-2025-annual-financial-statements>,
whose "Download the 2024-2025 Annual Financial Statements" link
(`title="City of Parramatta Annual Financial Statements 2024-2025.pdf"`) resolves to
<https://www.cityofparramatta.nsw.gov.au/files/assets/public/v/3/council/financial-statements/city-of-parramatta-annual-financial-statements-2024-2025.pdf>
(HTTP 200, 4,098,410 bytes). Exact bytes archived outside the repo at
`~/ausspend-source-archive/parramatta-gpfs/city-of-parramatta-annual-financial-statements-2024-2025.pdf`,
SHA-256 `9dad166100cdf224a2c34d210b12673450b8b134fe2a7e257dec350e65c1be59`. The printed unit is
explicit `$ '000` (thousands) on the Income Statement (printed p4), the Statement of Comprehensive
Income (p5) and note B1-1 (p14); a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Parramatta income statement prints a three-column layout (Original
unaudited budget before the line label; Actual 2025 and Restated Actual 2024 after it). The connector
takes the first amount after each printed label, i.e. the FY2024-25 actual, and emits nothing unless
all of these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------------------------------------------------ |
| Total income from continuing operations (Income Statement p4)                                                                |                          `$439,204` thousand | = `$439,204,000`                                                                           |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$439,204` thousand | = printed total                                                                            |
| Total expenses excluding depreciation (printed p4)                                                                           |                          `$313,493` thousand | = expense components sum (employee + materials + borrowing + other + net loss on disposal) |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$70,059`)                           | `$313,493` + `$70,059` = `$383,552` thousand | = B1-1 expense total                                                                       |
| B1-1 Total functions and activities — income / expenses / operating result                                                   | `$439,204` / `$383,552` / `$55,652` thousand | = face statement                                                                           |
| B1-1 grants and contributions                                                                                                |                           `$87,047` thousand | = operating `$17,849` + capital `$69,198`                                                  |
| Net operating result before capital grants                                                                                   |                         `($13,546)` thousand | = `$55,652 − $69,198`                                                                      |
| Statement of Comprehensive Income net result                                                                                 |                           `$55,652` thousand | = Income Statement net result                                                              |

Unlike Blacktown, Parramatta's printed "Net loss from the disposal of assets" is a non-zero
**expense** component (`$7,307` thousand) and participates in the expense bridge; there is no
disposal-gain revenue line. The connector does **not** use OLG all-rights data as an anchor: the
reconciliation is internal to the audited document.

**Rows.** **17 rows**, source id `parramatta-gpfs`, `source_dataset` "City of Parramatta GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "City of Parramatta"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$439,204,000`, total expenses `$383,552,000`, employee expenses `$164,786,000`,
depreciation/amortisation/impairment `$70,059,000`, operating government grants `$17,849,000`,
capital government grants `$69,198,000`, net loss on disposal of assets `$7,307,000` and net result
`$55,652,000`; the printed face-statement revenue and expense components are included for
provenance. The printed negative before-capital result `($13,546,000)` is kept in the reconciliation
evidence only, because the measure model stores non-negative integer cents.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and area panels therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The 215 pre-existing rows whose `delivery_entity` contains
"Parramatta" are **7 AusTender contracts, 5 data.nsw rows, 94 GrantConnect grants, 5 QGIP rows and
104 ACNC charity rows** (not council financial rows); their per-source counts are identical before
and after the ingest, and they are never summed with the GPFS rows. Government grant rows carry
`potential_double_count: true` because they may overlap government program data; they are not added
to expenditure.

**Database evidence (2026-11-17).** `measures` 515,502 → **515,519** (exactly +17); `parramatta-gpfs`
**17**; `blacktown-gpfs` still **17**; `city-of-sydney-gpfs` still **18**; `dubbo-council` still
**245**; `dubbo-council-gpfs` still **18**; `data-nsw-ckan` still **3,472**; `data_sources` 29 →
**30**. A second ingest run upserted the same 17 natural keys and left the DB total unchanged
(idempotent). No deletes or updates to any other source.

### 7.5 Fifth council — Northern Beaches Council FY2024-25 GPFS (landed 2026-11-17)

**Source.** Discovered from the official annual-report page
<https://www.northernbeaches.nsw.gov.au/council/publications/annual-report> (fetched, HTTP 200; no
hard-coded document URL). The page's "Financial Statements 2024/25" link
(`href="/media/69522?1794917647"`, `class="pdf"`, distinct from the separate "Annual Report
2024/25" link) resolves to
<https://www.northernbeaches.nsw.gov.au/sites/default/files/media/files/2025-11/financial-statements-202425.pdf?1794917679>
(HTTP 200, 2,106,256 bytes). Exact bytes archived outside the repo at
`~/ausspend-source-archive/northern-beaches-gpfs/northern-beaches-financial-statements-2024-25.pdf`,
SHA-256 `58f68d6fa2a8487ed66f532c0f2c3432ac41fff227d1892b9518c76af952faf6`. The printed unit is
explicit `$ '000` (thousands) on the Income Statement (printed p19 / PDF p20), the Statement of
Comprehensive Income (printed p20 / PDF p21) and note B1-1 (printed p29 / PDF p30); a missing or
conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Northern Beaches income statement prints the Original unaudited
budget column before the line label, with Actual 2025 and Actual 2024 after it. The connector takes
the first amount after each printed label (the FY2024-25 actual) and emits nothing unless all of
these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------------------------------------------------ |
| Total income from continuing operations (Income Statement p19)                                                               |                          `$477,551` thousand | = `$477,551,000`                                                                           |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$477,551` thousand | = printed total (printed net gain on disposal is a nil dash)                               |
| Total expenses excluding depreciation (printed p19)                                                                          |                          `$362,588` thousand | = expense components sum (employee + materials + borrowing + other + net loss on disposal) |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$53,471`)                           | `$362,588` + `$53,471` = `$416,059` thousand | = total expenses documented bridge (no "Total expenses" line is printed)                   |
| B1-1 Total functions and activities — income / expenses / operating result                                                   | `$478,940` / `$417,448` / `$61,492` thousand | operating result = Income Statement net result                                             |
| B1-1 income − face total income = B1-1 expenses − face total expenses                                                        |                 `$1,389` = `$1,389` thousand | equal and opposite printed disposal gross-up (B1-1 note 4)                                 |
| B1-1 grants and contributions                                                                                                |                           `$68,856` thousand | = operating `$24,526` + capital `$44,330`                                                  |
| Net operating result before capital grants                                                                                   |                           `$17,162` thousand | = `$61,492 − $44,330`                                                                      |
| Statement of Comprehensive Income net result                                                                                 |                           `$61,492` thousand | = Income Statement net result                                                              |

The printed consolidated net result `$61,492` thousand includes `$204` thousand attributable to
non-controlling interests; the Statement of Changes in Equity shows `$61,288` thousand attributable
to Council. The connector emits the printed consolidated net result and records the non-controlling
interest split in the row notes. Total expenses is the documented bridge of two printed lines
(`$362,588 + $53,471`), **not** a sum of the nature components and **not** the B1-1 `$417,448`
figure; the `$1,389` thousand difference is the printed disposal gross-up and is reconciled
explicitly rather than hidden. The connector does **not** use OLG all-rights data as an anchor: the
reconciliation is internal to the audited document.

**Rows.** **18 rows**, source id `northern-beaches-gpfs`, `source_dataset` "Northern Beaches Council
GPFS 2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Northern Beaches Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$477,551,000`, total expenses `$416,059,000`, employee expenses `$166,906,000`,
depreciation/amortisation/impairment `$53,471,000`, operating government grants `$24,526,000`,
capital government grants `$44,330,000`, net loss on disposal of assets `$532,000`, net result
`$61,492,000` and net result before capital grants `$17,162,000`; the printed face-statement revenue
and expense components are included for provenance. Because both the net result and the
before-capital result are positive, all 18 rows are emitted (unlike Blacktown and Parramatta, whose
negative before-capital result is kept in reconciliation evidence only).

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and area panels therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The 179 pre-existing rows whose `delivery_entity` contains
"Northern Beaches" are **85 ACNC charity rows, 4 AusTender contracts, 5 data.nsw rows, 20
GrantConnect grants and 65 QGIP rows** (not council financial rows); their per-source counts are
identical before and after the ingest, and they are never summed with the GPFS rows. Government
grant rows carry `potential_double_count: true` because they may overlap government program data;
they are not added to expenditure.

**Database evidence (2026-11-17).** `measures` 515,519 → **515,537** (exactly +18);
`northern-beaches-gpfs` **18**; `parramatta-gpfs` still **17**; `blacktown-gpfs` still **17**;
`city-of-sydney-gpfs` still **18**; `dubbo-council` still **245**; `dubbo-council-gpfs` still **18**;
`data-nsw-ckan` still **3,472**; `data_sources` 30 → **31**. A second ingest run upserted the same 18
natural keys and left the DB total unchanged (idempotent). No deletes or updates to any other
source.

---

## 8. Prioritised rollout (after the pilot)

1. **P0 — Dubbo FY2024-25 GPFS (pilot).** **Landed 2026-11-17:** 18 non-additive rows, exact OLG reconciliation, no double count (§7.1).
2. **P1 — OLG FY2024-25 bulk summary for all 128 (conditional).** Only if written permission or an
   openly licensed copy exists. Ingest only the safe columns: total expenses, total revenue, net
   operating result before capital, plus the service split as a **separate non-additive table**.
   Keep the 8 county councils separate. Flag Bland as incomplete. Do not create a statewide total.
3. **P2 — LGGC 2025-26 FAG council-level overlay (conditional on OLG permission).** Grants only;
   reconcile to GPFS grant revenue; label Commonwealth-funded, state-administered.
4. **P3 — GPFS expansion by materiality.** Rank the 128 by FY2024-25 `Total Expenses` (from the OLG
   workbook, after permission) and take the top 20 first; within that, prefer councils with
   machine-readable GPFS. Then regional cities, then rural. One adapter/mapping per council; never a
   blind 128-PDF batch. **First expansion landed 2026-11-17:** City of Sydney FY2024-25 GPFS, 18
   non-additive rows (§7.2). **Second expansion landed 2026-11-17:** Blacktown City Council
   FY2024-25 GPFS, 17 non-additive rows (§7.3). **Third expansion landed 2026-11-17:** City of
   Parramatta FY2024-25 GPFS, 17 non-additive rows (§7.4). **Fourth expansion landed 2026-11-17:**
   Northern Beaches Council FY2024-25 GPFS, 18 non-additive rows (§7.5).
5. **P4 — data.nsw sweep per council.** Check each council's CKAN organisation for machine-readable
   financial data; most will not have it; do not infer. **Done 2026-11-17:** no machine-readable
   council financial dataset exists; see [NSW_COUNCIL_DATA_NSW_SWEEP.md](./NSW_COUNCIL_DATA_NSW_SWEEP.md).
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
- Blacktown annual/audit/financial-report page —
  <https://www.blacktown.nsw.gov.au/About-Council/Plans-policies-and-reports/Annual-audit-and-financial-reports>
- Blacktown FY2024-25 GPFS PDF — URL above (3,873,391 bytes; SHA-256
  `74d7c880b4e795ea1cc9d17bb786eb9c1878cf9a1127c4d3f5b4d01f94e11b31`)
- City of Parramatta financial-statements page —
  <https://www.cityofparramatta.nsw.gov.au/council/performance-and-reporting/financial-statements>
- City of Parramatta FY2024-25 GPFS PDF — URL above (4,098,410 bytes; SHA-256
  `9dad166100cdf224a2c34d210b12673450b8b134fe2a7e257dec350e65c1be59`)
- Northern Beaches Council annual-report page —
  <https://www.northernbeaches.nsw.gov.au/council/publications/annual-report>
- Northern Beaches Council FY2024-25 GPFS PDF — URL above (2,106,256 bytes; SHA-256
  `58f68d6fa2a8487ed66f532c0f2c3432ac41fff227d1892b9518c76af952faf6`)
- Audit Office reports — <https://www.audit.nsw.gov.au/our-work/reports>
- data.nsw CKAN API — `package_search` queries for "local government council", "local government
  financial", "time series council", "council expenditure", "financial data return", "grants
  commission council".

**GPFS pilot checks (2026-11-17):**

- Official reporting page fetched (HTTP 200); FY2024-25 statements link discovered from the anchor
  text, not a hard-coded document URL.
- GPFS PDF fetched (HTTP 200, 1,807,768 bytes) and SHA-256 archived outside the repo; SHA-256
  `d9213cea468547a318548dfd72d7faa0d9fd2da81bcf6835138d10b58914a43f`.
- Printed `$ '000` unit detected on the income statement and B1-1; the connector rejects a missing or
  conflicting unit.
- Income statement, B1-1 and OLG FY2024-25 totals reconcile exactly: revenue `$234,927,000`,
  expenses `$174,925,000`, net result `$60,002,000`.
- `dubbo-council-gpfs` rows: 18, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: measures 515,449 → 515,467 (+18 only); `dubbo-council` still 245; a second run upserted the
  same 18 natural keys with no count change.

**GPFS third-council checks (2026-11-17):**

- Blacktown official page fetched (HTTP 200); the FY2024-25 statements link was discovered from the
  anchor text/title, not a hard-coded document URL.
- GPFS PDF fetched (HTTP 200, 3,873,391 bytes) and SHA-256 archived outside the repo; SHA-256
  `74d7c880b4e795ea1cc9d17bb786eb9c1878cf9a1127c4d3f5b4d01f94e11b31`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement and B1-1;
  the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$762,437,000`, expenses `$515,970,000`, net result `$246,467,000`.
- `blacktown-gpfs` rows: 17, all `aggregation_role: "agency_detail"`, no `region_id`/LGA; total
  expenses is the printed B1-1 value, not a component sum.
- DB: measures 515,485 → 515,502 (+17 only); `city-of-sydney-gpfs` still 18; `dubbo-council` still
  245; the 3 pre-existing Blacktown-delivery-entity AusTender/GrantConnect rows unchanged; a second
  run upserted the same 17 natural keys with no count change.

**GPFS fourth-council checks (2026-11-17):**

- City of Parramatta official financial-statements page fetched (HTTP 200); the FY2024-25 page and
  the statements PDF were discovered from the page links, not a hard-coded document URL.
- GPFS PDF fetched (HTTP 200, 4,098,410 bytes) and SHA-256 archived outside the repo; SHA-256
  `9dad166100cdf224a2c34d210b12673450b8b134fe2a7e257dec350e65c1be59`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement and B1-1;
  the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$439,204,000`, expenses `$383,552,000`, net result `$55,652,000`.
- `parramatta-gpfs` rows: 17, all `aggregation_role: "agency_detail"`, no `region_id`/LGA; total
  expenses is the printed B1-1 value, not a component sum.
- DB: measures 515,502 → 515,519 (+17 only); `blacktown-gpfs` still 17; `city-of-sydney-gpfs` still
  18; `dubbo-council` still 245; the 215 pre-existing Parramatta-delivery-entity rows unchanged; a
  second run upserted the same 17 natural keys with no count change.

**GPFS fifth-council checks (2026-11-17):**

- Northern Beaches Council official annual-report page fetched (HTTP 200); the FY2024-25
  "Financial Statements 2024/25" link (`href="/media/69522?1794917647"`, `class="pdf"`, distinct
  from the separate Annual Report link) resolves to the statements PDF; no document URL is
  hard-coded.
- GPFS PDF fetched (HTTP 200, 2,106,256 bytes) and SHA-256 archived outside the repo; SHA-256
  `58f68d6fa2a8487ed66f532c0f2c3432ac41fff227d1892b9518c76af952faf6`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement and B1-1;
  the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$477,551,000`, expenses `$416,059,000` (documented bridge of printed expenses excluding
  depreciation `$362,588,000` plus depreciation `$53,471,000`), net result `$61,492,000`; B1-1
  income `$478,940,000`, expenses `$417,448,000` and the equal `$1,389,000` disposal gross-up
  reconcile; before-capital result `$17,162,000`.
- `northern-beaches-gpfs` rows: 18, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: measures 515,519 → 515,537 (+18 only); `parramatta-gpfs` still 17; `blacktown-gpfs` still 17;
  `city-of-sydney-gpfs` still 18; `dubbo-council` still 245; the 179 pre-existing
  Northern Beaches-delivery-entity rows unchanged; a second run upserted the same 18 natural keys with
  no count change.

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
  'print(db.measures.countDocuments({})); print(db.measures.countDocuments({source_id:"dubbo-council"})); print(db.measures.countDocuments({source_id:"dubbo-council-gpfs"})); print(db.measures.countDocuments({source_id:"data-nsw-ckan"}));'
# 515467
# 245
# 18
# 3472
```

The inventory sections made no write; the §7.1 pilot wrote only the 18 `dubbo-council-gpfs` rows, one
`data_sources` record and its ingestion log. No deletes, updates to other sources, index or schema
migration were performed.

---

## 10. Ambiguities / open questions (verbatim where possible)

1. **OLG licence.** _"All rights reserved. No part of this publication may be reproduced by any
   process, electronic or otherwise, in any material form or transmitted to any other person or
   stored electronically in any form, without the prior written permission of the State of New South
   Wales..."_ — Can the owner obtain written permission, or is there an openly licensed copy of the
   time-series? Without this, P1 cannot be published.
2. **OLG data quality.** _"The accuracy of this website is largely dependent upon the accuracy and
   completeness of data returns lodged by councils. The Office of Local Government (OLG) does not
   separately audit the data, but we do conduct extensive testing for validity and reasonableness."_
   — FDR-derived totals are not audited by OLG; the GPFS is the audited source. Which is the
   authority for a published council total?
3. **Service-category semantics.** The workbook labels them _"Your Council's Expenditure on
   Services- FDR/financial statements"_, but the dollar columns do not reconcile to _"Total Expenses
   from Continuing Operations"_ for 61/128 councils (Hawkesbury Sewer `$169.979m` vs total
   `$130.704m`). Are they operating, capital-inclusive, or gross water/sewer? The definitions PDF was
   not parsed this pass; this is unresolved.
4. **Bland.** _"Not complete FDR: Bland"_ (A133), _"_ Includes Termination Payout"* (A134), _"Note:
   Performance Ratios not collected due to reported COP"_ (A135). Should Bland be excluded, carried
   forward, or shown as incomplete?
5. **County councils.** The 2024-25 sheet has 8 rows, but the chart names New England Tablelands
   County as well. What is the current legal list, and should water county councils be modelled
   separately (likely yes)?
6. **Dubbo fund separation.** The 245 existing rows include Consolidated, General, Water and Sewer,
   but the fund is only in `notes`/`description`, not a structured field. Should the platform add a
   fund field and select one basis before any council total?
7. **Dubbo licence.** _"© Dubbo Regional Council. Published council documents used here for
   public-interest research; not an open-data licence grant."_ — the same question applies to the
   other 127 councils; is per-council public-interest use acceptable, or is permission needed?
8. **No cross-council totals.** The brief says no aggregate across councils. Does the platform need
   any sector-level view at all, and if so, can it be a clearly labelled OLG benchmark rather than a
   computed total?
9. **Council vs state.** Council spending is not state spending. Should council rows live under a new
   `jurisdiction_level: "local"` (or similar) so they can never be summed with state/federal rows by
   accident?

---

## 11. What this document deliberately does not do

The inventory and planning sections §1–§8 remain research/plan (except the landed §7.1 pilot). They
do not create a cross-council or state-plus-council total, do not assert a licence for the OLG or
council documents beyond the quoted terms, and do not claim the 128 list is frozen: boundary changes,
amalgamations and administrators can change the population, so re-read the OLG workbook each year.
The only ingestion is the §7.1 GPFS pilot: one council, one audited year, 18 non-additive rows, with
the existing 245 budget/estimate rows and the rest of the DB untouched.
