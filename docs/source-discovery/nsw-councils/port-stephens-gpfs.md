# Port Stephens Council — General Purpose Financial Statements (FY2024-25)

Source id `port-stephens-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the official Annual Report 2024 to 2025 Volume 2 — Financial
Statement.** The FY2024-25 Volume 1 annual report is narrative/statutory-information only and contains
no audited GPFS section (that rejection path is retained; see §5). Volume 2 is the separately published
GPFS with the independent auditor's reports, and is the correct standalone audited FS for this council.

## 0. Stale-year check

The work item is FY2024-25. The official **Annual Report** page was checked on 2026-11-20 and lists the
FY2024-25 annual report in three parts (Snapshot, Volume 1 and Volume 2) plus older years. No FY2025-26
annual report was published, so the FY2024-25 Volume 2 document is the latest available. A 404/JS-only
later-year link would be recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Port Stephens Council**.
- Document: **Annual Report 2024 to 2025 — Volume 2 Financial Statement** for the year ended 30 June
  2025 — FY2024-25. The PDF is 1,975,075 bytes, 96 pages, and contains the GPFS (Income Statement p5,
  Statement of Comprehensive Income p6, Statement of Financial Position p7, Statement of Changes in
  Equity p8, Statement of Cash Flows p9, B1-1 functions p15), the notes and the independent auditor's
  reports. The unmodified audit opinion is on p75 and the Report on the Conduct of the Audit on p78.
- Discovery page:
  <https://www.portstephens.nsw.gov.au/council/plans-and-reporting/annual-report>.
- Exact Volume 2 PDF:
  <https://www.portstephens.nsw.gov.au/__data/assets/pdf_file/0006/157362/AnnualReport_Volume2_FinancialStatement_2025.pdf>.
  The same URL is the documented official fallback pin.
- Volume 1 (narrative annual report, retained only for the annual-report rejection):
  <https://www.portstephens.nsw.gov.au/__data/assets/pdf_file/0004/157360/AnnualReport_2024-25.pdf>.

## 2. Access, discovery and fetch

The official host returns a Cloudflare JS challenge to a plain HTTP client. On 2026-11-20 a plain
`curl/8.5.0` request to the Annual Report page returned **HTTP 403** (`text/html`, 5,551 bytes, the
"Just a moment..." challenge), and the Volume 2 PDF URL returned **HTTP 403** likewise. That is an
access block, not proof of absence.

The ingest path therefore uses the established headless Chromium browser path
(`scripts/port-stephens-gpfs-browser.ts`): the browser loads the official Annual Report page, the
connector discovers the FY2024-25 Volume 2 link from the cleared HTML (never hard-coded — the real
anchor title/text is "Annual Report 2024 to 2025 – Volume 2", so discovery also accepts the
`FinancialStatement` filename), the browser fetches the exact bytes, and the connector SHA-256 verifies
and re-archives them. A plain-fetch path and the documented official pin remain as fallbacks.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`port-stephens-gpfs/AnnualReport_Volume2_FinancialStatement_2025.pdf`:

- URL: `https://www.portstephens.nsw.gov.au/__data/assets/pdf_file/0006/157362/AnnualReport_Volume2_FinancialStatement_2025.pdf`
- retrieval date: 2026-11-20
- bytes: **1,975,075**
- SHA-256: `c086ddbb067328450652facdc77391c12f1d8442c6f73dbaf8bc50173d911ad9`
- content type: `application/pdf`
- pages: **96**

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit is
`$ '000`; a missing or conflicting unit is rejected rather than defaulted.

| Check                                                                                                                                                                                                             | Printed / derived                     | Result                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| Total income from continuing operations                                                                                                                                                                           | `205,223`                             | printed                                         |
| Revenue components (rates `81,803` + user charges `58,983` + other revenues `6,088` + operating grants `13,059` + capital grants `37,414` + interest `4,496` + other income `2,989` + net gain on disposal `391`) | `205,223`                             | = printed total                                 |
| Expense components (employee `66,113` + materials `68,530` + borrowing `2,616` + other `9,534`)                                                                                                                   | `146,793`                             | = printed expenses excluding depreciation       |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`22,076`)                                                                                                                 | `146,793` + `22,076` = `168,869`      | = total expenses bridge                         |
| Total income − total expenses                                                                                                                                                                                     | `205,223` − `168,869` = `36,354`      | = printed net result                            |
| Net result − capital grants                                                                                                                                                                                       | `36,354` − `37,414` = `(1,060)`       | = printed before-capital result (evidence only) |
| B1-1 expenses                                                                                                                                                                                                     | `168,869`                             | = face expense bridge                           |
| B1-1 income (includes grants and contributions)                                                                                                                                                                   | `205,223`                             | = face total income                             |
| B1-1 income − B1-1 expenses                                                                                                                                                                                       | `205,223` − `168,869` = `36,354`      | = printed B1-1 operating result = net result    |
| B1-1 grants and contributions                                                                                                                                                                                     | `50,473`                              | = operating `13,059` + capital `37,414`         |
| B1-1 carrying amount of assets                                                                                                                                                                                    | `1,906,732`                           | = printed total assets                          |
| Statement of Comprehensive Income net result                                                                                                                                                                      | `36,354`                              | = Income Statement net result                   |
| Other comprehensive income (revaluation `171,646` + hedging instruments `(1,482)`)                                                                                                                                | `170,164`                             | = printed other comprehensive income            |
| Total comprehensive income                                                                                                                                                                                        | `36,354` + `170,164` = `206,518`      | = printed total                                 |
| Statement of Financial Position: current assets `96,234` + non-current assets `1,810,498`                                                                                                                         | `1,906,732`                           | = total assets                                  |
| Current liabilities `52,819` + non-current liabilities `94,578`                                                                                                                                                   | `147,397`                             | = total liabilities                             |
| Total assets − total liabilities                                                                                                                                                                                  | `1,906,732` − `147,397` = `1,759,335` | = net assets                                    |
| Accumulated surplus `847,836` + IPPE revaluation surplus `912,107` + hedging reserve `(608)`                                                                                                                      | `1,759,335`                           | = total equity                                  |
| Statement of Changes in Equity: opening `1,552,817` + total comprehensive income `206,518`                                                                                                                        | `1,759,335`                           | = closing equity = SoFP total equity            |
| Statement of Cash Flows: operating `58,495` + investing `(103,766)` + financing `28,298`                                                                                                                          | `(16,973)`                            | = net change in cash                            |
| Opening cash `24,980` + net change `(16,973)`                                                                                                                                                                     | `8,007`                               | = closing cash = SoFP cash                      |

The printed before-capital result is retained in reconciliation evidence only, never emitted. Port
Stephens prints a "Net loss from the disposal of assets" line of `–` in 2025, so no expense row is
emitted for it; the revenue-side net gain on disposal of `391` is emitted.

## 5. Annual-report-only rejection retained

The FY2024-25 Volume 1 annual report is narrative/statutory-information only. Its contents page 3
lists **Our performance**, **Our leadership** and **Statutory Statements** (and no financial-statements
section); page 35 records that "The Audited Financial Reports for 2024-2025 are contained in Volume 2
of this Report". `parsePortStephensAnnualReportExtraction` is retained and returns 0 rows with the
exact gap:

```
audited GPFS section not found in the FY2024-25 annual report Volume 1; page 3 is the contents, whose
sections are Our performance, Our leadership and Statutory Statements, with no financial-statements
section; the Volume 1 PDF contains no Income Statement/Statement of Comprehensive Income/Statement of
Financial Position/Statement of Cash Flows/B1-1 with printed subtotals; the official Annual Report page
publishes the audited GPFS separately as Volume 2 (Annual Report Volume 2 — Financial Statement), which
this connector ingests as the standalone audited FS; no rows are ingested from Volume 1
```

## 6. Extracted entity rows (17)

Source id `port-stephens-gpfs`, `source_dataset` "Port Stephens Council GPFS 2024-25",
`measure_type: "actual"`, `fiscal_year: "2024-25"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Port Stephens Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`,
`aggregation_role: "agency_detail"`.

| #   | `gpfs_line_item`                        | Section  |   $'000 |      AUD cents |
| --- | --------------------------------------- | -------- | ------: | -------------: |
| 1   | `rates_and_annual_charges`              | revenue  |  81,803 |  8,180,300,000 |
| 2   | `user_charges_and_fees`                 | revenue  |  58,983 |  5,898,300,000 |
| 3   | `other_revenues`                        | revenue  |   6,088 |    608,800,000 |
| 4   | `government_grants_operating`           | revenue  |  13,059 |  1,305,900,000 |
| 5   | `government_grants_capital`             | revenue  |  37,414 |  3,741,400,000 |
| 6   | `interest_and_investment_income`        | revenue  |   4,496 |    449,600,000 |
| 7   | `other_income`                          | revenue  |   2,989 |    298,900,000 |
| 8   | `net_gain_from_disposal_of_assets`      | revenue  |     391 |     39,100,000 |
| 9   | `total_revenue`                         | revenue  | 205,223 | 20,522,300,000 |
| 10  | `employee_expenses`                     | expenses |  66,113 |  6,611,300,000 |
| 11  | `materials_and_services`                | expenses |  68,530 |  6,853,000,000 |
| 12  | `borrowing_costs`                       | expenses |   2,616 |    261,600,000 |
| 13  | `other_expenses`                        | expenses |   9,534 |    953,400,000 |
| 14  | `total_expenses_excluding_depreciation` | expenses | 146,793 | 14,679,300,000 |
| 15  | `depreciation_amortisation_impairment`  | expenses |  22,076 |  2,207,600,000 |
| 16  | `total_expenses`                        | expenses | 168,869 | 16,886,900,000 |
| 17  | `net_result`                            | result   |  36,354 |  3,635,400,000 |

The before-capital result, the B1-1 function split, the balance-sheet components and the cash-flow
lines are used only for the reconciliation checks and are not emitted as rows.

## 7. No-total / no-cross-council rule

- Port Stephens Council is one entity. No council total, no state/national total and no sum with another
  council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark or the OLG
  summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- The pre-existing same-entity rows (e.g. AusTender contracts naming Port Stephens) are preserved
  untouched and never summed.

## 8. How to verify

```bash
# Plain fetch is blocked by the Cloudflare challenge (403), so use the browser path.
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.portstephens.nsw.gov.au/council/plans-and-reporting/annual-report'

# Browser/WAF path (headless Chromium) then the focused connector tests.
npx tsx scripts/port-stephens-gpfs-browser.ts
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_portstephensgpfs" \
  npx vitest run --project server server/test/port-stephens-gpfs.test.ts
```

The focused suite covers Volume 2 discovery/latest selection (excluding Volume 1 and the Snapshot),
prior-year and future-year rejection, the browser/Cloudflare path, the retained annual-report rejection,
the printed-unit gate, the B1-1 income/grants bridge, exact reconciliation, natural-key stability, and
additive-only idempotent 17-row ingestion.
