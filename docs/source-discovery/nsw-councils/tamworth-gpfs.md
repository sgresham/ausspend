# Tamworth Regional Council — General Purpose Financial Statements (FY2025-26)

Source id `tamworth-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: landed — 17 statement rows from the official standalone audited Annual Financial Statements
for the year ended 30 June 2026.** The official Financial Reporting page publishes the audited GPFS as
its own PDF (with the independent auditor's report), so there is no annual-report-only step for this
council and no older report is substituted.

## 0. Stale-year check

The work item was opened on 2026-11-19. The official **Financial Reporting** page was checked on
2026-11-20 and lists the current audited publication first, followed by older years:

- 2025/26: "Annual Financial Statements - 2026.pdf.aspx"
- 2024/25: "Tamworth Regional Council - Annual Financial Statements - 2024-25.pdf.aspx"
- 2023/24: "Tamworth Regional Council - Financial Statements -2023-24.pdf.aspx"
- 2022/23, 2021/22, 2020/21, 2019/20, 2018/19 and older.

The FY2025-26 statements are for the year ended 30 June 2026 and were authorised for issue by Council
on 22 September 2026 (Basis of preparation, PDF p12). They are the latest published audited FS, so
FY2025-26 is the current year and is ingested. A later-year link that 404s or is JS-only is recorded as
a gap, not a reason to fabricate a document.

## 1. Source and year

- Publisher: **Tamworth Regional Council**.
- Document: **Annual Financial Statements for the year ended 30 June 2026** — FY2025-26. The PDF is
  **5,608,740 bytes**, **120 physical pages**, and contains the GPFS (Income Statement p5, Statement of
  Comprehensive Income p6, Statement of Financial Position p7, Statement of Changes in Equity p8,
  Statement of Cash Flows p9, B1-1 functions p14), the notes, the independent auditor's report
  (p83) and the special purpose financial statements/schedules for the water, sewer, airport, waste
  and pilot-training activities (not ingested).
- Discovery page:
  <https://www.tamworth.nsw.gov.au/about/reports-and-registers/financial-reporting>.
- Exact audited PDF:
  <https://www.tamworth.nsw.gov.au/ArticleDocuments/226/Annual%20Financial%20Statements%20-%202026.pdf.aspx>.
  The same URL is the documented official fallback pin.

## 2. Access, discovery and fetch

The item brief recorded that the official PDF was 403 to a plain fetch and needed a browser session.
On 2026-11-20 the **opposite** was observed for this host:

| Client | Reporting page | PDF |
| --- | --- | --- |
| `curl -sSL` (default / `curl/8.5.0` UA) | HTTP 200, 91,299 bytes HTML | HTTP 200, `application/pdf`, 5,608,740 bytes |
| Node `fetch` with no UA or `curl/8.5.0` | HTTP 200, 91,299 bytes | — |
| Node `fetch` with a Chrome UA | HTTP 403, 2,828-byte WAF page | — |
| Headless Chromium (Playwright, Chrome 131 UA) | HTTP 403, "Oops… Error 403" | — |

That is an access quirk (the WAF rejects browser-looking agents), not proof of absence. The
`scripts/tamworth-gpfs-browser.ts` helper therefore tries the documented headless-Chromium path first
and, on the observed 403, falls back to the plain client. Both paths discover the audited-FS link from
the official page (never hard-coded) and the connector SHA-256 verifies and re-archives the exact
bytes. The helper was exercised live on 2026-11-20: browser 403 → plain fallback → discovered the URL
above and returned **5,608,740** bytes.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`tamworth-gpfs/Annual-Financial-Statements---2026.pdf.aspx`:

- URL: `https://www.tamworth.nsw.gov.au/ArticleDocuments/226/Annual%20Financial%20Statements%20-%202026.pdf.aspx`
- retrieval date: 2026-11-20
- bytes: **5,608,740**
- SHA-256: `03bf66f0cc18f7b8197b06e66fc9e994bd343f739da6d02ba2a6ee8e58c01408`
- content type: `application/pdf`
- pages: **120**
- abstract archive path: `~/ausspend-source-archive/tamworth-gpfs/Annual-Financial-Statements---2026.pdf.aspx`
  (hash_verified: true)

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit is
`$ '000`; a missing or conflicting unit is rejected rather than defaulted.

| Check | Printed / derived | Result |
| --- | --- | --- |
| Total income from continuing operations | `252,467` | printed |
| Revenue components (rates `103,547` + user charges `63,287` + other revenue `4,076` + operating grants `28,602` + capital grants `35,752` + interest `10,753` + other income `6,450`) | `252,467` | = printed total |
| Expense components (employee `71,729` + materials `84,009` + borrowing `3,586` + other `5,146` + net loss on disposal `7,321`) | `171,791` | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`59,434`) | `171,791` + `59,434` = `231,225` | = total expenses bridge |
| Total income − total expenses | `252,467` − `231,225` = `21,242` | = printed net result |
| Net result − capital grants | `21,242` − `35,752` = `(14,510)` | = printed before-capital result (evidence only) |
| B1-1 expenses | `231,225` | = face expense bridge |
| B1-1 income (includes grants and contributions) | `252,467` | = face total income |
| B1-1 income − B1-1 expenses | `252,467` − `231,225` = `21,242` | = printed B1-1 operating result = net result |
| B1-1 grants and contributions | `64,354` | = operating `28,602` + capital `35,752` |
| B1-1 carrying amount of assets | `3,329,395` | = printed total assets |
| Statement of Comprehensive Income net result | `21,242` | = Income Statement net result |
| Other comprehensive income (revaluation `303,738`) | `303,738` | = printed other comprehensive income |
| Total comprehensive income | `21,242` + `303,738` = `324,980` | = printed total; Council `325,049` + NCI `(69)` |
| Statement of Financial Position: current assets `304,921` + non-current assets `3,024,474` | `3,329,395` | = total assets |
| Current liabilities `73,045` + non-current liabilities `84,701` | `157,746` | = total liabilities |
| Total assets − total liabilities | `3,329,395` − `157,746` = `3,171,649` | = net assets |
| Accumulated surplus `1,519,266` + IPPE revaluation surplus `1,651,735` = Council equity `3,171,001`; + NCI `648` | `3,171,649` | = net assets = total equity |
| Statement of Changes in Equity: opening `2,846,669` + total comprehensive income `324,980` | `3,171,649` | = closing equity = SoFP total equity |
| Statement of Cash Flows: operating `106,767` + investing `(97,369)` + financing `(2,974)` | `6,424` | = net change in cash |
| Opening cash `22,103` + net change `6,424` | `28,527` | = closing cash = SoFP cash |

Tamworth prints "Net loss from the disposal of assets" as an **expense** component of the printed
expenses-excluding-depreciation subtotal (not as revenue), so it is emitted as an expense row. The
printed before-capital result is retained in reconciliation evidence only, never emitted.

## 5. Extracted entity rows (17)

Source id `tamworth-gpfs`, `source_dataset` "Tamworth Regional Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Tamworth Regional Council"`,
`data_quality_flag: "provisional/local_government"`, `verified: false`,
`aggregation_role: "agency_detail"`.

| # | `gpfs_line_item` | Section | $'000 | AUD cents |
| --- | --- | --- | ---: | ---: |
| 1 | `rates_and_annual_charges` | revenue | 103,547 | 10,354,700,000 |
| 2 | `user_charges_and_fees` | revenue | 63,287 | 6,328,700,000 |
| 3 | `other_revenues` | revenue | 4,076 | 407,600,000 |
| 4 | `government_grants_operating` | revenue | 28,602 | 2,860,200,000 |
| 5 | `government_grants_capital` | revenue | 35,752 | 3,575,200,000 |
| 6 | `interest_and_investment_income` | revenue | 10,753 | 1,075,300,000 |
| 7 | `other_income` | revenue | 6,450 | 645,000,000 |
| 8 | `total_revenue` | revenue | 252,467 | 25,246,700,000 |
| 9 | `employee_expenses` | expenses | 71,729 | 7,172,900,000 |
| 10 | `materials_and_services` | expenses | 84,009 | 8,400,900,000 |
| 11 | `borrowing_costs` | expenses | 3,586 | 358,600,000 |
| 12 | `other_expenses` | expenses | 5,146 | 514,600,000 |
| 13 | `net_loss_from_disposal_of_assets` | expenses | 7,321 | 732,100,000 |
| 14 | `total_expenses_excluding_depreciation` | expenses | 171,791 | 17,179,100,000 |
| 15 | `depreciation_amortisation_impairment` | expenses | 59,434 | 5,943,400,000 |
| 16 | `total_expenses` | expenses | 231,225 | 23,122,500,000 |
| 17 | `net_result` | result | 21,242 | 2,124,200,000 |

The before-capital result, the B1-1 function split, the balance-sheet components and the cash-flow
lines are used only for the reconciliation checks and are not emitted as rows.

## 6. No-total / no-cross-council rule

- Tamworth Regional Council is one entity. No council total, no state/national total and no sum with
  another council, a government program, the PNFC benchmark or the OLG summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- The pre-existing same-entity rows (e.g. AusTender contracts naming Tamworth) are preserved
  untouched and never summed.

## 7. How to verify

```bash
# The host returns 200 to a plain curl UA and 403 to headless Chromium on 2026-11-20.
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.tamworth.nsw.gov.au/ArticleDocuments/226/Annual%20Financial%20Statements%20-%202026.pdf.aspx'

# WAF-aware helper: tries headless Chromium, then the plain fallback.
npx tsx scripts/tamworth-gpfs-browser.ts

# Focused connector tests.
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_tamworth" \
  npx vitest run --project server server/test/tamworth-gpfs.test.ts
```

The focused suite covers audited-FS discovery/latest selection (retaining older years), prior-year and
future-year rejection, the browser/WAF path with its plain fallback, the printed-unit gate, a broken-
subtotal rejection, the B1-1 income/grants bridge, exact reconciliation, natural-key stability, and
additive-only idempotent 17-row ingestion.
