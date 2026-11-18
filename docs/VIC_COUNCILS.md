# Victorian local councils — source inventory, double-count review and pilot plan

**Status (updated 18 November 2026):** the inventory in §§0–10 is the original research/planning
pass. **VIC council pilot A is implemented** as source `vic-vlgc-vgc1`: 5,401 non-additive VGC1
2024-25 rows across all 79 councils (see §11). **VIC council pilot B is implemented** as source
`vic-vlgc-abs`: 9,059 non-additive ABS1/ABS2-3 2024-25 rows across the same 79 councils (see §12).
**VIC council pilot C is implemented** as historical VGC1 and ABS1/ABS2-3 rows for FY2019-20 to
FY2023-24 under the same two source ids: **27,099 VGC1 + 44,548 ABS = 71,647 historical rows**
(see §13). **VIC council pilot D is implemented** as the remaining four years FY2015-16 to
FY2018-19 under the same ids: **21,715 VGC1 + 35,309 ABS = 57,024 rows** (see §14). All nine
historical years are now landed; **no year is deferred**. The planning pass
touched docs only; pilots A–D are separate ingestion items. The database was **515,449 measures**
at planning time, **515,955** on the eve of pilot A, **521,356** after it (exact delta +5,401),
**530,415** after pilot B (exact delta +9,059), **602,062** after pilot C (exact delta +71,647),
and **659,086** after pilot D (exact delta +57,024). **The VIC grants overlay is implemented** as
source `vic-vlgc-fag`: 79 estimated FY2024-25 + 79 final FY2023-24 Commonwealth Financial
Assistance Grant rows (158 rows), taking the database to **659,244** (see §16). No council GPFS
PDFs were queued; the two VLGGC Annual Allocation Report PDFs used by the overlay are archived
with SHA-256 outside the repo.

**As at:** 17 November 2026. **Scope:** Victorian local government — the 79 councils — not state
government, and not a cross-council spending total.

---

## 0. Verdict on the premise (read this first)

**Claim under test:** a single official dataset covers all Victorian councils at
financial-statement granularity.

**Verdict: false as stated for the audited General Purpose Financial Statements (GPFS), but
substantially true at a coarse financial-statement level — much closer than the NSW case.**

There are two different claims inside the premise, and they have different answers:

1. **“One official dataset publishes the audited GPFS income statement, balance sheet, cash-flow,
   notes and special schedules for all 79 councils.”** **Not found, and almost certainly false.**
   The audited GPFS exists only council by council, inside each council's annual report (Local
   Government Act 2020 s.98(2)(c)). No central file, API or CKAN package with all 79 GPFS was found.
2. **“One official dataset covers all 79 councils with financial-statement-like categories.”**
   **True.** The **Victorian Local Government Grants Commission (VLGGC)** annual questionnaire
   collection publishes XLSX workbooks for **all 79 councils** covering expenditure and revenue by
   nine functions and five expense natures, capital outlays by asset class and function, and
   balance-sheet/cash-flow/income-statement categories. The page lists the series from FY2015-16
   to FY2024-25; the 2023-24 and 2024-25 workbooks were checked and each has 79 council rows
   (<https://www.localgovernment.vic.gov.au/funding-programs/victoria-grants-commission/consultation-and-operations>).

**Why the distinction matters — and the reconciliation proof.** For **City of Greater Bendigo,
FY2024-25**, the bulk VLGGC workbooks reconcile **exactly** to the audited GPFS (all figures
`$'000` in the GPFS, whole dollars in VLGGC):

| Line                               |      VLGGC bulk workbook |                  Audited GPFS | Result                            |
| ---------------------------------- | -----------------------: | ----------------------------: | --------------------------------- |
| Total expenditure / total expenses | `$252,760,999.96` (VGC1) |                   `$252,761k` | matches to $0.04                  |
| Total revenue / total income       | `$277,002,000.17` (VGC1) |                   `$277,002k` | matches to $0.17                  |
| Total assets                       |  `$2,595,603,000` (ABS2) |                 `$2,595,603k` | exact                             |
| Total liabilities                  |    `$123,597,000` (ABS2) |                   `$123,597k` | exact                             |
| Total equity                       |  `$2,472,006,000` (ABS2) |                 `$2,472,006k` | exact                             |
| Capital outlays                    |  `$56,221,353.20` (ABS1) | cash-flow payments `$55,748k` | **differs by `$473,353` (0.85%)** |

So the bulk dataset is not merely “near” at the totals: for the one council-year tested it is exact
on the income statement and balance sheet. It still is **not** the GPFS: it is a **council-supplied,
unaudited grants questionnaire**, it has **no notes, special schedules, fund-level statements or
auditor's report**, and capital outlays need a documented bridge to the cash-flow statement. The
pilot below is built to prove exactly that boundary, not to assume it.

This is the premise falsifier the brief asked for: the all-79 bulk financial source **exists**, but
it is not GPFS line-item granularity, and the GPFS remains the authority.

---

## 1. The 79 councils

The count of **79** is verified from three independent official artefacts in this pass:

- **Victorian Local Government Directory — September 2026** (XLSX, 593,305 bytes, SHA-256
  `de05a89f81685d7543adf138fd554fb25bf880d86e56fe3105ac084d1f5a2394`): exactly **79** council
  entries, from Alpine Shire Council to Yarriambiack Shire Council, including the Borough of
  Queenscliffe. Linked from <https://www.vic.gov.au/local-government-contacts-and-information>
  (fetched, HTTP 200).
- **Know Your Council** front page (fetched, HTTP 200): _“Find information about Victoria's 79
  councils.”_ (<https://www.vic.gov.au/know-your-council>)
- **LGPRF full data set 2020-25** (XLSX): **79** distinct council names in every year sheet
  (verified locally; see §3.2).

### 1.1 Comparison groups (the only official grouping used by Know Your Council)

The Know Your Council dashboard groups the 79 for comparison
(<https://www.vic.gov.au/know-your-council-comparison-dashboard>, fetched, HTTP 200; updated
26 August 2025). The groups are a **presentation device, not a funding or legal classification**;
do not use them to create a “group total”.

| Group        |   # | Councils (official directory names)                                                                                                                                                                                                                                                                                                                                |
| ------------ | --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Metropolitan |  22 | Banyule City, Bayside City, Boroondara City, Brimbank City, Darebin City, Frankston City, Glen Eira City, Greater Dandenong City, Hobsons Bay City, Kingston City, Knox City, Manningham City, Maribyrnong City, Maroondah City, Melbourne City, Merri-bek City, Monash City, Moonee Valley City, Port Phillip City, Stonnington City, Whitehorse City, Yarra City |
| Regional     |  10 | Ballarat City, Greater Bendigo City, Greater Geelong City, Greater Shepparton City, Horsham Rural City, Latrobe City, Mildura Rural City, Wangaratta Rural City, Warrnambool City, Wodonga City                                                                                                                                                                    |
| Large shire  |  19 | Bass Coast Shire, Baw Baw Shire, Campaspe Shire, Colac Otway Shire, Corangamite Shire, East Gippsland Shire, Glenelg Shire, Golden Plains Shire, Macedon Ranges Shire, Mitchell Shire, Moira Shire, Moorabool Shire, Mount Alexander Shire, Moyne Shire, South Gippsland Shire, Southern Grampians Shire, Surf Coast Shire, Swan Hill Rural City, Wellington Shire |
| Small shire  |  19 | Alpine Shire, Ararat Rural City, Benalla Rural City, Buloke Shire, Central Goldfields Shire, Gannawarra Shire, Hepburn Shire, Hindmarsh Shire, Indigo Shire, Loddon Shire, Mansfield Shire, Murrindindi Shire, Northern Grampians Shire, Pyrenees Shire, Borough of Queenscliffe, Strathbogie Shire, Towong Shire, West Wimmera Shire, Yarriambiack Shire          |
| Interface    |   9 | Cardinia Shire, Casey City, Hume City, Melton City, Mornington Peninsula Shire, Nillumbik Shire, Whittlesea City, Wyndham City, Yarra Ranges Shire                                                                                                                                                                                                                 |

**Count:** 22 + 10 + 19 + 19 + 9 = **79**.

### 1.2 Legal/name classes inside the 79

The September 2026 directory names split as follows (counted from the XLSX):

| Class in the official name |      # | Notes                                                                                                                                      |
| -------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `… City Council`           |     34 | Includes Melbourne City (capital city) and four “Greater” cities: Greater Bendigo, Greater Dandenong, Greater Geelong, Greater Shepparton. |
| `… Rural City Council`     |      6 | Ararat, Benalla, Horsham, Mildura, Swan Hill, Wangaratta. Still a city class, not a shire.                                                 |
| `… Shire Council`          |     38 | The ordinary rural/urban-fringe shire class.                                                                                               |
| `Borough of Queenscliffe`  |  **1** | The **only** borough in Victoria; do not normalise it to “Shire”.                                                                          |
| **Total**                  | **79** |                                                                                                                                            |

**Name-matching traps.** The official directory and Know Your Council do not always spell names
the same way. Examples: `Colac Otway Shire Council` (directory) vs `Colac-Otway Shire` (KYC);
`Greater Shepparton City Council` (directory) vs `Greater Shepparton` (KYC); `Borough of
Queenscliffe` (directory) vs `Borough of Queenscliffe Council` (KYC page title). The directory also
carries the note: _“From 26 Sept 2022 - Moreland City Councils change name to Merri-bek City
Council”_. Build a name-alias table before any join; never match on display name alone.

### 1.3 Non-standard entities that are **not** one of the 79

These are often mistaken for councils because they have “local government” in their name or are
funded by councils. They are **not** in the 79-council directory and must not be added to council
totals.

| Entity class                                                                      | Examples (not exhaustive)                                                              | Why it is not a council                                                                                                          |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Alpine resort management boards                                                   | Falls Creek, Lake Mountain, Mount Buller, Mount Hotham, Mount Stirling                 | Statutory resort managers under the Alpine Resorts (Management) Act 1997; not municipal councils. **Not re-verified this pass.** |
| Regional waste management groups / Metropolitan Waste and Resource Recovery Group | Grampians, Gippsland, Barwon South West, Loddon Mallee, Metropolitan                   | Statutory waste-planning bodies funded by member councils; not councils. **Not re-verified this pass.**                          |
| Catchment management authorities                                                  | Ten CMAs (e.g. North East, Goulburn Broken)                                            | Natural-resource statutory authorities; not councils. **Not re-verified this pass.**                                             |
| Water corporations                                                                | 19 Victorian water corporations                                                        | State-owned water businesses; not councils. **Not re-verified this pass.**                                                       |
| Regional library corporations                                                     | e.g. Geelong Regional Libraries                                                        | Library service corporations funded by councils/state; not councils. **Not re-verified this pass.**                              |
| Peak/regional bodies                                                              | Municipal Association of Victoria (MAV), Victorian Local Governance Association (VLGA) | Membership/advocacy bodies; not councils.                                                                                        |
| State regulator                                                                   | Local Government Victoria (LGV), Department of Government Services                     | State government; not a council.                                                                                                 |

The **VLGGC questionnaire data and the LGPRF both cover the 79 councils only**; they do not make
these bodies into councils. Keep them out of the population even if a future source lists them.

---

## 2. Source coverage at a glance

| Source                                                 | All 79 councils?                | Audited GPFS line items?             | Financial categories?                                                                                               | Capital $?                                 | Grants $?                                                     | Open licence?                                 |                 In DB now |
| ------------------------------------------------------ | ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------- | ------------------------: |
| **VLGGC annual questionnaire** (VGC1/ABS1/ABS2-3 XLSX) | **Yes (79)**                    | **No** (council-supplied, unaudited) | **Yes** — 9 functions × 5 expense natures; revenue by source; balance sheet; cash flow; income statement categories | **Yes** — asset class × function           | **Yes** — state/Cwlth recurrent & non-recurrent by function   | **No** — attribution condition, no CC licence |                         0 |
| **LGPRF / Know Your Council** full data set            | **Yes (79)**                    | No                                   | Ratios/per-head only (59 measures)                                                                                  | No dollar total (asset-renewal ratio only) | Grants per head only                                          | **CC BY 4.0**                                 |                         0 |
| **Individual council annual reports / GPFS**           | Yes, one per council            | **Yes**                              | Yes — full statements, notes, special schedules                                                                     | Yes                                        | Yes                                                           | Per council; usually **not** open             | 0 (no VIC council source) |
| **VLGGC Annual Allocation Report** (FAG)               | Yes                             | No                                   | No                                                                                                                  | No                                         | **Yes** — Commonwealth Financial Assistance Grant allocations | Attribution condition                         |                         0 |
| **data.vic CKAN**                                      | No GPFS                         | No                                   | LGPRF, waste, LGA profiles only                                                                                     | No                                         | No                                                            | Per dataset, usually CC BY                    |       0 council financial |
| **Victorian local government waste data**              | Yes (surveyed councils)         | No                                   | Service tonnages and costs                                                                                          | No                                         | No                                                            | **CC BY 4.0**                                 |                         0 |
| **VAGO local government audits**                       | Selected councils               | No                                   | Narrative/aggregate                                                                                                 | Occasionally                               | Occasionally                                                  | VAGO terms                                    |                         0 |
| **ABS GFS**                                            | No (local-government aggregate) | No                                   | COFOG/GFS aggregate                                                                                                 | No                                         | No                                                            | CC BY                                         |       169 rows, aggregate |
| **VIC Budget (`vic-budget`)**                          | No (state)                      | No                                   | State COFOG/agency statements                                                                                       | State capital                              | No                                                            | CC BY 4.0                                     |      28 rows, not council |

---

## 3. Source detail

### 3.1 VLGGC annual questionnaire — the all-79 bulk financial source (primary)

**Official page.** Consultation & Council Data:
<https://www.localgovernment.vic.gov.au/funding-programs/victoria-grants-commission/consultation-and-operations>
(live page returned **HTTP 403** to automated fetches this pass; content verified from the Wayback
Machine capture of 12 December 2025 and from the archived XLSX files). The live page is the
authoritative place to re-check each year.

**What it is.** Each year the Victorian Local Government Grants Commission collects a questionnaire
from every council. The page says the return is also used to reduce duplication for the ABS, the
Australian Local Government Association and other agencies. The workbook family is:

| File                                               | Content                                                    | Granularity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VGC1` Expenditure and Revenue                     | Recurrent and non-recurrent expenditure/revenue            | 9 functions (Governance; Family & Community Services; Aged & Disabled Services; Recreation & Culture; Waste Management; Traffic & Street Management; Environment; Business & Economic Services; Local Roads & Bridges) × 5 expense natures (Employee Benefits; Materials & Services; Depreciation & Amortisation; Finance Costs; Other Recurrent), plus revenue by rates, statutory fees/fines/user fees, State grants (recurrent/non-recurrent), Commonwealth grants (recurrent/non-recurrent), contributions/reimbursements |
| `VGC2` Valuations and Rates                        | Property valuations and rates                              | Council-level rates/valuation data — **overlaps VGC1 rates revenue**                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `VGC3` Local Roads                                 | Road length/expenditure                                    | Road inventory — not a financial statement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `ABS1` Capital Assets and Outlays                  | Capital outlays and sales                                  | 9 functions × asset classes (Land; Buildings; Construction excluding buildings; Office Equipment; Transport Equipment; Other)                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ABS2-3` Balance Sheets and Other Finance          | Balance sheet, cash flow, reconciliation, income statement | Full code-level balance sheet (assets, liabilities, equity), cash-flow categories, income-statement categories                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ALG1` Road Inventory Expenditure & Financial Data | Road data                                                  | Not a financial statement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `LGV1` Council Employment                          | Employment profile                                         | Not a financial statement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Questionnaire + Manual                             | Definitions and certification                              | Manual is the definitional authority                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Coverage verified this pass.** The 2024-25 `VGC1` workbook has **79 council rows** in the
`Total Exp` sheet (Alpine to Yarriambiack, no duplicates), and the 2024-25 `ABS1` has **79 council
rows plus one `Totals` row**. The 2023-24 `VGC1` also has **79 council rows**. The page lists
collections from **2015-16 through 2023-24**; the 2024-25 files are archived (Wayback capture
18 August 2026), so the public series is **FY2015-16 to FY2024-25**.

**Downloaded and verified (2024-25):**

- `VGC1` Expenditure and Revenue XLSX:
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0030/225957/2024-25-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx>
  — 847,818 bytes, SHA-256
  `9d72ff7005a48acec0361b36d47e54057363ee5503ddffedebc6158fc54b5572` (fetched via Wayback).
- `ABS1` Capital Outlays and Sales XLSX:
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0024/225960/2024-25-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx>
  — 477,675 bytes, SHA-256
  `639fe70a6de9cbe27c44c5a59ec75c79a99827db706a92aa1353bfd574985f61`.
- `ABS2-3` Balance Sheets and Other Finance XLSX:
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0025/225961/2024-25-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx>
  — 147,062 bytes, SHA-256
  `6975d1d9abf0d43f8776dc28fd73882670a8907f988d3bb94ad6c4055c50891f`.
- `2024-25 VLGGC Manual` DOCX:
  <https://www.localgovernment.vic.gov.au/__data/assets/word_doc/0028/225955/2024-25-VLGGC-Manual.docx>
  — 847,755 bytes, SHA-256
  `4e5e1b6cd18bfb22737fba07642714330def8050934a75d0f242a3d1059b0bc3`.

**Units.** **Whole dollars**, not `$'000` — the cells carry cents (e.g. Greater Bendigo total
expenditure `252,760,999.96`). The ABS2 sheet header is `$`. This is a different unit from the
NSW OLG workbook and from most VIC GPFS, which usually use `$'000`; convert before any comparison.

**Reporting dates.** The questionnaire is for the year ended **30 June**. The 2024-25 manual says
the return is **due Wednesday 5 November 2025**. The LGV page says data is collected in November
and **uploaded annually in May**; the 2024-25 files were archived in August 2026. Do not assume
the current-year file is available before May.

**Licence.** **Not an open-data licence.** The workbook's “Conditions of Use” says (verbatim):
_“Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission
data collection.”_ The page adds a disclaimer that the data is produced from council-supplied
returns, councils give permission for online release, and the Commission _“does not guarantee the
material to be free from error”_. Treat this as **attribution + permission**, not CC BY. A
publication decision is required before any row is exposed.

**Feasibility without double counting.** **High value, medium effort, high double-count risk.**
Parsing is easy (one workbook family, stable sheet names, 79 rows). The traps:

- **VGC1 total expenditure vs GPFS total expenses.** For Bendigo FY2024-25 the VGC1
  `Total Expenditure (Functions and Others)` matches the GPFS total expenses exactly. Treat the
  VGC1 total as the same measure as GPFS total expenses for that council-year, but **do not add
  the function rows to it** — the function rows sum to the functions-only total, and the `Other
(Main Roads & Other)` column bridges that to the full total.
- **VGC1 recurrent vs non-recurrent tabs.** The workbook separates recurrent and non-recurrent
  expenditure/revenue. The `Total Exp` sheet's last column is the functions-and-other total; the
  non-recurrent tabs are a separate cut. Do not add the recurrent total to the non-recurrent total
  unless the manual's mapping says they are disjoint; confirm before publishing.
- **VGC1 rates vs VGC2 rates.** `VGC1` revenue includes rates and charges; `VGC2` is a separate
  valuations/rates return. The manual explicitly links VGC1 rates to **VGC2 code 04999(6)** — they
  are the same rates total reported twice. **Never add VGC2 rates to VGC1 revenue.**
- **ABS1 capital outlays vs VGC1 expenses.** Capital outlays are not recurrent expenses. For
  Bendigo the ABS1 total (`$56,221,353.20`) is **$473,353 (0.85%) above** the GPFS cash-flow
  “Payments for property, infrastructure, plant and equipment” (`$55,748k`). That is a real
  accrual-vs-cash/timing bridge, not a rounding error. Reconcile and document it; do not silently
  substitute one for the other.
- **ABS2-3 balance sheet vs income statement.** Different statements; never add.
- **The workbook's own `Totals` row.** ABS1 contains a `Totals` row across all councils. The brief
  says no cross-council totals. Do not publish it as a platform aggregate; if it is ever shown, label
  it as a source-provided total, not a computed one.
- **Questionnaire, not audited GPFS.** The manual says definitions are the same as the annual
  financial statements and _“As much as possible, follow the Model Financial Report”_, but also
  _“Where financial statements have not been completed, current estimates … should be sourced from
  the asset register”_ and _“Please provide best estimates where actual information is not
  available.”_ The data is therefore **not audited** and can be an estimate. Mark it
  `provisional`/`questionnaire` until reconciled.

**Bendigo anchor (FY2024-25, whole dollars unless stated):**

- VGC1 total expenditure: **`252,760,999.96`** (functions `240,782,205.96` + other `11,978,794`).
- VGC1 total revenue: **`277,002,000.17`** (functions `88,924,766.59` + rates/VGC
  `188,077,233.58`; the printed components differ from the total by `$1.00` due to rounding).
- ABS1 total capital outlays: **`56,221,353.20`**.
- ABS2 total assets `2,595,603,000`; total liabilities `123,597,000`; total equity `2,472,006,000`.

### 3.2 LGPRF / Know Your Council — all 79, performance indicators only

**Official pages.** <https://www.vic.gov.au/know-your-council> (fetched, HTTP 200);
dashboard <https://www.vic.gov.au/know-your-council-comparison-dashboard> (fetched, HTTP 200);
LGV guidance <https://www.localgovernment.vic.gov.au/strengthening-councils/performance-reporting>
(live 403; verified via Wayback capture 25 October 2026).

**What it is.** The Local Government Performance Reporting Framework (LGPRF) is mandatory for all
Victorian councils. LGV's page says it is _“made up of 59 measures from a range of service areas,
including roads, planning, animal management and waste”_, plus a **27-item Governance and
Management checklist**.

**Current rows at source.** The full data set covers **2020-21 through 2024-25**, **79 councils**,
**58 measures in 2020-21 to 2022-23 and 59 in 2023-24 and 2024-25**. Verified locally: each year
sheet has 4,582 rows (2020-21 to 2022-23) or 4,661 rows (2023-24, 2024-25), and 79 distinct council
names.

**Downloaded and verified:**

- LGPRF full data set 2020-25 XLSX:
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0019/191008/LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx>
  — 3,241,185 bytes via Wayback, SHA-256
  `d88f7ede3a154f1beb6359850dc25a68159d08e23478fec8f138d67d1b787376`. Direct live download
  returned **HTTP 403**; the archive copy is byte-verified.
- DataVic metadata: <https://discover.data.vic.gov.au/dataset/local-government-performance-reporting>
  (fetched via CKAN API, HTTP 200). Licence **CC BY 4.0** (`license_id: cc-by`). Notes say the data
  _“may change as councils occasionally need to update their performance data”_ and that downloaders
  agree _“not to use the council performance data set to aid in the publication of overly simplistic
  league tables of councils.”_

**Granularity.** Long-format indicator rows: `Council`, `Group`, `ID`, `Description`,
`Service Provided`, `Data applicable?`, `Result`, `Variation`, then forecast columns. The
financial-adjacent measures are **ratios/per-head**, not dollar statement lines. Examples from the
2024-25 sheet: `C1` Expenses per head of municipal population; `C2` Infrastructure per head;
`C4` Own-source revenue per head; `C5` Recurrent grants per head; `E2` Expenses per property
assessment; `E4` Average rate per property assessment; `L1` Current assets vs current liabilities;
`L2` Unrestricted cash vs current liabilities; `LB6` Loans per head; `O2` Loans and borrowings
compared to rates; `O5` Asset renewal and upgrade compared to depreciation; `OP1` Adjusted
underlying surplus (or deficit); `S1` Rates compared to adjusted underlying revenue.

**What it does not contain.** No total expenses, total revenue, capital expenditure dollars,
grant dollars, balance-sheet lines, cash-flow lines, notes or special schedules. It cannot replace
the GPFS or the VLGGC workbooks.

**Units.** Mixed per indicator: dollars per head, percentages/fractions, ratios, days, counts.
Never sum results across indicators.

**Reporting dates.** Financial year ended 30 June; the 2020-25 data set's last issue is
**5 November 2025**. Council annual reports are presented within four months of year end (LGA 2020
s.100(2)(b)), so the performance statement is normally public by late October/November.

**Licence.** **CC BY 4.0** — the one all-79 financial-adjacent source that is openly licensed.

**Feasibility without double counting.** Easy to parse, safe to publish as a **separate
performance-indicator layer**. Never add `C1`/`C4`/`C5` to VGC1 dollars; they are ratios/per-head
measures with different denominators and scope. `C1` can be used as a cross-check only after
agreeing the population and expense base.

### 3.3 Individual council annual reports / audited GPFS — the only full statement-line source

**What it is.** Every council must prepare an annual report containing, among other things,
**audited financial statements** (Local Government Act 2020 (Vic) s.98(2)(c)). The current Act is
version 027, in force 20 October 2026 (authorised DOCX SHA-256
`ef5861a757185f150c62b9b7e43e44d87bb90f37ef37c6edf65b3b1f1ffb6ddc`); s.98(2) reads (verbatim):
_“an annual report must contain the following— … (c) audited financial statements; …”_. Section
99 requires the statements to be prepared, audited and certified; s.100 requires the annual report
to be presented at a Council meeting open to the public within **4 months of the end of the
financial year** (or before election day in an election year).

**Current rows at source.** **79 councils × one annual report per financial year.** Each report
typically contains the financial report (income statement, balance sheet, cash-flow statement,
notes, sometimes special schedules) as a section, or as a standalone PDF. **In DB: 0 VIC council
rows.**

**Verified example — City of Greater Bendigo, FY2024-25.**

- Annual report page: <https://www.bendigo.vic.gov.au/about-us/plans-strategies-and-documents/annual-report>
  (fetched, HTTP 200). It lists FY2020-21 through FY2025-26 annual report PDFs.
- FY2024-25 annual report PDF:
  <https://www.bendigo.vic.gov.au/sites/default/files/2025-10/City-Greater-Bendigo-Annual-Report-2024-2025.pdf>
  (fetched, HTTP 200, **14,564,003 bytes**, SHA-256
  `64b180946165b6cb0ef1286ab53915565d8192e22343ce1dbbfdfe7ed13083bf`; 172 pages by `/Type /Page`
  count).
- The financial report section is in **`$'000`** (the income statement header shows
  `Note $ '000 $ '000`). Income statement: total income/revenue **`277,002`**, total expenses
  **`252,761`**; balance sheet: total assets **`2,595,603`**, total liabilities **`123,597`**,
  total equity **`2,472,006`**; cash-flow: payments for property, infrastructure, plant and
  equipment **`55,748`**.
- **These GPFS figures reconcile to the VLGGC 2024-25 workbooks as shown in §0.** This is the
  strongest single piece of evidence in this document.

**Granularity.** Full statement lines: income statement (revenue by source; expenses by function
and nature — employee, materials/services, depreciation, finance, other), balance sheet, cash-flow
statement, notes (grants, commitments, related parties, asset revaluations), and special schedules
where published. Council-level consolidated statements; some councils publish fund-level
General/Water/Sewer statements too.

**Units.** **Commonly `$'000`**, but not universal; read each report's header. Bendigo FY2024-25 is
`$'000` (verified). The VLGGC workbooks are whole dollars — a conversion trap.

**Licence.** Each council's own copyright. There is no standard open licence across 79 councils.
Some councils publish topic datasets on data.vic under CC BY, but the annual report/GPFS itself is
usually not explicitly licensed. Treat each council as a separate licence decision; Bendigo's
report was not verified for an open licence this pass.

**Reporting dates.** Audited financial statements and annual report presented within **4 months of
30 June** (s.100(2)(b)) → normally by **31 October**; in an election year, before election day
(s.100(2)(a)). Publication formats and page structure vary widely.

**Feasibility without double counting.** **High value, high effort.** There is no central file:
79 different PDF layouts, occasionally scanned, occasionally XLSX. Feasible only council by council
with a reconciliation gate. Within one report:

- Expenses by function and expenses by nature are two cuts of the same total — never sum.
- Consolidated includes fund statements — never sum consolidated + General + Water + Sewer.
- Grant revenue in the income statement and grant lines in the notes/special schedules overlap —
  do not add both.
- Capital grants and capital expenditure are not recurrent expense — keep separate.
- The GPFS total expenses/total revenue is the authority; reconcile any bulk source to it.

**Pilot relevance.** The Bendigo GPFS is the reconciliation target for the VLGGC pilot; it is a
verified, text-searchable PDF, not a 200-page scanned report.

### 3.4 VLGGC Annual Allocation Report — grants overlay only

**Official page.** Same VLGGC section:
<https://www.localgovernment.vic.gov.au/funding-programs/victoria-grants-commission/consultation-and-operations>
(live 403; Wayback verified). The VLGGC recommends **Commonwealth Financial Assistance Grants**
(general purpose and local roads) to Victorian councils; it does not provide grants to businesses or
individuals.

**Current rows at source.** Annual **Allocation Report** and council-level allocation schedules.
The 2024-25 report is a PDF:
<https://www.localgovernment.vic.gov.au/__data/assets/pdf_file/0019/210727/2024-25-VLGGC-Annual-Allocation-Report-Sept-2024.pdf>
(archived; 1,628,398 bytes, SHA-256
`9efcc61d5105cdae5353a536759e36470c44af6417fc9c3af4c2990473571788`). It is a PDF table, not a
row-level dataset or API.

**Granularity.** Council-level Commonwealth FAG entitlement/allocations; not council expenditure,
not service/program, not capital. It is **grant income**, not spending.

**Units.** Dollars in PDF tables; verify each schedule.

**Licence.** Attribution/permission, same VLGGC conditions; no CC licence.

**Reporting dates.** Annual allocation reports; the 2024-25 report is dated **September 2024**,
with quarterly payments and annual consultation (page calendar: final allocation advice in
August/September, first quarterly payment 15 August).

**Feasibility without double counting.** Medium (PDF tables, stable layout). The FAG is a
**Commonwealth grant administered through the VLGGC** and appears inside a council's grant revenue
in the GPFS/VGC1. It must **not** be added to expenditure, and must **not** be added on top of the
same grant revenue line in VGC1. Keep the funding source explicit: Commonwealth → VLGGC → council.

### 3.5 data.vic CKAN — no consolidated council GPFS dataset

**Official portal/API.** <https://discover.data.vic.gov.au> and
`https://discover.data.vic.gov.au/api/3/action` (keyless, verified HTTP 200).

**Current rows at source.** Targeted `package_search` queries found **no consolidated VIC council
GPFS dataset**. The council-relevant datasets are:

| Dataset                                                                                              | What it is                                              | Licence     |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------- |
| `local-government-performance-reporting` (Know Your Council / LGPRF)                                 | 79-council performance indicators, 2020-25              | CC BY 4.0   |
| `victorian-local-government-waste-data-dashboard`                                                    | Council waste tonnages/costs                            | CC BY 4.0   |
| `2011-local-government-area-profile`, `2015-local-government-area-profiles`, individual LGA profiles | ABS/state demographic and economic profiles             | CC BY 4.0   |
| `specific-purpose-grants`                                                                            | State grants dataset (not council financial statements) | per dataset |

**Granularity.** Indicators, waste services, demographics — **not** council financial statements.
A CKAN search is still worth doing per council (some councils publish topic data), but do not
assume a council's CKAN presence includes its GPFS.

**Units.** Per resource; no common unit.

**Reporting dates.** Per dataset; LGPRF updated annually (2020-25 release, last issue
5 November 2025); waste data annual releases.

**Feasibility without double counting.** Not a council spending source except as an indicator or
service overlay. Never sum a CKAN LGA-tagged row with a council financial row; an LGA tag is a
place, not a reporting entity.

### 3.6 Victorian local government waste data — service/cost overlay

**Official dataset.** <https://discover.data.vic.gov.au/dataset/victorian-local-government-waste-data-dashboard>
and the dashboard <https://www.vic.gov.au/victorian-local-government-waste-data-dashboard>
(CKAN API fetched, HTTP 200; licence **CC BY 4.0**).

**What it is.** Since 2001-02, the Victorian Government has surveyed councils about kerbside
collection services (rubbish, mixed recycling, glass, food organics/garden organics) and other
council waste services, including **tonnages, costs and composition**. The dashboard is based on
council survey responses.

**Granularity.** Council-level waste service tonnages, costs and composition; **not** a financial
statement. It may overlap the VGC1 `Waste Management` function — both are council waste costs, but
the survey and the financial return are different collections with different boundaries.

**Units.** Tonnes, dollars and percentages per indicator; confirm per resource.

**Reporting dates.** Annual survey releases (e.g. 2024.02, 2025.02, 2025.03).

**Licence.** **CC BY 4.0** (verified `license_id: cc-by`).

**Feasibility without double counting.** Useful as a **service overlay**, not as a financial
total. Never add waste-survey costs to VGC1 `Waste Management` expenditure; they may measure
different things (e.g. gross service cost vs council expenditure, kerbside only vs all waste).

### 3.7 VAGO — context/validation, not a dataset

**Official page.** <https://www.audit.vic.gov.au/> (fetched, HTTP 200). The Victorian Auditor-General
audits local government entities and publishes narrative reports, sometimes with council-level
tables. It is **not** a row-level financial dataset and not a bulk source.

**Use.** Validation/context (financial sustainability, audit findings, qualified opinions) and a
pointer to councils with issues. Do not extract spending rows from audit narratives.

### 3.8 ABS GFS and VIC Budget — benchmarks, not council spending

- **ABS GFS (`abs-gfs`, 169 rows in DB):** an aggregate government-finance benchmark, including a
  local-government aggregate in some tables. It is **not council-level** and cannot be split into
  the 79 councils. Use only as a macro cross-check; never add it to council rows.
- **VIC Budget (`vic-budget`, 28 rows in DB):** 20 COFOG-A general-government expense rows plus 8
  DTF departmental statement rows, statewide only. It is **state** spending, not council spending.
  Never sum it with council rows, and never treat a state program delivered in a municipality as
  council spending.
- **Victorian Infrastructure Pipeline / State Capital Program:** state capital projects, not
  council capital. Keep separate.

---

## 4. Existing DB rows: overlap and double-count review

Read-only checks against `ausspend_dev` on 17 November 2026:

```text
db.measures.countDocuments({})                     -> 515449
db.measures.countDocuments({source_id:"vic-budget"}) -> 28
db.measures.countDocuments({source_id:"dubbo-council"}) -> 245   (NSW, not VIC)
```

**There is no VIC council source in the DB.** The only VIC source is `vic-budget` (28 state rows).
The 245 `dubbo-council` rows are NSW budget/estimate lines and must not be mixed with VIC data.

### 4.1 `vic-budget` (28 rows)

- **Source:** 2026-27 COFOG-A general government expenses workbook (20 additive rows for 2025-26
  and 2026-27 budget) plus 8 DTF departmental statement rows marked `agency_detail` (non-additive).
- **Scope:** statewide. **Not** council spending.
- **Overlap with any council source:** none at row level. A UI that shows “VIC spending” must
  separate state and local layers; never add them.

### 4.2 No VIC council rows

At planning time there was no `vic-council`, `vic-vlgc` or council annual-report source in the DB.
Pilot A adds the VLGGC VGC1 source `vic-vlgc-vgc1` (5,401 non-additive rows, 79 councils; see §11)
and pilot B adds `vic-vlgc-abs` for ABS1/ABS2-3 (9,059 non-additive rows, same 79 councils; see
§12); the LGPRF and the individual council GPFS PDFs are still **not ingested**. Ingestion upserts on a
natural key that includes the council, fiscal year, statement, function/nature line and measure
type so counts stay stable and no duplicate natural keys appear.

---

## 5. Double-count map (the rules to carry into any future connector)

| A                            | B                                  | Relationship                                                                         | Rule                                                                                  |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| VGC1 total expenditure       | GPFS total expenses                | Same total for Bendigo FY2024-25 (exact to $0.04)                                    | Use **one** as the authority per council-year; never add.                             |
| VGC1 function rows           | VGC1 total expenditure             | Components of the functions-only total; the `Other` column bridges to the full total | Never add both; the total is the sum.                                                 |
| VGC1 recurrent total         | VGC1 non-recurrent tabs            | Separate cuts of the return                                                          | Do not add unless the manual's mapping proves disjointness; confirm first.            |
| VGC1 expenditure by function | VGC1 expenditure by nature         | Two cuts of the same total                                                           | Never add.                                                                            |
| VGC1 rates revenue           | VGC2 rates/valuations              | Same rates total linked by the manual (VGC2 code 04999(6))                           | Never add VGC2 rates to VGC1 revenue.                                                 |
| ABS1 capital outlays         | VGC1 expenses                      | Capital vs recurrent                                                                 | Never add; reconcile capital to cash flow/notes.                                      |
| ABS2-3 balance sheet         | ABS2-3 income statement            | Different statements                                                                 | Never add.                                                                            |
| VLGGC `Totals` row           | Council rows                       | Source-provided cross-council total                                                  | Do not publish as a platform aggregate; no cross-council totals.                      |
| LGPRF `C1`/`C4`/`C5`         | VGC1 dollars                       | Ratios/per-head vs dollars                                                           | Never add; use only as a cross-check after agreeing population/base.                  |
| LGPRF ratios                 | Each other                         | Different denominators                                                               | Never sum across indicators.                                                          |
| VLGGC FAG allocation         | VGC1 grant revenue                 | FAG is a component of grant income                                                   | Do not add to expenditure; do not double count inside grants.                         |
| VGC1 State grants            | VGC1 Commonwealth grants           | Different funding sources                                                            | Can be shown separately; do not collapse into a single “grants” total without labels. |
| Waste dashboard costs        | VGC1 Waste Management function     | Different collections/boundaries                                                     | Never add; service overlay only.                                                      |
| Council GPFS consolidated    | Council fund statements            | Consolidated includes funds                                                          | Pick one basis; never sum.                                                            |
| GPFS expenses by function    | GPFS expenses by nature            | Two cuts                                                                             | Never sum.                                                                            |
| GPFS grant revenue           | GPFS notes/special schedules       | Overlapping disclosures                                                              | Do not add both.                                                                      |
| Council rows                 | `vic-budget` state rows            | State vs local                                                                       | Never add; different reporting entity.                                                |
| Council rows                 | ABS GFS local-government aggregate | Aggregate vs entity                                                                  | Never add; benchmark only.                                                            |
| Council rows                 | VAGO narrative                     | Audit context                                                                        | Never convert narrative to rows.                                                      |

---

## 6. Pilot recommendation (one pilot)

**Pilot: the VLGGC 2024-25 all-79 financial workbooks (VGC1 + ABS1 + ABS2-3), with a mandatory
reconciliation gate on one council — City of Greater Bendigo, FY2024-25 — against its audited GPFS.
No PDF batch; no 79-council ingestion.**

**Why this pilot, and not a 79-PDF job:**

1. **Bulk source first.** The 2024-25 VLGGC workbooks cover **79/79** councils in one XLSX family,
   and the public page lists the series back to FY2015-16. This is the “official bulk/standardised
   source first” path.
2. **It aligns with the performance data.** LGPRF 2024-25 covers the same 79 councils and the same
   financial year, so the platform can test a financial layer and a performance layer side by side
   without mixing them.
3. **The totals already reconcile for Bendigo.** VGC1 total expenditure and revenue and ABS2-3
   total assets/liabilities/equity match the audited GPFS exactly (see §0). The remaining work is
   to productionise the parse, map every category, and resolve the capital-outlay bridge.
4. **It forces the real problems first.** Units (whole dollars vs `$'000`), recurrent vs
   non-recurrent, function vs nature, rates in VGC1 vs VGC2, capital vs recurrent, source totals vs
   platform totals, unaudited questionnaire vs audited GPFS.
5. **It avoids a publication decision on 79 different council copyrights** in the first step. The
   VLGGC attribution condition still needs a decision, but it is one decision, not 79.

**Pilot scope (implemented — see §11):**

- Parse the VGC1 `Total Exp`/`Total Rev` sheets, the nine function tabs and the five expense
  columns; the ABS1 `Total Outlays` sheet and asset classes; the ABS2-3 `Balance Sheets`,
  `Sources & Applications` and `ABS3` income-statement/cash-flow categories.
- Emit rows with explicit `source_id: "vic-vlgc"`, `fiscal_year: "2024-25"`,
  `measure_type: "actual"` only after reconciliation (otherwise `provisional`), `statement`
  (`income`, `balance`, `cash_flow`, `capital`), `function`, `nature`, `asset_class`,
  `fund` absent (the questionnaire is consolidated, not fund-level), and `reconciliation_status`.
- **Reconcile Bendigo FY2024-25:** total expenditure `$252,760,999.96` and total revenue
  `$277,002,000.17` to the GPFS; total assets/liabilities/equity to the GPFS; capital outlays
  `$56,221,353.20` to the cash-flow `$55,748k` and document the `$473,353` bridge.
- **Do not** publish a cross-council total, even though ABS1 carries a `Totals` row. Do not mix
  VGC1 and LGPRF rows in one total.
- Demonstrate the unit conversion (`$'000` GPFS vs whole-dollar VGC) and the rates/VGC2 exclusion.

**Success criterion:** every emitted line for Bendigo reconciles to a published GPFS subtotal or has
an explicit, documented bridge (capital outlays are the expected exception); no cross-council total;
no mixing with `vic-budget`, ABS GFS, LGPRF ratios or the waste dashboard.

**Fallback:** if the VLGGC mapping cannot be reconciled for a particular category, publish only the
categories that do reconcile, flag the source as “questionnaire, unaudited”, and use that council's
audited GPFS for the remaining statement lines. Do not force a total.

---

## 7. Prioritised rollout (after the pilot)

1. **P0 — VLGGC 2024-25 + Bendigo reconciliation (pilot).** Prove the bulk parse and the GPFS
   gate. Keep the source layer separate (`jurisdiction_level: "local"`).
2. **P1 — VLGGC 2024-25 all 79, reconciled category layer.** Publish only the categories that pass
   the pilot's rules: income statement total expenses/revenue, function × nature, capital outlays
   by asset class, balance-sheet totals. Label every row **questionnaire/unaudited**. No
   cross-council totals; no platform-computed state+local totals.
3. **P2 — VLGGC historical series 2015-16 to 2023-24.** Ingest after the same reconciliation gate
   on a sample of councils/years; keep each year separate; do not back-cast or rebase.
4. **P3 — GPFS expansion by materiality, only where needed.** For councils or lines where the
   VLGGC category is insufficient (notes, special schedules, fund-level statements), rank by
   FY2024-25 total expenses and take the largest first; one adapter/mapping per council; never a
   blind 79-PDF batch.
5. **P4 — LGPRF performance layer (CC BY 4.0).** Publish the 59 indicators as a separate
   performance layer; never add them to financial dollars; respect the “no simplistic league
   tables” condition.
6. **P5 — Grants overlays.** VLGGC FAG allocation (Commonwealth → council) and VGC1 grant revenue;
   reconcile to the same grant line; never add to expenditure.
7. **P6 — Waste service overlay (CC BY 4.0).** Publish waste tonnages/costs as a service layer;
   never add to VGC1 `Waste Management`.
8. **P7 — VAGO/ABS benchmarks.** Context only; never add to council rows.
9. **Do not** ingest alpine resort boards, water corporations, waste groups, CMAs, library
   corporations, MAV/VLGA or any other non-council entity into the 79. If they are ever added, model
   them as separate entity types with their own no-double-count rules.

**Presentation rules for any later UI:** council spending is **not** state spending; no
cross-council total; no ranking that implies a like-for-like total; always show the source, year,
measure type, statement and unit; mark VLGGC rows as questionnaire/unaudited until reconciled.

---

## 8. Verification log

**Fetched successfully (HTTP 200) this pass:**

- Victorian Local Government Directory — September 2026 XLSX:
  <https://www.vic.gov.au/sites/default/files/2026-09/2026-VIC-LOCAL-GOVERNMENT-DIRECTORY-September-2026.xlsx>
  (593,305 bytes; SHA-256 `de05a89f81685d7543adf138fd554fb25bf880d86e56fe3105ac084d1f5a2394`).
- Victorian Local Government Contacts — September 2026 XLSX:
  <https://www.vic.gov.au/sites/default/files/2026-09/2026-VIC-COUNCIL-DATA-September-2026.xlsx>
  (67,464 bytes; SHA-256 `70c30f5c7b47d8ee84ad733ea21e56f4ad8d7abe61233240f1d7c8cb4bd1f4bd`).
- Local government contacts and information:
  <https://www.vic.gov.au/local-government-contacts-and-information>
- Know Your Council: <https://www.vic.gov.au/know-your-council>
- Know Your Council comparison dashboard:
  <https://www.vic.gov.au/know-your-council-comparison-dashboard>
- Know Your Council — Alpine Shire Council:
  <https://www.vic.gov.au/know-your-council-alpine-shire-council> (council report links)
- Local Government Act 2020 (Vic), version 027:
  <https://www.legislation.vic.gov.au/in-force/acts/local-government-act-2020/027>
  and authorised DOCX
  <https://content.legislation.vic.gov.au/sites/default/files/2026-10/20-9a027.docx>
  (SHA-256 `ef5861a757185f150c62b9b7e43e44d87bb90f37ef37c6edf65b3b1f1ffb6ddc`).
- DataVic CKAN API: `package_show?id=local-government-performance-reporting` and
  `package_show?id=victorian-local-government-waste-data-dashboard` (HTTP 200; licence `cc-by`).
- City of Greater Bendigo annual report page:
  <https://www.bendigo.vic.gov.au/about-us/plans-strategies-and-documents/annual-report>
- City of Greater Bendigo FY2024-25 annual report PDF:
  <https://www.bendigo.vic.gov.au/sites/default/files/2025-10/City-Greater-Bendigo-Annual-Report-2024-2025.pdf>
  (14,564,003 bytes; SHA-256
  `64b180946165b6cb0ef1286ab53915565d8192e22343ce1dbbfdfe7ed13083bf`).
- VAGO home: <https://www.audit.vic.gov.au/>

**Verified via Wayback (live site returned HTTP 403 to automated fetches):**

- LGV Performance reporting page, capture 25 October 2026:
  <https://www.localgovernment.vic.gov.au/strengthening-councils/performance-reporting> — LGPRF
  59 measures, 27-item checklist, full data set link, 2025-26/2026-27 guidance.
- LGV Consultation & Council Data, capture 12 December 2025:
  <https://www.localgovernment.vic.gov.au/funding-programs/victoria-grants-commission/consultation-and-operations>
  — VGC1/ABS1/ABS2-3/ALG1/LGV1 file list, due dates, conditions of use.
- LGPRF 2020-25 XLSX:
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0019/191008/LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx>
  (3,241,185 bytes; SHA-256
  `d88f7ede3a154f1beb6359850dc25a68159d08e23478fec8f138d67d1b787376`).
- VLGGC 2024-25 VGC1/ABS1/ABS2-3 XLSX and Manual (sizes/SHAs in §3.1).
- VLGGC 2024-25 Annual Allocation Report PDF:
  <https://www.localgovernment.vic.gov.au/__data/assets/pdf_file/0019/210727/2024-25-VLGGC-Annual-Allocation-Report-Sept-2024.pdf>
  (1,628,398 bytes; SHA-256
  `9efcc61d5105cdae5353a536759e36470c44af6417fc9c3af4c2990473571788`).

**Local checks run (read-only):**

- Directory XLSX: 79 council entries; name classes 34 City + 6 Rural City + 38 Shire + 1 Borough.
- Contacts XLSX `ALL COUNCIL DATA`: 79 council rows.
- LGPRF 2020-25: 79 councils per year; 58 measures in 2020-21–2022-23 and 59 in 2023-24–2024-25;
  4,582/4,661 rows per year sheet.
- VLGGC 2024-25 `VGC1 Total Exp`: 79 rows, no duplicates, no zeros in the total column.
- VLGGC 2024-25 `ABS1 Total Outlays`: 79 council rows + 1 `Totals` row.
- VLGGC 2023-24 `VGC1 Total Exp`: 79 rows.
- Bendigo reconciliation (values above) against the GPFS text extracted from the annual report PDF.

**DB checks (read-only):**

```bash
mongosh "mongodb://localhost:27017/ausspend_dev" --quiet --eval \
  'print(db.measures.countDocuments({})); print(db.measures.countDocuments({source_id:"vic-budget"}));'
# 515449
# 28
```

No write, update, delete, index or schema operation was performed. The worktree diff for this item
is docs-only.

---

## 9. Ambiguities / open questions (verbatim where possible)

1. **VLGGC licence.** _“Content from this spreadsheet should be attributed as Victorian Local
   Government Grants Commission data collection.”_ — Is that sufficient for publication, or is
   written permission needed? There is no CC licence. The same page says councils _“provide
   permission for this online release”_. One decision covers all 79, unlike the per-council GPFS.
2. **VLGGC data quality.** _“The data in these spreadsheets is provided for information purposes
   only… the Victorian Local Government Grants Commission does not guarantee the material to be
   free from error.”_ And the manual says _“Where financial statements have not been completed,
   current estimates of the respective values should be sourced from the asset register”_ and
   _“Please provide best estimates where actual information is not available.”_ — Which rows are
   actuals vs estimates? The workbook does not flag them. The pilot must reconcile, not assume.
3. **Capital outlay bridge.** ABS1 total capital outlays for Bendigo are `$56,221,353.20`; the GPFS
   cash-flow payments are `$55,748k` (difference `$473,353`, 0.85%). Is the difference accrual vs
   cash, capital work in progress, donated assets, or a classification difference? The pilot must
   document the bridge; it must not silently use one as the other.
4. **Recurrent vs non-recurrent.** VGC1 separates recurrent and non-recurrent tabs, but the
   `Total Exp` last column matches the GPFS total expenses. Are the non-recurrent tabs already
   included in the function totals, or additional? The manual's mapping must be confirmed before
   summing anything.
5. **Rates in VGC1 and VGC2.** VGC1 revenue includes rates; VGC2 reports valuations and rates.
   Are they the same measure? If yes, VGC2 cannot be added. Confirm from the manual before any
   join.
6. **`Totals` row.** ABS1 contains a source-provided `Totals` row across all councils. The brief
   says no cross-council totals. Should the platform ignore it entirely, or show it only as a
   source-provided label? (Recommendation: ignore for publication; no platform-computed total.)
7. **Name aliases.** Directory vs KYC spellings differ (`Colac Otway`/`Colac-Otway`,
   `Greater Shepparton City`/`Greater Shepparton`, `Borough of Queenscliffe`/`Borough of
Queenscliffe Council`). Which canonical name/ID should the platform use? A council ID (e.g. ABS
   LGA code) is safer than a display name.
8. **Non-council entities.** Are alpine resort boards, water corporations, waste groups, CMAs,
   library corporations, MAV/VLGA ever to be modelled? (Recommendation: no, not as councils; if
   ever, separate entity types and no addition to the 79.)
9. **Council count stability.** The current official count is 79 (September 2026 directory). The
   `Local Government Legislation Amendment (Stronger Communities) Act 2026` appears in LGV's
   navigation and may change governance/structures. Re-read the directory and the Act each year;
   do not freeze the population.
10. **GPFS unit variation.** Bendigo FY2024-25 is `$'000` (verified). Other councils may use `$`.
    Should the connector reject any report without an explicit unit header (as the NSW PDF
    extractor does)? (Recommendation: yes.)
11. **No cross-council totals.** The brief says no aggregate across councils. Is a clearly labelled
    source-provided `Totals` row ever acceptable, or should every total be suppressed? (Current
    recommendation: suppress; show only per-council rows.)
12. **Council vs state.** Council spending is not state spending. Should council rows live under a
    new `jurisdiction_level: "local"` so they can never be summed with `vic-budget` or ABS GFS by
    accident? (Recommendation: yes.)

---

## 10. What this document deliberately does not do

- It does not ingest, parse or queue any council PDF or XLSX.
- It does not add schema fields, API endpoints, DB rows, indexes or migrations.
- It does not create a cross-council or state-plus-council total.
- It does not assert a licence for the VLGGC workbooks, council annual reports or VAGO reports
  beyond the quoted terms.
- It does not claim the 79 list is frozen: boundary changes, amalgamations, name changes and
  administrators can change the population, so re-read the official directory each year.
- It does not treat the VLGGC questionnaire as audited GPFS: it is a council-supplied return that
  reconciles well at the totals but is not the auditor's statement.

## 11. Pilot A implementation record (18 November 2026)

**Scope delivered:** VLGGC VGC1 2024-25 only — income/expense by function and nature for all 79
councils. ABS1 capital outlays, ABS2-3 balance sheets/cash flow, the 79 individual council GPFS
PDFs and every other state remain a later item.

**Source and archive**

- Official landing page:
  <https://www.localgovernment.vic.gov.au/funding-programs/victoria-grants-commission/consultation-and-operations>
- Official resource:
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0030/225957/2024-25-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx>
- The live page/asset return a Cloudflare challenge (HTTP 403) to automated clients. The connector
  resolves the documented Wayback snapshot through the availability API
  (`20260818214833`), retains the official URLs as provenance, and refuses to publish unless the
  bytes match the verified hash.
- Archived outside the repo at
  `~/ausspend-source-archive/vic-vlgc-vgc1/2024-25-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx`
  — **847,818 bytes, SHA-256
  `9d72ff7005a48acec0361b36d47e54057363ee5503ddffedebc6158fc54b5572`**. Metadata-only manifest:
  [`docs/source-archive/vic-vlgc-vgc1-2024-25.json`](./source-archive/vic-vlgc-vgc1-2024-25.json).

**Licence / attribution (not CC BY).** The workbook's Conditions of Use say (verbatim):
_“Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission
data collection.”_ The disclaimer adds that councils _“provide permission for this online release”_
and the Commission _“does not guarantee the material to be free from error.”_ This is
**attribution + permission**, not a CC licence. The source metadata records the terms verbatim; only
derived rows are emitted and the workbook is not redistributed.

**Units.** Whole AUD (cells carry cents), converted explicitly to integer cents at ×100. The unit is
never inferred from magnitude.

**Rows and no-cross-total proof**

- 79 council entities; council labels expanded deterministically (`Alpine (S)` → `Alpine Shire
Council`, `Queenscliffe (B)` → `Borough of Queenscliffe`) and the printed label retained in
  `vlgc_council_label`.
- 5,401 records: 3,555 function×nature rows (79 × 9 functions × 5 natures), 1,396 function totals /
  printed subtotals / bridges / grand totals.
- The source **Totals row is suppressed on all 11 parsed sheets** (2 total sheets + 9 function
  tabs); no record has a Totals entity and no cross-council total is published or computed.
- Every row is `source_id: vic-vlgc-vgc1`, `statement: income`, `jurisdiction_level: local`,
  `jurisdiction: VIC`, `measure_type: actual`, `aggregation_role: agency_detail`,
  `data_quality_flag: provisional/local_government`, `verified: false`.
- VGC1 functions/natures are questionnaire dimensions, **not COFOG**; no `function_code` is set.
- No row is mixed with `vic-budget`, ABS GFS, LGPRF, waste or NSW council data.

**Bendigo reconciliation gate.** City of Greater Bendigo FY2024-25:

| Line              | VGC1 (whole AUD) | Audited GPFS (`$'000`) | Result                         |
| ----------------- | ---------------: | ---------------------: | ------------------------------ |
| Total expenditure | `252,760,999.96` |              `252,761` | matches to 4c (GPFS rounding)  |
| Total revenue     | `277,002,000.17` |              `277,002` | matches to 17c (GPFS rounding) |

Only these two Bendigo totals carry `reconciliation_status: reconciled_to_gpfs`; every other row
(including Bendigo’s function/nature cuts) remains `questionnaire_unaudited`, because the GPFS does
not publish function-level lines to bridge to. Totals are never forced: if the Bendigo gate fails,
the connector raises the premise falsifier and publishes nothing.

**DB delta.** Before pilot A: **515,955** measures. After: **521,356** (+5,401, all
`vic-vlgc-vgc1`). No deletes, no updates to another source, no synthetic rows.

**Reproduce.**

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
export VGC1_SOURCE_PATH=/path/to/2024-25-VLGGC-Questionnaire-VGC1-Expenditure-and-Revenue.xlsx
npm run ingest:vic-vlgc
# [ingest:vic-vlgc] vic-vlgc-vgc1: success fetched=5401 upserted=5401
# [ingest:vic-vlgc] db source_rows=5401 distinct_councils=79 totals_entities=0 all_measures=521356
```

Checks run on 18 November 2026: `npm run typecheck` (shared + server + client), `npm run lint`,
`npm test` (72 files, 803 passed, 2 skipped), `npm run build`, `npx vitest run
server/test/vic-vlgc-vgc1.test.ts` (79 entities, Totals suppression, unit conversion, Bendigo
reconciliation, no-cross-total, idempotency, natural keys and licence metadata), mocked
`npm run test:e2e` on alt ports 3103/5176 (51 passed) and the live `npm run audit` against alt
ports 3103/5176 (38/38 checks passed, 0 failed). Every changed file passes Prettier; the repo-wide
`npm run format:check` still reports five pre-existing, untouched files (`deploy/README.md`,
`.tmp-audit/persist-ingest.ts`, `docs/NSW_COUNCIL_DATA_NSW_SWEEP.md`, `docs/SOC_MULTI_STATE.md`,
`e2e/search.spec.ts`) that already failed at the branch base.

## 12. Pilot B implementation record (18 November 2026)

**Scope delivered:** VLGGC 2024-25 ABS1 (Capital Outlays and Sales) and ABS2-3 (Balance Sheets and
Other Finances) only — all 79 Victorian councils. No 79-PDF batch, no VGC1 re-ingest, no other state.

**Source and archive**

- Official landing page:
  <https://www.localgovernment.vic.gov.au/funding-programs/victoria-grants-commission/consultation-and-operations>
- ABS1 resource:
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0024/225960/2024-25-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx>
  — **477,675 bytes, SHA-256 `639fe70a6de9cbe27c44c5a59ec75c79a99827db706a92aa1353bfd574985f61`**.
- ABS2-3 resource:
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0025/225961/2024-25-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx>
  — **147,062 bytes, SHA-256 `6975d1d9abf0d43f8776dc28fd73882670a8907f988d3bb94ad6c4055c50891f`**.
- The live page/asset returns a Cloudflare challenge (HTTP 403) to automated clients. The connector
  resolves the documented Wayback snapshot (`20260818214834`) through the availability API, retains
  the official URLs as provenance, and refuses to publish unless both byte streams match the verified
  hashes.
- Archived outside the repo under `~/ausspend-source-archive/vic-vlgc-abs/` — both exact XLSX files.
  Metadata-only manifest:
  [`docs/source-archive/vic-vlgc-abs-2024-25.json`](./source-archive/vic-vlgc-abs-2024-25.json).

**Licence / attribution (not CC BY).** The workbook's Conditions of Use say (verbatim):
_“Content from this spreadsheet should be attributed as Victorian Local Government Grants Commission
data collection.”_ The disclaimer adds that councils _“provide permission for this online release”_
and the Commission _“does not guarantee the material to be free from error.”_ This is **attribution

- permission**, not a CC licence. The source metadata records the terms verbatim; only derived rows
  are emitted and neither workbook is redistributed.

**Units.** Whole AUD (cells carry cents), converted explicitly to integer cents at ×100. The unit is
never inferred from magnitude.

**Rows and no-cross-total proof**

- 79 council entities, exact expanded names (`Alpine (S)` → `Alpine Shire Council`,
  `Queenscliffe (B)` → `Borough of Queenscliffe`); the printed label is retained in
  `vlgc_abs_council_label`.
- **9,059 records**: capital 1,173; balance 2,709; cash-flow 3,157; income 2,020.
- The four source **Totals rows** (`Total Outlays`, `O-Total`, `Balance Sheets`,
  `Sources & Applications`) are suppressed; no record has a Totals entity and no cross-council total
  is published or computed.
- Every row is `source_id: vic-vlgc-abs`, `jurisdiction_level: local`, `jurisdiction: VIC`,
  `measure_type: actual`, `aggregation_role: agency_detail`,
  `data_quality_flag: provisional/local_government`, `verified: false`, and carries `statement`
  (`capital`, `balance`, `cash_flow`, `income`), `statement_section`, `statement_line`,
  `vlgc_abs_measure`, `vlgc_abs_line_code`, `reconciliation_status`, and `asset_class` where a
  printed asset class applies.
- Zero cells are not emitted. Functions, asset classes, balance-sheet lines, cash-flow lines,
  income-statement categories and Sources & Applications rows are separate non-additive cuts; no
  section, function, asset class, statement or council is summed.
- No row is mixed with `vic-vlgc-vgc1`, `vic-budget`, ABS GFS, LGPRF, waste or NSW council data.
  ABS1 functions/asset classes are questionnaire dimensions, **not COFOG**; no `function_code` is set.

**Bendigo reconciliation gate.** City of Greater Bendigo FY2024-25 (whole AUD in VLGGC, `$'000` in
the audited GPFS):

| Line              | ABS workbook (whole AUD) | Audited GPFS (`$'000`) | Result                       |
| ----------------- | -----------------------: | ---------------------: | ---------------------------- |
| Total assets      |      `$2,595,603,000.00` |          `$2,595,603k` | exact                        |
| Total liabilities |        `$123,597,000.00` |            `$123,597k` | exact                        |
| Total equity      |      `$2,472,006,000.00` |          `$2,472,006k` | exact                        |
| Capital outlays   |         `$56,221,353.20` |   cash flow `$55,748k` | **differs by `$473,353.20`** |

The capital difference is **0.85%** and is a documented accrual/cash classification bridge, not a
reconciliation failure. It is recorded on the Bendigo total-capital row
(`reconciliation_status: bridged_to_gpfs_cash_flow`), in the manifest and here. Equality is never
forced. Only Bendigo total assets/liabilities/equity carry `reconciled_to_gpfs`; every other
category row remains `questionnaire_unaudited`.

**DB delta.** Before pilot B: **521,356** measures. After: **530,415** (+9,059, all
`vic-vlgc-abs`). No deletes, no updates to another source, no synthetic rows.

**Reproduce.**

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
export ABS1_SOURCE_PATH=/path/to/2024-25-VLGGC-Questionnaire-ABS1-Capital-Outlays-and-Sales.xlsx
export ABS23_SOURCE_PATH=/path/to/2024-25-VLGGC-Questionnaire-ABS2-and-3-Balance-Sheets-and-Other-Finances.xlsx
npm run ingest:vic-vlgc-abs
# [ingest:vic-vlgc-abs] vic-vlgc-abs: success fetched=9059 upserted=9059
# [ingest:vic-vlgc-abs] db source_rows=9059 distinct_councils=79 totals_entities=0 all_measures=530415
```

**Checks.** `npm run typecheck`, `npm run lint`, `npm test` (including
`server/test/vic-vlgc-abs.test.ts`: 79 entities, four-Totals-row suppression, unit conversion,
Bendigo balance reconciliation and capital bridge, no-cross-total, idempotency, natural keys and
licence metadata), `npm run build`, mocked `npm run test:e2e` and live `npm run audit` on alternate
ports. Do not run these against 3001/5173 or the production nginx.

## 13. Pilot C implementation record (18 November 2026)

**Scope delivered:** the historical VLGGC series **FY2019-20 to FY2023-24** for all 79 councils,
under the existing source ids `vic-vlgc-vgc1` (VGC1 income/expense) and `vic-vlgc-abs`
(ABS1 capital, ABS2-3 balance sheet/cash flow/income/Sources & Applications). **No new source
family**, no 2024-25 re-ingest, no NSW rows, no OLG data, no council PDFs.

### 13.1 Years landed and years deferred (no silent sampling)

| Fiscal year | Status |  VGC1 rows |   ABS rows | VGC1 natural-key scope |
| ----------- | ------ | ---------: | ---------: | ---------------------- |
| 2015-16     | landed |      5,420 |      8,896 | `fiscal_year: 2015-16` |
| 2016-17     | landed |      5,438 |      8,851 | `fiscal_year: 2016-17` |
| 2017-18     | landed |      5,427 |      8,835 | `fiscal_year: 2017-18` |
| 2018-19     | landed |      5,430 |      8,727 | `fiscal_year: 2018-19` |
| 2019-20     | landed |      5,426 |      8,903 | `fiscal_year: 2019-20` |
| 2020-21     | landed |      5,426 |      8,865 | `fiscal_year: 2020-21` |
| 2021-22     | landed |      5,427 |      8,868 | `fiscal_year: 2021-22` |
| 2022-23     | landed |      5,413 |      8,917 | `fiscal_year: 2022-23` |
| 2023-24     | landed |      5,407 |      8,995 | `fiscal_year: 2023-24` |
| **Total**   |        | **48,815** | **82,857** |                        |

**No year is deferred.** Every year FY2015-16..FY2023-24 has a parseable mapping and every year has
exactly 79 reporting entities. The two workbook generations differ and are mapped explicitly:

- FY2019-20..FY2023-24 print each VGC1 `E-*` tab as repeated sub-function blocks; **the first block
  of each tab is the printed `<function> Total`** (code 01199, 01299, …, 01996) and is mapped to the
  same function × 5-nature cut as pilot A. Later sub-function blocks are deliberately **not** summed.
- FY2015-16..FY2018-19 use the same VGC1/ABS1 layout but print `Family & Community Service`
  (singular) in the total-sheet header and a **144-column ABS2 balance sheet** (one fewer liability
  line, no lease-liability row; liabilities, equity, cash-flow, revenue and expense sections each
  shift left and have fewer printed lines). The connector selects the legacy ABS2 layout explicitly
  per year (`ABS23_LAYOUT_LEGACY_2015_18`) rather than assuming identical columns.
- 2016-17's ABS2-3 file is named `…ABS2-3-Balance-Sheets-and-Other.xlsx`; 2017-18 and 2018-19 use
  `…ABS2-Balance-Sheets-and-Other-Finances.xlsx`. All three carry the same `Balance Sheets` and
  `Sources & Applications` sheets and are mapped identically within the older generation.

### 13.2 Workbooks, snapshots and hashes

All bytes are archived outside the repo under `~/ausspend-source-archive/` (never redistributed).
The live VLGGC page/asset returns a Cloudflare challenge (HTTP 403); the connector resolves the
documented Wayback snapshot and refuses to publish unless the byte length and SHA-256 match.

| Year    | Workbook | Wayback snapshot | SHA-256                        |   Bytes |
| ------- | -------- | ---------------- | ------------------------------ | ------: |
| 2019-20 | VGC1     | 20220309015720   | `a9043c1a…b1219c5b`            | 853,697 |
| 2019-20 | ABS1     | 20220309015753   | `5556c35b…fcd337871`           | 483,359 |
| 2019-20 | ABS2     | 20220309015801   | `a45979fe…ab8ef123f3f`         | 145,479 |
| 2020-21 | VGC1     | 20221018093621   | `e075a4ce…b7300ba3b6caaa7`     | 899,273 |
| 2020-21 | ABS1     | 20221018093649   | `36ab30b5…59e2805eca8cbef9`    | 471,036 |
| 2020-21 | ABS2-3   | 20221018093657   | `d64d4749…c937d60612829a0966`  | 144,323 |
| 2021-22 | VGC1     | 20231109221951   | `11362f35…d61551954388cfd2d`   | 848,271 |
| 2021-22 | ABS1     | 20231109222002   | `30ec390b…f2f01937e943f3d18`   | 469,559 |
| 2021-22 | ABS2-3   | 20231109222007   | `25a28766…5a2423b9c039e90b`    | 144,732 |
| 2022-23 | VGC1     | 20241020185951   | `2dc779a3…e56283c33d33789f`    | 839,975 |
| 2022-23 | ABS1     | 20241020190003   | `c983ef2b…c60dbe11f186ca0`     | 470,335 |
| 2022-23 | ABS2-3   | 20241020190007   | `c7986d5b…f27b3e973b99f8386`   | 145,499 |
| 2023-24 | VGC1     | 20251120123849   | `f36ed668…888b76bdd54f106663`  | 842,585 |
| 2023-24 | ABS1     | 20251120123903   | `db4ed8fe…24e0fe4ce7e4fa59f3c` | 470,645 |
| 2023-24 | ABS2-3   | 20251120123907   | `a63354b9…b980b2b9e3b7d0b9258` | 145,962 |

Per-year metadata-only manifests are in `docs/source-archive/` as
`vic-vlgc-vgc1-<year>.json` and `vic-vlgc-abs-<year>.json`.

### 13.3 Licence / attribution (not CC BY)

Every historical workbook carries the same VLGGC Conditions of Use (verbatim): _“Content from this
spreadsheet should be attributed as Victorian Local Government Grants Commission data collection.”_
The disclaimer adds that councils _“provide permission for this online release”_ and the Commission
_“does not guarantee the material to be free from error.”_ This is **attribution + permission, not
a CC licence**. Only derived rows are emitted and no workbook is redistributed. The source metadata
records the terms verbatim.

### 13.4 Totals suppression, per-year keys and no-sum

- Every year's `Total Exp`, `Total Rev`, all nine `E-*` tabs, `Total Outlays`, `O-Total`,
  `Balance Sheets` and `Sources & Applications` Totals row is **suppressed** (11 VGC1 + 4 ABS per
  year). No emitted row has a `Totals` entity and no cross-council total is published or computed.
- Every natural key includes the **fiscal year**, plus the council, section/measure, function/nature
  or statement/line code, sheet and column. The same council/line in two years therefore never
  collides; the 5,401 + 9,059 2024-25 rows keep their own keys unchanged.
- Each year has exactly **79 reporting entities**. Across the whole series there are **80 display
  names** because the 2019-20 and 2020-21 workbooks print the pre-rename `Moreland (C)` label
  (`Moreland City Council`) while 2021-22 onward print `Merri-bek (C)` (`Merri-bek City Council`).
  The printed label is retained verbatim in `vlgc_council_label`; this is the documented 26 September
  2022 rename, not an extra council, and no rows are merged or renamed across years.
- Every row keeps `aggregation_role: agency_detail`, `data_quality_flag:
provisional/local_government`, `verified: false`, `jurisdiction_level: local`, `jurisdiction:
VIC` and the source id of its pilot. Functions, natures, asset classes, balance-sheet lines,
  cash-flow lines and income-statement lines remain separate non-additive cuts; nothing is summed
  across councils, functions, sections or years. No row is mixed with `vic-budget`, ABS GFS,
  LGPRF, waste or NSW council data.
- Whole AUD is converted explicitly to integer cents at ×100; the unit is never inferred from
  magnitude.

### 13.5 Reconciliation

Each year has two independent gates:

1. **Source Totals row (internal, not published).** The sum of the 79 council grand totals must
   equal the workbook's printed Totals row within one cent (floating-point rounding). All five
   years pass (±1 cent). For ABS, the sum of council total capital outlays and total assets must
   equal the `Total Outlays` / `Balance Sheets` Totals rows; all five years pass (±1 cent).
2. **Bendigo audited GPFS (FY2023-24).** City of Greater Bendigo FY2023-24 VGC1 totals are
   `$240,485,023.18` expenditure and `$245,114,475.92` revenue, against the audited GPFS
   (`$240,484k` / `$245,112k`): deltas `$1,023.18` (0.0004%) and `$2,475.92` (0.001%). Because both
   deltas exceed the ±`$500` that `$'000` GPFS rounding can explain, the two Bendigo total rows carry
   `reconciliation_status: bridged_to_gpfs` plus `human_spot_check: required`; the notes name both
   exact deltas and state that the whole-AUD VGC questionnaire vs GPFS `$'000` rounding does not
   fully explain them. The deltas are recorded in the manifest and are **never forced to zero**.
   Every other historical row remains `questionnaire_unaudited`. Only the FY2024-25 pilot A/B
   Bendigo totals, whose `$0.04`/`$0.17` residuals are fully explained by the printed rounding,
   keep `reconciled_to_gpfs`.

No cross-council, state-plus-local or cross-year total is created.

### 13.6 Reproduce and checks

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
export VIC_HISTORY_ARCHIVE_ROOT=~/ausspend-source-archive
npm run ingest:vic-vlgc-history
# years 2019-20..2023-24; idempotent upsert on natural_key; no deletes
# [ingest:vic-vlgc-history] vic-vlgc-vgc1: success fetched=27099 upserted=27099
# [ingest:vic-vlgc-history] vic-vlgc-abs: success fetched=44548 upserted=44548
# [ingest:vic-vlgc-history] db source_rows vgc1=32499 abs=53607 totals_entities=0 all_measures=602062
```

`VIC_HISTORY_YEARS` may narrow the run; `VIC_HISTORY_DIR` may point at already-downloaded
`<year>-VGC1.xlsx` / `<year>-ABS1.xlsx` / `<year>-ABS23.xlsx` files for an offline re-run.

Checks: `npm run typecheck`, `npm run lint`, `npm test` (including
`server/test/vic-vlgc-history.test.ts`: five verified years, deferred years, licence metadata,
79-council parsing, 11-Totals suppression, fiscal-year natural keys, idempotency, non-additive
flags and ABS year scoping), `npm run build`, mocked `npm run test:e2e` and live `npm run audit` on
alternate ports. Do not run these against 3001/5173 or the production nginx.

## 14. Pilot D implementation record (18 November 2026)

**Scope delivered:** the remaining VLGGC historical years **FY2015-16 to FY2018-19** for all 79
councils, under the existing source ids `vic-vlgc-vgc1` and `vic-vlgc-abs`. No new source family,
no re-ingest of FY2019-20..FY2024-25, no NSW/OLG rows, no council PDFs.

### 14.1 Years landed and deferred

| Fiscal year | Status |  VGC1 rows |   ABS rows | ABS2 layout    |
| ----------- | ------ | ---------: | ---------: | -------------- |
| 2015-16     | landed |      5,420 |      8,896 | legacy 144-col |
| 2016-17     | landed |      5,438 |      8,851 | legacy 144-col |
| 2017-18     | landed |      5,427 |      8,835 | legacy 144-col |
| 2018-19     | landed |      5,430 |      8,727 | legacy 144-col |
| **Total**   |        | **21,715** | **35,309** |                |

**No year is deferred.** Each year has exactly 79 reporting entities. The older generation maps
explicitly rather than by assumption:

- VGC1 `Total Exp`/`Total Rev` and the `E-*` function tabs use the same first-block
  `<function> Total` nature mapping as pilot C, but print `Family & Community Service` (singular)
  in the total-sheet header; the header matcher accepts the singular/plural stem.
- The ABS2 `Balance Sheets` sheet has **144 columns, not 148**: FY2015-16..FY2018-19 have no
  lease-liability line, so Total Liabilities is column 52 (not 53), Total Equity column 55 (not 56),
  and the cash-flow/revenue/expense sections each shift left and have fewer printed lines. The
  connector selects `ABS23_LAYOUT_LEGACY_2015_18` explicitly; it never assumes the 2024-25 columns.
- Some older ABS2 workbooks print a literal `0` total equity for a handful of councils while Total
  Liabilities & Equity still balances to liabilities. Zero cells are not emitted, matching pilot B;
  the source value is preserved as absent, never back-filled or guessed.

### 14.2 Workbooks, snapshots and hashes

| Year    | Workbook | Wayback snapshot | SHA-256                           |   Bytes |
| ------- | -------- | ---------------- | --------------------------------- | ------: |
| 2015-16 | VGC1     | 20220309020324   | `e30382d5…3015d2fb75ea69`         | 825,660 |
| 2015-16 | ABS1     | 20220309020400   | `debdb84b…067a76a80aa5f812`       | 484,933 |
| 2015-16 | ABS2-3   | 20220309020410   | `ac3bbe97…5cf213a0655c7fc`        | 141,538 |
| 2016-17 | VGC1     | 20190312124827   | `08d9f99e…f09fd24fb6e91a27`       | 830,482 |
| 2016-17 | ABS1     | 20190312124932   | `7bc0e80c…f41f6a665602cb82`       | 478,883 |
| 2016-17 | ABS2-3   | 20190312124950   | `677bf810…49d04150d9dc896`        | 142,695 |
| 2017-18 | VGC1     | 20200229134217   | `e977cbb5…679671ce0ff14af`        | 844,966 |
| 2017-18 | ABS1     | 20200229134242   | `84e35f02…9d85427727bae8b8`       | 485,627 |
| 2017-18 | ABS2     | 20200229134258   | `62b97da8…aeeaf37c39c04d`         | 144,124 |
| 2018-19 | VGC1     | 20210314151936   | `b209ecd1…9208be18d27b737c`       | 847,695 |
| 2018-19 | ABS1     | 20210314152012   | `c8e6ccfb…9a74d846662143b66c`     | 482,725 |
| 2018-19 | ABS2     | 20210314152032   | `2f59ab63…5ab344cdb7bcb69df4cdfa` | 143,220 |

Per-year metadata-only manifests: `docs/source-archive/vic-vlgc-{vgc1,abs}-<year>.json`.
Licence is the same VLGGC **attribution/permission, NOT CC BY**; derived rows only, workbooks not
redistributed.

### 14.3 Totals, keys and reconciliation

- Every year suppresses all 11 VGC1 + 4 ABS Totals rows; DB `Totals` entities = 0.
- Natural keys include the fiscal year; the full 10-year VGC1/ABS set has **0 duplicate
  natural keys** and every row carries `aggregation_role: agency_detail`,
  `data_quality_flag: provisional/local_government`, `verified: false`.
- Each year reconciles to its workbook printed Totals row within 1 cent (VGC1 expense/revenue and
  ABS capital outlays/total assets); all four older years pass.
- No cross-council, cross-year or state-plus-local total is created; no row is mixed with
  `vic-budget`, ABS GFS, LGPRF, waste or NSW data.

### 14.4 DB delta and reproduce

Before pilot D: **602,062** measures. After: **659,086** (+57,024; VGC1 source 54,215, ABS source
88,916). 2024-25 and 2019-20..2023-24 rows are untouched (idempotent upsert on natural_key); no deletes.

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
export VIC_HISTORY_YEARS=2015-16,2016-17,2017-18,2018-19
export VIC_HISTORY_DIR=/path/with/<year>-VGC1.xlsx-ABS1.xlsx-ABS23.xlsx
npm run ingest:vic-vlgc-history
# [ingest:vic-vlgc-history] vic-vlgc-vgc1: success fetched=21715 upserted=21715
# [ingest:vic-vlgc-history] vic-vlgc-abs: success fetched=35309 upserted=35309
# [ingest:vic-vlgc-history] db source_rows vgc1=54215 abs=88916 totals_entities=0 all_measures=659086
```

Checks: `npm run typecheck`, `npm run lint`, `npm test` (including
`server/test/vic-vlgc-history.test.ts`: 9-year register, empty deferred list, singular VGC1 header,
144-column legacy ABS2 layout, fiscal-year keys, idempotency, Totals suppression, licence metadata),
`npm run build`, mocked `npm run test:e2e` and live `npm run audit` on alternate ports. Do not run
against 3001/5173 or production nginx.

## 15. Pilot C label cure (18 November 2026)

**Scope:** label/disclosure only for the FY2023-24 Bendigo VGC1 grand totals. No amounts, row
counts, natural keys or other years change.

- The two rows (`total_expenditure` `$240,485,023.18`, `total_revenue` `$245,114,475.92`) move from
  `reconciliation_status: reconciled_to_gpfs` to `bridged_to_gpfs`, with
  `human_spot_check: required` and notes naming the exactly `$1,023.18` and `$2,475.92` deltas
  against the GPFS (`$240,484k` / `$245,112k`). The notes state that whole-AUD VGC vs GPFS `$'000`
  rounding does not fully explain the residuals; equality is never forced.
- The exact FY2024-25 pilot A/B Bendigo totals keep `reconciled_to_gpfs`; every other historical
  row stays `questionnaire_unaudited`.
- Re-running `npm run ingest:vic-vlgc-history` is idempotent on `natural_key`: history rows stay
  **27,099 VGC1 + 44,548 ABS = 71,647** for FY2019-20..FY2023-24, and **48,814 + 79,857 = 128,671**
  across all nine historical years (FY2015-16..FY2023-24). The DB is unchanged at **659,086**
  measures (VGC1 source 54,215 + ABS source 88,916, including the untouched 2024-25 pilot rows).
  Amounts are byte-identical; only the two rows' status/notes text changes.

Checks: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (including the
`buildBendigoHistoryReconciliation` cases in `server/test/vic-vlgc-history.test.ts`) and
`npm run build`.

## 16. VIC FAG grants overlay implementation record (18 November 2026)

**Scope delivered:** source `vic-vlgc-fag`, all 79 Victorian councils for **FY2024-25** and
**FY2023-24** — **79 + 79 = 158 rows**. No NSW rows, no OLG data, no new GPFS, no re-ingest of
VGC1/ABS, no cross-council total. The FAG is **Commonwealth grant income administered by the
VLGGC**, not council spending.

### 16.1 Official reports, snapshots and hashes

The live VLGGC asset URLs return a Cloudflare challenge (HTTP 403); the exact PDF bytes were
retrieved from the documented Wayback snapshots and SHA-256 verified before parsing. Bytes live
outside the repo under `~/ausspend-source-archive/vic-vlgc-fag/` and are never redistributed.
Metadata-only manifests are committed under `docs/source-archive/`.

| Fiscal year | Report                                                  | Official URL                                                           | Wayback snapshot | SHA-256                                                            |     Bytes |
| ----------- | ------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------ | --------: |
| 2024-25     | VLGGC Annual Allocation Report 2024-25 (September 2024) | `.../0019/210727/2024-25-VLGGC-Annual-Allocation-Report-Sept-2024.pdf` | `20241020190403` | `9efcc61d5105cdae5353a536759e36470c44af6417fc9c3af4c2990473571788` | 1,628,398 |
| 2023-24     | VLGGC Annual Allocation Report 2023-24 (September 2023) | `.../0023/202496/2023-24-VLGGC-ALLOCATION-REPORT-Sept-2023.pdf`        | `20231022163029` | `c2a23f7d0e77ae44d3ebb9f2710af612b4df8bb27e3c963b171f4cc8b7968604` | 1,605,938 |

Manifests: `vic-vlgc-fag-2024-25.json` (FY2024-25 estimated rows),
`vic-vlgc-fag-2023-24-final.json` (FY2023-24 final rows, printed in the 2024-25 report Appendix 1)
and `vic-vlgc-fag-2023-24.json` (the September 2023 estimated table, parsed for the cross-check
only and **not emitted**).

### 16.2 Licence / attribution (verbatim; not a bare CC BY claim)

Both reports' copyright pages say, verbatim:

> “© Copyright State of Victoria 2024 Department of Government Services” (2024-25 report) /
> “© Copyright State of Victoria 2023 Department of Government Services” (2023-24 report)
> “Except for any logos, emblems, trademarks, artwork and photography this document is made
> available under the terms of the Creative Commons Attribution 3.0 Australia license.”

The underlying VLGGC data collection carries the separate VLGGC Conditions of Use, verbatim:
_“Content from this spreadsheet should be attributed as Victorian Local Government Grants
Commission data collection.”_ The VLGGC disclaimer adds that councils _“provide permission for
this online release”_ and the Commission _“does not guarantee the material to be free from
error.”_

So the brief's **“VLGGC attribution/permission, NOT CC BY”** is correct for the VLGGC data
collection. The report PDF itself additionally carries a **CC BY 3.0 Australia** statement for
non-logo content (not CC BY 4.0). Both statements are recorded verbatim in the manifests and row
notes; the connector does not claim only CC BY, does not redistribute the PDFs, and emits derived
rows only. Attribution: Victorian Local Government Grants Commission Annual Allocation Report —
© State of Victoria (Department of Government Services).

### 16.3 Measure, rows and values

- **FY2024-25 — estimated allocation.** Printed `Total Financial Assistance Grants` per council
  from Appendix 2A. 79 rows, `measure_type: grant_award`, `vlgc_allocation_status: estimated`.
  Sum of the 79 council rows = **$789,162,301**, exactly the printed Totals row.
- **FY2023-24 — final allocation.** Printed final `Financial Assistance Grants` per council from
  Appendix 1 of the 2024-25 report. 79 rows, `vlgc_allocation_status: final`. Sum =
  **$748,241,357**, exactly the printed Totals row.
- **FY2023-24 estimated cross-check (not emitted).** The 2023-24 report's Appendix 2A estimate
  sums to **$747,377,237**. For every one of the 79 councils, final − estimate equals the printed
  difference; the totals difference is **$864,120**. The estimate is therefore used only as a
  reconciliation gate, not as a second set of FY2023-24 rows.
- Multiple components (general purpose equalisation, natural disaster assistance, local roads,
  data project in 2024-25) are **printed but never summed by the connector**. It emits the single
  printed total per council. No invented total, no component row and no cross-council total.
- Whole AUD is converted explicitly to integer cents at ×100; the unit is never inferred from
  magnitude. Council labels are expanded deterministically to the exact directory names (for
  example `Queenscliffe B` → `Borough of Queenscliffe`; `Ararat RC` → `Ararat Rural City
Council`). No project name and no LGA/location allocation is set.

Examples (whole dollars):

| Council                      | 2024-25 estimated total | 2023-24 final total | 2023-24 estimate | Final − estimate |
| ---------------------------- | ----------------------: | ------------------: | ---------------: | ---------------: |
| Alpine Shire Council         |               4,809,149 |           4,689,035 |        4,683,325 |            5,710 |
| Greater Bendigo City Council |              22,326,169 |          21,324,233 |       21,303,083 |           21,150 |
| Borough of Queenscliffe      |                 561,612 |             443,133 |          442,743 |              390 |

### 16.4 Totals suppression, keys and no-sum

- Every year's printed Totals row is read for reconciliation and **suppressed** (3 in total: the
  2024-25 estimate, the 2023-24 final and the 2023-24 estimate cross-check). DB
  `delivery_entity` matching `Totals` = **0**.
- Natural keys include the source id, fiscal year, exact council name, measure, allocation status
  and report snapshot. All **158** keys are unique; re-running upserts on `natural_key` with no
  deletes.
- Every row is `aggregation_role: agency_detail`, `data_quality_flag:
provisional/local_government`, `verified: false`, `jurisdiction_level: local`, `jurisdiction:
VIC` and `funding_source: Victorian Local Government Grants Commission`.
- Every row carries **`potential_double_count: true`**: the FAG is a component of council grant
  revenue and overlaps VGC1 grant revenue and ABS grant lines. The rows are never added to
  VGC1/ABS spending, never added to another grant source and never summed across councils. The
  overlap is disclosed in `notes`, not resolved by addition.

### 16.5 Reconciliation

1. **Within each year:** the 79 council rows sum exactly to the printed Totals row (±$0) —
   `$789,162,301` for 2024-25 and `$748,241,357` for 2023-24 final.
2. **Across the two FY2023-24 statements:** final − September-2023 estimate equals the printed
   per-council difference for all 79 councils and sums to the published `$864,120`.
3. **No cross-council, state-plus-local or cross-year total is created or published.**

### 16.6 DB delta and reproduce

Before: **659,086** measures. After: **659,244** (+158; `vic-vlgc-fag` = 158; 79 distinct councils
per year; Totals entities 0). VGC1 = 54,215 and ABS = 88,916 are untouched; no deletes.

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
export VIC_FAG_ARCHIVE_ROOT=~/ausspend-source-archive
export VIC_FAG_2024_25_PATH=~/ausspend-source-archive/vic-vlgc-fag/2024-25-VLGGC-Annual-Allocation-Report-Sept-2024.pdf
export VIC_FAG_2023_24_PATH=~/ausspend-source-archive/vic-vlgc-fag/2023-24-VLGGC-ALLOCATION-REPORT-Sept-2023.pdf
npm run ingest:vic-vlgc-fag
# [ingest:vic-vlgc-fag] vic-vlgc-fag: success fetched=158 upserted=158
# [ingest:vic-vlgc-fag] db source_rows=158 distinct_councils=79 totals_entities=0 all_measures=659244
# [ingest:vic-vlgc-fag] by_year=2023-24=79,2024-25=79
```

Checks run: `npm run typecheck`, `npm run lint`, `npm run format:check` (changed files pass;
repo-wide check still lists five pre-existing unrelated files), `npm test` (75 files, 832 passed,
2 skipped; includes `server/test/vic-vlgc-fag.test.ts`: 79 rows/year, Totals excluded, natural
keys, idempotency, no-sum, overlap semantics and licence metadata), `npm run build`, mocked
`npm run test:e2e` on alternate ports `3103/5176` (51 passed) and live `npm run audit` on
`3104/5177` (38/38 checks passed). Ports 3001/5173 and the production nginx were not touched.

## 17. VIC council performance layer — LGPRF 2020-25 (18 November 2026)

**Scope delivered:** source `vic-lgprf`, the official Local Government Performance Reporting
Framework full data set for **FY2020-21..FY2024-25**, all **79 councils** in every year,
**58 indicators** in 2020-21..2022-23 and **59** in 2023-24..2024-25. This is a performance
layer only: no council spending, no GPFS lines and no new financial source family. No NSW,
OLG, ABS GFS, VGC1/ABS or waste rows were touched.

### 17.1 Source, archive and licence

- Official LGPRF page:
  <https://www.localgovernment.vic.gov.au/strengthening-councils/performance-reporting>
- DataVic package:
  <https://discover.data.vic.gov.au/dataset/local-government-performance-reporting>
  (`license_id: cc-by`; **CC BY 4.0**)
- Resource:
  <https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0019/191008/LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx>
- Live asset returned HTTP 403 to automated clients. The exact bytes were retrieved from the
  documented Wayback snapshot `20251118075622`:
  <https://web.archive.org/web/20251118075622id_/https://www.localgovernment.vic.gov.au/__data/assets/excel_doc/0019/191008/LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx>
- Archived outside the repo at
  `~/ausspend-source-archive/vic-lgprf/LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx`
  — **3,241,185 bytes, SHA-256
  `d88f7ede3a154f1beb6359850dc25a68159d08e23478fec8f138d67d1b787376`** (matches the documented
  hash exactly). Metadata-only manifest:
  [`docs/source-archive/vic-lgprf-2020-25.json`](./source-archive/vic-lgprf-2020-25.json).
- The workbook is not redistributed; only derived indicator rows are emitted. The source's own
  disclaimer is recorded verbatim: the data set must not be used to aid the publication of
  “overly simplistic league tables of councils”.

### 17.2 Rows, indicators and non-additive semantics

| Fiscal year | Councils | Indicators |       Rows | Blank Results | `No data` rows |
| ----------- | -------: | ---------: | ---------: | ------------: | -------------: |
| 2020-21     |       79 |         58 |      4,582 |            43 |             43 |
| 2021-22     |       79 |         58 |      4,582 |            99 |             99 |
| 2022-23     |       79 |         58 |      4,582 |             0 |             43 |
| 2023-24     |       79 |         59 |      4,661 |             0 |             43 |
| 2024-25     |       79 |         59 |      4,661 |             0 |             38 |
| **Total**   |          |            | **23,068** |       **142** |        **266** |

- One row per **council × fiscal year × indicator**, natural key
  `vic-lgprf:<sha256(fiscal_year|council|indicator)>`; re-running upserts on `natural_key` with no
  deletes.
- The two indicator generations differ explicitly rather than by assumption: 2020-21..2022-23
  include `LB1` (physical library collection usage), `LB4` (active library borrowers) and `WC1`
  (kerbside bin collection requests); 2023-24..2024-25 replace them with `FS5` (food safety
  samples), `LB6` (loans per head), `LB7` (library membership) and `LB8` (library visits per head).
  **62 distinct indicator codes** appear across the five years.
- Every row is `source_id: vic-lgprf`, `measure_type: actual`, `jurisdiction_level: local`,
  `jurisdiction: VIC`, `aggregation_role: agency_detail`, `performance_non_additive: true`,
  `verified: false`. `amount_cents` is **0** on every performance row; the published result is
  stored in `performance_value`. No row is ever summed or averaged across councils, indicators or
  years, and no ratio/per-head result is converted to a dollar total.
- Blanks are preserved as an absent `performance_value` (142 rows), never zero-filled. Where the
  source prints a literal `0` together with `Data applicable? = No data`, the 0 is kept and the
  no-data flag is retained; it is not treated as a measured zero.
- Council labels are expanded to the platform's VIC names (for example `Borough of Queenscliffe`,
  `Greater Shepparton City Council`, `Colac Otway Shire Council`). Each year has 79 councils; the
  union across years is **80 names** because 2020-21 prints `Moreland City` and later years print
  `Merri-bek City` (the documented rename, not an extra council).
- There is no Totals row in this data set, and no Totals entity is emitted.

### 17.3 Units

The full data set has no unit column, so the unit is defined per indicator from the published
`Description` and the official LGV Performance Reporting Indicator Guide 2025-26, and stored in
`performance_unit`. Examples: `AUD per person` (`C1`), `AUD per visit` (`AF7`), `AUD per square
metre` (`R3`), `days` (`AM1`, `SP1`), `score out of 100` (`G2`, `R5`), `ratio` (`L1`, `OP1`),
`visits per person` (`AF6`), `bins per 10,000 scheduled bin lifts` (`WC2`). Percentage indicators
whose published result is a 0-1 fraction are labelled `percentage (0-1 fraction)`; values are
never silently multiplied by 100 and never converted to dollars.

### 17.4 DB delta and reproduce

Before: **659,244** measures. After: **682,312** (+23,068, all `vic-lgprf`; 79 distinct councils
per year, 80 distinct names across years, Totals entities 0, non-additive/amount-cent violations
0). The second run is idempotent: it upserts the same 23,068 natural keys and leaves the DB at
**682,312**. No other source's rows were changed or deleted.

```bash
export MONGO_URL=mongodb://localhost:27017/ausspend_dev
export LGPRF_ARCHIVE_ROOT=~/ausspend-source-archive
export LGPRF_SOURCE_PATH=/path/to/LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx
npm run ingest:vic-lgprf
# [ingest:vic-lgprf] vic-lgprf: success fetched=23068 upserted=23068
# [ingest:vic-lgprf] db source_rows=23068 distinct_councils=80 totals_entities=0 non_additive_violations=0 all_measures=682312
# [ingest:vic-lgprf] by_year=2020-21=4582/58ind,2021-22=4582/58ind,2022-23=4582/58ind,2023-24=4661/59ind,2024-25=4661/59ind
```

**Checks run on 18 November 2026:** `npm run typecheck`, `npm run lint`, changed files pass
Prettier, `npm test` (76 files, 843 passed, 2 skipped; includes
`server/test/vic-lgprf.test.ts`: 79 councils/year, 58/59 indicators, 23,068 rows, unit
preservation, blank/no-data handling, natural keys, idempotency, no-sum semantics, licence
metadata and a SHA-verified real-archive parse), `npm run build`, alt-port e2e (51 passed on
`3107/5178`) and live `npm run audit` on `3107/5178` (38/38 checks passed). Ports 3001/5173 and
the production nginx were not touched.
