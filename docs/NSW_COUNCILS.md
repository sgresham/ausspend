# NSW local councils — source inventory, double-count review and pilot plan

<!-- BEGIN GENERATED NSW COUNCIL COUNTS (npm run generate:sources) -->

## Current source counts vs historical landing snapshots

The §7 landing records below are **chronological snapshots** taken at each ingest. They are kept
as evidence and are not current totals. The current registry counts are:

| Current-state count                 | Value |
| ----------------------------------- | ----- |
| NSW council GPFS sources            | 82    |
| NSW local-government source ids     | 83    |
| Registered spending connectors      | 144   |
| Active spending connectors          | 142   |
| Stub spending connectors            | 2     |
| Trade connectors (separate subtree) | 2     |

Live database totals (registered `data_sources`, spending measures and trade records) come from
`GET /api/coverage`, not from this file, so they cannot drift here and are not checked in CI.
<!-- END GENERATED NSW COUNCIL COUNTS -->

**Status:** the inventory and plan below are unchanged. Forty-five council GPFS sources have landed
as separate non-additive sources. The Dubbo FY2024-25 pilot (§7.1) added exactly **18**
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
(**§7.18**) then added exactly **17** `waverley-gpfs` rows (**515,731** → **515,748**). Willoughby
City Council FY2024-25 GPFS (**§7.19**) then added exactly **18** `willoughby-gpfs` rows
(**515,748** → **515,766**). Inner West Council FY2024-25 GPFS (**§7.20**) then added exactly **18**
`inner-west-gpfs` rows (**515,766** → **515,784**). Bayside Council FY2024-25 GPFS (**§7.21**) then
added exactly **18** `bayside-gpfs` rows (**515,784** → **515,802**). Randwick City Council FY2024-25
GPFS (**§7.22**) then added exactly **17** `randwick-gpfs` rows (**515,802** → **515,819**).
The Council of the City of Ryde FY2024-25 GPFS (**§7.23**) then added exactly **17** `ryde-gpfs`
rows (**515,819** → **515,836**). North Sydney Council FY2024-25 GPFS (**§7.24**) then added exactly
**18** `north-sydney-gpfs` rows (**515,836** → **515,854**). The City of Canada Bay Council
FY2024-25 GPFS (**§7.25**) then added exactly **17** `canada-bay-gpfs` rows (**515,854** →
**515,871**). Cumberland City Council FY2024-25 GPFS (**§7.26**) then added exactly **17**
`cumberland-gpfs` rows (**515,871** → **515,888**). Georges River Council FY2024-25 GPFS
(**§7.27**) then added exactly **16** `georges-river-gpfs` rows (**515,888** → **515,904**).
Fairfield City Council FY2024-25 GPFS (**§7.28**) then added exactly **17** `fairfield-gpfs` rows
(**515,904** → **515,921**). Liverpool City Council FY2024-25 GPFS (**§7.29**) then added exactly
**17** `liverpool-gpfs` rows (**515,921** → **515,938**). Ku-ring-gai Council FY2024-25 GPFS
(**§7.30**) then added exactly **17** `ku-ring-gai-gpfs` rows (**515,938** → **515,955**). On the
shared dev DB, Lane Cove Council FY2024-25 GPFS (**§7.32**) then added exactly **17**
`lane-cove-gpfs` rows (**693,096** → **693,113**). On the shared dev DB, Mosman Council FY2024-25
GPFS (**§7.33**) then added exactly **18** `mosman-gpfs` rows (**693,113** → **693,131**); the
concurrent Lane Cove rows later took the live total to **693,148**. On the shared dev DB (after
concurrent rows reached **693,177**), Hawkesbury City Council FY2024-25 GPFS (**§7.34**) then added
exactly **19** `hawkesbury-gpfs` rows (**693,177** → **693,196**). Woollahra Municipal Council FY2024-25 GPFS (**§7.35**) was ingested against the earlier shared-dev snapshot: it added exactly **29** `woollahra-gpfs` rows (**693,148** → **693,177**), and the concurrent Hawkesbury landing later took the live total to **693,196**.
Blue Mountains City Council FY2024-25 GPFS (**§7.36**) also landed as a connector; its 23 rows are in the shared DB, and the live total **693,237** also includes the concurrent Wollondilly Shire Council FY2024-25 GPFS ingest (**§7.37**, 18 `wollondilly-gpfs` rows). At Camden claim time the shared dev DB held **693,259** measures; Camden Council FY2024-25 GPFS (**§7.38**) then added exactly **23** `camden-gpfs` rows (**693,259** → **693,282**), with every other per-source count unchanged; a second ingest was a no-op. The next claim-time snapshot for Central Coast Council FY2024-25 GPFS (**§7.40**) was **693,282** (already including Campbelltown City Council FY2024-25 GPFS, §7.39, 22 `campbelltown-gpfs` rows); Central Coast then added exactly **17** `central-coast-gpfs` rows (**693,282** → **693,299**), with every other per-source count unchanged and a no-op second ingest. The claim-time snapshot for Penrith City Council FY2024-25 GPFS (**§7.42**) was **693,299** with **746** GPFS rows across **41** sources; a concurrent unrelated council added 39 rows before the pre-ingest snapshot (**693,338**), after which Penrith added exactly **17** `penrith-gpfs` rows (**693,338** → **693,355**, GPFS **802** across **43** sources), with every other per-source count unchanged and a no-op second ingest. The claim-time snapshot for The Hills Shire Council FY2024-25 GPFS (**§7.43**) was **693,427** measures with **874** GPFS rows across **43** sources; The Hills then added exactly **17** `the-hills-gpfs` rows (**693,427** → **693,444**, GPFS **891** across **44** sources), with every other per-source count unchanged and a no-op second ingest; a concurrent `dubbo-council-gpfs` historical addition (107 → 125 rows) later took the live total to **693,462**. Dubbo's own FY2018-19 historical variant (**§7.1.7**) then added exactly **17** `dubbo-council-gpfs` rows (**125 → 142**), taking the live total to **693,479** with every other per-source count unchanged; a second ingest was a no-op.
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
Waverley, the 7 GrantConnect rows whose `delivery_entity` is exactly "Willoughby City Council" and the
67 other AusTender/GrantConnect/ACNC/data.nsw rows whose `delivery_entity` merely mentions
Willoughby, the 4 GrantConnect rows whose `delivery_entity` is exactly "Inner West Council" (plus the
1 uppercase grant and 2 uppercase AusTender contracts that case-insensitively match) and the 36
other AusTender/GrantConnect/ACNC rows whose `delivery_entity` merely mentions Inner West, the 4
AusTender/GrantConnect rows whose `delivery_entity` is exactly "Bayside Council" (3 exact-case
GrantConnect grants and 1 exact-case AusTender contract) and the 377 other
AusTender/GrantConnect/ACNC/QGIP/data.nsw rows whose `delivery_entity` merely mentions Bayside, the 3
GrantConnect rows whose `delivery_entity` is exactly "Randwick City Council" and the 2 uppercase
AusTender contracts whose string is "RANDWICK CITY COUNCIL" (5 case-insensitive exact rows) plus the
95 other AusTender/GrantConnect/ACNC/data.nsw rows whose `delivery_entity` merely mentions Randwick,
the 1 pre-existing uppercase AusTender contract whose string is exactly "COUNCIL OF THE CITY OF RYDE"
(the only case-insensitive exact row before this ingest) and the 204 other
AusTender/GrantConnect/ACNC/data.nsw/QGIP rows whose `delivery_entity` merely mentions Ryde,
the 2 pre-existing uppercase rows whose string is exactly "NORTH SYDNEY COUNCIL" (the only
case-insensitive exact rows before this ingest) and the 86 other
AusTender/GrantConnect/ACNC/data.nsw/QGIP rows whose `delivery_entity` merely mentions North Sydney,
the 6 pre-existing AusTender/GrantConnect rows whose string is case-insensitively exactly "CITY OF
CANADA BAY COUNCIL" / "City of Canada Bay Council" (2 uppercase AusTender contracts, 1 uppercase
GrantConnect grant and 3 exact-case GrantConnect grants) and the 6 other
AusTender/GrantConnect/ACNC rows whose `delivery_entity` merely mentions Canada Bay, the 6
pre-existing GrantConnect rows whose `delivery_entity` is case-insensitively exactly "Cumberland
Council" (1 uppercase and 5 exact-case grants) and the 33 other
AusTender/GrantConnect/ACNC/data.nsw rows whose `delivery_entity` merely mentions Cumberland,
the 1 pre-existing uppercase AusTender contract whose string is exactly "GEORGES RIVER COUNCIL"
(the only case-insensitive exact row before this ingest) and the 21 other
AusTender/GrantConnect/ACNC/data.nsw rows whose `delivery_entity` merely mentions Georges River,
the 1 pre-existing GrantConnect row whose `delivery_entity` is exactly "Ku-ring-gai Council" plus the
1 uppercase "KU-RING-GAI COUNCIL" GrantConnect grant (the 2 case-insensitive exact rows before this
ingest) and the 58 other GrantConnect/ACNC/data.nsw/AusTender rows whose `delivery_entity` merely
mentions Ku-ring-gai (29 GrantConnect, 27 ACNC, 1 data.nsw, 1 AusTender),
and every other source are preserved untouched and are never summed with the GPFS rows.

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

| Source                                        | All 128 councils?               | Statement-line GPFS? | Service/program split?                              | Capital $?                 | Grants $?                                 | Open licence?                 |                                                                             In DB now |
| --------------------------------------------- | ------------------------------- | -------------------- | --------------------------------------------------- | -------------------------- | ----------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------: |
| OLG _Your Council_ time-series (2024-25 XLSX) | **Yes** (128 + 8 county)        | **No**               | 9 service-expenditure categories                    | **No** (asset ratios only) | **No** (grants % of revenue only)         | **No** (all rights reserved)  |                                                                                     0 |
| Individual council GPFS / annual reports      | Yes, one PDF per council        | **Yes**              | Yes (function and nature, notes, special schedules) | Yes                        | Yes (grant revenue and special schedules) | Per council; usually not open | **1564** (82 council GPFS sources, FY2024-25/FY2025-26; separate non-additive sources) |
| LGGC Financial Assistance Grants              | Yes (general purpose councils)  | No                   | No (grant allocation)                               | No                         | **Yes** (FAG entitlement)                 | No (OLG all rights reserved)  |                                                                                     0 |
| data.nsw.gov.au CKAN                          | No                              | No                   | No                                                  | No                         | No                                        | Per dataset (usually CC BY)   |                                                    3,472 rows, none council financial |
| Audit Office of NSW local government reports  | No (selected audits)            | No                   | Narrative/aggregate                                 | Occasionally               | Occasionally                              | Audit Office terms            |                                                                                     0 |
| ABS GFS (benchmark)                           | No (local government aggregate) | No                   | COFOG aggregate                                     | No                         | No                                        | CC BY                         |                                                                   169 rows, aggregate |
| NSW Budget LGA-tagged projects                | No (state projects)             | No                   | Project-level state capital                         | Yes (state)                | No                                        | CC BY 3.0 AU                  |                                                               1,115 rows, not council |

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
comparatives inside each report). **In DB: 1564 GPFS rows** — 18 for Dubbo FY2024-25
(`dubbo-council-gpfs`, §7.1), 18 for the City of Sydney FY2024-25 (`city-of-sydney-gpfs`, §7.2), 17
for Blacktown City Council FY2024-25 (`blacktown-gpfs`, §7.3), 17 for City of Parramatta FY2024-25
(`parramatta-gpfs`, §7.4), 18 for Northern Beaches Council FY2024-25 (`northern-beaches-gpfs`,
§7.5), 17 for Canterbury-Bankstown Council FY2024-25 (`canterbury-bankstown-gpfs`, §7.6), 17 for
Sutherland Shire Council FY2024-25 (`sutherland-shire-gpfs`, §7.7), 17 for Wollongong City Council
FY2024-25 (`wollongong-gpfs`, §7.8), 17 for Newcastle City Council FY2024-25 (`newcastle-gpfs`,
§7.9), 17 for Lake Macquarie City Council FY2024-25 (`lake-macquarie-gpfs`, §7.10), 7 for Maitland
City Council FY2024-25 (`maitland-gpfs`, §7.11), 17 for Coffs Harbour City Council FY2024-25
(`coffs-harbour-gpfs`, §7.12), 17 for MidCoast Council FY2024-25 (`mid-coast-gpfs`, §7.13), 17
for Port Macquarie-Hastings Council FY2024-25 (`port-macquarie-hastings-gpfs`, §7.14), 17 for
Tweed Shire Council FY2024-25 (`tweed-shire-gpfs`, §7.15), 17 for Shoalhaven City Council FY2024-25
(`shoalhaven-gpfs`, §7.16), 17 for Shellharbour City Council FY2024-25 (`shellharbour-gpfs`, §7.17),
17 for Waverley Council FY2024-25 (`waverley-gpfs`, §7.18), 18 for Willoughby City Council
FY2024-25 (`willoughby-gpfs`, §7.19), 18 for Inner West Council FY2024-25 (`inner-west-gpfs`,
§7.20) and 18 for Bayside Council FY2024-25 (`bayside-gpfs`, §7.21), and 17 for Randwick City
Council FY2024-25 (`randwick-gpfs`, §7.22) and 17 for the Council of the City of Ryde FY2024-25
(`ryde-gpfs`, §7.23) and 18 for North Sydney Council FY2024-25 (`north-sydney-gpfs`, §7.24) and 17
for the City of Canada Bay Council FY2024-25 (`canada-bay-gpfs`, §7.25) and 17 for Cumberland City
Council FY2024-25 (`cumberland-gpfs`, §7.26) and 16 for Georges River Council FY2024-25
(`georges-river-gpfs`, §7.27) and 17 for Fairfield City Council FY2024-25 (`fairfield-gpfs`,
§7.28) and 17 for Liverpool City Council FY2024-25 (`liverpool-gpfs`, §7.29) and 17 for Ku-ring-gai
Council FY2024-25 (`ku-ring-gai-gpfs`, §7.30) and 17 for Strathfield Council FY2024-25
(`strathfield-gpfs`, §7.31) and 17 for Lane Cove Council FY2024-25 (`lane-cove-gpfs`, §7.32) and 18
for Mosman Council FY2024-25 (`mosman-gpfs`, §7.33), 19 for Hawkesbury City Council FY2024-25
(`hawkesbury-gpfs`, §7.34), 29 for Woollahra Municipal Council FY2024-25 (`woollahra-gpfs`, §7.35),
23 for Blue Mountains City Council FY2024-25 (`blue-mountains-gpfs`, §7.36) and 18 for Wollondilly
Shire Council FY2024-25 (`wollondilly-gpfs`, §7.37), 23 for Camden Council FY2024-25
(`camden-gpfs`, §7.38), 22 for Campbelltown City Council FY2024-25 (`campbelltown-gpfs`, §7.39) and
17 for Central Coast Council FY2024-25 (`central-coast-gpfs`, §7.40) and 17 for The Hills Shire Council FY2024-25 (`the-hills-gpfs`, §7.43) and 17 for Warren Shire Council FY2025-26 (`warren-gpfs`, §7.44) and 16 for Brewarrina Shire Council FY2025-26 (`brewarrina-gpfs`, §7.45) and 17 for Bogan Shire Council FY2025-26 (`bogan-gpfs`, §7.46) and 16 for Kyogle Council FY2025-26 (`kyogle-gpfs`, §7.47) and 17 for Junee Shire Council FY2025-26 (`junee-gpfs`, §7.48) and 16 for Uralla Shire Council FY2025-26 (`uralla-gpfs`, §7.49) and 17 for Cootamundra-Gundagai Regional Council FY2024-25 (`cootamundra-gundagai-gpfs`, §7.50) and 16 for Moree Plains Shire Council FY2024-25 (`moree-plains-gpfs`, §7.51) and 17 for Hilltops Council FY2024-25 (`hilltops-gpfs`, §7.52) and 17 for Bourke Shire Council FY2025-26 (`bourke-gpfs`, §7.53) and 17 for Coolamon Shire Council FY2025-26 (`coolamon-gpfs`, §7.54) and 16 for Gilgandra Shire Council FY2025-26 (`gilgandra-gpfs`, §7.55) and 17 for Lockhart Shire Council FY2025-26 (`lockhart-gpfs`, §7.56) and 17 for Coonamble Shire Council FY2024-25 (`coonamble-gpfs`, §7.57) and 17 for Weddin Shire Council FY2024-25 (`weddin-gpfs`, §7.58) and 17 for Walcha Council FY2024-25 (`walcha-gpfs`, §7.59) and 17 for Murrumbidgee Council FY2024-25 (`murrumbidgee-gpfs`, §7.60) and 17 for Armidale Regional Council FY2025-26 (`armidale-gpfs`, §7.62) and 17 for Byron Shire Council FY2025-26 (`byron-gpfs`, §7.63) and 17 for Clarence Valley Council FY2025-26 (`clarence-valley-gpfs`, §7.64) and 17 for Richmond Valley Council FY2025-26 (`richmond-valley-gpfs`, §7.65) and 16 for Kempsey Shire Council FY2025-26 (`kempsey-gpfs`, §7.66) and 17 for Wingecarribee Shire Council FY2025-26 (`wingecarribee-gpfs`, §7.67) and 17 for Queanbeyan-Palerang Regional Council FY2025-26 (`queanbeyan-palerang-gpfs`, §7.68) and 17 for Goulburn Mulwaree Council FY2024-25 (`goulburn-mulwaree-gpfs`, §7.69) and 17 for Broken Hill City Council FY2024-25 (`broken-hill-gpfs`, §7.70) and 17 for Griffith City Council FY2024-25 (`griffith-gpfs`, §7.71) and 17 for Lithgow City Council FY2024-25 (`lithgow-gpfs`, §7.72) and 17 for Mid-Western Regional Council FY2025-26 (`mid-western-regional-gpfs`, §7.73) and 16 for Bega Valley Shire Council FY2025-26 (`bega-valley-gpfs`, §7.74) and 17 for Snowy Monaro Regional Council FY2025-26 (`snowy-monaro-gpfs`, §7.75) and 17 for Singleton Council FY2025-26 (`singleton-gpfs`, §7.76) and 17 for Orange City Council FY2025-26 (`orange-gpfs`, §7.77) and 17 for Blayney Shire Council FY2025-26 (`blayney-gpfs`, §7.78) and 17 for Liverpool Plains Shire Council FY2025-26 (`liverpool-plains-gpfs`, §7.79) and 17 for Tenterfield Shire Council FY2025-26 (`tenterfield-gpfs`, §7.80) and 16 for Cobar Shire Council FY2025-26 (`cobar-gpfs`, §7.81) and 17 for Narromine Shire Council FY2025-26 (`narromine-gpfs`, §7.82) — all separate source ids. The
existing `dubbo-council` 245 rows
are 2026/27 budget/forward-estimate lines, not GPFS actuals, and are not touched or summed with the
GPFS rows. The shared dev DB currently records **82** active `data_sources` GPFS entries and **1564**
GPFS measures, from a fresh aggregate of `source_id` matching `/gpfs$/` (2026-11-19, after the
§7.82 Narromine landing); this is the live
DB count, not an increment of the earlier table total.

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

#### 7.1.1 FY2023-24 multi-year variant (landed 2026-11-18)

**Scope.** Add Dubbo Regional Council's audited **FY2023-24** GPFS as actual rows under the existing
source id `dubbo-council-gpfs`, without changing the FY2024-25 rows. No other council, no FY2025-26
and no FY2015-16..FY2022-23 historical year is ingested here.

**Source.** The reviewed D2 packet
(`docs/source-discovery/dubbo-regional.md` §4 and §10) records the document
<https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/2023-2024%20Dubbo%20Regional%20Council%20Financial%20Statements.pdf.aspx>
and SHA-256 `3c2ee369960e0a78fece6716638bfa4628487445105948de65c3cc8deb0d66fe`. The connector
re-discovers it from the reporting page (no hard-coded PDF URL) and archives the exact bytes outside
the repo at
`~/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2023-24.pdf`: **2,677,519
bytes**, SHA-256 matching the packet exactly. The D2 archive copy at
`~/ausspend-source-archive/dubbo-regional/2023-24/gpfs-2023-24.pdf` has the same hash. The printed
unit is explicit `$'000` on the income statement (PDF p.5) and B1-1 (PDF p.15).

**Layout variant.** Unlike FY2024-25, the FY2023-24 face statement prints one
`Total expenses from continuing operations` line (181,317) and no "excluding depreciation" subtotal,
so the expense components (including depreciation and the disposal loss) sum directly to the printed
total. The connector selects a per-year layout from `fiscal_year`; FY2024-25 keeps its B1-1 total and
OLG anchor. No OLG anchor exists for FY2023-24, so none is invented.

| Check                                                                                                                |                                                                Printed / derived | Result                   |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------: | ------------------------ |
| Revenue components sum (rates + user charges + other revenue + operating + capital grants + interest + other income) | `74,641 + 54,418 + 3,505 + 32,079 + 33,122 + 12,971 + 160` = `$210,896` thousand | = printed total income   |
| Expense components sum (employee + materials + borrowing + other + disposal loss + depreciation)                     |         `49,340 + 63,102 + 3,037 + 2,824 + 4,489 + 58,525` = `$181,317` thousand | = printed total expenses |
| Total revenue − total expenses                                                                                       |                                                              `210,896 − 181,317` | = `$29,579` net result   |
| B1-1 Total functions and activities                                                                                  |       income `$210,896`; expenses `$181,317`; result `$29,579`; grants `$65,201` | = face statement         |
| External anchor                                                                                                      |                                                       none defined for FY2023-24 | not invented             |

The printed `(3,543)` net result before capital grants is stored as a non-negative magnitude with
`gpfs_printed_sign: "negative"`, matching the model convention (money is never negative).

**Rows.** **17** rows for FY2023-24: 7 revenue components + total revenue, 5 expense components +
depreciation + total expenses, and net result + net result before capital grants. Each row has
`fiscal_year: "2023-24"`, `source_dataset: "Dubbo Regional Council GPFS 2023-24"`,
`measure_type: "actual"`, `aggregation_role: "agency_detail"`, no `region_id`/`location`, and a
year-scoped natural key. The 18 FY2024-25 rows are unchanged, so the source holds **35** distinct
year-scoped rows; no row and no API total spans the two years.

**Database evidence (2026-11-18).** `measures` 693,299 → **693,316** (exactly **+17**);
`dubbo-council-gpfs` 18 → **35** with FY2024-25 still **18** and FY2023-24 **17**; `data_sources`
still **76** (`records_ingested` for this source 18 → 35); `dubbo-council` still **245**. The only
source whose measure count changed is `dubbo-council-gpfs`; every other source is unchanged. A
second ingest run fetched/upserted the same 35 natural keys and left the DB total at **693,316**
(idempotent).

#### 7.1.2 FY2025-26 multi-year variant (landed 2026-11-18)

**Scope.** Add Dubbo Regional Council's audited **FY2025-26** GPFS as actual rows under the existing
source id `dubbo-council-gpfs`, preserving FY2023-24 (17 rows) and FY2024-25 (18 rows). No historical
year and no other council is ingested here.

**Source.** The reviewed discovery packet (`docs/source-discovery/dubbo-regional.md` §4 and §10)
records the document
<https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/2025-2026%20Annual%20Financial%20Statements%20-%20Dubbo%20Regional%20Council.pdf.aspx>
and SHA-256 `b6f52c9377952c6d72d011cda4c1cc0fda16c3aff32d501a05a263e3fd7d4fb5`. The connector
re-discovers it from the reporting page (no hard-coded PDF URL) and archives the exact bytes outside
the repo at
`~/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2025-26.pdf`: **2,940,971
bytes**, SHA-256 matching the packet exactly. The D2 archive copy at
`~/ausspend-source-archive/dubbo-regional/2025-26/gpfs-2025-26.pdf` has the same hash. The printed
unit is explicit `$'000` on the income statement (PDF p.5) and B1-1 (PDF p.14).

**Layout variant.** FY2025-26 keeps the FY2024-25 face shape (printed "excluding depreciation"
subtotal plus B1-1 total expenses) but adds a `Net gain from the disposal of assets` revenue line
(864) and prints the disposal-loss expense line at nil (`–`). The nil-aware reader stores that printed
dash as a printed zero and never reads the comparative 5,035. No OLG anchor exists for FY2025-26, so
none is invented.

| Check                                                                                                                                |                                                                      Printed / derived | Result                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------: | ----------------------------------------- |
| Revenue components sum (rates + user charges + other revenue + operating + capital grants + interest + other income + disposal gain) | `84,034 + 63,474 + 4,312 + 30,491 + 28,315 + 14,696 + 172 + 864` = `$226,358` thousand | = printed total income                    |
| Expense components excluding depreciation (employee + materials + borrowing + other + nil disposal loss)                             |                            `57,396 + 56,028 + 2,458 + 2,872 + 0` = `$118,754` thousand | = printed excluding-depreciation subtotal |
| Total expenses excluding depreciation + depreciation                                                                                 |                                                                     `118,754 + 61,576` | = `$180,330` = B1-1 total                 |
| Total revenue − total expenses                                                                                                       |                                                                    `226,358 − 180,330` | = `$46,028` net result                    |
| B1-1 Total functions and activities                                                                                                  |             income `$226,358`; expenses `$180,330`; result `$46,028`; grants `$58,806` | = face statement                          |
| External anchor                                                                                                                      |                                                             none defined for FY2025-26 | not invented                              |

The printed `17,713` net result before capital grants equals `46,028 − 28,315` capital grants and is
reconciled explicitly.

**Rows.** **19** rows for FY2025-26: 8 revenue components (including the 864 disposal gain) + total
revenue, 5 expense components (including the printed-nil disposal loss) + total expenses excluding
depreciation + depreciation + total expenses, and net result + net result before capital grants. Each
row has `fiscal_year: "2025-26"`, `source_dataset: "Dubbo Regional Council GPFS 2025-26"`,
`measure_type: "actual"`, `aggregation_role: "agency_detail"`, no `region_id`/`location`, and a
year-scoped natural key. FY2024-25 (18) and FY2023-24 (17) are unchanged, so the source holds **54**
distinct year-scoped rows; no row and no API total spans years.

**Database evidence (2026-11-18).** `measures` 693,355 → **693,374** (exactly **+19**);
`dubbo-council-gpfs` 35 → **54** with FY2025-26 **19**, FY2024-25 **18**, FY2023-24 **17**;
`data_sources` still **83** (`records_ingested` for this source 35 → 54); `dubbo-council` still
**245**. The only source whose measure count changed is `dubbo-council-gpfs`; every other source is
unchanged. A second ingest run fetched/upserted the same 54 natural keys and left the DB total at
**693,374** (idempotent).

#### 7.1.3 FY2022-23 historical variant (landed 2026-11-18)

**Scope.** Add Dubbo Regional Council's audited **FY2022-23** GPFS as actual rows under the existing
source id `dubbo-council-gpfs`, preserving FY2023-24 (17), FY2024-25 (18) and FY2025-26 (19). No older
historical year and no other council is ingested here.

**Source.** The reviewed D2 packet (`docs/source-discovery/dubbo-regional.md` §10) records the
document
<https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Annual%20Financial%20Statements-%20%202022-2023%20(1).pdf.aspx>
and SHA-256 `b663ddc3a8a5fca8f1887de978a1df7d1cecd24550815fdc7c1c64209074212a`. The connector
re-discovers it from the reporting page (no hard-coded PDF URL) and archives the exact bytes outside
the repo at
`~/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2022-23.pdf`: **3,665,534
bytes**, SHA-256 matching the packet exactly. The D2 archive copy at
`~/ausspend-source-archive/dubbo-regional/2022-23/gpfs-2022-23.pdf` has the same hash. The printed
unit is explicit `$'000` on the income statement (PDF p.5) and B1-1 (PDF p.15).

**Layout variant.** FY2022-23 uses inline face rows (the FY2018-19..FY2022-23 style) with one printed
`Total expenses from continuing operations` line (162,924) and no "excluding depreciation" subtotal,
so the expense components (including depreciation and the 3,276 disposal loss) sum directly to the
printed total. It has no disposal-gain revenue line. No OLG anchor exists for FY2022-23, so none is
invented.

| Check                                                                                                                |                                                              Printed / derived | Result                   |
| -------------------------------------------------------------------------------------------------------------------- | -----------------------------------------------------------------------------: | ------------------------ |
| Revenue components sum (rates + user charges + other revenue + operating + capital grants + interest + other income) | `72,492 + 44,916 + 3,405 + 28,542 + 56,552 + 7,662 + 71` = `$213,640` thousand | = printed total income   |
| Expense components sum (employee + materials + borrowing + other + disposal loss + depreciation)                     |       `47,319 + 51,966 + 2,995 + 3,045 + 3,276 + 54,323` = `$162,924` thousand | = printed total expenses |
| Total revenue − total expenses                                                                                       |                                                            `213,640 − 162,924` | = `$50,716` net result   |
| B1-1 Total functions and activities                                                                                  |     income `$213,640`; expenses `$162,924`; result `$50,716`; grants `$85,094` | = face statement         |
| External anchor                                                                                                      |                                                     none defined for FY2022-23 | not invented             |

The printed `(5,836)` net result before capital grants equals `50,716 − 56,552` capital grants and
is stored as a non-negative magnitude with `gpfs_printed_sign: "negative"`.

**Rows.** **17** rows for FY2022-23: 7 revenue components + total revenue, 5 expense components +
depreciation + total expenses, and net result + net result before capital grants. Each row has
`fiscal_year: "2022-23"`, `source_dataset: "Dubbo Regional Council GPFS 2022-23"`,
`measure_type: "actual"`, `aggregation_role: "agency_detail"`, no `region_id`/`location`, and a
year-scoped natural key. The 54 newer rows are unchanged, so the source holds **71** distinct
year-scoped rows; no row and no API total spans years.

**Database evidence (2026-11-18).** `measures` 693,374 → **693,391** (exactly **+17**);
`dubbo-council-gpfs` 54 → **71** with FY2022-23 **17**, FY2023-24 **17**, FY2024-25 **18**,
FY2025-26 **19**; `data_sources` still **83** (`records_ingested` for this source 54 → 71);
`dubbo-council` still **245**. The only source whose measure count changed is `dubbo-council-gpfs`;
every other source is unchanged. A second ingest run fetched/upserted the same 71 natural keys and
left the DB total at **693,391** (idempotent).

#### 7.1.4 FY2021-22 historical variant (landed 2026-11-18)

**Scope.** Add Dubbo Regional Council's audited **FY2021-22** GPFS as actual rows under the existing
source id `dubbo-council-gpfs`, preserving FY2022-23 (17), FY2023-24 (17), FY2024-25 (18) and
FY2025-26 (19). No older historical year and no other council is ingested here.

**Source.** The reviewed D2 packet (`docs/source-discovery/dubbo-regional.md` §10) records the
document
<https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Annual%20Financial%20Statements%202021-2022%20(1).pdf.aspx>
and SHA-256 `d28778f441953f17b01e78b2797c8bac9e34b1e42b94ba1777d7a922516a6153`. The connector
re-discovers it from the reporting page (no hard-coded PDF URL) and archives the exact bytes outside
the repo at
`~/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2021-22.pdf`: **3,891,387
bytes**, SHA-256 matching the packet exactly. The D2 archive copy at
`~/ausspend-source-archive/dubbo-regional/2021-22/gpfs-2021-22.pdf` has the same hash. The printed
unit is explicit `$'000` on the income statement (PDF p.5) and B1-1 (PDF p.15).

**Layout variant.** FY2021-22 uses inline face rows with one printed
`Total expenses from continuing operations` line (152,220) and no "excluding depreciation" subtotal.
It prints a `Net gain from the disposal of assets` revenue line at nil for the current year
(comparative 3,446); the nil-aware reader stores that dash as a printed zero and never reads the
comparative. The 7,149 disposal loss is a normal expense component. No OLG anchor exists for
FY2021-22, so none is invented.

| Check                                                                                                                                    |                                                                   Printed / derived | Result                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------: | ------------------------ |
| Revenue components sum (rates + user charges + other revenue + operating + capital grants + interest + other income + nil disposal gain) | `69,356 + 39,771 + 5,062 + 26,053 + 49,260 + 3,006 + 158 + 0` = `$192,666` thousand | = printed total income   |
| Expense components sum (employee + materials + borrowing + other + disposal loss + depreciation)                                         |            `44,485 + 46,710 + 2,981 + 2,438 + 7,149 + 48,457` = `$152,220` thousand | = printed total expenses |
| Total revenue − total expenses                                                                                                           |                                                                 `192,666 − 152,220` | = `$40,446` net result   |
| B1-1 Total functions and activities                                                                                                      |          income `$192,666`; expenses `$152,220`; result `$40,446`; grants `$75,313` | = face statement         |
| External anchor                                                                                                                          |                                                          none defined for FY2021-22 | not invented             |

The printed `(8,814)` net result before capital grants equals `40,446 − 49,260` capital grants and
is stored as a non-negative magnitude with `gpfs_printed_sign: "negative"`.

**Rows.** **18** rows for FY2021-22: 8 revenue components (including the printed-nil disposal gain)

- total revenue, 5 expense components + depreciation + total expenses, and net result + net result
  before capital grants. Each row has `fiscal_year: "2021-22"`,
  `source_dataset: "Dubbo Regional Council GPFS 2021-22"`, `measure_type: "actual"`,
  `aggregation_role: "agency_detail"`, no `region_id`/`location`, and a year-scoped natural key. The
  71 newer rows are unchanged, so the source holds **89** distinct year-scoped rows; no row and no API
  total spans years.

**Database evidence (2026-11-18).** `measures` 693,391 → **693,409** (exactly **+18**);
`dubbo-council-gpfs` 71 → **89** with FY2021-22 **18**, FY2022-23 **17**, FY2023-24 **17**,
FY2024-25 **18**, FY2025-26 **19**; `data_sources` still **83** (`records_ingested` for this source
71 → 89); `dubbo-council` still **245**. The only source whose measure count changed is
`dubbo-council-gpfs`; every other source is unchanged. A second ingest run fetched/upserted the same
89 natural keys and left the DB total at **693,409** (idempotent).

#### 7.1.5 FY2020-21 historical variant (landed 2026-11-18)

**Scope.** Add Dubbo Regional Council's audited **FY2020-21** GPFS as actual rows under the existing
source id `dubbo-council-gpfs`, preserving FY2021-22 (18), FY2022-23 (17), FY2023-24 (17),
FY2024-25 (18) and FY2025-26 (19). No older historical year and no other council is ingested here.

**Source.** The reviewed D2 packet (`docs/source-discovery/dubbo-regional.md` §10) records the
document
<https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Annual%20Financial%20Statements%20-2020-2021%20(3).pdf.aspx>
and SHA-256 `69a7b9cb99774a63b845bdb85950265a870246ce0c1f82a3929c2642244aab9b`. The connector
re-discovers it from the reporting page (no hard-coded PDF URL) and archives the exact bytes outside
the repo at
`~/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2020-21.pdf`: **2,637,455
bytes**, SHA-256 matching the packet exactly. The D2 archive copy at
`~/ausspend-source-archive/dubbo-regional/2020-21/gpfs-2020-21.pdf` has the same hash. The printed
unit is explicit `$'000` on the income statement (PDF p.4) and B1-1 (PDF p.14).

**Layout variant.** FY2020-21 uses inline face rows with one printed
`Total expenses from continuing operations` line (149,630) and no "excluding depreciation"
subtotal. It prints the revised labels `Other revenue`, `Net gains from the disposal of assets`,
`Materials and services`, `Depreciation, amortisation and impairment for non-financial assets` and
`Net losses from the disposal of assets`; the disposal gain is a printed 3,446 revenue component and
the disposal loss is printed as a dash for the current year. B1-1 income (186,942) and operating
result (37,312) are both **188 higher** than the face (186,754 / 37,124). That variance is
**unexplained**: the parser reconciles to the face statement, records the B1-1 variance, and never
forces equality, adjusts a component or invents an anchor. No OLG anchor exists for FY2020-21.

| Check                                                                                                                                |                                                                      Printed / derived | Result                                |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------: | ------------------------------------- |
| Revenue components sum (rates + user charges + other revenue + operating + capital grants + interest + other income + disposal gain) | `66,845 + 39,776 + 2,628 + 22,054 + 48,265 + 3,703 + 37 + 3,446` = `$186,754` thousand | = printed total income                |
| Expense components sum (employee + materials + borrowing + depreciation + other + nil disposal loss)                                 |                   `44,932 + 53,696 + 3,095 + 45,551 + 2,356 + 0` = `$149,630` thousand | = printed total expenses              |
| Total revenue − total expenses                                                                                                       |                                                                    `186,754 − 149,630` | = `$37,124` net result                |
| B1-1 Total functions and activities                                                                                                  |             income `$186,942`; expenses `$149,630`; result `$37,312`; grants `$70,319` | face retained; income/result **+188** |
| External anchor                                                                                                                      |                                                             none defined for FY2020-21 | not invented                          |

The printed `(11,141)` net result before capital grants equals `37,124 − 48,265` capital grants and
is stored as a non-negative magnitude with `gpfs_printed_sign: "negative"`.

**Rows.** **18** rows for FY2020-21: 8 revenue components (including the 3,446 disposal gain) + total
revenue, 5 expense components + depreciation + the printed-nil disposal loss + total expenses, and
net result + net result before capital grants. Each row has `fiscal_year: "2020-21"`,
`source_dataset: "Dubbo Regional Council GPFS 2020-21"`, `measure_type: "actual"`,
`aggregation_role: "agency_detail"`, no `region_id`/`location`, and a year-scoped natural key. The
89 earlier rows are unchanged, so the source holds **107** distinct year-scoped rows; no row and no
API total spans years.

**Database evidence (2026-11-18).** `measures` 693,409 → **693,427** (exactly **+18**);
`dubbo-council-gpfs` 89 → **107** with FY2020-21 **18**, FY2021-22 **18**, FY2022-23 **17**,
FY2023-24 **17**, FY2024-25 **18**, FY2025-26 **19**; `data_sources` still **83**
(`records_ingested` for this source 89 → 107); `dubbo-council` still **245**. The only source whose
measure count changed is `dubbo-council-gpfs`; every other source is unchanged. A second ingest run
fetched/upserted the same 107 natural keys and left the DB total at **693,427** (idempotent).

#### 7.1.6 FY2019-20 historical variant (landed 2026-11-18)

**Scope.** Add Dubbo Regional Council's audited **FY2019-20** GPFS as actual rows under the
existing source id `dubbo-council-gpfs`, preserving FY2020-21 (18), FY2021-22 (18), FY2022-23 (17),
FY2023-24 (17), FY2024-25 (18) and FY2025-26 (19). No older historical year and no other council is
ingested here.

**Source.** The reviewed D2 packet (`docs/source-discovery/dubbo-regional.md` §10) records the
document
<https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20%20Annual%20Financial%20Statements%202019%202020%20-%20Annual%20Report%20(1).pdf.aspx>
and SHA-256 `d42c0ee29172672a693c0878a83a8c48d5b46c80881bc247f3f61b9f2e8c277e`. The connector
re-discovers it from the reporting page (no hard-coded PDF URL) and archives the exact bytes outside
the repo at
`~/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2019-20.pdf`: **6,841,185
bytes**, SHA-256 matching the packet exactly. The D2 archive copy at
`~/ausspend-source-archive/dubbo-regional/2019-20/gpfs-2019-20.pdf` has the same hash. The printed
unit is explicit `$'000` on the income statement (PDF p.4) and the functions note (PDF p.13).

**Layout variant.** FY2019-20 uses inline face rows with one printed
`Total expenses from continuing operations` line (145,084) and no "excluding depreciation"
subtotal. Unlike the newer years, each row prints a numeric note reference immediately after its
label (`3a`, `3d,3e`, `4`, `5c`, `6`, `16`, …); the parser anchors on the label **plus** that note
reference, so a bare note number is never read as the current-year amount. The face adds a
`Net gains from the disposal of assets` revenue line printed as a dash (nil, comparative 703), a
`Net share of interests in joint ventures and associates using the equity method` revenue component
(149), and a `Net losses from the disposal of assets` expense line (2,493). It prints
`Materials and contracts` and `Depreciation and amortisation` rather than the newer labels.

The functions note (Note 2(a), "Total functions and activities") equals the face on income
(169,828), expenses (145,084) and result (24,744), but its printed grants column is **35,142**,
which is **not** the sum of the two face grant lines (21,858 operating + 33,077 capital = 54,935).
The 35,142 is retained as an independent printed anchor and the face grant lines are not adjusted,
reconciled by force or replaced. No OLG anchor exists for FY2019-20.

| Check                                                                                                                                |                                                                   Printed / derived | Result                            |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------: | --------------------------------- |
| Revenue components sum (rates + user charges + other revenue + operating + capital grants + interest + nil disposal gain + JV share) | `64,587 + 42,455 + 1,986 + 21,858 + 33,077 + 5,716 + 0 + 149` = `$169,828` thousand | = printed total income            |
| Expense components sum (employee + borrowing + materials + depreciation + other + disposal loss)                                     |           `45,200 + 3,691 + 36,364 + 42,261 + 15,075 + 2,493` = `$145,084` thousand | = printed total expenses          |
| Total revenue − total expenses                                                                                                       |                                                                 `169,828 − 145,084` | = `$24,744` net result            |
| Functions note Total functions and activities                                                                                        |          income `$169,828`; expenses `$145,084`; result `$24,744`; grants `$35,142` | face income/expenses/result agree |
| Functions-note grants vs face grant lines                                                                                            |                                  `$35,142` printed vs `$21,858 + $33,077 = $54,935` | independent anchor; never forced  |
| External anchor                                                                                                                      |                                                          none defined for FY2019-20 | not invented                      |

The printed `(8,333)` net result before capital grants equals `24,744 − 33,077` capital grants and
is stored as a non-negative magnitude with `gpfs_printed_sign: "negative"`. The printed nil disposal
gain is stored as a printed zero with `printed_nil: true`, never the comparative 703.

**Rows.** **18** rows for FY2019-20: 8 revenue components (including the nil disposal gain and the
149 joint-venture share) + total revenue, 6 expense components (including the 2,493 disposal loss) +
total expenses, and net result + net result before capital grants. Each row has
`fiscal_year: "2019-20"`, `source_dataset: "Dubbo Regional Council GPFS 2019-20"`,
`measure_type: "actual"`, `aggregation_role: "agency_detail"`, no `region_id`/`location`, and a
year-scoped natural key. The 107 earlier rows are unchanged, so the source holds **125** distinct
year-scoped rows; no row and no API total spans years.

**Database evidence (2026-11-18, shared dev DB).** Ingesting only this source into
`mongodb://<dev-db-host>:27017/ausspend_dev` took `measures` **693,444 → 693,462** (exactly **+18**);
`dubbo-council-gpfs` **107 → 125** with FY2019-20 **18**, FY2020-21 **18**, FY2021-22 **18**,
FY2022-23 **17**, FY2023-24 **17**, FY2024-25 **18**, FY2025-26 **19**. A full per-source diff
showed **only** `dubbo-council-gpfs` changed; no other source increased or decreased and no rows
were deleted. Every pre-existing row's natural key, amount, source and fiscal year are unchanged.
The automated seven-year ingestion test repeats the ingest to prove idempotency.

#### 7.1.7 FY2018-19 historical variant (landed 2026-11-18)

**Scope.** Add Dubbo Regional Council's audited **FY2018-19** GPFS as actual rows under the
existing source id `dubbo-council-gpfs`, preserving FY2019-20 (18), FY2020-21 (18), FY2021-22 (18),
FY2022-23 (17), FY2023-24 (17), FY2024-25 (18) and FY2025-26 (19). No older historical year and no
other council is ingested here.

**Source.** The reviewed D2 packet (`docs/source-discovery/dubbo-regional.md` §10) records the
document
<https://www.dubbo.nsw.gov.au/ArticleDocuments/11102/Dubbo%20Regional%20Council%20-%20Financial%20Statements%202018-19.pdf.aspx>
and SHA-256 `f95027b5bcaf2dc12e9f9b9c752170f2694d88c15b07f170dbda761d5d2034ea`. The connector
re-discovers it from the reporting page (no hard-coded PDF URL) and archives the exact bytes outside
the repo at
`~/ausspend-source-archive/dubbo-council-gpfs/dubbo-regional-council-gpfs-2018-19.pdf`:
**5,224,896 bytes**, SHA-256 matching the packet exactly. The D2 archive copy at
`~/ausspend-source-archive/dubbo-regional/2018-19/gpfs-2018-19.pdf` has the same hash. The printed
unit is explicit `$'000` on the income statement (PDF p.5) and the functions note (PDF p.15).

**Layout variant.** FY2018-19 prints inline face rows in three columns — Original unaudited budget,
Actual current year and Restated prior year — with a numeric note reference after each label (`3a`,
`3b`, `3c`, `3d`, `3e,3f`, `5`, `14`, `4a` …). The budget amount is printed _before_ the label and
the two actual columns after it, so the parser anchors on the label plus its note reference and
takes the first amount after it: the **Actual 2019** column, never the budget or the restated 2018
comparative. The year prints `Interest and investment revenue`, `Materials and contracts` and
`Depreciation and amortisation` rather than the newer labels, and has no disposal-loss expense line;
the disposal gain (703) and the joint-venture share (49) are revenue components.

The functions note (Note 2(a), "Total functions and activities") equals the face on income
(184,140), expenses (136,358) and result (47,782), but its printed grants column is **44,452**,
which is **not** the sum of the two face grant lines (18,610 operating + 47,179 capital = 65,789).
The 44,452 is retained as an independent printed anchor and the face grant lines are not adjusted,
reconciled by force or replaced. No OLG anchor exists for FY2018-19.

| Check                                                                                                                      |                                                                    Printed / derived | Result                            |
| -------------------------------------------------------------------------------------------------------------------------- | -----------------------------------------------------------------------------------: | --------------------------------- |
| Revenue components sum (rates + user charges + interest + other revenue + operating + capital grants + disposal gain + JV) | `62,438 + 46,393 + 6,834 + 1,934 + 18,610 + 47,179 + 703 + 49` = `$184,140` thousand | = printed total income            |
| Expense components sum (employee + borrowing + materials + depreciation + other)                                           |                    `40,104 + 4,435 + 35,017 + 39,902 + 16,900` = `$136,358` thousand | = printed total expenses          |
| Total revenue − total expenses                                                                                             |                                                                  `184,140 − 136,358` | = `$47,782` net result            |
| Functions note Total functions and activities                                                                              |           income `$184,140`; expenses `$136,358`; result `$47,782`; grants `$44,452` | face income/expenses/result agree |
| Functions-note grants vs face grant lines                                                                                  |                                   `$44,452` printed vs `$18,610 + $47,179 = $65,789` | independent anchor; never forced  |
| External anchor                                                                                                            |                                                           none defined for FY2018-19 | not invented                      |

The printed net result before capital grants is `603` (`47,782 − 47,179` capital grants) and is
stored as a positive magnitude.

**Rows.** **17** rows for FY2018-19: 8 revenue components (including the 703 disposal gain and the
49 joint-venture share) + total revenue, 5 expense components + total expenses, and net result + net
result before capital grants. Each row has `fiscal_year: "2018-19"`,
`source_dataset: "Dubbo Regional Council GPFS 2018-19"`, `measure_type: "actual"`,
`aggregation_role: "agency_detail"`, no `region_id`/`location`, and a year-scoped natural key. The
125 earlier rows are unchanged, so the source holds **142** distinct year-scoped rows; no row and no
API total spans years.

**Database evidence (2026-11-18, shared dev DB).** Ingesting only this source into
`mongodb://<dev-db-host>:27017/ausspend_dev` took `measures` **693,462 → 693,479** (exactly **+17**);
`dubbo-council-gpfs` **125 → 142** with FY2018-19 **17**, FY2019-20 **18**, FY2020-21 **18**,
FY2021-22 **18**, FY2022-23 **17**, FY2023-24 **17**, FY2024-25 **18**, FY2025-26 **19**. A full
per-source diff showed **only** `dubbo-council-gpfs` changed; no other source increased or decreased
and no rows were deleted or modified. Every pre-existing row's natural key, amount, source and fiscal
year are unchanged. A second ingest was a no-op (measures stayed **693,479**), and the automated
eight-year ingestion test repeats the ingest to prove idempotency.

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

**Depth pilot (2026-11-18).** The original **17** rows remain byte-identical
(same natural keys and amounts). The pilot adds **16** rows, bringing the source to **33**:

- **6 B1-1 function expense rows.** The six printed "Functions or activities" are council-specific
  strategic directions, **not COFOG**; no `function_code` is set. Each row is an expense component
  of the printed B1-1 total under `gpfs_component_of: "b1_1_total_expenses"` (a separate function
  cut, never added to the income-statement nature cut). The six expenses sum exactly to
  `$515,970` thousand; income, operating result, grants and carrying amount are reconciled to their
  printed totals (`$762,437` / `$246,467` / `$289,851` / `$8,920,355`) but not emitted as spending.
- **10 Special Schedule actual-maintenance rows.** Page 125 "Report on infrastructure assets as at
  30 June 2025" prints required and actual maintenance by asset class. Only the **actual**
  maintenance is emitted (10 asset classes, total `$95,589` thousand), each
  `gpfs_component_of: "actual_asset_maintenance_total"` and `gpfs_statement: "Special Schedule —
Report on infrastructure assets"`. Required maintenance (`$99,510`) and the asset-condition
  ratios/backlog/renewals indicators are reconciliation evidence only, not additional spending.
- **Canonical URL.** The existing 17 rows use the archived `/v/1/...pdf.pdf` URL. The live page now
  links a `/v/3/...pdf` copy with identical SHA-256/bytes; using it would re-key the 17 rows and
  duplicate them. The connector now preserves the existing canonical URL. The first live run did
  create 33 duplicate `/v/3/` rows; those pilot-created duplicates were removed and the 16 new rows
  re-ingested under the canonical URL. No pre-existing row was deleted and the original 17 are
  unchanged.
- **Database evidence.** `measures` **693,059 → 693,075** (exactly +16); `blacktown-gpfs`
  **17 → 33**; all other sources **693,042 → 693,042** (delta 0). Re-running is idempotent on the
  33 natural keys. No cross-statement or cross-council sums; all rows remain non-additive
  `agency_detail`.

**Burwood Council — DEFERRED (Phase 6.9 council item, 2026-11-18).** The official
Burwood site and sitemap list only Annual Report 2023-24, Annual Report 2024-25 and State of Our
City 2021-24. No separate audited General Purpose Financial Statements/financial-statements PDF is
published; candidate financial-statement URLs return 404. The 2024-25 annual-report PDF (38 pages,
SHA-256 `66a268845ccf33cea9567c878ce3aa65f69aead32970a7ff122fb55d6bec176b`) contains only a
“Financial performance” summary, not audited GPFS, and that summary's revenue components sum to
78,855 versus the printed 78,885 (30 short), while 78,885 − 65,236 does not equal its printed
operating result 13,619. No rows were invented or ingested; the DB stayed at 693,075. See
`BURWOOD_GPFS_DEFERRED.md`.

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
`~/ausspend-source-archive/canterbury-bankstown-gpfs/canterbury-bankstown-financial-statements-2024-25.pdf`,
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
`~/ausspend-source-archive/sutherland-shire-gpfs/2024-2025-Sutherland-Shire-Council-Financial-Statements.pdf`,
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
`~/ausspend-source-archive/wollongong-gpfs/Annual-Financial-Statements-year-ended-30-June-2025.pdf`,
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
`~/ausspend-source-archive/newcastle-gpfs/Newcastle-City-Council-Financial-Statements-2024-25.pdf`,
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
`~/ausspend-source-archive/lake-macquarie-gpfs/annual-financial-statements-for-the-year-ended-30-june-2025.pdf`,
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
`~/ausspend-source-archive/maitland-gpfs/Financial-Statements-2024-25-Final.pdf`,
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
`~/ausspend-source-archive/coffs-harbour-gpfs/2024-25-annual-report-section-3.pdf`,
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
`~/ausspend-source-archive/mid-coast-gpfs/financial-statements-2024-2025.pdf`,
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
`~/ausspend-source-archive/port-macquarie-hastings-gpfs/part-2-financial-statements.pdf`,
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

### 7.19 Nineteenth council — Willoughby City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the council's official Financial-information page
<https://www.willoughby.nsw.gov.au/Financial-information>, which links the Publications index and the
dedicated FY2024-25 publication page
<https://www.willoughby.nsw.gov.au/Council/Policies-and-publications/Publications/2025-Annual-Financial-Statements-2024-2025>
(titled "Annual Financial Statements 2024-2025"; a separate "Annual Financial Statements 2025-2026"
page is not selected). Node's plain `fetch` to `willoughby.nsw.gov.au` is rejected with a Cloudflare
HTTP 403, which is not proof of absence, so discovery and the PDF download use the documented headless
Chromium/Playwright path (the same path as Waverley, Wollongong and Lake Macquarie). The page's
"Annual Financial Statements 2024-2025" anchor resolves to the council-hosted audited statements
<https://www.willoughby.nsw.gov.au/files/assets/public/v/2/documents/publications-reports-master-plans-strategies-action-plans/ecm_7295400_v2_willougby-city-council-final-24-25-financial-statement.pdf>
(no hard-coded PDF URL — the connector parses the link from the cleared page HTML). Exact bytes
archived outside the repo at
`~/ausspend-source-archive/willoughby-gpfs/willoughby-city-council-financial-statements-2024-25.pdf`:
**3,217,101 bytes**, SHA-256
`496c569c64c69ef2bb79b233f638011cc561a98882fd732348c1b864fbf2d1d9` (`hash_verified: true`). The
Income Statement is printed p4 of 80 (PDF p12), the Statement of Comprehensive Income p5 (PDF p13),
B1-1 "Total functions and activities" p13 (PDF p21) and note B3-4 depreciation p26 (PDF p34). The
printed unit is explicit `$ '000` (thousands) on the income statement, B1-1, the comprehensive-income
statement and the depreciation note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before
each line label (Actual 2025 and Actual 2024 after it), so each emitted value is the first amount
after the printed label (the FY2024-25 actual). The phrase "depreciation, amortisation and impairment
of non-financial assets" appears in the expense subtotal and in the excluding-depreciation result
before the actual depreciation line, so the connector reads that line from the last printed occurrence
(the capitalised standalone line). The connector emits nothing unless all of these agree exactly:

| Check                                                                                                                                   |                            Printed / derived | Result                                     |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                              |                          `$178,259` thousand | = `$178,259,000`                           |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain) |                          `$178,259` thousand | = printed total                            |
| B1-1 Total functions and activities — income                                                                                            |                          `$178,259` thousand | = face statement                           |
| Expense-by-nature components sum (employee + materials + borrowing + other)                                                             |                          `$117,192` thousand | = printed expenses excluding depreciation  |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$21,081`)                                      | `$117,192` + `$21,081` = `$138,273` thousand | = B1-1 expense total                       |
| B1-1 Total functions and activities — expenses                                                                                          |                          `$138,273` thousand | = `$138,273,000` (printed total)           |
| Operating result / net operating result                                                                                                 | `$178,259` − `$138,273` = `$39,986` thousand | = printed operating result                 |
| Net operating result for the year attributable to Council                                                                               |                           `$39,986` thousand | = operating result                         |
| Net operating result before capital grants                                                                                              |   `$39,986` − `$26,038` = `$13,948` thousand | = printed before-capital result (positive) |
| B1-1 grants and contributions                                                                                                           |                           `$31,595` thousand | = operating `$5,557` + capital `$26,038`   |
| Statement of Comprehensive Income net result                                                                                            |                           `$39,986` thousand | = Income Statement net result              |
| Note B3-4 total depreciation and amortisation costs                                                                                     |                           `$21,081` thousand | = face depreciation line                   |

Total expenses is the printed B1-1 "Total functions and activities" expense total
(`$138,273` thousand), **not** a sum of the nature components on its own and **not** the separate
printed expenses-excluding-depreciation line. It equals the printed expenses-excluding-depreciation
line (`$117,192` thousand) plus the printed depreciation/impairment line (`$21,081` thousand) and the
printed total income less the printed operating result. The printed revenue "Net gain from the
disposal of assets" line is non-nil (`$19` thousand) and is emitted as a revenue component; it is
what makes the eight revenue components sum exactly to the printed total. There is no separate
"Net loss from the disposal of assets" expense line in this report. Because the printed before-capital
result is positive (`$13,948` thousand), it is emitted as a stored result line (unlike Waverley,
where the negative before-capital result is reconciliation evidence only).

**Rows.** 18 rows, source id `willoughby-gpfs`, `source_dataset` "Willoughby City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Willoughby City Council"` (the exact published entity name
in the audited statements and the string used by the 7 pre-existing rows),
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$178,259,000`, total expenses `$138,273,000`, employee expenses `$51,919,000`,
depreciation/amortisation/impairment `$21,081,000`, operating government grants `$5,557,000`, capital
government grants `$26,038,000`, net gain on disposal of assets `$19,000`, net result `$39,986,000`
and net result before capital grants `$13,948,000`; the printed face-statement revenue and expense
components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: **7 GrantConnect rows** whose
`delivery_entity` is exactly "Willoughby City Council", plus **67 other rows** whose `delivery_entity`
merely mentions Willoughby under other strings (40 ACNC, 21 other GrantConnect, 4 AusTender and 2
data.nsw); their per-source counts are identical before and after the ingest. All eighteen other
council GPFS sources are unchanged (Dubbo 18, City of Sydney 18, Blacktown 17, Parramatta 17,
Northern Beaches 18, Canterbury-Bankstown 17, Sutherland Shire 17, Wollongong 17, Newcastle 17, Lake
Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17, Port Macquarie-Hastings 17, Tweed Shire 17,
Shoalhaven 17, Shellharbour 17, Waverley 17). Government grant rows carry
`potential_double_count: true` because they may overlap government program data; they are not added
to expenditure.

**Database evidence (2026-11-18).** `measures` 515,748 → **515,766** (exactly +18);
`willoughby-gpfs` **18**; `waverley-gpfs` still **17**; `shellharbour-gpfs` still **17**;
`data-nsw-ckan` still **3,472**; `dubbo-council` still **245**; exact "Willoughby City Council" rows
7 → **25** (the new 18 plus the 7 pre-existing exact-case GrantConnect rows) and case-insensitive
exact rows 7 → **25**; rows whose `delivery_entity` mentions Willoughby 74 → **92**; `data_sources`
44 → **45**. A second ingest run upserted the same 18 natural keys and left the DB total unchanged
(idempotent). No deletes or updates to any other source.

### 7.20 Twentieth council — Inner West Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the council's official Annual Report page
<https://www.innerwest.nsw.gov.au/annual-report> (reached from the Plans, performance and budget page
<https://www.innerwest.nsw.gov.au/plans-performance-and-budget>). The page states the annual report
"includes ... Council's financial report which has been audited by the NSW Audit Office", and links
the FY2024-25 "Annual Report 2024-25" PDF. That PDF embeds the **General Purpose Financial Statements**
from PDF p234 of 314, together with the **independent auditor's report on the general purpose
financial statements** (PDF p293), which states the statements "comprise the Statement by Councillors
and Management, the Income Statement and Statement of Comprehensive Income for the year ended 30 June
2025 ...". The report was authorised for issue by Council on 28/10/2025. `innerwest.nsw.gov.au` serves
plain HTTP (HTTP 200; no Cloudflare/Akamai challenge), so discovery and the PDF download use Node's
plain `fetch`; the connector still parses the FY2024-25 "Annual Report 2024-25" anchor from the page
HTML (no hard-coded PDF URL). Exact bytes archived outside the repo at
`~/ausspend-source-archive/inner-west-gpfs/inner-west-council-annual-report-2024-25-gpfs.pdf`:
**10,107,386 bytes**, SHA-256
`03403da8625147450d200cad6a8354f10877893fb2086763f4df9d8fa7622c1f` (`hash_verified: true`). The
Income Statement is PDF p236 (printed p4 of 70), the Statement of Comprehensive Income p237 (p5),
B1-1 "Total functions and activities" p245 (p13) and note B3-3 depreciation p256 (p24). The printed
unit is explicit `$ '000` (thousands) on the income statement, B1-1, the comprehensive-income
statement and the depreciation note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before each
line label (Actual 2025 and Actual 2024 after it), so each emitted value is the first amount after the
printed label (the FY2024-25 actual). The expense subtotal embeds the phrase "depreciation,
amortisation and impairment of non-financial assets", so the connector reads the actual depreciation
line from the last printed occurrence (the standalone capitalised line). The connector emits nothing
unless all of these agree exactly:

| Check                                                                                                                                               |                            Printed / derived | Result                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                          |                          `$368,386` thousand | = `$368,386,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + fair-value increment) |                          `$368,386` thousand | = printed total                                  |
| B1-1 Total functions and activities — income                                                                                                        |                          `$368,386` thousand | = face statement                                 |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                                                  |                          `$286,616` thousand | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$38,967`)                                                  | `$286,616` + `$38,967` = `$325,583` thousand | = B1-1 expense total                             |
| B1-1 Total functions and activities — expenses                                                                                                      |                          `$325,583` thousand | = `$325,583,000` (printed total)                 |
| Operating result / net operating result                                                                                                             | `$368,386` − `$325,583` = `$42,803` thousand | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                                           |                           `$42,803` thousand | = operating result                               |
| Net operating result before capital grants                                                                                                          |  `$42,803` − `$47,384` = `$(4,581)` thousand | = printed before-capital deficit (evidence only) |
| B1-1 grants and contributions                                                                                                                       |                           `$60,190` thousand | = operating `$12,806` + capital `$47,384`        |
| Statement of Comprehensive Income net result                                                                                                        |                           `$42,803` thousand | = Income Statement net result                    |
| Note B3-3 total depreciation and amortisation costs                                                                                                 |                           `$38,967` thousand | = face depreciation line                         |

Total expenses is the printed B1-1 "Total functions and activities" expense total
(`$325,583` thousand), **not** a sum of the nature components on its own and **not** the separate
printed expenses-excluding-depreciation line. It equals the printed expenses-excluding-depreciation
line (`$286,616` thousand) plus the printed depreciation/impairment line (`$38,967` thousand) and the
printed total income less the printed operating result. The printed revenue "Fair value increment on
investment properties" line is non-nil (`$7,709` thousand) and is emitted as a revenue component; the
printed "Fair value decrement on investment properties" line is nil ("–") for FY2024-25 and is not
emitted (omitting a zero line keeps the component sum exact). The printed before-capital result is a
deficit of `$(4,581)` thousand; because the measure model stores non-negative integer cents, it is
kept in the reconciliation evidence only and is not emitted as a row (the same convention as
Blacktown, Parramatta and several later councils).

**Rows.** 18 rows, source id `inner-west-gpfs`, `source_dataset` "Inner West Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Inner West Council"` (the exact published entity name in
the audited statements and the string used by the 4 pre-existing exact-case rows),
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$368,386,000`, total expenses `$325,583,000`, employee expenses `$149,271,000`,
depreciation/amortisation/impairment `$38,967,000`, operating government grants `$12,806,000`,
capital government grants `$47,384,000`, net loss on disposal of assets `$6,128,000`, net result
`$42,803,000` and the fair value increment `$7,709,000`; the printed face-statement revenue and
expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: **4 GrantConnect rows** whose
`delivery_entity` is exactly "Inner West Council", plus the **1 uppercase GrantConnect grant** and
**2 uppercase AusTender contracts** that case-insensitively match (7 case-insensitive exact rows in
total), plus **36 other rows** whose `delivery_entity` merely mentions Inner West under other strings
(15 other GrantConnect and 21 ACNC, the 2 AusTender rows being the uppercase exact matches above);
their per-source counts are identical before and
after the ingest. All nineteen other council GPFS sources are unchanged (Dubbo 18, City of Sydney 18,
Blacktown 17, Parramatta 17, Northern Beaches 18, Canterbury-Bankstown 17, Sutherland Shire 17,
Wollongong 17, Newcastle 17, Lake Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17, Port
Macquarie-Hastings 17, Tweed Shire 17, Shoalhaven 17, Shellharbour 17, Waverley 17, Willoughby 18).
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,766 → **515,784** (exactly +18);
`inner-west-gpfs` **18**; `willoughby-gpfs` still **18**; `waverley-gpfs` still **17**;
`shellharbour-gpfs` still **17**; `data-nsw-ckan` still **3,472**; `dubbo-council` still **245**;
exact "Inner West Council" rows 4 → **22** (the new 18 plus the 4 pre-existing exact-case GrantConnect
rows) and case-insensitive exact rows 7 → **25**; rows whose `delivery_entity` mentions Inner West
43 → **61**; `data_sources` 45 → **46**. A second ingest run upserted the same 18 natural keys and left
the DB total unchanged (idempotent). No deletes or updates to any other source.

---

### 7.21 Twenty-first council — Bayside Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the council's official Corporate planning and reporting page
<https://www.bayside.nsw.gov.au/your-council/corporate-planning-and-reporting> (reached from the
council home page). The page links a standalone FY2024-25 **"General Purpose Financial Statements &
Special Schedules for the year ended 30 June 2025"** PDF, separate from the Annual Report. That PDF
contains the **General Purpose Financial Statements** (Income Statement PDF p4, Statement of
Comprehensive Income p5, B1-1 "Total functions and activities" p14 and note B3-4 depreciation p24)
together with the **independent auditor's reports on the financial statements** (PDF p72 onward),
which state the statements comprise the Statement by Councillors and Management, the Income
Statement and Statement of Comprehensive Income for the year ended 30 June 2025. The statements were
signed in accordance with a Council resolution made on 22 October 2025. `bayside.nsw.gov.au` serves
plain HTTP (HTTP 200; no Cloudflare/Akamai challenge), so discovery and the PDF download use Node's
plain `fetch`; the connector still parses the FY2024-25 General Purpose Financial Statements anchor
from the page HTML (no hard-coded PDF URL). Exact bytes archived outside the repo at
`~/ausspend-source-archive/bayside-gpfs/bayside-council-gpfs-2024-25.pdf`:
**2,174,485 bytes**, SHA-256
`c91290369d85aa34c95a47a806d1187809ef7816f0a76a1872b70a79560a8bf0` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the income statement, B1-1, the comprehensive-income
statement and the depreciation note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before each
line label (Actual 2025 and Actual 2024 after it), so each emitted value is the first amount after the
printed label (the FY2024-25 actual). The expense subtotal embeds the phrase "depreciation,
amortisation and impairment of non-financial assets", so the connector reads the actual depreciation
line from the last printed occurrence (the standalone capitalised line). The connector emits nothing
unless all of these agree exactly:

| Check                                                                                                                                           |                            Printed / derived | Result                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                      |                          `$266,137` thousand | = `$266,137,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net share of JVs) |                          `$266,137` thousand | = printed total                                  |
| B1-1 Total functions and activities — income                                                                                                    |                          `$266,137` thousand | = face statement                                 |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                                              |                          `$194,412` thousand | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$36,239`)                                              | `$194,412` + `$36,239` = `$230,651` thousand | = B1-1 expense total                             |
| B1-1 Total functions and activities — expenses                                                                                                  |                          `$230,651` thousand | = `$230,651,000` (printed total)                 |
| Operating result / net operating result                                                                                                         | `$266,137` − `$230,651` = `$35,486` thousand | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                                       |                           `$35,486` thousand | = operating result                               |
| Net operating result before capital grants                                                                                                      |    `$35,486` − `$30,044` = `$5,442` thousand | = printed before-capital surplus (evidence only) |
| B1-1 grants and contributions                                                                                                                   |                           `$41,038` thousand | = operating `$10,994` + capital `$30,044`        |
| Statement of Comprehensive Income net result                                                                                                    |                           `$35,486` thousand | = Income Statement net result                    |
| Note B3-4 total depreciation and amortisation costs                                                                                             |                           `$36,239` thousand | = face depreciation line                         |

Total expenses is the printed B1-1 "Total functions and activities" expense total
(`$230,651` thousand), **not** a sum of the nature components on its own and **not** the separate
printed expenses-excluding-depreciation line. It equals the printed expenses-excluding-depreciation
line (`$194,412` thousand) plus the printed depreciation/impairment line (`$36,239` thousand) and the
printed total income less the printed operating result. The eighth printed revenue line, the net
share of interests in joint ventures and associates using the equity method (`$13` thousand), is
non-nil and is emitted as a revenue component so the component sum is exact. The printed
before-capital result is a surplus of `$5,442` thousand; it is kept in the reconciliation evidence
only and is not emitted as a row.

**Rows.** 18 rows, source id `bayside-gpfs`, `source_dataset` "Bayside Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Bayside Council"` (the exact published entity name in the
audited statements and the string used by the 4 pre-existing exact-case rows),
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$266,137,000`, total expenses `$230,651,000`, employee expenses `$89,104,000`,
depreciation/amortisation/impairment `$36,239,000`, operating government grants `$10,994,000`,
capital government grants `$30,044,000`, net loss on disposal of assets `$8,779,000`, net result
`$35,486,000` and the net share of joint ventures and associates `$13,000`; the printed
face-statement revenue and expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: **4 rows** whose `delivery_entity` is
exactly "Bayside Council" (3 exact-case GrantConnect grants and 1 exact-case AusTender contract; the
same 4 case-insensitively), plus **377 other rows** whose `delivery_entity` merely mentions Bayside
under other strings (GrantConnect, AusTender, ACNC, QLD QGIP and data.nsw CKAN); their per-source
counts are identical before and after the ingest. All twenty other council GPFS sources are unchanged
(Dubbo 18, City of Sydney 18, Blacktown 17, Parramatta 17, Northern Beaches 18,
Canterbury-Bankstown 17, Sutherland Shire 17, Wollongong 17, Newcastle 17, Lake Macquarie 17,
Maitland 7, Coffs Harbour 17, MidCoast 17, Port Macquarie-Hastings 17, Tweed Shire 17, Shoalhaven 17,
Shellharbour 17, Waverley 17, Willoughby 18, Inner West 18). Government grant rows carry
`potential_double_count: true` because they may overlap government program data; they are not added
to expenditure.

**Database evidence (2026-11-18).** `measures` 515,784 → **515,802** (exactly +18);
`bayside-gpfs` **18**; `inner-west-gpfs` still **18**; `willoughby-gpfs` still **18**;
`waverley-gpfs` still **17**; `shellharbour-gpfs` still **17**; `data-nsw-ckan` still **3,472**;
`dubbo-council` still **245**; exact "Bayside Council" rows 4 → **22** (the new 18 plus the 4
pre-existing exact-case rows) and case-insensitive exact rows 4 → **22**; rows whose
`delivery_entity` mentions Bayside 381 → **399**; `data_sources` 46 → **47**. A second ingest run
upserted the same 18 natural keys and left the DB total unchanged (idempotent). No deletes or
updates to any other source.

---

### 7.22 Twenty-second council — Randwick City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the council's official "Our reports" page
<https://www.randwick.nsw.gov.au/about-us/integrated-planning-and-reporting/our-reports> (under the
Financial Statements heading; reached from the home page's Integrated Planning & Reporting menu).
The page links a standalone FY2024-25 **"Financial Statements - 2024-25"** PDF, separate from the
Annual Report. That PDF contains the **General Purpose Financial Statements** (Income Statement PDF
p6, printed p4; Statement of Comprehensive Income p7; B1-1 "Total functions and activities" p15,
printed p13; and note B3-4 depreciation p25, printed p23) together with the independent auditor's
reports on the financial statements. `randwick.nsw.gov.au` serves a Cloudflare "Just a moment..."
challenge (HTTP 403) to non-browser clients, which is not proof of absence, so discovery and the PDF
download use the documented headless Chromium/Playwright path (the same path as Waverley,
Wollongong, Lake Macquarie, MidCoast, Port Macquarie-Hastings, Coffs Harbour and Willoughby); the
connector still parses the FY2024-25 Financial Statements anchor from the cleared page HTML (no
hard-coded PDF URL). Exact bytes archived outside the repo at
`~/ausspend-source-archive/randwick-gpfs/randwick-city-council-financial-statements-2024-25.pdf`:
**5,567,387 bytes**, SHA-256
`40845270cd20290dad620e3f398e4ee91d9566aa9e1ed701254b560618a7d455` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the income statement, B1-1, the comprehensive-income
statement and the depreciation note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The Income Statement prints the Original unaudited budget column before each
line label (Actual 2025 and Actual 2024 after it), so each emitted value is the first amount after the
printed label (the FY2024-25 actual). The expense subtotal embeds the phrase "depreciation,
amortisation and impairment of non-financial assets", so the connector reads the actual depreciation
line from the last printed occurrence (the standalone capitalised line). The connector emits nothing
unless all of these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------ |
| Total revenue from continuing operations (Income Statement)                                                                  |                          `$242,108` thousand | = `$242,108,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$242,108` thousand | = printed total                                  |
| B1-1 Total functions and activities — income                                                                                 |                          `$242,108` thousand | = face statement                                 |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                           |                          `$179,216` thousand | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$28,379`)                           | `$179,216` + `$28,379` = `$207,595` thousand | = B1-1 expense total                             |
| B1-1 Total functions and activities — expenses                                                                               |                          `$207,595` thousand | = `$207,595,000` (printed total)                 |
| Operating result / net operating result                                                                                      | `$242,108` − `$207,595` = `$34,513` thousand | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                    |                           `$34,513` thousand | = operating result                               |
| Net operating result before capital grants                                                                                   |    `$34,513` − `$31,920` = `$2,593` thousand | = printed before-capital surplus (evidence only) |
| B1-1 grants and contributions                                                                                                |                           `$41,317` thousand | = operating `$9,397` + capital `$31,920`         |
| Statement of Comprehensive Income net result                                                                                 |                           `$34,513` thousand | = Income Statement net result                    |
| Note B3-4 total depreciation and amortisation costs                                                                          |                           `$28,379` thousand | = face depreciation line                         |

Total expenses is the printed B1-1 "Total functions and activities" expense total
(`$207,595` thousand), **not** a sum of the nature components on its own and **not** the separate
printed expenses-excluding-depreciation line. It equals the printed expenses-excluding-depreciation
line (`$179,216` thousand) plus the printed depreciation/impairment line (`$28,379` thousand) and the
printed total revenue less the printed operating result. The face statement prints seven revenue
components (there is no net-share-of-joint-ventures line in this report); they sum exactly to the
printed total. The printed before-capital result is a surplus of `$2,593` thousand; following the
Bayside convention it is kept in the reconciliation evidence only and is not emitted as a row.

**Rows.** 17 rows, source id `randwick-gpfs`, `source_dataset` "Randwick City Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Randwick City Council"` (the exact published entity name in
the audited statements and the string used by the 3 pre-existing exact-case GrantConnect rows),
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$242,108,000`, total expenses `$207,595,000`, employee expenses `$87,671,000`,
depreciation/amortisation/impairment `$28,379,000`, operating government grants `$9,397,000`,
capital government grants `$31,920,000`, net loss on disposal of assets `$4,124,000` and net result
`$34,513,000`; the printed face-statement revenue and expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: **3 GrantConnect rows** whose
`delivery_entity` is exactly "Randwick City Council" and **2 uppercase AusTender contracts** whose
string is "RANDWICK CITY COUNCIL" (5 case-insensitive exact rows in total), plus **95 other rows**
whose `delivery_entity` merely mentions Randwick under other strings (60 other GrantConnect, 27
ACNC, 6 other AusTender and 2 data.nsw); their per-source counts are identical before and after the
ingest. All twenty-one other council GPFS sources are unchanged (Dubbo 18, City of Sydney 18,
Blacktown 17, Parramatta 17, Northern Beaches 18, Canterbury-Bankstown 17, Sutherland Shire 17,
Wollongong 17, Newcastle 17, Lake Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17, Port
Macquarie-Hastings 17, Tweed Shire 17, Shoalhaven 17, Shellharbour 17, Waverley 17, Willoughby 18,
Inner West 18, Bayside 18). Government grant rows carry `potential_double_count: true` because they
may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,802 → **515,819** (exactly +17);
`randwick-gpfs` **17**; `bayside-gpfs` still **18**; `data-nsw-ckan` still **3,472**;
`dubbo-council` still **245**; exact "Randwick City Council" rows 3 → **20** (the new 17 plus the 3
pre-existing exact-case GrantConnect rows) and case-insensitive exact rows 5 → **22**; rows whose
`delivery_entity` mentions Randwick 100 → **117**; `data_sources` 47 → **48**. A second ingest run
upserted the same 17 natural keys and left the DB total unchanged (idempotent). No deletes or
updates to any other source.

---

### 7.23 Twenty-third council — Council of the City of Ryde FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the council's official "Financial Reports and Statements" page
<https://www.ryde.nsw.gov.au/Council/Strategies-Plans-and-Publications/Integrated-Planning-and-Reporting/Financial-Reports-and-Statements>
(reached from the home page's Integrated Planning and Reporting menu). The page lists the FY2024-25
**"Financial Statements (General and Special Purpose)"** PDF as the link labelled "Year ended 30 June
2025" with the council's title "Finacial-Report-2025.pdf"; it is separate from the Annual Report. That
82-page PDF contains the **General Purpose Financial Statements** (Income Statement PDF p6, printed
p3; Statement of Comprehensive Income PDF p7, printed p4; B1-1 "Total functions and activities" PDF
p15, printed p12; and note B3-4 depreciation PDF p27, printed p24) together with the independent
auditor's reports on the financial statements. The statements were signed in accordance with a
Council resolution made on 21 October 2025. `ryde.nsw.gov.au` served plain HTTP to Node's `fetch` in
this pass (page HTTP 200, PDF HTTP 200; no Cloudflare/Akamai challenge observed), so discovery and the
PDF download use plain `fetch`; the connector still parses the FY2024-25 financial-statements anchor
from the page HTML (no hard-coded PDF URL). Exact bytes archived outside the repo at
`~/ausspend-source-archive/ryde-gpfs/council-of-the-city-of-ryde-financial-statements-2024-25.pdf`:
**12,685,077 bytes**, SHA-256
`4a70b2a68b47142b79679a4ea4763849d7c07fc76b90a19c7bbc48e635a4bdb5` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the income statement, B1-1, the comprehensive-income
statement and the depreciation note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The PDF text stream places the Original unaudited budget amount before each
Income Statement line label and the FY2024-25 actual immediately after it (followed by FY2023-24), so
each emitted value is the first amount after the printed label. The expense subtotal embeds the phrase
"depreciation, amortisation and impairment of non-financial assets", so the connector reads the actual
depreciation line from the last printed occurrence (the standalone capitalised line). The connector
emits nothing unless all of these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                   |                          `$215,461` thousand | = `$215,461,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$215,461` thousand | = printed total                                  |
| B1-1 Total functions and activities — income                                                                                 |                          `$215,461` thousand | = face statement                                 |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                           |                          `$148,688` thousand | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$30,119`)                           | `$148,688` + `$30,119` = `$178,807` thousand | = face-statement total expenses                  |
| Operating result / net operating result                                                                                      | `$215,461` − `$178,807` = `$36,654` thousand | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                    |                           `$36,654` thousand | = operating result                               |
| Net operating result before capital grants                                                                                   |  `$36,654` − `$42,063` = `$(5,409)` thousand | = printed before-capital deficit (evidence only) |
| B1-1 grants and contributions                                                                                                |                           `$47,196` thousand | = operating `$5,133` + capital `$42,063`         |
| B1-1 Total functions and activities — expenses                                                                               |                          `$178,792` thousand | = printed (but see the $15 discrepancy below)    |
| B1-1 operating result                                                                                                        |                           `$36,669` thousand | = printed (but see the $15 discrepancy below)    |
| Statement of Comprehensive Income net result                                                                                 |                           `$36,654` thousand | = Income Statement net result                    |
| Note B3-4 total depreciation and amortisation costs                                                                          |                           `$30,119` thousand | = face depreciation line                         |

Total expenses is the printed face-statement bridge: the printed expenses-excluding-depreciation line
(`$148,688` thousand) plus the printed depreciation/amortisation/impairment line (`$30,119` thousand),
i.e. `$178,807` thousand, which equals printed total income (`$215,461` thousand) less the printed
operating result (`$36,654` thousand). It is **not** a sum of the nature components on its own and
**not** the B1-1 expense total. The audited B1-1 "Total functions and activities" row prints expenses
`$178,792` thousand and operating result `$36,669` thousand: a printed **$15 thousand
function-allocation discrepancy** (B1-1 expenses are $15 thousand lower and B1-1 operating result $15
thousand higher than the face statement). The connector requires the two differences to be equal in
magnitude/direction, records both in the reconciliation evidence, and uses the face statement as
authoritative for emitted total expenses and net result. The printed before-capital result is a
deficit of `$5,409` thousand; it is kept in the reconciliation evidence only and is not emitted as a
row.

**Rows.** 17 rows, source id `ryde-gpfs`, `source_dataset` "Council of the City of Ryde GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Council of the City of Ryde"` (the exact published entity
name in the audited statements), `data_quality_flag: "provisional/local_government"`, `verified:
false`. The minimum lines are total revenue `$215,461,000`, total expenses `$178,807,000`, employee
expenses `$65,215,000`, depreciation/amortisation/impairment `$30,119,000`, operating government grants
`$5,133,000`, capital government grants `$42,063,000`, net loss on disposal of assets `$17,882,000` and
net result `$36,654,000`; the printed face-statement revenue and expense components are included for
provenance. The `total_expenses` and `net_result` rows carry `human_spot_check: required` in their
notes, naming the printed `$15` thousand B1-1 function-allocation discrepancy (B1-1 expenses
`$178,792` thousand / operating result `$36,669` thousand vs face expenses `$178,807` thousand /
operating result `$36,654` thousand) that a human must reconcile before those two totals are treated
as final.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing same-entity
rows are preserved untouched and never summed: **1 uppercase AusTender contract** whose
`delivery_entity` is exactly "COUNCIL OF THE CITY OF RYDE" (the only case-insensitive exact row before
this ingest), plus **204 other rows** whose `delivery_entity` merely mentions Ryde under other strings
(AusTender, GrantConnect, ACNC, QGIP and data.nsw CKAN); their per-source counts are identical before
and after the ingest. All twenty-two other council GPFS sources are unchanged (Dubbo 18, City of
Sydney 18, Blacktown 17, Parramatta 17, Northern Beaches 18, Canterbury-Bankstown 17, Sutherland
Shire 17, Wollongong 17, Newcastle 17, Lake Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17,
Port Macquarie-Hastings 17, Tweed Shire 17, Shoalhaven 17, Shellharbour 17, Waverley 17, Willoughby
18, Inner West 18, Bayside 18, Randwick 17). Government grant rows carry `potential_double_count: true`
because they may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,819 → **515,836** (exactly +17); `ryde-gpfs` **17**;
`randwick-gpfs` still **17**; `bayside-gpfs` still **18**; `data-nsw-ckan` still **3,472**;
`dubbo-council` still **245**; exact case-insensitive "Council of the City of Ryde" rows 1 → **18**
(the new 17 plus the 1 pre-existing uppercase AusTender contract) and exact published-string rows 0 →
**17**; rows whose `delivery_entity` mentions Ryde 205 → **222**; `data_sources` 48 → **49**. A second
ingest run upserted the same 17 natural keys and left the DB total unchanged (idempotent); a later
in-place upsert added `human_spot_check: required` to the `total_expenses` and `net_result` notes and
left the row count and amounts unchanged. No deletes or updates to any other source.

---

---

### 7.24 Twenty-fourth council — North Sydney Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the council's official Financial Statements document listing
<https://www.northsydney.nsw.gov.au/downloads/download/265/financial-statements> (reached from the
Financial Statements directory record linked in the council sitemap). The listing's FY2024-25 link is
**"Financial Statements 2024-2025"**, a standalone PDF separate from the Annual Report, at
<https://www.northsydney.nsw.gov.au/downloads/file/4517/financial-statements-2024-2025>. The 83-page
PDF contains the **General Purpose Financial Statements** (Income Statement PDF p9, printed p4;
Statement of Comprehensive Income PDF p10, printed p5; B1-1 "Total functions and activities" PDF p18,
printed p13; and note B3-4 depreciation/impairment PDF p30, printed p25) together with the independent
auditor's reports on the financial statements. The statements were signed in accordance with a Council
resolution made on 13 October 2025.

The Financial Statements listing and file endpoints are protected by an **AWS WAF challenge**
(`x-amzn-waf-action: challenge`, HTTP 202). Plain Node `fetch` receives the challenge, and the
documented Playwright headless shell is rejected with HTTP 403 because its `sec-ch-ua` identifies
HeadlessChrome. The documented headless Chromium path using the full **Chromium channel** clears the
challenge; the connector parses the FY2024-25 financial-statements anchor from the cleared listing HTML
(no hard-coded PDF URL) and fetches the exact bytes through the cleared browser session. Exact bytes
archived outside the repo at
`~/ausspend-source-archive/north-sydney-gpfs/north-sydney-council-financial-statements-2024-25.pdf`:
**12,205,070 bytes**, SHA-256
`37c7de1f8114ff91b0a9643b5f607bdc21af5394ec7d54c14c55e90740d8d72f` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the income statement, B1-1, the comprehensive-income
statement and the depreciation note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The PDF text stream places the Original unaudited budget amount before each
Income Statement line label and the FY2024-25 actual immediately after it (followed by FY2023-24), so
each emitted value is the first amount after the printed label. The expense subtotal contains the
phrase "depreciation, amortisation and impairment of non-financial assets", so the actual depreciation
line is read from the last occurrence. B1-1 is laid out horizontally, so its printed total-column
values are read from the PDF coordinates rather than text order. The connector emits nothing unless all
of these agree exactly:

| Check                                                                                                                            |                            Printed / derived | Result                                           |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                       |                          `$154,580` thousand | = `$154,580,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income)     |                          `$154,580` thousand | = printed total                                  |
| B1-1 Total functions and activities — income                                                                                     |                          `$154,580` thousand | = face statement                                 |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal + net share of joint ventures) |                          `$108,992` thousand | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$30,411`)                               | `$108,992` + `$30,411` = `$139,403` thousand | = B1-1 expense total                             |
| B1-1 Total functions and activities — expenses                                                                                   |                          `$139,403` thousand | = `$139,403,000` (printed total)                 |
| Operating result / net operating result                                                                                          | `$154,580` − `$139,403` = `$15,177` thousand | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                        |                           `$15,177` thousand | = operating result                               |
| Net operating result before capital grants                                                                                       |    `$15,177` − `$13,909` = `$1,268` thousand | = printed before-capital surplus (evidence only) |
| B1-1 grants and contributions                                                                                                    |                           `$18,778` thousand | = operating `$4,869` + capital `$13,909`         |
| Statement of Comprehensive Income net result                                                                                     |                           `$15,177` thousand | = Income Statement net result                    |
| Note B3-4 depreciation and amortisation costs (`$29,086`) + gross IPPE impairment/revaluation decrement (`$1,325`)               |    `$29,086` + `$1,325` = `$30,411` thousand | = face depreciation/impairment line              |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$139,403`
thousand), which equals the printed face-statement bridge of expenses excluding depreciation
(`$108,992` thousand) plus depreciation/amortisation/impairment (`$30,411` thousand) and equals printed
total income (`$154,580` thousand) less the printed operating result (`$15,177` thousand). The B1-1
income, expense, operating-result and grants totals reconcile exactly to the face statement; there is
no printed discrepancy. The printed before-capital result is a surplus of `$1,268` thousand; it is kept
in the reconciliation evidence only and is not emitted as a row.

**Rows.** 18 rows, source id `north-sydney-gpfs`, `source_dataset` "North Sydney Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "North Sydney Council"` (the exact published entity name in
the audited statements), `data_quality_flag: "provisional/local_government"`, `verified: false`. The
minimum lines are total revenue `$154,580,000`, total expenses `$139,403,000`, employee expenses
`$48,080,000`, depreciation/amortisation/impairment `$30,411,000`, operating government grants
`$4,869,000`, capital government grants `$13,909,000`, net loss on disposal of assets `$883,000`, net
share of joint ventures `$1,000` and net result `$15,177,000`; the printed face-statement revenue and
expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing same-entity
rows are preserved untouched and never summed: **2 uppercase rows** whose `delivery_entity` is exactly
"NORTH SYDNEY COUNCIL" (the only case-insensitive exact rows before this ingest), plus **86 other
rows** whose `delivery_entity` merely mentions North Sydney under other strings (AusTender, GrantConnect,
ACNC, QGIP and data.nsw CKAN); their per-source counts are identical before and after the ingest. All
twenty-three other council GPFS sources are unchanged (Dubbo 18, City of Sydney 18, Blacktown 17,
Parramatta 17, Northern Beaches 18, Canterbury-Bankstown 17, Sutherland Shire 17, Wollongong 17,
Newcastle 17, Lake Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17, Port Macquarie-Hastings 17,
Tweed Shire 17, Shoalhaven 17, Shellharbour 17, Waverley 17, Willoughby 18, Inner West 18, Bayside 18,
Randwick 17, Ryde 17). Government grant rows carry `potential_double_count: true` because they may
overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,836 → **515,854** (exactly +18);
`north-sydney-gpfs` **18**; `ryde-gpfs` still **17**; `randwick-gpfs` still **17**; `data-nsw-ckan` still
**3,472**; `dubbo-council` still **245**; exact case-insensitive "North Sydney Council" rows 2 → **20**
(the new 18 plus the 2 pre-existing uppercase rows) and exact published-string rows 0 → **18**; rows
whose `delivery_entity` mentions North Sydney 88 → **106**; `data_sources` 49 → **50**. A second ingest
run upserted the same 18 natural keys and left the DB total unchanged (idempotent). No deletes or
updates to any other source.

---

### 7.25 Twenty-fifth council — City of Canada Bay Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from the council's official Our Reporting page
<https://www.canadabay.nsw.gov.au/council/about-council/our-reporting>. Canada Bay publishes its
audited financial reports **inside its Annual Report** each year; there is no separate Financial
Statements PDF on that page. The page's FY2024-25 link is **"Annual Report 2024-2025"**, at
<https://canadabay.t1cloud.com/T1Default/CiAnywhere/Web/CANADABAY/API/CMIS/PUB/content/?id=folder-8769276&streamId=streampdf-8769276>.
The 232-page PDF contains the **General Purpose Financial Statements** (Income Statement PDF p133,
printed p5; Statement of Comprehensive Income PDF p134, printed p6; B1-1 "Total functions and
activities" PDF p142, printed p14; and note B3-4 depreciation/impairment PDF p155, printed p27)
together with the independent auditor's reports on the financial statements (PDF p210 onward). The
statements were authorised for issue by Council on 16 October 2025.

The Our Reporting page and the records-management file endpoint are reachable with plain HTTP; no
WAF/challenge was encountered, so the connector uses the direct `fetch` path. It parses the
FY2024-25 Annual Report anchor from the official page HTML (no hard-coded PDF URL), downloads the
exact bytes, and re-verifies them. Exact bytes archived outside the repo at
`~/ausspend-source-archive/canada-bay-gpfs/canada-bay-council-annual-report-2024-25.pdf`:
**35,521,573 bytes**, SHA-256
`c83a0b579bf0f3bb493f154f2ef1cc089fe5490b844d5ad62d6ff0a400ab9776` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the income statement, B-1 statements,
comprehensive-income statement and depreciation note; a missing or conflicting unit rejects the
whole extraction.

**Exact reconciliation.** The PDF text stream places the Original unaudited budget amount before each
Income Statement line label and the FY2024-25 actual immediately after it (followed by FY2023-24), so
each emitted value is the first amount after the printed label. The expense subtotal contains the
phrase "depreciation, amortisation and impairment of non-financial assets", so the actual depreciation
line is read from the last occurrence. The connector emits nothing unless all of these agree exactly:

| Check                                                                                                                        |                            Printed / derived | Result                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                   |                          `$201,079` thousand | = `$201,079,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$201,079` thousand | = printed total                                  |
| B1-1 Total functions and activities — income                                                                                 |                          `$201,079` thousand | = face statement                                 |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                           |                          `$112,048` thousand | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$18,953`)                           | `$112,048` + `$18,953` = `$131,001` thousand | = B1-1 expense total                             |
| B1-1 Total functions and activities — expenses                                                                               |                          `$131,001` thousand | = `$131,001,000` (printed total)                 |
| Operating result / net operating result                                                                                      | `$201,079` − `$131,001` = `$70,078` thousand | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                    |                           `$70,078` thousand | = operating result                               |
| Net operating result before capital grants                                                                                   |    `$70,078` − `$66,670` = `$3,408` thousand | = printed before-capital surplus (evidence only) |
| B1-1 grants and contributions                                                                                                |                           `$73,190` thousand | = operating `$6,520` + capital `$66,670`         |
| Statement of Comprehensive Income net result                                                                                 |                           `$70,078` thousand | = Income Statement net result                    |
| Statement of Comprehensive Income total (`$70,078` + `$85,385` revaluation)                                                  |                          `$155,463` thousand | = printed total comprehensive income             |
| Note B3-4 total depreciation and amortisation costs                                                                          |                           `$18,953` thousand | = face depreciation/impairment line              |
| Note B3-4 total depreciation, amortisation and impairment for non-financial assets                                           |                           `$18,953` thousand | = face depreciation/impairment line              |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$131,001`
thousand), which equals the printed face-statement bridge of expenses excluding depreciation
(`$112,048` thousand) plus depreciation/amortisation/impairment (`$18,953` thousand) and equals printed
total income (`$201,079` thousand) less the printed operating result (`$70,078` thousand). The B1-1
income, expense, operating-result and grants totals reconcile exactly to the face statement; there is
no printed discrepancy. The printed before-capital result is a surplus of `$3,408` thousand; it is kept
in the reconciliation evidence only and is not emitted as a row.

**Rows.** 17 rows, source id `canada-bay-gpfs`, `source_dataset` "City of Canada Bay Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "City of Canada Bay Council"` (the exact published entity
name in the audited statements), `data_quality_flag: "provisional/local_government"`, `verified:
false`. The minimum lines are total revenue `$201,079,000`, total expenses `$131,001,000`, employee
expenses `$51,227,000`, depreciation/amortisation/impairment `$18,953,000`, operating government grants
`$6,520,000`, capital government grants `$66,670,000`, net loss on disposal of assets `$3,684,000` and
net result `$70,078,000`; the printed face-statement revenue and expense components are included for
provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing same-entity
rows are preserved untouched and never summed: **6 case-insensitive exact rows** whose
`delivery_entity` is "CITY OF CANADA BAY COUNCIL" / "City of Canada Bay Council" (2 uppercase
AusTender contracts, 1 uppercase GrantConnect grant and 3 exact-case GrantConnect grants) plus **6
other rows** whose `delivery_entity` merely mentions Canada Bay under other strings (AusTender,
GrantConnect, ACNC); their per-source counts are identical before and after the ingest. All
twenty-four other council GPFS sources are unchanged (Dubbo 18, City of Sydney 18, Blacktown 17,
Parramatta 17, Northern Beaches 18, Canterbury-Bankstown 17, Sutherland Shire 17, Wollongong 17,
Newcastle 17, Lake Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17, Port Macquarie-Hastings
17, Tweed Shire 17, Shoalhaven 17, Shellharbour 17, Waverley 17, Willoughby 18, Inner West 18, Bayside
18, Randwick 17, Ryde 17, North Sydney 18). Government grant rows carry `potential_double_count: true`
because they may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,854 → **515,871** (exactly +17);
`canada-bay-gpfs` **17**; all twenty-four other GPFS sources unchanged (North Sydney still 18, Ryde
still 17, Randwick still 17, Maitland still 7); `data-nsw-ckan` still **3,472**; `dubbo-council`
still **245**; case-insensitive exact "City of Canada Bay Council" rows 6 → **23** (the new 17 plus
the 6 pre-existing exact rows) and exact published-string rows 3 → **20**; rows whose
`delivery_entity` mentions Canada Bay 12 → **29**; `data_sources` 50 → **51**. A second ingest run
upserted the same 17 natural keys and left the DB total unchanged (idempotent). No deletes or updates
to any other source.

### 7.26 Twenty-sixth council — Cumberland City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Cumberland City Council's official Key council reports page
<https://www.cumberland.nsw.gov.au/key-council-reports>. The page links a dedicated **"Annual
Financial Statements 2024-2025"** PDF at
<https://www.cumberland.nsw.gov.au/sites/default/files/inline-files/cumberland-council-annual-financial-statements-2024-2025.pdf>
(the page also links the separate Annual Report 2024-2025, which the connector deliberately does not
select). The 108-page PDF contains the signed General Purpose Financial Statements — Income Statement
PDF p5 / printed p4; Statement of Comprehensive Income PDF p6 / printed p5; B1-1 "Total functions and
activities" PDF p14-15 / printed p13-14; note B3-3 depreciation PDF p28 / printed p27 — and the
independent auditor's reports on the financial statements. The statements were signed in accordance
with a Council resolution made on 29 October 2025.

The official page and PDF link are reachable with plain HTTP; no WAF challenge was encountered on the
successful requests, so the connector uses the direct `fetch` path (the CMS returned an intermittent
Varnish 403 for some user agents, but not for the documented direct fetch). It parses the FY2024-25
"Annual Financial Statements" anchor from the official page HTML (no hard-coded PDF URL), downloads
the exact bytes, and re-verifies them. Exact bytes archived outside the repo at
`~/ausspend-source-archive/cumberland-gpfs/cumberland-city-council-annual-financial-statements-2024-25.pdf`:
**7,165,368 bytes**, SHA-256
`4c1d003cd8a27e72e71c9ebd75bd80f1c67931ef551b4baa3d7c0010d4dc267e` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the Income Statement, Statement of Comprehensive
Income, B1-1 and depreciation note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The PDF text stream places the Original unaudited budget amount before each
Income Statement line label and the FY2024-25 actual immediately after it (followed by FY2023-24), so
each emitted value is the first amount after the printed label. The expense subtotal contains the
phrase "depreciation, amortisation and impairment of non-financial assets", so the actual depreciation
line is read from the last occurrence. The connector emits nothing unless all of these agree:

| Check                                                                                                                        |                            Printed / derived | Result                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                   |                          `$277,139` thousand | = `$277,139,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$277,139` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                           |                          `$193,611` thousand | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$48,954`)                           | `$193,611` + `$48,954` = `$242,565` thousand | = printed face-statement total expenses          |
| Total income `$277,139` − total expenses `$242,565`                                                                          |                           `$34,574` thousand | = printed operating result and net result        |
| B1-1 Total functions and activities — income                                                                                 |                          `$277,139` thousand | = face statement                                 |
| B1-1 Total functions and activities — expenses                                                                               |                          `$242,564` thousand | = `$242,564,000` (printed; `$1k` rounding)       |
| B1-1 Total functions and activities — operating result                                                                       |                           `$34,575` thousand | = printed (published `$1k` rounding vs face)     |
| B1-1 grants and contributions                                                                                                |                           `$42,410` thousand | = operating `$16,225` + capital `$26,185`        |
| Net operating result before capital grants                                                                                   |    `$34,574` − `$26,185` = `$8,389` thousand | = printed before-capital surplus (evidence only) |
| Statement of Comprehensive Income net result                                                                                 |                           `$34,574` thousand | = Income Statement net result                    |
| Statement of Comprehensive Income total (`$34,574` + `$48,015` revaluation)                                                  |                           `$82,589` thousand | = printed total comprehensive income             |
| Note B3-3 total depreciation and amortisation costs                                                                          |                           `$48,954` thousand | = face depreciation/amortisation/impairment line |
| Note B3-3 total depreciation, amortisation and impairment for non-financial assets                                           |                           `$48,954` thousand | = face depreciation/amortisation/impairment line |

Total expenses is the printed face-statement bridge of expenses excluding depreciation (`$193,611`
thousand) plus depreciation/amortisation/impairment (`$48,954` thousand) = `$242,565` thousand, which
equals printed total income (`$277,139` thousand) less the printed operating result (`$34,574`
thousand). The B1-1 "Total functions and activities" row prints expenses `$242,564` thousand and
operating result `$34,575` thousand — a published **$1 thousand** function-row rounding difference
from the face statement — which the connector accepts only at exactly that one-unit tolerance and
retains as reconciliation evidence; B1-1 income and grants reconcile exactly. The printed before-capital
result is a surplus of `$8,389` thousand; it is kept in the reconciliation evidence only and is not
emitted as a row.

**Rows.** 17 rows, source id `cumberland-gpfs`, `source_dataset` "Cumberland City Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`, `jurisdiction:
"NSW"`, `delivery_entity: "Cumberland City Council"` (the exact published entity name in the audited
statements), `data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines
are total revenue `$277,139,000`, total expenses `$242,565,000`, employee expenses `$95,814,000`,
depreciation/amortisation/impairment `$48,954,000`, operating government grants `$16,225,000`, capital
government grants `$26,185,000`, net loss on disposal of assets `$261,000` and net result
`$34,574,000`; the printed face-statement revenue and expense components are included for provenance.
The `total_expenses` and `net_result` rows carry `human_spot_check: required` in their notes, naming
the published `$1` thousand B1-1 function-row rounding (B1-1 expenses `$242,564` thousand / operating
result `$34,575` thousand vs face expenses `$242,565` thousand / operating result `$34,574` thousand)
that a human must reconcile before those two totals are treated as final.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing same-entity
rows are preserved untouched and never summed: before this ingest there were **no rows** whose
`delivery_entity` was exactly "Cumberland City Council"; **6 case-insensitive exact "Cumberland
Council" rows** (1 uppercase GrantConnect grant and 5 exact-case GrantConnect grants) and **33 other
rows** whose `delivery_entity` merely mentions Cumberland under other strings (AusTender, GrantConnect,
ACNC, data.nsw) keep their per-source counts identical before and after. All twenty-five other council
GPFS sources are unchanged (Dubbo 18, City of Sydney 18, Blacktown 17, Parramatta 17, Northern Beaches
18, Canterbury-Bankstown 17, Sutherland Shire 17, Wollongong 17, Newcastle 17, Lake Macquarie 17,
Maitland 7, Coffs Harbour 17, MidCoast 17, Port Macquarie-Hastings 17, Tweed Shire 17, Shoalhaven 17,
Shellharbour 17, Waverley 17, Willoughby 18, Inner West 18, Bayside 18, Randwick 17, Ryde 17, North
Sydney 18, Canada Bay 17). Government grant rows carry `potential_double_count: true` because they may
overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,871 → **515,888** (exactly +17); `cumberland-gpfs`
**17**; all twenty-five other GPFS sources unchanged (Canada Bay still 17, North Sydney still 18,
Ryde still 17, Maitland still 7); `data-nsw-ckan` still **3,472**; `dubbo-council` still **245**;
case-insensitive exact "Cumberland City Council" rows 0 → **17** and case-insensitive exact
"Cumberland Council" rows still **6**; rows whose `delivery_entity` mentions Cumberland 39 → **56**;
`data_sources` 51 → **52**. A second ingest run upserted the same 17 natural keys and left the DB
total unchanged (idempotent). No deletes or updates to any other source.

---

### 7.27 Twenty-seventh council — Georges River Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Georges River Council's official Other Corporate Documents page
<https://www.georgesriver.nsw.gov.au/Council/Publications/Other-Corporate-Documents> (reached from
the Publications page). The page links a dedicated **"Audited Financial Statement and Auditors Report
for 1 July 2024 - 30 June 2025"** PDF at
<https://www.georgesriver.nsw.gov.au/StGeorge/media/Documents/Council/Publications/Audited-Financial-Statements-and-Auditors-Report-2024-2025.PDF>
(the Annual Reports page also links the separate Annual Report 2024-2025, which the connector
deliberately does not select). The 91-page PDF contains the signed General Purpose Financial
Statements — Income Statement PDF p5 / printed p4; Statement of Comprehensive Income PDF p6 /
printed p5; B1-1 "Total functions and activities" PDF p14 / printed p13; note B3-3 depreciation PDF
p26 / printed p25 — and the independent auditor's reports on the financial statements, including the
Report on the Conduct of the Audit (PDF p76-77). The statements were signed in accordance with a
Council resolution made on 29 October 2025; the Auditor-General's delegate signed the opinion on
31 October 2025.

The official page and PDF link are reachable with plain HTTP (page and PDF both HTTP 200); no WAF
challenge was encountered, so the connector uses the direct `fetch` path. It parses the FY2024-25
"Audited Financial Statement" anchor from the official page HTML (no hard-coded PDF URL), downloads
the exact bytes, and re-verifies them. Exact bytes archived outside the repo at
`~/ausspend-source-archive/georges-river-gpfs/georges-river-council-audited-financial-statements-2024-25.pdf`:
**2,589,670 bytes**, SHA-256
`97a46898f9fe5a0e2e8ea6e15817562217cfa6568bbdf7825f8d72a4da856a9f` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the Income Statement, Statement of Comprehensive
Income, B1-1 and depreciation note; a missing or conflicting unit rejects the whole extraction.

**Exact reconciliation.** The PDF text stream places the Original unaudited budget amount before each
Income Statement line label and the FY2024-25 actual immediately after it (followed by the restated
FY2023-24), so each emitted value is the first amount after the printed label. The expense subtotal
contains the phrase "depreciation, amortisation and impairment of non-financial assets", so the
actual depreciation line is read from the last occurrence. The printed borrowing-costs line is a nil
dash for FY2024-25, so it is not emitted and contributes zero to the bridge. The connector emits
nothing unless all of these agree:

| Check                                                                                                                        |                            Printed / derived | Result                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------: | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                   |                          `$204,366` thousand | = `$204,366,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) |                          `$204,366` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + other + net loss on disposal; printed borrowing costs nil)          |                          `$154,656` thousand | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$30,773`)                           | `$154,656` + `$30,773` = `$185,429` thousand | = printed B1-1 total expenses                    |
| B1-1 Total functions and activities — income                                                                                 |                          `$204,366` thousand | = face statement                                 |
| B1-1 Total functions and activities — expenses                                                                               |                          `$185,429` thousand | = `$185,429,000` (printed total)                 |
| B1-1 Total functions and activities — operating result                                                                       |                           `$18,937` thousand | = face net result                                |
| B1-1 grants and contributions                                                                                                |                           `$21,135` thousand | = operating `$7,653` + capital `$13,482`         |
| Operating result / net operating result                                                                                      | `$204,366` − `$185,429` = `$18,937` thousand | = printed operating result                       |
| Net operating result before capital grants                                                                                   |    `$18,937` − `$13,482` = `$5,455` thousand | = printed before-capital surplus (evidence only) |
| Statement of Comprehensive Income net result                                                                                 |                           `$18,937` thousand | = Income Statement net result                    |
| Statement of Comprehensive Income total (`$18,937` + `$60,495` other comprehensive income)                                   |                           `$79,432` thousand | = printed total comprehensive income             |
| Note B3-3 total depreciation, amortisation and impairment for non-financial assets                                           |                           `$30,773` thousand | = face depreciation/amortisation/impairment line |
| Independent auditor's Report on the Conduct of the Audit — narrative total expenses                                          |                             `$185.5` million | ≠ `$185.429` million GPFS/B1-1; see below        |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$185,429`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$154,656` thousand) plus printed
depreciation/amortisation/impairment (`$30,773` thousand), and equals printed total income
(`$204,366` thousand) less the printed operating result (`$18,937` thousand). The B1-1 income,
expenses, operating result and grants all reconcile exactly to the face statement — there is **no
face-vs-B1-1 discrepancy**. The printed before-capital result is a surplus of `$5,455` thousand; it is
kept in the reconciliation evidence only and is not emitted as a row.

**Internal printed discrepancy (retained, not silently reconciled).** The independent auditor's
Report on the Conduct of the Audit in the same audited PDF prints total expenses of **`$185.5`
million** in its narrative, versus the GPFS face statement and B1-1 **`$185,429` thousand
(`$185.429` million)** — a printed difference of about `$71` thousand. The connector records both
figures in the reconciliation evidence and adds `human_spot_check: required` to the `total_expenses`
and `net_result` notes, naming the `$185.5` million vs `$185,429` thousand printed narrative
difference. It does not force the narrative into agreement with the statements.

**Rows.** 16 rows, source id `georges-river-gpfs`, `source_dataset` "Georges River Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Georges River Council"` (the exact published entity name in
the audited statements), `data_quality_flag: "provisional/local_government"`, `verified: false`. The
minimum lines are total revenue `$204,366,000`, total expenses `$185,429,000`, employee expenses
`$70,638,000`, depreciation/amortisation/impairment `$30,773,000`, operating government grants
`$7,653,000`, capital government grants `$13,482,000`, net loss on disposal of assets `$2,141,000` and
net result `$18,937,000`; the printed face-statement revenue and expense components are included for
provenance. The printed nil borrowing-costs line is not emitted. The `total_expenses` and `net_result`
rows carry `human_spot_check: required` in their notes, naming the printed `$185.5` million
conduct-report narrative versus the `$185,429` thousand GPFS/B1-1 total.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: before this ingest there were **no rows**
whose `delivery_entity` was exactly "Georges River Council"; **1 uppercase AusTender contract** whose
string is exactly "GEORGES RIVER COUNCIL" (the only case-insensitive exact row) and **21 other rows**
whose `delivery_entity` merely mentions Georges River under other strings (8 GrantConnect, 8 ACNC,
5 data.nsw) keep their per-source counts identical before and after. All twenty-six other council
GPFS sources are unchanged (Dubbo 18, City of Sydney 18, Blacktown 17, Parramatta 17, Northern
Beaches 18, Canterbury-Bankstown 17, Sutherland Shire 17, Wollongong 17, Newcastle 17, Lake
Macquarie 17, Maitland 7, Coffs Harbour 17, MidCoast 17, Port Macquarie-Hastings 17, Tweed Shire 17,
Shoalhaven 17, Shellharbour 17, Waverley 17, Willoughby 18, Inner West 18, Bayside 18, Randwick 17,
Ryde 17, North Sydney 18, Canada Bay 17, Cumberland 17). Government grant rows carry
`potential_double_count: true` because they may overlap government program data; they are not added
to expenditure.

**Database evidence (2026-11-18).** `measures` 515,888 → **515,904** (exactly +16);
`georges-river-gpfs` **16**; all twenty-six other GPFS sources unchanged (Cumberland still 17, Canada
Bay still 17, North Sydney still 18, Maitland still 7); `data-nsw-ckan` still **3,472**;
`dubbo-council` still **245**; exact-case "Georges River Council" rows 0 → **16** and
case-insensitive exact rows 1 → **17**; rows whose `delivery_entity` mentions Georges River 22 →
**38**; `data_sources` 52 → **53**. A second ingest run upserted the same 16 natural keys and left
the DB total unchanged (idempotent). No deletes or updates to any other source.

### 7.28 Twenty-eighth council — Fairfield City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Fairfield City Council's official Corporate Reports page
<https://www.fairfieldcity.nsw.gov.au/Your-Council/Integrated-Planning-and-Reporting/Corporate-Reports>
(the Archived Reports page links the same document). The page links a dedicated **"2024-2025 Financial
Statements"** PDF at
<https://www.fairfieldcity.nsw.gov.au/files/assets/public/v/1/documents/your-council/ipr/annual-report/2024-2025-annual-report-audited-financial-statements.pdf>
(anchor title `2024-2025-Annual-Report-Audited-Financial-Statements.pdf`; the separate "2024-2025
Annual Report" combined PDF is deliberately not selected). The 92-page PDF contains the signed General
Purpose Financial Statements — Income Statement PDF p6 / printed p4; Statement of Comprehensive Income
PDF p7 / printed p5; B1-1 "Total functions and activities" PDF p19 / printed p17; note B3-3
depreciation PDF p32 / printed p30 — and the independent auditor's reports on the financial
statements, including the Report on the Conduct of the Audit (PDF p77 / printed p75). The
Auditor-General's delegate signed the opinion on 22 October 2025.

The official page and PDF are reachable with plain HTTP (page and PDF both HTTP 200); no WAF
challenge was encountered, so the connector uses the direct `fetch` path. It parses the FY2024-25
audited financial statements anchor from the official page HTML (no hard-coded PDF URL), downloads the
exact bytes, and re-verifies them. Exact bytes archived outside the repo at
`~/ausspend-source-archive/fairfield-gpfs/fairfield-city-council-audited-financial-statements-2024-25.pdf`:
**17,656,220 bytes**, SHA-256
`0a864880b393e03b7888d2e9d0bffb62e852682d0d291553a54e0f4e67fe75c5` (`hash_verified: true`). The
printed unit is explicit `$ '000` (thousands) on the Income Statement, Statement of Comprehensive
Income, B1-1 and depreciation note; a missing or conflicting unit rejects the whole extraction.

**Layout note.** Unlike the earlier council PDFs, Fairfield's text stream groups all row labels before
all amounts (the Original unaudited budget column, then Actual 2025, then restated Actual 2024). The
adapter therefore reconstructs printed rows from the PDF text-item coordinates and reads the middle
(Actual 2025) column of each printed line; it never sums a page's components to obtain a printed
total.

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                               |                                                                                 Printed / derived | Result                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------: | ---------------------------------------------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                                          |                                                                               `$269,959` thousand | = `$269,959,000`                                                             |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) |                                                                               `$269,959` thousand | = printed total                                                              |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses)                                                          |                                                                               `$169,491` thousand | = printed expenses excluding depreciation                                    |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$38,287`)                                                  |                                                      `$169,491` + `$38,287` = `$207,778` thousand | = printed B1-1 total expenses                                                |
| B1-1 Total functions and activities — income                                                                                                        |                                                                               `$269,959` thousand | = face statement                                                             |
| B1-1 Total functions and activities — expenses                                                                                                      |                                                                               `$207,778` thousand | = `$207,778,000` (printed total)                                             |
| B1-1 Total functions and activities — operating result                                                                                              |                                                                                `$62,181` thousand | = face net result                                                            |
| B1-1 grants and contributions                                                                                                                       |                                                                                `$83,593` thousand | = operating `$24,944` + capital `$58,649`                                    |
| Operating result / net operating result                                                                                                             |                                                      `$269,959` − `$207,778` = `$62,181` thousand | = printed operating result                                                   |
| Operating result before depreciation                                                                                                                |                                                     `$269,959` − `$169,491` = `$100,468` thousand | = printed before-depreciation result (evidence only)                         |
| Net operating result before capital grants                                                                                                          |                                                         `$62,181` − `$58,649` = `$3,532` thousand | = printed before-capital surplus (evidence only)                             |
| Statement of Comprehensive Income net result                                                                                                        |                                                                                `$62,181` thousand | = Income Statement net result                                                |
| Statement of Comprehensive Income total (`$62,181` − `$81,048` other comprehensive income)                                                          |                                                                               `−$18,867` thousand | = printed total comprehensive income                                         |
| Note B3-3 total depreciation, amortisation and impairment for non-financial assets                                                                  |                                                                                `$38,287` thousand | = face depreciation/amortisation/impairment line                             |
| Independent auditor's Report on the Conduct of the Audit — rounded narrative                                                                        | operating result `$62.2m`, grants `$83.6m`, revenue excl. grants `$186.4m`, depreciation `$38.3m` | all agree within printed $0.1m rounding; no total-expenses figure is printed |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$207,778`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$169,491` thousand) plus printed
depreciation/amortisation/impairment (`$38,287` thousand), and equals printed total income
(`$269,959` thousand) less the printed operating result (`$62,181` thousand). The B1-1 income,
expenses, operating result and grants reconcile exactly to the face statement — there is **no
face-vs-B1-1 discrepancy**. The printed borrowing-costs line (`$166` thousand) and the printed net
gain from the disposal of assets (`$609` thousand) are non-nil and are emitted. The printed
before-capital result (`$3,532` thousand) is kept in the reconciliation evidence only and is not
emitted as a row.

**Internal printed narrative check (no discrepancy).** The independent auditor's Report on the
Conduct of the Audit rounds the operating result to `$62.2` million, grants and contributions revenue
to `$83.6` million, revenue excluding grants to `$186.4` million and depreciation to `$38.3` million.
Each rounds to the corresponding GPFS figure within the printed one-decimal-million tolerance; the
report prints no narrative total-expenses figure. No internal printed discrepancy affecting total
expenses or the net result was found, so the `total_expenses` and `net_result` notes record that no
human spot check is required. The connector retains any future narrative difference beyond rounding
and would flag the affected rows rather than silently reconcile them.

**Rows.** 17 rows, source id `fairfield-gpfs`, `source_dataset` "Fairfield City Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Fairfield City Council"` (the exact published entity name in
the audited statements), `data_quality_flag: "provisional/local_government"`, `verified: false`. The
minimum lines are total revenue `$269,959,000`, total expenses `$207,778,000`, employee expenses
`$93,091,000`, depreciation/amortisation/impairment `$38,287,000`, operating government grants
`$24,944,000`, capital government grants `$58,649,000`, borrowing costs `$166,000`, net gain on
disposal of assets `$609,000` and net result `$62,181,000`; the printed face-statement revenue and
expense components are included for provenance. The printed before-capital result is not emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing
same-entity rows are preserved untouched and never summed: before this ingest there were **2 rows**
whose `delivery_entity` is exactly "Fairfield City Council" (both GrantConnect grants), **1 uppercase
AusTender contract** whose string is exactly "FAIRFIELD CITY COUNCIL" (the only extra
case-insensitive exact row) and **97 other rows** whose `delivery_entity` merely mentions Fairfield
under other strings (schools, charities, suppliers, etc.); their per-source counts are identical
before and after. All twenty-seven other council GPFS sources are unchanged. Government grant rows
carry `potential_double_count: true` because they may overlap government program data; they are not
added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,904 → **515,921** (exactly +17);
`fairfield-gpfs` **17**; all twenty-seven other GPFS sources unchanged (Georges River still 16,
Cumberland still 17, Maitland still 7); `data-nsw-ckan` still **3,472**; `dubbo-council` still
**245**; exact-case "Fairfield City Council" rows 2 → **19** and case-insensitive exact rows 3 →
**20**; rows whose `delivery_entity` mentions Fairfield 97 → **114**; `data_sources` 53 → **54**. A
second ingest run upserted the same 17 natural keys and left the DB total unchanged (idempotent). No
deletes or updates to any other source.

### 7.29 Twenty-ninth council — Liverpool City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Liverpool City Council's official Finance Reports page
<https://www.liverpool.nsw.gov.au/council/corporate-information/finance-reports>. The page heads each
year's table with a printed "Financial Year 2024/2025" cell and lists the audited document under the
repeated link text **"Audited Financial Statement"**. The FY2024-25 link is
<https://www.liverpool.nsw.gov.au/__data/assets/pdf_file/0009/282717/Annual-Financial-Statements-2025-Final-signed-with-Audit-Opinion.pdf>
(anchor text `Audited Financial Statement`; the prior-year rows under the same page link
`Annual-Financial-Statements-2024-Grand-Finale.pdf` and are deliberately not selected). The official
page and PDF sit behind a Cloudflare managed challenge that returns **HTTP 403** to non-browser
clients ("Just a moment..."), so the documented headless Chromium path
(`scripts/liverpool-gpfs-browser.ts`) clears the challenge, saves the cleared HTML and downloads the
exact PDF bytes. The connector still parses the PDF link from that HTML (no hard-coded document URL)
and SHA-256 re-verifies the bytes.

The 124-page PDF (printed "Page x of 121") contains the signed General Purpose Financial Statements —
Income Statement PDF p18 / printed p16; Statement of Comprehensive Income PDF p19 / printed p17; B1-1
"Total functions and activities" PDF p29 / printed p27; note B3-4 depreciation PDF p44 / printed
p42 — and the independent auditor's reports, including the Report on the Conduct of the Audit (PDF
p107-108 / printed p105-106). The printed unit is explicit `$ '000` on the Income Statement,
Statement of Comprehensive Income, B1-1 and note B3-4; a missing or conflicting unit rejects the
whole extraction.

Exact bytes archived outside the repo at
`~/ausspend-source-archive/liverpool-gpfs/liverpool-city-council-audited-financial-statements-2024-25.pdf`:
**9,940,306 bytes**, SHA-256
`89848112c7768239780f363d7f34785acab11326bc6d0312e7f1c229ba1a048d` (`hash_verified: true`). The
cleared listing HTML and an `archive-meta.json` are stored alongside it.

**Layout note.** Liverpool prints each row's label and its three amounts on the same printed line
(Original unaudited budget, then Actual 2025, then Actual 2024; note references sit between the label
and the actual column). The adapter groups text items by y, reads the Actual 2025 column by its x
band, and never sums a page's components to obtain a printed total. The B1-1 total row is a normal
line with five column pairs; the adapter reads the FY2024-25 income, expenses, operating-result and
grants values by their printed order and never sums the six function rows.

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                               |                                                                                                                                           Printed / derived | Result                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                          |                                                                                                                                         `$380,226` thousand | = `$380,226,000`                                                                     |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) |                                                                                                                                         `$380,226` thousand | = printed total                                                                      |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses)                                                          |                                                                                         `$107,576` + `$101,845` + `$9,452` + `$5,479` = `$224,352` thousand | = printed expenses excluding depreciation                                            |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$55,138`)                                                  |                                                                                                                `$224,352` + `$55,138` = `$279,490` thousand | = printed B1-1 total expenses                                                        |
| B1-1 Total functions and activities — income                                                                                                        |                                                                                                                                         `$380,226` thousand | = face statement                                                                     |
| B1-1 Total functions and activities — expenses                                                                                                      |                                                                                                                                         `$279,490` thousand | = `$279,490,000` (printed total)                                                     |
| B1-1 Total functions and activities — operating result                                                                                              |                                                                                                                                         `$100,736` thousand | = face net result                                                                    |
| B1-1 grants and contributions                                                                                                                       |                                                                                                                                         `$132,469` thousand | = operating `$21,295` + capital `$111,174`                                           |
| Operating result / net operating result                                                                                                             |                                                                                                               `$380,226` − `$279,490` = `$100,736` thousand | = printed operating result                                                           |
| Operating result before depreciation                                                                                                                |                                                                                                               `$380,226` − `$224,352` = `$155,874` thousand | = printed before-depreciation result (evidence only)                                 |
| Net operating result before capital grants                                                                                                          |                                                                                                               `$100,736` − `$111,174` = `−$10,438` thousand | = printed before-capital deficit (evidence only)                                     |
| Statement of Comprehensive Income net result                                                                                                        |                                                                                                                                         `$100,736` thousand | = Income Statement net result                                                        |
| Statement of Comprehensive Income total (`$100,736` + `$108,293` other comprehensive income)                                                        |                                                                                                                                         `$209,029` thousand | = printed total comprehensive income                                                 |
| Note B3-4 total depreciation, amortisation and impairment for non-financial assets                                                                  |                                                                                                                                          `$55,138` thousand | = face depreciation/amortisation/impairment line                                     |
| Independent auditor's Report on the Conduct of the Audit — rounded narrative                                                                        | operating result `$100.7m`, grants `$132.5m`, revenue `$380.2m`, depreciation `$55.1m`, expenses-excluding-depreciation `$224.4m`, before-capital `−$10.4m` | all agree within printed $0.1m rounding; no numeric total-expenses figure is printed |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$279,490`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$224,352` thousand) plus printed
depreciation/amortisation/impairment (`$55,138` thousand), and equals printed total income
(`$380,226` thousand) less the printed operating result (`$100,736` thousand). The B1-1 income,
expenses, operating result and grants reconcile exactly to the face statement — there is **no
face-vs-B1-1 discrepancy**.

**Internal printed narrative inconsistency (human spot check required).** The independent auditor's
Report on the Conduct of the Audit rounds the figures consistently with the GPFS, but it labels the
`$224.4 million` operating-expenses-excluding-depreciation subtotal **"Other expenses"**. The Income
Statement's own "Other expenses" line is `$5,479` thousand; the `$224.4 million` figure actually equals
the printed expenses-excluding-depreciation subtotal (`$224,352` thousand), not total expenses. This
is a printed narrative **label** inconsistency, not a numeric difference in total expenses or the net
result: every printed total still reconciles exactly. Per the ingestion rule, the connector does not
silently reconcile it — it records the inconsistency in the reconciliation evidence and adds
`human_spot_check: required` to the `total_expenses`, `total_expenses_excluding_depreciation` and
`net_result` notes (total expenses `$279,490` thousand; net result `$100,736` thousand), so a human
confirms how the narrative presentation should be read before the affected total is treated as final.
The connector retains any future narrative numeric difference beyond the printed one-decimal-million
rounding tolerance the same way.

**Rows.** 17 rows, source id `liverpool-gpfs`, `source_dataset` "Liverpool City Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Liverpool City Council"` (the exact published entity name in
the audited statements), `data_quality_flag: "provisional/local_government"`, `verified: false`. The
minimum lines are total revenue `$380,226,000`, total expenses `$279,490,000`, employee expenses
`$107,576,000`, depreciation/amortisation/impairment `$55,138,000`, operating government grants
`$21,295,000`, capital government grants `$111,174,000`, borrowing costs `$9,452,000`, net gain on
disposal of assets `$3,632,000` and net result `$100,736,000`; the printed face-statement revenue and
expense components are included for provenance. The nil 2025 "Net loss from the disposal of assets"
line and the printed before-capital deficit are not emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing same-entity
rows are preserved untouched and never summed: before this ingest there were **2 rows** whose
`delivery_entity` is exactly "Liverpool City Council" (1 GrantConnect grant and 1 AusTender contract),
**5 case-insensitive exact rows** (those 2 plus 1 more uppercase AusTender contract, 1 uppercase
GrantConnect grant and 1 uppercase AusTender contract) and **91 other rows** whose `delivery_entity`
merely mentions Liverpool under other strings (schools, charities, suppliers, etc.); their per-source
counts are identical before and after. All twenty-eight other council GPFS sources are unchanged.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,921 → **515,938** (exactly +17);
`liverpool-gpfs` **17**; all twenty-eight other GPFS sources unchanged (Fairfield still 17, Georges
River still 16, Cumberland still 17, dubbo-council-gpfs still 18); `data-nsw-ckan` still **3,472**;
`dubbo-council` still **245**; exact-case "Liverpool City Council" rows 2 → **19** and
case-insensitive exact rows 5 → **22**; rows whose `delivery_entity` mentions Liverpool 91 → **108**;
`data_sources` 54 → **55**. A second ingest run upserted the same 17 natural keys and left the DB
total unchanged (idempotent). No deletes or updates to any other source.

### 7.30 Thirtieth council — Ku-ring-gai Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Ku-ring-gai Council's official Finance page
<https://www.krg.nsw.gov.au/Council/Strategic-plans-finance-reports-and-publications/Finance>. The page
lists the audited document under the printed link text **"Financial statements 2024-2025"** (a future
"Financial statements 2025-2026" entry sits above it and is deliberately not selected). The FY2024-25
link is
<https://www.krg.nsw.gov.au/files/assets/public/v/1/hptrim/information-management-publications-public-website-ku-ring-gai-council-website-council/annual-financial-statements-for-the-year-ending-30-06-2025.pdf>.
The official page returns **HTTP 403** to non-browser clients, so the documented headless Chromium path
(`scripts/ku-ring-gai-gpfs-browser.ts`) loads the page, saves the cleared HTML and downloads the exact
PDF bytes. The connector still parses the PDF link from that HTML (no hard-coded document URL) and
SHA-256 re-verifies the bytes.

The 98-page PDF (printed "Page x of 76") contains the signed General Purpose Financial Statements —
Income Statement PDF p7 / printed p5; Statement of Comprehensive Income PDF p8 / printed p6; B1-1
"Total functions and activities" PDF p16 / printed p14; note B3-4 depreciation PDF p27 / printed p25 —
and the independent auditor's reports, including the Report on the Conduct of the Audit (PDF p71-72 /
printed p69-70). The printed unit is explicit `$ '000` on the Income Statement, Statement of
Comprehensive Income, B1-1 and note B3-4; a missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo at
`~/ausspend-source-archive/ku-ring-gai-gpfs/ku-ring-gai-council-annual-financial-statements-2024-25.pdf`:
**2,141,582 bytes**, SHA-256
`5af98c1ac3e9def0dbbb6bdbdb596e5e2f5be9d88ace71a4047730c6112d40be` (`hash_verified: true`). The
cleared Finance HTML and the `source_documents` metadata JSON are stored alongside it.

**Layout note.** Ku-ring-gai prints each row's Original unaudited budget amount to the **left** of the
printed label and the Actual 2025 / Actual 2024 columns to its right. The adapter groups text items by
y, reads the Actual 2025 column by its x band, and never sums a page's components to obtain a printed
total. The B1-1 total row prints five column pairs; the adapter reads the FY2024-25 income, expenses,
operating-result and grants values by their printed x order and never sums the six function rows.

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                               |                                                                                                                                                 Printed / derived | Result                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                                          |                                                                                                                                               `$182,600` thousand | = `$182,600,000`                                                                                                                                                                                              |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) |                                                                                                                                               `$182,600` thousand | = printed total                                                                                                                                                                                               |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses)                                                          |                                                                                                 `$51,963` + `$75,053` + `$1,173` + `$5,352` = `$133,541` thousand | = printed expenses excluding depreciation                                                                                                                                                                     |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$27,062`)                                                  |                                                                                                                      `$133,541` + `$27,062` = `$160,603` thousand | = printed B1-1 total expenses                                                                                                                                                                                 |
| B1-1 Total functions and activities — income                                                                                                        |                                                                                                                                               `$182,600` thousand | = face statement                                                                                                                                                                                              |
| B1-1 Total functions and activities — expenses                                                                                                      |                                                                                                                                               `$160,603` thousand | = `$160,603,000` (printed total)                                                                                                                                                                              |
| B1-1 Total functions and activities — operating result                                                                                              |                                                                                                                                                `$21,997` thousand | = face net result                                                                                                                                                                                             |
| B1-1 grants and contributions                                                                                                                       |                                                                                                                                                `$26,502` thousand | = operating `$8,459` + capital `$18,043`                                                                                                                                                                      |
| Operating result / net operating result                                                                                                             |                                                                                                                      `$182,600` − `$160,603` = `$21,997` thousand | = printed operating result                                                                                                                                                                                    |
| Operating result before depreciation                                                                                                                |                                                                                                                      `$182,600` − `$133,541` = `$49,059` thousand | = printed before-depreciation result (evidence only)                                                                                                                                                          |
| Net operating result before capital grants                                                                                                          |                                                                                                                         `$21,997` − `$18,043` = `$3,954` thousand | = printed before-capital surplus (evidence only)                                                                                                                                                              |
| Statement of Comprehensive Income net result                                                                                                        |                                                                                                                                                `$21,997` thousand | = Income Statement net result                                                                                                                                                                                 |
| Statement of Comprehensive Income total (`$21,997` + `$48,118` other comprehensive income)                                                          |                                                                                                                                                `$70,115` thousand | = printed total comprehensive income                                                                                                                                                                          |
| Note B3-4 "Total depreciation, amortisation and impairment costs expensed"                                                                          |                                                                                                                                                `$27,062` thousand | = face depreciation/amortisation/impairment line                                                                                                                                                              |
| Independent auditor's Report on the Conduct of the Audit — one-decimal-million table                                                                | operating result `21.9`, rates `103.5`, operating grants `8.4`, capital grants `18.0`, depreciation `27.06`, materials and services `75.1`, before-capital `3.94` | numeric values agree with the GPFS within the printed one-decimal-million rounding tolerance except the operating-result and operating-grants truncations recorded below; no total-expenses figure is printed |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$160,603`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$133,541` thousand) plus printed
depreciation/amortisation/impairment (`$27,062` thousand), and equals printed total income
(`$182,600` thousand) less the printed operating result (`$21,997` thousand). The B1-1 income,
expenses, operating result and grants reconcile exactly to the face statement — there is **no
face-vs-B1-1 discrepancy**.

**Internal printed narrative discrepancy (human spot check required).** The auditor's Report on the
Conduct of the Audit prints a one-decimal-million table in which the 2025 operating result is `21.9`,
but the same page's prose says the result was `$0.31 million higher` than the 2023–24 `21.7` (which
implies `22.0`) and its own prior-two-year graph prints `21.99`; the GPFS prints `21,997` thousand. The
operating-grants line is similarly printed `8.4` while the GPFS prints `8,459` thousand (which rounds to
`8.5`). These are internal printed truncation/rounding inconsistencies in the narrative, not
differences in the audited face statement, B1-1, comprehensive-income or note B3-4 totals, which
reconcile exactly. Per the ingestion rule the connector does not silently reconcile them — it records
them in the reconciliation evidence and adds `human_spot_check: required` to the `total_expenses`,
`total_expenses_excluding_depreciation` and `net_result` notes (total expenses `$160,603` thousand;
net result `$21,997` thousand), so a human confirms how the narrative presentation should be read
before the affected total is treated as final.

**Rows.** 17 rows, source id `ku-ring-gai-gpfs`, `source_dataset` "Ku-ring-gai Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Ku-ring-gai Council"` (the exact published entity name in
the audited statements), `data_quality_flag: "provisional/local_government"`, `verified: false`. The
minimum lines are total revenue `$182,600,000`, total expenses `$160,603,000`, employee expenses
`$51,963,000`, depreciation/amortisation/impairment `$27,062,000`, operating government grants
`$8,459,000`, capital government grants `$18,043,000`, borrowing costs `$1,173,000`, net gain on
disposal of assets `$3,675,000` and net result `$21,997,000`; the printed face-statement revenue and
expense components are included for provenance. The nil 2025 "Net loss from the disposal of assets"
line and the printed before-capital surplus are not emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows or any other council. The pre-existing same-entity
rows are preserved untouched and never summed: before this ingest there was **1 row** whose
`delivery_entity` is exactly "Ku-ring-gai Council" (a GrantConnect grant) and **1 uppercase
"KU-RING-GAI COUNCIL" GrantConnect grant** (2 case-insensitive exact rows), plus **58 other rows**
whose `delivery_entity` merely mentions Ku-ring-gai under other strings (29 GrantConnect, 27 ACNC,
1 data.nsw and 1 AusTender); their per-source counts are identical before and after. All twenty-nine
other council GPFS sources are unchanged. Government grant rows carry `potential_double_count: true`
because they may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** `measures` 515,938 → **515,955** (exactly +17);
`ku-ring-gai-gpfs` **17**; all twenty-nine other GPFS sources unchanged (Liverpool still 17, Fairfield
still 17, Georges River still 16, Cumberland still 17, dubbo-council-gpfs still 18); `data-nsw-ckan`
still **3,472**; `dubbo-council` still **245**; exact-case "Ku-ring-gai Council" rows 1 → **18** and
case-insensitive exact rows 2 → **19**; rows whose `delivery_entity` mentions Ku-ring-gai 58 → **75**;
`data_sources` 55 → **56**. A second ingest run upserted the same 17 natural keys and left the DB
total unchanged (idempotent). No deletes or updates to any other source.

### 7.31 Thirty-first council — Strathfield Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Strathfield Council's official Reports and Registers page
<https://www.strathfield.nsw.gov.au/Council/Reports-and-Registers>. The page lists the audited
document under the printed link text **"Annual Financial Statement 2024 - 2025 (PDF, 5MB)"**; the
FY2024-25 link is
<https://www.strathfield.nsw.gov.au/files/assets/public/v/1/council/reports-and-registers/strathfield-municipal-council-financial-statements-2024-25-final.pdf>.
The connector discovers that link from the page HTML (no hard-coded document URL) and SHA-256
re-verifies the bytes. The printed unit is explicit `$ '000` on the Income Statement (PDF p6 /
printed p4), Statement of Comprehensive Income (PDF p7 / printed p5) and B1-1 (PDF p15 / printed
p13); a missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo at
`~/ausspend-source-archive/strathfield-gpfs/strathfield-municipal-council-financial-statements-2024-25-final.pdf`:
**5,070,919 bytes**, SHA-256
`90295cd968382d7b8249b7a1a01829526a39f00262ad3f5bc7d56cf58a5a67ee` (`hash_verified: true`).

**Exact reconciliation.** The income statement prints the Original unaudited budget column before
the line label and the Actual 2025 / Actual 2024 columns after it; the adapter reads the first amount
after each printed label as the FY2024-25 actual. It emits nothing unless all of these agree:

| Check                                                                                                                       |                                                         Printed / derived | Result                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------: | ------------------------------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                  |                                                        `$73,908` thousand | = `$73,908,000`                                               |
| Revenue components sum (rates + user charges + other revenue + operating grants + capital grants + interest + other income) |                                                        `$73,908` thousand | = printed total                                               |
| Expense-by-nature components sum (employee + materials + borrowing + other + net loss on disposal)                          | `$30,090` + `$24,085` + `$504` + `$1,346` + `$2,939` = `$58,964` thousand | = printed expenses excluding depreciation                     |
| Printed expenses excluding depreciation + printed depreciation/amortisation (`$10,906`)                                     |                                `$58,964` + `$10,906` = `$69,870` thousand | = printed B1-1 total expenses                                 |
| B1-1 Total functions and activities — income / expenses / operating result                                                  |                                 `$73,908` / `$69,870` / `$4,038` thousand | = face statement                                              |
| B1-1 grants and contributions                                                                                               |                                                        `$17,674` thousand | = operating `$3,163` + capital `$14,511`                      |
| Operating result / net operating result                                                                                     |                                 `$73,908` − `$69,870` = `$4,038` thousand | = printed operating result and net result                     |
| Net operating result before capital grants                                                                                  |                               `$4,038` − `$14,511` = `($10,473)` thousand | = printed before-capital deficit (evidence only; not emitted) |
| Statement of Comprehensive Income net result / other comprehensive income / total                                           |                                 `$4,038` + `$26,195` = `$30,233` thousand | = printed totals                                              |
| Notes B3-1 employee / B3-2 materials / B3-3 borrowing / B3-4 depreciation / B3-5 other                                      |            `$30,090` / `$24,085` / `$504` / `$10,906` / `$1,346` thousand | = face lines                                                  |
| Note B2-4 operating / capital grants                                                                                        |                                             `$3,163` / `$14,511` thousand | = face grants lines                                           |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$69,870`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$58,964` thousand) plus printed
depreciation/amortisation (`$10,906` thousand), and equals printed total income (`$73,908`
thousand) less the printed operating result (`$4,038` thousand). There is no face-vs-B1-1
discrepancy. The printed negative before-capital result (`($10,473)` thousand) is reconciliation
evidence only because the measure model stores a non-negative net-result magnitude.

**Rows.** 17 rows, source id `strathfield-gpfs`, `source_dataset` "Strathfield Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Strathfield Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$73,908,000`, total expenses `$69,870,000`, employee expenses `$30,090,000`,
depreciation/amortisation `$10,906,000`, operating government grants `$3,163,000`, capital
government grants `$14,511,000`, net loss on disposal `$2,939,000` and net result `$4,038,000`; the
printed face-statement revenue and expense components are included for provenance. B1-1's function
split is not emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into any other council or state rows. The pre-existing same-entity rows are preserved untouched:
before this ingest there were **2 rows** whose `delivery_entity` case-insensitively equals
"Strathfield Council" (1 exact-case GrantConnect grant and 1 uppercase AusTender contract), plus 1
ACNC charity row and 1 NSW Budget project that merely mention Strathfield under other strings. All
other GPFS sources are unchanged. Government grant rows carry `potential_double_count: true`
because they may overlap government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** Claim-time `measures` **693,096** (`strathfield-gpfs` 0,
`mosman-gpfs` 0, `lane-cove-gpfs` 0). Immediately before this ingest, concurrent workers had added
Lane Cove's 17 rows, taking the total to **693,113**; after this ingest it is **693,148**
(**+35** = Strathfield **+17** + concurrent Mosman **+18**). `strathfield-gpfs` **17**; all other
sources have delta 0 apart from those two concurrent council ingests; `data_sources` 67 → **68**.
A second run upserted the same 17 natural keys and left the DB total unchanged (idempotent). No
deletes or updates to any other source.

### 7.32 Thirty-second council — Lane Cove Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Lane Cove publishes no standalone GPFS PDF. The audited FY2024-25 General Purpose
Financial Statements are Section 3 of the official **Annual Report 2024-25** PDF, linked from the
official Community Strategic Plan page
<https://www.lanecove.nsw.gov.au/Council/Plans-and-Publications/Community-Strategic-Plan> under the
printed link text **"Annual Report"**. That link is a council TRIM document link,
<http://ecouncil.lanecove.nsw.gov.au/trim/DocumentLink.asp?RecId=84401/25>, which returns a small HTML
page whose JavaScript redirect resolves to the exact PDF. The connector discovers the document-link
URL from the page HTML (never a hard-coded PDF URL), resolves the PDF URL from the TRIM redirect, and
SHA-256 re-verifies the exact bytes. The TRIM path segment is a volatile internal document id, so the
natural key binds to the archived SHA-256, not the URL; re-running is idempotent even when the id
changes.

The 218-page Annual Report contains the signed GPFS — Income Statement PDF p89 (printed p4), Statement
of Comprehensive Income p90 (printed p5), B1-1 "Functions or activities" p99 (printed p14) and note
B3-3 depreciation p110 (printed p25) — plus the independent auditor's reports. The printed unit is
explicit `$ '000` on the Income Statement, Statement of Comprehensive Income, B1-1 and note B3-3; a
missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo at
`$AUSSPEND_SOURCE_ARCHIVE/lane-cove-gpfs/lane-cove-council-annual-report-2024-25.pdf` (pool run:
`~/ausspend-source-archive/lane-cove-gpfs/...` (or the pool `$AUSSPEND_SOURCE_ARCHIVE` root)): **12,880,333 bytes**,
SHA-256 `460b964d9f8fe85aa7c3e98b80b5a56c01fe6b2401f723ecbd8fd4b31f8c7206` (`hash_verified: true`).
The `source_documents` metadata JSON is stored alongside it.

**Layout note.** Lane Cove prints each row's Original unaudited budget amount to the left of the
printed label and the Actual 2025 / Actual 2024 columns to its right; the adapter groups text items by
y and reads the Actual 2025 column by its x band. The B1-1 note is **transposed** relative to the
usual OLG layout: functions run across columns and the categories (Income, Expenses, Operating result,
Grants and contributions) are rows, with a "Total functions and activities" total column at x≈273.
The adapter reads each category's 2025 total from that column (nearest the row label) and never sums
the function columns.

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                           | Printed / derived                                                                                         | Result                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                                      | `$97,804` thousand                                                                                        | = `$97,804,000`                                      |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net share of JVs) | `$41,575` + `$6,013` + `$4,844` + `$4,716` + `$21,921` + `$4,344` + `$14,383` + `$8` = `$97,804` thousand | = printed total                                      |
| Expense-by-nature components sum (employee + materials + other expenses + net loss on disposal)                                                 | `$22,773` + `$29,413` + `$2,043` + `$3,826` = `$58,055` thousand                                          | = printed expenses excluding depreciation            |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$10,924`)                                              | `$58,055` + `$10,924` = `$68,979` thousand                                                                | = printed B1-1 total expenses                        |
| B1-1 Total functions and activities — income                                                                                                    | `$97,804` thousand                                                                                        | = face statement                                     |
| B1-1 Total functions and activities — expenses                                                                                                  | `$68,979` thousand                                                                                        | = `$68,979,000` (printed total)                      |
| B1-1 Total functions and activities — operating result                                                                                          | `$28,825` thousand                                                                                        | = face net result                                    |
| B1-1 grants and contributions                                                                                                                   | `$26,637` thousand                                                                                        | = operating `$4,716` + capital `$21,921`             |
| Operating result / net operating result                                                                                                         | `$97,804` − `$68,979` = `$28,825` thousand                                                                | = printed operating result                           |
| Operating result before depreciation                                                                                                            | `$97,804` − `$58,055` = `$39,749` thousand                                                                | = printed before-depreciation result (evidence only) |
| Net operating result before capital grants                                                                                                      | `$28,825` − `$21,921` = `$6,904` thousand                                                                 | = printed before-capital surplus (evidence only)     |
| Statement of Comprehensive Income net result                                                                                                    | `$28,825` thousand                                                                                        | = Income Statement net result                        |
| Statement of Comprehensive Income total (`$28,825` + `$1,329` other comprehensive income)                                                       | `$30,154` thousand                                                                                        | = printed total comprehensive income                 |
| Note B3-3 "Total depreciation, amortisation and impairment of non-financial assets"                                                             | `$10,924` thousand                                                                                        | = face depreciation/amortisation/impairment line     |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$68,979`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$58,055` thousand) plus printed
depreciation/amortisation/impairment (`$10,924` thousand), and equals printed total income
(`$97,804` thousand) less the printed operating result (`$28,825` thousand). The B1-1 income,
expenses, operating result and grants reconcile exactly to the face statement — there is **no
face-vs-B1-1 discrepancy**.

**Rows.** 17 rows, source id `lane-cove-gpfs`, `source_dataset` "Lane Cove Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Lane Cove Council"` (the exact published entity name),
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$97,804,000`, total expenses `$68,979,000`, employee expenses `$22,773,000`,
depreciation/amortisation/impairment `$10,924,000`, operating government grants `$4,716,000`,
capital government grants `$21,921,000`, net share of joint-venture revenue `$8,000`, net loss on
disposal of assets `$3,826,000` and net result `$28,825,000`; the printed face-statement revenue and
expense components are included for provenance. The printed before-capital surplus and the nil 2025
net-share-of-JV expense line are not emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
After the ingest the only rows whose `delivery_entity` is exactly "Lane Cove Council" are these 17 GPFS
rows; the 100 pre-existing ACNC/GrantConnect/data.nsw rows whose `delivery_entity` merely mentions
Lane Cove under other strings are preserved untouched and never summed. Government grant rows carry
`potential_double_count: true` because they may overlap government program data; they are not added to
expenditure.

**Database evidence (2026-11-18, shared dev DB snapshot at ingest).** `measures` 693,096 → **693,113**
(exactly +17); `lane-cove-gpfs` **17**; the per-source count diff showed **no other source increased or
decreased** and no rows were deleted; `data_sources` records the source `active` with
`records_ingested: 17`. A second ingest run upserted the same 17 SHA-anchored natural keys and left the
DB total unchanged (idempotent). The shared dev DB continued to move afterwards because other council
GPFS sources are ingested concurrently; that movement is outside this source and does not affect the
`lane-cove-gpfs` count.

---

### 7.33 Thirty-third council — Mosman Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Mosman Council's official Financial Reports page
<https://mosman.nsw.gov.au/council/reports/financial>. The page lists the audited document under the
printed link text **"Financial Statements for the Year Ended 30 June 2025"**. The FY2024-25 PDF is
<https://mosman.nsw.gov.au/sites/default/files/2025-10/Annual_Financial_Statements%20%28Audited%29-FY2024-2025%20FINAL_LR.pdf>.
The connector parses that link from the official page HTML (no hard-coded document URL) and
SHA-256 re-verifies the bytes.

The 80-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6 /
printed p4; Statement of Comprehensive Income PDF p7 / printed p5; B1-1 "Total functions and
activities" PDF p15 / printed p13; note B2-4 grants and contributions PDF p20-21 / printed p18-19;
note B3-1 employee benefits PDF p24 / printed p22; note B3-2 materials and services PDF p25 / printed
p23; note B3-3 depreciation PDF p26 / printed p24; note B3-4 other expenses PDF p27 / printed p25 —
plus the independent auditor's reports. The printed unit is explicit `$ '000` on every statement and
note used; a missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo at
`~/ausspend-source-archive/mosman-gpfs/mosman-council-annual-financial-statements-2024-25.pdf`:
**3,428,056 bytes**, SHA-256
`8ff17c938962730603daee3515d3d6bd4ae8451230276b8404f5cbfb28c66faf` (`hash_verified: true`).

**Layout note.** Mosman's Income Statement prints the Original unaudited budget column first, the
FY2024-25 Actual column second and the FY2023-24 column third, with each row's label and amounts on
the same printed line. The adapter reads the first amount after each printed label as the FY2024-25
actual and never sums a page's components to obtain a printed total.

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                                                                                                              |                                                                                                                                    Printed / derived | Result                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------: | -------------------------------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                                                                                                                         |                                                                                                                                   `$63,160` thousand | = `$63,160,000`                                                |
| Revenue components sum (rates `$32,821` + user charges `$10,124` + other revenues `$5,022` + operating grants `$3,213` + capital grants `$3,154` + interest `$1,674` + other income `$6,939` + net share of joint ventures `$213`) |                                                                                                                                   `$63,160` thousand | = printed total                                                |
| Expense-by-nature components sum (employee `$19,986` + materials `$23,064` + borrowing `$213` + other expenses `$3,793` + net loss on disposal `$371`)                                                                             |                                                                                                                                   `$47,427` thousand | = printed expenses excluding depreciation                      |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$6,939`)                                                                                                                                  |                                                                                                            `$47,427` + `$6,939` = `$54,366` thousand | = face-statement expense bridge                                |
| B1-1 Total functions and activities — income                                                                                                                                                                                       |                                                                                                                                   `$63,161` thousand | = `$1` thousand above the face total (printed rounding)        |
| B1-1 Total functions and activities — expenses                                                                                                                                                                                     |                                                                                                                                   `$54,367` thousand | = printed total expenses (`$1` thousand above the face bridge) |
| B1-1 Total functions and activities — operating result                                                                                                                                                                             |                                                                                                                                    `$8,794` thousand | = face operating result                                        |
| B1-1 grants and contributions                                                                                                                                                                                                      |                                                                                                                                    `$6,367` thousand | = operating `$3,213` + capital `$3,154`                        |
| Operating result ignoring depreciation                                                                                                                                                                                             |                                                                                                           `$63,160` − `$47,427` = `$15,733` thousand | = printed operating result before depreciation                 |
| Operating result / net operating result                                                                                                                                                                                            |                                                                                                             `$15,733` − `$6,939` = `$8,794` thousand | = printed net result                                           |
| Net operating result before capital grants                                                                                                                                                                                         |                                                                                                              `$8,794` − `$3,154` = `$5,640` thousand | = printed before-capital result (evidence only)                |
| Statement of Comprehensive Income net result                                                                                                                                                                                       |                                                                                                                                    `$8,794` thousand | = Income Statement net result                                  |
| Statement of Comprehensive Income total (`$8,794` + `$41,444` revaluation)                                                                                                                                                         |                                                                                                                                   `$50,238` thousand | = printed total comprehensive income                           |
| Notes B2-4, B3-1, B3-2, B3-3 and B3-4 totals                                                                                                                                                                                       | operating grants `$3,213`, capital grants `$3,154`, employee `$19,986`, materials `$23,064`, depreciation `$6,939`, other expenses `$3,793` thousand | = their face lines                                             |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$54,367`
thousand), **not** a sum of the nature components on its own. It is `$1` thousand above the printed
face-statement bridge (`$54,366` thousand), and B1-1 total income is `$1` thousand above the face
total income; both statements nevertheless print the same operating result and net result `$8,794`
thousand. These are printed inter-statement rounding differences. The connector records both printed
totals in the reconciliation evidence and adds `human_spot_check: required` to the `total_revenue`,
`total_expenses` and `net_result` notes; it never silently reconciles them.

**Rows.** 18 rows, source id `mosman-gpfs`, `source_dataset` "Mosman Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Mosman Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$63,160,000`, total expenses `$54,367,000`, employee expenses `$19,986,000`,
depreciation/amortisation/impairment `$6,939,000`, operating government grants `$3,213,000`, capital
government grants `$3,154,000`, borrowing costs `$213,000`, net loss on disposal of assets `$371,000`
and net result `$8,794,000`; the printed face-statement revenue and expense components are included
for provenance. The printed before-capital result is reconciliation evidence only and is not emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, the data.nsw LGA-tagged state rows or any other
council. Government grant rows carry `potential_double_count: true` because they may overlap
government program data; they are not added to expenditure.

**Database evidence (2026-11-18).** Claim-time live DB: `measures` **693,096**; `mosman-gpfs` **0**;
`data_sources` **66**. There were **0** rows whose `delivery_entity` was exactly "Mosman Council",
**0** case-insensitive exact rows, and **91** rows whose `delivery_entity` merely mentions "Mosman"
(including 6 GrantConnect rows for "Mosman Municipal Council"; none is the council's GPFS). The
concurrent Strathfield GPFS landed before this ingest, so the immediate pre-ingest snapshot was
`measures` **693,113** / `data_sources` **67** / `mosman-gpfs` **0**. Immediately after the Mosman
ingest: `measures` 693,113 → **693,131** (exactly +18); `mosman-gpfs` **18**; `data_sources` 67 →
**68**; every other source count unchanged (including `hunters-hill-gpfs` **21**,
`strathfield-gpfs` **17**, `ku-ring-gai-gpfs` **17**, `liverpool-gpfs` **17**, `fairfield-gpfs`
**17**, `georges-river-gpfs` **16**, `cumberland-gpfs` **17**, `dubbo-council-gpfs` **18**,
`data-nsw-ckan` **3,472** and `dubbo-council` **245**); exact-case "Mosman Council" rows 0 → **18**;
rows whose `delivery_entity` mentions Mosman 91 → **109**. A second ingest run upserted the same 18
natural keys and left `mosman-gpfs` at 18 and the total at 693,131. A concurrent Lane Cove GPFS
subsequently added 17 rows (`measures` 693,148, `data_sources` 69); no source count decreased. No
deletes or updates to any other source were performed by this item.

### 7.34 Thirty-fourth council — Hawkesbury City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Hawkesbury City Council's official Financial Statement page
<https://www.hawkesbury.nsw.gov.au/your-council/corporate-publications/financial-statement>. The page
prints "Redirecting you to the latest Financial Statement..." and carries a small
`setTimeout("self.location = '<pdf>'", 500)` redirect to the latest standalone audited statements PDF.
The FY2024-25 PDF is
<https://www.hawkesbury.nsw.gov.au/_resources/publications/publications/delivery-program-and-resourcing-strategies/Hawkesbury-Financial-Statements-Ended-30-June-2025.pdf>.
The site is behind a Cloudflare challenge that returns **HTTP 403** to non-browser clients, so the
documented headless Chromium path loads the page and downloads the exact bytes; the connector parses
the PDF URL from that page's own redirect (no hard-coded document URL) and SHA-256 re-verifies the
bytes.

The 123-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6
(printed p5), Statement of Comprehensive Income p7 (printed p6), B1-1 "Functions or activities" p16
(printed p15) and note B3-4 depreciation p31 (printed p30) — plus the independent auditor's reports.
The printed unit is explicit `$ '000` on the Income Statement, Statement of Comprehensive Income, B1-1
and note B3-4; a missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo at
`$AUSSPEND_SOURCE_ARCHIVE/hawkesbury-gpfs/hawkesbury-city-council-financial-statements-2024-25.pdf`:
**7,286,177 bytes**, SHA-256
`aa9d6bb361bc3653be8e8f930edc93a79eea21c333395bde23b137d89c7e6b7d` (`hash_verified: true`).

**Discontinued operation.** FY2024-25 has a material discontinued operation (the sewer business). The
continuing operations print total income `$230,424` thousand and total expenses `$130,704` thousand
(the printed B1-1 figure, equal to the face bridge of expenses excluding depreciation `$101,359`
thousand plus depreciation `$29,345` thousand), giving a continuing operating result of `$99,720`
thousand. The discontinued operation prints a `$(153,870)` thousand result, so the statutory "Net
operating result for the year attributable to Council" is `$(54,150)` thousand. Both printed result
lines are emitted so the statutory net result bridges explicitly; total revenue and total expenses
remain the printed **continuing-operations** totals. The printed before-capital result
(`$(137,399)` thousand) contains the discontinued operation and a `$102` thousand grant
reclassification, so it is **not** used as a simple net-result-minus-capital-grants check.

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                        | Printed / derived                                                                                   | Result                                                          |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                   | `$230,424` thousand                                                                                 | = `$230,424,000`                                                |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$72,501` + `$7,969` + `$3,026` + `$51,611` + `$83,145` + `$5,572` + `$6,600` = `$230,424` thousand | = printed total                                                 |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal)            | `$39,389` + `$36,537` + `$1,300` + `$8,962` + `$15,171` = `$101,359` thousand                       | = printed expenses excluding depreciation                       |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$29,345`)                           | `$101,359` + `$29,345` = `$130,704` thousand                                                        | = printed B1-1 total expenses                                   |
| B1-1 Total functions and activities — income                                                                                 | `$230,424` thousand                                                                                 | = face statement                                                |
| B1-1 Total functions and activities — expenses                                                                               | `$130,704` thousand                                                                                 | = `$130,704,000` (printed total)                                |
| B1-1 Total functions and activities — operating result                                                                       | `$99,720` thousand                                                                                  | = face continuing result                                        |
| B1-1 grants and contributions                                                                                                | `$134,756` thousand                                                                                 | = operating `$51,611` + capital `$83,145`                       |
| Continuing operating result                                                                                                  | `$230,424` − `$130,704` = `$99,720` thousand                                                        | = printed continuing operating result                           |
| Discontinued-operations result                                                                                               | `$(153,870)` thousand                                                                               | = printed discontinued result                                   |
| Statutory net operating result                                                                                               | `$99,720` − `$153,870` = `$(54,150)` thousand                                                       | = printed net result attributable to Council                    |
| Continuing result before depreciation                                                                                        | `$230,424` − `$101,359` = `$129,065` thousand                                                       | = printed continuing before-depreciation result (evidence only) |
| Statement of Comprehensive Income net result                                                                                 | `$(54,150)` thousand                                                                                | = Income Statement statutory net result                         |
| Statement of Comprehensive Income total (`$(54,150)` + `$53,499` other comprehensive income)                                 | `$(651)` thousand                                                                                   | = printed total comprehensive income                            |
| Note B3-4 "Total depreciation, amortisation and impairment of non-financial assets"                                          | `$29,345` thousand                                                                                  | = face depreciation/amortisation/impairment line                |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$130,704`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$101,359` thousand) plus printed
depreciation/amortisation/impairment (`$29,345` thousand), and equals printed total income
(`$230,424` thousand) less the printed continuing operating result (`$99,720` thousand). The B1-1
income, expenses, operating result and grants reconcile exactly to the continuing face statement —
there is **no face-vs-B1-1 discrepancy**.

**Rows.** 19 rows, source id `hawkesbury-gpfs`, `source_dataset` "Hawkesbury City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Hawkesbury City Council"` (the exact published entity name),
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$230,424,000`, total expenses `$130,704,000`, employee expenses `$39,389,000`,
depreciation/amortisation/impairment `$29,345,000`, operating government grants `$51,611,000`,
capital government grants `$83,145,000`, borrowing costs `$1,300,000`, net loss on disposal of assets
`$15,171,000`, continuing operating result `$99,720,000`, discontinued-operations result
`$(153,870,000)` and statutory net result `$(54,150,000)`. The negative result rows are stored as
non-negative magnitudes with `gpfs_printed_sign: "negative"`. The printed before-capital result is not
emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database evidence (2026-11-18, shared dev DB snapshot at ingest).** `measures` 693,177 → **693,196**
(exactly +19); `hawkesbury-gpfs` **19**; the per-source count diff showed **no other source increased
or decreased** and no rows were deleted; `data_sources` records the source `active` with
`records_ingested: 19`. A second ingest run upserted the same 19 SHA-anchored natural keys and left the
DB total unchanged (idempotent).

### 7.35 Thirty-fifth council — Woollahra Municipal Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Woollahra Municipal Council's official Annual Report page
<https://www.woollahra.nsw.gov.au/Council/Vision-structure-and-financial-sustainability/Integrated-planning-and-reporting/Annual-Report>.
The FY2024-25 audited statements are published as Annual Report Part 3:
<https://www.woollahra.nsw.gov.au/files/assets/public/v/2/council/documents/annual-report-fy24-25-part-3.pdf>.
The 83-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6 /
printed p4; Statement of Comprehensive Income PDF p7 / printed p5; B1-1 "Total functions and
activities" PDF p15 / printed p13 — plus the independent auditor's reports. The printed unit is
explicit `$ '000`; a missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo at
`~/ausspend-source-archive/woollahra-gpfs/woollahra-annual-report-2024-25-part-3-general-purpose-financial-statements.pdf`
for this run: **5,812,977 bytes**, SHA-256
`f92a0e41248573b4a71b417229d74b6c652039716fb1d4f216a7c316779f738b` (`hash_verified: true`). The
source archive is outside the repository and the bytes are not redistributed.

**Exact reconciliation.** The connector emits nothing unless all of these agree: revenue components
sum to the printed `$139,592` thousand total income; expense components sum to the printed
`$113,216` thousand expenses excluding depreciation; `$113,216` + printed
depreciation/amortisation/impairment `$16,413` = printed B1-1 total expenses `$129,629` thousand;
B1-1 total income `$139,592`, operating result `$9,963` and the comprehensive-income net result
`$9,963` all equal the face statement. The 11 printed B1-1 function expense lines sum exactly to
`$129,629` thousand. Total expenses is the printed B1-1 total, never a sum of components on its own.

**Rows.** 29 rows, source id `woollahra-gpfs`, `source_dataset` "Woollahra Municipal Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Woollahra Municipal Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. Printed lines include total
revenue `$139,592,000`, total expenses `$129,629,000`, employee expenses `$52,968,000`,
depreciation/amortisation/impairment `$16,413,000`, operating government grants `$4,615,000`,
capital government grants `$8,612,000`, net result `$9,963,000`, and the 11 B1-1 expense/service
functions. Government grant rows carry `potential_double_count: true`.

**No double count.** Every row is `aggregation_role: "agency_detail"`, has no `region_id`/LGA
allocation and is never summed with another council or with state rows. Other sources were preserved
untouched: the claim-time and immediate pre-ingest `measures` baseline was **693,148**, rising to
**693,177** after this ingest — exactly **+29** `woollahra-gpfs` rows — with every other per-source
count identical and no deletions. The concurrent Hawkesbury landing later took the live total to
**693,196**. A second ingest run upserted the same 29 natural keys and left the DB total unchanged
(idempotent).

---

### 7.36 Thirty-sixth council — Blue Mountains City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Blue Mountains City Council's official document page
<https://www.bmcc.nsw.gov.au/documents/annual-financial-statements-2024-2025>, which links the
published audited statements PDF
<https://www.bmcc.nsw.gov.au/sites/default/files/docs/BMCC%20Annual%20Financial%20Statements%202024-2025.PDF>.
The connector parses that page's own PDF link (no hard-coded document URL) and SHA-256 re-verifies the
exact bytes. The page and PDF are served directly to a normal HTTP client (HTTP 200); no browser
challenge was needed.

The 94-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6
(printed p4), Statement of Comprehensive Income p7 (printed p5), B1-1 "Functions or activities" p15
(printed p13) and note B3-4 depreciation p26 (printed p24) — plus the independent auditor's report.
The printed unit is explicit `$ '000` on the Income Statement, Statement of Comprehensive Income, B1-1
and note B3-4; a missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo at
`$AUSSPEND_SOURCE_ARCHIVE/blue-mountains-gpfs/blue-mountains-city-council-financial-statements-2024-25.pdf`:
**4,655,953 bytes**, SHA-256
`dacf018515b03b5807d18c9ced8009e287b8501bd16324998442d52677f04b2a` (`hash_verified: true`).

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                                          | Printed / derived                                                                                    | Result                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                                     | `$185,382` thousand                                                                                  | = `$185,382,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income)                                   | `$99,124` + `$23,339` + `$4,904` + `$16,417` + `$36,045` + `$3,940` + `$1,613` = `$185,382` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal)                                              | `$78,134` + `$49,604` + `$1,341` + `$8,151` + `$1,496` = `$138,726` thousand                         | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$21,298`)                                                             | `$138,726` + `$21,298` = `$160,024` thousand                                                         | = printed B1-1 total expenses                    |
| B1-1 Total functions and activities — income                                                                                                                   | `$185,382` thousand                                                                                  | = face statement                                 |
| B1-1 Total functions and activities — expenses                                                                                                                 | `$160,024` thousand                                                                                  | = `$160,024,000` (printed total)                 |
| B1-1 Total functions and activities — operating result                                                                                                         | `$25,358` thousand                                                                                   | = face operating result                          |
| B1-1 grants and contributions                                                                                                                                  | `$52,462` thousand                                                                                   | = operating `$16,417` + capital `$36,045`        |
| B1-1 function expense split (Lead `$43,744` + Protect `$14,021` + Care `$50,580` + Live `$7,527` + Move `$38,422` + Thrive `$5,730`; Non specific printed nil) | `$160,024` thousand                                                                                  | = printed B1-1 total expenses                    |
| Operating result from continuing operations                                                                                                                    | `$185,382` − `$160,024` = `$25,358` thousand                                                         | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                                                      | `$25,358` thousand                                                                                   | = printed net result (no discontinued operation) |
| Statement of Comprehensive Income net result                                                                                                                   | `$25,358` thousand                                                                                   | = Income Statement net result                    |
| Statement of Comprehensive Income total (`$25,358` + `$20,904` other comprehensive income)                                                                     | `$46,262` thousand                                                                                   | = printed total comprehensive income             |
| Note B3-4 "Total depreciation, amortisation and impairment for non-financial assets"                                                                           | `$21,298` thousand                                                                                   | = face depreciation/amortisation/impairment line |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$160,024`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$138,726` thousand) plus printed
depreciation/amortisation/impairment (`$21,298` thousand), and equals printed total income
(`$185,382` thousand) less the printed operating result (`$25,358` thousand). B1-1 income, expenses,
operating result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1
discrepancy**. There is no discontinued operation, so the operating result and net result are the same
printed line.

**Rows.** 23 rows, source id `blue-mountains-gpfs`, `source_dataset` "Blue Mountains City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Blue Mountains City Council"` (the exact published entity
name), `data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are
total revenue `$185,382,000`, total expenses `$160,024,000`, employee expenses `$78,134,000`,
depreciation/amortisation/impairment `$21,298,000`, operating government grants `$16,417,000`, capital
government grants `$36,045,000`, borrowing costs `$1,341,000`, net loss on disposal of assets
`$1,496,000` and net result `$25,358,000`. The six non-nil printed B1-1 service expenses (Lead,
Protect, Care, Live, Move, Thrive) are emitted as a separate `b1_1_function_expenses_*` cut of the
same printed total; the "Non specific" expense is printed nil and is not emitted as a zero row.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The six B1-1 service rows are a second cut of the same total
expenses and are never added to the nature-of-expense rows. The pre-existing same-entity rows are
preserved untouched and never summed.

**Database evidence (2026-11-18, shared DB).** `blue-mountains-gpfs` has **23** rows and
`data_sources` records the source `active` with `records_ingested: 23`; the live total is **693,237**,
which also includes the concurrent Wollondilly ingest (18 `wollondilly-gpfs` rows). The Blue Mountains
per-source count is exactly 23 and no Blue Mountains rows were deleted. A second ingest run upserts the
same 23 SHA-anchored natural keys (idempotent). Targeted connector tests passed (15/15).

### 7.37 Thirty-seventh council — Wollondilly Shire Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Wollondilly Shire Council's official "Council's Financial Statements" page
<https://www.wollondilly.nsw.gov.au/council/corporate-planning-and-reporting/councils-financial-statements>.
The page links both the current audited statements and the prior years plus a public-notice PDF; the
connector selects only the link whose filename resolves to FY2024-25 and whose host is the council's
own site or its document CDN (never a hard-coded document URL, and never a non-council host). The
FY2024-25 PDF is
<https://wollondilly.cdn.greenhousecreative.au/assets/Documents-NEW/Council/Corporate-Planning-and-Reporting/Wollondilly-Shire-Council-Audited-Financial-Statements-30.06.2025.pdf>.

The 90-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6, B1-1 "Functions or activities" p14 and note B3-4 depreciation
p26 — plus the independent auditor's reports. The printed unit is explicit `$ '000` on the Income
Statement, Statement of Comprehensive Income, B1-1 and note B3-4; a missing or conflicting unit
rejects the whole extraction.

Exact bytes archived outside the repo at
`$AUSSPEND_SOURCE_ARCHIVE/wollondilly-gpfs/wollondilly-shire-council-audited-financial-statements-2024-25.pdf`:
**5,688,694 bytes**, SHA-256 `4a2a1d83641a3a9695fb904293662a8ac9431228e2ac2d6f65997fb31062e5ff`
(`hash_verified: true`).

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                               | Printed / derived                                                                                        | Result                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Total income from continuing operations (Income Statement)                                                                                          | `$149,464` thousand                                                                                      | = `$149,464,000`                                                |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$63,314` + `$9,706` + `$2,496` + `$9,694` + `$57,370` + `$6,057` + `$768` + `$59` = `$149,464` thousand | = printed total                                                 |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses)                                                          | `$41,688` + `$35,465` + `$3,505` + `$1,711` = `$82,369` thousand                                         | = printed expenses excluding depreciation                       |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$23,468`)                                                  | `$82,369` + `$23,468` = `$105,837` thousand                                                              | = printed B1-1 total expenses                                   |
| B1-1 Total functions and activities — income                                                                                                        | `$149,464` thousand                                                                                      | = face statement                                                |
| B1-1 Total functions and activities — expenses                                                                                                      | `$105,837` thousand                                                                                      | = `$105,837,000` (printed total)                                |
| B1-1 Total functions and activities — operating result                                                                                              | `$43,627` thousand                                                                                       | = face continuing result                                        |
| B1-1 grants and contributions                                                                                                                       | `$67,064` thousand                                                                                       | = operating `$9,694` + capital `$57,370`                        |
| Continuing operating result                                                                                                                         | `$149,464` − `$105,837` = `$43,627` thousand                                                             | = printed continuing operating result                           |
| Statutory net operating result                                                                                                                      | `$43,627` thousand (no discontinued operation)                                                           | = printed net result attributable to Council                    |
| Result before capital grants                                                                                                                        | `$43,627` − `$57,370` = `$(13,743)` thousand                                                             | = printed result before capital grants (evidence only)          |
| Continuing result before depreciation                                                                                                               | `$149,464` − `$82,369` = `$67,095` thousand                                                              | = printed continuing before-depreciation result (evidence only) |
| Statement of Comprehensive Income net result                                                                                                        | `$43,627` thousand                                                                                       | = Income Statement statutory net result                         |
| Statement of Comprehensive Income total (`$43,627` + `$40,384` other comprehensive income)                                                          | `$84,011` thousand                                                                                       | = printed total comprehensive income                            |
| Note B3-4 "Total depreciation and amortisation costs"                                                                                               | `$23,468` thousand                                                                                       | = face depreciation/amortisation/impairment line                |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$105,837`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$82,369` thousand) plus printed
depreciation/amortisation/impairment (`$23,468` thousand), and equals printed total income
(`$149,464` thousand) less the printed continuing operating result (`$43,627` thousand). The B1-1
income, expenses, operating result and grants reconcile exactly to the face statement — there is
**no face-vs-B1-1 discrepancy**.

**Rows.** 18 rows, source id `wollondilly-gpfs`, `source_dataset` "Wollondilly Shire Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Wollondilly Shire Council"` (the exact published entity
name), `data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are
total revenue `$149,464,000`, total expenses `$105,837,000`, employee expenses `$41,688,000`,
depreciation/amortisation/impairment `$23,468,000`, operating government grants `$9,694,000`,
capital government grants `$57,370,000`, borrowing costs `$3,505,000`, materials and services
`$35,465,000`, other expenses `$1,711,000`, net gain on disposal of assets `$59,000`, continuing
operating result `$43,627,000` and net operating result `$43,627,000`. The printed before-capital and
before-depreciation results are not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database evidence (2026-11-18, shared dev DB snapshot at ingest).** Claim-time total `measures`
**693,196** with `woollahra-gpfs` 29 rows already present; ingest 1 added exactly **18**
`wollondilly-gpfs` rows (**693,196** → **693,214**). The per-source count diff showed **no other
source increased or decreased** and no rows were deleted (`woollahra-gpfs` stayed 29). A second ingest
run fetched and upserted the same 18 SHA-anchored natural keys and left the DB total at **693,214**
(idempotent). `data_sources` records the source `active` with `records_ingested: 18`. The concurrent
Blue Mountains landing later took the live total to **693,237** (23 `blue-mountains-gpfs` rows).

### 7.38 Thirty-eighth council — Camden Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Camden Council's official Annual Report and Financial Statement page
<https://www.camden.nsw.gov.au/council/integrated-planning/annual-report-and-financial-statement>,
which links the published audited statements PDF
<https://www.camden.nsw.gov.au/assets/pdfs/Council/Integrated-Planning/Annual-Report/2024-25-Financial-Statements.pdf>.
The connector parses that page's own PDF link (no hard-coded document URL) and SHA-256 re-verifies the
exact bytes. The page and PDF are served directly to a normal HTTP client (HTTP 200).

The 101-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p22
(printed p5), Statement of Comprehensive Income p23 (printed p6), B1-1 "Functions or activities" p34
(printed p17) and note B3-4 depreciation p50 (printed p33) — plus the independent auditor's report.
The printed unit is explicit `$ '000` on the Income Statement, Statement of Comprehensive Income, B1-1
and note B3-4; a missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo (durably, not in a disposable worktree) at
`~/ausspend-source-archive/camden-gpfs/camden-council-financial-statements-2024-25.pdf`:
**5,460,863 bytes**, SHA-256
`8e7762e57c009cd47f6880e2edf825d1b8510b06791d2b7fe720ff0f29772e64` (`hash_verified: true`).

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                                                                                                                                                    | Printed / derived                                                                                      | Result                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                                                                                                                                               | `$342,825` thousand                                                                                    | = `$342,825,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income; printed net gain on disposal is nil)                                                                                                        | `$110,592` + `$22,644` + `$1,833` + `$7,563` + `$179,564` + `$15,779` + `$4,850` = `$342,825` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal)                                                                                                                                                        | `$80,389` + `$67,447` + `$2,307` + `$3,027` + `$4,834` = `$158,004` thousand                           | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$41,375`)                                                                                                                                                                       | `$158,004` + `$41,375` = `$199,379` thousand                                                           | = printed B1-1 total expenses                    |
| B1-1 Total functions and activities — income                                                                                                                                                                                                                             | `$342,825` thousand                                                                                    | = face statement                                 |
| B1-1 Total functions and activities — expenses                                                                                                                                                                                                                           | `$199,379` thousand                                                                                    | = `$199,379,000` (printed total)                 |
| B1-1 Total functions and activities — operating result                                                                                                                                                                                                                   | `$143,446` thousand                                                                                    | = face operating result                          |
| B1-1 grants and contributions                                                                                                                                                                                                                                            | `$187,127` thousand                                                                                    | = operating `$7,563` + capital `$179,564`        |
| B1-1 function expense split (Managing Camden's Growth `$12,193` + Urban and Natural Environments `$52,378` + Prosperous Economy `$1,377` + Sustainable Transport `$36,183` + Enriched and Connected Community `$39,386` + Stong Local Leadership (Governance) `$57,862`) | `$199,379` thousand                                                                                    | = printed B1-1 total expenses                    |
| Operating result from continuing operations                                                                                                                                                                                                                              | `$342,825` − `$199,379` = `$143,446` thousand                                                          | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                                                                                                                                                                | `$143,446` thousand                                                                                    | = printed net result (no discontinued operation) |
| Statement of Comprehensive Income net result                                                                                                                                                                                                                             | `$143,446` thousand                                                                                    | = Income Statement net result                    |
| Statement of Comprehensive Income total (`$143,446` + `$284,182` other comprehensive income)                                                                                                                                                                             | `$427,628` thousand                                                                                    | = printed total comprehensive income             |
| Note B3-4 "Total depreciation, amortisation and impairment for non-financial assets"                                                                                                                                                                                     | `$41,375` thousand                                                                                     | = face depreciation/amortisation/impairment line |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$199,379`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$158,004` thousand) plus printed
depreciation/amortisation/impairment (`$41,375` thousand), and equals printed total income
(`$342,825` thousand) less the printed operating result (`$143,446` thousand). B1-1 income, expenses,
operating result and grants reconcile exactly to the face statement. There is no discontinued
operation, so the operating result and net result are the same printed line.

**Rows.** 23 rows, source id `camden-gpfs`, `source_dataset` "Camden Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Camden Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$342,825,000`, total expenses `$199,379,000`, employee expenses `$80,389,000`,
depreciation/amortisation/impairment `$41,375,000`, operating government grants `$7,563,000`, capital
government grants `$179,564,000`, borrowing costs `$2,307,000`, net loss on disposal of assets
`$4,834,000` and net result `$143,446,000`. The six printed B1-1 strategic-direction expense rows are
emitted as a separate `b1_1_function_expenses_*` cut of the same printed total; the printed net gain
on disposal of assets is nil and is not emitted as a zero row.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The six B1-1 service rows are a second cut of the same total
expenses and are never added to the nature-of-expense rows. The pre-existing same-entity rows are
preserved untouched and never summed.

**Database evidence (2026-11-18, shared dev DB `<dev-db-host>:27017/ausspend_dev`).** Claim-time
`measures` was **693,259** and `camden-gpfs` was 0; after ingest **693,282** (exactly **+23**). A fresh
`source_id /gpfs$/` aggregate moved from **706 rows across 39 sources** to **729 rows across 40
sources** (still exactly +23 GPFS rows and +1 source). The per-source diff over the ingest showed only
`camden-gpfs` changing (0 → 23); every other source count was identical and no rows were deleted.
`data_sources` records the source `active` with `records_ingested: 23`. A second ingest run upserted
the same 23 SHA-anchored natural keys and left the DB total at **693,282** (idempotent).

---

### 7.39 Thirty-ninth council — Campbelltown City Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Campbelltown City Council's official page
<https://www.campbelltown.nsw.gov.au/Council-and-Councillors/Financial-information>, which links the
published audited statements PDF
<https://www.campbelltown.nsw.gov.au/files/sharedassets/public/v/1/council-and-councillors/documents/2024-25-financial-statements_final.pdf>.
The connector parses that page's own PDF link (no hard-coded document URL) and SHA-256 re-verifies the
exact bytes. The page and PDF are served directly to a normal HTTP client (HTTP 200); no browser
challenge was needed.

The 100-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p8,
Statement of Comprehensive Income p9, B1-1 "Functions or activities" p19 and note B3-3 depreciation
p28 — plus the independent auditor's report on PDF p71–p73, signed 28 October 2025 by the Delegate of
the Auditor-General for New South Wales. The cover page carries a leftover typesetting banner reading
"DRAFT VERSION"; the body is the signed and audited final document named in the council's
`...-final.pdf` link, so the banner is recorded here rather than treated as a different version. The
printed unit is explicit `$'000` on the Income Statement, Statement of Comprehensive Income, B1-1 and
note B3-3; a missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo at
`$AUSSPEND_SOURCE_ARCHIVE/campbelltown-gpfs/campbelltown-city-council-financial-statements-2024-25.pdf`:
**26,061,429 bytes**, SHA-256
`98bf395e8f6fba33ab9505c052eb0333350da739c1db54b4c80126917cb1dfdf` (`hash_verified: true`).

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                                                                                | Printed / derived                                                                                        | Result                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                                                                           | `$306,751` thousand                                                                                      | = `$306,751,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income)                                                                         | `$155,396` + `$18,050` + `$10,568` + `$30,952` + `$67,872` + `$13,237` + `$10,676` = `$306,751` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal)                                                                                    | `$101,228` + `$92,728` + `$280` + `$7,390` + `$2,748` = `$204,374` thousand                              | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$39,290`)                                                                                                   | `$204,374` + `$39,290` = `$243,664` thousand                                                             | = printed B1-1 total expenses                    |
| B1-1 Total functions or activities — income                                                                                                                                                          | `$306,751` thousand                                                                                      | = face statement                                 |
| B1-1 Total functions or activities — expenses                                                                                                                                                        | `$243,664` thousand                                                                                      | = `$243,664,000` (printed total)                 |
| B1-1 Total functions or activities — operating result                                                                                                                                                | `$63,087` thousand                                                                                       | = face operating result                          |
| B1-1 grants and contributions                                                                                                                                                                        | `$98,824` thousand                                                                                       | = operating `$30,952` + capital `$67,872`        |
| B1-1 objective expense split (Community and belonging `$42,840` + Places for people `$92,333` + Enriched natural environment `$45,675` + Economic prosperity `$8,247` + Strong leadership `$54,569`) | `$243,664` thousand                                                                                      | = printed B1-1 total expenses                    |
| Operating result from continuing operations                                                                                                                                                          | `$306,751` − `$243,664` = `$63,087` thousand                                                             | = printed operating result                       |
| Net operating result for the year from Income Statement                                                                                                                                              | `$63,087` thousand                                                                                       | = printed net result (no discontinued operation) |
| Statement of Comprehensive Income total (`$63,087` + `$263` other comprehensive income)                                                                                                              | `$63,350` thousand                                                                                       | = printed total comprehensive income             |
| Note B3-3 "Total depreciation and amortisation costs"                                                                                                                                                | `$39,290` thousand                                                                                       | = face depreciation/amortisation/impairment line |

Total expenses is the printed B1-1 "Total functions or activities" expense total (`$243,664`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$204,374` thousand) plus printed
depreciation/amortisation/impairment (`$39,290` thousand), and equals printed total income
(`$306,751` thousand) less the printed continuing operating result (`$63,087` thousand). B1-1 income,
expenses, operating result and grants reconcile exactly to the face statement — there is **no
face-vs-B1-1 discrepancy**. There is no discontinued operation, so the continuing operating result and
the net result repeated at the top of the Statement of Comprehensive Income are the same printed
figure.

**Rows.** 22 rows, source id `campbelltown-gpfs`, `source_dataset` "Campbelltown City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Campbelltown City Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$306,751,000`, total expenses `$243,664,000`, employee expenses `$101,228,000`,
depreciation/amortisation/impairment `$39,290,000`, operating government grants `$30,952,000`,
capital government grants `$67,872,000`, borrowing costs `$280,000`, net loss on disposal of assets
`$2,748,000` and net result `$63,087,000`. The five printed B1-1 objective expenses (Community and
belonging, Places for people, Enriched natural environment, Economic prosperity, Strong leadership)
are emitted as a separate `b1_1_function_expenses_*` cut of the same printed total.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The five B1-1 objective rows are a second cut of the same
total expenses and are never added to the nature-of-expense rows. The pre-existing same-entity rows are
preserved untouched and never summed.

**Database evidence (2026-11-18, shared dev DB).** Fresh aggregate at claim time: total measures
**693,237**, of which **684** GPFS rows across **38** sources and **0** `campbelltown-gpfs` rows.
After ingesting only this source: total **693,259** (+22), GPFS **706** across **39** sources
(+22 and +1 source), `campbelltown-gpfs` **22**; the per-source diff changed **only**
`campbelltown-gpfs` (0 → 22), no source count decreased and no rows were deleted. A later fresh
aggregate (after a concurrent Camden ingest of 23 rows) is **693,282 total / 729 GPFS rows across 40
sources**, with `campbelltown-gpfs` still exactly **22**; the later change is entirely the concurrent
`camden-gpfs` landing, not this source. `data_sources` records `campbelltown-gpfs` as `active` with
`records_ingested: 22`. A second ingest run upserts the same 22 SHA-anchored natural keys
(idempotent). Targeted connector tests passed (15/15).

---

### 7.40 Fortieth council — Central Coast Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from Central Coast Council's official "Annual Report 2024-25" page
<https://www.centralcoast.nsw.gov.au/council/forms-and-publications/annual-report-2024-25>, which
links the standalone audited statements PDF
<https://cdn.centralcoast.nsw.gov.au/sites/default/files/2025-11/audited-financial-statements-2024-25-central-coast-council.pdf>.
The connector parses that page's own PDF link (no hard-coded document URL) and SHA-256 re-verifies the
exact bytes. The council's CloudFront CDN answers the default Node user agent with HTTP 403, so live
discovery and download send a browser-like `User-Agent` and the document page as `Referer`; with those
headers the same bytes come back to a plain HTTP client (no browser challenge, no browser fallback).

The 136-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p4,
Statement of Comprehensive Income p5, B1-1 "Functions or activities" p13 and note B3-4 depreciation
p24 — plus the independent auditor's report. The printed unit is explicit `$ '000` on the Income
Statement, Statement of Comprehensive Income, B1-1 and note B3-4; a missing or conflicting unit
rejects the whole extraction. The Income Statement prints the Original unaudited budget column before
each line label, so the FY2024-25 actual is the first printed amount after the label (then the
restated FY2023-24). The standalone depreciation line prints a bare footnote marker before its note
reference, so its actual is the second amount after the label.

Exact bytes archived outside the repo at
`~/ausspend-source-archive/central-coast-gpfs/central-coast-council-audited-financial-statements-2024-25.pdf`:
**8,242,386 bytes**, SHA-256
`2a37c3eb83a536d2937d85e4a1dbc0df90535338ab3bbb96f3139c5c17d4995a` (`hash_verified: true`). The
archive also holds the `records/` metadata and the parsed-row JSON.

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                        | Printed / derived                                                                                          | Result                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                   | `$892,138` thousand                                                                                        | = `$892,138,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$459,607` + `$181,230` + `$17,256` + `$44,395` + `$129,456` + `$45,062` + `$15,132` = `$892,138` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal)            | `$225,354` + `$230,070` + `$13,214` + `$46,110` + `$7,981` = `$522,729` thousand                           | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$211,449`)                          | `$522,729` + `$211,449` = `$734,178` thousand                                                              | = printed face-statement total expenses          |
| Operating result from continuing operations                                                                                  | `$892,138` − `$734,178` = `$157,960` thousand                                                              | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                    | `$157,960` thousand                                                                                        | = printed net result (no discontinued operation) |
| Net operating result before capital grants                                                                                   | `$157,960` − `$129,456` = `$28,504` thousand                                                               | = printed before-capital surplus (evidence only) |
| B1-1 Total functions and activities — income                                                                                 | `$892,138` thousand                                                                                        | = face statement                                 |
| B1-1 Total functions and activities — expenses                                                                               | `$734,180` thousand                                                                                        | = printed (but see the $2 discrepancy below)     |
| B1-1 Total functions and activities — operating result                                                                       | `$157,958` thousand                                                                                        | = printed (but see the $2 discrepancy below)     |
| B1-1 grants and contributions                                                                                                | `$173,851` thousand                                                                                        | = operating `$44,395` + capital `$129,456`       |
| Statement of Comprehensive Income total (`$157,960` + `$939,794` other comprehensive income)                                 | `$1,097,754` thousand                                                                                      | = printed total comprehensive income             |
| Note B3-4 "Total depreciation and amortisation costs"                                                                        | `$211,449` thousand                                                                                        | = face depreciation/amortisation/impairment line |

Total expenses is the printed face-statement bridge: the printed expenses-excluding-depreciation line
(`$522,729` thousand) plus the printed depreciation/amortisation/impairment line (`$211,449`
thousand), i.e. `$734,178` thousand, which equals printed total income (`$892,138` thousand) less the
printed operating result (`$157,960` thousand). It is **not** a sum of the nature components on its
own and **not** the B1-1 expense total. The audited B1-1 "Total functions and activities" row prints
expenses `$734,180` thousand and operating result `$157,958` thousand: a printed **$2 thousand
function-allocation discrepancy** (B1-1 expenses are $2 thousand higher and B1-1 operating result $2
thousand lower than the face statement). The connector requires the two differences to be equal in
magnitude/direction, records both in the reconciliation evidence, and uses the face statement as
authoritative for emitted total expenses and net result. Because the B1-1 service split sums to the
B1-1 total (`$734,180`) rather than the face bridge (`$734,178`), it is **not** emitted; only the
printed face-statement lines are. There is no discontinued operation, so the continuing operating
result and the net result repeated at the top of the Statement of Comprehensive Income are the same
printed figure. The printed before-capital surplus (`$28,504` thousand) is reconciliation evidence
only.

**Rows.** 17 rows, source id `central-coast-gpfs`, `source_dataset` "Central Coast Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Central Coast Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$892,138,000`, total expenses `$734,178,000`, employee expenses `$225,354,000`,
depreciation/amortisation/impairment `$211,449,000`, operating government grants `$44,395,000`,
capital government grants `$129,456,000`, borrowing costs `$13,214,000`, net loss on disposal of
assets `$7,981,000` and net result `$157,960,000`; the printed face-statement revenue and expense
components are included for provenance. The `total_expenses` and `net_result` rows carry
`human_spot_check: required` in their notes, naming the printed `$2` thousand B1-1 function-allocation
discrepancy (B1-1 expenses `$734,180` thousand / operating result `$157,958` thousand vs face
expenses `$734,178` thousand / operating result `$157,960` thousand) that a human must reconcile
before those two totals are treated as final.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database evidence (2026-11-18, shared dev DB).** Fresh aggregate at claim time: total measures
**693,282**, of which **729** GPFS rows across **40** sources and **0** `central-coast-gpfs` rows.
After ingesting only this source: total **693,299** (+17), GPFS **746** across **41** sources (+17 and
+1 source), `central-coast-gpfs` **17**; the per-source diff changed **only** `central-coast-gpfs`
(0 → 17), no source count decreased and no rows were deleted. A second ingest run upserts the same 17
SHA-anchored natural keys and leaves the total at **693,299** (idempotent). `data_sources` records
`central-coast-gpfs` as `active` with `records_ingested: 17`. Targeted connector tests passed
(13/13).

### 7.41 Forty-first council — Hornsby Shire Council FY2025-26 GPFS (landed 2026-11-18)

**Source.** Discovered from Hornsby Shire Council's official Financial Statements page
<https://www.hornsby.nsw.gov.au/Council/Forms-and-publications/Publications/Financial-Statements>,
which lists the audited statements for 2007-08 through the latest year. The page links the FY2025-26
"Annual Financial Statements 2025/26" PDF
<https://www.hornsby.nsw.gov.au/files/assets/public/v/2/council/forms-and-publications/publications/financial-statements/documents/hsc8902-financial-statements-2026.pdf>.
The latest _audited_ year is FY2025-26: the PDF contains the independent auditor's report at PDF
p59–p61, signed 24 September 2026 by Cassie Malone, Director, Financial Audit, Delegate of the
Auditor-General for New South Wales. (The brief's FY2024-25 fallback is superseded by this later
audited year; the FY2024-25 PDF remains listed on the same page.) Hornsby's site returns HTTP 403 to
plain HTTP clients, so the connector uses the documented headless-Chromium path: the browser loads
the official page, the connector parses the PDF link from that cleared HTML (no hard-coded document
URL), downloads the exact bytes and SHA-256 re-verifies them. The page and PDF are the council's own
published documents.

The 78-page PDF prints the Income Statement on PDF p6, the Statement of Comprehensive Income p7,
note B1-1 "Functions or activities" p15 and note B3-3 depreciation p24. The printed unit is explicit
`$'000` on every page used here; a missing or conflicting unit rejects the whole extraction.

Exact bytes archived outside the repo at
`~/ausspend-source-archive/hornsby-gpfs/hornsby-shire-council-annual-financial-statements-2025-26.pdf`:
**4,734,335 bytes**, SHA-256
`e9484b420f24c4ce8abcfc7e75f743a6f0619e8d6cc74591c415f63a67a11579` (`hash_verified: true`).

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                                                                               | Printed / derived                                                                                      | Result                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                                                                          | `$207,011` thousand                                                                                    | = `$207,011,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income)                                                                        | `$135,886` + `$16,218` + `$4,932` + `$13,663` + `$14,831` + `$13,473` + `$8,008` = `$207,011` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal)                                                                                   | `$60,968` + `$70,637` + `$29` + `$4,882` + `$1,909` = `$138,425` thousand                              | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$27,550`)                                                                                                  | `$138,425` + `$27,550` = `$165,975` thousand                                                           | = printed B1-1 total expenses                    |
| B1-1 Total functions and activities — income                                                                                                                                                        | `$207,011` thousand                                                                                    | = face statement                                 |
| B1-1 Total functions and activities — expenses                                                                                                                                                      | `$165,975` thousand                                                                                    | = `$165,975,000` (printed total)                 |
| B1-1 Total functions and activities — operating result                                                                                                                                              | `$41,036` thousand                                                                                     | = face operating result                          |
| B1-1 grants and contributions                                                                                                                                                                       | `$28,494` thousand                                                                                     | = operating `$13,663` + capital `$14,831`        |
| B1-1 function expense split (General Managers Division `$9,269` + Corporate Support `$38,775` + Infrastructure & Major Projects `$28,950` + Community & Environment `$74,420` + Planning `$14,561`) | `$165,975` thousand                                                                                    | = printed B1-1 total expenses                    |
| Operating result from continuing operations                                                                                                                                                         | `$207,011` − `$165,975` = `$41,036` thousand                                                           | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                                                                                           | `$41,036` thousand                                                                                     | = printed net result (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes                                                                                                                  | `$41,036` − `$14,831` = `$26,205` thousand                                                             | = printed figure                                 |
| Statement of Comprehensive Income total (`$41,036` + `$10,874` other comprehensive income)                                                                                                          | `$51,910` thousand                                                                                     | = printed total comprehensive income             |
| Note B3-3 "Total depreciation and amortisation costs"                                                                                                                                               | `$27,550` thousand                                                                                     | = face depreciation/amortisation/impairment line |

Total expenses is the printed B1-1 "Total functions and activities" expense total (`$165,975`
thousand), **not** a sum of the nature components on its own. It equals the printed face-statement
bridge of expenses-excluding-depreciation (`$138,425` thousand) plus printed
depreciation/amortisation/impairment (`$27,550` thousand), and equals printed total income
(`$207,011` thousand) less the printed continuing operating result (`$41,036` thousand). B1-1
income, expenses, operating result and grants reconcile exactly to the face statement — there is
**no face-vs-B1-1 discrepancy**. There is no discontinued operation, so the continuing operating
result and the net result repeated at the top of the Statement of Comprehensive Income are the same
printed figure.

**Rows.** 22 rows, source id `hornsby-gpfs`, `source_dataset` "Hornsby Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Hornsby Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$207,011,000`, total expenses `$165,975,000`, employee expenses `$60,968,000`,
depreciation/amortisation/impairment `$27,550,000`, operating government grants `$13,663,000`,
capital government grants `$14,831,000`, borrowing costs `$29,000`, net loss on disposal of assets
`$1,909,000` and net result `$41,036,000`. The five printed B1-1 function expenses (General Managers
Division, Corporate Support, Infrastructure & Major Projects, Community & Environment, Planning) are
emitted as a separate `b1_1_function_expenses_*` cut of the same printed total. Zero-expense B1-1
rows (General Purpose Income, Other) are not emitted.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed
into the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state
rows. Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The five function expense rows are a second cut of
the same total expenses and are never added to the nature-of-expense rows. The pre-existing
same-entity rows are preserved untouched and never summed.

**Database evidence (2026-11-18, shared dev DB).** Fresh aggregate at claim time: total measures
**693,316**, of which **763** GPFS rows across **41** sources and **0** `hornsby-gpfs` rows. After
ingesting only this source: total **693,338** (+22), GPFS **785** across **42** sources (+22 and +1
source), `hornsby-gpfs` **22**; the per-source diff changed **only** `hornsby-gpfs` (0 → 22), no
source count decreased and no rows were deleted. `data_sources` records `hornsby-gpfs` as `active`
with `records_ingested: 22`. A second ingest run upserts the same 22 SHA-anchored natural keys and
leaves the totals unchanged (idempotent). Targeted connector tests passed (15/15). A later fresh
aggregate (after a concurrent `penrith-gpfs` ingest of 17 rows) is **693,355 total / 802 GPFS rows
across 43 sources**, with `hornsby-gpfs` still exactly **22**; the later change is entirely the
concurrent Penrith landing, not this source.

### 7.42 Forty-second council — Penrith City Council FY2024-25 GPFS (landed 2026-11-18)

> Section numbering note: the §7.41 slot is reserved for the pending Hornsby Shire Council
> connector; this Penrith section uses §7.42 so the two land independently without renumbering.
> All prior sections are preserved unchanged.

**Source.** Discovered from Penrith City Council's official Organisational Performance page
<https://www.penrithcity.nsw.gov.au/resources-documents/documents/organisational-performance>, which
links the standalone audited statements PDF
<https://www.penrithcity.nsw.gov.au/images/documents/resources-documents/documents/2025_financial_statements_audited.pdf>.
The connector parses the page's own "2024-25 Financial Statements" link (no hard-coded document URL)
and SHA-256 re-verifies the exact bytes. The page and PDF answer a plain HTTP client with HTTP 200;
no browser challenge or browser fallback is involved.

The 122-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6
(printed page 4), Statement of Comprehensive Income p7 (printed page 5), B1-1 "Functions or
activities" p15 (printed page 13) and note B3-4 depreciation p30 (printed page 28) — plus the
independent auditor's reports on the general purpose financial statements (PDF p89) and the special
purpose statements for the declared business activity. The printed unit is explicit `$ '000` on the
Income Statement, Statement of Comprehensive Income, B1-1 and note B3-4; a missing or conflicting unit
rejects the whole extraction. The Income Statement prints the Original unaudited budget column before
each line label, so the FY2024-25 actual is the first printed amount after the label (then the
restated FY2023-24).

Exact bytes archived outside the repo at
`~/ausspend-source-archive/penrith-gpfs/penrith-city-council-financial-statements-2024-25.pdf`:
**4,155,530 bytes**, SHA-256
`eefb5f3f3f09d53cb6b674a2238016c91edf58f04fd53068f4d8629c55ac42f1` (`hash_verified: true`). The
archive also holds the `.meta.json` sidecar and the `records/` metadata.

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                               | Printed / derived                                                                                                  | Result                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                          | `$390,526` thousand                                                                                                | = `$390,526,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$212,763` + `$50,566` + `$5,852` + `$26,250` + `$62,032` + `$15,322` + `$13,775` + `$3,966` = `$390,526` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses)                                                          | `$148,610` + `$101,751` + `$1,077` + `$16,645` = `$268,083` thousand                                               | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$71,376`)                                                  | `$268,083` + `$71,376` = `$339,459` thousand                                                                       | = printed face-statement total expenses          |
| Operating result from continuing operations                                                                                                         | `$390,526` − `$339,459` = `$51,067` thousand                                                                       | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                                           | `$51,067` thousand                                                                                                 | = printed net result (no discontinued operation) |
| Net operating result before capital grants                                                                                                          | `$51,067` − `$62,032` = `−$10,965` thousand                                                                        | = printed before-capital deficit (evidence only) |
| B1-1 Total functions or activities — income                                                                                                         | `$390,526` thousand                                                                                                | = face statement                                 |
| B1-1 Total functions or activities — expenses                                                                                                       | `$339,459` thousand                                                                                                | = face statement                                 |
| B1-1 Total functions or activities — operating result                                                                                               | `$51,067` thousand                                                                                                 | = face statement                                 |
| B1-1 grants and contributions                                                                                                                       | `$88,282` thousand                                                                                                 | = operating `$26,250` + capital `$62,032`        |
| Statement of Comprehensive Income total (`$51,067` + `$626,846` other comprehensive income)                                                         | `$677,913` thousand                                                                                                | = printed total comprehensive income             |
| Note B3-4 "Total depreciation and amortisation costs"                                                                                               | `$71,376` thousand                                                                                                 | = face depreciation/amortisation/impairment line |

Total expenses is the printed face-statement bridge: the printed expenses-excluding-depreciation line
(`$268,083` thousand) plus the printed depreciation/amortisation/impairment line (`$71,376`
thousand), i.e. `$339,459` thousand, which equals printed total income (`$390,526` thousand) less the
printed operating result (`$51,067` thousand). It is **not** a sum of the nature components on its
own. Unlike Central Coast (§7.40), Penrith's audited B1-1 "Total functions or activities from
continuing operations" row prints the same expense total (`$339,459` thousand) and operating result
(`$51,067` thousand), so there is no function-allocation discrepancy; B1-1 is a second cut of the same
total and is not added to the nature rows. There is no discontinued operation in FY2024-25, so the
continuing operating result and the net result repeated at the top of the Statement of Comprehensive
Income are the same printed figure. The printed before-capital deficit (`−$10,965` thousand) is
reconciliation evidence only and is not emitted.

**Rows.** 17 rows, source id `penrith-gpfs`, `source_dataset` "Penrith City Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Penrith City Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$390,526,000`, total expenses `$339,459,000`, employee expenses `$148,610,000`,
depreciation/amortisation/impairment `$71,376,000`, operating government grants `$26,250,000`,
capital government grants `$62,032,000`, borrowing costs `$1,077,000`, net gain on disposal of assets
`$3,966,000`, net result `$51,067,000` and rates and annual charges `$212,763,000`; the printed
face-statement revenue and expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database evidence (2026-11-18, shared dev DB).** Fresh aggregate at claim time: total measures
**693,299**, of which **746** GPFS rows across **41** sources and **0** `penrith-gpfs` rows. A
concurrent unrelated council source landed 39 rows before the immediate pre-ingest snapshot
(**693,338**); the per-source diff around this ingest is therefore measured against that snapshot.
After ingesting only this source: total **693,355** (+17), GPFS **802** across **43** sources (+17 and
+1 source), `penrith-gpfs` **17**; the per-source diff changed **only** `penrith-gpfs` (0 → 17), no
source count decreased and no rows were deleted. A second ingest run upserts the same 17 SHA-anchored
natural keys and leaves the total at **693,355** (idempotent). `data_sources` records `penrith-gpfs`
as `active` with `records_ingested: 17`. Targeted connector tests passed (13/13).

---

### 7.43 Forty-third council — The Hills Shire Council FY2024-25 GPFS (landed 2026-11-18)

**Source.** Discovered from The Hills Shire Council's official Annual Report Archive page
<https://www.thehills.nsw.gov.au/Council/Key-Documents-Reports-Policies/The-Hills-Shire-Annual-Report-Financial-Statement/The-Hills-Shire-Council-Annual-Report-Archive>,
which links "The Hills Shire Council Financial Statements 2024-2025" at
<https://www.thehills.nsw.gov.au/files/assets/public/v/1/cms-docs/council/key-docs/annual-report-amp-archive/2024-2025/the-hills-shire-council-financial-statements-2024-2025.pdf>.
The connector parses that archive page's own financial-statements link (no hard-coded document URL)
and SHA-256 re-verifies the exact bytes. The page and PDF answer a plain HTTP client with HTTP 200;
no browser challenge or browser fallback is involved. FY2025-26 statements are also published, but
the brief prefers the latest audited FY2024-25 year and this connector ingests only FY2024-25.

The 118-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p7
(printed page 5), Statement of Comprehensive Income p8 (printed page 6), B1-1 "Functions and
activities" p16 (printed page 14) and note B3-4 depreciation p27 (printed page 25) — plus the
independent auditor's reports on the general purpose financial statements and the special purpose
statements for the declared business activity. The printed unit is explicit `$ '000` on the Income
Statement, Statement of Comprehensive Income, B1-1 and note B3-4; a missing or conflicting unit
rejects the whole extraction. The Income Statement prints the Original unaudited budget column
before each line label, so the FY2024-25 actual is the first printed amount after the label (then
the FY2023-24 comparative).

Exact bytes archived outside the repo at
`~/ausspend-source-archive/the-hills-gpfs/the-hills-shire-council-financial-statements-2024-25.pdf`:
**5,589,503 bytes**, SHA-256
`5972fc23ae97e3884283880bb3c1fda5ea8eb13ce0585e1e26e5609db2a2ff65` (`hash_verified: true`). The
archive also holds the `.meta.json` sidecar and the `records/` metadata.

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                                               | Printed / derived                                                                                                  | Result                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                          | `$417,451` thousand                                                                                                | = `$417,451,000`                                 |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$144,008` + `$35,509` + `$9,660` + `$18,992` + `$167,184` + `$30,305` + `$8,691` + `$3,102` = `$417,451` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses)                                                          | `$81,713` + `$89,550` + `$64` + `$19,498` = `$190,825` thousand                                                    | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$30,232`)                                                  | `$190,825` + `$30,232` = `$221,057` thousand                                                                       | = printed face-statement total expenses          |
| Operating result from continuing operations                                                                                                         | `$417,451` − `$221,057` = `$196,394` thousand                                                                      | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                                           | `$196,394` thousand                                                                                                | = printed net result (no discontinued operation) |
| Net operating result before capital grants                                                                                                          | `$196,394` − `$167,184` = `$29,210` thousand                                                                       | = printed before-capital result (evidence only)  |
| B1-1 Total functions and activities — income                                                                                                        | `$417,451` thousand                                                                                                | = face statement                                 |
| B1-1 Total functions and activities — expenses                                                                                                      | `$221,057` thousand                                                                                                | = face statement                                 |
| B1-1 Total functions and activities — operating result                                                                                              | `$196,394` thousand                                                                                                | = face statement                                 |
| B1-1 grants and contributions                                                                                                                       | `$186,176` thousand                                                                                                | = operating `$18,992` + capital `$167,184`       |
| Statement of Comprehensive Income total (`$196,394` + `$128,510` other comprehensive income)                                                        | `$324,904` thousand                                                                                                | = printed total comprehensive income             |
| Note B3-4 "Total depreciation and amortisation costs"                                                                                               | `$30,232` thousand                                                                                                 | = face depreciation/amortisation/impairment line |

Total expenses is the printed face-statement bridge: the printed expenses-excluding-depreciation line
(`$190,825` thousand) plus the printed depreciation/amortisation/impairment line (`$30,232` thousand),
i.e. `$221,057` thousand, which equals printed total income (`$417,451` thousand) less the printed
operating result (`$196,394` thousand) and the printed B1-1 "Total functions and activities" expense
total. It is **not** a sum of the nature components on its own. The B1-1 function split is a second
cut of the same total and is not added to the nature rows. There is no discontinued operation in
FY2024-25, so the continuing operating result and the net result repeated at the top of the
Statement of Comprehensive Income are the same printed figure. The printed before-capital result
(`$29,210` thousand) is reconciliation evidence only and is not emitted.

**Rows.** 17 rows, source id `the-hills-gpfs`, `source_dataset` "The Hills Shire Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "The Hills Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$417,451,000`, total expenses `$221,057,000`, employee expenses `$81,713,000`,
depreciation/amortisation/impairment `$30,232,000`, operating government grants `$18,992,000`,
capital government grants `$167,184,000`, borrowing costs `$64,000`, net gain on disposal of assets
`$3,102,000`, net result `$196,394,000` and rates and annual charges `$144,008,000`; the printed
face-statement revenue and expense components are included for provenance.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database evidence (2026-11-18, shared dev DB).** Fresh aggregate at claim time: total measures
**693,427**, of which **874** GPFS rows across **43** sources and **0** `the-hills-gpfs` rows. After
ingesting only this source: total **693,444** (+17), GPFS **891** across **44** sources (+17 and
+1 source), `the-hills-gpfs` **17**; the per-source diff changed **only** `the-hills-gpfs` (0 → 17),
no source count decreased and no rows were deleted. A second ingest run upserts the same 17 SHA-anchored
natural keys and leaves the total at **693,444** (idempotent). At final check the live total is
**693,462**/**909** GPFS rows because a concurrent `dubbo-council-gpfs` historical ingest added 18
rows (107 → 125); that delta is not from this connector. `data_sources` records `the-hills-gpfs` as
`active` with `records_ingested: 17`. Targeted connector tests passed (13/13).

### 7.44 Forty-fifth council — Warren Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source.** Discovered from Warren Shire Council's official Financial Reports page
<https://www.warren.nsw.gov.au/council/financial-reports>, which lists the standalone General Purpose
Financial Statements for 2009-10 through 2025-26 next to the separate Special Purpose Financial
Statements and Special Schedules. The connector selects only the anchor whose text resolves to
FY2025-26 and whose host is the council's own site; the FY2025-26 PDF is
<https://www.warren.nsw.gov.au/__media_downloads/Financial%20Reports/GPFS-2026.pdf?downloadable=1>.
The `?downloadable=1` query is required and is preserved. The page and PDF are served over plain HTTP
to Node's fetch; there is no hard-coded document URL.

The 81-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo at
`~/ausspend-source-archive/warren-gpfs/GPFS-2026.pdf` (connector `archiveSourceDocument` output,
with its `.meta.json` retrieval sidecar and SHA-named record under `records/`):

- bytes: **2,283,613**
- SHA-256: `9906ea67979c4c059cbd0a9ab8179c4644db9e11cd2065f16fff5cd61bd66577`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check                                                                                                                        | Printed / derived                                                                            | Result                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                   | `$37,591` thousand                                                                           | = `$37,591,000`                                  |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$7,456` + `$4,092` + `$1,384` + `$19,187` + `$4,788` + `$467` + `$217` = `$37,591` thousand | = printed total                                  |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal)            | `$7,533` + `$10,151` + `$86` + `$383` + `$6,224` = `$24,377` thousand                        | = printed expenses excluding depreciation        |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$7,898`)                            | `$24,377` + `$7,898` = `$32,275` thousand                                                    | = printed B1-1 total expenses                    |
| B1-1 Total functions and activities — income                                                                                 | `$37,591` thousand                                                                           | = face statement                                 |
| B1-1 Total functions and activities — expenses                                                                               | `$32,275` thousand                                                                           | = face bridge                                    |
| B1-1 Total functions and activities — operating result                                                                       | `$5,316` thousand                                                                            | = face operating result                          |
| B1-1 grants and contributions                                                                                                | `$23,975` thousand                                                                           | = operating `$19,187` + capital `$4,788`         |
| Operating result from continuing operations                                                                                  | `$37,591` − `$32,275` = `$5,316` thousand                                                    | = printed operating result                       |
| Net operating result for the year attributable to Council                                                                    | `$5,316` thousand                                                                            | = printed net result (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes                                           | `$5,316` − `$4,788` = `$528` thousand                                                        | = printed figure (evidence only)                 |
| Statement of Comprehensive Income net result                                                                                 | `$5,316` thousand                                                                            | = Income Statement net result                    |
| Statement of Comprehensive Income total (`$5,316` + `$20,887` other comprehensive income)                                    | `$26,203` thousand                                                                           | = printed total comprehensive income             |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$24,377`
thousand) plus printed depreciation/amortisation/impairment (`$7,898` thousand), and equals the B1-1
"Total functions and activities" expense total (`$32,275` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.

**Rows.** 17 rows, source id `warren-gpfs`, `source_dataset` "Warren Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Warren Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$37,591,000`, total expenses `$32,275,000`, employee expenses `$7,533,000`,
depreciation/amortisation/impairment `$7,898,000`, operating government grants `$19,187,000`,
capital government grants `$4,788,000`, borrowing costs `$86,000`, net loss on disposal of assets
`$6,224,000` and net result `$5,316,000`. The printed before-capital result is retained in
reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for
the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** The council ingest was run for
this source only:
`MONGO_URL=mongodb://<dev-db-host>:27017/ausspend_dev npx tsx scripts/ingest-nsw.ts --source warren-gpfs`.
Pre-ingest aggregate: total measures **998,444**, `warren-gpfs` **0**, `jurisdiction_level: "soc"`
**205**, GPFS measures **926**. The run logged `warren-gpfs: success fetched=17 upserted=17`. Post-run
aggregate: total **998,461** (+17), `warren-gpfs` **17**, SOC still **205** (unchanged), GPFS **943**
(+17). No other source count changed and no rows were deleted. Every `warren-gpfs` row is
`agency_detail` (`warren-gpfs` rows with any other role: 0) with no `region_id`/`location`
(`warren-gpfs` rows carrying either: 0), and `delivery_entity: "Warren Shire Council"`.
`data_sources` records the source `active` with `records_ingested: 17`, `errors: []`; the latest
`ingestion_logs` entry is `status: "success"`, `records_fetched: 17`, `records_upserted: 17`,
`errors: []`. No council total or cross-council aggregate is created. The focused connector test also
proves idempotency against a dedicated test Mongo (seeded 5 rows → 22 with 17 `warren-gpfs`; a second
ingest leaves it at 22). Targeted connector tests passed (14/14).

### 7.45 Forty-sixth council — Brewarrina Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source.** The council's Access to Information page
<https://brewarrina.nsw.gov.au/council/access-to-information/> returns HTTP 200 but does not embed
the financial statements link. The standalone audited FY2025-26 General Purpose Financial Statements
are published on the same official domain through the council's WordPress media library, so the
connector discovers them from the official media REST endpoint
<https://brewarrina.nsw.gov.au/wp-json/wp/v2/media?search=Financial%20Statements&per_page=100> and
selects the FY2025-26 statement by its printed filename. Public presentation notices, annual reports
and prior-year statements are ignored; only the council's own host is accepted. The selected PDF is
<https://brewarrina.nsw.gov.au/wp-content/uploads/2026/11/Brewarrina-Shire-Council-Financial-Statements-2025-26.pdf>.
There is no hard-coded document URL.

The 65-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **2,817,948**
- SHA-256: `62b854e464ef03e796fbfd6edf552bf7fb6f349ceec410e8d3a4481f851e5528`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$40,798` thousand | = `$40,798,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$3,093` + `$10,880` + `$891` + `$15,818` + `$9,041` + `$923` + `$152` = `$40,798` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + other expenses + net loss on disposal) | `$8,022` + `$15,242` + `$540` + `$247` = `$24,051` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$5,702`) | `$24,051` + `$5,702` = `$29,753` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$40,798` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$29,753` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$11,045` thousand | = face operating result |
| B1-1 grants and contributions | `$24,859` thousand | = operating `$15,818` + capital `$9,041` |
| Operating result from continuing operations | `$40,798` − `$29,753` = `$11,045` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$11,045` thousand | = printed net result (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes | `$11,045` − `$9,041` = `$2,004` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$11,045` thousand | = Income Statement net result |
| Statement of Comprehensive Income total (`$11,045` + `$11,270` other comprehensive income) | `$22,315` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$24,051`
thousand) plus printed depreciation/amortisation/impairment (`$5,702` thousand), and equals the B1-1
"Total functions and activities" expense total (`$29,753` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Brewarrina prints no borrowing-costs line, so the expense-by-nature bridge has four components, not
five.

**Rows.** 16 rows, source id `brewarrina-gpfs`, `source_dataset` "Brewarrina Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Brewarrina Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$40,798,000`, total expenses `$29,753,000`, employee expenses `$8,022,000`,
depreciation/amortisation/impairment `$5,702,000`, operating government grants `$15,818,000`,
capital government grants `$9,041,000`, net loss on disposal of assets `$247,000` and net result
`$11,045,000`. The printed before-capital result is retained in reconciliation evidence only and is
not emitted as a row. The B1-1 function split is used only for the reconciliation checks and is not
emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`brewarrina-gpfs` took the shared dev DB from **998,461** to **998,477** measures — exactly **+16**
`brewarrina-gpfs` rows. GPFS rows moved **943 → 959** and active GPFS `data_sources` **45 → 46**;
the SOC measure count stayed at **205** and every other per-source count was unchanged. A second
ingest fetched/upserted the same 16 SHA-anchored natural keys, left the total at **998,477** and
created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 16`. The exact PDF is archived outside the repo at
`~/ausspend-source-archive/brewarrina-gpfs/` with its SHA-256 and retrieval metadata; no PDF is
committed. The focused connector test also proves idempotency against a dedicated test Mongo (seeded
5 rows → 21 with 16 `brewarrina-gpfs`; a second ingest leaves it at 21). Targeted connector tests
passed (13/13).

### 7.46 Forty-seventh council — Bogan Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source.** The council's Integrated Planning and Reporting page
<https://bogan.nsw.gov.au/your-council/publications/integrated-planning-and-reporting> returns HTTP
200, but the site renders its document lists client-side and does not expose the standalone
financial-statements link to a plain HTTP fetch. The connector first parses the official Annual
Report page for an FY2025-26 statements anchor and, when none is published, uses the council's
documented official `ArticleDocuments` pin for the exact standalone PDF (never a mirror or a
search-engine copy). The `.pdf.aspx` endpoint serves a genuine `application/pdf` body and the
selected document is
<https://bogan.nsw.gov.au/ArticleDocuments/517/14.10.2026%20Annual_Financial_Statements-2026.pdf.aspx>.

The 104-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p15 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **1,847,355**
- SHA-256: `02132e1e7c7b6d4da20b5b8e2e14d26918fab026b1f64d0f59513fd846f0a779`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$36,387` thousand | = `$36,387,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$5,935` + `$8,235` + `$261` + `$13,436` + `$6,701` + `$1,363` + `$298` + `$158` = `$36,387` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses) | `$10,020` + `$13,597` + `$54` + `$265` = `$23,936` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$6,659`) | `$23,936` + `$6,659` = `$30,595` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$36,387` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$30,595` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$5,792` thousand | = face operating result |
| B1-1 grants and contributions | `$20,137` thousand | = operating `$13,436` + capital `$6,701` |
| Operating result from continuing operations | `$36,387` − `$30,595` = `$5,792` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$5,792` thousand | = printed net result (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes | `$5,792` − `$6,701` = `−$909` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$5,792` thousand | = Income Statement net result |
| Statement of Comprehensive Income total (`$5,792` + `$15,304` other comprehensive income) | `$21,096` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$23,936`
thousand) plus printed depreciation/amortisation/impairment (`$6,659` thousand), and equals the B1-1
"Total functions and activities" expense total (`$30,595` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Bogan prints a net gain on disposal as a revenue line and a separate borrowing-costs expense line.

**Rows.** 17 rows, source id `bogan-gpfs`, `source_dataset` "Bogan Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Bogan Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$36,387,000`, total expenses `$30,595,000`, employee expenses `$10,020,000`,
depreciation/amortisation/impairment `$6,659,000`, operating government grants `$13,436,000`,
capital government grants `$6,701,000`, borrowing costs `$54,000`, net gain on disposal of assets
`$158,000` and net result `$5,792,000`. The printed before-capital result is retained in
reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for
the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `bogan-gpfs` took
the shared dev DB from **998,477** to **998,494** measures — exactly **+17** `bogan-gpfs` rows. GPFS
rows moved **959 → 976** and active GPFS `data_sources` **46 → 47**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. A second ingest fetched/upserted the same 17
SHA-anchored natural keys, left the total at **998,494** and created no duplicate (idempotent).
`data_sources` records the source `active` with `records_ingested: 17`; the latest `ingestion_logs`
entry is `status: "success"`, `records_fetched: 17`, `records_upserted: 17`. The exact PDF is archived
outside the repo at `~/ausspend-source-archive/bogan-gpfs/` with its SHA-256 and retrieval metadata;
no PDF is committed. The focused connector test also proves idempotency against a dedicated test
Mongo (seeded 5 rows → 22 with 17 `bogan-gpfs`; a second ingest leaves it at 22). Targeted connector
tests passed (14/14).

### 7.47 Forty-eighth council — Kyogle Council FY2025-26 GPFS (landed 2026-11-19)

**Source.** Discovered from the council's official Integrated Planning and Reporting page
<https://www.kyogle.nsw.gov.au/about-council/governance/integrated-planning-reporting>, which lists
the standalone financial statements alongside the annual reports and prior years. The connector
selects the latest dated FY2025-26 statements upload and ignores annual reports, notices and prior
years. The current upload is
<https://www.kyogle.nsw.gov.au/sites/default/files/2026-11/2025-2026%20Annual%20Financial%20Statements.pdf>.
The brief's earlier `2026-10/Kyogle%20Council%20Annual%20Financial%20Statements%202026.pdf` path now
serves the same final document (identical bytes and SHA-256); the reporting page links the 2026-11
upload. There is no hard-coded document URL in the discovery path (a documented official fallback pin
is used only if the page yields no usable anchor).

The 107-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **3,552,048**
- SHA-256: `a18538da7a8b093c25b43a8432b2022559eb11c8c54c2809c4e3c04079b614db`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$107,050` thousand | = `$107,050,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest) | `$14,019` + `$13,891` + `$84` + `$13,212` + `$63,823` + `$2,021` = `$107,050` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$11,945` + `$16,445` + `$204` + `$350` + `$66` = `$29,010` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$11,342`) | `$29,010` + `$11,342` = `$40,352` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$107,050` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$40,352` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$66,698` thousand | = face operating result |
| B1-1 grants and contributions | `$77,035` thousand | = operating `$13,212` + capital `$63,823` |
| Operating result from continuing operations | `$107,050` − `$40,352` = `$66,698` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$66,698` thousand | = printed net result (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes | `$66,698` − `$63,823` = `$2,875` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$66,698` thousand | = Income Statement net result |
| Statement of Comprehensive Income total (`$66,698` + `$34,623` other comprehensive income) | `$101,321` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$29,010`
thousand) plus printed depreciation/amortisation/impairment (`$11,342` thousand), and equals the B1-1
"Total functions and activities" expense total (`$40,352` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Kyogle prints a nil net gain on disposal (not emitted) and a separate borrowing-costs and net-loss-on-
disposal expense line.

**Rows.** 16 rows, source id `kyogle-gpfs`, `source_dataset` "Kyogle Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Kyogle Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$107,050,000`, total expenses `$40,352,000`, employee expenses `$11,945,000`,
depreciation/amortisation/impairment `$11,342,000`, operating government grants `$13,212,000`,
capital government grants `$63,823,000`, borrowing costs `$204,000`, net loss on disposal of assets
`$66,000` and net result `$66,698,000`. The printed before-capital result is retained in
reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for
the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `kyogle-gpfs` took
the shared dev DB from **998,494** to **998,510** measures — exactly **+16** `kyogle-gpfs` rows. GPFS
rows moved **976 → 992** and active GPFS `data_sources` **47 → 48**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. A second ingest fetched/upserted the same 16
SHA-anchored natural keys, left the total at **998,510** and created no duplicate (idempotent).
`data_sources` records the source `active` with `records_ingested: 16`; the latest `ingestion_logs`
entry is `status: "success"`, `records_fetched: 16`, `records_upserted: 16`. The exact PDF is archived
outside the repo at `~/ausspend-source-archive/kyogle-gpfs/` with its SHA-256 and retrieval metadata;
no PDF is committed. The focused connector test also proves idempotency against a dedicated test
Mongo (seeded 5 rows → 21 with 16 `kyogle-gpfs`; a second ingest leaves it at 21). Targeted connector
tests passed (14/14).

### 7.48 Forty-ninth council — Junee Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source.** Discovered from the council's official Financial Reports page
<https://www.junee.nsw.gov.au/council/documents/financial-reports/>, which lists the current and prior
standalone financial statements (the separate Annual Reports page is HTTP 200 but does not list the
current GPFS). The connector selects the latest dated FY2025-26 statements upload and ignores annual
reports, notices and prior years. The current upload is
<https://www.junee.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026-1.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

The 82-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **972,546**
- SHA-256: `c725ef8a02c29778426dc7be4263e72b070b86c9aeeb901d524eba1d652d5d36`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$28,352` thousand | = `$28,352,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$8,500` + `$7,043` + `$609` + `$9,754` + `$1,723` + `$163` + `$290` + `$270` = `$28,352` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses) | `$6,546` + `$10,447` + `$505` + `$663` = `$18,161` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$4,112`) | `$18,161` + `$4,112` = `$22,273` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$28,352` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$22,273` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$6,079` thousand | = face operating result |
| B1-1 grants and contributions | `$11,477` thousand | = operating `$9,754` + capital `$1,723` |
| Operating result from continuing operations | `$28,352` − `$22,273` = `$6,079` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$6,079` thousand | = printed net result (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes | `$6,079` − `$1,723` = `$4,356` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$6,079` thousand | = Income Statement net result |
| Statement of Comprehensive Income total (`$6,079` + `$10,748` other comprehensive income) | `$16,827` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$18,161`
thousand) plus printed depreciation/amortisation/impairment (`$4,112` thousand), and equals the B1-1
"Total functions and activities" expense total (`$22,273` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Junee prints a net gain on disposal as a revenue line and a nil net loss on disposal (not emitted).

**Rows.** 17 rows, source id `junee-gpfs`, `source_dataset` "Junee Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Junee Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$28,352,000`, total expenses `$22,273,000`, employee expenses `$6,546,000`,
depreciation/amortisation/impairment `$4,112,000`, operating government grants `$9,754,000`,
capital government grants `$1,723,000`, borrowing costs `$505,000`, net gain on disposal of assets
`$270,000` and net result `$6,079,000`. The printed before-capital result is retained in
reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for
the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `junee-gpfs` took
the shared dev DB from **998,510** to **998,527** measures — exactly **+17** `junee-gpfs` rows. GPFS
rows moved **992 → 1009** and active GPFS `data_sources` **48 → 49**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. A second ingest fetched/upserted the same 17
SHA-anchored natural keys, left the total at **998,527** and created no duplicate (idempotent).
`data_sources` records the source `active` with `records_ingested: 17`; the latest `ingestion_logs`
entry is `status: "success"`, `records_fetched: 17`, `records_upserted: 17`. The exact PDF is archived
outside the repo at `~/ausspend-source-archive/junee-gpfs/` with its SHA-256 and retrieval metadata;
no PDF is committed. The focused connector test also proves idempotency against a dedicated test
Mongo (seeded 5 rows → 22 with 17 `junee-gpfs`; a second ingest leaves it at 22). Targeted connector
tests passed (14/14).

### 7.49 Fiftieth council — Uralla Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source.** Discovered from the council's official Council Reporting and Performance page
<https://www.uralla.nsw.gov.au/Your-Council/Council-plans-reporting-and-documents/Council-reporting-and-performance>,
which lists the signed audited financial statements. The brief's URL
`/templateimages/operational-plan-parts-1-5/general-purpose-financial-statements-2025-2026.pdf` is a
**one-page Section 418(3) public notice** (135,915 bytes) and is never used as the statements. The
connector selects the latest dated signed FY2025-26 statements upload and ignores annual reports,
notices and prior years. The current upload is
<https://www.uralla.nsw.gov.au/files/assets/public/v/1/council/financial-statements/uralla_financial_statements-2026-signed-by-council.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

The 97-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **1,293,828**
- SHA-256: `59cea26584613a39c6766c0ab62e9368ba34c0ea28299588492a9102b42927f8`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$33,381` thousand | = `$33,381,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest) | `$8,953` + `$6,216` + `$1,119` + `$13,108` + `$2,739` + `$1,246` = `$33,381` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$15,779` + `$10,948` + `$244` + `$362` + `$1,296` = `$28,629` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$7,069`) | `$28,629` + `$7,069` = `$35,698` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$33,381` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$35,698` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `−$2,317` thousand | = face operating result |
| B1-1 grants and contributions | `$15,847` thousand | = operating `$13,108` + capital `$2,739` |
| Operating result from continuing operations | `$33,381` − `$35,698` = `−$2,317` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `−$2,317` thousand | = printed net result (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes | `−$2,317` − `$2,739` = `−$5,056` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `−$2,317` thousand | = Income Statement net result |
| Statement of Comprehensive Income total (`−$2,317` + `$18,821` other comprehensive income) | `$16,504` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$28,629`
thousand) plus printed depreciation/amortisation/impairment (`$7,069` thousand), and equals the B1-1
"Total functions and activities" expense total (`$35,698` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Uralla prints a nil net gain on disposal (not emitted) and a separate borrowing-costs and
net-loss-on-disposal expense line.

**Rows.** 16 rows, source id `uralla-gpfs`, `source_dataset` "Uralla Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Uralla Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$33,381,000`, total expenses `$35,698,000`, employee expenses `$15,779,000`,
depreciation/amortisation/impairment `$7,069,000`, operating government grants `$13,108,000`,
capital government grants `$2,739,000`, borrowing costs `$244,000`, net loss on disposal of assets
`$1,296,000` and net result `$2,317,000` carrying `gpfs_printed_sign: "negative"`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `uralla-gpfs` took
the shared dev DB from **998,527** to **998,543** measures — exactly **+16** `uralla-gpfs` rows. GPFS
rows moved **1009 → 1025** and active GPFS `data_sources` **49 → 50**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. A second ingest fetched/upserted the same 16
SHA-anchored natural keys, left the total at **998,543** and created no duplicate (idempotent).
`data_sources` records the source `active` with `records_ingested: 16`; the latest `ingestion_logs`
entry is `status: "success"`, `records_fetched: 16`, `records_upserted: 16`. The exact PDF is archived
outside the repo at `~/ausspend-source-archive/uralla-gpfs/` with its SHA-256 and retrieval metadata;
no PDF is committed. The focused connector test also proves idempotency against a dedicated test
Mongo (seeded 5 rows → 21 with 16 `uralla-gpfs`; a second ingest leaves it at 21). Targeted connector
tests passed (14/14).

### 7.50 Fifty-first council — Cootamundra-Gundagai Regional Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest audited standalone General Purpose Financial Statements
published by Cootamundra-Gundagai Regional Council at 2026-11-19; **no FY2025-26 GPFS exists yet**.
The brief's accepted current-available year is therefore FY2024-25, and the connector never
substitutes a different year. The statements are linked from the council's Annual Reports and
Progress Reports page
<https://www.cgrc.nsw.gov.au/council-plans-and-reports/annual-reports-and-progress-reports/>; the
connector selects the FY2024-25 audited upload and ignores annual reports, notices and prior years.
The current upload is
<https://www.cgrc.nsw.gov.au/wp-content/uploads/2026/01/Cootamundra-Gundagai-Regional-Council-Financial-Statements-2024-25-Audited.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

The 103-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **2,565,827**
- SHA-256: `d53910f5cb422c4f8b85872156805d3b3a21a910fb2fcbf4e472bcad1af13599`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$53,114` thousand | = `$53,114,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$19,807` + `$14,182` + `$885` + `$9,263` + `$6,300` + `$1,683` + `$994` = `$53,114` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$14,801` + `$23,282` + `$298` + `$1,435` + `$2,242` = `$42,058` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$13,274`) | `$42,058` + `$13,274` = `$55,332` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$53,114` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$55,332` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `−$2,218` thousand | = face operating result |
| B1-1 grants and contributions | `$15,563` thousand | = operating `$9,263` + capital `$6,300` |
| Operating result from continuing operations | `$53,114` − `$55,332` = `−$2,218` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `−$2,218` thousand | = printed net result (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes | `−$2,218` − `$6,300` = `−$8,518` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `−$2,218` thousand | = Income Statement net result |
| Statement of Comprehensive Income total (`−$2,218` + `$17,777` other comprehensive income) | `$15,559` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$42,058`
thousand) plus printed depreciation/amortisation/impairment (`$13,274` thousand), and equals the B1-1
"Total functions and activities" expense total (`$55,332` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
CGRC prints a nil net gain on disposal (not emitted) and a separate borrowing-costs and
net-loss-on-disposal expense line.

**Rows.** 17 rows, source id `cootamundra-gundagai-gpfs`, `source_dataset` "Cootamundra-Gundagai
Regional Council GPFS 2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`,
`jurisdiction_level: "local"`, `jurisdiction: "NSW"`, `delivery_entity: "Cootamundra-Gundagai Regional
Council"`, `data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines
are total revenue `$53,114,000`, total expenses `$55,332,000`, employee expenses `$14,801,000`,
depreciation/amortisation/impairment `$13,274,000`, operating government grants `$9,263,000`,
capital government grants `$6,300,000`, borrowing costs `$298,000`, net loss on disposal of assets
`$2,242,000` and net result `$2,218,000` carrying `gpfs_printed_sign: "negative"`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`cootamundra-gundagai-gpfs` took the shared dev DB from **998,543** to **998,560** measures — exactly
**+17** rows. GPFS rows moved **1025 → 1042** and active GPFS `data_sources` **50 → 51**; the SOC
measure count stayed at **205** and every other per-source count was unchanged. A second ingest
fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,560** and created no
duplicate (idempotent). `data_sources` records the source `active` with `records_ingested: 17`; the
latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`, `records_upserted: 17`.
All 17 measures carry `fiscal_year: "2024-25"`. The exact PDF is archived outside the repo at
`~/ausspend-source-archive/cootamundra-gundagai-gpfs/` with its SHA-256 and retrieval metadata; no
PDF is committed. The focused connector test also proves idempotency against a dedicated test Mongo
(seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector tests passed
(15/15).

### 7.51 Fifty-second council — Moree Plains Shire Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest audited standalone General Purpose Financial Statements
published by Moree Plains Shire Council at 2026-11-19; **no FY2025-26 GPFS exists yet**. The brief's
accepted current-available year is therefore FY2024-25, and the connector never substitutes a
different year. The statements are linked from the council's Annual Report and Financial Statements
page <https://www.mpsc.nsw.gov.au/budget/annual-report-and-financial-statements>; the connector
selects the FY2024-25 statement upload and ignores annual reports, notices and prior years. The
current upload is
<https://www.mpsc.nsw.gov.au/publications-documents/financial-statements/2911-2024-25-annual-financial-statement/file>.
A documented official fallback pin is used only if the page yields no usable anchor.

The 114-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **1,999,180**
- SHA-256: `dee19c9e693ccd0e95d76ae52f27133393479e7a8099f8071bc08bcc9425edef`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$92,138` thousand | = `$92,138,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest) | `$34,036` + `$20,301` + `$2,368` + `$18,179` + `$15,248` + `$2,006` = `$92,138` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$24,862` + `$37,280` + `$2,549` + `$1,210` + `$968` = `$66,869` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$19,793`) | `$66,869` + `$19,793` = `$86,662` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$92,138` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$86,662` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$5,476` thousand | = face operating result |
| B1-1 grants and contributions | `$33,427` thousand | = operating `$18,179` + capital `$15,248` |
| Operating result from continuing operations | `$92,138` − `$86,662` = `$5,476` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$5,476` thousand | = printed net result (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes | `$5,476` − `$15,248` = `−$9,772` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$5,476` thousand | = Income Statement net result |
| Statement of Comprehensive Income total (`$5,476` + `$22,090` other comprehensive income) | `$27,566` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$66,869`
thousand) plus printed depreciation/amortisation/impairment (`$19,793` thousand), and equals the B1-1
"Total functions and activities" expense total (`$86,662` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Moree Plains prints no other-income or net-gain line and a separate net-loss-on-disposal expense line.

**Rows.** 16 rows, source id `moree-plains-gpfs`, `source_dataset` "Moree Plains Shire Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Moree Plains Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$92,138,000`, total expenses `$86,662,000`, employee expenses `$24,862,000`,
depreciation/amortisation/impairment `$19,793,000`, operating government grants `$18,179,000`,
capital government grants `$15,248,000`, borrowing costs `$2,549,000`, net loss on disposal of assets
`$968,000` and net result `$5,476,000`. The printed before-capital result is retained in
reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for
the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`moree-plains-gpfs` took the shared dev DB from **998,560** to **998,576** measures — exactly **+16**
rows. GPFS rows moved **1042 → 1058** and active GPFS `data_sources` **51 → 52**; the SOC measure count
stayed at **205** and every other per-source count was unchanged. A second ingest fetched/upserted the
same 16 SHA-anchored natural keys, left the total at **998,576** and created no duplicate (idempotent).
`data_sources` records the source `active` with `records_ingested: 16`; the latest `ingestion_logs`
entry is `status: "success"`, `records_fetched: 16`, `records_upserted: 16`. All 16 measures carry
`fiscal_year: "2024-25"`. The exact PDF is archived outside the repo at
`~/ausspend-source-archive/moree-plains-gpfs/` with its SHA-256 and retrieval metadata; no PDF is
committed. The focused connector test also proves idempotency against a dedicated test Mongo (seeded
5 rows → 21 with 16 rows; a second ingest leaves it at 21). Targeted connector tests passed (15/15).

### 7.52 Fifty-third council — Hilltops Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest audited standalone General Purpose Financial Statements
published by Hilltops Council at 2026-11-19; **no FY2025-26 GPFS exists yet**. The brief's accepted
current-available year is therefore FY2024-25, and the connector never substitutes a different year.
The statements are linked from the council's Council Policies and Plans page
<https://www.hilltops.nsw.gov.au/council/council-policies-plans/>; the connector selects the FY2024-25
statements upload and ignores annual reports, notices and prior years. The current upload is
<https://www.hilltops.nsw.gov.au/wp-content/uploads/2025/08/Hilltops-Council-Annual-Financial-Statements-2025.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

The 112-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p15 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **5,068,393**
- SHA-256: `80d1ddc794f8600628615d2aa0a30275daa1997b2a91655d650ed13d2be11eeb`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$86,723` thousand | = `$86,723,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$28,042` + `$16,950` + `$1,514` + `$15,478` + `$20,985` + `$2,947` + `$724` + `$83` = `$86,723` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses) | `$23,947` + `$27,389` + `$1,084` + `$1,437` = `$53,857` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$24,161`) | `$53,857` + `$24,161` = `$78,018` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$86,723` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$78,018` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$8,705` thousand | = face operating result |
| B1-1 grants and contributions | `$36,463` thousand | = operating `$15,478` + capital `$20,985` |
| Operating result from continuing operations | `$86,723` − `$78,018` = `$8,705` thousand | = printed operating result |
| Net operating result for the year | `$8,705` thousand | = printed "Operating result from continuing operations" (no discontinued operation) |
| Net operating result before grants and contributions provided for capital purposes | `$8,705` − `$20,985` = `−$12,280` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$8,705` thousand | = Income Statement net result |
| Statement of Comprehensive Income total (`$8,705` + `$24,300` other comprehensive income) | `$33,005` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$53,857`
thousand) plus printed depreciation/amortisation/impairment (`$24,161` thousand), and equals the B1-1
"Total functions and activities" expense total (`$78,018` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Hilltops' Income Statement has no separate "Net operating result for the year attributable to
Council" line: the net result is its printed "Operating result from continuing operations" line
(`$8,705` thousand), read from the last occurrence because the phrase also appears in the
"excluding depreciation..." line. It prints a net gain on disposal as a revenue line and a nil net
loss on disposal (not emitted).

**Rows.** 17 rows, source id `hilltops-gpfs`, `source_dataset` "Hilltops Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Hilltops Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$86,723,000`, total expenses `$78,018,000`, employee expenses `$23,947,000`,
depreciation/amortisation/impairment `$24,161,000`, operating government grants `$15,478,000`,
capital government grants `$20,985,000`, borrowing costs `$1,084,000`, net gain on disposal of
assets `$83,000` and net result `$8,705,000`. The printed before-capital result is retained in
reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for
the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government program
data; they are not added to expenditure. The pre-existing same-entity rows are preserved untouched and
never summed.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `hilltops-gpfs`
took the shared dev DB from **998,576** to **998,593** measures — exactly **+17** rows. GPFS rows
moved **1058 → 1075** and active GPFS `data_sources` **52 → 53**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. A second ingest fetched/upserted the same 17
SHA-anchored natural keys, left the total at **998,593** and created no duplicate (idempotent).
`data_sources` records the source `active` with `records_ingested: 17`; the latest `ingestion_logs`
entry is `status: "success"`, `records_fetched: 17`, `records_upserted: 17`. All 17 measures carry
`fiscal_year: "2024-25"`. The exact PDF is archived outside the repo at
`~/ausspend-source-archive/hilltops-gpfs/` with its SHA-256 and retrieval metadata; no PDF is
committed. The focused connector test also proves idempotency against a dedicated test Mongo (seeded
5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector tests passed (15/15).

---

### 7.53 Fifty-fourth council — Bourke Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited standalone General Purpose Financial Statements
published by Bourke Shire Council at 2026-11-19, for the year ended 30 June 2026 (authorised for
issue 28 September 2026). The statements are linked from the council's Reports page
<https://bourke.nsw.gov.au/council/reports/>; the connector selects the FY2025-26 statements upload
and ignores annual reports, quarterly budget review statements, public notices, special-purpose
statements and prior years. The current upload is
<https://bourke.nsw.gov.au/wp-content/uploads/2026/10/Annual-Financial-Statements-2025-2026.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor. The WordPress
media path's upload year/month (`/2026/10/`) is skipped as a non-consecutive year pair; the parser
reads the document's `2025-2026` range.

The 88-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p15 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **3,413,641**
- SHA-256: `9441ad45d329e66ed888da82673e027b4d662b858308b4bb5ddd14ce1b41bce5`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$51,143` thousand | = `$51,143,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$5,024` + `$7,180` + `$2,220` + `$30,590` + `$4,172` + `$1,599` + `$358` = `$51,143` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$9,206` + `$17,915` + `$196` + `$642` + `$280` = `$28,239` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$10,895`) | `$28,239` + `$10,895` = `$39,134` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$51,143` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$39,134` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$12,009` thousand | = face operating result |
| B1-1 grants and contributions | `$34,762` thousand | = operating `$30,590` + capital `$4,172` |
| Operating result from continuing operations | `$51,143` − `$39,134` = `$12,009` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$12,009` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$12,009` − `$4,172` = `$7,837` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$12,009` thousand | = Income Statement net result |
| Statement of Comprehensive Income total (`$12,009` + `$22,603` other comprehensive income) | `$34,612` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$28,239`
thousand) plus printed depreciation/amortisation/impairment (`$10,895` thousand), and equals the B1-1
"Total functions and activities" expense total (`$39,134` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Bourke prints seven non-zero revenue lines; its net gain on disposal is nil and is not emitted (a
non-nil gain would break the seven-component total check and reject the extraction). It prints a net
loss on disposal of `$280` thousand as an expense line. The printed net result and before-capital
result are both positive.

**Rows.** 17 rows, source id `bourke-gpfs`, `source_dataset` "Bourke Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Bourke Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$51,143,000`, total expenses `$39,134,000`, employee expenses `$9,206,000`,
depreciation/amortisation/impairment `$10,895,000`, operating government grants `$30,590,000`,
capital government grants `$4,172,000`, borrowing costs `$196,000`, other income `$358,000`, net loss
on disposal of assets `$280,000` and net result `$12,009,000`. The printed before-capital result is
retained in reconciliation evidence only and is not emitted as a row. The B1-1 function split is used
only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `bourke-gpfs`
took the shared dev DB from **998,593** to **998,610** measures — exactly **+17** rows. GPFS rows
moved **1075 → 1092** and active GPFS `data_sources` **53 → 54**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,610**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`bourke-gpfs/Annual-Financial-Statements-2025-2026.pdf` with its SHA-256 and retrieval metadata; no
PDF is committed. The focused connector test also proves idempotency against a dedicated test Mongo
(seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector tests passed
(15/15).

---

### 7.54 Fifty-fifth council — Coolamon Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited standalone combined General Purpose Financial
Statements (including the audit reports) published by Coolamon Shire Council at 2026-11-19, for the
year ended 30 June 2026. The official listing is the council's Integrated Planning and Reporting
page <https://coolamon.nsw.gov.au/integrated-planning-and-reporting>. That page currently exposes no
usable combined-statements anchor, so the connector uses the documented official fallback pin
<https://coolamon.nsw.gov.au/s/Coolamon-Shire-Council-Combined-Financial-Statements-FY2026-inc-Audit-Reports.pdf>.
The council URL redirects to its Squarespace CDN; both URLs are recorded as provenance. Annual
reports, GIPA/PID returns, special-purpose statements, operational plans, long-term financial plans
and prior years are never used.

The 109-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p15 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- council URL: `https://coolamon.nsw.gov.au/s/Coolamon-Shire-Council-Combined-Financial-Statements-FY2026-inc-Audit-Reports.pdf`
- resolved CDN URL: `https://static1.squarespace.com/static/6119a6edaf35db238026cbe1/t/6ac446da51a2154d0c86e9d8/1791248090045/Coolamon+Shire+Council+Combined+Financial+Statements+FY2026+inc+Audit+Reports.pdf`
- bytes: **3,172,590**
- SHA-256: `2579c4bec349a2846c81229a6b95547b7ff3d98058ed898a2f4ce0b476c87833`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$29,204` thousand | = `$29,204,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$4,870` + `$8,529` + `$484` + `$10,940` + `$2,392` + `$1,288` + `$503` + `$198` = `$29,204` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses) | `$11,037` + `$7,615` + `$29` + `$485` = `$19,166` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$5,689`) | `$19,166` + `$5,689` = `$24,855` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$29,204` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$24,855` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$4,349` thousand | = face operating result |
| B1-1 grants and contributions | `$13,332` thousand | = operating `$10,940` + capital `$2,392` |
| Operating result from continuing operations | `$29,204` − `$24,855` = `$4,349` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$4,349` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$4,349` − `$2,392` = `$1,957` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$4,349` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `$10,834` + joint ventures `$34`) | `$10,868` thousand | = printed total other comprehensive income |
| Total items not reclassified | `$10,868` thousand | = printed total other comprehensive income |
| Statement of Comprehensive Income total (`$4,349` + `$10,868` other comprehensive income) | `$15,217` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$19,166`
thousand) plus printed depreciation/amortisation/impairment (`$5,689` thousand), and equals the B1-1
"Total functions and activities" expense total (`$24,855` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Coolamon prints eight non-zero revenue lines including a net gain on disposal (`$198` thousand) and
four expense lines; it prints no net loss on disposal. The printed net result and before-capital
result are both positive.

**Rows.** 17 rows, source id `coolamon-gpfs`, `source_dataset` "Coolamon Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Coolamon Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$29,204,000`, total expenses `$24,855,000`, employee expenses `$11,037,000`,
depreciation/amortisation/impairment `$5,689,000`, operating government grants `$10,940,000`,
capital government grants `$2,392,000`, borrowing costs `$29,000`, net gain on disposal of assets
`$198,000`, other income `$503,000` and net result `$4,349,000`. The printed before-capital result is
retained in reconciliation evidence only and is not emitted as a row. The B1-1 function split is used
only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `coolamon-gpfs`
took the shared dev DB from **998,610** to **998,627** measures — exactly **+17** rows. GPFS rows
moved **1092 → 1109** and active GPFS `data_sources` **54 → 55**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,627**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. Both
the council URL and the resolved Squarespace CDN URL are recorded in the row provenance. The exact
PDF is archived outside the repo under the configured source-archive root at
`coolamon-gpfs/Coolamon-Shire-Council-Combined-Financial-Statements-FY2026-inc-Audit-Reports.pdf`
with its SHA-256 and retrieval metadata; no PDF is committed. The focused connector test also proves
idempotency against a dedicated test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves
it at 22). Targeted connector tests passed (15/15).

---

### 7.55 Fifty-sixth council — Gilgandra Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited standalone General Purpose Financial Statements
published by Gilgandra Shire Council at 2026-11-19, for the year ended 30 June 2026 (auditor's report
dated 29 October 2026). The statements are linked from the council's Financial Statements page
<https://www.gilgandra.nsw.gov.au/Your-Council/About-Council/Financial-information/Financial-Statements>;
the connector selects the FY2025-26 statements upload and ignores annual reports, budget documents and
prior years. The current upload is
<https://www.gilgandra.nsw.gov.au/files/assets/public/v/1/economic-development/inland-rail/submissions/annual_financial_statements-2026.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **403** (`text/html`, 545 bytes) to a bare Chrome UA and
**200** `application/pdf` (1,365,525 bytes) to a plain client UA. The connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a
focused test asserts that header is used and contains no `Chrome` token.

The 98-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p15 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **1,365,525**
- SHA-256: `e7929405861b2e9d6e5da1422016eb96c44b437c8dba0a5999f4dbe748236ab0`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$52,061` thousand | = `$52,061,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + net gain on disposal) | `$7,931` + `$23,542` + `$1,072` + `$13,408` + `$4,067` + `$1,854` + `$187` = `$52,061` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses) | `$23,744` + `$12,688` + `$182` + `$680` = `$37,294` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$10,275`) | `$37,294` + `$10,275` = `$47,569` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$52,061` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$47,569` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$4,492` thousand | = face operating result |
| B1-1 grants and contributions | `$17,475` thousand | = operating `$13,408` + capital `$4,067` |
| Operating result from continuing operations | `$52,061` − `$47,569` = `$4,492` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$4,492` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$4,492` − `$4,067` = `$425` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$4,492` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$5,955` thousand | = printed total other comprehensive income and total items not reclassified |
| Statement of Comprehensive Income total (`$4,492` + `$5,955` other comprehensive income) | `$10,447` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$37,294`
thousand) plus printed depreciation/amortisation/impairment (`$10,275` thousand), and equals the B1-1
"Total functions and activities" expense total (`$47,569` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**
for 2026. The B1-1 2025 operating-result comparative is printed as `$1,932` thousand against the
face `$1,920` thousand; only the 2026 column is used and checked. Gilgandra prints seven non-zero
revenue lines (no other-income line, plus a net gain on disposal `$187` thousand) and four expense
lines; it prints no net loss on disposal. The printed net result and before-capital result are both
positive.

**Rows.** 16 rows, source id `gilgandra-gpfs`, `source_dataset` "Gilgandra Shire Council GPFS
2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Gilgandra Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$52,061,000`, total expenses `$47,569,000`, employee expenses `$23,744,000`,
depreciation/amortisation/impairment `$10,275,000`, operating government grants `$13,408,000`,
capital government grants `$4,067,000`, borrowing costs `$182,000`, net gain on disposal of assets
`$187,000` and net result `$4,492,000`. The printed before-capital result is retained in
reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for the
reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `gilgandra-gpfs`
took the shared dev DB from **998,627** to **998,643** measures — exactly **+16** rows. GPFS rows
moved **1109 → 1125** and active GPFS `data_sources` **55 → 56**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 16 SHA-anchored natural keys, left the total at **998,643**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 16`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 16`, `records_upserted: 16`. All 16 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`gilgandra-gpfs/annual_financial_statements-2026.pdf` with its SHA-256 and retrieval metadata; no PDF
is committed. The focused connector test also proves idempotency against a dedicated test Mongo
(seeded 5 rows → 21 with 16 rows; a second ingest leaves it at 21). Targeted connector tests passed
(16/16).

---

### 7.56 Fifty-seventh council — Lockhart Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited standalone 3-in-1 General Purpose Financial
Statements published by Lockhart Shire Council at 2026-11-19, for the year ended 30 June 2026. The
statements are linked from the council's Council Policies, Plans and Reports page
<https://lockhart.nsw.gov.au/council/council-policies-plans-reports/>; the connector selects the
FY2025-26 statements upload and ignores annual reports, operational/delivery plans and prior years.
The current upload is
<https://lockhart.nsw.gov.au/wp-content/uploads/2026/11/Annual_Financial_Statements-2026-3-in-1.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

The 95-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p15 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **3,258,064**
- SHA-256: `e57168fa5be1ef8e4f6facd22f4244887d4e9bdbbb013ef6d3d746c0c63f3212`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$20,300` thousand | = `$20,300,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$4,311` + `$1,226` + `$811` + `$10,823` + `$2,698` + `$246` + `$179` + `$6` = `$20,300` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses) | `$4,551` + `$6,295` + `$125` + `$1,125` = `$12,096` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$7,079`) | `$12,096` + `$7,079` = `$19,175` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$20,300` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$19,175` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$1,125` thousand | = face operating result |
| B1-1 grants and contributions | `$13,521` thousand | = operating `$10,823` + capital `$2,698` |
| Operating result from continuing operations | `$20,300` − `$19,175` = `$1,125` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$1,125` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$1,125` − `$2,698` = `−$1,573` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$1,125` thousand | = Income Statement net result |
| Other comprehensive income for the year | revaluation `$30,885` thousand | = printed total other comprehensive income |
| Statement of Comprehensive Income total (`$1,125` + `$30,885` other comprehensive income) | `$32,010` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$12,096`
thousand) plus printed depreciation/amortisation/impairment (`$7,079` thousand), and equals the B1-1
"Total functions and activities" expense total (`$19,175` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Lockhart prints eight non-zero revenue lines (including other income and a net gain on disposal
`$6` thousand) and four expense lines; its net loss on disposal line is nil for 2026. The
Comprehensive Income statement labels its total-OCI line "Other comprehensive income for the year"
(no "Total" prefix), which the adapter reads explicitly. The printed net result is positive
(`$1,125` thousand) and the before-capital result is negative (`−$1,573` thousand).

**Rows.** 17 rows, source id `lockhart-gpfs`, `source_dataset` "Lockhart Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Lockhart Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$20,300,000`, total expenses `$19,175,000`, employee expenses `$4,551,000`,
depreciation/amortisation/impairment `$7,079,000`, operating government grants `$10,823,000`,
capital government grants `$2,698,000`, borrowing costs `$125,000`, net gain on disposal of assets
`$6,000`, other income `$179,000` and net result `$1,125,000`. The printed before-capital result is
retained in reconciliation evidence only and is not emitted as a row. The B1-1 function split is used
only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `lockhart-gpfs`
took the shared dev DB from **998,643** to **998,660** measures — exactly **+17** rows. GPFS rows
moved **1125 → 1142** and active GPFS `data_sources` **56 → 57**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,660**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`lockhart-gpfs/Annual_Financial_Statements-2026-3-in-1.pdf` with its SHA-256 and retrieval metadata;
no PDF is committed. The focused connector test also proves idempotency against a dedicated test Mongo
(seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector tests passed
(15/15).

---

### 7.57 Fifty-eighth council — Coonamble Shire Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest audited standalone General Purpose Financial Statements
published by Coonamble Shire Council at 2026-11-19; **no FY2025-26 GPFS is posted**. The accepted
current-available year is therefore FY2024-25, and the connector never substitutes a 2025-26 or
2023-24 document. The statements are linked from the council's Annual Reports page
<https://www.coonambleshire.nsw.gov.au/council/annual-report>. The correct domain is
`coonambleshire.nsw.gov.au` (`coonamble.nsw.gov.au` does not resolve). The current upload is
<https://www.coonambleshire.nsw.gov.au/Annual_Financial_Statements-2025%20final%20audited.pdf>. A
documented official fallback pin is used only if the page yields no usable anchor.

The 118-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p15 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **3,992,002**
- SHA-256: `b58ac76bad53bf610f1ea4f9aeff36e8ecd1eacf3416d41662dd568edf1c1b94`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$36,346` thousand | = `$36,346,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$7,960` + `$10,335` + `$1,825` + `$10,385` + `$4,308` + `$1,334` + `$117` + `$82` = `$36,346` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses) | `$11,784` + `$13,220` + `$32` + `$1,051` = `$26,087` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$8,057`) | `$26,087` + `$8,057` = `$34,144` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$36,346` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$34,144` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$2,202` thousand | = face operating result |
| B1-1 grants and contributions | `$14,693` thousand | = operating `$10,385` + capital `$4,308` |
| Operating result from continuing operations | `$36,346` − `$34,144` = `$2,202` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$2,202` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$2,202` − `$4,308` = `−$2,106` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$2,202` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$10,355` thousand | = printed total other comprehensive income and total items not reclassified |
| Statement of Comprehensive Income total (`$2,202` + `$10,355` other comprehensive income) | `$12,557` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$26,087`
thousand) plus printed depreciation/amortisation/impairment (`$8,057` thousand), and equals the B1-1
"Total functions and activities" expense total (`$34,144` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Coonamble prints eight non-zero revenue lines (including other income and a net gain on disposal
`$82` thousand) and four expense lines; it prints no net loss on disposal. The printed net result is
positive (`$2,202` thousand) and the before-capital result is negative (`−$2,106` thousand).

**Rows.** 17 rows, source id `coonamble-gpfs`, `source_dataset` "Coonamble Shire Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Coonamble Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$36,346,000`, total expenses `$34,144,000`, employee expenses `$11,784,000`,
depreciation/amortisation/impairment `$8,057,000`, operating government grants `$10,385,000`,
capital government grants `$4,308,000`, borrowing costs `$32,000`, net gain on disposal of assets
`$82,000`, other income `$117,000` and net result `$2,202,000`. The printed before-capital result is
retained in reconciliation evidence only and is not emitted as a row. The B1-1 function split is used
only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `coonamble-gpfs`
took the shared dev DB from **998,660** to **998,677** measures — exactly **+17** rows. GPFS rows
moved **1142 → 1159** and active GPFS `data_sources` **57 → 58**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,677**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2024-25"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`coonamble-gpfs/Annual_Financial_Statements-2025-final-audited.pdf` with its SHA-256 and retrieval
metadata; no PDF is committed. The focused connector test also proves idempotency against a dedicated
test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector
tests passed (16/16).

---

### 7.58 Fifty-ninth council — Weddin Shire Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest audited standalone General Purpose Financial Statements
published by Weddin Shire Council at 2026-11-19; **no FY2025-26 GPFS is posted**. The accepted
current-available year is therefore FY2024-25, and the connector never substitutes a 2025-26 or
2023-24 document. The statements are linked from the council's Integrated Planning and Reporting
Reports page <https://www.weddin.nsw.gov.au/Council/Integrated-Planning-and-Reporting/Reports>. The
current upload is
<https://www.weddin.nsw.gov.au/files/assets/public/v/1/council/plans-strategies-amp-reports/other-plans-amp-strategies/20251106-2024-2025-annual-financial-statements.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **403** (`text/html`, 599 bytes) to a bare Chrome UA and
**200** `application/pdf` (5,166,514 bytes) to a plain client UA. The connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a
focused test asserts that header is used and contains no `Chrome` token.

The 98-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p4,
Statement of Comprehensive Income p5 and B1-1 "Functions or activities" p13 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **5,166,514**
- SHA-256: `4c34af5f30efefc842b42c77f9f4b3b39567e98a40d598a8fc775aa66ddf309b`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$29,709` thousand | = `$29,709,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$4,632` + `$8,514` + `$1,301` + `$7,684` + `$6,831` + `$573` + `$174` = `$29,709` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$7,794` + `$16,151` + `$157` + `$399` + `$1,010` = `$25,511` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$6,234`) | `$25,511` + `$6,234` = `$31,745` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$29,709` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$31,745` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `−$2,036` thousand | = face operating result |
| B1-1 grants and contributions | `$14,515` thousand | = operating `$7,684` + capital `$6,831` |
| Operating result from continuing operations | `$29,709` − `$31,745` = `−$2,036` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `−$2,036` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `−$2,036` − `$6,831` = `−$8,867` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `−$2,036` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `$32,252` + impairment reversal `$4,058` + joint ventures `$904`) | `$37,214` thousand | = printed total other comprehensive income and total items not reclassified |
| Statement of Comprehensive Income total (`−$2,036` + `$37,214` other comprehensive income) | `$35,178` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$25,511`
thousand) plus printed depreciation/amortisation/impairment (`$6,234` thousand), and equals the B1-1
"Total functions and activities" expense total (`$31,745` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Weddin prints seven non-zero revenue lines (its net gain on disposal is nil and is not emitted) and
five expense lines including a net loss on disposal (`$1,010` thousand). The printed net result and
before-capital result are both negative; the net result is stored as a non-negative magnitude with a
negative sign marker.

**Rows.** 17 rows, source id `weddin-gpfs`, `source_dataset` "Weddin Shire Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Weddin Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$29,709,000`, total expenses `$31,745,000`, employee expenses `$7,794,000`,
depreciation/amortisation/impairment `$6,234,000`, operating government grants `$7,684,000`,
capital government grants `$6,831,000`, borrowing costs `$157,000`, net loss on disposal of assets
`$1,010,000`, other income `$174,000` and net result `$2,036,000` (negative, stored with a negative
sign marker). The printed before-capital result is retained in reconciliation evidence only and is not
emitted as a row. The B1-1 function split is used only for the reconciliation checks and is not
emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `weddin-gpfs`
took the shared dev DB from **998,677** to **998,694** measures — exactly **+17** rows. GPFS rows
moved **1159 → 1176** and active GPFS `data_sources` **58 → 59**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,694**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2024-25"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`weddin-gpfs/20251106-2024-2025-annual-financial-statements.pdf` with its SHA-256 and retrieval
metadata; no PDF is committed. The focused connector test also proves idempotency against a dedicated
test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector
tests passed (17/17).

---

### 7.59 Sixtieth council — Walcha Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest audited standalone General Purpose Financial Statements
published by Walcha Council at 2026-11-19; **no FY2025-26 GPFS is posted**, and the council's
annual-report page is stale (latest posted 2022-23). The accepted current-available year is therefore
FY2024-25, and the connector never substitutes a 2025-26 or 2023-24 document. The GPFS is discovered
from the official "2024-2025 Financial Statements" page
<https://walcha.nsw.gov.au/2024-2025-financial-statements/>; the special-purpose and special-schedules
PDFs on the same page are rejected. The current upload is
<https://walcha.nsw.gov.au/wp-content/uploads/2025/12/Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

The 77-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p15 — plus the independent
auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit rejects the
whole extraction. Exact bytes archived outside the repo:

- bytes: **1,883,547**
- SHA-256: `cc328f754a73a986cb4161cfcd462343b0b5893e85956cc03edb23f04b513e6c`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$34,522` thousand | = `$34,522,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$7,380` + `$5,990` + `$654` + `$6,598` + `$12,185` + `$872` + `$843` = `$34,522` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$9,214` + `$8,537` + `$177` + `$425` + `$722` = `$19,075` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$5,112`) | `$19,075` + `$5,112` = `$24,187` thousand | = printed B1-1 total expenses |
| Operating result from continuing operations | `$34,522` − `$24,187` = `$10,335` thousand | = printed operating result |
| Printed operating result + below-the-line business-combination gain (`$7,520`) | `$10,335` + `$7,520` = `$17,855` thousand | = printed net result |
| B1-1 Total functions and activities — income | `$42,042` thousand | = face total revenue + business-combination gain |
| B1-1 Total functions and activities — expenses | `$24,187` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$17,855` thousand | = printed net result |
| B1-1 grants and contributions | `$18,783` thousand | = operating `$6,598` + capital `$12,185` |
| Net operating result for the year attributable to Council | `$17,855` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$17,855` − `$12,185` = `$5,670` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$17,855` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$37,537` thousand | = printed total other comprehensive income and total items not reclassified |
| Statement of Comprehensive Income total (`$17,855` + `$37,537` other comprehensive income) | `$55,392` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$19,075`
thousand) plus printed depreciation/amortisation/impairment (`$5,112` thousand), and equals the B1-1
"Total functions and activities" expense total (`$24,187` thousand). Walcha's face statement prints an
operating result (`$10,335` thousand) and then a below-the-line "Business combinations — Gain from
business combinations" (`$7,520` thousand), giving the net result (`$17,855` thousand). B1-1 reports
income of `$42,042` thousand (total revenue plus that gain), expenses of `$24,187` thousand and an
operating result of `$17,855` thousand — so B1-1's operating result equals the printed net result, and
B1-1 income is **not** the face total revenue. The connector reconciles both bridges exactly; the
business-combination gain and the before-capital result are retained in reconciliation evidence only
and are not emitted as rows. Walcha prints seven non-zero revenue lines (its net gain on disposal is
nil) and five expense lines including a net loss on disposal (`$722` thousand). The printed net result
and before-capital result are both positive.

**Rows.** 17 rows, source id `walcha-gpfs`, `source_dataset` "Walcha Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Walcha Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$34,522,000`, total expenses `$24,187,000`, employee expenses `$9,214,000`,
depreciation/amortisation/impairment `$5,112,000`, operating government grants `$6,598,000`,
capital government grants `$12,185,000`, borrowing costs `$177,000`, net loss on disposal of assets
`$722,000`, other income `$843,000` and net result `$17,855,000`. The printed business-combination gain
and before-capital result are retained in reconciliation evidence only and are not emitted as rows.
The B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `walcha-gpfs`
took the shared dev DB from **998,694** to **998,711** measures — exactly **+17** rows. GPFS rows
moved **1176 → 1193** and active GPFS `data_sources` **59 → 60**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,711**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2024-25"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`walcha-gpfs/Walcha-Council-General-Purpose-Financial-Statements-20242025.pdf` with its SHA-256 and
retrieval metadata; no PDF is committed. The focused connector test also proves idempotency against a
dedicated test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted
connector tests passed (17/17).

---

### 7.60 Sixty-first council — Murrumbidgee Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest audited year published by Murrumbidgee Council at
2026-11-19; **no FY2025-26 GPFS is posted**. The accepted current-available year is therefore
FY2024-25, and the connector never substitutes a 2025-26 or 2023-24 document. The statement source is
the council's **Appendix A Financial Information** (not the narrative annual report), discovered from
the official Annual Reports and Financial Statements page
<https://www.murrumbidgee.nsw.gov.au/My-council/Plans-strategies-policies-council-information/Reporting-our-progress/Annual-Reports-Financial-Statements>.
The current upload is
<https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/1/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf>,
which redirects to the `/v/2/` path; both are recorded. A documented official fallback pin is used
only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **403** (`text/html`, 554 bytes) to a bare Chrome UA and
**200** `application/pdf` (1,063,092 bytes) to a plain client UA. The connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a
focused test asserts that header is used and contains no `Chrome` token.

The 100-page Appendix A PDF contains the signed General Purpose Financial Statements — Income
Statement PDF p4, Statement of Comprehensive Income p5 and B1-1 "Functions or activities" p13 — plus
the notes and the independent auditor's reports. The printed unit is explicit `$ '000`; a missing or
conflicting unit rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **1,063,092**
- SHA-256: `a279e11fdd620d4ea7f08794ea93e8671adafc502ed2e18069fe6b09ff9b0fc1`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$30,190` thousand | = `$30,190,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + net gain on disposal + other income) | `$6,893` + `$3,184` + `$455` + `$9,519` + `$8,183` + `$1,408` + `$360` + `$188` = `$30,190` thousand | = printed total |
| Expense-by-nature components sum (employee + materials + borrowing costs + other expenses) | `$10,401` + `$7,404` + `$8` + `$713` = `$18,526` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$8,550`) | `$18,526` + `$8,550` = `$27,076` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$30,190` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$27,076` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$3,114` thousand | = face operating result |
| B1-1 grants and contributions | `$17,702` thousand | = operating `$9,519` + capital `$8,183` |
| Operating result from continuing operations | `$30,190` − `$27,076` = `$3,114` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$3,114` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$3,114` − `$8,183` = `−$5,069` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$3,114` thousand | = Income Statement net result |
| Other comprehensive income (revaluation of IPP&E) | `$15,836` thousand | = printed total other comprehensive income for the period and total items not reclassified |
| Statement of Comprehensive Income total (`$3,114` + `$15,836` other comprehensive income) | `$18,950` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$18,526`
thousand) plus printed depreciation/amortisation/impairment (`$8,550` thousand), and equals the B1-1
"Total functions and activities" expense total (`$27,076` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Murrumbidgee prints eight non-zero revenue lines (including a net gain on disposal `$360` thousand and
other income `$188` thousand). Its printed net loss on disposal of assets is nil for 2025 and is not
parsed or emitted (the 2024 comparative is never read). The Comprehensive Income statement labels its
total-OCI line "Total other comprehensive income for the period"; the adapter reads that label
explicitly. The printed net result is positive (`$3,114` thousand) and the before-capital result is
negative (`−$5,069` thousand).

**Rows.** 17 rows, source id `murrumbidgee-gpfs`, `source_dataset` "Murrumbidgee Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Murrumbidgee Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$30,190,000`, total expenses `$27,076,000`, employee expenses `$10,401,000`,
depreciation/amortisation/impairment `$8,550,000`, operating government grants `$9,519,000`,
capital government grants `$8,183,000`, borrowing costs `$8,000`, net gain on disposal of assets
`$360,000`, other income `$188,000` and net result `$3,114,000`. The printed before-capital result is
retained in reconciliation evidence only and is not emitted as a row. The B1-1 function split is used
only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`murrumbidgee-gpfs` took the shared dev DB from **998,711** to **998,728** measures — exactly **+17**
rows. GPFS rows moved **1193 → 1210** and active GPFS `data_sources` **60 → 61**; the SOC measure
count (rows with `jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was
unchanged. A second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at
**998,728** and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2024-25"`. Both
the council URL and the resolved `/v/2/` URL are recorded in the row provenance. The exact PDF is
archived outside the repo under the configured source-archive root at
`murrumbidgee-gpfs/appendix-a-financial-information.pdf` with its SHA-256 and retrieval metadata; no
PDF is committed. The focused connector test also proves idempotency against a dedicated test Mongo
(seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector tests passed
(17/17).

---

### 7.61 Sixty-second council item — Central Darling Shire Council FY2024-25 (DEFERRED, no rows)

**Decision: defer, do not ingest or invent rows.** The council does not publish a standalone full
General Purpose Financial Statements PDF. The official FY2024-25 annual report
<https://www.centraldarling.nsw.gov.au/files/assets/public/v/1/governance/annual-report/2024-2025-annual-report/annual-report-2024-2205-final.pdf>
(HTTP 200, `application/pdf`, 9,421,161 bytes, SHA-256
`e00628ff2d75c2c71c354dffca1f2c7e1086c8ff566f1b5279fc3f1a9e540070`, 151 PDF pages; plain UA 200,
bare Chrome UA 403) contains an "Audited Financial Statements 2024 - 2025" section starting at PDF
page 49. That section is **scanned images with no text layer**: pdfjs extraction returns only the
page-45 section title and page numbers for the following **102 pages (PDF pp. 50–151)**. No Income
Statement, Statement of Comprehensive Income, B1-1 statement line or printed reconciling total can be
read, so no `$ '000` unit or zero-tolerance reconciliation is possible.

The 2025-26 "GPFS" link is a one-page presentation notice, not statements, and was rejected; no prior
year or narrative figure was substituted. No `central-darling-gpfs` connector was registered and no
rows were invented or ingested. The DB stays at **998,728** measures with **205** SOC rows and **61**
active GPFS sources; a `deferred_soc_documents` record for `central-darling-gpfs` records the exact
gap (scanned pages 49–151, no text layer). Full evidence:
`docs/source-discovery/nsw-councils/central-darling-gpfs.md`.

---

### 7.62 Sixty-second landed council — Armidale Regional Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited year published by Armidale Regional Council at
2026-11-19: the statements are for the **year ended 30 June 2026**. The connector targets `2025-26`
and never substitutes a 2024-25 or 2026-27 document. The statement source is the council's
**standalone audited financial statements** (not the narrative annual report), discovered from the
official Financial statements page
<https://www.armidale.nsw.gov.au/Council/Administration/Financial-statements>. The current upload is
<https://www.armidale.nsw.gov.au/files/assets/public/v/1/council/documents/final_audited-financial-statements-2025-26.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **403** to a bare Chrome UA and **200**
`application/pdf` (2,568,853 bytes) to a plain client UA. The connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a
focused test asserts that header is used and contains no `Chrome` token.

The 93-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **2,568,853**
- SHA-256: `c43ab813cfaa8f64aee298887d0b1c0b2b3217e3ccf11809353d675068b112a6`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$140,909` thousand | = `$140,909,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$52,217` + `$32,663` + `$4,856` + `$18,033` + `$24,833` + `$7,198` + `$1,109` = `$140,909` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$35,890` + `$38,670` + `$990` + `$2,043` + `$5,424` = `$83,017` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$27,927`) | `$83,017` + `$27,927` = `$110,944` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$140,909` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$110,944` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$29,965` thousand | = face operating result |
| B1-1 grants and contributions | `$42,866` thousand | = operating `$18,033` + capital `$24,833` |
| Operating result from continuing operations | `$140,909` − `$110,944` = `$29,965` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$29,965` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$29,965` − `$24,833` = `$5,132` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$29,965` thousand | = Income Statement net result |
| Other comprehensive income (revaluation of infrastructure, property, plant and equipment) | `$44,164` thousand | = printed total other comprehensive income for the year and total items not reclassified |
| Statement of Comprehensive Income total (`$29,965` + `$44,164` other comprehensive income) | `$74,129` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$83,017`
thousand) plus printed depreciation/amortisation/impairment (`$27,927` thousand), and equals the B1-1
"Total functions and activities" expense total (`$110,944` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Armidale prints seven revenue lines and five expense lines, including a real printed **net loss on
the disposal of assets** (`$5,424` thousand), which is emitted as an expense row. Its before-capital
result is positive (`$5,132` thousand) and is retained in reconciliation evidence only. The
Comprehensive Income statement labels its total-OCI line "Total other comprehensive income for the
year"; the adapter reads that label explicitly.

**Rows.** 17 rows, source id `armidale-gpfs`, `source_dataset` "Armidale Regional Council GPFS
2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Armidale Regional Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$14,090,900,000`, total expenses `$11,094,400,000`, employee expenses `$3,589,000,000`,
depreciation/amortisation/impairment `$2,792,700,000`, operating government grants `$1,803,300,000`,
capital government grants `$2,483,300,000`, borrowing costs `$99,000,000`, net loss on disposal of
assets `$542,400,000`, other income `$110,900,000` and net result `$2,996,500,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`armidale-gpfs` took the shared dev DB from **998,728** to **998,745** measures — exactly **+17**
rows. GPFS rows moved **1210 → 1227** and active GPFS `data_sources` **61 → 62**; the SOC measure
count (rows with `jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was
unchanged. A second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at
**998,745** and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`armidale-gpfs/final_audited-financial-statements-2025-26.pdf` with its SHA-256 and retrieval
metadata; no PDF is committed. The focused connector test also proves idempotency against a dedicated
test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector
tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/armidale-gpfs.md`.

---

### 7.63 Sixty-third landed council — Byron Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited year published by Byron Shire Council at
2026-11-19: the statements are for the **year ended 30 June 2026**. The connector targets `2025-26`
and never substitutes a 2024-25 or 2026-27 document. The statement source is the council's
**standalone audited financial statements** (not the paired annual report), discovered from the
official Reports on Our Progress page
<https://www.byron.nsw.gov.au/Council/Plans-Strategies/Council-Planning-Reporting/Reports-on-Our-Progress>.
The current upload is
<https://www.byron.nsw.gov.au/files/assets/public/v/2/hptrim/financial-management-budgeting-operational-budget-documentation-20262027/final-published-2025-26-financial-statements-byron-shire-council.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **403** to a bare Chrome UA and **200**
`application/pdf` (3,221,859 bytes) to a plain client UA. The connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a
focused test asserts that header is used and contains no `Chrome` token.

The 112-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p15 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **3,221,859**
- SHA-256: `a28fe05f984ef47a2e1ae158b1500c862a0a5870bb435f8eed737006b3d42aec`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$188,568` thousand | = `$188,568,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$70,384` + `$37,841` + `$2,687` + `$17,895` + `$53,137` + `$4,654` + `$1,970` = `$188,568` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$38,264` + `$64,620` + `$2,536` + `$3,002` + `$5,805` = `$114,227` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$26,499`) | `$114,227` + `$26,499` = `$140,726` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$188,568` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$140,726` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$47,842` thousand | = face operating result |
| B1-1 grants and contributions | `$71,032` thousand | = operating `$17,895` + capital `$53,137` |
| Operating result from continuing operations | `$188,568` − `$140,726` = `$47,842` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$47,842` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$47,842` − `$53,137` = `−$5,295` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$47,842` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `−$58,766` + impairment reversal `$191` + joint ventures `$103`) | `−$58,472` thousand | = printed total other comprehensive income for the year and total items not reclassified |
| Statement of Comprehensive Income total (`$47,842` + `−$58,472` other comprehensive income) | `−$10,630` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$114,227`
thousand) plus printed depreciation/amortisation/impairment (`$26,499` thousand), and equals the B1-1
"Total functions and activities" expense total (`$140,726` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Byron prints seven revenue lines and five expense lines, including a real printed **net loss on the
disposal of assets** (`$5,805` thousand), which is emitted as an expense row. Its before-capital
result is negative (`−$5,295` thousand) and is retained in reconciliation evidence only. Other
comprehensive income has three printed components (revaluation loss, impairment reversal and joint
ventures/associates); the adapter sums them and checks that sum against the printed total OCI
(`−$58,472` thousand) and the printed total items not reclassified.

**Rows.** 17 rows, source id `byron-gpfs`, `source_dataset` "Byron Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Byron Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$18,856,800,000`, total expenses `$14,072,600,000`, employee expenses `$3,826,400,000`,
depreciation/amortisation/impairment `$2,649,900,000`, operating government grants `$1,789,500,000`,
capital government grants `$5,313,700,000`, borrowing costs `$253,600,000`, net loss on disposal of
assets `$580,500,000`, other income `$197,000,000` and net result `$4,784,200,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `byron-gpfs`
took the shared dev DB from **998,745** to **998,762** measures — exactly **+17** rows. GPFS rows
moved **1227 → 1244** and active GPFS `data_sources` **62 → 63**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,762**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`byron-gpfs/final-published-2025-26-financial-statements-byron-shire-council.pdf` with its SHA-256
and retrieval metadata; no PDF is committed. The focused connector test also proves idempotency
against a dedicated test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22).
Targeted connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/byron-gpfs.md`.

---

### 7.64 Sixty-fourth landed council — Clarence Valley Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited year published by Clarence Valley Council at
2026-11-19: the statements are for the **year ended 30 June 2026**. The connector targets `2025-26`
and never substitutes a 2024-25 or 2026-27 document. The statement source is the council's
**standalone financial statements** (not the narrative annual report). The official Annual Reports and
statements page
<https://www.clarence.nsw.gov.au/Council/Our-performance/Annual-Reports-and-statements> lists the
2025-26 annual report but (at check time) does **not yet link the 2025-26 AFS**; the statements are on
the council's `/home-page/on-exhibition/` path at
<https://www.clarence.nsw.gov.au/files/assets/public/v/1/home-page/on-exhibition/clarence-valley-council-financial-statements-2025-26.pdf>.
The connector discovers any FY2025-26 financial-statements anchor from the official page and uses the
**documented official fallback pin** (that exact PDF URL) only when the page yields no usable anchor —
which is the live case at 2026-11-19. Correct host is `clarence.nsw.gov.au`
(`clarencevalley.nsw.gov.au` does not resolve).

**Akamai UA method.** The host's WAF returns **200** `application/pdf` (3,602,292 bytes) to a plain
client UA and a bare Chrome UA can return **403**. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used and contains no `Chrome` token.

The 105-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p15 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **3,602,292**
- SHA-256: `080fe8a0808ce675aca13c8750bf3a18c07328fc674e4f7e11fff4b59708e72b`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$264,653` thousand | = `$264,653,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$85,316` + `$55,355` + `$3,206` + `$40,542` + `$71,249` + `$8,122` + `$863` = `$264,653` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$51,113` + `$62,239` + `$5,672` + `$7,530` + `$2,825` = `$129,379` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$63,904`) | `$129,379` + `$63,904` = `$193,283` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$264,653` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$193,283` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$71,370` thousand | = face operating result |
| B1-1 grants and contributions | `$111,791` thousand | = operating `$40,542` + capital `$71,249` |
| Operating result from continuing operations | `$264,653` − `$193,283` = `$71,370` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$71,370` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$71,370` − `$71,249` = `$121` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$71,370` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `$6,786` + impairment reversal `$3,866`) | `$10,652` thousand | = printed Other comprehensive income for the year |
| Statement of Comprehensive Income total (`$71,370` + `$10,652` other comprehensive income) | `$82,022` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$129,379`
thousand) plus printed depreciation/amortisation/impairment (`$63,904` thousand), and equals the B1-1
"Total functions and activities" expense total (`$193,283` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Clarence Valley prints seven revenue lines and five expense lines, including a real printed **net
loss on the disposal of assets** (`$2,825` thousand), which is emitted as an expense row. Its
before-capital result is positive (`$121` thousand) and is retained in reconciliation evidence only.
Other comprehensive income has two printed components (revaluation gain and impairment reversal); the
adapter sums them and checks that sum against the printed OCI (`$10,652` thousand).

**Rows.** 17 rows, source id `clarence-valley-gpfs`, `source_dataset` "Clarence Valley Council GPFS
2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Clarence Valley Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$26,465,300,000`, total expenses `$19,328,300,000`, employee expenses `$5,111,300,000`,
depreciation/amortisation/impairment `$6,390,400,000`, operating government grants `$4,054,200,000`,
capital government grants `$7,124,900,000`, borrowing costs `$567,200,000`, net loss on disposal of
assets `$282,500,000`, other income `$86,300,000` and net result `$7,137,000,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`clarence-valley-gpfs` took the shared dev DB from **998,762** to **998,779** measures — exactly
**+17** rows. GPFS rows moved **1244 → 1261** and active GPFS `data_sources` **63 → 64**; the SOC
measure count (rows with `jurisdiction_level: "soc"`) stayed at **205** and every other per-source
count was unchanged. A second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the
total at **998,779** and created no duplicate (idempotent). `data_sources` records the source
`active` with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`clarence-valley-gpfs/clarence-valley-council-financial-statements-2025-26.pdf` with its SHA-256 and
retrieval metadata; no PDF is committed. The focused connector test also proves idempotency against a
dedicated test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted
connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/clarence-valley-gpfs.md`.

---

### 7.65 Sixty-fifth landed council — Richmond Valley Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited year published by Richmond Valley Council at
2026-11-19: the statements are for the **year ended 30 June 2026**. The connector targets `2025-26`
and never substitutes a 2024-25 or 2026-27 document. The statement source is the council's
**standalone financial statements** (not the narrative annual report), discovered from the official
Budgets & Financial Reports page
<https://richmondvalley.nsw.gov.au/council/governance/budgets-and-financial-reports/>. The current
upload is
<https://richmondvalley.nsw.gov.au/wp-content/uploads/2026/10/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf>.
The separate Annual Reports page only carries annual reports; the FS series is on the Budgets &
Financial Reports page. A documented official fallback pin is used only if the page yields no usable
anchor.

**Plain-UA method.** The WordPress media PDFs serve normally to plain fetch; the connector sends an
explicit plain `curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery
and download, and a focused test asserts that header is used.

The 120-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p15 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **2,803,124**
- SHA-256: `aad1a9a65df3fbb58291444b9cb38347b4eb85d025f7dd9e41ecb57005703b2f`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$121,138` thousand | = `$121,138,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$35,348` + `$21,218` + `$98` + `$22,039` + `$36,171` + `$3,099` + `$3,165` = `$121,138` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$27,939` + `$31,406` + `$640` + `$2,549` + `$6,393` = `$68,927` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$26,519`) | `$68,927` + `$26,519` = `$95,446` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$121,138` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$95,446` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$25,692` thousand | = face operating result |
| B1-1 grants and contributions | `$58,210` thousand | = operating `$22,039` + capital `$36,171` |
| Operating result from continuing operations | `$121,138` − `$95,446` = `$25,692` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$25,692` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$25,692` − `$36,171` = `−$10,479` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$25,692` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `$14,492` + impairment reversal `$5,703`) | `$20,195` thousand | = printed total other comprehensive income for the year and total items not reclassified |
| Statement of Comprehensive Income total (`$25,692` + `$20,195` other comprehensive income) | `$45,887` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$68,927`
thousand) plus printed depreciation/amortisation/impairment (`$26,519` thousand), and equals the B1-1
"Total functions and activities" expense total (`$95,446` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Richmond Valley prints seven revenue lines and five expense lines, including a real printed **net loss
on the disposal of assets** (`$6,393` thousand), which is emitted as an expense row. Its
before-capital result is negative (`−$10,479` thousand) and is retained in reconciliation evidence
only. Other comprehensive income has two printed components (revaluation gain and impairment
reversal); the adapter sums them and checks that sum against the printed total OCI (`$20,195`
thousand) and the printed total items not reclassified.

**Rows.** 17 rows, source id `richmond-valley-gpfs`, `source_dataset` "Richmond Valley Council GPFS
2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Richmond Valley Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$12,113,800,000`, total expenses `$9,544,600,000`, employee expenses `$2,793,900,000`,
depreciation/amortisation/impairment `$2,651,900,000`, operating government grants `$2,203,900,000`,
capital government grants `$3,617,100,000`, borrowing costs `$64,000,000`, net loss on disposal of
assets `$639,300,000`, other income `$316,500,000` and net result `$2,569,200,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`richmond-valley-gpfs` took the shared dev DB from **998,779** to **998,796** measures — exactly
**+17** rows. GPFS rows moved **1261 → 1278** and active GPFS `data_sources` **64 → 65**; the SOC
measure count (rows with `jurisdiction_level: "soc"`) stayed at **205** and every other per-source
count was unchanged. A second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the
total at **998,796** and created no duplicate (idempotent). `data_sources` records the source
`active` with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`richmond-valley-gpfs/Richmond-Valley-Council-Financial-Statements-for-the-year-ended-30-June-2026.pdf`
with its SHA-256 and retrieval metadata; no PDF is committed. The focused connector test also proves
idempotency against a dedicated test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves
it at 22). Targeted connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/richmond-valley-gpfs.md`.

---

### 7.66 Sixty-sixth landed council — Kempsey Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited year published by Kempsey Shire Council at
2026-11-19: the **annual report Part C** is the audited financial statements for the year ended
30 June 2026. The connector targets `2025-26` and never substitutes a 2026-27 or 2023-24 document.
The statement source is Part C (not the Part A/B narrative sections), discovered from the official
Annual reports & publications page
<https://www.kempsey.nsw.gov.au/Your-Council/Publications/Annual-reports-publications>. The current
upload is
<https://www.kempsey.nsw.gov.au/files/sharedassets/public/v/1/docs/departments/corporate-performance/planning-amp-reporting/2026-27/10-2-3-2025-26-annual-report-part-c-audited-financial-statements.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Fiscal-year parsing.** Current URLs carry the publication folder (`/2026-27/`) before the document
file name (`2025-26`); the link parser uses the **last** consecutive year range in the URL, so the
current Part C maps to `2025-26`, not the folder year.

**Akamai UA method.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf` (3,663,303 bytes); a bare Chrome UA can return **403**. The connector sends an
explicit plain `curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the
PDF, and a focused test asserts that header is used.

The 108-page Part C PDF contains the signed General Purpose Financial Statements — Income Statement
PDF p5, Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes
and the independent auditor's reports. The printed unit is explicit `$ '000`; a missing or
conflicting unit rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **3,663,303**
- SHA-256: `41de47285941f3b7bb9c44f07710fa5de7c6ee18cc780a95b6932a55c202cca1`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$177,779` thousand | = `$177,779,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest) | `$59,174` + `$22,184` + `$3,013` + `$30,848` + `$53,755` + `$8,805` = `$177,779` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$34,710` + `$36,590` + `$2,924` + `$3,427` + `$4,881` = `$82,532` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$28,560`) | `$82,532` + `$28,560` = `$111,092` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$177,779` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$111,092` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$66,687` thousand | = face operating result |
| B1-1 grants and contributions | `$84,603` thousand | = operating `$30,848` + capital `$53,755` |
| Operating result from continuing operations | `$177,779` − `$111,092` = `$66,687` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$66,687` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$66,687` − `$53,755` = `$12,932` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$66,687` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$55,279` thousand | = printed total other comprehensive income for the year and total items not reclassified |
| Statement of Comprehensive Income total (`$66,687` + `$55,279` other comprehensive income) | `$121,966` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$82,532`
thousand) plus printed depreciation/amortisation/impairment (`$28,560` thousand), and equals the B1-1
"Total functions and activities" expense total (`$111,092` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Kempsey prints **six revenue lines** (no separate "Other income" line) and five expense lines,
including a real printed **net loss on the disposal of assets** (`$4,881` thousand), which is emitted
as an expense row. Its before-capital result is positive (`$12,932` thousand) and is retained in
reconciliation evidence only. Other comprehensive income has a single printed component
(revaluation gain); the adapter checks it against the printed total OCI (`$55,279` thousand).

**Rows.** 16 rows, source id `kempsey-gpfs`, `source_dataset` "Kempsey Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Kempsey Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$17,777,900,000`, total expenses `$11,109,200,000`, employee expenses `$3,471,000,000`,
depreciation/amortisation/impairment `$2,856,000,000`, operating government grants `$3,084,800,000`,
capital government grants `$5,375,500,000`, borrowing costs `$292,400,000`, net loss on disposal of
assets `$488,100,000` and net result `$6,668,700,000`. The printed before-capital result is retained
in reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for
the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `kempsey-gpfs`
took the shared dev DB from **998,796** to **998,812** measures — exactly **+16** rows. GPFS rows
moved **1278 → 1294** and active GPFS `data_sources` **65 → 66**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 16 SHA-anchored natural keys, left the total at **998,812**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 16`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 16`, `records_upserted: 16`. All 16 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`kempsey-gpfs/10-2-3-2025-26-annual-report-part-c-audited-financial-statements.pdf` with its SHA-256
and retrieval metadata; no PDF is committed. The focused connector test also proves idempotency
against a dedicated test Mongo (seeded 5 rows → 21 with 16 rows; a second ingest leaves it at 21).
Targeted connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/kempsey-gpfs.md`.

---

### 7.67 Sixty-seventh landed council — Wingecarribee Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited year published by Wingecarribee Shire Council at
2026-11-19: the statement is for the **year ended 30 June 2026**. The connector targets `2025-26` and
never substitutes a 2026-27 or 2023-24 document. The statement source is the council's **standalone
audited financial statement** (not the paired annual report), discovered from the official Council
Reports page
<https://www.wsc.nsw.gov.au/Council/Policies-Strategies-and-Reports/Council-Reports>. The current
upload is
<https://www.wsc.nsw.gov.au/files/assets/public/v/2/council/policies/wsc-audited-financial-statement-2025-2026.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **200** `application/pdf` (2,504,988 bytes) to a plain
client UA and **403** to a bare Chrome UA. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used.

The 104-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p4,
Statement of Comprehensive Income p5 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **2,504,988**
- SHA-256: `ead33e18c1069ee693ae33dcd4e4f653ab68a05369cec6150301145b8f0b0fe0`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$199,892` thousand | = `$199,892,000` |
| Revenue components sum (rates + user charges + other revenue + operating grants + capital grants + interest + other income) | `$107,402` + `$30,701` + `$2,525` + `$11,491` + `$35,163` + `$11,361` + `$1,249` = `$199,892` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$51,923` + `$55,801` + `$2,834` + `$4,540` + `$1,891` = `$116,989` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$41,813`) | `$116,989` + `$41,813` = `$158,802` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$199,892` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$158,802` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$41,090` thousand | = face operating result |
| B1-1 grants and contributions | `$46,654` thousand | = operating `$11,491` + capital `$35,163` |
| Operating result from continuing operations | `$199,892` − `$158,802` = `$41,090` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$41,090` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$41,090` − `$35,163` = `$5,927` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$41,090` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$65,755` thousand | = printed Other comprehensive income for the year |
| Statement of Comprehensive Income total (`$41,090` + `$65,755` other comprehensive income) | `$106,845` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$116,989`
thousand) plus printed depreciation/amortisation/impairment (`$41,813` thousand), and equals the B1-1
"Total functions and activities" expense total (`$158,802` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Wingecarribee prints seven revenue lines (including a separate "Other income") and five expense lines,
including a real printed **net loss on the disposal of assets** (`$1,891` thousand), which is emitted
as an expense row. Its before-capital result is positive (`$5,927` thousand) and is retained in
reconciliation evidence only. Other comprehensive income has a single printed component
(revaluation gain); the adapter checks it against the printed OCI (`$65,755` thousand).

**Rows.** 17 rows, source id `wingecarribee-gpfs`, `source_dataset` "Wingecarribee Shire Council GPFS
2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Wingecarribee Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$19,989,200,000`, total expenses `$15,880,200,000`, employee expenses `$5,192,300,000`,
depreciation/amortisation/impairment `$4,181,300,000`, operating government grants `$1,149,100,000`,
capital government grants `$3,516,300,000`, borrowing costs `$283,400,000`, net loss on disposal of
assets `$189,100,000`, other income `$124,900,000` and net result `$4,109,000,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`wingecarribee-gpfs` took the shared dev DB from **998,812** to **998,829** measures — exactly
**+17** rows. GPFS rows moved **1294 → 1311** and active GPFS `data_sources` **66 → 67**; the SOC
measure count (rows with `jurisdiction_level: "soc"`) stayed at **205** and every other per-source
count was unchanged. A second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the
total at **998,829** and created no duplicate (idempotent). `data_sources` records the source
`active` with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`wingecarribee-gpfs/wsc-audited-financial-statement-2025-2026.pdf` with its SHA-256 and retrieval
metadata; no PDF is committed. The focused connector test also proves idempotency against a dedicated
test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector
tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/wingecarribee-gpfs.md`.

---

### 7.68 Sixty-eighth landed council — Queanbeyan-Palerang Regional Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited year published by Queanbeyan-Palerang Regional
Council at 2026-11-19: the statements are for the **year ended 30 June 2026**. The connector targets
`2025-26` and never substitutes a 2026-27 or 2023-24 document. The statement source is the council's
**standalone financial statements** (not the paired annual report), discovered from the official
Budgets-and-Planning page
<https://www.qprc.nsw.gov.au/Council/Council-Business/Budgets-and-Planning>. The current upload is
<https://www.qprc.nsw.gov.au/files/assets/public/v/1/council/budgets-and-planning/financial_statements-2025-2026.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **200** `application/pdf` (3,320,800 bytes) to a plain
client UA and **403** (`text/html`, 518 bytes) to a bare Chrome UA. The connector sends an explicit
plain `curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a
focused test asserts that header is used.

The 97-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **3,320,800**
- SHA-256: `81908dc2ad97c2f9c2a5cff3217096e587d45b3d9be153944914a9a26ae79b51`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$278,036` thousand | = `$278,036,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$125,200` + `$52,972` + `$1,834` + `$19,052` + `$59,340` + `$13,978` + `$5,660` = `$278,036` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$55,436` + `$82,414` + `$10,729` + `$3,795` + `$16,345` = `$168,719` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$47,965`) | `$168,719` + `$47,965` = `$216,684` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$278,036` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$216,684` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$61,352` thousand | = face operating result |
| B1-1 grants and contributions | `$78,392` thousand | = operating `$19,052` + capital `$59,340` |
| Operating result from continuing operations | `$278,036` − `$216,684` = `$61,352` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$61,352` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$61,352` − `$59,340` = `$2,012` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$61,352` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$123,457` thousand | = printed Total other comprehensive income for the year |
| Statement of Comprehensive Income total (`$61,352` + `$123,457` other comprehensive income) | `$184,809` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$168,719`
thousand) plus printed depreciation/amortisation/impairment (`$47,965` thousand), and equals the B1-1
"Total functions and activities" expense total (`$216,684` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Queanbeyan-Palerang prints seven revenue lines and five expense lines, including a real printed **net
loss on the disposal of assets** (`$16,345` thousand), which is emitted as an expense row. Its
before-capital result is positive (`$2,012` thousand) and is retained in reconciliation evidence only.
Other comprehensive income has a single printed component (revaluation gain); the adapter checks it
against the printed OCI (`$123,457` thousand).

**Rows.** 17 rows, source id `queanbeyan-palerang-gpfs`, `source_dataset` "Queanbeyan-Palerang
Regional Council GPFS 2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`,
`jurisdiction_level: "local"`, `jurisdiction: "NSW"`, `delivery_entity: "Queanbeyan-Palerang
Regional Council"`, `data_quality_flag: "provisional/local_government"`, `verified: false`. The
minimum lines are total revenue `$27,803,600,000`, total expenses `$21,668,400,000`, employee
expenses `$5,543,600,000`, depreciation/amortisation/impairment `$4,796,500,000`, operating
government grants `$1,905,200,000`, capital government grants `$5,934,000,000`, borrowing costs
`$1,072,900,000`, net loss on disposal of assets `$1,634,500,000`, other income `$566,000,000` and
net result `$6,135,200,000`. The printed before-capital result is retained in reconciliation evidence
only and is not emitted as a row. The B1-1 function split is used only for the reconciliation checks
and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`queanbeyan-palerang-gpfs` took the shared dev DB from **998,829** to **998,846** measures — exactly
**+17** rows. GPFS rows moved **1311 → 1328** and active GPFS `data_sources` **67 → 68**; the SOC
measure count (rows with `jurisdiction_level: "soc"`) stayed at **205** and every other per-source
count was unchanged. A second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the
total at **998,846** and created no duplicate (idempotent). `data_sources` records the source
`active` with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`queanbeyan-palerang-gpfs/financial_statements-2025-2026.pdf` with its SHA-256 and retrieval
metadata; no PDF is committed. The focused connector test also proves idempotency against a dedicated
test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector
tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/queanbeyan-palerang-gpfs.md`.

---

### 7.69 Sixty-ninth landed council — Goulburn Mulwaree Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest published audited standalone General Purpose Financial
Statements at 2026-11-19: the statements are for the **year ended 30 June 2025**. No FY2025-26 GPFS is
posted. The accepted current-available year is therefore `2024-25`; the connector targets `2024-25`
and never substitutes a 2025-26 or 2023-24 document. The statement source is the council's
**standalone audited financial statements** (not the paired annual report), discovered from the
official Integrated Planning Reporting page
<https://www.goulburn.nsw.gov.au/Council/Integrated-Planning-Reporting>. The current upload is
<https://www.goulburn.nsw.gov.au/files/sharedassets/public/v/1/finance-ipampr-docs/gmc-financial-statements-2024-2025.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **200** `application/pdf` (4,127,664 bytes) to a plain
client UA and **403** to a bare Chrome UA. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used.

The 109-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **4,127,664**
- SHA-256: `8c8e17c0ad6a0dd4066e734839edb47911ec006fd5d394e999390a1bdf1aac6f`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$147,177` thousand | = `$147,177,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$49,576` + `$23,936` + `$2,255` + `$11,759` + `$52,686` + `$6,950` + `$15` = `$147,177` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$32,738` + `$30,237` + `$1,826` + `$943` + `$3,332` = `$69,076` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$31,232`) | `$69,076` + `$31,232` = `$100,308` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$147,177` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$100,308` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$46,869` thousand | = face operating result |
| B1-1 grants and contributions | `$64,445` thousand | = operating `$11,759` + capital `$52,686` |
| Operating result from continuing operations | `$147,177` − `$100,308` = `$46,869` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$46,869` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$46,869` − `$52,686` = `−$5,817` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$46,869` thousand | = Income Statement net result |
| Other comprehensive income (revaluation loss) | `−$42,544` thousand | = printed total other comprehensive income for the year and total items not reclassified |
| Statement of Comprehensive Income total (`$46,869` + `−$42,544` other comprehensive income) | `$4,325` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$69,076`
thousand) plus printed depreciation/amortisation/impairment (`$31,232` thousand), and equals the B1-1
"Total functions and activities" expense total (`$100,308` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Goulburn Mulwaree prints seven revenue lines and five expense lines, including a real printed **net
loss on the disposal of assets** (`$3,332` thousand), which is emitted as an expense row; the printed
net gain on disposal is nil and is not emitted. Its before-capital result is negative (`−$5,817`
thousand) and is retained in reconciliation evidence only. Other comprehensive income has a single
printed component (revaluation loss `−$42,544` thousand); the adapter checks it against the printed
OCI.

**Rows.** 17 rows, source id `goulburn-mulwaree-gpfs`, `source_dataset` "Goulburn Mulwaree Council
GPFS 2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Goulburn Mulwaree Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$14,717,700,000`, total expenses `$10,030,800,000`, employee expenses `$3,273,800,000`,
depreciation/amortisation/impairment `$3,123,200,000`, operating government grants `$1,175,900,000`,
capital government grants `$5,268,600,000`, borrowing costs `$182,600,000`, net loss on disposal of
assets `$333,200,000`, other income `$1,500,000` and net result `$4,686,900,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`goulburn-mulwaree-gpfs` took the shared dev DB from **998,846** to **998,863** measures — exactly
**+17** rows. GPFS rows moved **1328 → 1345** and active GPFS `data_sources` **68 → 69**; the SOC
measure count (rows with `jurisdiction_level: "soc"`) stayed at **205** and every other per-source
count was unchanged. A second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the
total at **998,863** and created no duplicate (idempotent). `data_sources` records the source
`active` with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2024-25"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`goulburn-mulwaree-gpfs/gmc-financial-statements-2024-2025.pdf` with its SHA-256 and retrieval
metadata; no PDF is committed. The focused connector test also proves idempotency against a dedicated
test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector
tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/goulburn-mulwaree-gpfs.md`.

---

### 7.70 Seventieth landed council — Broken Hill City Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest published audited standalone General Purpose Financial
Statements at 2026-11-19: the statements are for the **year ended 30 June 2025**. No FY2025-26 GPFS is
posted. The accepted current-available year is therefore `2024-25`; the connector targets `2024-25`
and never substitutes a 2025-26 or 2023-24 document. The statement source is the council's
**annual financial statements** (not the annual report), discovered from the official Council Reports
page <https://www.brokenhill.nsw.gov.au/Council/Reports>. The current upload is
<https://www.brokenhill.nsw.gov.au/files/assets/public/v/5/documents/financial-statements/broken-hill-city-council-annual-financial-statements-2025.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **200** `application/pdf` (3,400,140 bytes) to a plain
client UA and **403** to a bare Chrome UA. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used.

The 95-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p15 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **3,400,140**
- SHA-256: `b4ef2b7951f7de837d2ddb38e8aed886ee84d630ac1eb95f5e667acf915f079e`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$48,726` thousand | = `$48,726,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$21,823` + `$4,381` + `$1,033` + `$6,162` + `$13,243` + `$1,407` + `$677` = `$48,726` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$16,475` + `$12,578` + `$758` + `$1,444` + `$438` = `$31,693` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$7,382`) | `$31,693` + `$7,382` = `$39,075` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$48,726` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$39,075` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$9,651` thousand | = face operating result |
| B1-1 grants and contributions | `$19,405` thousand | = operating `$6,162` + capital `$13,243` |
| Operating result from continuing operations | `$48,726` − `$39,075` = `$9,651` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$9,651` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$9,651` − `$13,243` = `−$3,592` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$9,651` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$14,469` thousand | = printed total other comprehensive income for the year and total items not reclassified |
| Statement of Comprehensive Income total (`$9,651` + `$14,469` other comprehensive income) | `$24,120` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$31,693`
thousand) plus printed depreciation/amortisation/impairment (`$7,382` thousand), and equals the B1-1
"Total functions and activities" expense total (`$39,075` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Broken Hill prints seven revenue lines and five expense lines, including a real printed **net loss on
the disposal of assets** (`$438` thousand), which is emitted as an expense row. Its before-capital
result is negative (`−$3,592` thousand) and is retained in reconciliation evidence only. Other
comprehensive income has a single printed component (revaluation gain); the adapter checks it against
the printed OCI (`$14,469` thousand).

**Rows.** 17 rows, source id `broken-hill-gpfs`, `source_dataset` "Broken Hill City Council GPFS
2024-25", `measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Broken Hill City Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$4,872,600,000`, total expenses `$3,907,500,000`, employee expenses `$1,647,500,000`,
depreciation/amortisation/impairment `$738,200,000`, operating government grants `$616,200,000`,
capital government grants `$1,324,300,000`, borrowing costs `$75,800,000`, net loss on disposal of
assets `$43,800,000`, other income `$67,700,000` and net result `$965,100,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`broken-hill-gpfs` took the shared dev DB from **998,863** to **998,880** measures — exactly **+17**
rows. GPFS rows moved **1345 → 1362** and active GPFS `data_sources` **69 → 70**; the SOC measure
count (rows with `jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was
unchanged. A second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at
**998,880** and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2024-25"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`broken-hill-gpfs/broken-hill-city-council-annual-financial-statements-2025.pdf` with its SHA-256 and
retrieval metadata; no PDF is committed. The focused connector test also proves idempotency against a
dedicated test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted
connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/broken-hill-gpfs.md`.

---

### 7.71 Seventy-first landed council — Griffith City Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest published audited standalone General Purpose Financial
Statements at 2026-11-19: the statements are for the **year ended 30 June 2025**. No FY2025-26 GPFS is
posted. The accepted current-available year is therefore `2024-25`; the connector targets `2024-25`
and never substitutes a 2025-26 or 2023-24 document. The statement source is the council's
**standalone financial statements** (not the annual report), discovered from the official Corporate
planning and reporting page
<https://www.griffith.nsw.gov.au/Council/Corporate-planning-and-reporting>. The current upload is
<https://www.griffith.nsw.gov.au/files/sharedassets/public/v/1/cm-documents/griffith-city-council-financial-statements-2024-25.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **200** `application/pdf` (4,054,577 bytes) to a plain
client UA and **403** to a bare Chrome UA. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used.

The 108-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p15 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **4,054,577**
- SHA-256: `5ff3ce8ff4f52ab44ed34582e18146bdc52ba7ea188ef1ae36e7132fd77a88a4`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$90,434` thousand | = `$90,434,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income + net gain on disposal) | `$40,658` + `$21,904` + `$1,704` + `$7,179` + `$13,839` + `$4,454` + `$565` + `$131` = `$90,434` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses) | `$29,395` + `$21,948` + `$972` + `$1,301` = `$53,616` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$19,188`) | `$53,616` + `$19,188` = `$72,804` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$90,434` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$72,804` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$17,630` thousand | = face operating result |
| B1-1 grants and contributions | `$21,018` thousand | = operating `$7,179` + capital `$13,839` |
| Operating result from continuing operations | `$90,434` − `$72,804` = `$17,630` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$17,630` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$17,630` − `$13,839` = `$3,791` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$17,630` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `−$22` + intangible revaluation `$928`) | `$906` thousand | = printed total other comprehensive income for the year |
| Statement of Comprehensive Income total (`$17,630` + `$906` other comprehensive income) | `$18,536` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$53,616`
thousand) plus printed depreciation/amortisation/impairment (`$19,188` thousand), and equals the B1-1
"Total functions and activities" expense total (`$72,804` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Griffith prints eight revenue lines, including a real printed **net gain on the disposal of assets**
(`$131` thousand), which is emitted as a revenue row, and four expense lines. Its before-capital
result is positive (`$3,791` thousand) and is retained in reconciliation evidence only. Other
comprehensive income has two printed components (revaluation loss and intangible revaluation gain);
the adapter sums them and checks the sum against the printed OCI (`$906` thousand).

**Rows.** 17 rows, source id `griffith-gpfs`, `source_dataset` "Griffith City Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Griffith City Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$9,043,400,000`, total expenses `$7,280,400,000`, employee expenses `$2,939,500,000`,
depreciation/amortisation/impairment `$1,918,800,000`, operating government grants `$717,900,000`,
capital government grants `$1,383,900,000`, borrowing costs `$97,200,000`, net gain on disposal of
assets `$13,100,000`, other income `$56,500,000` and net result `$1,763,000,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `griffith-gpfs`
took the shared dev DB from **998,880** to **998,897** measures — exactly **+17** rows. GPFS rows
moved **1362 → 1379** and active GPFS `data_sources` **70 → 71**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,897**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2024-25"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`griffith-gpfs/griffith-city-council-financial-statements-2024-25.pdf` with its SHA-256 and retrieval
metadata; no PDF is committed. The focused connector test also proves idempotency against a dedicated
test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector
tests passed (18/18). Full evidence:
`docs/source-discovery/nsw-councils/griffith-gpfs.md`.

---

### 7.72 Seventy-second landed council — Lithgow City Council FY2024-25 GPFS (landed 2026-11-19)

**Source and year.** FY2024-25 is the latest published audited standalone General Purpose Financial
Statements at 2026-11-19: the statements are for the **year ended 30 June 2025**. No FY2025-26 GPFS is
posted. The accepted current-available year is therefore `2024-25`; the connector targets `2024-25`
and never substitutes a 2025-26 or 2023-24 document. The statement source is the council's
**standalone financial statements** (not the annual report), discovered from the official Annual
Reports page
<https://www.lithgow.nsw.gov.au/Governance/Integrated-Planning-and-Reporting/Performance-Reporting/Annual-Reports>.
The current upload is
<https://www.lithgow.nsw.gov.au/files/assets/public/v/1/governance/ipr/reports/financial-statements-2024-2025.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **200** `application/pdf` (5,369,732 bytes) to a plain
client UA and **403** to a bare Chrome UA. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used.

The 104-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p4,
Statement of Comprehensive Income p5 and B1-1 "Functions or activities" p13 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **5,369,732**
- SHA-256: `4067a84e20dd7c35e1afe3843805373fa4acc110838c0b4e7f0f62e05d8684de`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$78,911` thousand | = `$78,911,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$40,370` + `$8,819` + `$1,423` + `$7,039` + `$16,901` + `$3,779` + `$580` = `$78,911` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$24,351` + `$28,274` + `$490` + `$8,392` + `$6,979` = `$68,486` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$18,512`) | `$68,486` + `$18,512` = `$86,998` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$78,911` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$86,998` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `−$8,087` thousand | = face operating result |
| B1-1 grants and contributions | `$23,940` thousand | = operating `$7,039` + capital `$16,901` |
| Operating result from continuing operations | `$78,911` − `$86,998` = `−$8,087` thousand | = printed operating result (loss) |
| Net operating result for the year attributable to Council | `−$8,087` thousand | = printed net result (stored with negative sign marker) |
| Net operating result before grants and contributions provided for capital purposes | `−$8,087` − `$16,901` = `−$24,988` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `−$8,087` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `−$27,928` + remediation provision fair value adjustment `−$411`) | `−$28,339` thousand | = printed total other comprehensive income for the year |
| Statement of Comprehensive Income total (`−$8,087` + `−$28,339` other comprehensive income) | `−$36,426` thousand | = printed Total and comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$68,486`
thousand) plus printed depreciation/amortisation/impairment (`$18,512` thousand), and equals the B1-1
"Total functions and activities" expense total (`$86,998` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Lithgow prints seven revenue lines and five expense lines, including a real printed **net loss on the
disposal of assets** (`$6,979` thousand), which is emitted as an expense row. Its net result is
negative (`−$8,087` thousand) and carries `gpfs_printed_sign: "negative"`; the before-capital result
is also negative (`−$24,988` thousand) and is retained in reconciliation evidence only. Other
comprehensive income has two printed components (revaluation loss and remediation-provision fair
value adjustment); the adapter sums them and checks the sum against the printed OCI (`−$28,339`
thousand).

**Rows.** 17 rows, source id `lithgow-gpfs`, `source_dataset` "Lithgow City Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Lithgow City Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$7,891,100,000`, total expenses `$8,699,800,000`, employee expenses `$2,435,100,000`,
depreciation/amortisation/impairment `$1,851,200,000`, operating government grants `$703,900,000`,
capital government grants `$1,690,100,000`, borrowing costs `$49,000,000`, net loss on disposal of
assets `$697,900,000`, other income `$58,000,000` and net result `$808,700,000` with a negative sign
marker. The printed before-capital result is retained in reconciliation evidence only and is not
emitted as a row. The B1-1 function split is used only for the reconciliation checks and is not
emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `lithgow-gpfs`
took the shared dev DB from **998,897** to **998,914** measures — exactly **+17** rows. GPFS rows
moved **1379 → 1396** and active GPFS `data_sources` **71 → 72**; the SOC measure count (rows with
`jurisdiction_level: "soc"`) stayed at **205** and every other per-source count was unchanged. A
second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the total at **998,914**
and created no duplicate (idempotent). `data_sources` records the source `active` with
`records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2024-25"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`lithgow-gpfs/financial-statements-2024-2025.pdf` with its SHA-256 and retrieval metadata; no PDF is
committed. The focused connector test also proves idempotency against a dedicated test Mongo (seeded
5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector tests passed (18/18).
Full evidence: `docs/source-discovery/nsw-councils/lithgow-gpfs.md`.

---

### 7.73 Seventy-third landed council — Mid-Western Regional Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the latest audited year published by Mid-Western Regional Council at
2026-11-19: the statements are for the **year ended 30 June 2026**. The connector targets `2025-26`
and never substitutes a 2026-27 or 2024-25 document. The statement source is the council's
**standalone financial statements** (not the annual report), discovered from the official Financial
statements and reports page
<https://www.midwestern.nsw.gov.au/Council/Policies-plans-and-reporting/Financial-statements-and-reports>.
The current upload is
<https://www.midwestern.nsw.gov.au/files/assets/public/v/2/council/plans-and-strategies/financial-statements/mwrc-financial-statements-2025-26.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **200** `application/pdf` (2,508,368 bytes) to a plain
client UA and **403** to a bare Chrome UA. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used.

The 90-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **2,508,368**
- SHA-256: `47999cc3fa37d7c59fdc592e58bce035bb570da3c6ebfa4f2bf64477d204bbc1`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$127,209` thousand | = `$127,209,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$52,334` + `$27,130` + `$1,549` + `$22,698` + `$14,863` + `$6,317` + `$2,318` = `$127,209` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$39,805` + `$33,627` + `$953` + `$1,703` + `$2,889` = `$78,977` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$29,342`) | `$78,977` + `$29,342` = `$108,319` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$127,209` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$108,319` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$18,890` thousand | = face operating result |
| B1-1 grants and contributions | `$37,561` thousand | = operating `$22,698` + capital `$14,863` |
| Operating result from continuing operations | `$127,209` − `$108,319` = `$18,890` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$18,890` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$18,890` − `$14,863` = `$4,027` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$18,890` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `$54,434` + impairment reversal `−$321` + remediation provision movements `$108`) | `$54,221` thousand | = printed total other comprehensive income for the year |
| Statement of Comprehensive Income total (`$18,890` + `$54,221` other comprehensive income) | `$73,111` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$78,977`
thousand) plus printed depreciation/amortisation/impairment (`$29,342` thousand), and equals the B1-1
"Total functions and activities" expense total (`$108,319` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Mid-Western prints seven revenue lines and five expense lines, including a real printed **net loss on
the disposal of assets** (`$2,889` thousand), which is emitted as an expense row. Its before-capital
result is positive (`$4,027` thousand) and is retained in reconciliation evidence only. Other
comprehensive income has three printed components (revaluation gain, impairment reversal and
remediation provision movements); the adapter sums them and checks the sum against the printed OCI
(`$54,221` thousand).

**Rows.** 17 rows, source id `mid-western-regional-gpfs`, `source_dataset` "Mid-Western Regional
Council GPFS 2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level:
"local"`, `jurisdiction: "NSW"`, `delivery_entity: "Mid-Western Regional Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`. The minimum lines are total
revenue `$12,720,900,000`, total expenses `$10,831,900,000`, employee expenses `$3,980,500,000`,
depreciation/amortisation/impairment `$2,934,200,000`, operating government grants `$2,269,800,000`,
capital government grants `$1,486,300,000`, borrowing costs `$95,300,000`, net loss on disposal of
assets `$288,900,000`, other income `$231,800,000` and net result `$1,889,000,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`mid-western-regional-gpfs` took the shared dev DB from **998,914** to **998,931** measures — exactly
**+17** rows. GPFS rows moved **1396 → 1413** and active GPFS `data_sources` **72 → 73**; the SOC
measure count (rows with `jurisdiction_level: "soc"`) stayed at **205** and every other per-source
count was unchanged. A second ingest fetched/upserted the same 17 SHA-anchored natural keys, left the
total at **998,931** and created no duplicate (idempotent). `data_sources` records the source
`active` with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`mid-western-regional-gpfs/mwrc-financial-statements-2025-26.pdf` with its SHA-256 and retrieval
metadata; no PDF is committed. The focused connector test also proves idempotency against a dedicated
test Mongo (seeded 5 rows → 22 with 17 rows; a second ingest leaves it at 22). Targeted connector
tests passed (18/18). Full evidence:
`docs/source-discovery/nsw-councils/mid-western-regional-gpfs.md`.

---

### 7.74 Seventy-fourth landed council — Bega Valley Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the **current audited standalone financial statements** published by
the council at 2026-11-19: the statements are for the **year ended 30 June 2026**. The connector
targets `2025-26` and never substitutes a prior-year (2024-25 or 2023-24) document; the superseded
FY2024-25 upload is no longer ingested. The statement source is the council's **standalone annual
financial statements** (not the narrative annual report), discovered from the official Financial
Statements page
<https://www.begavalley.nsw.gov.au/About-Council/Plans-and-Reporting/Financial-Statements>. The
FY2025-26 upload is
<https://www.begavalley.nsw.gov.au/files/assets/public/v/2/adopted-plans-and-strategies/01-integrated-planning-and-reporting/financial-statements/annual_financial_statements-2026.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Akamai UA method.** The host's WAF returns **200** `application/pdf` (3,371,024 bytes) to a plain
client UA and **403** to a bare Chrome UA. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used.

The 101-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **3,371,024**
- SHA-256: `647575d7038f30c303cfe59e67d7011ca117db24c9f35d10dec68416230e26b2`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$169,037` thousand | = `$169,037,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest) | `$81,466` + `$25,191` + `$1,295` + `$33,458` + `$20,497` + `$7,130` = `$169,037` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$47,460` + `$44,373` + `$621` + `$1,826` + `$8,213` = `$102,493` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$43,409`) | `$102,493` + `$43,409` = `$145,902` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$169,037` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$145,902` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$23,135` thousand | = face operating result |
| B1-1 grants and contributions | `$53,955` thousand | = operating `$33,458` + capital `$20,497` |
| Operating result from continuing operations | `$169,037` − `$145,902` = `$23,135` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$23,135` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$23,135` − `$20,497` = `$2,638` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$23,135` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `$69,153` + other reserve movements `$123`) | `$69,276` thousand | = printed total other comprehensive income for the year |
| Statement of Comprehensive Income total (`$23,135` + `$69,276` other comprehensive income) | `$92,411` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$102,493`
thousand) plus printed depreciation/amortisation/impairment (`$43,409` thousand), and equals the B1-1
"Total functions and activities" expense total (`$145,902` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Bega Valley prints six revenue lines (no separate "Other income" line) and five expense lines,
including a real printed **net loss on the disposal of assets** (`$8,213` thousand), which is emitted
as an expense row. Its before-capital result is positive (`$2,638` thousand) and is retained in
reconciliation evidence only. Other comprehensive income has two printed components (revaluation gain
and other reserve movements); the adapter sums them and checks the sum against the printed OCI
(`$69,276` thousand).

**Rows.** 16 rows, source id `bega-valley-gpfs`, `source_dataset` "Bega Valley Shire Council GPFS
2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Bega Valley Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$16,903,700,000`, total expenses `$14,590,200,000`, employee expenses `$4,746,000,000`,
depreciation/amortisation/impairment `$4,340,900,000`, operating government grants `$3,345,800,000`,
capital government grants `$2,049,700,000`, borrowing costs `$62,100,000`, net loss on disposal of
assets `$821,300,000` and net result `$2,313,500,000`. The printed before-capital result is retained in
reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for the
reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database retarget proof (2026-11-19, shared dev DB `ausspend_dev`).** The stale FY2024-25 rows were
deleted first: **16** rows removed, total **998,947 → 998,931**, GPFS rows **1429 → 1413**. The
targeted FY2025-26 ingest then took the DB from **998,931** to **998,947** — exactly **+16** rows.
GPFS rows returned to **1429** and the active GPFS `data_sources` count remains **74** (same source
id); the SOC measure count stayed at **205** and every other per-source count was unchanged. The
source now has **16** rows, **all `fiscal_year: "2025-26"`**; **0** stale FY2024-25 rows remain.
`data_sources` records the source `active` with `records_ingested: 16`; the latest `ingestion_logs`
entry is `status: "success"`, `records_fetched: 16`, `records_upserted: 16`. The exact PDF is archived
outside the repo under the configured source-archive root at
`bega-valley-gpfs/annual_financial_statements-2026.pdf` with its SHA-256 and retrieval metadata; no
PDF is committed. The focused connector test also proves idempotency against a dedicated test Mongo
(seeded 5 rows → 21 with 16 rows; a second ingest leaves it at 21). Targeted connector tests passed
(18/18). Full evidence: `docs/source-discovery/nsw-councils/bega-valley-gpfs.md`.

---

### 7.75 Seventy-fifth landed council — Snowy Monaro Regional Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** The council's Integrated Planning page links the official Have Your Say notice
"Feedback invited on Council's audited 2025/26 Financial Statements", which redirects to the official
engagement platform and carries the signed **FY2025-26 audited GPFS** as a document-library
attachment (`Annual_Financial_Statements-GPFS-2026 29 October signed.pdf`). That attachment is
directly downloadable, so FY2025-26 is ingested. The older FY2024-25 GPFS still linked from the
Integrated Planning page is superseded and is not ingested. The connector targets `2025-26` and
rejects 2024-25/2023-24. The statement source is the GPFS attachment (not the annual report, SPFS or
special schedules).

**Discovery.** <https://www.snowymonaro.nsw.gov.au/Have-Your-Say/Feedback-invited-on-Councils-audited-202526-Financial-Statements>
redirects to `https://yoursaysnowymonaro.com.au/feedback-invited-on-council-s-audited-2025-26-financial-statements`;
the document-library GPFS attachment is
<https://yoursaysnowymonaro.com.au/109847/widgets/498829/documents/335580/download>, which redirects
to the signed official PDF. A documented official fallback pin (the same document URL) is used only
if parsing yields no usable anchor.

**Akamai UA method.** The council host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns
**200**; a bare Chrome UA returns **403**. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used.

The 95-page (76 printed pages) PDF contains the signed General Purpose Financial Statements — Income
Statement PDF p5, Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus
the notes and the independent auditor's reports. The printed unit is explicit `$ '000`; a missing or
conflicting unit rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **2,942,138**
- SHA-256: `40ee605dfd8d4b988d8871470cda32ad6de7d0b2453617a440d7716e2c590ba2`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$135,374` thousand | = `$135,374,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$47,420` + `$19,615` + `$3,368` + `$26,799` + `$31,634` + `$5,128` + `$1,410` = `$135,374` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$36,796` + `$32,142` + `$3,033` + `$2,421` + `$9,004` = `$83,396` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$30,290`) | `$83,396` + `$30,290` = `$113,686` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$135,374` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$113,686` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$21,688` thousand | = face operating result |
| B1-1 grants and contributions | `$58,433` thousand | = operating `$26,799` + capital `$31,634` |
| Operating result from continuing operations | `$135,374` − `$113,686` = `$21,688` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$21,688` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$21,688` − `$31,634` = `−$9,946` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$21,688` thousand | = Income Statement net result |
| Other comprehensive income (revaluation; 2026 impairment reversal nil) | `$78,499` thousand | = printed total other comprehensive income for the year |
| Statement of Comprehensive Income total (`$21,688` + `$78,499` other comprehensive income) | `$100,187` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$83,396`
thousand) plus printed depreciation/amortisation/impairment (`$30,290` thousand), and equals the B1-1
"Total functions and activities" expense total (`$113,686` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Snowy Monaro prints seven revenue lines and five expense lines, including a real printed **net loss
on the disposal of assets** (`$9,004` thousand), which is emitted as an expense row; the printed net
gain on disposal is nil and is not emitted. Its before-capital result is negative (`−$9,946`
thousand) and is retained in reconciliation evidence only. OCI has a single non-nil component
(revaluation `$78,499` thousand); the 2026 impairment-reversal line is nil and is not read from the
comparative.

**Rows.** 17 rows, source id `snowy-monaro-gpfs`, `source_dataset` "Snowy Monaro Regional Council GPFS
2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Snowy Monaro Regional Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$13,537,400,000`, total expenses `$11,368,600,000`, employee expenses `$3,679,600,000`,
depreciation/amortisation/impairment `$3,029,000,000`, operating government grants `$2,679,900,000`,
capital government grants `$3,163,400,000`, borrowing costs `$303,300,000`, net loss on disposal of
assets `$900,400,000`, other income `$141,000,000` and net result `$2,168,800,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`snowy-monaro-gpfs` took the shared dev DB from **998,947** to **998,964** measures — exactly **+17**
rows. GPFS rows moved **1429 → 1446** and active GPFS `data_sources` **74 → 75**; the SOC measure
count stayed at **205** and every other per-source count was unchanged. `data_sources` records the
source `active` with `records_ingested: 17`; the latest `ingestion_logs` entry is
`status: "success"`, `records_fetched: 17`, `records_upserted: 17`. All 17 measures carry
`fiscal_year: "2025-26"`. The exact PDF is archived outside the repo under the configured
source-archive root at `snowy-monaro-gpfs/annual_financial_statements-gpfs-2026.pdf` with its SHA-256
and retrieval metadata; no PDF is committed. Targeted connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/snowy-monaro-gpfs.md`.

---

### 7.76 Seventy-sixth landed council — Singleton Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the **current audited standalone year** published by Singleton
Council at 2026-11-19: the statements are for the year ended 30 June 2026. The official Financial
Statements page lists 2025/2026 as the newest year; no 2026/27 audited statements are posted. The
connector targets `2025-26` and never substitutes a prior-year (2024-25 or 2023-24) document. The
statement source is the audited financial statements PDF (not the annual report or budget/planning
documents), discovered from the official Financial Statements page
<https://www.singleton.nsw.gov.au/Council/Integrated-Planning-and-Reporting/Long-Term-Planning/Financial-Statements>.

**DocID endpoint preserved.** The statement URL is the official DocID redirect endpoint with no `.pdf`
extension: <https://docs.singleton.nsw.gov.au/default.aspx?DocID=cVK9GDcvrvY%3d>. The URL-encoded
`DocID=cVK9GDcvrvY%3d` query is preserved exactly in the connector, the archive metadata and the
fallback pin. Discovery accepts only `docs.singleton.nsw.gov.au` / `portal.singleton.nsw.gov.au`
DocID links and ignores the flippingbook view, annual reports and budget/planning documents.

**Akamai UA method.** The host is UA-sensitive: a plain client UA (`curl/8.5.0`) returns **200**
`application/pdf`; a bare Chrome UA returns **403**. The connector sends an explicit plain `curl/8.5.0`
User-Agent (plus a broad PDF/HTML `Accept`) for both the listing and the PDF, and a focused test
asserts that header is used.

The 94-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **5,647,126**
- SHA-256: `717bfeec069e1564f2a712bbff73987f626624180b421905eaa71e8aa6dc0dbc`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$114,512` thousand | = `$114,512,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$41,739` + `$30,000` + `$3,696` + `$13,603` + `$15,937` + `$5,308` + `$4,229` = `$114,512` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$33,954` + `$37,544` + `$1,339` + `$2,836` + `$1,721` = `$77,394` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$20,508`) | `$77,394` + `$20,508` = `$97,902` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$114,512` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$97,902` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$16,610` thousand | = face operating result |
| B1-1 grants and contributions | `$29,540` thousand | = operating `$13,603` + capital `$15,937` |
| Operating result from continuing operations | `$114,512` − `$97,902` = `$16,610` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$16,610` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$16,610` − `$15,937` = `$673` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$16,610` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `$34,798` + remediation re-measurement `$5,509`) | `$40,307` thousand | = printed Other comprehensive income for the year |
| Statement of Comprehensive Income total (`$16,610` + `$40,307` other comprehensive income) | `$56,917` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$77,394`
thousand) plus printed depreciation/amortisation/impairment (`$20,508` thousand), and equals the B1-1
"Total functions and activities" expense total (`$97,902` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Singleton prints seven revenue lines and five expense lines, including a real printed **net loss on
the disposal of assets** (`$1,721` thousand), emitted as an expense row; the printed net gain on
disposal is nil and is not emitted. Its before-capital result is positive (`$673` thousand) and is
retained in reconciliation evidence only. Other comprehensive income has two printed components
(revaluation and remediation-provision re-measurement); the adapter sums them and checks the sum
against the printed OCI (`$40,307` thousand).

**Rows.** 17 rows, source id `singleton-gpfs`, `source_dataset` "Singleton Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Singleton Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$11,451,200,000`, total expenses `$9,790,200,000`, employee expenses `$3,395,400,000`,
depreciation/amortisation/impairment `$2,050,800,000`, operating government grants `$1,360,300,000`,
capital government grants `$1,593,700,000`, borrowing costs `$133,900,000`, net loss on disposal of
assets `$172,100,000`, other income `$422,900,000` and net result `$1,661,000,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `singleton-gpfs`
took the shared dev DB from **998,964** to **998,981** measures — exactly **+17** rows. GPFS rows
moved **1446 → 1463** and active GPFS `data_sources` **75 → 76**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. `data_sources` records the source `active`
with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`singleton-gpfs/singleton-financial-statements-2025-26.pdf` (DocID URL preserved in metadata) with its
SHA-256; no PDF is committed. Targeted connector tests passed (18/18). Full evidence:
`docs/source-discovery/nsw-councils/singleton-gpfs.md`.

---

### 7.77 Seventy-seventh landed council — Orange City Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** No separate standalone FY2025-26 AFS is published on the council's Annual Report
page yet; the only separate AFS link is the audited **FY2024-25** statements. The endorsed
**2025-2026 Annual Report** (CCL 17 November 2026), however, contains the signed audited General
Purpose Financial Statements section — Income Statement, Statement of Comprehensive Income, B1-1,
notes and the Auditor-General's report — and that section is fully parseable. FY2025-26 is therefore
ingested from the annual report, and the standalone FY2024-25 AFS is superseded and not ingested. The
connector targets `2025-26` and rejects 2024-25/2023-24. The source is the annual report (not the
2024-25 AFS, notices or budget/planning documents), discovered from the official Annual Report page
<https://www.orange.nsw.gov.au/plans-and-policies/annual-report/>. The current upload is
<https://www.orange.nsw.gov.au/wp-content/uploads/2026/11/Orange-City-Council-2025-2026-Annual-Report-Endorsed-CCL-17-November-2026.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Plain fetch.** The WordPress media PDFs serve normally to plain fetch; the connector sends an
explicit plain `curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery
and download, and a focused test asserts that header is used.

The 124-page annual report contains the audited GPFS section — Income Statement PDF p89, Statement of
Comprehensive Income p90 and B1-1 "Functions or activities" p98 — plus the notes and the
Auditor-General's report at pp. 111–113. The printed unit is explicit `$ '000`; a missing or
conflicting unit rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **4,329,237**
- SHA-256: `d8f815cc6ce577b13ac2f6c6f991a30fbcd9c541ed7ce8f3a0d469ea84af356d`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$171,827` thousand | = `$171,827,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$70,700` + `$36,435` + `$8,673` + `$13,967` + `$28,026` + `$12,027` + `$1,999` = `$171,827` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$56,769` + `$45,542` + `$554` + `$1,280` + `$6,424` = `$110,569` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$29,169`) | `$110,569` + `$29,169` = `$139,738` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$171,827` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$139,738` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$32,089` thousand | = face operating result |
| B1-1 grants and contributions | `$41,993` thousand | = operating `$13,967` + capital `$28,026` |
| Operating result from continuing operations | `$171,827` − `$139,738` = `$32,089` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$32,089` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$32,089` − `$28,026` = `$4,063` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$32,089` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$201,141` thousand | = printed total other comprehensive income for the year |
| Statement of Comprehensive Income total (`$32,089` + `$201,141` other comprehensive income) | `$233,230` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$110,569`
thousand) plus printed depreciation/amortisation/impairment (`$29,169` thousand), and equals the B1-1
"Total functions and activities" expense total (`$139,738` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Orange prints seven revenue lines and five expense lines, including a real printed **net loss on the
disposal of assets** (`$6,424` thousand), emitted as an expense row; the printed net gain on disposal
is nil and is not emitted. Its before-capital result is positive (`$4,063` thousand) and is retained
in reconciliation evidence only. Other comprehensive income has a single printed component
(revaluation); the adapter checks it against the printed OCI (`$201,141` thousand).

**Rows.** 17 rows, source id `orange-gpfs`, `source_dataset` "Orange City Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Orange City Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$17,182,700,000`, total expenses `$13,973,800,000`, employee expenses `$5,676,900,000`,
depreciation/amortisation/impairment `$2,916,900,000`, operating government grants `$1,396,700,000`,
capital government grants `$2,802,600,000`, borrowing costs `$55,400,000`, net loss on disposal of
assets `$642,400,000`, other income `$199,900,000` and net result `$3,208,900,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `orange-gpfs`
took the shared dev DB from **998,981** to **998,998** measures — exactly **+17** rows. GPFS rows
moved **1463 → 1480** and active GPFS `data_sources` **76 → 77**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. `data_sources` records the source `active`
with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`orange-gpfs/Orange-City-Council-2025-2026-Annual-Report-Endorsed-CCL-17-November-2026.pdf` with its
SHA-256; no PDF is committed. Targeted connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/orange-gpfs.md`.

---

### 7.78 Seventy-eighth landed council — Blayney Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the **current audited standalone year** published by Blayney Shire
Council at 2026-11-19: the statements are for the **year ended 30 June 2026**. The Plans, strategies
and reporting page lists 2025-26 as the newest year; no 2026/27 audited statements are posted. The
connector targets `2025-26` and never substitutes a prior-year (2024-25 or 2023-24) document. The
statement source is the standalone audited financial statements (not the annual report, public notice
or budget/planning documents), discovered from the official Plans, strategies and reporting page
<https://www.blayney.nsw.gov.au/council/council-information/plans-strategies-and-reporting/plans-and-strategies>.

**`.pdf.aspx` wrapper preserved.** The statement URL is an ASP.NET endpoint:
<https://www.blayney.nsw.gov.au/ArticleDocuments/271/Annual_Financial_Statements-2026%20Blayney%20Shire%20Council%20(1).pdf.aspx>.
The exact path (including `%20` and `(1)`) is preserved in the connector, the archive metadata and
the documented fallback pin. Discovery accepts only `blayney.nsw.gov.au` financial-statements links
and ignores annual reports, public notices, budget/planning documents and mirrors.

**Plain fetch.** The PDF serves normally to plain fetch; the connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery and download, and
a focused test asserts that header is used.

The 114-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **3,321,814**
- SHA-256: `a0dff037962dff7951dd22623cbdad2221276a35efac0bbfcd0433eb48241e68`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$29,429` thousand | = `$29,429,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$15,534` + `$2,035` + `$388` + `$6,696` + `$3,049` + `$1,513` + `$214` = `$29,429` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$7,975` + `$6,312` + `$118` + `$1,106` + `$950` = `$16,461` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$7,671`) | `$16,461` + `$7,671` = `$24,132` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$29,429` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$24,132` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$5,297` thousand | = face operating result |
| B1-1 grants and contributions | `$9,745` thousand | = operating `$6,696` + capital `$3,049` |
| Operating result from continuing operations | `$29,429` − `$24,132` = `$5,297` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$5,297` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$5,297` − `$3,049` = `$2,248` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$5,297` thousand | = Income Statement net result |
| Other comprehensive income components (revaluation `$12,806` + joint ventures/associates `$904`) | `$13,710` thousand | = printed total other comprehensive income for the year |
| Statement of Comprehensive Income total (`$5,297` + `$13,710` other comprehensive income) | `$19,007` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$16,461`
thousand) plus printed depreciation/amortisation/impairment (`$7,671` thousand), and equals the B1-1
"Total functions and activities" expense total (`$24,132` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Blayney prints seven revenue lines and five expense lines, including a real printed **net loss on the
disposal of assets** (`$950` thousand), emitted as an expense row; the printed net gain on disposal is
nil and is not emitted. Its before-capital result is positive (`$2,248` thousand) and is retained in
reconciliation evidence only. Other comprehensive income has two printed components (revaluation and
joint ventures/associates); the adapter sums them and checks the sum against the printed OCI
(`$13,710` thousand).

**Rows.** 17 rows, source id `blayney-gpfs`, `source_dataset` "Blayney Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Blayney Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$2,942,900,000`, total expenses `$2,413,200,000`, employee expenses `$797,500,000`,
depreciation/amortisation/impairment `$767,100,000`, operating government grants `$669,600,000`,
capital government grants `$304,900,000`, borrowing costs `$11,800,000`, net loss on disposal of
assets `$95,000,000`, other income `$21,400,000` and net result `$529,700,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `blayney-gpfs`
took the shared dev DB from **998,998** to **999,015** measures — exactly **+17** rows. GPFS rows
moved **1480 → 1497** and active GPFS `data_sources` **77 → 78**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. `data_sources` records the source `active`
with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`blayney-gpfs/Annual_Financial_Statements-2026-Blayney-Shire-Council-1-.pdf` with its SHA-256; no PDF
is committed. Targeted connector tests passed (18/18). Full evidence:
`docs/source-discovery/nsw-councils/blayney-gpfs.md`.

---

### 7.79 Seventy-ninth landed council — Liverpool Plains Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the **current audited standalone year** published by Liverpool Plains
Shire Council at 2026-11-19: the statements are for the **year ended 30 June 2026**. The Audited
Financial Statements page lists the year ended 30 June 2026 as the newest document; no 2026/27 audited
statements are posted. The connector targets `2025-26` and never substitutes a prior-year (2024-25 or
2023-24) document. The statement source is the standalone audited financial statements (not the annual
report, public notice or budget/planning documents), discovered from the official Audited Financial
Statements page
<https://www.liverpoolplains.nsw.gov.au/Council/Accessing-Council-information/Corporate-and-Statutory-Reporting/Audited-Financial-Statements>.
The current upload is
<https://www.liverpoolplains.nsw.gov.au/files/assets/public/v/2/governance/corporate-and-statutory-reporting/financial-statements/annual-financial-statements-year-ended-30-june-2026.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Plain fetch.** The PDF serves normally to plain fetch; the connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery and download, and
a focused test asserts that header is used.

The 96-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **3,419,279**
- SHA-256: `118f0ac06fd6ce9d575c90e543c8bc6791eb687c7b1b535658b5c05ed8245bf5`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$41,242` thousand | = `$41,242,000` |
| Revenue components sum (rates + user charges + operating grants + capital grants + other revenues + interest + other income) | `$16,004` + `$7,286` + `$8,183` + `$7,312` + `$442` + `$1,779` + `$236` = `$41,242` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$12,025` + `$14,447` + `$1,013` + `$672` + `$5,337` = `$33,494` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$17,778`) | `$33,494` + `$17,778` = `$51,272` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$41,242` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$51,272` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `−$10,030` thousand | = face operating result |
| B1-1 grants and contributions | `$15,495` thousand | = operating `$8,183` + capital `$7,312` |
| Operating result from continuing operations | `$41,242` − `$51,272` = `−$10,030` thousand | = printed operating result (loss) |
| Net operating result for the year attributable to Council | `−$10,030` thousand | = printed net result (stored with negative sign marker) |
| Net operating result before grants and contributions provided for capital purposes | `−$10,030` − `$7,312` = `−$17,342` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `−$10,030` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$11,750` thousand | = printed total other comprehensive income for the year |
| Statement of Comprehensive Income total (`−$10,030` + `$11,750` other comprehensive income) | `$1,720` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$33,494`
thousand) plus printed depreciation/amortisation/impairment (`$17,778` thousand), and equals the B1-1
"Total functions and activities" expense total (`$51,272` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Liverpool Plains prints seven revenue lines and five expense lines, including a real printed **net
loss on the disposal of assets** (`$5,337` thousand), emitted as an expense row; the printed net gain
on disposal is nil and is not emitted. Its net result is negative (`−$10,030` thousand) and carries
`gpfs_printed_sign: "negative"`; the before-capital result is also negative (`−$17,342` thousand) and
is retained in reconciliation evidence only. Other comprehensive income has a single printed
component (revaluation); the adapter checks it against the printed OCI (`$11,750` thousand).

**Rows.** 17 rows, source id `liverpool-plains-gpfs`, `source_dataset` "Liverpool Plains Shire Council
GPFS 2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Liverpool Plains Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$4,124,200,000`, total expenses `$5,127,200,000`, employee expenses `$1,202,500,000`,
depreciation/amortisation/impairment `$1,777,800,000`, operating government grants `$818,300,000`,
capital government grants `$731,200,000`, borrowing costs `$101,300,000`, net loss on disposal of
assets `$533,700,000`, other income `$23,600,000` and net result `$1,003,000,000` with a negative sign
marker. The printed before-capital result is retained in reconciliation evidence only and is not
emitted as a row. The B1-1 function split is used only for the reconciliation checks and is not
emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only
`liverpool-plains-gpfs` took the shared dev DB from **999,015** to **999,032** measures — exactly
**+17** rows. GPFS rows moved **1497 → 1514** and active GPFS `data_sources` **78 → 79**; the SOC
measure count stayed at **205** and every other per-source count was unchanged. `data_sources`
records the source `active` with `records_ingested: 17`; the latest `ingestion_logs` entry is
`status: "success"`, `records_fetched: 17`, `records_upserted: 17`. All 17 measures carry
`fiscal_year: "2025-26"`. The exact PDF is archived outside the repo under the configured
source-archive root at
`liverpool-plains-gpfs/annual-financial-statements-year-ended-30-june-2026.pdf` with its SHA-256; no
PDF is committed. Targeted connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/liverpool-plains-gpfs.md`.

---

### 7.80 Eightieth landed council — Tenterfield Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the **current audited standalone year** published by Tenterfield
Shire Council at 2026-11-19: the statements are for the **year ended 30 June 2026**. The Financial
Reports page lists 2025-26 as the newest financial statements; no 2026/27 audited statements are
posted. The connector targets `2025-26` and never substitutes a prior-year (2024-25 or 2023-24)
document. The listing writes the year pair space-separated ("2025 26"), which the link parser
normalizes to 2025-26. The statement source is the standalone audited financial statements (not the
annual report, public notice or quarterly budget reviews), discovered from the official Financial
Reports page
<https://www.tenterfield.nsw.gov.au/your-council/council-documents/financial-reports>. The current
upload is
<https://www.tenterfield.nsw.gov.au/content/uploads/2026/11/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Plain fetch.** The PDF serves normally to plain fetch; the connector sends an explicit plain
`curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery and download, and
a focused test asserts that header is used.

The 104-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo:

- bytes: **1,632,568**
- SHA-256: `c8f36ee616a3ef2b0cecec81bde2175c7a1a332522b4dd0a6ebe59d670736df8`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$48,463` thousand | = `$48,463,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + other income) | `$15,184` + `$3,390` + `$507` + `$17,827` + `$8,484` + `$2,837` + `$234` = `$48,463` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses + net loss on disposal) | `$8,522` + `$17,967` + `$902` + `$677` + `$3,183` = `$31,251` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$9,470`) | `$31,251` + `$9,470` = `$40,721` thousand | = printed B1-1 total expenses |
| B1-1 Total functions and activities — income | `$48,463` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$40,721` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$7,742` thousand | = face operating result |
| B1-1 grants and contributions | `$26,311` thousand | = operating `$17,827` + capital `$8,484` |
| Operating result from continuing operations | `$48,463` − `$40,721` = `$7,742` thousand | = printed operating result |
| Net operating result for the year attributable to Council | `$7,742` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$7,742` − `$8,484` = `−$742` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$7,742` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$26,535` thousand | = printed total other comprehensive income for the year |
| Statement of Comprehensive Income total (`$7,742` + `$26,535` other comprehensive income) | `$34,277` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$31,251`
thousand) plus printed depreciation/amortisation/impairment (`$9,470` thousand), and equals the B1-1
"Total functions and activities" expense total (`$40,721` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement — there is **no face-vs-B1-1 discrepancy**.
Tenterfield prints seven revenue lines and five expense lines, including a real printed **net loss on
the disposal of assets** (`$3,183` thousand), emitted as an expense row; the printed net gain on
disposal is nil and is not emitted. Its before-capital result is negative (`−$742` thousand) and is
retained in reconciliation evidence only. Other comprehensive income has a single printed component
(revaluation); the adapter checks it against the printed OCI (`$26,535` thousand).

**Rows.** 17 rows, source id `tenterfield-gpfs`, `source_dataset` "Tenterfield Shire Council GPFS
2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Tenterfield Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$4,846,300,000`, total expenses `$4,072,100,000`, employee expenses `$852,200,000`,
depreciation/amortisation/impairment `$947,000,000`, operating government grants `$1,782,700,000`,
capital government grants `$848,400,000`, borrowing costs `$90,200,000`, net loss on disposal of
assets `$318,300,000`, other income `$23,400,000` and net result `$774,200,000`. The printed
before-capital result is retained in reconciliation evidence only and is not emitted as a row. The
B1-1 function split is used only for the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `tenterfield-gpfs`
took the shared dev DB from **999,032** to **999,049** measures — exactly **+17** rows. GPFS rows
moved **1514 → 1531** and active GPFS `data_sources` **79 → 80**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. `data_sources` records the source `active`
with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at
`tenterfield-gpfs/Tenterfield-Shire-Council-Financial-Statements-2025-26.pdf` with its SHA-256; no PDF
is committed. Targeted connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/tenterfield-gpfs.md`.

---

### 7.81 Eighty-first landed council — Cobar Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the **current audited standalone year** published by Cobar Shire
Council at 2026-11-19: the statements are for the **year ended 30 June 2026**. The official GPFS page
lists the 2025-26 statements as the newest audited financial statements; no 2026/27 audited
statements are posted. The connector targets `2025-26` and never substitutes a prior-year (2024-25 or
2023-24) document, the narrative annual report, the SPFS or the special schedules. The statement
source is the standalone audited General Purpose Financial Statements, discovered from the official
GPFS page <https://www.cobar.nsw.gov.au/48634-2/>. The current upload is
<https://www.cobar.nsw.gov.au/wp-content/uploads/2026/10/Annual_Financial_Statements-2026.pdf>.
A documented official fallback pin is used only if the page yields no usable anchor.

**Plain fetch and discovery.** The PDF serves normally to plain fetch; the connector sends an
explicit plain `curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery
and download, and a focused test asserts that header. The page is a WordPress uploads page whose
statement link is a direct `.pdf` upload (anchor text "HERE"). The parser uses only the anchor label
and file name for the fiscal year, so upload-path dates such as `/2026/10/` cannot create a false
year pair; it rejects the annual report, SPFS, special schedules, public notices, presentations,
policies and mirrors. A focused test asserts the FY2025-26 link wins over 2024-25 and that a
prior-only or future-only listing cannot satisfy the target.

The 92-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p5,
Statement of Comprehensive Income p6 and B1-1 "Functions or activities" p14 — plus the notes and the
independent auditor's reports. The printed unit is explicit `$ '000`; a missing or conflicting unit
rejects the whole extraction. Exact bytes archived outside the repo at the relative path
`cobar-gpfs/Annual_Financial_Statements-2026.pdf`:

- bytes: **3,507,784**
- SHA-256: `7a87b8655b7eb5d15d380c6ce0c6d12bea557e9958b0ad555046aa9229c66eb3`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$75,336` thousand | = `$7,533,600,000` |
| Revenue components sum (rates + user charges + other revenues + operating grants + capital grants + interest + net gain on disposal) | `$9,364` + `$26,590` + `$1,972` + `$16,952` + `$18,890` + `$1,346` + `$222` = `$75,336` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses) | `$18,452` + `$23,896` + `$141` + `$804` = `$43,293` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$11,398`) | `$43,293` + `$11,398` = `$54,691` thousand | = total expenses |
| B1-1 Total functions and activities — income | `$75,336` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$54,691` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$20,645` thousand | = face net result |
| B1-1 grants and contributions | `$35,842` thousand | = operating `$16,952` + capital `$18,890` |
| Total revenue − total expenses | `$75,336` − `$54,691` = `$20,645` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$20,645` − `$18,890` = `$1,755` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$20,645` thousand | = Income Statement net result |
| Other comprehensive income (revaluation `$21,384` + joint ventures/associates `−$247`) | `$21,137` thousand | = printed other comprehensive income |
| Statement of Comprehensive Income total (`$20,645` + `$21,137` other comprehensive income) | `$41,782` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$43,293`
thousand) plus printed depreciation/amortisation/impairment (`$11,398` thousand), and equals the B1-1
"Total functions and activities" expense total (`$54,691` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement. Cobar prints a real **net gain on the
disposal of assets** (`$222` thousand), emitted as a revenue row; the printed net loss on disposal is
nil and is not emitted. Its before-capital result is positive (`$1,755` thousand) and is retained in
reconciliation evidence only. Other comprehensive income has two printed components (revaluation and
joint ventures/associates); their sum is checked against the printed OCI.

**Rows.** 16 rows, source id `cobar-gpfs`, `source_dataset` "Cobar Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Cobar Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$7,533,600,000`, total expenses `$5,469,100,000`, employee expenses `$1,845,200,000`,
depreciation/amortisation/impairment `$1,139,800,000`, operating government grants `$1,695,200,000`,
capital government grants `$1,889,000,000`, borrowing costs `$14,100,000`, net gain on disposal of
assets `$22,200,000` and net result `$2,064,500,000`. The printed before-capital result is retained
in reconciliation evidence only and is not emitted as a row. The B1-1 function split is used only for
the reconciliation checks and is not emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `cobar-gpfs`
took the shared dev DB from **999,049** to **999,065** measures — exactly **+16** rows. GPFS rows
moved **1531 → 1547** and active GPFS `data_sources` **80 → 81**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. `data_sources` records the source `active`
with `records_ingested: 16`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 16`, `records_upserted: 16`. All 16 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at the relative path
`cobar-gpfs/Annual_Financial_Statements-2026.pdf` with its SHA-256; no PDF is committed. Targeted
connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/cobar-gpfs.md`.

---

### 7.82 Eighty-second landed council — Narromine Shire Council FY2025-26 GPFS (landed 2026-11-19)

**Source and year.** FY2025-26 is the **current audited standalone year** published by Narromine
Shire Council at 2026-11-19: the statements are for the **year ended 30 June 2026**. The official
Annual Reports page lists the 2025-26 annexure as the newest audited financial statements; no
2026/27 audited statements are posted. The connector targets `2025-26` and never substitutes a
prior-year (2024-25 or 2023-24) document, the narrative annual report itself, the SPFS or the special
schedules. The statement source is the standalone audited General Purpose Financial Statements
published as **Annexure 1** of the annual report, discovered from the official Annual Reports page
<https://www.narromine.nsw.gov.au/council/annual-reports>. The current upload is
<https://www.narromine.nsw.gov.au/2025%202026%20NSC%20Annual%20Report%20-%20Annexure%201%20-%20Financial%20Statements.pdf?downloadable=1>
(the `?downloadable=1` query is preserved). A documented official fallback pin is the same URL, used
only if the page yields no usable anchor.

**Plain fetch and discovery.** The PDF serves normally to plain fetch; the connector sends an
explicit plain `curl/8.5.0` User-Agent (plus a broad PDF/HTML `Accept`) for deterministic discovery
and download, and a focused test asserts that header. The page lists the full narrative annual report
and the Annexure 1 financial statements; the parser requires "Financial Statements" in the anchor, so
the full annual report, the State of Our Shire annexure, SPFS/special schedules, public notices,
policies and mirrors are rejected. It handles the page's space-separated year pair
("2025 - 2026" / file name "2025 2026") as well as hyphenated ranges, and a focused test asserts the
FY2025-26 annexure wins over 2024-25 and 2023-24 and that a prior-only or future-only listing cannot
satisfy the target.

The 92-page PDF contains the signed General Purpose Financial Statements — Income Statement PDF p6,
Statement of Comprehensive Income p7 and B1-1 "Functions or activities" p16 — plus the notes, the
independent auditor's reports and the special-purpose water/sewer statements (not parsed). The
printed unit is explicit `$ '000`; a missing or conflicting unit rejects the whole extraction. Exact
bytes archived outside the repo at the relative path
`narromine-gpfs/2025 2026 NSC Annual Report - Annexure 1 - Financial Statements.pdf`:

- bytes: **7,899,829**
- SHA-256: `aed5a746789b3e5daf13cf35ed03e3db458408549fba1741c184d275010cf2fb`

**Exact reconciliation.** The connector emits nothing unless all of these agree:

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | `$39,898` thousand | = `$3,989,800,000` |
| Revenue components sum (rates + user charges + other revenue + operating grants + capital grants + interest + other income + net gain on disposal) | `$11,689` + `$5,495` + `$367` + `$11,429` + `$9,002` + `$1,411` + `$131` + `$374` = `$39,898` thousand | = printed total |
| Expense components sum (employee + materials + borrowing costs + other expenses; 2026 net loss on disposal is nil) | `$9,395` + `$9,545` + `$212` + `$1,913` = `$21,065` thousand | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`$9,168`) | `$21,065` + `$9,168` = `$30,233` thousand | = total expenses |
| B1-1 Total functions and activities — income | `$39,898` thousand | = face statement |
| B1-1 Total functions and activities — expenses | `$30,233` thousand | = face bridge |
| B1-1 Total functions and activities — operating result | `$9,665` thousand | = face net result |
| B1-1 grants and contributions | `$20,431` thousand | = operating `$11,429` + capital `$9,002` |
| Total revenue − total expenses | `$39,898` − `$30,233` = `$9,665` thousand | = printed net result |
| Net operating result before grants and contributions provided for capital purposes | `$9,665` − `$9,002` = `$663` thousand | = printed figure (evidence only) |
| Statement of Comprehensive Income net result | `$9,665` thousand | = Income Statement net result |
| Other comprehensive income (revaluation) | `$28,642` thousand | = printed other comprehensive income |
| Statement of Comprehensive Income total (`$9,665` + `$28,642` other comprehensive income) | `$38,307` thousand | = printed total comprehensive income |

Total expenses is the printed face-statement bridge of expenses-excluding-depreciation (`$21,065`
thousand) plus printed depreciation/amortisation/impairment (`$9,168` thousand), and equals the B1-1
"Total functions and activities" expense total (`$30,233` thousand). B1-1 income, expenses, operating
result and grants reconcile exactly to the face statement. Narromine prints a real **net gain on the
disposal of assets** (`$374` thousand), emitted as a revenue row; the printed 2026 net loss on
disposal is nil and is not emitted. Its before-capital result is positive (`$663` thousand) and is
retained in reconciliation evidence only. Other comprehensive income has a single printed component
(revaluation); the adapter checks it against the printed OCI (`$28,642` thousand).

**Rows.** 17 rows, source id `narromine-gpfs`, `source_dataset` "Narromine Shire Council GPFS
2025-26", `measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Narromine Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`. The minimum lines are total revenue
`$3,989,800,000`, total expenses `$3,023,300,000`, employee expenses `$939,500,000`,
depreciation/amortisation/impairment `$916,800,000`, operating government grants `$1,142,900,000`,
capital government grants `$900,200,000`, borrowing costs `$21,200,000`, net gain on disposal of
assets `$37,400,000`, other revenue `$36,700,000`, other income `$13,100,000` and net result
`$966,500,000`. The printed before-capital result is retained in reconciliation evidence only and is
not emitted as a row. The B1-1 function split is used only for the reconciliation checks and is not
emitted as rows.

**No double count.** Every GPFS row is `aggregation_role: "agency_detail"` and carries
`gpfs_line_item`/`gpfs_component_of`; the generic additive API and any area panel therefore exclude
them. The rows have **no `region_id` and no `location`/LGA allocation**, so they cannot be summed into
the existing `dubbo-council` budget/estimate rows, any other council, or the LGA-tagged state rows.
Government grant rows carry `potential_double_count: true` because they may overlap government
program data; they are not added to expenditure. The pre-existing same-entity rows are preserved
untouched and never summed. A DB check confirms **0** non-`agency_detail` rows, **0** rows with
`region_id`/`location` and a single `delivery_entity` for the source.

**Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`).** Ingesting only `narromine-gpfs`
took the shared dev DB from **999,065** to **999,082** measures — exactly **+17** rows. GPFS rows
moved **1547 → 1564** and active GPFS `data_sources` **81 → 82**; the SOC measure count stayed at
**205** and every other per-source count was unchanged. `data_sources` records the source `active`
with `records_ingested: 17`; the latest `ingestion_logs` entry is `status: "success"`,
`records_fetched: 17`, `records_upserted: 17`. All 17 measures carry `fiscal_year: "2025-26"`. The
exact PDF is archived outside the repo under the configured source-archive root at the relative path
`narromine-gpfs/2025 2026 NSC Annual Report - Annexure 1 - Financial Statements.pdf` with its
SHA-256; no PDF is committed. Targeted connector tests passed (17/17). Full evidence:
`docs/source-discovery/nsw-councils/narromine-gpfs.md`.

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
   FY2024-25 GPFS, 17 non-additive rows (§7.18). **Eighteenth expansion landed 2026-11-18:**
   Willoughby City Council FY2024-25 GPFS, 18 non-additive rows (§7.19). **Nineteenth expansion
   landed 2026-11-18:** Inner West Council FY2024-25 GPFS, 18 non-additive rows (§7.20). **Twenty-first expansion landed 2026-11-18:** Bayside Council FY2024-25
   GPFS, 18 non-additive rows (§7.21). **Twenty-second expansion landed 2026-11-18:** Randwick City
   Council FY2024-25 GPFS, 17 non-additive rows (§7.22). **Twenty-third expansion landed
   2026-11-18:** Council of the City of Ryde FY2024-25 GPFS, 17 non-additive rows (§7.23).
   **Twenty-fourth expansion landed 2026-11-18:** North Sydney Council FY2024-25 GPFS, 18
   non-additive rows (§7.24). **Twenty-fifth expansion landed 2026-11-18:** City of Canada Bay
   Council FY2024-25 GPFS, 17 non-additive rows (§7.25). **Twenty-sixth expansion landed
   2026-11-18:** Cumberland City Council FY2024-25 GPFS, 17 non-additive rows (§7.26).
   **Twenty-seventh expansion landed 2026-11-18:** Georges River Council FY2024-25 GPFS, 16
   non-additive rows (§7.27). **Twenty-eighth expansion landed 2026-11-18:** Fairfield City Council
   FY2024-25 GPFS, 17 non-additive rows (§7.28). **Twenty-ninth expansion landed 2026-11-18:**
   Liverpool City Council FY2024-25 GPFS, 17 non-additive rows (§7.29). **Thirtieth expansion landed
   2026-11-18:** Ku-ring-gai Council FY2024-25 GPFS, 17 non-additive rows (§7.30). **Thirty-first
   expansion landed 2026-11-18:** Strathfield Council FY2024-25 GPFS, 17 non-additive rows (§7.31).
   **Thirty-second expansion landed 2026-11-18:** Lane Cove Council FY2024-25 GPFS, 17 non-additive
   rows (§7.32). **Thirty-third expansion landed 2026-11-18:** Mosman Council FY2024-25 GPFS, 18
   non-additive rows (§7.33). **Thirty-fourth expansion landed 2026-11-18:** Hawkesbury City Council
   FY2024-25 GPFS, 19 non-additive rows (§7.34). **Thirty-fifth expansion landed 2026-11-18:** Woollahra Municipal Council FY2024-25 GPFS, 29
   non-additive rows (§7.35). **Thirty-sixth expansion landed 2026-11-18:** Blue Mountains City
   Council FY2024-25 GPFS, 23 non-additive rows (§7.36). **Thirty-seventh expansion landed
   2026-11-18:** Wollondilly Shire Council FY2024-25 GPFS, 18 non-additive rows (§7.37).
   **Thirty-eighth expansion landed 2026-11-18:** Camden Council FY2024-25 GPFS, 23 non-additive
   rows (§7.38). **Thirty-ninth expansion landed 2026-11-18:** Campbelltown City Council FY2024-25
   GPFS, 22 non-additive rows (§7.39). **Fortieth expansion landed 2026-11-18:** Central Coast
   Council FY2024-25 GPFS, 17 non-additive rows (§7.40). **Forty-first expansion landed 2026-11-18:** Hornsby Shire Council FY2025-26 GPFS, 22 non-additive rows (§7.41). **Forty-second expansion landed 2026-11-18:** Penrith City Council FY2024-25 GPFS, 17 non-additive rows (§7.42). **Forty-third expansion landed 2026-11-18:** The Hills Shire Council FY2024-25 GPFS, 17 non-additive rows (§7.43).
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
mongosh "mongodb://localhost:27017/ausspend_dev" --quiet --eval \
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

**GPFS thirtieth-council checks (2026-11-18):**

- Ku-ring-gai Council official Finance page fetched through the documented headless Chromium path
  (plain HTTP returns 403); the FY2024-25 **"Financial statements 2024-2025"** link was discovered
  from the cleared HTML, not a hard-coded document URL. The future 2025-2026 entry was ignored.
- GPFS PDF downloaded from the official link (2,141,582 bytes) and SHA-256 archived outside the repo;
  SHA-256 `5af98c1ac3e9def0dbbb6bdbdb596e5e2f5be9d88ace71a4047730c6112d40be`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement, B1-1 and
  note B3-4; the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$182,600,000`, expenses `$160,603,000` (printed bridge of expenses excluding depreciation
  `$133,541,000` plus depreciation `$27,062,000`), net result `$21,997,000`; B1-1 grants
  `$26,502,000` = operating `$8,459,000` + capital `$18,043,000`.
- The auditor's Report on the Conduct of the Audit prints `21.9` in its table but says the result was
  `$0.31 million higher` than the 2023–24 `21.7` (implying `22.0`) and graphs `21.99`; the GPFS prints
  `21,997`. The connector records the discrepancy and adds `human_spot_check: required` to the
  `total_expenses`, `total_expenses_excluding_depreciation` and `net_result` notes.
- `ku-ring-gai-gpfs` rows: 17, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: measures 515,938 → 515,955 (+17 only); `liverpool-gpfs` still 17; `dubbo-council` still 245;
  `data-nsw-ckan` still 3,472; `data_sources` 55 → 56; a second run upserted the same 17 natural keys
  with no count change.

**GPFS thirty-first-council checks (2026-11-18):**

- Strathfield Council official Reports and Registers page fetched directly; the FY2024-25
  **"Annual Financial Statement 2024 - 2025"** link was discovered from the page HTML, not a
  hard-coded document URL.
- GPFS PDF downloaded from the official link (5,070,919 bytes) and SHA-256 archived outside the repo;
  SHA-256 `90295cd968382d7b8249b7a1a01829526a39f00262ad3f5bc7d56cf58a5a67ee`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement, B1-1 and
  notes B2/B3; the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$73,908,000`, expenses `$69,870,000` (printed bridge of expenses excluding depreciation
  `$58,964,000` plus depreciation/amortisation `$10,906,000`), net result `$4,038,000`; B1-1 grants
  `$17,674,000` = operating `$3,163,000` + capital `$14,511,000`.
- The printed before-capital result is `($10,473,000)`; it is reconciliation evidence only because
  measures store a non-negative net-result magnitude.
- `strathfield-gpfs` rows: 17, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: claim-time measures 693,096; immediately before this ingest 693,113 (concurrent Lane Cove
  +17); after this ingest 693,148 (Strathfield +17 and concurrent Mosman +18); all other sources
  delta 0; `data_sources` 67 → 68; a second run upserted the same 17 natural keys with no count
  change.
  **Lane Cove Council FY2024-25 GPFS (§7.32), 2026-11-18:**

- Community Strategic Plan page fetched HTTP 200; the printed **"Annual Report"** link resolved to the
  council TRIM document link `http://ecouncil.lanecove.nsw.gov.au/trim/DocumentLink.asp?RecId=84401/25`,
  whose JavaScript redirect resolved to the exact Annual Report 2024-25 PDF. No hard-coded PDF URL.
- Annual Report PDF downloaded (12,880,333 bytes) and SHA-256 archived outside the repo; SHA-256
  `460b964d9f8fe85aa7c3e98b80b5a56c01fe6b2401f723ecbd8fd4b31f8c7206` (`hash_verified: true`).
- Printed `$ '000` unit detected on the Income Statement, Statement of Comprehensive Income, B1-1 and
  note B3-3; the connector rejects a missing or conflicting unit.
- Income statement, transposed B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$97,804,000`, expenses `$68,979,000` (printed bridge of expenses excluding depreciation `$58,055,000`
  plus depreciation `$10,924,000`), net result `$28,825,000`; B1-1 grants `$26,637,000` = operating
  `$4,716,000` + capital `$21,921,000`.
- `lane-cove-gpfs` rows: 17, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB (shared dev snapshot at ingest): measures 693,096 → 693,113 (+17 only); per-source diff showed no
  other source increased or decreased and no rows deleted; a second run upserted the same 17
  SHA-anchored natural keys with no count change.

**GPFS thirty-third-council checks (Mosman), 2026-11-18:**

- Mosman Council official Financial Reports page discovered the FY2024-25 **"Financial Statements
  for the Year Ended 30 June 2025"** PDF link from the page HTML, not a hard-coded document URL.
- GPFS PDF downloaded from the official link (3,428,056 bytes) and SHA-256 archived outside the repo;
  SHA-256 `8ff17c938962730603daee3515d3d6bd4ae8451230276b8404f5cbfb28c66faf`.
- Printed `$ '000` unit detected on the income statement, comprehensive-income statement, B1-1 and
  notes B2-4/B3-1/B3-2/B3-3/B3-4; the connector rejects a missing or conflicting unit.
- Income statement, B1-1, comprehensive-income and note totals reconcile: revenue `$63,160,000`,
  expenses `$54,367,000` (printed B1-1 total; the face bridge is `$47,427,000` excluding depreciation
  plus `$6,939,000` depreciation/amortisation/impairment = `$54,366,000`), net result `$8,794,000`;
  B1-1 grants `$6,367,000` = operating `$3,213,000` + capital `$3,154,000`. The `$1` thousand B1-1 /
  face differences are printed rounding and are recorded with `human_spot_check: required`, never
  silently reconciled.
- `mosman-gpfs` rows: 18, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: measures 693,113 → 693,131 (+18 only); `mosman-gpfs` 18; `hunters-hill-gpfs` still 21;
  `strathfield-gpfs` still 17; `ku-ring-gai-gpfs` still 17; `dubbo-council` still 245;
  `data-nsw-ckan` still 3,472; `data_sources` 67 → 68; a second run upserted the same 18 natural keys
  with no count change. A concurrent Lane Cove GPFS then added 17 rows (693,148 / 69 sources); no
  source count decreased.

**GPFS thirty-fifth-council checks (Woollahra), 2026-11-18:**

- Woollahra Municipal Council's official Annual Report page exposes the FY2024-25 **Annual Report
  Part 3** audited General Purpose Financial Statements as the exact council PDF; the connector uses
  that URL and SHA-256 archives the bytes outside the repo.
- GPFS PDF downloaded (5,812,977 bytes); SHA-256
  `f92a0e41248573b4a71b417229d74b6c652039716fb1d4f216a7c316779f738b` (`hash_verified: true`).
- Printed `$ '000` unit detected on the Income Statement, Statement of Comprehensive Income and
  B1-1; the connector rejects a missing or conflicting unit.
- Income statement, B1-1 and comprehensive-income totals reconcile exactly: revenue
  `$139,592,000`, expenses `$129,629,000` (printed B1-1 total, equal to expenses excluding
  depreciation `$113,216,000` plus depreciation/amortisation/impairment `$16,413,000`), net result
  `$9,963,000`; B1-1 grants `$13,227,000` = operating `$4,615,000` + capital `$8,612,000`; the 11
  printed function expense lines sum to `$129,629,000`.
- `woollahra-gpfs` rows: 29, all `aggregation_role: "agency_detail"`, no `region_id`/LGA.
- DB: claim-time and immediate pre-ingest 693,148 → 693,177 (+29 only); every other per-source count
  unchanged and no rows deleted; a second run upserted the same 29 natural keys with no count change.

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
The only ingestions are the §7.1–§7.82 GPFS sources: eighty-two councils, one audited year
each, non-additive rows with no region/LGA allocation, and the existing budget/estimate and
federal/state/charity rows left untouched. No cross-council total is created or implied.
§7.61 (Central Darling) is a documented deferral only: the FY2024-25 annual report's statutory
financial-statements section is scanned with no text layer, so it contributes 0 rows.
