# Walgett Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `walgett-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: landed — 19 statement rows from the official standalone audited financial statements for
the year ended 30 June 2025.** The premise falsifier for this item is an official current audited
GPFS/FS reachable through the browser path. It is: the client-rendered annual-reports page's
published CMS snapshot lists `Audited-Financial-Statements-2024-25.pdf`, and headless Chromium
renders the same link and fetches the exact PDF bytes. The earlier "no fetchable document links"
observation was true only of the static HTML shell.

## 0. Stale-year check

The work item was opened on 2026-11-19. On 2026-11-20 the published CMS snapshot
(`/snapshot.json`, snapshot timestamp `2026-11-18T05:26:11.642Z`) lists on
`/council/council-publications/annual-reports`:

- **Annual Report 2024–25** (narrative, 13 MB) and older narrative annual reports;
- **Audited-Financial-Statements-2024-25.pdf** (2.9 MB) and older standalone financial statements;
- the Audit, Risk and Improvement Committee Annual Report **2025-2026**.

The 17 November 2026 council meeting endorsed the **2025/26 Annual Report** "for publication" and
to be provided to the Office of Local Government; no FY2025-26 standalone audited financial
statements PDF was published as at 2026-11-20. FY2024-25 is therefore the latest published audited
standalone FS and is ingested as such; the FY2024-25 narrative annual report is not substituted and
no older year is used.

## 1. Source and year

- Publisher: **Walgett Shire Council**.
- Document: **Audited Financial Statements for the year ended 30 June 2025** — FY2024-25,
  **109 physical pages** (86 numbered GPFS pages plus cover/blank pages), **3,001,912 bytes**.
  It contains the Statement by Councillors and Management, the five primary statements, notes,
  and the independent Auditor-General's report.
- Official page:
  <https://www.walgett.nsw.gov.au/council/council-publications/annual-reports>.
- Exact audited PDF:
  <https://www.walgett.nsw.gov.au/assets/files/e14f90d207d06a69-1776849622581_6c2e2885.pdf>.
  The same URL is the documented official fallback pin.

The auditor's opinion (PDF page 78) is unmodified and dated **30 October 2025**; the Report on the
Conduct of the Audit (PDF page 81) states: _"I expressed an unmodified opinion on the Council's
GPFS."_

## 2. Access, discovery and fetch

The annual-reports page returns a **10,141-byte** React shell with only `/assets/index-*.js` and no
document links. The SPA loads a same-origin published CMS snapshot at
`https://www.walgett.nsw.gov.au/snapshot.json` (**2,957,665 bytes**, `application/json`,
`200`). The snapshot's page object for the annual-reports path contains a `file-list` block whose
first financial-statements entry is the audited FY2024-25 PDF.

| Client | Annual-reports shell | CMS snapshot | Audited PDF |
| --- | --- | --- | --- |
| `curl -sSL` (curl/8.5.0 UA) | HTTP 200, `text/html`, 10,141 bytes | HTTP 200, `application/json`, 2,957,665 bytes | HTTP 200, `application/pdf`, 3,001,912 bytes |
| `curl -sSL` (Chrome 131 UA) | HTTP 200, `text/html`, 10,141 bytes | HTTP 200, `application/json`, 2,957,665 bytes | HTTP 200, `application/pdf`, 3,001,912 bytes |
| Headless Chromium (Playwright 1.65.1) | HTTP 200 after `networkidle` | observed `/snapshot.json` `200` | browser `fetch` `200`, `application/pdf`, 3,001,912 bytes |

The live headless run observed the SPA's `/snapshot.json` request, rendered **14** PDF anchors,
selected only `Audited-Financial-Statements-2024-25.pdf`, and fetched the same 3,001,912 bytes and
SHA-256 as the plain fetch. `scripts/walgett-gpfs-browser.ts` reproduces this path; no mirror or
invented URL is used.

## 3. Archive (outside the repo)

The exact PDF is archived outside the repository by `archiveSourceDocument` and re-verified by
`verifySourceDocument` before parsing:

- bytes: **3,001,912**
- pages: **109**
- SHA-256: **`26f02f8523fe3742aa84f0998e43241b398d13f3fd158920380c77907baa9de4`**
- `hash_verified: true`

The PDF is not committed to the repository.

## 4. Printed unit and extraction

The printed unit is **`$ '000`** on every primary statement and B1-1. The connector rejects a
missing or conflicting unit and refuses to guess. The Income Statement columns are the original
unaudited budget, **Actual 2025** and Actual 2024; the budget column is never ingested.

The face Income Statement does not print a "Total expenses" line. Total expenses is the documented
bridge of the printed "Total expenses ... excluding depreciation, amortisation and impairment"
line (**38,231**) plus the printed depreciation/amortisation/impairment line (**8,811**) =
**47,042**, which equals the printed B1-1 expense total.

The face statement prints both a **net gain from the disposal of assets** (56, a revenue component)
and a **net loss from the disposal of assets** (nil in 2025, an expense component), plus a
**net share of interests in joint ventures and associates using the equity method** (60, an expense
component). These are emitted as printed, including the printed nil loss line.

## 5. Reconciliation (all zero tolerance)

| Check | Printed values ($'000) |
| --- | --- |
| Revenue components = total income | 11,129 + 2,472 + 955 + 14,340 + 6,414 + 2,070 + 229 + 56 = **37,665** |
| Expense components = printed expenses excluding depreciation | 11,607 + 24,475 + 127 + 1,962 + 0 + 60 = **38,231** |
| Expenses excluding depreciation + depreciation/amortisation/impairment = total expenses bridge | 38,231 + 8,811 = **47,042** |
| Total income − total expenses = net result | 37,665 − 47,042 = **(9,377)** |
| Net result − capital grants = before-capital result | (9,377) − 6,414 = **(15,791)** |
| B1-1 income / expenses / result / grants / carrying amount | **37,665 / 47,042 / (9,377) / 20,754 / 501,502** |
| Comprehensive income | net result (9,377) + IPPE revaluation 28,220 = **18,843** |
| Balance sheet | assets 501,502 − liabilities 14,856 = net assets **486,646**; accumulated surplus 139,322 + IPPE revaluation 347,324 = total equity **486,646** |
| Cash flows | operating (7,474) + investing (6,425) + financing (143) = net change **(14,042)**; opening cash 19,393 + net change (14,042) = closing cash **5,351** |

The B1-1 "Total functions and activities" row is the documented total-expense bridge; the face
Income Statement does not print a separate "Total expenses" line. All 14 reconciliation checks pass
exactly.

## 6. Ingested rows

`walgett-gpfs` emits **19** non-additive `agency_detail` rows: 8 revenue components + total revenue
(9), 6 expense components + expenses-excluding-depreciation + depreciation + total-expenses bridge
(9), and net result (1). All rows are `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Walgett Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The net result is negative, so the
printed-sign marker `gpfs_printed_sign: "negative"` is stored. No council total, no cross-council
row, no state/federal addition.

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` |
| --- | --- | ---: | ---: |
| `rates_and_annual_charges` | Rates and annual charges | 11,129 | 1,112,900,000 |
| `user_charges_and_fees` | User charges and fees | 2,472 | 247,200,000 |
| `other_revenues` | Other revenues | 955 | 95,500,000 |
| `government_grants_operating` | Grants and contributions — operating | 14,340 | 1,434,000,000 |
| `government_grants_capital` | Grants and contributions — capital | 6,414 | 641,400,000 |
| `interest_and_investment_income` | Interest and investment income | 2,070 | 207,000,000 |
| `other_income` | Other income | 229 | 22,900,000 |
| `net_gain_from_disposal_of_assets` | Net gain from the disposal of assets | 56 | 5,600,000 |
| `total_revenue` | Total income from continuing operations | 37,665 | 3,766,500,000 |
| `employee_expenses` | Employee benefits and on-costs | 11,607 | 1,160,700,000 |
| `materials_and_services` | Materials and services | 24,475 | 2,447,500,000 |
| `borrowing_costs` | Borrowing costs | 127 | 12,700,000 |
| `other_expenses` | Other expenses | 1,962 | 196,200,000 |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets (nil in 2025) | 0 | 0 |
| `net_share_joint_ventures` | Net share of joint ventures/associates (equity method) | 60 | 6,000,000 |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 38,231 | 3,823,100,000 |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 8,811 | 881,100,000 |
| `total_expenses` | Total expenses (documented bridge) | 47,042 | 4,704,200,000 |
| `net_result` | Net operating result attributable to Council | (9,377) | 937,700,000 |

## 7. No-total / no-cross-council rule

- Walgett Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 8. Database ingest proof (2026-11-20, isolated scratch DB)

Targeted ingest of **only `walgett-gpfs`** against an isolated scratch database:

- total measures **2 → 21** (exactly **+19**, preserving the two pre-existing non-Walgett rows);
- `walgett-gpfs` measures **0 → 19**;
- a second targeted run leaves **19** Walgett rows and total **21** unchanged (idempotent);
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Walgett Shire Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate row;
- `data_sources` records the source `active` with `records_ingested: 19`.

The exact PDF is archived outside the repo at the relative path
`walgett-gpfs/e14f90d207d06a69-1776849622581_6c2e2885.pdf` with the SHA-256 above; no PDF is
committed.

## 9. How to verify

```bash
# Official shell, CMS snapshot and exact FY2024-25 audited PDF (all 200 on 2026-11-20).
curl -sL -o /dev/null -w '%{http_code} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.walgett.nsw.gov.au/council/council-publications/annual-reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.walgett.nsw.gov.au/snapshot.json'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.walgett.nsw.gov.au/assets/files/e14f90d207d06a69-1776849622581_6c2e2885.pdf'

# Live headless Chromium DOM/network discovery + exact-byte fetch.
npx tsx scripts/walgett-gpfs-browser.ts

# Focused connector tests (20, including the live-fetch mock and ingest idempotency).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_walgettgpfs" \
  npx vitest run --project server server/test/walgett-gpfs.test.ts
```

The focused suite covers the static-shell→snapshot→browser discovery path, annual-report and
stale-year rejection, the exact pin/SHA-256, the unit gate, conflicting-unit rejection, a
broken-subtotal rejection, the documented total-expense bridge, all face/B1-1/balance-sheet/
comprehensive-income/equity/cash-flow checks, natural-key stability, the golden digest and
additive-only idempotent 19-row ingestion.
