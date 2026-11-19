# Eurobodalla Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `eurobodalla-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the official standalone audited Annual Financial Statements
for the year ended 30 June 2026.** The official Financial Statements page publishes the audited GPFS as
its own PDF (with the independent auditor's reports), so there is no annual-report-only step for this
council and no older report is substituted.

## 0. Stale-year check

The work item was opened on 2026-11-19/20. The official **Financial Statements** page was checked on
2026-11-20 and lists the current audited publication first, followed by older years:

- 2026: "Annual Financial Statements for the year ended 30 June 2026 (3.2 MB)"
- 2025: "Annual Financial Statements for the year ended 30 June 2025 (3.3 MB)"
- 2024: "Annual Financial Statements for the year ended 30 June 2024.pdf (4.1 MB)"
- older years back to 2012-13.

The FY2025-26 statements are for the year ended 30 June 2026 and were authorised for issue by Council
on 29 September 2026, with the Report on the Conduct of the Audit dated 28 October 2026. They are the
latest published audited FS, so FY2025-26 is the current year and is ingested. A later-year link that
404s or is JS-only would be recorded as a gap, not a reason to fabricate a document.

## 1. Source and year

- Publisher: **Eurobodalla Shire Council**.
- Document: **Annual Financial Statements for the year ended 30 June 2026** — FY2025-26. The PDF is
  **3,380,012 bytes**, **105 physical pages** (pdfjs extraction exposes 104 pages because one page has
  no text), and contains the GPFS (Income Statement p5, Statement of Comprehensive Income p6, Statement
  of Financial Position p7, Statement of Changes in Equity p8, Statement of Cash Flows p9, B1-1
  functions p14), the notes (`End of the audited financial statements` p67), the independent auditor's
  report (p68) and the special purpose financial statements/schedules for the water and sewer
  activities (not ingested).
- Discovery page:
  <https://www.esc.nsw.gov.au/council/plans-and-reporting/financial-statements>.
- Exact audited PDF:
  <https://www.esc.nsw.gov.au/__data/assets/pdf_file/0004/290047/Annual_Financial_Statements-2026-_Audited.pdf>.
  The same URL is the documented official fallback pin.
- The council's public-exhibition page for the same statements
  (<https://www.esc.nsw.gov.au/council/have-your-say/public-exhibition/on-exhibition/audited-annual-financial-statements-2026>)
  publishes a second asset URL (`.../0015/290112/Annual_Financial_Statements-2026-_Audited.pdf`); it
  was fetched and is **byte-identical** (same SHA-256 and 3,380,012 bytes).

## 2. Access, discovery and fetch

The official host returns a Cloudflare JS challenge to a plain HTTP client. On 2026-11-20 a plain
`curl/8.5.0` request to the official site returned **HTTP 403** (`text/html`, 5,355 bytes, the
"Just a moment..." challenge). That is an access block, not proof of absence.

The ingest path therefore uses the established headless Chromium browser path
(`scripts/eurobodalla-gpfs-browser.ts`): the browser loads the official Financial Statements page, the
connector discovers the FY2025-26 audited-FS link from the cleared HTML (never hard-coded — the real
anchor text is "Annual Financial Statements for the year ended 30 June 2026 (3.2 MB)"), the browser
fetches the exact bytes, and the connector SHA-256 verifies and re-archives them. The browser path was
exercised live on 2026-11-20 and discovered the URL above, returning **3,380,012** bytes. A plain-fetch
path and the documented official pin remain as fallbacks.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`eurobodalla-gpfs/Annual_Financial_Statements-2026-_Audited.pdf`:

- URL: `https://www.esc.nsw.gov.au/__data/assets/pdf_file/0004/290047/Annual_Financial_Statements-2026-_Audited.pdf`
- retrieval date: 2026-11-20
- bytes: **3,380,012**
- SHA-256: `b729322500f9ac43204c38925fbad62b2bf10b893fdc45956cc43ea95702b89e`
- content type: `application/pdf`
- pages: **105** physical (104 with text)
- abstract archive path: `~/ausspend-source-archive/eurobodalla-gpfs/Annual_Financial_Statements-2026-_Audited.pdf`
  (hash_verified: true)

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit is
`$ '000`; a missing or conflicting unit is rejected rather than defaulted.

| Check                                                                                                                                                                               | Printed / derived                     | Result                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| Total income from continuing operations                                                                                                                                             | `195,167`                             | printed                                         |
| Revenue components (rates `83,455` + user charges `31,845` + other revenue `4,434` + operating grants `20,773` + capital grants `44,004` + interest `7,699` + other income `2,957`) | `195,167`                             | = printed total                                 |
| Expense components (employee `51,836` + materials `46,326` + borrowing `2,535` + other `2,042` + net loss on disposal `4,174`)                                                      | `106,913`                             | = printed expenses excluding depreciation       |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`52,762`)                                                                                   | `106,913` + `52,762` = `159,675`      | = total expenses bridge                         |
| Total income − total expenses                                                                                                                                                       | `195,167` − `159,675` = `35,492`      | = printed net result                            |
| Net result − capital grants                                                                                                                                                         | `35,492` − `44,004` = `(8,512)`       | = printed before-capital result (evidence only) |
| B1-1 expenses                                                                                                                                                                       | `159,675`                             | = face expense bridge                           |
| B1-1 income (includes grants and contributions)                                                                                                                                     | `195,167`                             | = face total income                             |
| B1-1 income − B1-1 expenses                                                                                                                                                         | `195,167` − `159,675` = `35,492`      | = printed B1-1 operating result = net result    |
| B1-1 grants and contributions                                                                                                                                                       | `64,777`                              | = operating `20,773` + capital `44,004`         |
| B1-1 carrying amount of assets                                                                                                                                                      | `2,596,497`                           | = printed total assets                          |
| Statement of Comprehensive Income net result                                                                                                                                        | `35,492`                              | = Income Statement net result                   |
| Other comprehensive income (revaluation `70,799` + other movements `309`)                                                                                                           | `71,108`                              | = printed other comprehensive income            |
| Total comprehensive income                                                                                                                                                          | `35,492` + `71,108` = `106,600`       | = printed total                                 |
| Statement of Financial Position: current assets `170,629` + non-current assets `2,425,868`                                                                                          | `2,596,497`                           | = total assets                                  |
| Current liabilities `44,636` + non-current liabilities `90,693`                                                                                                                     | `135,329`                             | = total liabilities                             |
| Total assets − total liabilities                                                                                                                                                    | `2,596,497` − `135,329` = `2,461,168` | = net assets                                    |
| Accumulated surplus `1,197,087` + IPPE revaluation surplus `1,264,081`; Council equity interest and total equity                                                                    | `2,461,168`                           | = net assets = total equity                     |
| Statement of Changes in Equity: opening `2,354,568` + total comprehensive income `106,600`                                                                                          | `2,461,168`                           | = closing equity = SoFP total equity            |
| Statement of Cash Flows: operating `64,086` + investing `(61,428)` + financing `(8,206)`                                                                                            | `(5,548)`                             | = net change in cash                            |
| Opening cash `24,526` + net change `(5,548)`                                                                                                                                        | `18,978`                              | = closing cash = SoFP cash                      |

Eurobodalla prints "Net loss from the disposal of assets" as an **expense** component of the printed
expenses-excluding-depreciation subtotal (not as revenue), so it is emitted as an expense row. The
printed before-capital result is retained in reconciliation evidence only, never emitted.

## 5. Extracted entity rows (17)

Source id `eurobodalla-gpfs`, `source_dataset` "Eurobodalla Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Eurobodalla Shire Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`,
`aggregation_role: "agency_detail"`.

| #   | `gpfs_line_item`                        | Section  |   $'000 |      AUD cents |
| --- | --------------------------------------- | -------- | ------: | -------------: |
| 1   | `rates_and_annual_charges`              | revenue  |  83,455 |  8,345,500,000 |
| 2   | `user_charges_and_fees`                 | revenue  |  31,845 |  3,184,500,000 |
| 3   | `other_revenues`                        | revenue  |   4,434 |    443,400,000 |
| 4   | `government_grants_operating`           | revenue  |  20,773 |  2,077,300,000 |
| 5   | `government_grants_capital`             | revenue  |  44,004 |  4,400,400,000 |
| 6   | `interest_and_investment_income`        | revenue  |   7,699 |    769,900,000 |
| 7   | `other_income`                          | revenue  |   2,957 |    295,700,000 |
| 8   | `total_revenue`                         | revenue  | 195,167 | 19,516,700,000 |
| 9   | `employee_expenses`                     | expenses |  51,836 |  5,183,600,000 |
| 10  | `materials_and_services`                | expenses |  46,326 |  4,632,600,000 |
| 11  | `borrowing_costs`                       | expenses |   2,535 |    253,500,000 |
| 12  | `other_expenses`                        | expenses |   2,042 |    204,200,000 |
| 13  | `net_loss_from_disposal_of_assets`      | expenses |   4,174 |    417,400,000 |
| 14  | `total_expenses_excluding_depreciation` | expenses | 106,913 | 10,691,300,000 |
| 15  | `depreciation_amortisation_impairment`  | expenses |  52,762 |  5,276,200,000 |
| 16  | `total_expenses`                        | expenses | 159,675 | 15,967,500,000 |
| 17  | `net_result`                            | result   |  35,492 |  3,549,200,000 |

The before-capital result, the B1-1 function split, the balance-sheet components and the cash-flow
lines are used only for the reconciliation checks and are not emitted as rows.

## 6. No-total / no-cross-council rule

- Eurobodalla Shire Council is one entity. No council total, no state/national total and no sum with
  another council, a government program, the PNFC benchmark or the OLG summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- The pre-existing same-entity rows (e.g. AusTender contracts naming Eurobodalla) are preserved
  untouched and never summed.

## 7. How to verify

```bash
# Plain fetch is blocked by the Cloudflare challenge (403), so use the browser path.
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.esc.nsw.gov.au/council/plans-and-reporting/financial-statements'

# Browser/WAF path (headless Chromium) then the focused connector tests.
npx tsx scripts/eurobodalla-gpfs-browser.ts
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_eurobodalla" \
  npx vitest run --project server server/test/eurobodalla-gpfs.test.ts
```

The focused suite covers audited-FS discovery/latest selection (retaining older years), prior-year and
future-year rejection, the browser/Cloudflare path, the printed-unit gate, a broken-subtotal rejection,
the B1-1 income/grants bridge, exact reconciliation, natural-key stability, and additive-only
idempotent 17-row ingestion.
