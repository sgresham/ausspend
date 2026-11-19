# Bathurst Regional Council — General Purpose Financial Statements (FY2024-25)

Source id `bathurst-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: landed — 18 statement rows from the official standalone audited Annual Financial Statements
for the year ended 30 June 2025.** The Future Plans & Budget section's Annual Plan page publishes the
audited GPFS as its own PDF (with the independent Auditor-General's report), so there is no
annual-report-only step for this council and no older report is substituted.

## 0. Stale-year check

The work item was opened on 2026-11-19. The official **Annual Plan** page was checked on 2026-11-20
and lists the latest standalone audited financial statements first, followed by older years:

- 2024/25: "Annual Financial Report 2024-2025" — `annual-financial-statements-2024-2025.pdf`
- 2023/24: "Annual Financial Report 2023/2024" — `brc-annual-financial-statements-2023-2024.pdf`
- 2021/22: `annual_financial_statements-2022.pdf`
- 2020/21: `bathurst_regional_council_-_annual_financial_statements-2021.pdf`
- 2019/20, 2018/19, 2017/18, 2016/17, 2015/16, 2014/15 and older.

No FY2025-26 standalone audited FS was published as at 2026-11-20, so FY2024-25 is the current
published audited FS and is ingested. A later-year link that 404s or is JS-only is recorded as a gap,
not a reason to fabricate a document.

## 1. Source and year

- Publisher: **Bathurst Regional Council**.
- Document: **Annual Financial Statements for the year ended 30 June 2025** — FY2024-25. The PDF is
  **2,735,544 bytes**, **96 physical pages**, and contains the GPFS (Income Statement p6, Statement of
  Comprehensive Income p7, Statement of Financial Position p8, Statement of Changes in Equity p9,
  Statement of Cash Flows p10, B1-1 functions p15), the notes, the independent Auditor-General's report
  (p60; printed p58 of 68, opinion dated 14 November 2025) and the special purpose financial
  statements/schedules for the water, sewer and waste activities (not ingested).
- Reporting page: <https://www.bathurst.nsw.gov.au/Council/Future-Plans-Budget>.
- Discovery page (publishes the FS links):
  <https://www.bathurst.nsw.gov.au/Council/Future-Plans-Budget/Annual-Plan>.
- Exact audited PDF:
  <https://www.bathurst.nsw.gov.au/files/assets/public/v/1/council/annual-plan/annual-financial-statements-2024-2025.pdf>.
  The same URL is the documented official fallback pin.

The cheap check said only small meeting-attachment PDFs existed and there was no dedicated audited-FS
page. That is **falsified**: the Annual Plan page publishes a dedicated standalone audited financial
statements PDF (linked as "Annual Financial Report 2024-2025").

## 2. Access, discovery and fetch

On 2026-11-20 both clients returned HTTP 200 for the Annual Plan page and the PDF:

| Client | Annual Plan page | PDF |
| --- | --- | --- |
| `curl -sSL` (`curl/8.5.0` UA) | HTTP 200, 104,269 bytes HTML | HTTP 200, `application/pdf`, 2,735,544 bytes |
| Headless Chromium (Playwright, Chrome 131 UA) | HTTP 200, 134,745 bytes HTML | HTTP 200 (browser fetch) |

There is no WAF block for this council. The `scripts/bathurst-gpfs-browser.ts` helper therefore uses
the headless-Chromium path first (exercised live on 2026-11-20, returning **2,735,544** bytes) with a
plain-client fallback. Both paths discover the FS link from the official Annual Plan page (never
hard-coded) and the connector SHA-256 verifies and re-archives the exact bytes.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`bathurst-gpfs/annual-financial-statements-2024-2025.pdf`:

- URL: `https://www.bathurst.nsw.gov.au/files/assets/public/v/1/council/annual-plan/annual-financial-statements-2024-2025.pdf`
- retrieval date: 2026-11-20
- bytes: **2,735,544**
- SHA-256: `630f7efe25fecffcf48da454ec908d035ee09f1f37c855db3e26006ca890b8fc`
- content type: `application/pdf`
- pages: **96**
- abstract archive path: `~/ausspend-source-archive/bathurst-gpfs/annual-financial-statements-2024-2025.pdf`
  (hash_verified: true)

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit is
`$ '000`; a missing or conflicting unit is rejected rather than defaulted.

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations | `137,462` | printed |
| Revenue components (rates `60,216` + user charges `33,354` + other revenue `2,903` + operating grants `14,898` + capital grants `13,773` + interest `3,884` + other income `3,109` + net gain on disposal `4,857` + fair value increment `468`) | `137,462` | = printed total |
| Expense components (employee `37,477` + materials `50,224` + borrowing `1,576` + other `2,572`) | `91,849` | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`30,030`) | `91,849` + `30,030` = `121,879` | = total expenses bridge |
| Total income − total expenses | `137,462` − `121,879` = `15,583` | = printed net result |
| Net result − capital grants | `15,583` − `13,773` = `1,810` | = printed before-capital result (evidence only) |
| B1-1 expenses | `121,879` | = face expense bridge |
| B1-1 income (includes grants and contributions) | `137,462` | = face total income |
| B1-1 income − B1-1 expenses | `137,462` − `121,879` = `15,583` | = printed B1-1 operating result = net result |
| B1-1 grants and contributions | `28,671` | = operating `14,898` + capital `13,773` |
| B1-1 carrying amount of assets | `2,132,031` | = printed total assets |
| Statement of Comprehensive Income net result | `15,583` | = Income Statement net result |
| Other comprehensive income (revaluation `139,970`) | `139,970` | = printed other comprehensive income |
| Total comprehensive income attributable to Council | `15,583` + `139,970` = `155,553` | = printed total |
| Statement of Financial Position: current assets `86,461` + non-current assets `2,045,570` | `2,132,031` | = total assets |
| Current liabilities `44,215` + non-current liabilities `23,498` | `67,713` | = total liabilities |
| Total assets − total liabilities | `2,132,031` − `67,713` = `2,064,318` | = net assets |
| Accumulated surplus `741,348` + IPPE revaluation surplus `1,322,970`; Council equity interest and total equity | `2,064,318` | = net assets = total equity |
| Statement of Changes in Equity: opening `1,908,765` + total comprehensive income `155,553` | `2,064,318` | = closing equity = SoFP total equity |
| Statement of Cash Flows: operating `42,457` + investing `(37,434)` + financing `(4,848)` | `175` | = net change in cash |
| Closing cash `15,158` − net change `175`; prior-year closing column `14,983` | `14,983` | = derived opening cash = prior-year closing = SoFP prior-year cash |

The "Net loss from the disposal of assets" expense row prints as a **nil marker** in 2025 (the year had
a net gain instead), so it is not emitted as a zero row. The printed net gain on disposal and the fair
value increment on investment properties are revenue components. The printed before-capital result is
retained in reconciliation evidence only, never emitted.

## 5. Extracted entity rows (18)

Source id `bathurst-gpfs`, `source_dataset` "Bathurst Regional Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Bathurst Regional Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`,
`aggregation_role: "agency_detail"`.

| # | `gpfs_line_item` | Section | $'000 | AUD cents |
| --- | --- | --- | ---: | ---: |
| 1 | `rates_and_annual_charges` | revenue | 60,216 | 6,021,600,000 |
| 2 | `user_charges_and_fees` | revenue | 33,354 | 3,335,400,000 |
| 3 | `other_revenues` | revenue | 2,903 | 290,300,000 |
| 4 | `government_grants_operating` | revenue | 14,898 | 1,489,800,000 |
| 5 | `government_grants_capital` | revenue | 13,773 | 1,377,300,000 |
| 6 | `interest_and_investment_income` | revenue | 3,884 | 388,400,000 |
| 7 | `other_income` | revenue | 3,109 | 310,900,000 |
| 8 | `net_gain_from_disposal_of_assets` | revenue | 4,857 | 485,700,000 |
| 9 | `fair_value_increment_on_investment_properties` | revenue | 468 | 46,800,000 |
| 10 | `total_revenue` | revenue | 137,462 | 13,746,200,000 |
| 11 | `employee_expenses` | expenses | 37,477 | 3,747,700,000 |
| 12 | `materials_and_services` | expenses | 50,224 | 5,022,400,000 |
| 13 | `borrowing_costs` | expenses | 1,576 | 157,600,000 |
| 14 | `other_expenses` | expenses | 2,572 | 257,200,000 |
| 15 | `total_expenses_excluding_depreciation` | expenses | 91,849 | 9,184,900,000 |
| 16 | `depreciation_amortisation_impairment` | expenses | 30,030 | 3,003,000,000 |
| 17 | `total_expenses` | expenses | 121,879 | 12,187,900,000 |
| 18 | `net_result` | result | 15,583 | 1,558,300,000 |

The before-capital result, the B1-1 function split, the balance-sheet components and the cash-flow
lines are used only for the reconciliation checks and are not emitted as rows.

## 6. No-total / no-cross-council rule

- Bathurst Regional Council is one entity. No council total, no state/national total and no sum with
  another council, a government program, the PNFC benchmark or the OLG summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- The pre-existing same-entity rows (e.g. AusTender contracts naming Bathurst) are preserved
  untouched and never summed.

## 7. How to verify

```bash
# Both paths returned HTTP 200 on 2026-11-20; this checks the exact PDF.
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.bathurst.nsw.gov.au/files/assets/public/v/1/council/annual-plan/annual-financial-statements-2024-2025.pdf'

# Browser helper (headless Chromium first, then plain fallback).
npx tsx scripts/bathurst-gpfs-browser.ts

# Focused connector tests.
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_bathurst" \
  npx vitest run --project server server/test/bathurst-gpfs.test.ts
```

The focused suite covers audited-FS discovery/latest selection (retaining older years), prior-year and
future-year rejection, the browser path with its plain fallback, the printed-unit gate, a broken-
subtotal rejection, the B1-1 income/grants bridge, exact reconciliation, natural-key stability, and
additive-only idempotent 18-row ingestion.
