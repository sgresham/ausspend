# Kiama Municipal Council — General Purpose Financial Statements (FY2024-25)

Source id `kiama-gpfs` (NSW local government). One council only; entity-level rows, no council total
and no cross-council or state/federal addition.

**Status: landed — 19 statement rows from the standalone FY2024-25 audited Financial Statements.** The
FY2024-25 annual report is narrative-only and contains no audited GPFS section (that rejection path is
retained; see §5). The official Annual Reports and Financial Statements page publishes a separate
current-year **Financial Statements 2024-25** PDF with the audit opinion, which is the correct source
for this cure.

## 0. Stale-year check

The work item is FY2024-25. The official **Annual Reports and Financial Statements** page was checked
on 2026-11-20 and lists the FY2024-25 Financial Statements and older years. No FY2025-26 Financial
Statements or annual report was published, so the FY2024-25 document is the latest available. It is the
current-year document, not an older prior-year substitute. A 404/JS-only later-year link would be
recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Kiama Municipal Council**.
- Document: **Financial Statements for the Year Ended 30 June 2025** — FY2024-25. The PDF is
  10,095,862 bytes, 93 pages, and contains the GPFS and the independent auditor's report (Income
  Statement p4, Statement of Comprehensive Income p5, Statement of Financial Position p6, Statement of
  Changes in Equity p7, Statement of Cash Flows p8, B1-1 functions p13, independent auditor's report
  p57).
- Discovery page:
  <https://www.kiama.nsw.gov.au/Council/Community-Reports/Annual-Reports-and-Financial-Statements>.
- Exact FS PDF:
  <https://www.kiama.nsw.gov.au/files/sharedassets/public/v/1/council/council-plans-amp-reports/financial-plans-and-annual-reports/kiama-municipal-council-financial-statements-2024-25.pdf>.
  The same URL is the documented official fallback pin.

## 2. Access, discovery and fetch

The brief warned that the official WAF can return `403` to a plain HTTP client. In this retrieval run a
plain `curl/8.5.0` request returned `200 application/pdf`, but the ingest path nevertheless uses the
established headless Chromium browser path (`scripts/kiama-gpfs-browser.ts`) as required: the browser
loads the official page, the connector discovers the FY2024-25 FS link from the cleared HTML (never
hard-coded), the browser fetches the exact bytes, and the connector SHA-256 verifies and re-archives
them. The plain-fetch path and a documented official pin remain as fallbacks.

The browser path was exercised live on 2026-11-20:
`fetchKiamaGpfsViaBrowser()` discovered the FS URL above and returned 10,095,862 bytes.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`kiama-gpfs/kiama-municipal-council-financial-statements-2024-25.pdf`:

- URL: `https://www.kiama.nsw.gov.au/files/sharedassets/public/v/1/council/council-plans-amp-reports/financial-plans-and-annual-reports/kiama-municipal-council-financial-statements-2024-25.pdf`
- retrieval date: 2026-11-20
- bytes: **10,095,862**
- SHA-256: `2230fb55dcd165f96f718fa0feaba5aeee72feccb4ed7405b8b818239eb980de`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit is
`$ '000`; a missing or conflicting unit is rejected rather than defaulted. FY2024-25 has a material
discontinued operation (Blue Haven Bonaira), so the continuing and discontinued result lines are
emitted and the statutory net result bridges explicitly.

| Check                                                                                                                                                                            | Printed / derived                 | Result                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------- |
| Total income from continuing operations                                                                                                                                          | `74,082`                          | printed                                         |
| Revenue components (rates `28,741` + user charges `19,567` + other revenues `4,329` + operating grants `3,454` + capital grants `15,517` + interest `2,382` + other income `92`) | `74,082`                          | = printed total                                 |
| Expense components (employee `30,853` + materials `30,044` + borrowing `177` + other `1,135` + net loss on disposal `1,063`)                                                     | `63,272`                          | = printed expenses excluding depreciation       |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`11,557`)                                                                                | `63,272` + `11,557` = `74,829`    | = printed B1-1 total expenses                   |
| Total income − B1-1 total expenses                                                                                                                                               | `74,082` − `74,829` = `(747)`     | = printed continuing operating result           |
| Continuing operating result + discontinued-operations result (`(6,643)`)                                                                                                         | `(747)` + `(6,643)` = `(7,390)`   | = printed statutory net result                  |
| Net result − printed capital grants (`15,517`)                                                                                                                                   | `(7,390)` − `15,517` = `(22,907)` | = printed before-capital result (evidence only) |
| B1-1 income / expenses / operating result                                                                                                                                        | `74,082` / `74,829` / `(747)`     | = face statement                                |
| B1-1 grants and contributions                                                                                                                                                    | `18,971`                          | = operating `3,454` + capital `15,517`          |
| B1-1 carrying amount of assets                                                                                                                                                   | `716,789`                         | = printed total assets                          |
| Statement of Comprehensive Income net result                                                                                                                                     | `(7,390)`                         | = Income Statement statutory net result         |
| Other comprehensive income (revaluation gain `24,011`)                                                                                                                           | `24,011`                          | = printed other comprehensive income            |
| Total comprehensive income                                                                                                                                                       | `(7,390)` + `24,011` = `16,621`   | = printed total                                 |
| Statement of Financial Position: current assets `42,552` + non-current assets `674,237`                                                                                          | `716,789`                         | = total assets                                  |
| Current liabilities `83,736` + non-current liabilities `8,908`                                                                                                                   | `92,644`                          | = total liabilities                             |
| Total assets − total liabilities                                                                                                                                                 | `716,789` − `92,644` = `624,145`  | = net assets                                    |
| Accumulated surplus `153,518` + IPPE revaluation surplus `470,627`                                                                                                               | `624,145`                         | = total equity                                  |
| Statement of Changes in Equity: opening `607,524` + total comprehensive income `16,621`                                                                                          | `624,145`                         | = closing equity = SoFP total equity            |
| Statement of Cash Flows: operating `6,312` + investing `5,808` + financing `(13,243)`                                                                                            | `(1,123)`                         | = net change in cash                            |
| Opening cash `19,051` + net change `(1,123)`                                                                                                                                     | `17,928`                          | = closing cash = SoFP cash                      |

The negative result lines are stored with a `gpfs_printed_sign: "negative"` marker. The before-capital
result is retained in reconciliation evidence only, never emitted.

## 5. Annual-report-only rejection retained

The FY2024-25 annual report (15,525,717 bytes, SHA-256
`dd65cda214df712a9cd3f02f8fcb3c3cb17dd73c58584438d7ab15b01ebbb8ea`) remains narrative-only: page 19
is an un-audited **Consolidated operating results** summary and the report ends at the
**Authorisation and version control** page (page 91). `parseKiamaAnnualReportExtraction` is retained and
returns 0 rows with the exact gap:

```
audited GPFS section not found in the FY2024-25 annual report; page 19 contains only the un-audited
Consolidated operating results summary; the report ends at the Authorisation and version control page
(page 91); no Income Statement/Statement of Comprehensive Income/Statement of Financial Position/
Statement of Cash Flows/B1-1 with printed subtotals was found; the official Reporting page publishes a
separate FY2024-25 Financial Statements PDF, and this annual-report-only item does not substitute that
standalone report; no rows ingested
```

The contents page also names "Authorisation and version control"; the parser selects the real page by
also requiring "Owner/Responsible Officer", so the reported page number is 91, not 3.

## 6. Extracted entity rows (19)

Source id `kiama-gpfs`, `source_dataset` "Kiama Municipal Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Kiama Municipal Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`,
`aggregation_role: "agency_detail"`.

| #   | `gpfs_line_item`                        | Section  |   $'000 |                     AUD cents |
| --- | --------------------------------------- | -------- | ------: | ----------------------------: |
| 1   | `rates_and_annual_charges`              | revenue  |  28,741 |                 2,874,100,000 |
| 2   | `user_charges_and_fees`                 | revenue  |  19,567 |                 1,956,700,000 |
| 3   | `other_revenues`                        | revenue  |   4,329 |                   432,900,000 |
| 4   | `government_grants_operating`           | revenue  |   3,454 |                   345,400,000 |
| 5   | `government_grants_capital`             | revenue  |  15,517 |                 1,551,700,000 |
| 6   | `interest_and_investment_income`        | revenue  |   2,382 |                   238,200,000 |
| 7   | `other_income`                          | revenue  |      92 |                     9,200,000 |
| 8   | `total_revenue`                         | revenue  |  74,082 |                 7,408,200,000 |
| 9   | `employee_expenses`                     | expenses |  30,853 |                 3,085,300,000 |
| 10  | `materials_and_services`                | expenses |  30,044 |                 3,004,400,000 |
| 11  | `borrowing_costs`                       | expenses |     177 |                    17,700,000 |
| 12  | `other_expenses`                        | expenses |   1,135 |                   113,500,000 |
| 13  | `net_loss_from_disposal_of_assets`      | expenses |   1,063 |                   106,300,000 |
| 14  | `total_expenses_excluding_depreciation` | expenses |  63,272 |                 6,327,200,000 |
| 15  | `depreciation_amortisation_impairment`  | expenses |  11,557 |                 1,155,700,000 |
| 16  | `total_expenses`                        | expenses |  74,829 |                 7,482,900,000 |
| 17  | `operating_result_continuing`           | result   |   (747) |  74,700,000 (negative marker) |
| 18  | `discontinued_operations_result`        | result   | (6,643) | 664,300,000 (negative marker) |
| 19  | `net_result`                            | result   | (7,390) | 739,000,000 (negative marker) |

The before-capital result, the B1-1 function split, the balance-sheet components and the cash-flow
lines are used only for the reconciliation checks and are not emitted as rows.

## 7. No-total / no-cross-council rule

- Kiama Municipal Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- The pre-existing same-entity rows (e.g. AusTender contracts naming Kiama) are preserved untouched and
  never summed.

## 8. How to verify

```bash
# Official page and exact FY2024-25 FS (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.kiama.nsw.gov.au/Council/Community-Reports/Annual-Reports-and-Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.kiama.nsw.gov.au/files/sharedassets/public/v/1/council/council-plans-amp-reports/financial-plans-and-annual-reports/kiama-municipal-council-financial-statements-2024-25.pdf'

# Browser/WAF path (headless Chromium) then the focused connector tests.
npx tsx scripts/kiama-gpfs-browser.ts
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_kiamagpfs" \
  npx vitest run --project server server/test/kiama-gpfs.test.ts
```

The focused suite covers FS discovery/latest selection, prior-year and future-year rejection, the
browser/WAF path, the retained annual-report rejection, the printed-unit gate, the discontinued-result
bridge, exact reconciliation, natural-key stability, and additive-only idempotent 19-row ingestion.
