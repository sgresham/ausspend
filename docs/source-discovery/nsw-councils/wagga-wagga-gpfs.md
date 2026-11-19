# Wagga Wagga City Council — General Purpose Financial Statements (FY2025-26)

Source id `wagga-wagga-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the official standalone audited Annual Financial Statements
for the year ended 30 June 2026.** The official Financial Statements page publishes the audited GPFS as
its own PDF (with the independent auditor's reports), so there is no annual-report-only step for this
council and no older report is substituted.

## 0. Stale-year check

The work item was opened on 2026-11-19/20. The official **Financial Statements** page was checked on
2026-11-20 and lists three audited publications: **2025-2026**, 2024/2025 and 2023/2024. The FY2025-26
statements are for the year ended 30 June 2026 and were authorised for issue by Council on 26 October
2026, with the independent auditor's report dated 27 October 2026. They are the latest published
audited FS, so FY2025-26 is the current year and is ingested. A later-year link that 404s or is JS-only
would be recorded as a gap, not a reason to fabricate a document.

## 1. Source and year

- Publisher: **Wagga Wagga City Council**.
- Document: **Annual Financial Statements for the year ended 30 June 2026** — FY2025-26. The PDF is
  **5,880,591 bytes**, **117 pages**, and contains the GPFS (Income Statement p6, Statement of
  Comprehensive Income p7, Statement of Financial Position p8, Statement of Changes in Equity p9,
  Statement of Cash Flows p10, B1-1 functions p15), the notes (`End of the audited financial
statements` p78), the independent auditor's report (p84) and the special purpose financial
  statements/schedules for the sewerage, livestock marketing and airport activities (not ingested).
- Discovery page:
  <https://wagga.nsw.gov.au/the-council/planning-and-reporting/community-reporting/financial-statements>.
- Exact audited PDF:
  <https://wagga.nsw.gov.au/imagesfiles/documents/the-council/planning-and-reporting/financial-statements/Annual-Financial-Statements-2025-26.pdf>.
  The same URL is the documented official fallback pin.

## 2. Access, discovery and fetch

The official host returns a Cloudflare JS challenge to a plain HTTP client. On 2026-11-20 a plain
`curl/8.5.0` request to the Financial Statements page returned **HTTP 403** (`text/html`, 5,685 bytes)
and the PDF URL returned **HTTP 403** (`text/html`, 5,853 bytes, the "Just a moment..." challenge).
That is an access block, not proof of absence.

The ingest path therefore uses the established headless Chromium browser path
(`scripts/wagga-wagga-gpfs-browser.ts`): the browser loads the official Financial Statements page, the
connector discovers the FY2025-26 audited-FS link from the cleared HTML (never hard-coded — the real
anchor text is "2025-2026 Audited Financial Statements 5.6 MB Download"), the browser fetches the
exact bytes, and the connector SHA-256 verifies and re-archives them. The browser path was exercised
live on 2026-11-20 and discovered the URL above, returning **5,880,591** bytes. A plain-fetch path and
the documented official pin remain as fallbacks.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`wagga-wagga-gpfs/Annual-Financial-Statements-2025-26.pdf`:

- URL: `https://wagga.nsw.gov.au/imagesfiles/documents/the-council/planning-and-reporting/financial-statements/Annual-Financial-Statements-2025-26.pdf`
- retrieval date: 2026-11-20
- bytes: **5,880,591**
- SHA-256: `c6c8c61dc33bc1524368da75492338d2fbee2629f98ad80986463ebf3b8125eb`
- content type: `application/pdf`
- pages: **117**
- abstract archive path: `~/ausspend-source-archive/wagga-wagga-gpfs/Annual-Financial-Statements-2025-26.pdf`
  (hash_verified: true)

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit is
`$ '000`; a missing or conflicting unit is rejected rather than defaulted.

| Check                                                                                                                                                                                 | Printed / derived                              | Result                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Total income from continuing operations                                                                                                                                               | `229,411`                                      | printed                                         |
| Revenue components (rates `86,929` + user charges `40,403` + other revenues `3,892` + operating grants `22,194` + capital grants `60,455` + interest `13,151` + other income `2,387`) | `229,411`                                      | = printed total                                 |
| Expense components (employee `58,498` + materials `50,808` + borrowing `2,876` + other `2,521` + net loss on disposal `5,104`)                                                        | `119,807`                                      | = printed expenses excluding depreciation       |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`54,595`)                                                                                     | `119,807` + `54,595` = `174,402`               | = total expenses bridge                         |
| Total income − total expenses                                                                                                                                                         | `229,411` − `174,402` = `55,009`               | = printed net result                            |
| Net result − capital grants                                                                                                                                                           | `55,009` − `60,455` = `(5,446)`                | = printed before-capital result (evidence only) |
| B1-1 expenses                                                                                                                                                                         | `174,402`                                      | = face expense bridge                           |
| B1-1 income (includes grants and contributions)                                                                                                                                       | `229,411`                                      | = face total income                             |
| B1-1 income − B1-1 expenses                                                                                                                                                           | `229,411` − `174,402` = `55,009`               | = printed B1-1 operating result = net result    |
| B1-1 grants and contributions                                                                                                                                                         | `82,649`                                       | = operating `22,194` + capital `60,455`         |
| B1-1 carrying amount of assets                                                                                                                                                        | `2,890,454`                                    | = printed total assets                          |
| Statement of Comprehensive Income net result                                                                                                                                          | `55,009`                                       | = Income Statement net result                   |
| Other comprehensive income (revaluation) and total comprehensive income                                                                                                               | `118,720` and `55,009` + `118,720` = `173,729` | = printed OCI and printed total                 |
| Statement of Financial Position: current assets `226,251` + non-current assets `2,664,203`                                                                                            | `2,890,454`                                    | = total assets                                  |
| Current liabilities `113,059` + non-current liabilities `38,814`                                                                                                                      | `151,873`                                      | = total liabilities                             |
| Total assets − total liabilities                                                                                                                                                      | `2,890,454` − `151,873` = `2,738,581`          | = net assets                                    |
| Accumulated surplus `1,169,731` + IPPE revaluation surplus `1,568,850`; Council equity interest and total equity                                                                      | `2,738,581`                                    | = net assets = total equity                     |
| Statement of Changes in Equity: opening `2,564,852` + total comprehensive income `173,729`                                                                                            | `2,738,581`                                    | = closing equity = SoFP total equity            |
| Statement of Cash Flows: operating `92,876` + investing `(56,245)` + financing `(3,678)`                                                                                              | `32,953`                                       | = net change in cash                            |
| Opening cash `93,747` + net change `32,953`                                                                                                                                           | `126,700`                                      | = closing cash = SoFP cash                      |

Wagga Wagga prints "Net loss from the disposal of assets" as an **expense** component of the printed
expenses-excluding-depreciation subtotal (not as revenue), so it is emitted as an expense row. The
printed before-capital result is retained in reconciliation evidence only, never emitted.

## 5. Extracted entity rows (17)

Source id `wagga-wagga-gpfs`, `source_dataset` "Wagga Wagga City Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Wagga Wagga City Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`,
`aggregation_role: "agency_detail"`.

| #   | `gpfs_line_item`                        | Section  |   $'000 |      AUD cents |
| --- | --------------------------------------- | -------- | ------: | -------------: |
| 1   | `rates_and_annual_charges`              | revenue  |  86,929 |  8,692,900,000 |
| 2   | `user_charges_and_fees`                 | revenue  |  40,403 |  4,040,300,000 |
| 3   | `other_revenues`                        | revenue  |   3,892 |    389,200,000 |
| 4   | `government_grants_operating`           | revenue  |  22,194 |  2,219,400,000 |
| 5   | `government_grants_capital`             | revenue  |  60,455 |  6,045,500,000 |
| 6   | `interest_and_investment_income`        | revenue  |  13,151 |  1,315,100,000 |
| 7   | `other_income`                          | revenue  |   2,387 |    238,700,000 |
| 8   | `total_revenue`                         | revenue  | 229,411 | 22,941,100,000 |
| 9   | `employee_expenses`                     | expenses |  58,498 |  5,849,800,000 |
| 10  | `materials_and_services`                | expenses |  50,808 |  5,080,800,000 |
| 11  | `borrowing_costs`                       | expenses |   2,876 |    287,600,000 |
| 12  | `other_expenses`                        | expenses |   2,521 |    252,100,000 |
| 13  | `net_loss_from_disposal_of_assets`      | expenses |   5,104 |    510,400,000 |
| 14  | `total_expenses_excluding_depreciation` | expenses | 119,807 | 11,980,700,000 |
| 15  | `depreciation_amortisation_impairment`  | expenses |  54,595 |  5,459,500,000 |
| 16  | `total_expenses`                        | expenses | 174,402 | 17,440,200,000 |
| 17  | `net_result`                            | result   |  55,009 |  5,500,900,000 |

The before-capital result, the B1-1 function split, the balance-sheet components and the cash-flow
lines are used only for the reconciliation checks and are not emitted as rows.

## 6. No-total / no-cross-council rule

- Wagga Wagga City Council is one entity. No council total, no state/national total and no sum with
  another council, a government program, the PNFC benchmark or the OLG summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- The pre-existing same-entity rows (e.g. AusTender contracts naming Wagga Wagga) are preserved
  untouched and never summed.

## 7. How to verify

```bash
# Plain fetch is blocked by the Cloudflare challenge (403), so use the browser path.
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://wagga.nsw.gov.au/the-council/planning-and-reporting/community-reporting/financial-statements'

# Browser/WAF path (headless Chromium) then the focused connector tests.
npx tsx scripts/wagga-wagga-gpfs-browser.ts
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_waggawagga" \
  npx vitest run --project server server/test/wagga-wagga-gpfs.test.ts
```

The focused suite covers audited-FS discovery/latest selection (retaining older years), prior-year and
future-year rejection, the browser/Cloudflare path, the printed-unit gate, the B1-1 income/grants
bridge, exact reconciliation, natural-key stability, and additive-only idempotent 17-row ingestion.
