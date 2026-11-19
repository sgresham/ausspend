# Lismore City Council — General Purpose Financial Statements (FY2024-25)

Source id `lismore-gpfs` (NSW local government). One council only; entity-level rows, no council total
and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the signed standalone FY2024-25 Financial reports.** The
FY2024-25 annual report is narrative/statutory-information only and contains no audited GPFS section
(that rejection path is retained; see §5). The official Annual and Financial Reports page publishes a
separate current-year signed **Financial reports 2024/25** PDF with the audit opinion, which is the
correct source for this cure.

## 0. Stale-year check

The work item is FY2024-25. The official **Annual and Financial Reports** page was checked on
2026-11-20 and lists the FY2024-25 signed Financial reports and older years. No FY2025-26 Financial
reports or annual report was published, so the FY2024-25 document is the latest available. It is the
current-year document, not an older prior-year substitute. A 404/JS-only later-year link would be
recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Lismore City Council**.
- Document: **Financial reports 2024/25** for the year ended 30 June 2025 — FY2024-25. The signed PDF is
  3,269,117 bytes, 104 pages, and contains the GPFS (Income Statement p5, Statement of Comprehensive
  Income p6, Statement of Financial Position p7, Statement of Changes in Equity p8, Statement of Cash
  Flows p9, B1-1 functions p15, "End of the audited financial statements" p73), followed by special
  purpose statements and special schedules.
- Discovery page:
  <https://www.lismore.nsw.gov.au/Council/Corporate-information/Annual-and-financial-reports>.
- Exact FS PDF:
  <https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2025-signed-27-nov-25.pdf>.
  The same URL is the documented official fallback pin.

## 2. Access, discovery and fetch

The brief warned that the official WAF can return `403` to a plain HTTP client. In this retrieval run a
plain `curl/8.5.0` request returned `200 application/pdf`, but the ingest path nevertheless uses the
established headless Chromium browser path (`scripts/lismore-gpfs-browser.ts`) as required: the browser
loads the official page, the connector discovers the FY2024-25 signed FS link from the cleared HTML
(never hard-coded), the browser fetches the exact bytes, and the connector SHA-256 verifies and
re-archives them. The plain-fetch path and a documented official pin remain as fallbacks.

The browser path was exercised live on 2026-11-20: `fetchLismoreGpfsViaBrowser()` discovered the FS URL
above and returned 3,269,117 bytes.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`lismore-gpfs/annual_financial_statements-2025-signed-27-nov-25.pdf`:

- URL: `https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2025-signed-27-nov-25.pdf`
- retrieval date: 2026-11-20
- bytes: **3,269,117**
- SHA-256: `e4816b7149d268099bbb931fcf0a3b34b03ab0e4b28663aba18039cdf0da9797`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit is
`$ '000`; a missing or conflicting unit is rejected rather than defaulted.

| Check                                                                                                                                                                                                    | Printed / derived                     | Result                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Total income from continuing operations                                                                                                                                                                  | `273,175`                             | printed                                                        |
| Revenue components (rates `66,953` + user charges `30,687` + other revenues `3,959` + operating grants `24,115` + capital grants `137,591` + interest `9,708` + joint-venture/equity-method share `162`) | `273,175`                             | = printed total                                                |
| Expense components (employee `49,208` + materials `56,842` + borrowing `2,813` + other `4,188` + net loss on disposal `3,617`)                                                                           | `116,668`                             | = printed expenses excluding depreciation                      |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`37,388`)                                                                                                        | `116,668` + `37,388` = `154,056`      | = total expenses bridge                                        |
| Total income − total expenses                                                                                                                                                                            | `273,175` − `154,056` = `119,119`     | = printed net result                                           |
| Net result − capital grants                                                                                                                                                                              | `119,119` − `137,591` = `(18,472)`    | = printed before-capital result (evidence only)                |
| B1-1 expenses                                                                                                                                                                                            | `154,056`                             | = face expense bridge                                          |
| B1-1 own-source income `111,469` + B1-1 grants `161,706`                                                                                                                                                 | `273,175`                             | = face total income (Lismore prints these in separate columns) |
| B1-1 income − B1-1 expenses                                                                                                                                                                              | `111,469` − `154,056` = `(42,587)`    | = printed B1-1 operating result                                |
| B1-1 operating result + B1-1 grants                                                                                                                                                                      | `(42,587)` + `161,706` = `119,119`    | = printed net result                                           |
| B1-1 grants and contributions                                                                                                                                                                            | `161,706`                             | = operating `24,115` + capital `137,591`                       |
| B1-1 carrying amount of assets                                                                                                                                                                           | `2,447,945`                           | = printed total assets                                         |
| Statement of Comprehensive Income net result                                                                                                                                                             | `119,119`                             | = Income Statement net result                                  |
| Other comprehensive income (revaluation `49,833` + impairment reversal/decrement `(1,378)`)                                                                                                              | `48,455`                              | = printed other comprehensive income                           |
| Total comprehensive income                                                                                                                                                                               | `119,119` + `48,455` = `167,574`      | = printed total                                                |
| Statement of Financial Position: current assets `268,703` + non-current assets `2,179,242`                                                                                                               | `2,447,945`                           | = total assets                                                 |
| Current liabilities `145,515` + non-current liabilities `47,063`                                                                                                                                         | `192,578`                             | = total liabilities                                            |
| Total assets − total liabilities                                                                                                                                                                         | `2,447,945` − `192,578` = `2,255,367` | = net assets                                                   |
| Accumulated surplus `817,741` + IPPE revaluation surplus `1,437,626`                                                                                                                                     | `2,255,367`                           | = total equity                                                 |
| Statement of Changes in Equity: opening `2,087,793` + total comprehensive income `167,574`                                                                                                               | `2,255,367`                           | = closing equity = SoFP total equity                           |
| Statement of Cash Flows: operating `175,057` + investing `(145,923)` + financing `(5,623)`                                                                                                               | `23,511`                              | = net change in cash                                           |
| Opening cash `113,596` + net change `23,511`                                                                                                                                                             | `137,107`                             | = closing cash = SoFP cash                                     |

The joint-venture/equity-method revenue line (`162`) is emitted as a revenue component; its expense
counterpart is nil in 2025 and is not emitted. The printed before-capital result is retained in
reconciliation evidence only, never emitted.

## 5. Annual-report-only rejection retained

The FY2024-25 annual report (10,228,662 bytes, SHA-256
`a6ff496fa5bfa9468088923e7ce880f86bf2132d55076934632da7927ee64a86`) remains narrative/statutory-
information only: page 3 is the contents, whose last listed section is **Statutory Information**, and
the report ends at the back cover (page 74); page 5 says the Annual Report "must also contain
Statutory Reporting Information and Financial Statements", but the published PDF does not embed them.
`parseLismoreAnnualReportExtraction` is retained and returns 0 rows with the exact gap:

```
audited GPFS section not found in the FY2024-25 annual report; page 3 is the contents, whose last
listed section is Statutory Information and which has no financial-statements section; page 5 says the
annual report must contain financial statements, but the 74-page PDF contains no Income
Statement/Statement of Comprehensive Income/Statement of Financial Position/Statement of Cash
Flows/B1-1 with printed subtotals; the official reporting page publishes a separate FY2024-25 Financial
reports PDF, and this annual-report-only item does not substitute that standalone report; no rows
ingested
```

## 6. Extracted entity rows (17)

Source id `lismore-gpfs`, `source_dataset` "Lismore City Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Lismore City Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`,
`aggregation_role: "agency_detail"`.

| #   | `gpfs_line_item`                        | Section  |   $'000 |      AUD cents |
| --- | --------------------------------------- | -------- | ------: | -------------: |
| 1   | `rates_and_annual_charges`              | revenue  |  66,953 |  6,695,300,000 |
| 2   | `user_charges_and_fees`                 | revenue  |  30,687 |  3,068,700,000 |
| 3   | `other_revenues`                        | revenue  |   3,959 |    395,900,000 |
| 4   | `government_grants_operating`           | revenue  |  24,115 |  2,411,500,000 |
| 5   | `government_grants_capital`             | revenue  | 137,591 | 13,759,100,000 |
| 6   | `interest_and_investment_income`        | revenue  |   9,708 |    970,800,000 |
| 7   | `net_share_joint_ventures`              | revenue  |     162 |     16,200,000 |
| 8   | `total_revenue`                         | revenue  | 273,175 | 27,317,500,000 |
| 9   | `employee_expenses`                     | expenses |  49,208 |  4,920,800,000 |
| 10  | `materials_and_services`                | expenses |  56,842 |  5,684,200,000 |
| 11  | `borrowing_costs`                       | expenses |   2,813 |    281,300,000 |
| 12  | `other_expenses`                        | expenses |   4,188 |    418,800,000 |
| 13  | `net_loss_from_disposal_of_assets`      | expenses |   3,617 |    361,700,000 |
| 14  | `total_expenses_excluding_depreciation` | expenses | 116,668 | 11,666,800,000 |
| 15  | `depreciation_amortisation_impairment`  | expenses |  37,388 |  3,738,800,000 |
| 16  | `total_expenses`                        | expenses | 154,056 | 15,405,600,000 |
| 17  | `net_result`                            | result   | 119,119 | 11,911,900,000 |

The before-capital result, the B1-1 function split, the balance-sheet components and the cash-flow
lines are used only for the reconciliation checks and are not emitted as rows.

## 7. No-total / no-cross-council rule

- Lismore City Council is one entity. No council total, no state/national total and no sum with another
  council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark or the OLG
  summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- The pre-existing same-entity rows (e.g. AusTender contracts naming Lismore) are preserved untouched
  and never summed.

## 8. How to verify

```bash
# Official page and exact FY2024-25 signed FS (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.lismore.nsw.gov.au/Council/Corporate-information/Annual-and-financial-reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.lismore.nsw.gov.au/files/assets/public/v/1/5.-council/7.-about-council/6.-corporate-information/annual_financial_statements-2025-signed-27-nov-25.pdf'

# Browser/WAF path (headless Chromium) then the focused connector tests.
npx tsx scripts/lismore-gpfs-browser.ts
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_lismoregpfs" \
  npx vitest run --project server server/test/lismore-gpfs.test.ts
```

The focused suite covers FS discovery/latest selection, prior-year and future-year rejection, the
browser/WAF path, the retained annual-report rejection, the printed-unit gate, the B1-1
own-source/grants bridge, exact reconciliation, natural-key stability, and additive-only idempotent
17-row ingestion.
