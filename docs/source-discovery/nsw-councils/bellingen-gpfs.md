# Bellingen Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `bellingen-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year correction (FY2024-25 → FY2025-26)

The work-item title said FY2024-25, but the group-D inventory noted that Bellingen publishes both
FY2024-25 and FY2025-26. The official page confirms a **FY2025-26** standalone PDF
(`.../ar-2025-26/annual-financial-statements-2026.pdf`, year ended 30 June 2026). This connector
therefore targets **FY2025-26**. No FY2024-25 rows were ever ingested, so there were no prior-year
rows to delete. The group-D inventory and README are corrected to FY2025-26.

## 1. Source and year

- Publisher: **Bellingen Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2026** — FY2025-26. The 98-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- FY2025-26 is the **current audited year**. The connector targets `2025-26` only and never
  substitutes the prior-year (2024-25 or 2023-24) document, the narrative annual report, the SPFS or
  the special schedules. A link whose label or file name maps to any other fiscal year is rejected;
  the FY2024-25 and FY2026-27 cases are covered by focused tests.
- Official page:
  <https://www.bellingen.nsw.gov.au/Your-Council/Our-Plan-for-the-Future/Our-reporting-process/Annual-Reports-and-Financial-Statements>.
- Current exact PDF:
  <https://www.bellingen.nsw.gov.au/files/sharedassets/public/v/1/files/annual-reports/ar-2025-26/annual-financial-statements-2026.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to plain curl, with the PDF
reachable in headless Chromium. In this retrieval run (2026-11-19) **both the listing page and the PDF
returned `200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an
explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented
official pin if the page is challenged or yields no usable anchor; a focused test simulates a `403`
listing and asserts the pin fallback. No unofficial mirror was used.

The official page lists the FY2025-26 and FY2024-25 financial statements plus annual reports and
community snapshots. The parser accepts direct `.pdf` uploads whose label or file name contains
"Financial Statements" and rejects the narrative annual report, SPFS/special schedules, public
notices, policies and mirrors. The fiscal year is derived from the anchor label and file name
(`annual-financial-statements-2026.pdf` → FY2025-26), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path `bellingen-gpfs/annual-financial-statements-2026.pdf`:

- URL: `https://www.bellingen.nsw.gov.au/files/sharedassets/public/v/1/files/annual-reports/ar-2025-26/annual-financial-statements-2026.pdf`
- retrieval date: 2026-11-19
- bytes: **1,289,884**
- SHA-256: `265acc2086d001b6d5c0931ee216b59061865e143d96579462b34d7e66bcc702`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 81,659 | = 8,165,900,000 cents |
| Revenue components sum (rates 21,279 + user charges 20,158 + other revenues 881 + operating grants 10,223 + capital grants 26,911 + interest 2,072 + other income 135) | 81,659 | = printed total |
| Expense components sum (employee 15,423 + materials 24,521 + borrowing 1,136 + other 1,633 + net loss on disposal 680) | 43,393 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 10,456 | 53,849 | = total expenses |
| B1-1 Total functions and activities — income | 81,659 | = face total revenue |
| B1-1 Total functions and activities — expenses | 53,849 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 27,810 | = face net result |
| B1-1 grants and contributions | 37,134 | = operating 10,223 + capital 26,911 |
| Total revenue − total expenses | 81,659 − 53,849 = 27,810 | = printed net result |
| Net result − capital grants | 27,810 − 26,911 = 899 | = printed before-capital result (evidence only) |
| Comprehensive-income net result | 27,810 | = Income Statement net result |
| Other comprehensive income (revaluation 91,270) | 91,270 | = printed other comprehensive income |
| Net result + other comprehensive income | 27,810 + 91,270 = 119,080 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (43,393) plus the printed
depreciation/amortisation/impairment line (10,456) = 53,849, which equals the printed B1-1 expense
total. Bellingen prints a real net **loss** on disposal of assets (680), emitted as an expense row;
there is no net gain on disposal line. The net result and the before-capital result are both
positive; the before-capital figure is retained in reconciliation evidence only. Other comprehensive
income has a single printed component (revaluation), checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 21,279 | 2,127,900,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 20,158 | 2,015,800,000 | revenue |
| `other_revenue` | Other revenues | 881 | 88,100,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 10,223 | 1,022,300,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 26,911 | 2,691,100,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 2,072 | 207,200,000 | revenue |
| `other_income` | Other income | 135 | 13,500,000 | revenue |
| `total_revenue` | Total income from continuing operations | 81,659 | 8,165,900,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 15,423 | 1,542,300,000 | expenses |
| `materials_and_services` | Materials and services | 24,521 | 2,452,100,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,136 | 113,600,000 | expenses |
| `other_expenses` | Other expenses | 1,633 | 163,300,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 680 | 68,000,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 43,393 | 4,339,300,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 10,456 | 1,045,600,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 53,849 | 5,384,900,000 | expenses |
| `net_result` | Net operating result attributable to Council | 27,810 | 2,781,000,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Bellingen Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Bellingen Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `bellingen-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,134 → 999,151** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1616 → 1633**;
- active GPFS `data_sources` **85 → 86**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Bellingen Shire Council`), all rows `fiscal_year: "2025-26"` (no FY2024-25 rows), and no
  council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`bellingen-gpfs/annual-financial-statements-2026.pdf` with the SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official page and the exact FY2025-26 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.bellingen.nsw.gov.au/Your-Council/Our-Plan-for-the-Future/Our-reporting-process/Annual-Reports-and-Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.bellingen.nsw.gov.au/files/sharedassets/public/v/1/files/annual-reports/ar-2025-26/annual-financial-statements-2026.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_bellingengpfs" \
  npx vitest run --project server server/test/bellingen-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 acceptance
and rejection of 2024-25/2026-27 documents, natural-key/idempotency, no-cross-council totals,
discovery/latest selection (annual report, prior-year and mirror rejection), the `403`→documented-pin
WAF fallback and the plain-UA header.
