# Carrathool Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `carrathool-gpfs` (NSW local government). One council only; entity-level rows, no council
aggregate and no cross-council or state/federal addition.

**Status: landed — 16 statement rows from the official audited Annual Financial Statements for the
year ended 30 June 2026.** The cheap check ("annual-report page/sitemap expose nothing newer than
2023-24") is **confirmed for the narrative annual-report page, but falsified for the financial
statements**: the council publishes the current audited GPFS as WordPress media under its official
domain, discoverable from its own media REST index.

## 0. Stale-year check

Checked on **2026-11-20**. The official annual-report page
<https://carrathool.nsw.gov.au/about-council/publications/annual-report> and the WordPress page
sitemap (<https://carrathool.nsw.gov.au/page-sitemap.xml>) expose annual reports only up to the
combined **FY2023-24** narrative report (`Combined-Master-Annual-Report-2023-2024.pdf`). No
FY2024-25 or FY2025-26 narrative report is linked there as at 2026-11-20. A broader official media
search does find a FY2024-25 narrative report
(`https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Master-Annual-Report-2024-2025.pdf`)
and a **draft** FY2025-26 narrative report published 2026-11-12
(`https://carrathool.nsw.gov.au/wp-content/uploads/Agendas-Minutes/Separately-Circulated/2026-November/Draft-Annual-Report-25-2026.pdf`);
neither is the audited financial statements and neither is ingested. The audited GPFS is published
standalone, as listed next.

The council's official media index
(<https://carrathool.nsw.gov.au/wp-json/wp/v2/media?search=annual%20financial%20statements&per_page=100>)
returns four matching attachments:

- **FY2025-26 (current, ingested)** — `Carrathool-Shire-Annual-Financial-Statements-25-26.pdf`,
  published 2026-10-06 in Public Exhibition and 2026-10-15 in Agendas-Minutes (identical bytes).
- an advertisement for the FY2025-26 statements — not a statement, **not ingested**.
- FY2024-25 — `Carrathool-Shire-Annual_Financial_Statements-2025.pdf` (published 2025-11-03). Its
  filename carries only a bare year, so it is **not** selected for any fiscal year; the prior year
  is **not ingested**.
- planning-agreement/contribution statements also match a broad media search; they are excluded by
  name and are **not** GPFS.

The FY2025-26 GPFS is authorised for issue by Council on **15 September 2026** and embeds the signed,
**unmodified** Auditor-General opinions for the GPFS and special purpose statements, dated
**30 September 2026** (Chris Harper, Director, Financial Audit, delegate of the Auditor-General for
New South Wales). No FY2026-27 statements were published as at 2026-11-20.

## 1. Source and year

- Publisher: **Carrathool Shire Council**.
- Document: **Annual Financial Statements for the year ended 30 June 2026** — FY2025-26. The PDF is
  **5,397,495 bytes**, **114 physical pages**, and contains the GPFS (Income Statement PDF p6,
  Statement of Comprehensive Income p7, Statement of Financial Position p8, Statement of Changes in
  Equity p9, Statement of Cash Flows p10, B1-1 functions PDF p16), the notes, the special purpose
  financial statements and the special schedules, with the signed audit reports.
- Reporting page (human-facing): <https://carrathool.nsw.gov.au/about-council/publications/annual-report>.
- Discovery index (official media REST): <https://carrathool.nsw.gov.au/wp-json/wp/v2/media?search=annual%20financial%20statements&per_page=100>.
- Exact GPFS PDF:
  <https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf>.
  The same bytes are also at
  <https://carrathool.nsw.gov.au/wp-content/uploads/Agendas-Minutes/Separately-Circulated/2026-October/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf>.
  The Public Exhibition URL is the documented fallback pin.

## 2. Access, discovery and fetch

On 2026-11-20 the official annual-report page, media index and PDF all returned HTTP 200 to a plain
`curl/8.5.0` client. The site is not behind a WAF. Headless Chromium also reached the annual-report
page, fetched the media index and fetched the PDF.

| Client                                        | Annual-report page | Media index                  | PDF                                          |
| --------------------------------------------- | ------------------ | ---------------------------- | -------------------------------------------- |
| `curl -sSL` (`curl/8.5.0` UA)                 | HTTP 200, HTML     | HTTP 200, `application/json` | HTTP 200, `application/pdf`, 5,397,495 bytes |
| Headless Chromium (Playwright, Chrome 131 UA) | HTTP 200           | HTTP 200                     | HTTP 200 (browser fetch)                     |

The `scripts/carrathool-gpfs-browser.ts` helper tries headless Chromium first and falls back to the
plain client; both discover the FS from the official media index (never a mirror or invented URL) and
the connector SHA-256 verifies and re-archives the exact bytes. The connector also verifies the
printed `$ '000` unit and rejects a missing or conflicting unit rather than defaulting it.

The site's `robots.txt` disallows generic crawlers under `/wp-content/uploads/` and `/assets/`; this
adapter does not crawl or mirror the tree. It reads one official media-search response and the one
official document it names, which is the council's own publication of its audited statements.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, at the relative archive path
`carrathool-gpfs/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf`:

- URL: `https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf`
- retrieval date: 2026-11-20
- bytes: **5,397,495**
- SHA-256: `cf6c36b1c5fdeb5b95f21a4c2bac45a7b7715b38fa71cd8d5aa602ce11757ec4`
- content type: `application/pdf`
- pages: **114**
- abstract archive path:
  `~/ausspend-source-archive/carrathool-gpfs/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf`
  (hash_verified: true)

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation ($'000, zero tolerance)

The connector emits nothing unless every printed subtotal and result bridge agrees. The printed unit
is `$ '000`; a missing or conflicting unit is rejected rather than defaulted.

| Check                                                                                                                                                   | Printed / derived               | Result                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------- |
| Total income from continuing operations                                                                                                                 | `36,029`                        | printed                                         |
| Revenue components (rates `6,826` + user charges `3,310` + other revenue `524` + operating grants `21,467` + capital grants `1,953` + interest `1,949`) | `36,029`                        | = printed total                                 |
| Expense components (employee `9,413` + materials `4,564` + borrowing `62` + other `456` + net loss on disposal `877`)                                   | `15,372`                        | = printed expenses excluding depreciation       |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment (`6,549`)                                                        | `15,372` + `6,549` = `21,921`   | = total expenses bridge                         |
| Total income − total expenses                                                                                                                           | `36,029` − `21,921` = `14,108`  | = printed net result                            |
| Net result − capital grants                                                                                                                             | `14,108` − `1,953` = `12,155`   | = printed before-capital result (evidence only) |
| B1-1 expenses                                                                                                                                           | `21,921`                        | = face expense bridge                           |
| B1-1 income (includes grants and contributions)                                                                                                         | `36,029`                        | = face total income                             |
| B1-1 income − B1-1 expenses                                                                                                                             | `36,029` − `21,921` = `14,108`  | = printed B1-1 operating result = net result    |
| B1-1 grants and contributions                                                                                                                           | `23,420`                        | = operating `21,467` + capital `1,953`          |
| B1-1 carrying amount of assets                                                                                                                          | `392,865`                       | = printed total assets                          |
| Statement of Comprehensive Income net result                                                                                                            | `14,108`                        | = Income Statement net result                   |
| Other comprehensive income (revaluation `22,823` + other movements `3`)                                                                                 | `22,826`                        | = printed other comprehensive income            |
| Total comprehensive income attributable to Council                                                                                                      | `14,108` + `22,826` = `36,934`  | = printed total                                 |
| Statement of Financial Position: current assets `56,053` + non-current assets `336,812`                                                                 | `392,865`                       | = total assets                                  |
| Current liabilities `4,360` + non-current liabilities `4,335`                                                                                           | `8,695`                         | = total liabilities                             |
| Total assets − total liabilities                                                                                                                        | `392,865` − `8,695` = `384,170` | = net assets                                    |
| Accumulated surplus `185,729` + IPPE revaluation surplus `198,441`; Council equity interest and total equity                                            | `384,170`                       | = net assets = total equity                     |
| Statement of Changes in Equity: opening `347,236` + total comprehensive income `36,934`                                                                 | `384,170`                       | = closing equity = SoFP total equity            |
| Opening accumulated surplus `171,618` + net result `14,108` + rounding `3`                                                                              | `185,729`                       | = closing accumulated surplus                   |
| Statement of Cash Flows: operating `21,879` + investing `(18,304)` + financing `(332)`                                                                  | `3,243`                         | = net change in cash                            |
| Opening cash `34,717` + net change `3,243`                                                                                                              | `37,960`                        | = closing cash = SoFP cash                      |
| SoFP prior-year cash column `34,717`                                                                                                                    | `34,717`                        | = printed cash-flow opening cash                |

The printed "Net loss from the disposal of assets" (`877`) is a real expense component and is
emitted. The printed before-capital result `12,155` and the operating result excluding depreciation
`20,657` are retained in reconciliation evidence only, never emitted.

## 5. Extracted entity rows (16)

Source id `carrathool-gpfs`, `source_dataset` "Carrathool Shire Council GPFS 2025-26",
`measure_type: "actual"`, `fiscal_year: "2025-26"`, `jurisdiction_level: "local"`,
`jurisdiction: "NSW"`, `delivery_entity: "Carrathool Shire Council"`, `data_quality_flag:
"provisional/local_government"`, `verified: false`, `aggregation_role: "agency_detail"`.

| #   | `gpfs_line_item`                        | Section  |  $'000 |     AUD cents |
| --- | --------------------------------------- | -------- | -----: | ------------: |
| 1   | `rates_and_annual_charges`              | revenue  |  6,826 |   682,600,000 |
| 2   | `user_charges_and_fees`                 | revenue  |  3,310 |   331,000,000 |
| 3   | `other_revenues`                        | revenue  |    524 |    52,400,000 |
| 4   | `government_grants_operating`           | revenue  | 21,467 | 2,146,700,000 |
| 5   | `government_grants_capital`             | revenue  |  1,953 |   195,300,000 |
| 6   | `interest_and_investment_income`        | revenue  |  1,949 |   194,900,000 |
| 7   | `total_revenue`                         | revenue  | 36,029 | 3,602,900,000 |
| 8   | `employee_expenses`                     | expenses |  9,413 |   941,300,000 |
| 9   | `materials_and_services`                | expenses |  4,564 |   456,400,000 |
| 10  | `borrowing_costs`                       | expenses |     62 |     6,200,000 |
| 11  | `other_expenses`                        | expenses |    456 |    45,600,000 |
| 12  | `net_loss_from_disposal_of_assets`      | expenses |    877 |    87,700,000 |
| 13  | `total_expenses_excluding_depreciation` | expenses | 15,372 | 1,537,200,000 |
| 14  | `depreciation_amortisation_impairment`  | expenses |  6,549 |   654,900,000 |
| 15  | `total_expenses`                        | expenses | 21,921 | 2,192,100,000 |
| 16  | `net_result`                            | result   | 14,108 | 1,410,800,000 |

The before-capital result, the B1-1 function split, the balance-sheet components and the cash-flow
lines are used only for the reconciliation checks and are not emitted as rows.

## 6. No-total / no-cross-council rule

- Carrathool Shire Council is one entity. No council aggregate, no state/national total and no sum
  with another council, a government program, the PNFC benchmark or the OLG summary layer is created.
- Every row is `aggregation_role: "agency_detail"` with no `region_id` and no `location`/LGA
  allocation, so the generic additive API cannot sum it into another council or state row.
- Government grant rows carry `potential_double_count: true` because they may overlap government
  program data; they are not added to expenditure.
- Pre-existing same-entity rows (e.g. AusTender contracts naming Carrathool Shire) are preserved
  untouched and never summed.

## 7. How to verify

```bash
# Exact PDF: HTTP 200, application/pdf, 5,397,495 bytes on 2026-11-20.
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://carrathool.nsw.gov.au/wp-content/uploads/Public-Exhibition/Carrathool-Shire-Annual-Financial-Statements-25-26.pdf'

# Browser helper (headless Chromium first, then plain fallback).
npx tsx scripts/carrathool-gpfs-browser.ts

# Focused connector tests.
TEST_MONGO_URL="mongodb://127.0.0.1:27118/ausspend_test_carrathool" \
  npx vitest run --project server server/test/carrathool-gpfs.test.ts
```

The focused suite covers official media-index discovery/current-year selection, Public Exhibition
preference, prior-year/future-year rejection, bare-year exclusion, planning-agreement/advertisement
exclusion, the browser path with its plain fallback, the printed-unit gate, a unit-conflict
rejection, a broken-subtotal rejection, the B1-1 income/grants bridge, exact reconciliation,
natural-key stability, the no-total rule, and additive-only idempotent 16-row ingestion.
