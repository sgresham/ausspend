# Parkes Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `parkes-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year correction (FY2024-25 → FY2025-26)

The work-item title said FY2024-25, but the official Audited Financial Statements page publishes both
FY2024-25 and FY2025-26. The FY2025-26 standalone PDF is
`.../files/9957d5ac-c878-4061-9eeb-43a7d5e01650/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf`
(year ended 30 June 2026). This connector therefore targets **FY2025-26**. No FY2024-25 rows were
ever ingested, so there were no prior-year rows to delete. The group-D inventory and README are
corrected to FY2025-26.

## 1. Source and year

- Publisher: **Parkes Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2026** — FY2025-26. The 94-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- FY2025-26 is the **current audited year**. The connector targets `2025-26` only and never
  substitutes the prior-year (2024-25 or 2023-24) document, the narrative annual report, the SPFS or
  the special schedules. A link whose label or file name maps to any other fiscal year is rejected;
  the FY2024-25 and FY2026-27 cases are covered by focused tests.
- Official page:
  <https://www.parkes.nsw.gov.au/Council/Strategies-policies-and-publications/Our-strategies-plans-and-reports/Audited-Financial-Statements>.
- Current exact PDF:
  <https://www.parkes.nsw.gov.au/files/9957d5ac-c878-4061-9eeb-43a7d5e01650/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to plain curl, with the PDF
reachable in headless Chromium. In this retrieval run (2026-11-19) **both the listing page and the PDF
returned `200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an
explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented
official pin if the page is challenged or yields no usable anchor; a focused test simulates a `403`
listing and asserts the pin fallback. No unofficial mirror was used.

The official page lists audited statements from FY2017-18 onwards, including the current FY2025-26
PDF. The parser accepts direct `.pdf`/`.pdf.aspx` uploads whose label or file name contains
"Financial Statements" and rejects the narrative annual report, SPFS/special schedules, public
notices, policies and mirrors. The fiscal year is derived from the anchor label and file name
(`...-YE-30-June-2026.pdf` → June year-end → FY2025-26), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`parkes-gpfs/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf`:

- URL: `https://www.parkes.nsw.gov.au/files/9957d5ac-c878-4061-9eeb-43a7d5e01650/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf`
- retrieval date: 2026-11-19
- bytes: **6,311,039**
- SHA-256: `dbd8f6a4e1228e0f418b2d94fd4350b7ef72e17867a25306b7039c80302a535d`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 95,970 | = 9,597,000,000 cents |
| Revenue components sum (rates 32,425 + user charges 17,329 + other revenues 1,613 + operating grants 22,746 + capital grants 18,275 + interest 2,330 + other income 947 + net gain on disposal 305) | 95,970 | = printed total |
| Expense components sum (employee 22,638 + materials 26,459 + borrowing 981 + other 1,095) | 51,173 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 28,298 | 79,471 | = total expenses |
| B1-1 Total functions and activities — income | 95,970 | = face total revenue |
| B1-1 Total functions and activities — expenses | 79,471 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 16,499 | = face net result |
| B1-1 grants and contributions | 41,021 | = operating 22,746 + capital 18,275 |
| Total revenue − total expenses | 95,970 − 79,471 = 16,499 | = printed net result |
| Net result − capital grants | 16,499 − 18,275 = −1,776 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 16,499 | = Income Statement net result |
| Other comprehensive income (revaluation 18,129) | 18,129 | = printed other comprehensive income |
| Net result + other comprehensive income | 16,499 + 18,129 = 34,628 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (51,173) plus the printed
depreciation/amortisation/impairment line (28,298) = 79,471, which equals the printed B1-1 expense
total. Parkes prints a real net **gain** on disposal of assets (305), emitted as a revenue row; there
is no net loss on disposal line. The net result is positive while the before-capital result is
negative (−1,776); the before-capital figure is retained in reconciliation evidence only. Other
comprehensive income has a single printed component (revaluation), checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 32,425 | 3,242,500,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 17,329 | 1,732,900,000 | revenue |
| `other_revenue` | Other revenues | 1,613 | 161,300,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 22,746 | 2,274,600,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 18,275 | 1,827,500,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 2,330 | 233,000,000 | revenue |
| `other_income` | Other income | 947 | 94,700,000 | revenue |
| `net_gain_from_disposal_of_assets` | Net gain from the disposal of assets | 305 | 30,500,000 | revenue |
| `total_revenue` | Total income from continuing operations | 95,970 | 9,597,000,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 22,638 | 2,263,800,000 | expenses |
| `materials_and_services` | Materials and services | 26,459 | 2,645,900,000 | expenses |
| `borrowing_costs` | Borrowing costs | 981 | 98,100,000 | expenses |
| `other_expenses` | Other expenses | 1,095 | 109,500,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 51,173 | 5,117,300,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 28,298 | 2,829,800,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 79,471 | 7,947,100,000 | expenses |
| `net_result` | Net operating result attributable to Council | 16,499 | 1,649,900,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Parkes Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Parkes Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `parkes-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,168 → 999,185** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1650 → 1667**;
- active GPFS `data_sources` **87 → 88**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Parkes Shire Council`), all rows `fiscal_year: "2025-26"` (no FY2024-25 rows), and no
  council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`parkes-gpfs/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf` with the
SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official page and the exact FY2025-26 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.parkes.nsw.gov.au/Council/Strategies-policies-and-publications/Our-strategies-plans-and-reports/Audited-Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.parkes.nsw.gov.au/files/9957d5ac-c878-4061-9eeb-43a7d5e01650/Parkes-Shire-Council-Audited-Annual-Financial-Statements-YE-30-June-2026.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_parkesgpfs" \
  npx vitest run --project server server/test/parkes-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
before-capital result and the net gain on disposal), FY2025-26 acceptance and rejection of
2024-25/2026-27 documents, natural-key/idempotency, no-cross-council totals, discovery/latest
selection (prior-year and mirror rejection), the `403`→documented-pin WAF fallback and the plain-UA
header.
