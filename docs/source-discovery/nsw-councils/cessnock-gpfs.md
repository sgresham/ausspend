# Cessnock City Council — General Purpose Financial Statements (FY2024-25)

Source id `cessnock-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the standalone FY2024-25 audited Annual Financial
Statements (AFS).** The FY2024-25 annual report is narrative-only and contains no audited GPFS
section (that rejection path is retained; see §5). The official Annual Report page links a separate
standalone AFS PDF with the audit opinion, which is the correct source for this cure.

## 0. Stale-year check

The work item is FY2024-25. The official **Annual Financial Statements** page was checked on
2026-11-20 and lists the FY2025-26 document (year ended 30 June 2026), the FY2024-25 document (year
ended 30 June 2025) and older years. The FY2025-26 document is newer than this item's target and was
**not** substituted; the FY2024-25 document is the target and is not an older prior-year substitute.
A 404/JS-only later-year link would be recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Cessnock City Council**.
- Document: **Annual Financial Statements for the Year Ended 30 June 2025** — FY2024-25. The PDF is
  7,998,715 bytes, 88 pages, and contains the auditor's report (independent auditor's report
  beginning p67) and the general purpose financial statements.
- Discovery page (linked from the Annual Report page):
  <https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Finance-and-budget/Annual-Financial-Statements>.
- Exact AFS PDF:
  <https://www.cessnock.nsw.gov.au/files/assets/public/v/2/hptrim/website-finance-budget-documents-do-not-change/ccc-_-annual_financial_statements-2024-2025-final-with-audit-opinion.pdf>.
  The same URL is the documented official fallback pin.

## 2. Access, discovery and fetch

The brief warned that the official Edge/Akamai WAF can return `403 text/html` to a plain HTTP client.
In this retrieval run both the browser path and a plain `curl/8.5.0` request returned the PDF, but the
ingest path nevertheless uses the established headless Chromium browser path
(`scripts/cessnock-gpfs-browser.ts`) as required: the browser loads the official Annual Financial
Statements page, the connector discovers the FY2024-25 AFS link from the cleared HTML (never
hard-coded), the browser fetches the exact bytes, and the connector SHA-256 verifies and re-archives
them. The plain-fetch path and a documented official pin remain as fallbacks.

The browser path was exercised live on 2026-11-20:
`fetchCessnockGpfsViaBrowser()` discovered the AFS URL above and returned 7,998,715 bytes.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`cessnock-gpfs/ccc-_-annual_financial_statements-2024-2025-final-with-audit-opinion.pdf`:

- URL: `https://www.cessnock.nsw.gov.au/files/assets/public/v/2/hptrim/website-finance-budget-documents-do-not-change/ccc-_-annual_financial_statements-2024-2025-final-with-audit-opinion.pdf`
- retrieval date: 2026-11-20
- bytes: **7,998,715**
- SHA-256: `c6b4061782e9321f0b028459592bd66ecc970bfb7e5f50016c7f66332efe40b4`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit
is `$ '000`; a missing or conflicting unit is rejected rather than defaulted.

| Check                                                                                                                                                                             | Printed / derived                     | Result                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Total income from continuing operations (Income Statement)                                                                                                                        | `176,621`                             | printed                                                      |
| Revenue components (rates `71,193` + user charges `9,926` + other revenues `3,339` + operating grants `15,706` + capital grants `71,924` + interest `3,891` + other income `642`) | `176,621`                             | = printed total                                              |
| Expense components (employee `49,318` + materials `37,269` + borrowing `922` + other `7,359` + net loss on disposal `17,405`)                                                     | `112,273`                             | = printed expenses excluding depreciation                    |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`26,202`)                                                                                 | `112,273` + `26,202` = `138,475`      | = total expenses bridge                                      |
| Total revenue − total expenses                                                                                                                                                    | `176,621` − `138,475` = `38,146`      | = printed net result                                         |
| Net operating result before grants and contributions provided for capital purposes                                                                                                | `38,146` − `71,924` = `(33,778)`      | = printed negative figure (evidence only)                    |
| B1-1 Total functions and activities — income                                                                                                                                      | `176,621`                             | = face statement                                             |
| B1-1 Total functions and activities — expenses                                                                                                                                    | `138,475`                             | = face bridge                                                |
| B1-1 Total functions and activities — operating result                                                                                                                            | `38,146`                              | = face net result                                            |
| B1-1 grants and contributions                                                                                                                                                     | `87,630`                              | = operating `15,706` + capital `71,924`                      |
| B1-1 carrying amount of assets                                                                                                                                                    | `1,683,382`                           | = printed total assets                                       |
| Statement of Comprehensive Income net result                                                                                                                                      | `38,146`                              | = Income Statement net result                                |
| Other comprehensive income (revaluation gain `222,099`)                                                                                                                           | `222,099`                             | = printed other comprehensive income                         |
| Total comprehensive income (`38,146` + `222,099`)                                                                                                                                 | `260,245`                             | = printed total comprehensive income                         |
| Statement of Financial Position: current assets `115,758` + non-current assets `1,567,624`                                                                                        | `1,683,382`                           | = total assets                                               |
| Current liabilities `68,851` + non-current liabilities `42,338`                                                                                                                   | `111,189`                             | = total liabilities                                          |
| Total assets − total liabilities                                                                                                                                                  | `1,683,382` − `111,189` = `1,572,193` | = net assets                                                 |
| Accumulated surplus `759,881` + IPPE revaluation surplus `812,312`                                                                                                                | `1,572,193`                           | = total equity                                               |
| Statement of Changes in Equity: opening `1,311,948` + total comprehensive income `260,245`                                                                                        | `1,572,193`                           | = closing equity = SoFP total equity                         |
| Statement of Cash Flows: operating `70,379` + investing `(67,778)` + financing `12,631`                                                                                           | `15,232`                              | = net change in cash                                         |
| Closing cash `34,226` − net change `15,232`                                                                                                                                       | `18,994`                              | = prior-year closing cash; closing cash = SoFP cash `34,226` |

Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the
printed depreciation/amortisation/impairment line, and equals the printed B1-1 expense total. The
printed net result is positive (`38,146`); the before-capital result is negative (`-33,778`) and is
retained in reconciliation evidence only, never emitted. A net loss on disposal of assets (`17,405`)
is a printed expense component and is emitted as an expense row.

## 5. Annual-report-only rejection retained

The FY2024-25 annual report (16,506,336 bytes, SHA-256
`d111d81c727c7e65f76866487e6a470bf717d301ffbe36d84fd88bba0411a494`) remains narrative-only:
page 13 is a **Financial summary**, and the report ends at the **Attestation Statement** on page 101.
`parseCessnockAnnualReportExtraction` is retained and returns 0 rows with the exact gap:

```
audited GPFS section not found in the FY2024-25 annual report; page 13 contains only the narrative
Financial summary; the report ends at the Attestation Statement on page 101; no Income
Statement/Statement of Comprehensive Income/Statement of Financial Position/B1-1 with printed
subtotals was found; the official Annual Report page states the Annual Financial Statements for the
Year Ended 30 June 2025 can be viewed separately, and this annual-report-only item does not
substitute that standalone report; no rows ingested
```

## 6. Extracted entity rows (17)

Source id `cessnock-gpfs`, `source_dataset` "Cessnock City Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Cessnock City Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`,
`aggregation_role: "agency_detail"`.

| #   | `gpfs_line_item`                        | Section  |   $'000 |      AUD cents |
| --- | --------------------------------------- | -------- | ------: | -------------: |
| 1   | `rates_and_annual_charges`              | revenue  |  71,193 |  7,119,300,000 |
| 2   | `user_charges_and_fees`                 | revenue  |   9,926 |    992,600,000 |
| 3   | `other_revenues`                        | revenue  |   3,339 |    333,900,000 |
| 4   | `government_grants_operating`           | revenue  |  15,706 |  1,570,600,000 |
| 5   | `government_grants_capital`             | revenue  |  71,924 |  7,192,400,000 |
| 6   | `interest_and_investment_income`        | revenue  |   3,891 |    389,100,000 |
| 7   | `other_income`                          | revenue  |     642 |     64,200,000 |
| 8   | `total_revenue`                         | revenue  | 176,621 | 17,662,100,000 |
| 9   | `employee_expenses`                     | expenses |  49,318 |  4,931,800,000 |
| 10  | `materials_and_services`                | expenses |  37,269 |  3,726,900,000 |
| 11  | `borrowing_costs`                       | expenses |     922 |     92,200,000 |
| 12  | `other_expenses`                        | expenses |   7,359 |    735,900,000 |
| 13  | `net_loss_from_disposal_of_assets`      | expenses |  17,405 |  1,740,500,000 |
| 14  | `total_expenses_excluding_depreciation` | expenses | 112,273 | 11,227,300,000 |
| 15  | `depreciation_amortisation_impairment`  | expenses |  26,202 |  2,620,200,000 |
| 16  | `total_expenses`                        | expenses | 138,475 | 13,847,500,000 |
| 17  | `net_result`                            | result   |  38,146 |  3,814,600,000 |

The before-capital result (`-33,778`), the B1-1 function split, the balance-sheet components and the
cash-flow lines are used only for the reconciliation checks and are not emitted as rows.

## 7. No-total / no-cross-council rule

- Cessnock City Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- The pre-existing same-entity rows (e.g. AusTender contracts naming Cessnock) are preserved
  untouched and never summed.

## 8. How to verify

```bash
# Official AFS page and exact FY2024-25 AFS (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Finance-and-budget/Annual-Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.cessnock.nsw.gov.au/files/assets/public/v/2/hptrim/website-finance-budget-documents-do-not-change/ccc-_-annual_financial_statements-2024-2025-final-with-audit-opinion.pdf'

# Browser/WAF path (headless Chromium) then the focused connector tests.
npx tsx scripts/cessnock-gpfs-browser.ts
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_cessnockgpfs" \
  npx vitest run --project server server/test/cessnock-gpfs.test.ts
```

The focused suite covers AFS discovery/latest selection, prior-year and future-year rejection, the
browser/WAF path, the retained annual-report rejection, the printed-unit gate, exact reconciliation,
natural-key stability, and additive-only idempotent 17-row ingestion.
