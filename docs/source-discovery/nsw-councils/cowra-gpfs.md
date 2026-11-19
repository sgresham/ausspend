# Cowra Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `cowra-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year correction (FY2024-25 → FY2025-26)

The work-item title said FY2024-25, but the official Council Plans, reports and policies page
publishes both FY2024-25 and FY2025-26. The FY2025-26 standalone PDF is
`.../files/assets/public/v/1/annual_financial_statements-2025-2026.pdf` (year ended 30 June 2026).
This connector therefore targets **FY2025-26**. No FY2024-25 rows were ever ingested, so there were
no prior-year rows to delete. The group-D inventory and README are corrected to FY2025-26.

## 1. Source and year

- Publisher: **Cowra Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2026** — FY2025-26. The 107-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- FY2025-26 is the **current audited year**. The connector targets `2025-26` only and never
  substitutes the prior-year (2024-25 or 2023-24) document, the narrative annual report, the SPFS or
  the special schedules. A link whose label or file name maps to any other fiscal year is rejected;
  the FY2024-25 and FY2026-27 cases are covered by focused tests.
- Official page:
  <https://www.cowracouncil.com.au/Council/Governance-and-transparency/Council-Plans-reports-and-policies>.
- Current exact PDF:
  <https://www.cowracouncil.com.au/files/assets/public/v/1/annual_financial_statements-2025-2026.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to plain curl, with the PDF
reachable in headless Chromium. In this retrieval run (2026-11-19) **both the listing page and the PDF
returned `200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an
explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented
official pin if the page is challenged or yields no usable anchor; a focused test simulates a `403`
listing and asserts the pin fallback. No unofficial mirror was used.

The official page lists the annual financial statements from FY2009-10 onwards, including the current
FY2025-26 PDF. The parser accepts direct `.pdf` uploads whose label or file name contains "Financial
Statements" and rejects the narrative annual report, SPFS/special schedules, public notices, policies
and mirrors. The fiscal year is derived from the anchor label and file name
(`annual_financial_statements-2025-2026.pdf` → FY2025-26), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path `cowra-gpfs/annual_financial_statements-2025-2026.pdf`:

- URL: `https://www.cowracouncil.com.au/files/assets/public/v/1/annual_financial_statements-2025-2026.pdf`
- retrieval date: 2026-11-19
- bytes: **3,421,290**
- SHA-256: `ceae83befba0e156c23a92ed6c14a11f01b7f4e3031374d9cce28ca607991a65`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 57,345 | = 5,734,500,000 cents |
| Revenue components sum (rates 18,002 + user charges 19,275 + other revenues 1,224 + operating grants 13,333 + capital grants 3,322 + interest 1,960 + other income 229; 2026 net gain on disposal nil) | 57,345 | = printed total |
| Expense components sum (employee 19,228 + materials 20,127 + borrowing 1,402 + other 1,613 + net loss on disposal 1,423) | 43,793 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 10,921 | 54,714 | = total expenses |
| B1-1 Total functions and activities — income | 57,345 | = face total revenue |
| B1-1 Total functions and activities — expenses | 54,714 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 2,631 | = face net result |
| B1-1 grants and contributions | 16,655 | = operating 13,333 + capital 3,322 |
| Total revenue − total expenses | 57,345 − 54,714 = 2,631 | = printed net result |
| Net result − capital grants | 2,631 − 3,322 = −691 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 2,631 | = Income Statement net result |
| Other comprehensive income (revaluation 26,818; 2026 impairment reversal nil) | 26,818 | = printed other comprehensive income |
| Net result + other comprehensive income | 2,631 + 26,818 = 29,449 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (43,793) plus the printed
depreciation/amortisation/impairment line (10,921) = 54,714, which equals the printed B1-1 expense
total. Cowra prints a real net **loss** on disposal of assets (1,423), emitted as an expense row; the
2026 net gain on disposal is nil and is not emitted. The net result is positive while the
before-capital result is negative (−691); the before-capital figure is retained in reconciliation
evidence only. Other comprehensive income has a single non-nil printed component (revaluation); the
2026 impairment-reversal line is nil, and the revaluation is checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 18,002 | 1,800,200,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 19,275 | 1,927,500,000 | revenue |
| `other_revenue` | Other revenues | 1,224 | 122,400,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 13,333 | 1,333,300,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 3,322 | 332,200,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,960 | 196,000,000 | revenue |
| `other_income` | Other income | 229 | 22,900,000 | revenue |
| `total_revenue` | Total income from continuing operations | 57,345 | 5,734,500,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 19,228 | 1,922,800,000 | expenses |
| `materials_and_services` | Materials and services | 20,127 | 2,012,700,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,402 | 140,200,000 | expenses |
| `other_expenses` | Other expenses | 1,613 | 161,300,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 1,423 | 142,300,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 43,793 | 4,379,300,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 10,921 | 1,092,100,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 54,714 | 5,471,400,000 | expenses |
| `net_result` | Net operating result attributable to Council | 2,631 | 263,100,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Cowra Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Cowra Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `cowra-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,185 → 999,202** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1667 → 1684**;
- active GPFS `data_sources` **88 → 89**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Cowra Shire Council`), all rows `fiscal_year: "2025-26"` (no FY2024-25 rows), and no
  council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`cowra-gpfs/annual_financial_statements-2025-2026.pdf` with the SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official page and the exact FY2025-26 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.cowracouncil.com.au/Council/Governance-and-transparency/Council-Plans-reports-and-policies'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.cowracouncil.com.au/files/assets/public/v/1/annual_financial_statements-2025-2026.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_cowragpfs" \
  npx vitest run --project server server/test/cowra-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
before-capital result and the net loss on disposal), FY2025-26 acceptance and rejection of
2024-25/2026-27 documents, natural-key/idempotency, no-cross-council totals, discovery/latest
selection (prior-year and mirror rejection), the `403`→documented-pin WAF fallback and the plain-UA
header.
