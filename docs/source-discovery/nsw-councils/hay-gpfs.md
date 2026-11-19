# Hay Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `hay-gpfs` (NSW local government). One council only; entity-level rows, no council
aggregate and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the official standalone audited Annual Financial Statements
for the year ended 30 June 2026.** The cheap check ("annual-report-only; dedicated financial statements
page renders no documents") is **falsified**: the official combined **Council Meetings and Reports**
feed publishes a standalone **"Hay Shire Council ANNUAL FINANCIAL STATEMENTS for the year ended 30 June
2026"** PDF, and that GPFS reconciles exactly. The dedicated *Council Plans and Reports* page is not
where the FS live; the combined meetings/reports feed is.

## 0. Stale-year check

Checked on **2026-11-20**. The latest GPFS in the feed is FY2025-26 (year ended 30 June 2026,
signed by the Mayor, General Manager and Responsible Accounting Officer on **27 October 2026**). The
prior year's FS is also present:

- FY2025-26: "Hay Shire Council ANNUAL FINANCIAL STATEMENTS for the year ended 30 June 2026" —
  `/Portals/0/Files/Annual_Financial_Statements-2026.pdf` — **current, ingested**.
- FY2024-25: "HSC Annual Financial Statements 2025" —
  `/Portals/0/CouncilReports/HSC Annual Financial Statements 2025.pdf` — prior year, **not ingested**.
- FY2023-24: "Annual Report 2023-2024 including financials" — narrative annual report, **not
  ingested**.

A stale `/Portals/0/Annual Financial Statements 2025.pdf` link on the same feed returns **HTTP 404**
and is not used. No FY2026-27 FS was published as at 2026-11-20, so FY2025-26 is the current
published GPFS and is ingested. A later-year link that 404s or is JS-only is recorded as a gap, not a
reason to fabricate a document.

### Audit-report caveat

The FY2025-26 GPFS PDF carries **placeholder** pages for the two section 417 independent auditor
reports (printed pages 58–59: "Please uplift Council's Audit Report PDF (opinion) for inclusion in the
GPFS report"). The signed Auditor-General opinion is **not embedded** in this PDF. The prior
FY2024-25 HSC Annual Financial Statements PDF in the same feed **does** embed the signed opinion
(dated 29 October 2025), which confirms the council publishes its signed audit reports with the FS.
The FY2025-26 primary statements ingested here are the current official GPFS; the missing embedded
opinion is recorded as the one access gap, not as a reason to substitute the older year.

## 1. Source and year

- Publisher: **Hay Shire Council**.
- Document: **Annual Financial Statements for the year ended 30 June 2026** — FY2025-26. The PDF is
  **1,345,435 bytes**, **80 physical pages**, and contains the GPFS (Income Statement p5, Statement
  of Comprehensive Income p6, Statement of Financial Position p7, Statement of Changes in Equity p8,
  Statement of Cash Flows p9, B1-1 functions p14 of the PDF), the notes, the special purpose
  financial statements and the special schedules, with the audit-report placeholder pages.
- Reporting page (discovery): <https://www.hay.nsw.gov.au/Inside-Hay-Shire-Council/Council-Meetings-and-Reports>.
- Exact GPFS PDF:
  <https://www.hay.nsw.gov.au/Portals/0/Files/Annual_Financial_Statements-2026.pdf>.
  The same URL is the documented official fallback pin.

## 2. Access, discovery and fetch

On 2026-11-20 the official reporting feed and the PDF returned HTTP 200 to a plain `curl/8.5.0`
client, and headless Chromium also reached both. The site is not behind a WAF.

| Client | Reporting feed | PDF |
| --- | --- | --- |
| `curl -sSL` (`curl/8.5.0` UA) | HTTP 200, 150,836 bytes HTML | HTTP 200, `application/pdf`, 1,345,435 bytes |
| Headless Chromium (Playwright, Chrome 131 UA) | HTTP 200 | HTTP 200 (browser fetch) |

The `scripts/hay-gpfs-browser.ts` helper tries headless Chromium first and falls back to the plain
client; both discover the FS link from the official feed (never hard-coded) and the connector
SHA-256 verifies and re-archives the exact bytes. The connector also verifies the printed `$ '000`
unit and rejects a missing or conflicting unit rather than defaulting it.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path `hay-gpfs/Annual_Financial_Statements-2026.pdf`:

- URL: `https://www.hay.nsw.gov.au/Portals/0/Files/Annual_Financial_Statements-2026.pdf`
- retrieval date: 2026-11-20
- bytes: **1,345,435**
- SHA-256: `710fce7da5e69d93cc30fc943e122c8a20b28d840f9726cfb90aa926cc7a75ce`
- content type: `application/pdf`
- pages: **80**
- abstract archive path: `~/ausspend-source-archive/hay-gpfs/Annual_Financial_Statements-2026.pdf`
  (hash_verified: true)

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit is
`$ '000`; a missing or conflicting unit is rejected rather than defaulted.

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations | `24,591` | printed |
| Revenue components (rates `5,703` + user charges `1,798` + other revenue `101` + operating grants `9,803` + capital grants `6,568` + interest `518` + other income `100`) | `24,591` | = printed total |
| Expense components (employee `7,090` + materials `6,433` + borrowing `62` + other `296` + net loss on disposal `91`) | `13,972` | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`5,311`) | `13,972` + `5,311` = `19,283` | = total expenses bridge |
| Total income − total expenses | `24,591` − `19,283` = `5,308` | = printed net result |
| Net result − capital grants | `5,308` − `6,568` = `(1,260)` | = printed before-capital result (evidence only) |
| B1-1 expenses | `19,283` | = face expense bridge |
| B1-1 income (includes grants and contributions) | `24,591` | = face total income |
| B1-1 income − B1-1 expenses | `24,591` − `19,283` = `5,308` | = printed B1-1 operating result = net result |
| B1-1 grants and contributions | `16,371` | = operating `9,803` + capital `6,568` |
| B1-1 carrying amount of assets | `292,009` | = printed total assets |
| Statement of Comprehensive Income net result | `5,308` | = Income Statement net result |
| Other comprehensive income (revaluation `13,779`) | `13,779` | = printed other comprehensive income |
| Total comprehensive income attributable to Council | `5,308` + `13,779` = `19,087` | = printed total |
| Statement of Financial Position: current assets `23,757` + non-current assets `268,252` | `292,009` | = total assets |
| Current liabilities `4,273` + non-current liabilities `1,329` | `5,602` | = total liabilities |
| Total assets − total liabilities | `292,009` − `5,602` = `286,407` | = net assets |
| Accumulated surplus `91,325` + IPPE revaluation surplus `195,082`; total equity | `286,407` | = net assets = total equity |
| Statement of Changes in Equity: opening `267,320` + total comprehensive income `19,087` | `286,407` | = closing equity = SoFP total equity |
| Statement of Cash Flows: operating `9,099` + investing `(9,963)` + financing `(273)` | `(1,137)` | = net change in cash |
| Opening cash `21,521` + net change `(1,137)` | `20,384` | = closing cash = SoFP cash |
| SoFP prior-year cash column `21,521` | `21,521` | = printed cash-flow opening cash |

The printed "Net loss from the disposal of assets" (`91`) is a real expense component (not a nil
marker) and is emitted. There is no printed "Net gain from disposal" revenue line for FY2025-26. The
printed before-capital result `(1,260)` and the operating result excluding depreciation `10,619` are
retained in reconciliation evidence only, never emitted.

## 5. Extracted entity rows (17)

Source id `hay-gpfs`, `source_dataset` "Hay Shire Council GPFS 2025-26", `measure_type: "actual"`,
`fiscal_year: "2025-26"`, `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Hay Shire Council"`, `data_quality_flag: "provisional/local_government"`,
`verified: false`, `aggregation_role: "agency_detail"`.

| # | `gpfs_line_item` | Section | $'000 | AUD cents |
| --- | --- | --- | ---: | ---: |
| 1 | `rates_and_annual_charges` | revenue | 5,703 | 570,300,000 |
| 2 | `user_charges_and_fees` | revenue | 1,798 | 179,800,000 |
| 3 | `other_revenues` | revenue | 101 | 10,100,000 |
| 4 | `government_grants_operating` | revenue | 9,803 | 980,300,000 |
| 5 | `government_grants_capital` | revenue | 6,568 | 656,800,000 |
| 6 | `interest_and_investment_income` | revenue | 518 | 51,800,000 |
| 7 | `other_income` | revenue | 100 | 10,000,000 |
| 8 | `total_revenue` | revenue | 24,591 | 2,459,100,000 |
| 9 | `employee_expenses` | expenses | 7,090 | 709,000,000 |
| 10 | `materials_and_services` | expenses | 6,433 | 643,300,000 |
| 11 | `borrowing_costs` | expenses | 62 | 6,200,000 |
| 12 | `other_expenses` | expenses | 296 | 29,600,000 |
| 13 | `net_loss_from_disposal_of_assets` | expenses | 91 | 9,100,000 |
| 14 | `total_expenses_excluding_depreciation` | expenses | 13,972 | 1,397,200,000 |
| 15 | `depreciation_amortisation_impairment` | expenses | 5,311 | 531,100,000 |
| 16 | `total_expenses` | expenses | 19,283 | 1,928,300,000 |
| 17 | `net_result` | result | 5,308 | 530,800,000 |

The before-capital result, the B1-1 function split, the balance-sheet components and the cash-flow
lines are used only for the reconciliation checks and are not emitted as rows.

## 6. No-total / no-cross-council rule

- Hay Shire Council is one entity. No council aggregate, no state/national total and no sum with
  another council, a government program, the PNFC benchmark or the OLG summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- Pre-existing same-entity rows (e.g. AusTender contracts naming Hay Shire) are preserved untouched
  and never summed.

## 7. How to verify

```bash
# Exact PDF: HTTP/2 200, application/pdf, 1,345,435 bytes on 2026-11-20.
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.hay.nsw.gov.au/Portals/0/Files/Annual_Financial_Statements-2026.pdf'

# Browser helper (headless Chromium first, then plain fallback).
npx tsx scripts/hay-gpfs-browser.ts

# Focused connector tests.
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_hay" \
  npx vitest run --project server server/test/hay-gpfs.test.ts
```

The focused suite covers FS discovery/latest selection, prior-year and future-year rejection, the
narrative-report and bare-year exclusions, the browser path with its plain fallback, the printed-unit
gate, a unit-conflict rejection, a broken-subtotal rejection, the B1-1 income/grants bridge, exact
reconciliation, natural-key stability, the no-total rule, and additive-only idempotent 17-row
ingestion.
