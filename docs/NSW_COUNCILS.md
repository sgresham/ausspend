# NSW local councils — source inventory, double-count review and pilot plan

**Status:** the inventory and plan below are unchanged. Eighteen council GPFS sources have landed as
separate non-additive sources. The Dubbo FY2024-25 pilot (§7.1) added exactly **18**
`dubbo-council-gpfs` rows (baseline **515,449** → **515,467**); the City of Sydney FY2024-25 GPFS
(**§7.2**) then added exactly **18** `city-of-sydney-gpfs` rows (**515,467** → **515,485**); the
Blacktown City Council FY2024-25 GPFS (**§7.3**) then added exactly **17** `blacktown-gpfs` rows
(**515,485** → **515,502**); the City of Parramatta FY2024-25 GPFS (**§7.4**) then added exactly
**17** `parramatta-gpfs` rows (**515,502** → **515,519**); Northern Beaches Council FY2024-25 GPFS
(**§7.5**) then added exactly **18** `northern-beaches-gpfs` rows (**515,519** → **515,537**);
Canterbury-Bankstown Council FY2024-25 GPFS (**§7.6**) then added exactly **17**
`canterbury-bankstown-gpfs` rows (**515,537** → **515,554**); Sutherland Shire Council FY2024-25
GPFS (**§7.7**) then added exactly **17** `sutherland-shire-gpfs` rows (**515,554** → **515,571**);
Wollongong City Council FY2024-25 GPFS (**§7.8**) then added exactly **17** `wollongong-gpfs` rows
(**515,571** → **515,588**); Newcastle City Council FY2024-25 GPFS (**§7.9**) then added exactly
**17** `newcastle-gpfs` rows (**515,588** → **515,605**); Lake Macquarie City Council FY2024-25
GPFS (**§7.10**) then added exactly **17** `lake-macquarie-gpfs` rows (**515,605** → **515,622**);
Maitland City Council FY2024-25 GPFS (**§7.11**) then added exactly **7** `maitland-gpfs` rows
(**515,622** → **515,629**); Coffs Harbour City Council FY2024-25 GPFS (**§7.12**) then added exactly
**17** `coffs-harbour-gpfs` rows (**515,629** → **515,646**); MidCoast Council FY2024-25 GPFS
(**§7.13**) then added exactly **17** `mid-coast-gpfs` rows (**515,646** → **515,663**); Port
Macquarie-Hastings Council FY2024-25 GPFS (**§7.14**) then added exactly **17**
`port-macquarie-hastings-gpfs` rows (**515,663** → **515,680**). The Tweed Shire Council FY2024-25
GPFS (**§7.15**) then added exactly **17** `tweed-shire-gpfs` rows (**515,680** → **515,697**).
Shoalhaven City Council FY2024-25 GPFS (**§7.16**) then added exactly **17** `shoalhaven-gpfs` rows
(**515,697** → **515,714**). Shellharbour City Council FY2024-25 GPFS (**§7.17**) then added exactly
**17** `shellharbour-gpfs` rows (**515,714** → **515,731**). Waverley Council FY2024-25 GPFS
(**§7.18**) then added exactly **17** `waverley-gpfs` rows (**515,731** → **515,748**).
The existing 245 `dubbo-council`
budget/estimate rows, the 2 pre-existing AusTender federal contract rows whose `delivery_entity`
happens to be "City of Sydney", the 2 AusTender + 1 GrantConnect rows whose `delivery_entity`
happens to be "Blacktown City Council", the 215 AusTender/data.nsw/GrantConnect/QGIP/ACNC rows whose
`delivery_entity` mentions "Parramatta", the 179
AusTender/data.nsw/GrantConnect/QGIP/ACNC rows whose `delivery_entity` mentions "Northern Beaches",
the 6 AusTender/GrantConnect rows whose `delivery_entity` is exactly "Canterbury-Bankstown Council",
the 4 AusTender/GrantConnect rows whose `delivery_entity` mentions "Sutherland Shire Council" (3
exact-case GrantConnect rows and 1 uppercase AusTender row), the 4 AusTender/GrantConnect rows whose
`delivery_entity` exactly names "Newcastle City Council" (1 exact-case GrantConnect grant, 1
uppercase AusTender contract and 2 uppercase GrantConnect grants) plus the separate "City of
Newcastle" GrantConnect row, the 4 AusTender/GrantConnect rows whose `delivery_entity` exactly names
"Lake Macquarie City Council" (1 exact-case GrantConnect grant, 1 uppercase AusTender contract and 2
uppercase GrantConnect grants), the 1 GrantConnect row whose `delivery_entity` exactly names
"MAITLAND CITY COUNCIL" (an uppercase grant), the 205 AusTender/data.nsw/GrantConnect/ACNC rows whose
`delivery_entity` merely mentions Maitland, the NSW Budget rows whose `project_name` mentions
Maitland, the 2 AusTender federal contract rows whose `delivery_entity` is the different string
"CITY OF COFFS HARBOUR", the 199 other AusTender/data.nsw/GrantConnect/NSW Budget/ACNC rows whose
`delivery_entity` mentions Coffs Harbour under other delivery_entity strings, the 1 GrantConnect row
whose `delivery_entity` is exactly "Shoalhaven City Council" and the 135 other
AusTender/GrantConnect/ACNC/data.nsw rows whose `delivery_entity` merely mentions Shoalhaven, the 6
AusTender/GrantConnect rows whose `delivery_entity` is exactly "Waverley Council" (5 exact-case: 1
AusTender contract and 4 GrantConnect grants; 1 uppercase "WAVERLEY COUNCIL" AusTender contract) and
the 145 other AusTender/GrantConnect/ACNC/data.nsw rows whose `delivery_entity` merely mentions
Waverley, and
every other source are preserved untouched and are never summed with the GPFS rows.

**As at:** 18 November 2026. **Scope:** NSW local government — the 128 general purpose councils —
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
comparatives inside each report). **In DB: 214 GPFS rows** — 18 for Dubbo FY2024-25
(`dubbo-council-gpfs`, §7.1), 18 for the City of Sydney FY2024-25 (`city-of-sydney-gpfs`, §7.2), 17
for Blacktown City Council FY2024-25 (`blacktown-gpfs`, §7.3), 17 for City of Parramatta FY2024-25
(`parramatta-gpfs`, §7.4), 18 for Northern Beaches Council FY2024-25 (`northern-beaches-gpfs`,
§7.5), 17 for Canterbury-Bankstown Council FY2024-25 (`canterbury-bankstown-gpfs`, §7.6), 17 for
Sutherland Shire Council FY2024-25 (`sutherland-shire-gpfs`, §7.7), 17 for Wollongong City Council
FY2024-25 (`wollongong-gpfs`, §7.8), 17 for Newcastle City Council FY2024-25 (`newcastle-gpfs`,
§7.9), 17 for Lake Macquarie City Council FY2024-25 (`lake-macquarie-gpfs`, §7.10), 7 for Maitland
City Council FY2024-25 (`maitland-gpfs`, §7.11) and 17 for Coffs Harbour City Council FY2024-25
(`coffs-harbour-gpfs`, §7.12), 17 for MidCoast Council FY2024-25 (`mid-coast-gpfs`, §7.13), 17
for Port Macquarie-Hastings Council FY2024-25 (`port-macquarie-hastings-gpfs`, §7.14) and 17 for
Tweed Shire Council FY2024-25 (`tweed-shire-gpfs`, §7.15) — all separate source ids. The existing `dubbo-council` 245 rows are 2026/27 budget/forward-estimate lines, not GPFS
actuals, and are not touched or summed with the GPFS rows.

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

### 7.6 Sixth council — Canterbury-Bankstown Council FY2024-25 GPFS (landed 2026-11-17)

**Source.** Discovered from the official FY2024-25 annual financial statements page
<https://haveyoursay.cbcity.nsw.gov.au/annual-financial-statements-2024-25> (the council's Have Your
Say platform, linked from the cbcity.nsw.gov.au sitemap; fetched HTTP 200; no hard-coded document
URL). The page's "Financial Statements 2024-25 and Auditor's Reports PDF (3.36 MB)" link
(`href="https://haveyoursay.cbcity.nsw.gov.au/download_file/7155/2442"`, distinct from the separate
2024/25 Annual Report link) resolves to the statements PDF (HTTP 200, 3,526,499 bytes). Exact bytes
are archived outside the repo at
`/home/steve/ausspend-source-archive/canterbury-bankstown-gpfs/canterbury-bankstown-financial-statements-2024-25.pdf`,
SHA-256 `d195790e10452808497fdc0eb95589e751ae6a64a50fc8d076ce467ac0ce8650`. The printed unit is
explicit `$ '000` (thousands) on the Income Statement (printed p4 / PDF p4), the Statement of
Comprehensive Income (printed p5 / PDF p5) and note B1-1 (printed p14 / PDF p14); a missing or
conflicting unit rejects the whole extraction. The FY2025-26 statements (exhibited 17 November 2026)
are the newer audited set but are out of scope for this FY2024-25 item and are not ingested.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before the
line label, with Actual 2025 and Actual 2024 after it. The connector takes the first amount after
each printed label (the FY2024-25 actual) and emits nothing unless all of these agree exactly:

| Check                                                                                                                        |                             Printed / derived | Result                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------: | ------------------------------------------------------------------------------------------ |
| Total income from continuing operations (Income Statement p4)                                                                |                           `$483,988` thousand | = `$483,988,000`                                                                           |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                           `$483,988` thousand | = printed total                                                                            |
| Total expenses excluding depreciation (printed p4)                                                                           |                           `$328,567` thousand | = expense components sum (employee + materials + borrowing + other + net loss on disposal) |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$101,804`)                          | `$328,567` + `$101,804` = `$430,371` thousand | = total expenses documented bridge (no "Total expenses" line is printed)                   |
| B1-1 Total functions and activities — income / expenses / operating result                                                   |  `$483,988` / `$430,371` / `$53,617` thousand | income and expenses equal the face bridge; operating result = Income Statement net result  |
| B1-1 grants and contributions                                                                                                |                            `$91,426` thousand | = operating `$22,588` + capital `$68,838`                                                  |
| Net operating result before capital grants                                                                                   |                          `$(15,221)` thousand | = `$53,617 − $68,838` (negative; reconciliation evidence only)                             |
| Statement of Comprehensive Income net result                                                                                 |                            `$53,617` thousand | = Income Statement net result                                                              |

Total expenses is the documented bridge of two printed lines (`$328,567 + $101,804 = $430,371`),
**not** a sum of the nature components on its own and **not** the separate printed expenses-excluding-
depreciation line. Unlike Northern Beaches, the printed B1-1 expense total equals the face bridge
exactly, so there is no disposal gross-up in this report. The connector does **not** use OLG
all-rights data as an anchor: the reconciliation is internal to the audited document.

**Rows.** **17 rows**, source id `canterbury-bankstown-gpfs`, `source_dataset`
"Canterbury-Bankstown Council GPFS 2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`,
`jurisdiction_level: "local"`, `jurisdiction: "NSW"`, `delivery_entity:
"Canterbury-Bankstown Council"` (the exact published entity name in the statements/audit report and
the string used by the 6 pre-existing rows), `data_quality_flag: "provisional/local_government"`,
`verified: false`. The minimum lines are total revenue `$483,988,000`, total expenses
`$430,371,000`, employee expenses `$177,897,000`, depreciation/amortisation/impairment
`$101,804,000`, operating government grants `$22,588,000`, capital government grants `$68,838,000`,
net loss on disposal of assets `$6,318,000` and net result `$53,617,000`; the printed
face-statement revenue and expense components are included for provenance. Because the printed
before-capital result is negative (`$(15,221,000)`) and `amount_cents` is non-negative, it is kept in
the reconciliation evidence only and not emitted as a row (unlike Northern Beaches, whose positive
before-capital result is a row).

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and area panels therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The 6 pre-existing rows whose `delivery_entity` is exactly
"Canterbury-Bankstown Council" are **4 GrantConnect grants and 2 AusTender contracts** (not council
financial rows); their per-source counts are identical before and after the ingest, and they are
never summed with the GPFS rows. Government grant rows carry `potential_double_count: true` because
they may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-17).** `measures` 515,537 → **515,554** (exactly +17);
`canterbury-bankstown-gpfs` **17**; `northern-beaches-gpfs` still **18**; `parramatta-gpfs` still
**17**; `blacktown-gpfs` still **17**; `city-of-sydney-gpfs` still **18**; `dubbo-council` still
**245**; `dubbo-council-gpfs` still **18**; `data-nsw-ckan` still **3,472**; `data_sources` 31 →
**32**. A second ingest run upserted the same 17 natural keys and left the DB total unchanged
(idempotent). No deletes or updates to any other source.

### 7.7 Seventh council — Sutherland Shire Council FY2024-25 GPFS (landed 2026-11-17)

**Source.** Discovered from the official annual and financial reports page
<https://www.sutherlandshire.nsw.gov.au/your-council/our-vision-for-the-future/annual-and-financial-reports>
(fetched with a real browser because the site enforces a Cloudflare managed challenge; HTTP 200; no
hard-coded document URL). The page's stand-alone "Financial Statements 2024-2025 - PDF - 5336 KB"
link resolves to
<https://www.sutherlandshire.nsw.gov.au/__data/assets/pdf_file/0019/109144/2024-2025-Sutherland-Shire-Council-Financial-Statements.pdf>
(HTTP 200, 5,464,555 bytes). The separate "Appendix D - Financial Statements" annual-report appendix
is deliberately not selected. Exact bytes are archived outside the repo at
`/home/steve/ausspend-source-archive/sutherland-shire-gpfs/2024-2025-Sutherland-Shire-Council-Financial-Statements.pdf`,
SHA-256 `a97e7719e485a0fb6f49468c0eb7672a5b120c0aa6077ccfdb0349d56dd2b743`. The printed unit is
explicit `$ '000` (thousands) on the Income Statement (printed p4 / PDF p5), the Statement of
Comprehensive Income (printed p5 / PDF p6) and note B1-1 (printed p13 / PDF p14); a missing or
conflicting unit rejects the whole extraction. Because the site blocks non-browser fetches, the CLI
ingest supplies the browser-cleared bytes through the connector's documented `pdfBytes` override; the
connector still SHA-256 verifies and re-archives them.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before the
line label, with Actual 2025 and Actual 2024 after it. The connector takes the first amount after
each printed label (the FY2024-25 actual) and emits nothing unless all of these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------------------------------------------------ |
| Total income from continuing operations (Income Statement p4)                                                                |                          `$325,542` thousand | = `$325,542,000`                                                                           |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$325,542` thousand | = printed total                                                                            |
| Total expenses excluding depreciation (printed p4)                                                                           |                          `$258,272` thousand | = expense components sum (employee + materials + borrowing + other + net loss on disposal) |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$53,206`)                           | `$258,272` + `$53,206` = `$311,478` thousand | = total expenses documented bridge (no "Total expenses" line is printed)                   |
| B1-1 Total functions and activities — income / expenses / operating result                                                   | `$325,542` / `$311,478` / `$14,064` thousand | income and expenses equal the face bridge; operating result = Income Statement net result  |
| B1-1 grants and contributions                                                                                                |                           `$35,703` thousand | = operating `$19,436` + capital `$16,267`                                                  |
| Net operating result before capital grants                                                                                   |                          `$(2,203)` thousand | = `$14,064 − $16,267` (negative; reconciliation evidence only)                             |
| Statement of Comprehensive Income net result                                                                                 |                           `$14,064` thousand | = Income Statement net result                                                              |

Total expenses is the documented bridge of two printed lines (`$258,272 + $53,206 = $311,478`),
**not** a sum of the nature components on its own and **not** the separate printed
expenses-excluding-depreciation line. The printed B1-1 expense total equals the face bridge exactly,
so there is no disposal gross-up. The connector does **not** use OLG all-rights data: the
reconciliation is internal to the audited document.

**Rows.** **17 rows**, source id `sutherland-shire-gpfs`, `source_dataset` "Sutherland Shire Council
GPFS 2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Sutherland Shire Council"` (the exact published entity
name), `data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are
total revenue `$325,542,000`, total expenses `$311,478,000`, employee expenses `$130,034,000`,
depreciation/amortisation/impairment `$53,206,000`, operating government grants `$19,436,000`,
capital government grants `$16,267,000`, net loss on disposal of assets `$3,651,000` and net result
`$14,064,000`; the printed face-statement revenue and expense components are included for
provenance. Because the printed before-capital result is negative (`$(2,203,000)`) and `amount_cents`
is non-negative, it is kept in the reconciliation evidence only and not emitted as a row.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and area panels therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The 4 pre-existing rows whose `delivery_entity` mentions
"Sutherland Shire Council" are **3 exact-case GrantConnect grants and 1 uppercase "SUTHERLAND SHIRE
COUNCIL" AusTender contract** (not council financial rows); their per-source counts are identical
before and after the ingest, and they are never summed with the GPFS rows. Government grant rows carry
`potential_double_count: true` because they may overlap government program data; they are not added
to expenditure.

**Database evidence (2026-11-17).** `measures` 515,554 → **515,571** (exactly +17);
`sutherland-shire-gpfs` **17**; `canterbury-bankstown-gpfs` still **17**; `northern-beaches-gpfs`
still **18**; `parramatta-gpfs` still **17**; `blacktown-gpfs` still **17**; `city-of-sydney-gpfs`
still **18**; `dubbo-council` still **245**; `dubbo-council-gpfs` still **18**; `data-nsw-ckan` still
**3,472**; `data_sources` 32 → **33**. A second ingest run upserted the same 17 natural keys and left
the DB total unchanged (idempotent). No deletes or updates to any other source.

### 7.8 Eighth council — Wollongong City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official financial report page
<https://www.wollongong.nsw.gov.au/council/council-documents/reports/financial-report>. Plain HTTP to
`wollongong.nsw.gov.au` returns **HTTP 403** (Cloudflare managed challenge) for the home page, the
reporting page and the PDF, which is not proof of absence. The documented headless Chromium/Playwright
path (the same approach used for Sutherland Shire) loads the page, clears the challenge, and the
connector parses the PDF link from the cleared HTML — no document URL is hard-coded. The FY2024-25
anchor **"Financial Report for the Year Ended 30 June 2025 PDF, 7171.17 KB"** resolves to
<https://www.wollongong.nsw.gov.au/__data/assets/pdf_file/0011/300404/Annual-Financial-Statements-year-ended-30-June-2025.pdf>
(downloaded by the browser; 7,343,281 bytes). Exact bytes are archived outside the repo at
`/home/steve/ausspend-source-archive/wollongong-gpfs/Annual-Financial-Statements-year-ended-30-June-2025.pdf`,
SHA-256 `ae26b12b906a09ce17d1c353e4f36d8aec29b0de5e4b539cffe5a953aedc6ad3`, with the archive
metadata record alongside. The printed unit is explicit `$ '000` on the Income Statement (printed
p4 / PDF p15), the Statement of Comprehensive Income (printed p5 / PDF p16) and note B1-1 (printed
p13 / PDF p24); a missing or conflicting unit rejects the whole extraction. Because the site blocks
non-browser fetches, `scripts/ingest-nsw.ts --source wollongong-gpfs` supplies the browser-cleared
listing HTML and PDF bytes through the connector's documented `listingHtml`/`pdfBytes` overrides; the
connector still discovers the link from that HTML, SHA-256 verifies and re-archives the bytes.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before the
line label, with Actual 2025 and Actual 2024 after it. The connector takes the first amount after
each printed label (the FY2024-25 actual) and emits nothing unless all of these agree exactly:

| Check                                                                                                                        |                              Printed / derived | Result                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------: | ------------------------------------------------------------------------------------------ |
| Total income from continuing operations (Income Statement p4)                                                                |                            `$390,643` thousand | = `$390,643,000`                                                                           |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                            `$390,643` thousand | = printed total                                                                            |
| Total expenses excluding depreciation (printed p4)                                                                           |                            `$302,785` thousand | = expense components sum (employee + materials + borrowing + other + net loss on disposal) |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$98,096`)                           |   `$302,785` + `$98,096` = `$400,881` thousand | = total expenses documented bridge (no "Total expenses" line is printed)                   |
| B1-1 Total functions and activities — income / expenses / operating result                                                   | `$390,643` / `$400,881` / `$(10,238)` thousand | income and expenses equal the face bridge; operating result = Income Statement net result  |
| B1-1 grants and contributions                                                                                                |                             `$77,119` thousand | = operating `$31,646` + capital `$45,473`                                                  |
| Net operating result before capital grants                                                                                   |                           `$(55,711)` thousand | = `$(10,238) − $45,473` (negative; reconciliation evidence only)                           |
| Statement of Comprehensive Income net result                                                                                 |                           `$(10,238)` thousand | = Income Statement net result                                                              |

Total expenses is the documented bridge of two printed lines (`$302,785 + $98,096 = $400,881`),
**not** a sum of the nature components on its own and **not** the separate printed
expenses-excluding-depreciation line. The printed B1-1 expense total equals that face bridge
exactly, so there is no disposal gross-up. The connector does **not** use OLG all-rights data: the
reconciliation is internal to the audited document. The printed net result and before-capital result
are both negative; the model stores non-negative cents, so the net result is emitted as a
non-negative magnitude with `gpfs_printed_sign: "negative"` (reconciliation uses the printed sign),
and the before-capital result is kept in reconciliation evidence only.

**Rows.** **17 rows**, source id `wollongong-gpfs`, `source_dataset` "Wollongong City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Wollongong City Council"` (the exact published entity name
in the audited statements), `data_quality_flag: "provisional/local_government"`, `verified: false`.
The minimum lines are total revenue `$390,643,000`, total expenses `$400,881,000`, employee expenses
`$153,272,000`, depreciation/amortisation/impairment `$98,096,000`, operating government grants
`$31,646,000`, capital government grants `$45,473,000`, net loss on disposal of assets `$6,276,000`
and net result `$10,238,000` (printed negative, stored with `gpfs_printed_sign:
"negative"`); the printed face-statement revenue and expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and area panels therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The 7 pre-existing rows that exactly name the council are **4 exact-case "Wollongong City Council"
GrantConnect grants, 1 mixed-case "Wollongong City Council" AusTender contract and 2 uppercase
"WOLLONGONG CITY COUNCIL" AusTender variants** (not council financial rows); the 114 ACNC rows and 3
data.nsw school rows that merely mention Wollongong use different `delivery_entity` values. Their per-source counts are identical
before and after the ingest, and they are never summed with the GPFS rows. Government grant rows
carry `potential_double_count: true` because they may overlap government program data; they are not
added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,571 → **515,588** (exactly +17);
`wollongong-gpfs` **17**; `sutherland-shire-gpfs` still **17**; `canterbury-bankstown-gpfs` still
**17**; `northern-beaches-gpfs` still **18**; `parramatta-gpfs` still **17**; `blacktown-gpfs` still
**17**; `city-of-sydney-gpfs` still **18**; `dubbo-council` still **245**; `dubbo-council-gpfs`
still **18**; `data-nsw-ckan` still **3,472**; `data_sources` 33 → **34**. A second ingest run
upserted the same 17 natural keys and left the DB total unchanged (idempotent). No deletes or
updates to any other source.

### 7.9 Ninth council — Newcastle City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official General Purpose Financial Statements page
<https://newcastle.nsw.gov.au/your-council/governance-and-transparency/planning-service-delivery-and-reporting>
(fetched over plain HTTP, HTTP 200, after the legacy GPFS path redirects here; no Cloudflare challenge). The page's FY2024-25 anchor
**"2024/2025 Financial Statements (PDF, 3.4 MB)"** resolves to
<https://newcastle.nsw.gov.au/getmedia/4bba4207-e815-43df-a8db-c09f6f94fc7e/Newcastle-City-Council-Financial-Statements-2024-25.pdf>
(3,484,233 bytes). The URL is parsed from the page HTML, never hard-coded. Exact bytes are archived
outside the repo at
`/home/steve/ausspend-source-archive/newcastle-gpfs/Newcastle-City-Council-Financial-Statements-2024-25.pdf`,
SHA-256 `ed415f31b8b57358ce2f3be2dbbd8193edab74fc3be4b6df3cf3e3d4b80a24cc`, with the archive
metadata record alongside (`hash_verified: true`). The printed unit is explicit `$ '000` on the
Income Statement (printed p5 / PDF p6), the Statement of Comprehensive Income (printed p6 / PDF p7)
and note B1-1 (printed p16 / PDF p17); a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label, with Actual 2025 and Actual 2024 after it. The connector takes the first amount
after each printed label (the FY2024-25 actual) and emits nothing unless all of these agree exactly:

| Check                                                                                                                       |                            Printed / derived | Result                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------------------------------------------------ |
| Total income from continuing operations (Income Statement p5)                                                               |                          `$497,702` thousand | = `$497,702,000`                                                                           |
| Revenue components sum (rates + user charges + other revenue + operating grants + capital grants + interest + other income) |                          `$497,702` thousand | = printed total                                                                            |
| Total expenses excluding depreciation (printed p5)                                                                          |                          `$327,421` thousand | = expense components sum (employee + materials + borrowing + other + net loss on disposal) |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$71,942`)                          | `$327,421` + `$71,942` = `$399,363` thousand | = total expenses documented bridge (no "Total expenses" line is printed)                   |
| B1-1 Total functions and activities — income / expenses / operating result                                                  | `$497,702` / `$399,363` / `$98,339` thousand | income and expenses equal the face bridge; operating result = Income Statement net result  |
| B1-1 grants and contributions                                                                                               |                          `$110,825` thousand | = operating `$21,222` + capital `$89,603`                                                  |
| Net operating result before capital grants                                                                                  |                            `$8,736` thousand | = `$98,339 − $89,603` (positive; reconciliation evidence only)                             |
| Statement of Comprehensive Income net result                                                                                |                           `$98,339` thousand | = Income Statement net result                                                              |

Total expenses is the documented bridge of two printed lines (`$327,421 + $71,942 = $399,363`),
**not** a sum of the nature components on its own and **not** the separate printed
expenses-excluding-depreciation line. The printed B1-1 expense total equals that face bridge
exactly. The connector does **not** use OLG all-rights data: the reconciliation is internal to the
audited document. Both the printed net result and before-capital result are positive, so no
`gpfs_printed_sign` marker is emitted and the before-capital result is retained in reconciliation
evidence only.

**Rows.** **17 rows**, source id `newcastle-gpfs`, `source_dataset` "Newcastle City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Newcastle City Council"` (the exact published entity name
in the audited statements), `data_quality_flag: "provisional/local_government"`, `verified: false`.
The minimum lines are total revenue `$497,702,000`, total expenses `$399,363,000`, employee
expenses `$149,707,000`, depreciation/amortisation/impairment `$71,942,000`, operating government
grants `$21,222,000`, capital government grants `$89,603,000`, net loss on disposal of assets
`$12,132,000` and net result `$98,339,000`; the printed face-statement revenue and expense
components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and area panels therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The 4 pre-existing rows whose `delivery_entity` exactly names
"Newcastle City Council" are **1 exact-case "Newcastle City Council" GrantConnect grant, 1 uppercase
"NEWCASTLE CITY COUNCIL" AusTender contract and 2 uppercase "NEWCASTLE CITY COUNCIL" GrantConnect
grants**; 1 additional GrantConnect row uses the distinct brand string "City of Newcastle", and the
ACNC charity rows and 3 data.nsw school rows that merely mention Newcastle use different
`delivery_entity` values. Their per-source counts are identical before and after the ingest, and
they are never summed with the GPFS rows. Government grant rows carry `potential_double_count: true`
because they may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,588 → **515,605** (exactly +17);
`newcastle-gpfs` **17**; `wollongong-gpfs` still **17**; `sutherland-shire-gpfs` still **17**;
`canterbury-bankstown-gpfs` still **17**; `northern-beaches-gpfs` still **18**; `parramatta-gpfs`
still **17**; `blacktown-gpfs` still **17**; `city-of-sydney-gpfs` still **18**; `dubbo-council`
still **245**; `dubbo-council-gpfs` still **18**; `data-nsw-ckan` still **3,472**; `data_sources`
34 → **35**. A second ingest run upserted the same 17 natural keys and left the DB total unchanged
(idempotent). No deletes or updates to any other source.

---

### 7.10 Tenth council — Lake Macquarie City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official Annual Report page
<https://www.lakemac.com.au/Our-Council/City-strategies-plans-and-reporting/Annual-Report>. Plain
HTTP to `lakemac.com.au` is rejected with an Akamai HTTP 403, and during discovery the site also
intermittently served a Granicus/OpenCities "website temporarily unavailable" failover page, so
discovery and the PDF download use the documented headless Chromium/Playwright path (the same path
as Wollongong). The page's FY2024-25 anchor **"Annual financial statements for the year ended 30 June
2025(PDF, 2MB)"** resolves to
<https://www.lakemac.com.au/files/assets/public/v/1/council/annual-reports/annual-financial-statements-for-the-year-ended-30-june-2025.pdf>
(2,290,159 bytes). The URL is parsed from the browser-cleared page HTML, never hard-coded. Exact
bytes are archived outside the repo at
`/home/steve/ausspend-source-archive/lake-macquarie-gpfs/annual-financial-statements-for-the-year-ended-30-june-2025.pdf`,
SHA-256 `b5e031999a9e37d69e8df2afcd9a1756adb95229218412dc5919ee16fb93b72b`, with the archive
metadata record alongside (`hash_verified: true`). The printed unit is explicit `$ '000` on the
Income Statement (p4), the Statement of Comprehensive Income (p5) and note B1-1 (p14); a missing or
conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label, with Actual 2025 and Actual 2024 after it. The connector takes the first amount
after each printed label (the FY2024-25 actual) and emits nothing unless all of these agree exactly:

| Check                                                                                                                       |                             Printed / derived | Result                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------: | ------------------------------------------------------------------------------------------ |
| Total income from continuing operations (Income Statement p4)                                                               |                           `$463,613` thousand | = `$463,613,000`                                                                           |
| Revenue components sum (rates + user charges + other revenue + operating grants + capital grants + interest + other income) |                           `$463,613` thousand | = printed total                                                                            |
| Total expenses excluding depreciation (printed p4)                                                                          |                           `$255,396` thousand | = expense components sum (employee + materials + borrowing + other + net loss on disposal) |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$83,068`)                          |  `$255,396` + `$83,068` = `$338,464` thousand | = total expenses documented bridge (no "Total expenses" line is printed)                   |
| B1-1 Total functions and activities — income / expenses / operating result                                                  | `$463,613` / `$338,464` / `$125,149` thousand | income and expenses equal the face bridge; operating result = Income Statement net result  |
| B1-1 grants and contributions                                                                                               |                           `$156,931` thousand | = operating `$24,924` + capital `$132,007`                                                 |
| Net operating result before capital grants                                                                                  |                           `$(6,858)` thousand | = `$125,149 − $132,007` (negative; reconciliation evidence only)                           |
| Statement of Comprehensive Income net result                                                                                |                           `$125,149` thousand | = Income Statement net result                                                              |

Total expenses is the documented bridge of two printed lines (`$255,396 + $83,068 = $338,464`),
**not** a sum of the nature components on its own and **not** the separate printed
expenses-excluding-depreciation line. The printed B1-1 expense total equals that face bridge
exactly. The connector does **not** use OLG all-rights data: the reconciliation is internal to the
audited document. The printed net result is positive, so no `gpfs_printed_sign` marker is emitted;
the negative before-capital result is retained in reconciliation evidence only.

**Rows.** **17 rows**, source id `lake-macquarie-gpfs`, `source_dataset` "Lake Macquarie City Council
GPFS 2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Lake Macquarie City Council"` (the exact published entity
name in the audited statements), `data_quality_flag: "provisional/local_government"`, `verified:
false`. The minimum lines are total revenue `$463,613,000`, total expenses `$338,464,000`, employee
expenses `$119,020,000`, depreciation/amortisation/impairment `$83,068,000`, operating government
grants `$24,924,000`, capital government grants `$132,007,000`, net loss on disposal of assets
`$14,040,000` and net result `$125,149,000`; the printed face-statement revenue and expense
components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and area panels therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The 4 pre-existing rows whose `delivery_entity` exactly names
"Lake Macquarie City Council" are **1 exact-case "Lake Macquarie City Council" GrantConnect grant, 1
uppercase "LAKE MACQUARIE CITY COUNCIL" AusTender contract and 2 uppercase "LAKE MACQUARIE CITY
COUNCIL" GrantConnect grants**; the other rows that merely mention Lake Macquarie (ACNC charities,
data.nsw schools, "Home Modifications Lake Macquarie/Newcastle Limited" etc.) use different
`delivery_entity` values. Their per-source counts are identical before and after the ingest, and
they are never summed with the GPFS rows. Government grant rows carry `potential_double_count: true`
because they may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,605 → **515,622** (exactly +17);
`lake-macquarie-gpfs` **17**; `newcastle-gpfs` still **17**; `wollongong-gpfs` still **17**;
`sutherland-shire-gpfs` still **17**; `canterbury-bankstown-gpfs` still **17**;
`northern-beaches-gpfs` still **18**; `parramatta-gpfs` still **17**; `blacktown-gpfs` still **17**;
`city-of-sydney-gpfs` still **18**; `dubbo-council` still **245**; `dubbo-council-gpfs` still **18**;
`data-nsw-ckan` still **3,472**; `data_sources` 35 → **36**. A second ingest run upserted the same
17 natural keys and left the DB total unchanged (idempotent). No deletes or updates to any other
source.

### 7.11 Eleventh council — Maitland City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official "Financial reports and plans" page
<https://www.maitland.nsw.gov.au/council/about-council/financial-reports-and-plans>. The page is
served over plain HTTP (no Cloudflare/Akamai challenge was observed), so discovery and the PDF
download use direct fetch. The page's FY2024-25 anchor **"General Purpose Financial Report
2024-25"** resolves to
<https://www.maitland.nsw.gov.au/sites/default/files/documents/2025-11/Financial%20Statements%202024-25%20Final.pdf>
(1,196,382 bytes; HTTP 200 `application/pdf`). The URL is parsed from the page HTML, never
hard-coded. Exact bytes are archived outside the repo at
`/home/steve/ausspend-source-archive/maitland-gpfs/Financial-Statements-2024-25-Final.pdf`,
SHA-256 `bc67c592a9cb0bade12b62e88457b3f67dad434442ec3bc59b15ea7c8aafbda8`, with the archive
metadata record alongside (`hash_verified: true`). The printed unit is explicit `$'000` on the
Income Statement (p4), the Statement of Comprehensive Income (p5) and note B1-1 (p12); a missing or
conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label. Maitland's plain-text stream therefore interleaves the budget column and places
the depreciation label after its amounts, so the connector reads positioned text items (x/y) and
takes the amount in the Actual 2025 column after each printed label. The Income Statement does not
print a combined "Total expenses" line: the printed B1-1 "Net operating result for the year" row
prints total expenses `$169,995` thousand, which equals printed total income `$219,016` thousand
less the printed net result `$49,021` thousand. Those top-level printed totals reconcile exactly:

| Check                                                                                           |                            Printed / derived | Result                                          |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------: | ----------------------------------------------- |
| Total income from continuing operations (Income Statement p4)                                   |                          `$219,016` thousand | = `$219,016,000`                                |
| Total expenses (B1-1 p12 printed expenses; equals printed total income less printed net result) |                          `$169,995` thousand | = `$219,016,000 − $49,021,000`                  |
| Net operating result for the year attributable to Council (Income Statement p4)                 |                           `$49,021` thousand | = printed total income − printed total expenses |
| B1-1 Total (income / expenses / operating result)                                               | `$219,016` / `$169,995` / `$49,021` thousand | equals the face statement                       |
| Statement of Comprehensive Income net result (p5)                                               |                           `$49,021` thousand | = Income Statement net result                   |
| Income Statement expenses excluding depreciation = expense-by-nature components sum             |                          `$137,168` thousand | exact                                           |
| Income Statement depreciation line = note B3-3 total                                            |                           `$32,828` thousand | exact                                           |

The published actual/prior columns carry a **+/-$1 thousand rounding** in the component lines:
revenue components sum to `$219,017` (vs `$219,016`); printed expenses excluding depreciation
`$137,168` plus printed depreciation `$32,828` = `$169,996` (vs the printed B1-1 `$169,995`);
printed operating + capital grants `$75,738` (vs B1-1 `$75,739`); the printed before-capital result
is `$(15,562)` (vs net result less capital grants `$(15,561)`). The connector verifies that rounding
is at most 1 thousand, retains it as reconciliation evidence, and **does not emit the component
rows** (so components are never summed). The connector does **not** use OLG all-rights data.

**Rows.** **7 rows**, source id `maitland-gpfs`, `source_dataset` "Maitland City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Maitland City Council"` (the exact published entity name in
the audited statements), `data_quality_flag: "provisional/local_government"`, `verified: false`.
Only the printed top-level categories that reconcile exactly are emitted: total revenue
`$219,016,000`, total expenses `$169,995,000`, employee expenses `$64,466,000`,
depreciation/amortisation/impairment `$32,828,000`, operating government grants `$11,156,000`,
capital government grants `$64,582,000` and net result `$49,021,000`. No revenue/expense component
rows and no region/LGA allocation are emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`; the generic additive API and area panels exclude them. The rows have **no
`region_id` and no `location`/LGA allocation**, so they cannot be summed into any other council or
state rows. The 1 pre-existing row whose `delivery_entity` exactly names "MAITLAND CITY COUNCIL" is
an uppercase GrantConnect grant (`grantconnect:GA521629`); the 205 other rows that merely mention
Maitland in `delivery_entity` (ACNC 134, GrantConnect 61, AusTender 6, data.nsw 4) and the NSW
Budget rows whose `project_name` mentions Maitland use different entities. Their per-source counts
are identical before and after the ingest, and they are never summed with the GPFS rows. Government
grant rows carry `potential_double_count: true` because they may overlap government program data;
they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,622 → **515,629** (exactly +7);
`maitland-gpfs` **7**; `lake-macquarie-gpfs` still **17**; `newcastle-gpfs` still **17**;
`wollongong-gpfs` still **17**; `sutherland-shire-gpfs` still **17**; `canterbury-bankstown-gpfs`
still **17**; `northern-beaches-gpfs` still **18**; `parramatta-gpfs` still **17**; `blacktown-gpfs`
still **17**; `city-of-sydney-gpfs` still **18**; `dubbo-council` still **245**; `dubbo-council-gpfs`
still **18**; `data-nsw-ckan` still **3,472**; `data_sources` 36 → **37**. A second ingest run
upserted the same 7 natural keys and left the DB total unchanged (idempotent). No deletes or updates
to any other source.

### 7.12 Twelfth council — Coffs Harbour City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official Annual Report page
<https://www.coffsharbour.nsw.gov.au/Your-Council/Our-responsibilities/Corporate-planning-and-reporting/Annual-Report>.
Plain HTTP to `coffsharbour.nsw.gov.au` is rejected by an Akamai edge with **HTTP 403**, which is not
proof of absence; the documented headless Chromium/Playwright path (`scripts/coffs-harbour-gpfs-browser.ts`)
clears it, and the connector still discovers the link from the cleared page HTML (never hard-coded).
The FY2024-25 anchor **"Annual Report Section 3 - Annual Financial Statements 2024-25"**
(`title="2024-25-Annual-Report-Section-3.pdf"`) resolves to
<https://www.coffsharbour.nsw.gov.au/files/sharedassets/public/v/1/resident-services/your-council/corporate-planning-and-reporting/202425/annual-report-24-25/2024-25-annual-report-section-3.pdf>
(4,006,409 bytes; HTTP 200 `application/pdf`). The separate FY2025-26 Section 3 link is discovered but
not selected. Exact bytes are archived outside the repo at
`/home/steve/ausspend-source-archive/coffs-harbour-gpfs/2024-25-annual-report-section-3.pdf`,
SHA-256 `026fd09fed7099b1276beb2775c62193d00e60ed13c7f71c72a202c7f25ebf5e`, with the archive
metadata record alongside (`hash_verified: true`). The printed unit is explicit `$ '000` on the Income
Statement (p5 of 101), the Statement of Comprehensive Income (p6), note B1-1 (p15) and note B3-4
(p26); a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label, so each emitted value is the first amount after the printed label (the FY2024-25
actual). The Income Statement does not print a combined "Total expenses" line. Total expenses is the
printed B1-1 "Total functions and activities" expense total `$213,278` thousand, which equals the
printed expenses-excluding-depreciation line `$155,527` thousand plus the printed depreciation line
`$57,751` thousand, and equals printed total income `$295,498` thousand less the printed continuing
operating result `$82,220` thousand. The printed net result `$81,833` thousand is the continuing
operating result less the printed discontinued-operations result `$(387)` thousand, and the Statement
of Comprehensive Income repeats it. Those top-level printed totals reconcile exactly:

| Check                                                                                    |              Printed / derived | Result                                                |
| ---------------------------------------------------------------------------------------- | -----------------------------: | ----------------------------------------------------- |
| Total income from continuing operations (Income Statement p5)                            |            `$295,498` thousand | = `$295,498,000`                                      |
| Total expenses (printed B1-1 p15; equals expenses excluding depreciation + depreciation) |            `$213,278` thousand | = `$155,527 + $57,751`                                |
| Employee benefits and on-costs                                                           |             `$60,823` thousand | printed                                               |
| Depreciation, amortisation and impairment (Income Statement p5) = note B3-4 total        |             `$57,751` thousand | exact                                                 |
| Operating grants / capital grants                                                        | `$19,058` / `$64,207` thousand | B1-1 grants `$83,265` = `$19,058 + $64,207`           |
| Continuing operating result (Income Statement p5)                                        |             `$82,220` thousand | = printed total income − printed total expenses       |
| Net operating result for the year attributable to Council (Income Statement p5)          |             `$81,833` thousand | = continuing result `$82,220` − discontinued `$(387)` |
| Statement of Comprehensive Income net result (p6)                                        |             `$81,833` thousand | = Income Statement net result                         |
| Revenue components sum = printed total income                                            |            `$295,498` thousand | exact                                                 |
| Expense components sum = printed expenses excluding depreciation                         |            `$155,527` thousand | exact                                                 |
| Printed net result − capital grants = printed before-capital result                      |             `$17,626` thousand | exact                                                 |

The connector emits the printed revenue and expense components plus the printed totals; each
component carries `gpfs_component_of` naming its printed subtotal, and printed totals are never
recomputed from components. The negative discontinued-operations result and the positive
before-capital result are reconciliation evidence only, never stored rows. The connector does
**not** use OLG all-rights data or any data.nsw fallback.

**Rows.** **17 rows**, source id `coffs-harbour-gpfs`, `source_dataset` "Coffs Harbour City Council
GPFS 2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Coffs Harbour City Council"` (the exact published entity
name in the audited statements), `data_quality_flag: "provisional/local_government"`,
`verified: false`. Only printed Income Statement categories are emitted: total revenue
`$295,498,000`, total expenses `$213,278,000`, total expenses excluding depreciation
`$155,527,000`, employee expenses `$60,823,000`, materials and services `$75,906,000`, borrowing
costs `$5,702,000`, other expenses `$4,236,000`, net loss from disposal of assets `$8,860,000`,
depreciation/amortisation/impairment `$57,751,000`, rates and annual charges `$119,875,000`, user
charges and fees `$53,927,000`, other revenues `$15,038,000`, operating government grants
`$19,058,000`, capital government grants `$64,207,000`, interest and investment income
`$20,711,000`, other income `$2,682,000` and net result `$81,833,000`. No B1-1 function split and no
region/LGA allocation are emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`; the generic additive API and area panels exclude them. The rows have **no
`region_id` and no `location`/LGA allocation**, so they cannot be summed into any other council or
state rows. There is **no row whose `delivery_entity` exactly names "Coffs Harbour City Council"**;
the closest pre-existing rows are 2 AusTender federal contracts whose `delivery_entity` is the
different string "CITY OF COFFS HARBOUR", and 199 further rows whose `delivery_entity` merely
mentions Coffs Harbour under other delivery_entity strings (ACNC, data.nsw schools, NSW Budget
project rows). Their per-source counts are identical before and after the ingest, and they are never
summed with the GPFS rows. Government grant rows carry `potential_double_count: true` because they
may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,629 → **515,646** (exactly +17);
`coffs-harbour-gpfs` **17**; `maitland-gpfs` still **7**; `lake-macquarie-gpfs` still **17**;
`newcastle-gpfs` still **17**; `wollongong-gpfs` still **17**; `sutherland-shire-gpfs` still **17**;
`canterbury-bankstown-gpfs` still **17**; `northern-beaches-gpfs` still **18**; `parramatta-gpfs`
still **17**; `blacktown-gpfs` still **17**; `city-of-sydney-gpfs` still **18**; `dubbo-council`
still **245**; `dubbo-council-gpfs` still **18**; `CITY OF COFFS HARBOUR` AusTender rows still **2**;
`data_sources` 37 → **38**. A second ingest run upserted the same 17 natural keys and left the DB
total unchanged (idempotent). No deletes or updates to any other source.

### 7.13 Thirteenth council — MidCoast Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official "Reporting our progress" page
<https://www.midcoast.nsw.gov.au/Your-Council/About-MidCoast-Council/Plans-strategies-and-policies/Reporting-our-progress>.
Node's direct HTTP fetch to `midcoast.nsw.gov.au` is rejected by an Akamai-style edge with **HTTP 403**,
which is not proof of absence; the documented headless Chromium/Playwright path
(`scripts/mid-coast-gpfs-browser.ts`) clears it and the connector still discovers the FY2024-25 link
from the cleared page HTML (never hard-coded). The FY2024-25 anchor **"Financial Statement 2024-2025
(PDF, 3MB)"** resolves to
<https://www.midcoast.nsw.gov.au/files/assets/public/v/1/document-resources/council/plans-amp-publications/operational-plans-amp-fees-amp-charges/financial-statements/financial-statements-2024-2025.pdf>
(2,972,797 bytes). The older years ("Financial Statement 2023-2024", "2022-2023", …) and the annual
report/annual-report-summary anchors are discovered but not selected. Exact bytes are archived outside
the repo at
`/home/steve/ausspend-source-archive/mid-coast-gpfs/financial-statements-2024-2025.pdf`,
SHA-256 `f8f7ede3d8c09467e5f1aea72e697a9278d4d78fd527778c63ccb0d9e3a5e3fe`, with the archive
metadata record alongside (`hash_verified: true`). The printed unit is explicit `$ '000` on the
Income Statement (PDF page 6, printed p4), the Statement of Comprehensive Income (PDF page 7, printed
p5), note B1-1 (PDF page 15, printed p13) and note B3-4 (PDF page 26, printed p24); a missing or
conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label, so each emitted value is the first amount after the printed label (the FY2024-25
actual). The Income Statement does not print a combined "Total expenses" line. Total expenses is the
printed B1-1 "Total functions and activities" expense total `$335,094` thousand, which equals the
printed expenses-excluding-depreciation line `$240,404` thousand plus the printed depreciation line
`$94,690` thousand, and equals printed total income `$374,152` thousand less the printed operating
result `$39,058` thousand. The printed net result equals the printed operating result (there are no
discontinued operations) and the Statement of Comprehensive Income repeats it. Those top-level printed
totals reconcile exactly:

| Check                                                                                                                       |              Printed / derived | Result                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | -----------------------------: | ----------------------------------------------------------------------- |
| Total income from continuing operations (Income Statement p4)                                                               |            `$374,152` thousand | = `$374,152,000`                                                        |
| Revenue components sum (rates + user charges + other revenue + operating grants + capital grants + interest + other income) |            `$374,152` thousand | = printed total income                                                  |
| Total expenses (printed B1-1 p13; equals expenses excluding depreciation + depreciation)                                    |            `$335,094` thousand | = `$240,404 + $94,690`                                                  |
| Expenses excluding depreciation = expense-by-nature components sum                                                          |            `$240,404` thousand | exact (employee + materials + borrowing + other + net loss on disposal) |
| Employee benefits and on-costs                                                                                              |             `$96,581` thousand | printed                                                                 |
| Depreciation, amortisation and impairment (Income Statement p4) = note B3-4 total                                           |             `$94,690` thousand | exact                                                                   |
| Operating grants / capital grants                                                                                           | `$32,764` / `$70,923` thousand | B1-1 grants `$103,687` = `$32,764 + $70,923`                            |
| Operating result from continuing operations (Income Statement p4)                                                           |             `$39,058` thousand | = printed total income − printed total expenses                         |
| Net operating result for the year attributable to Council (Income Statement p4)                                             |             `$39,058` thousand | = printed operating result (no discontinued operations)                 |
| Statement of Comprehensive Income net result (p5)                                                                           |             `$39,058` thousand | = Income Statement net result                                           |
| Net result before capital grants                                                                                            |           `$(31,865)` thousand | = `$39,058 − $70,923` (negative; evidence only)                         |

The connector emits only the printed Income Statement categories; printed totals are never recomputed
from components. The positive net result is stored as a non-negative magnitude; the negative
before-capital result is reconciliation evidence only and is never a stored row. The connector does
**not** use OLG all-rights data or any data.nsw fallback.

**Rows.** **17 rows**, source id `mid-coast-gpfs`, `source_dataset` "MidCoast Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`, `jurisdiction:
"NSW"`, `delivery_entity: "MidCoast Council"` (the exact published entity name in the audited
statements), `data_quality_flag: "provisional/local_government"`, `verified: false`. Only printed
Income Statement categories are emitted: total revenue `$374,152,000`, total expenses
`$335,094,000`, total expenses excluding depreciation `$240,404,000`, employee expenses
`$96,581,000`, materials and services `$100,060,000`, borrowing costs `$9,625,000`, other expenses
`$13,415,000`, net loss from disposal of assets `$20,723,000`, depreciation/amortisation/impairment
`$94,690,000`, rates and annual charges `$184,721,000`, user charges and fees `$54,668,000`, other
revenues `$5,130,000`, operating government grants `$32,764,000`, capital government grants
`$70,923,000`, interest and investment income `$18,518,000`, other income `$7,428,000` and net result
`$39,058,000`. No B1-1 function split and no region/LGA allocation are emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`; the generic additive API and area panels exclude them. The rows have **no
`region_id` and no `location`/LGA allocation**, so they cannot be summed into any other council or
state rows. There are **2 pre-existing AusTender federal contract rows whose `delivery_entity` is
exactly "MidCoast Council"** (`D157039636`, `D157042061`); they share the published entity name but a
different `source_id`, are preserved untouched, and are never summed with the 17 GPFS rows. A further
31 rows mention Mid-Coast/MidCoast under other delivery_entity strings (10 AusTender, 5 GrantConnect,
16 ACNC charities such as "MIDCOAST MARINE INTERNATIONAL PTY LTD" and "MidCoast Christian College,
Taree"). Their per-source counts are identical before and after the ingest, and they are never summed
with the GPFS rows. Government grant rows carry `potential_double_count: true` because they may
overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,646 → **515,663** (exactly +17);
`mid-coast-gpfs` **17**; `coffs-harbour-gpfs` still **17**; `maitland-gpfs` still **7**;
`lake-macquarie-gpfs` still **17**; `newcastle-gpfs` still **17**; `wollongong-gpfs` still **17**;
`sutherland-shire-gpfs` still **17**; `canterbury-bankstown-gpfs` still **17**; `northern-beaches-gpfs`
still **18**; `parramatta-gpfs` still **17**; `blacktown-gpfs` still **17**; `city-of-sydney-gpfs`
still **18**; `dubbo-council` still **245**; `dubbo-council-gpfs` still **18**; `data-nsw-ckan` still
**3,472**; exact "MidCoast Council" rows 2 → **19** (2 pre-existing + 17 GPFS, distinguished by
`source_id`); `data_sources` 38 → **39**. A second ingest run upserted the same 17 natural keys and
left the DB total unchanged (idempotent). No deletes or updates to any other source.

---

### 7.14 Fourteenth council — Port Macquarie-Hastings Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official "Annual reports and statements" page
<https://www.pmhc.nsw.gov.au/Your-Council/Council-reports/Annual-reports-and-statements>.
Node's direct HTTP fetch to `pmhc.nsw.gov.au` is rejected by an Akamai-style edge with **HTTP 403**
("Access Denied"), which is not proof of absence; the documented headless Chromium/Playwright path
(`scripts/port-macquarie-hastings-gpfs-browser.ts`) clears it and the connector still discovers the
FY2024-25 link from the cleared page HTML (never hard-coded). The FY2024-25 anchor **"Part 2 |
Financial Statements (PDF, 8MB)"** (title "Part 2 Financial Statements") resolves to
<https://www.pmhc.nsw.gov.au/files/assets/public/v/1/document-files/your-council/election/annualreports/2024-2025/part-2-financial-statements.pdf>
(8,407,089 bytes). The older years ("Part 2 | Financial Statements (PDF, 38MB)" for 2023-24 and the
2022-23 statements) are discovered but not selected. Exact bytes are archived outside the repo at
`/home/steve/ausspend-source-archive/port-macquarie-hastings-gpfs/part-2-financial-statements.pdf`,
SHA-256 `e73a1cd805f9431001da032e88c2408fb8ad19eed083d2adc46e7850cb16618c`, with the archive
metadata record alongside (`hash_verified: true`) and the cleared listing HTML. The printed unit is
explicit `$ '000` on the Income Statement (PDF page 7, printed p4), the Statement of Comprehensive
Income (PDF page 8, printed p5), note B1-1 (PDF page 16, printed p13) and note B3-4 (PDF page 26,
printed p23); a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label, so each emitted value is the first amount after the printed label (the FY2024-25
actual). The Income Statement does not print a combined "Total expenses" line. Total expenses is the
printed B1-1 "Total functions and activities" expense total `$229,835` thousand, which equals the
printed expenses-excluding-depreciation line `$167,671` thousand plus the printed
depreciation/impairment line `$62,164` thousand, and equals printed total income `$307,229` thousand
less the printed operating result `$77,394` thousand. The printed net result equals the printed
operating result (there are no discontinued operations) and the Statement of Comprehensive Income
repeats it. Those top-level printed totals reconcile exactly:

| Check                                                                                                                       |              Printed / derived | Result                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | -----------------------------: | ----------------------------------------------------------------------- |
| Total income from continuing operations (Income Statement p4)                                                               |            `$307,229` thousand | = `$307,229,000`                                                        |
| Revenue components sum (rates + user charges + other revenue + operating grants + capital grants + interest + other income) |            `$307,229` thousand | = printed total income                                                  |
| Total expenses (printed B1-1 p13; equals expenses excluding depreciation + depreciation/impairment)                         |            `$229,835` thousand | = `$167,671 + $62,164`                                                  |
| Expenses excluding depreciation = expense-by-nature components sum                                                          |            `$167,671` thousand | exact (employee + materials + borrowing + other + net loss on disposal) |
| Employee benefits and on-costs                                                                                              |             `$74,948` thousand | printed                                                                 |
| Depreciation and impairment of non-financial assets (Income Statement p4) = note B3-4 total                                 |             `$62,164` thousand | exact                                                                   |
| Operating grants / capital grants                                                                                           | `$15,089` / `$92,780` thousand | B1-1 grants `$107,869` = `$15,089 + $92,780`                            |
| Operating result from continuing operations (Income Statement p4)                                                           |             `$77,394` thousand | = printed total income − printed total expenses                         |
| Net operating result for the year attributable to Council (Income Statement p4)                                             |             `$77,394` thousand | = printed operating result (no discontinued operations)                 |
| Statement of Comprehensive Income net result (p5)                                                                           |             `$77,394` thousand | = Income Statement net result                                           |
| Net result before capital grants                                                                                            |           `$(15,386)` thousand | = `$77,394 − $92,780` (negative; evidence only)                         |

The connector emits only the printed Income Statement categories; printed totals are never recomputed
from components. The positive net result is stored as a non-negative magnitude; the negative
before-capital result is reconciliation evidence only and is never a stored row. The connector does
**not** use OLG all-rights data or any data.nsw fallback.

**Rows.** **17 rows**, source id `port-macquarie-hastings-gpfs`, `source_dataset` "Port
Macquarie-Hastings Council GPFS 2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`,
`jurisdiction_level: "local"`, `jurisdiction: "NSW"`, `delivery_entity: "Port Macquarie-Hastings
Council"` (the exact published entity name in the audited statements), `data_quality_flag:
"provisional/local_government"`, `verified: false`. Only printed Income Statement categories are
emitted: total revenue `$307,229,000`, total expenses `$229,835,000`, total expenses excluding
depreciation `$167,671,000`, employee expenses `$74,948,000`, materials and services `$76,589,000`,
borrowing costs `$614,000`, other expenses `$8,733,000`, net loss from disposal of assets
`$6,787,000`, depreciation/impairment `$62,164,000`, rates and annual charges `$122,578,000`, user
charges and fees `$47,803,000`, other revenues `$8,149,000`, operating government grants
`$15,089,000`, capital government grants `$92,780,000`, interest and investment income
`$15,263,000`, other income `$5,567,000` and net result `$77,394,000`. No B1-1 function split and no
region/LGA allocation are emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`; the generic additive API and area panels exclude them. The rows have **no
`region_id` and no `location`/LGA allocation**, so they cannot be summed into any other council or
state rows. There were **no pre-existing rows whose `delivery_entity` is exactly "Port
Macquarie-Hastings Council"** before this ingest (0 → 17, all GPFS). **2 pre-existing GrantConnect
rows use the uppercase, hyphen-less string "PORT MACQUARIE HASTINGS COUNCIL"**; they share the
entity but a different `source_id` and string, are preserved untouched, and are never summed with the
17 GPFS rows. In total **147 pre-existing non-GPFS rows mention "Port Macquarie"** under other
delivery_entity strings (including those 2 GrantConnect rows, plus ACNC charities, GrantConnect
schools/clubs and a handful of data.nsw/AusTender rows); their per-source counts are identical before
and after the ingest and they are never summed with the GPFS rows. Government grant
rows carry `potential_double_count: true` because they may overlap government program data; they are
not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,663 → **515,680** (exactly +17);
`port-macquarie-hastings-gpfs` **17**; `mid-coast-gpfs` still **17**; `coffs-harbour-gpfs` still
**17**; `maitland-gpfs` still **7**; `lake-macquarie-gpfs` still **17**; `newcastle-gpfs` still
**17**; `wollongong-gpfs` still **17**; `data-nsw-ckan` still **3,472**; `dubbo-council` still
**245**; exact "Port Macquarie-Hastings Council" rows 0 → **17**; `data_sources` 39 → **40**. A
second ingest run upserted the same 17 natural keys and left the DB total unchanged (idempotent). No
deletes or updates to any other source.

### 7.15 Fifteenth council — Tweed Shire Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official "Annual and financial reports" page
<https://www.tweed.nsw.gov.au/council/policies-plans-reports/annual-financial-reports> (no
hard-coded document URL): the link text **"Financial Statements 2024–2025"** resolves to
<https://www.tweed.nsw.gov.au/files/assets/public/v/1/documents/council/annual-and-financial-reports/tweed-shire-council-financial-statements-2024-2025.pdf>.
The page is served over plain HTTP (no edge challenge). Exact bytes archived outside the repo at
`~/ausspend-source-archive/tweed-shire-gpfs/tweed-shire-council-financial-statements-2024-2025.pdf`:
**4,202,080 bytes**, SHA-256
`8eabbdf40bf180e051598eaa90d542ca3ab8b7a27187ff0b8230b0433e7dee8f` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the income statement and note B1-1; a missing or
conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label, so each emitted value is the first amount after the printed label (the FY2024-25
actual). The printed expense-subtotal label is wrapped around the budget amount ("… impairment of
non-financial 159,480 assets 186,872 175,509"), so the connector reads the value after the trailing
word ("assets"), never the budget. The connector emits nothing unless all of these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ----------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                   |                          `$342,922` thousand | = `$342,922,000`                          |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$342,922` thousand | = printed total                           |
| B1-1 Total functions and activities — income                                                                                 |                          `$342,922` thousand | = face statement                          |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                           |                          `$186,872` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$70,596`)                           | `$186,872` + `$70,596` = `$257,468` thousand | = B1-1 expense total                      |
| B1-1 Total functions and activities — expenses                                                                               |                          `$257,468` thousand | = `$257,468,000` (printed total)          |
| Operating result / net operating result                                                                                      | `$342,922` − `$257,468` = `$85,454` thousand | = printed operating result                |
| Net operating result for the year attributable to Council                                                                    |                           `$85,454` thousand | = operating result                        |
| Net operating result before capital grants                                                                                   |    `$85,454` − `$79,561` = `$5,893` thousand | = printed before-capital result           |
| B1-1 grants and contributions                                                                                                |                           `$97,530` thousand | = operating `$17,969` + capital `$79,561` |
| Statement of Comprehensive Income net result                                                                                 |                           `$85,454` thousand | = Income Statement net result             |
| Note B3-4 total depreciation and amortisation costs                                                                          |                           `$70,596` thousand | = face depreciation line                  |

**Rows.** 17 rows, source id `tweed-shire-gpfs`, `source_dataset` "Tweed Shire Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Tweed Shire Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$342,922,000`, total expenses `$257,468,000`, employee expenses `$73,832,000`,
depreciation/amortisation/impairment `$70,596,000`, operating government grants `$17,969,000`,
capital government grants `$79,561,000` and net result `$85,454,000`; the face-statement revenue and
expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: **1 GrantConnect row** whose
`delivery_entity` is exactly "Tweed Shire Council", plus **183 other rows** whose `delivery_entity`
merely mentions Tweed under other strings (78 ACNC, 43 GrantConnect, 5 AusTender, 54 QLD QGIP and 3
data.nsw rows); their per-source counts are identical before and after the ingest. All fourteen
other council GPFS sources are unchanged (Dubbo 18, City of Sydney 18, Blacktown 17, Parramatta 17,
Northern Beaches 18, Canterbury-Bankstown 17, Sutherland Shire 17, Wollongong 17, Newcastle 17, Lake
Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17, Port Macquarie-Hastings 17). Government
grant rows carry `potential_double_count: true` because they may overlap government program data;
they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,680 → **515,697** (exactly +17);
`tweed-shire-gpfs` **17**; `data-nsw-ckan` still **3,472**; `dubbo-council` still **245**; exact
"Tweed Shire Council" rows 1 → **18** (the new 17 plus the pre-existing GrantConnect row);
`data_sources` 40 → **41**. A second ingest run upserted the same 17 natural keys and left the DB
total unchanged (idempotent). No deletes or updates to any other source.

---

### 7.16 Sixteenth council — Shoalhaven City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official "Financial statements" page
<https://www.shoalhaven.nsw.gov.au/Council/Reports/Financial-statements> (no hard-coded document URL).
That page presents the latest FY2025-26 statements and links to **"Financial Statements - Previous
Years"** <https://www.shoalhaven.nsw.gov.au/Council/Publicly-available-information/Finance/Financial-Statements-Previous-Years>.
The previous-years page embeds a Granicus/CM2Web React grid in an iframe
(`https://cm2web.shoalhaven.nsw.gov.au/CM2WebShare/Grid?id=b7ded5f0-513e-4675-b7fc-1268a5419269`);
its public `GridResults` endpoint lists **"Annual Financial Statements 2024-2025"** as record uri
`10102076`. The connector selects that record by its printed title (never by a hard-coded PDF URL)
and fetches the bytes from the official record endpoint
<https://doc.shoalhaven.nsw.gov.au/LinkGeneratorAPI/record/10102076/preview_latest_final_version_pdf>.
The page and grid are served over plain HTTP (no edge challenge); no headless browser was required.
Exact bytes archived outside the repo at
`~/ausspend-source-archive/shoalhaven-gpfs/shoalhaven-city-council-financial-statements-2024-25.pdf`:
**5,881,682 bytes**, SHA-256
`74076e6f5b966575deb498e3805c9f5ff66aaa71ace5b001972f7d33313add20` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the income statement, B1-1 and the depreciation
note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label, so each emitted value is the first amount after the printed label (the FY2024-25
actual). The phrase "depreciation, amortisation and impairment of non-financial assets" appears in
the expense subtotal and in the excluding-depreciation result before the actual depreciation line,
so the connector reads that line from the last printed occurrence. The connector emits nothing
unless all of these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ----------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                   |                          `$418,722` thousand | = `$418,722,000`                          |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$418,722` thousand | = printed total                           |
| B1-1 Total functions and activities — income                                                                                 |                          `$418,722` thousand | = face statement                          |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                           |                          `$247,116` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$97,315`)                           | `$247,116` + `$97,315` = `$344,431` thousand | = B1-1 expense total                      |
| B1-1 Total functions and activities — expenses                                                                               |                          `$344,431` thousand | = `$344,431,000` (printed total)          |
| Operating result / net operating result                                                                                      | `$418,722` − `$344,431` = `$74,291` thousand | = printed operating result                |
| Net operating result for the year attributable to Council                                                                    |                           `$74,291` thousand | = operating result                        |
| Net operating result before capital grants                                                                                   |  `$74,291` − `$75,533` = `$(1,242)` thousand | = printed before-capital result           |
| B1-1 grants and contributions                                                                                                |                           `$96,658` thousand | = operating `$21,125` + capital `$75,533` |
| Statement of Comprehensive Income net result                                                                                 |                           `$74,291` thousand | = Income Statement net result             |
| Note B3-4 total depreciation and amortisation costs                                                                          |                           `$97,315` thousand | = face depreciation line                  |

The printed "Net gain from the disposal of assets" line is a dash (zero) and is not emitted; the
seven revenue components still sum exactly to the printed total, which proves it is zero.

**Rows.** 17 rows, source id `shoalhaven-gpfs`, `source_dataset` "Shoalhaven City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Shoalhaven City Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$418,722,000`, total expenses `$344,431,000`, employee expenses `$114,992,000`,
depreciation/amortisation/impairment `$97,315,000`, operating government grants `$21,125,000`,
capital government grants `$75,533,000` and net result `$74,291,000`; the face-statement revenue and
expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: **1 GrantConnect row** whose
`delivery_entity` is exactly "Shoalhaven City Council", plus **135 other rows** whose
`delivery_entity` merely mentions Shoalhaven under other strings (96 ACNC, 19 AusTender, 18
GrantConnect and 2 data.nsw rows); their per-source counts are identical before and after the
ingest. All fifteen other council GPFS sources are unchanged (Dubbo 18, City of Sydney 18, Blacktown
17, Parramatta 17, Northern Beaches 18, Canterbury-Bankstown 17, Sutherland Shire 17, Wollongong 17,
Newcastle 17, Lake Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17, Port Macquarie-Hastings
17, Tweed Shire 17). Government grant rows carry `potential_double_count: true` because they may
overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,697 → **515,714** (exactly +17);
`shoalhaven-gpfs` **17**; `data-nsw-ckan` still **3,472**; `dubbo-council` still **245**; exact
"Shoalhaven City Council" rows 1 → **18** (the new 17 plus the pre-existing GrantConnect row);
`data_sources` 41 → **42**. A second ingest run upserted the same 17 natural keys and left the DB
total unchanged (idempotent). No deletes or updates to any other source.

### 7.17 Seventeenth council — Shellharbour City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official "Annual reports" page
<https://www.shellharbour.nsw.gov.au/council/news-and-publications/annual-reports> (plain HTTP, no
edge challenge). That page links the **"Annual Report 2024 - 2025"** page
<https://www.shellharbour.nsw.gov.au/council/forms-and-publications/annual-reports/annual-report-2024-2025>,
which links the council-hosted annual-report PDF
<https://cdn.shellharbour.nsw.gov.au/sites/default/files/Reports/full-report_2_4.pdf>
(58,205,018 bytes) and an **"Audited Financial Statements for year ending 30 June 2025"** section
link (a flipbook starting at p96). The audited GPFS is the 84-printed-page financial-statements
section of that official annual-report PDF: the Income Statement is printed p5 of 84 (PDF p54), the
Statement of Comprehensive Income p6 (PDF p55), B1-1 "Total functions and activities" p14 (PDF p63)
and note B3-4 depreciation p27 (PDF p76). The PDF URL is parsed from the page HTML, never
hard-coded. Exact bytes archived outside the repo at
`~/ausspend-source-archive/shellharbour-gpfs/full-report_2_4.pdf`, SHA-256
`f199f5e22b095f1f6b7acae84fc7bbb9414c206a01936a92202e46448a8f2894` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the income statement, B1-1, the comprehensive-income
statement and the depreciation note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label, so each emitted value is the first amount after the printed label (the FY2024-25
actual). The phrase "depreciation, amortisation and impairment of non-financial assets" appears in
the expense subtotal and in the excluding-depreciation result before the actual depreciation line,
so the connector reads that line from the last printed occurrence. The connector emits nothing
unless all of these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ----------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                   |                          `$310,293` thousand | = `$310,293,000`                          |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$310,293` thousand | = printed total                           |
| B1-1 Total functions and activities — income                                                                                 |                          `$310,293` thousand | = face statement                          |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                           |                          `$206,611` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$29,784`)                           | `$206,611` + `$29,784` = `$236,395` thousand | = B1-1 expense total                      |
| B1-1 Total functions and activities — expenses                                                                               |                          `$236,395` thousand | = `$236,395,000` (printed total)          |
| Operating result / net operating result                                                                                      | `$310,293` − `$236,395` = `$73,898` thousand | = printed operating result                |
| Net operating result for the year attributable to Council                                                                    |                           `$73,898` thousand | = operating result                        |
| Net operating result before capital grants                                                                                   |   `$73,898` − `$36,357` = `$37,541` thousand | = printed before-capital result           |
| B1-1 grants and contributions                                                                                                |                           `$44,892` thousand | = operating `$8,535` + capital `$36,357`  |
| Statement of Comprehensive Income net result                                                                                 |                           `$73,898` thousand | = Income Statement net result             |
| Note B3-4 total depreciation and amortisation costs                                                                          |                           `$29,784` thousand | = face depreciation line                  |

Total expenses is the printed B1-1 "Total functions and activities" expense total
(`$236,395` thousand), **not** a sum of the nature components on its own and **not** the separate
printed expenses-excluding-depreciation line. It equals the printed expenses-excluding-depreciation
line (`$206,611` thousand) plus the printed depreciation/impairment line (`$29,784` thousand) and
the printed total income less the printed operating result. The printed "Net loss from the disposal
of assets" is a real printed expense line (`$1,897` thousand) and is emitted; the seven revenue
components still sum exactly to the printed total.

**Rows.** 17 rows, source id `shellharbour-gpfs`, `source_dataset` "Shellharbour City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Shellharbour City Council"` (the exact published entity
name in the audited statements), `data_quality_flag: "provisional/local_government"`,
`verified: false`. The minimum lines are total revenue `$310,293,000`, total expenses
`$236,395,000`, employee expenses `$47,263,000`, depreciation/amortisation/impairment
`$29,784,000`, operating government grants `$8,535,000`, capital government grants `$36,357,000`,
net loss on disposal of assets `$1,897,000` and net result `$73,898,000`; the face-statement revenue
and expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: **1 GrantConnect row** whose
`delivery_entity` is exactly "Shellharbour City Council", plus **65 other rows** whose
`delivery_entity` merely mentions Shellharbour under other strings (34 GrantConnect, 28 ACNC, 2
AusTender and 1 data.nsw row); their per-source counts are identical before and after the ingest.
All sixteen other council GPFS sources are unchanged (Dubbo 18, City of Sydney 18, Blacktown 17,
Parramatta 17, Northern Beaches 18, Canterbury-Bankstown 17, Sutherland Shire 17, Wollongong 17,
Newcastle 17, Lake Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17, Port Macquarie-Hastings
17, Tweed Shire 17, Shoalhaven 17). Government grant rows carry `potential_double_count: true`
because they may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,714 → **515,731** (exactly +17);
`shellharbour-gpfs` **17**; `data-nsw-ckan` still **3,472**; `dubbo-council` still **245**; exact
"Shellharbour City Council" rows 1 → **18** (the new 17 plus the pre-existing GrantConnect row);
`data_sources` 42 → **43**. A second ingest run upserted the same 17 natural keys and left the DB
total unchanged (idempotent). No deletes or updates to any other source.

### 7.18 Eighteenth council — Waverley Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the official "Annual Statement of Accounts" page
<https://www.waverley.nsw.gov.au/council/policies_plans_strategies_and_reports/annual_statement_of_accounts>
(the parent "Policies, plans, strategies and reports" page links it as "Annual Statement of Accounts —
Audited financial statements"). Plain HTTP to `waverley.nsw.gov.au` is rejected with a Cloudflare
"Just a moment..." HTTP 403, which is not proof of absence, so discovery and the PDF download use the
documented headless Chromium/Playwright path (the same path as Wollongong and Lake Macquarie). The
page's FY2024-25 anchor **"Annual Statement of Accounts 2024-2025"** resolves to the council-hosted
audited financial statements
<https://www.waverley.nsw.gov.au/__data/assets/pdf_file/0006/250359/Annual_Financial_Statements_2025.pdf>
(no hard-coded PDF URL; the page also lists a separate "Annual Statement of Accounts 2025-2026" link
that is not selected). Exact bytes archived outside the repo at
`~/ausspend-source-archive/waverley-gpfs/Annual_Financial_Statements_2025.pdf`: **5,312,088 bytes**,
SHA-256 `b62cd275e63ae3ab8c7d72c9c84480f526e8829bcde9bbceed185d9a068216da` (`hash_verified: true`).
The Income Statement is printed p8 of 82 (PDF p9), the Statement of Comprehensive Income p9 (PDF
p10), B1-1 "Total functions and activities" p17 (PDF p18) and note B3-3 depreciation p31 (PDF p32).
The printed unit is explicit `$ '000` (thousands) on the income statement, B1-1, the comprehensive-
income statement and the depreciation note; a missing or conflicting unit rejects the whole
extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label (Actual 2025 and Actual 2024 after it), so each emitted value is the first amount
after the printed label (the FY2024-25 actual). The phrase "depreciation, amortisation and
impairment of non-financial assets" appears in the expense subtotal and in the excluding-
depreciation result before the actual depreciation line, so the connector reads that line from the
last printed occurrence (the capitalised standalone line). The connector emits nothing unless all of
these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ----------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                   |                          `$184,205` thousand | = `$184,205,000`                          |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$184,205` thousand | = printed total                           |
| B1-1 Total functions and activities — income                                                                                 |                          `$184,205` thousand | = face statement                          |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                           |                          `$150,411` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$22,441`)                           | `$150,411` + `$22,441` = `$172,852` thousand | = B1-1 expense total                      |
| B1-1 Total functions and activities — expenses                                                                               |                          `$172,852` thousand | = `$172,852,000` (printed total)          |
| Operating result / net operating result                                                                                      | `$184,205` − `$172,852` = `$11,353` thousand | = printed operating result                |
| Net operating result for the year attributable to Council                                                                    |                           `$11,353` thousand | = operating result                        |
| Net operating result before capital grants                                                                                   |  `$11,353` − `$16,122` = `($4,769)` thousand | = printed before-capital result           |
| B1-1 grants and contributions                                                                                                |                           `$23,620` thousand | = operating `$7,498` + capital `$16,122`  |
| Statement of Comprehensive Income net result                                                                                 |                           `$11,353` thousand | = Income Statement net result             |
| Note B3-3 total depreciation and amortisation costs                                                                          |                           `$22,441` thousand | = face depreciation line                  |

Total expenses is the printed B1-1 "Total functions and activities" expense total
(`$172,852` thousand), **not** a sum of the nature components on its own and **not** the separate
printed expenses-excluding-depreciation line. It equals the printed expenses-excluding-depreciation
line (`$150,411` thousand) plus the printed depreciation/impairment line (`$22,441` thousand) and the
printed total income less the printed operating result. The printed revenue "Net gain from the
disposal of assets" line is a nil dash, so it is not emitted (nil is not a zero amount); the printed
expense "Net loss from the disposal of assets" line is a real printed expense line (`$6,795`
thousand) and is emitted; the seven emitted revenue components still sum exactly to the printed
total.

**Rows.** 17 rows, source id `waverley-gpfs`, `source_dataset` "Waverley Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Waverley Council"` (the exact published entity name in the
audited statements), `data_quality_flag: "provisional/local_government"`, `verified: false`. The
minimum lines are total revenue `$184,205,000`, total expenses `$172,852,000`, employee expenses
`$86,877,000`, depreciation/amortisation/impairment `$22,441,000`, operating government grants
`$7,498,000`, capital government grants `$16,122,000`, net loss on disposal of assets `$6,795,000`
and net result `$11,353,000`; the face-statement revenue and expense components are included for
provenance. The before-capital result (`-$4,769,000`) is retained as reconciliation evidence only,
never as a stored row.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: **6 AusTender/GrantConnect rows** whose
`delivery_entity` is exactly "Waverley Council" case-insensitively (5 exact-case — 1 AusTender
contract and 4 GrantConnect grants — plus 1 uppercase "WAVERLEY COUNCIL" AusTender contract), plus
**145 other rows** whose `delivery_entity` merely mentions Waverley under other strings (77 ACNC, 60
GrantConnect, 11 other AusTender and 1 data.nsw row); their per-source counts are identical before
and after the ingest. All seventeen other council GPFS sources are unchanged (Dubbo 18, City of
Sydney 18, Blacktown 17, Parramatta 17, Northern Beaches 18, Canterbury-Bankstown 17, Sutherland
Shire 17, Wollongong 17, Newcastle 17, Lake Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17,
Port Macquarie-Hastings 17, Tweed Shire 17, Shoalhaven 17, Shellharbour 17). Government grant rows
carry `potential_double_count: true` because they may overlap government program data; they are not
added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,731 → **515,748** (exactly +17);
`waverley-gpfs` **17**; `shellharbour-gpfs` still **17**; `data-nsw-ckan` still **3,472**;
`dubbo-council` still **245**; exact "Waverley Council" rows 5 → **22** (the new 17 plus the 5
pre-existing exact-case rows) and case-insensitive exact rows 6 → **23**; `data_sources` 43 → **44**.
A second ingest run upserted the same 17 natural keys and left the DB total unchanged (idempotent).
No deletes or updates to any other source.

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
   Northern Beaches Council FY2024-25 GPFS, 18 non-additive rows (§7.5). **Fifth expansion landed
   2026-11-17:** Canterbury-Bankstown Council FY2024-25 GPFS, 17 non-additive rows (§7.6). **Sixth
   expansion landed 2026-11-17:** Sutherland Shire Council FY2024-25 GPFS, 17 non-additive rows
   (§7.7). **Seventh expansion landed 2026-11-18:** Wollongong City Council FY2024-25 GPFS, 17
   non-additive rows (§7.8). **Eighth expansion landed 2026-11-18:** Newcastle City Council
   FY2024-25 GPFS, 17 non-additive rows (§7.9). **Ninth expansion landed 2026-11-18:** Lake
   Macquarie City Council FY2024-25 GPFS, 17 non-additive rows (§7.10). **Tenth expansion landed
   2026-11-18:** Maitland City Council FY2024-25 GPFS, 7 non-additive rows (§7.11). **Eleventh
   expansion landed 2026-11-18:** Coffs Harbour City Council FY2024-25 GPFS, 17 non-additive rows
   (§7.12). **Twelfth expansion landed 2026-11-18:** MidCoast Council FY2024-25 GPFS, 17
   non-additive rows (§7.13). **Thirteenth expansion landed 2026-11-18:** Port Macquarie-Hastings
   Council FY2024-25 GPFS, 17 non-additive rows (§7.14). **Fourteenth expansion landed
   2026-11-18:** Tweed Shire Council FY2024-25 GPFS, 17 non-additive rows (§7.15). **Fifteenth
   expansion landed 2026-11-18:** Shoalhaven City Council FY2024-25 GPFS, 17 non-additive rows
   (§7.16). **Sixteenth expansion landed 2026-11-18:** Shellharbour City Council FY2024-25 GPFS,
   17 non-additive rows (§7.17). **Seventeenth expansion landed 2026-11-18:** Waverley Council
   FY2024-25 GPFS, 17 non-additive rows (§7.18).
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
- Canterbury-Bankstown Council FY2024-25 annual financial statements page —
  <https://haveyoursay.cbcity.nsw.gov.au/annual-financial-statements-2024-25>
- Canterbury-Bankstown Council FY2024-25 GPFS PDF — URL above (3,526,499 bytes; SHA-256
  `d195790e10452808497fdc0eb95589e751ae6a64a50fc8d076ce467ac0ce8650`)
- Sutherland Shire Council annual and financial reports page —
  <https://www.sutherlandshire.nsw.gov.au/your-council/our-vision-for-the-future/annual-and-financial-reports>
- Sutherland Shire Council FY2024-25 GPFS PDF — URL above (5,464,555 bytes; SHA-256
  `a97e7719e485a0fb6f49468c0eb7672a5b120c0aa6077ccfdb0349d56dd2b743`)
- Coffs Harbour City Council Annual Report page —
  <https://www.coffsharbour.nsw.gov.au/Your-Council/Our-responsibilities/Corporate-planning-and-reporting/Annual-Report>
- Coffs Harbour City Council FY2024-25 GPFS PDF — URL above (4,006,409 bytes; SHA-256
  `026fd09fed7099b1276beb2775c62193d00e60ed13c7f71c72a202c7f25ebf5e`)
- Shoalhaven City Council financial statements page —
  <https://www.shoalhaven.nsw.gov.au/Council/Reports/Financial-statements>
- Shoalhaven City Council Financial Statements - Previous Years page —
  <https://www.shoalhaven.nsw.gov.au/Council/Publicly-available-information/Finance/Financial-Statements-Previous-Years>
- Shoalhaven City Council FY2024-25 GPFS PDF — official record endpoint above (5,881,682 bytes; SHA-256
  `74076e6f5b966575deb498e3805c9f5ff66aaa71ace5b001972f7d33313add20`)
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

**GPFS sixth-council checks (2026-11-17):**

- Canterbury-Bankstown Council official FY2024-25 annual financial statements page fetched (HTTP
  200); the "Financial Statements 2024-25 and Auditor's Reports PDF" link (`href="/download_file/7155/2442"`,
  distinct from the separate Annual Report link) resolves to the statements PDF; no document URL is
  hard-coded.
- GPFS PDF fetched (HTTP 200, 3,526,499 bytes) and SHA-256 archived outside the repo; SHA-256
  `d195790e10452808497fdc0eb95589e751ae6a64a50fc8d076ce467ac0ce8650`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement and B1-1;
  the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$483,988,000`, expenses `$430,371,000` (documented bridge of printed expenses excluding
  depreciation `$328,567,000` plus depreciation `$101,804,000`), net result `$53,617,000`; B1-1
  income `$483,988,000`, expenses `$430,371,000`, operating result `$53,617,000` and grants
  `$91,426,000`; before-capital result `$(15,221,000)` (reconciliation evidence only).
- `canterbury-bankstown-gpfs` rows: 17, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: measures 515,537 → 515,554 (+17 only); `northern-beaches-gpfs` still 18; `parramatta-gpfs`
  still 17; `blacktown-gpfs` still 17; `city-of-sydney-gpfs` still 18; `dubbo-council` still 245;
  the 6 pre-existing Canterbury-Bankstown-delivery-entity rows unchanged; a second run upserted the
  same 17 natural keys with no count change.

**GPFS seventh-council checks (2026-11-17):**

- Sutherland Shire Council official annual and financial reports page fetched via a real browser
  (the site enforces a Cloudflare managed challenge); the stand-alone "Financial Statements
  2024-2025" PDF was selected and the Annual Report "Appendix D - Financial Statements" appendix was
  ignored; no document URL is hard-coded.
- GPFS PDF fetched (HTTP 200, 5,464,555 bytes) and SHA-256 archived outside the repo; SHA-256
  `a97e7719e485a0fb6f49468c0eb7672a5b120c0aa6077ccfdb0349d56dd2b743`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement and B1-1;
  the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$325,542,000`, expenses `$311,478,000` (documented bridge of printed expenses excluding
  depreciation `$258,272,000` plus depreciation `$53,206,000`), net result `$14,064,000`; B1-1
  income `$325,542,000`, expenses `$311,478,000`, operating result `$14,064,000` and grants
  `$35,703,000`; before-capital result `$(2,203,000)` (reconciliation evidence only).
- `sutherland-shire-gpfs` rows: 17, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: measures 515,554 → 515,571 (+17 only); `canterbury-bankstown-gpfs` still 17;
  `northern-beaches-gpfs` still 18; `parramatta-gpfs` still 17; `blacktown-gpfs` still 17;
  `city-of-sydney-gpfs` still 18; `dubbo-council` still 245; the 4 pre-existing
  Sutherland-delivery-entity rows unchanged; a second run upserted the same 17 natural keys with no
  count change.

**GPFS eighth-council checks (2026-11-18):**

- Wollongong City Council official financial report page fetched via a real headless Chromium
  browser because plain HTTP returns HTTP 403 (Cloudflare managed challenge); the FY2024-25 "Financial
  Report for the Year Ended 30 June 2025" PDF was parsed from the cleared page HTML; no document URL
  is hard-coded.
- GPFS PDF downloaded by the browser (7,343,281 bytes) and SHA-256 archived outside the repo; SHA-256
  `ae26b12b906a09ce17d1c353e4f36d8aec29b0de5e4b539cffe5a953aedc6ad3`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement and B1-1;
  the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$390,643,000`, expenses `$400,881,000` (documented bridge of printed expenses excluding
  depreciation `$302,785,000` plus depreciation `$98,096,000`), net result `$(10,238,000)`; B1-1
  income `$390,643,000`, expenses `$400,881,000`, operating result `$(10,238,000)` and grants
  `$77,119,000`; before-capital result `$(55,711,000)` (reconciliation evidence only). The negative
  net result is stored as a non-negative magnitude with `gpfs_printed_sign: "negative"`.
- `wollongong-gpfs` rows: 17, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: measures 515,571 → 515,588 (+17 only); `sutherland-shire-gpfs` still 17;
  `canterbury-bankstown-gpfs` still 17; `northern-beaches-gpfs` still 18; `parramatta-gpfs` still
  17; `blacktown-gpfs` still 17; `city-of-sydney-gpfs` still 18; `dubbo-council` still 245; the 7 rows that exactly name the council
  unchanged; a second run upserted the same 17
  natural keys with no count change.

**GPFS ninth-council checks (2026-11-18):**

- Newcastle City Council official General Purpose Financial Statements page fetched over plain HTTP,
  HTTP 200 (no Cloudflare challenge); the FY2024-25 "2024/2025 Financial Statements (PDF, 3.4 MB)"
  link was parsed from the page HTML; no document URL is hard-coded.
- GPFS PDF downloaded directly (3,484,233 bytes) and SHA-256 archived outside the repo; SHA-256
  `ed415f31b8b57358ce2f3be2dbbd8193edab74fc3be4b6df3cf3e3d4b80a24cc`, archive metadata
  `hash_verified: true`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement and B1-1;
  the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$497,702,000`, expenses `$399,363,000` (documented bridge of printed expenses excluding
  depreciation `$327,421,000` plus depreciation `$71,942,000`), net result `$98,339,000`; B1-1
  income `$497,702,000`, expenses `$399,363,000`, operating result `$98,339,000` and grants
  `$110,825,000`; before-capital result `$8,736,000` (reconciliation evidence only).
- `newcastle-gpfs` rows: 17, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: measures 515,588 → 515,605 (+17 only); `wollongong-gpfs` still 17;
  `sutherland-shire-gpfs` still 17; `canterbury-bankstown-gpfs` still 17; `northern-beaches-gpfs`
  still 18; `parramatta-gpfs` still 17; `blacktown-gpfs` still 17; `city-of-sydney-gpfs` still 18;
  `dubbo-council` still 245; the 4 rows that exactly name the council and the 1 "City of Newcastle"
  row unchanged; a second run upserted the same 17 natural keys with no count change.

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
