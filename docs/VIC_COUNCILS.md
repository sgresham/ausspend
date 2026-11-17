# Victorian local councils — source inventory, double-count review and pilot plan

**Status (updated 18 November 2026):** the inventory in §§0–10 is the original research/planning
pass. **VIC council pilot A is now implemented** as source `vic-vlgc-vgc1`: 5,401 non-additive VGC1
2024-25 rows across all 79 councils (see §11). The planning pass touched docs only; pilot A is a
separate ingestion item. The database was **515,449 measures** at planning time, **515,955** on the
eve of pilot A, and **521,356** after it (exact delta +5,401). No council PDFs were queued.

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
Pilot A now adds the VLGGC VGC1 source `vic-vlgc-vgc1` (5,401 non-additive rows, 79 councils; see
§11); the LGPRF, ABS1 and ABS2-3 workbooks are still **not ingested**. Ingestion upserts on a
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
mongosh "mongodb://10.10.10.30:27017/ausspend_dev" --quiet --eval \
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
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
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
