# Warrumbungle Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `warrumbungle-gpfs` (NSW local government). One council only; entity-level rows, no
council total and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available as audited standalone statements)

The work-item title said FY2024-25. The official Publications page was checked on 2026-11-19:
the newest published audited standalone **Annual Financial Statements** are **FY2024-25**. The
2025-26/2026-27 documents that are listed are the **Annual Report 2024-2025**, delivery-program
progress reports, operational plans, fees and charges and planning documents — not audited
standalone financial statements. A public notice about the presentation of the 2025/26 financial
statements was also observed, but it yielded no audited FY2025-26 standalone statements PDF that
downloads. This connector therefore targets **FY2024-25** and never substitutes a 2025-26/2023-24
document, the narrative annual report, the SPFS or the special schedules. A 404/JS-only 2025-26
link is recorded as a gap, not a reason to fabricate.

## 1. Source and year

- Publisher: **Warrumbungle Shire Council**.
- Document: standalone audited **Annual Financial Statements for the year ended 30 June 2025** —
  FY2024-25. The 106-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- Official page:
  <https://www.warrumbungle.nsw.gov.au/Our-Council/Publications-Reports-Fees/Publications>.
- Current exact PDF:
  <https://www.warrumbungle.nsw.gov.au/files/assets/public/v/3/our-council/publications-amp-reports/annual-financial-statements-2024-2025.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to bare curl, with a browser
fetch required. In this retrieval run (2026-11-19) **both the Publications page and the PDF
returned `200`** to `curl/8.5.0` (PDF `application/pdf`, 3,318,554 bytes), so no browser fetch was
needed for the live ingest. The connector still sends an explicit plain `curl/8.5.0` UA (plus a
broad PDF/HTML `Accept`) and falls back to the documented official pin if the page is challenged or
yields no usable anchor; a focused test simulates a `403` listing and asserts the pin fallback.
`scripts/warrumbungle-gpfs-browser.ts` is the documented headless-Chromium fallback for a challenged
run: it loads the official page, parses the link from the cleared HTML and fetches the exact bytes
same-origin. No unofficial mirror was used.

The parser accepts direct `.pdf` uploads whose label or file name contains "Financial Statements"
and rejects the narrative annual report, SPFS/special schedules, public notices, policies and
mirrors. The fiscal year is derived from the anchor label and file name
(`annual-financial-statements-2024-2025.pdf` → FY2024-25), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`warrumbungle-gpfs/annual-financial-statements-2024-2025.pdf`:

- URL: `https://www.warrumbungle.nsw.gov.au/files/assets/public/v/3/our-council/publications-amp-reports/annual-financial-statements-2024-2025.pdf`
- retrieval date: 2026-11-19
- bytes: **3,318,554**
- SHA-256: `1b22e9c46df2037c0d234b0f99fe45d0bb650784756d24d777485c27e9bc25d4`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 52,543 | = 5,254,300,000 cents |
| Revenue components sum (rates 16,270 + user charges 8,839 + other revenues 1,624 + operating grants 17,197 + capital grants 5,829 + interest 2,731 + other income 53; 2025 net gain on disposal nil) | 52,543 | = printed total |
| Expense components sum (employee 17,647 + materials 16,354 + borrowing 125 + other 1,756 + net loss on disposal 5,211) | 41,093 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 14,305 | 55,398 | = total expenses |
| B1-1 Total functions and activities — income | 52,543 | = face total revenue |
| B1-1 Total functions and activities — expenses | 55,398 | = face expense bridge |
| B1-1 Total functions and activities — operating result | (2,855) | = face net result |
| B1-1 grants and contributions | 23,026 | = operating 17,197 + capital 5,829 |
| Total revenue − total expenses | 52,543 − 55,398 = (2,855) | = printed net result (negative) |
| Net result − capital grants | (2,855) − 5,829 = (8,684) | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | (2,855) | = Income Statement net result |
| Other comprehensive income (revaluation 30,817 + 2025 nil impairment/revaluation reversal) | 30,817 | = printed other comprehensive income |
| Net result + other comprehensive income | (2,855) + 30,817 = 27,962 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (41,093) plus the printed
depreciation/amortisation/impairment line (14,305) = 55,398, which equals the printed B1-1 expense
total. The council prints a real net **loss** on disposal of assets (5,211), emitted as an expense
row; the 2025 net gain on disposal is nil and is not emitted. The net result is negative (−2,855)
and is stored with a printed-sign marker; the before-capital result is more negative (−8,684) and
is retained in reconciliation evidence only. Other comprehensive income prints a 2025 revaluation
of 30,817 and a **nil** impairment/revaluation reversal. The 2024 comparative (667) must never be
read as the current year; the parser reads the 2025 nil cell explicitly, and a test proves that
turning it into a non-nil 2025 value fails reconciliation.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing,
the unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no
deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 16,270 | 1,627,000,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 8,839 | 883,900,000 | revenue |
| `other_revenue` | Other revenues | 1,624 | 162,400,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 17,197 | 1,719,700,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 5,829 | 582,900,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 2,731 | 273,100,000 | revenue |
| `other_income` | Other income | 53 | 5,300,000 | revenue |
| `total_revenue` | Total income from continuing operations | 52,543 | 5,254,300,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 17,647 | 1,764,700,000 | expenses |
| `materials_and_services` | Materials and services | 16,354 | 1,635,400,000 | expenses |
| `borrowing_costs` | Borrowing costs | 125 | 12,500,000 | expenses |
| `other_expenses` | Other expenses | 1,756 | 175,600,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 5,211 | 521,100,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 41,093 | 4,109,300,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 14,305 | 1,430,500,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 55,398 | 5,539,800,000 | expenses |
| `net_result` | Net operating result attributable to Council | (2,855) | 285,500,000 (printed negative) | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Warrumbungle Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The net-result row carries
`gpfs_printed_sign: "negative"`.

## 6. No-total / no-cross-council rule

- Warrumbungle Shire Council is one entity. No council total, no state/national total and no sum
  with another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `warrumbungle-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,336 → 999,353** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1818 → 1835**;
- active GPFS `data_sources` **97 → 98**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Warrumbungle Shire Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate
  row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`warrumbungle-gpfs/annual-financial-statements-2024-2025.pdf` with the SHA-256 above; no PDF is
committed.

## 8. How to verify

```bash
# Official page and exact FY2024-25 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.warrumbungle.nsw.gov.au/Our-Council/Publications-Reports-Fees/Publications'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.warrumbungle.nsw.gov.au/files/assets/public/v/3/our-council/publications-amp-reports/annual-financial-statements-2024-2025.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_warrumbunglegpfs" \
  npx vitest run --project server server/test/warrumbungle-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
net result, the before-capital result, the net loss on disposal, the nil 2025 impairment and the
2024 comparative guard), FY2024-25 acceptance and rejection of 2025-26/2023-24 documents,
natural-key/idempotency, no-cross-council totals, discovery/latest selection (annual report,
prior-year and mirror rejection), the `403`→documented-pin WAF fallback and the plain-UA header.
