# Narromine Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `narromine-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 1. Source and year

- Publisher: **Narromine Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2026** — FY2025-26 — published as **Annexure 1** of the annual report. The 92-page PDF carries the
  signed GPFS, notes, the independent auditor's reports and the special-purpose water/sewer
  statements (the special-purpose statements are not parsed).
- FY2025-26 is the **current audited year**. The connector targets `2025-26` only and never
  substitutes a prior-year (2024-25 or 2023-24), the narrative annual report itself, a
  budget/planning document, the SPFS or the special schedules. A link whose label or file name maps
  to any other fiscal year is rejected; the FY2024-25 and 2026-27 cases are covered by focused tests.
- Official Annual Reports page: <https://www.narromine.nsw.gov.au/council/annual-reports>.
- Current exact PDF:
  <https://www.narromine.nsw.gov.au/2025%202026%20NSC%20Annual%20Report%20-%20Annexure%201%20-%20Financial%20Statements.pdf?downloadable=1>
  (the `?downloadable=1` query is preserved). The same URL is the documented official fallback pin,
  used only when the listing yields no usable FY2025-26 anchor; the downloaded bytes are SHA-256
  verified either way.

## 2. Discovery and fetch

The official Annual Reports page lists both the full narrative annual report and the Annexure 1
financial statements. The connector requires "Financial Statements" in the anchor, so the full annual
report, the "State of Our Shire" annexure, SPFS/special schedules, public notices, policies and
mirrors are ignored. It handles the page's space-separated year pair ("2025 - 2026" and the
percent-encoded file name "2025 2026") as well as hyphenated ranges, and decides the fiscal year from
the anchor label and file name rather than any upload-path date. A focused test asserts the FY2025-26
annexure is selected ahead of 2024-25 and 2023-24 and that a prior-only or future-only listing cannot
satisfy the target.

The host serves the PDF with `200 application/pdf` to a plain client User-Agent. The connector sends
an explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) for deterministic discovery and
download; a focused test asserts that header.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`narromine-gpfs/2025 2026 NSC Annual Report - Annexure 1 - Financial Statements.pdf`:

- URL: `https://www.narromine.nsw.gov.au/2025%202026%20NSC%20Annual%20Report%20-%20Annexure%201%20-%20Financial%20Statements.pdf?downloadable=1`
- retrieval date: 2026-11-19
- bytes: **7,899,829**
- SHA-256: `aed5a746789b3e5daf13cf35ed03e3db458408549fba1741c184d275010cf2fb`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 39,898 | = 3,989,800,000 cents |
| Revenue components sum (rates 11,689 + user charges 5,495 + other revenue 367 + operating grants 11,429 + capital grants 9,002 + interest 1,411 + other income 131 + net gain on disposal 374) | 39,898 | = printed total |
| Expense components sum (employee 9,395 + materials 9,545 + borrowing 212 + other 1,913; 2026 net loss on disposal nil) | 21,065 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 9,168 | 30,233 | = total expenses |
| B1-1 Total functions and activities — income | 39,898 | = face total revenue |
| B1-1 Total functions and activities — expenses | 30,233 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 9,665 | = face net result |
| B1-1 grants and contributions | 20,431 | = operating 11,429 + capital 9,002 |
| Total revenue − total expenses | 39,898 − 30,233 = 9,665 | = printed net result |
| Net result − capital grants | 9,665 − 9,002 = 663 | = printed before-capital result (evidence only) |
| Comprehensive-income net result | 9,665 | = Income Statement net result |
| Other comprehensive income (revaluation 28,642) | 28,642 | = printed other comprehensive income |
| Net result + other comprehensive income | 9,665 + 28,642 = 38,307 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (21,065) plus the printed
depreciation/amortisation/impairment line (9,168) = 30,233, which equals the printed B1-1 expense
total. Narromine prints a real net **gain** on disposal of assets (374), emitted as a revenue row;
the printed 2026 net loss on disposal is nil and is not emitted. The net result and the
before-capital result are both positive; the before-capital figure is retained in reconciliation
evidence only. Other comprehensive income has a single printed component (revaluation), checked
against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 11,689 | 1,168,900,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 5,495 | 549,500,000 | revenue |
| `other_revenue` | Other revenue | 367 | 36,700,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 11,429 | 1,142,900,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 9,002 | 900,200,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,411 | 141,100,000 | revenue |
| `other_income` | Other income | 131 | 13,100,000 | revenue |
| `net_gain_from_disposal_of_assets` | Net gain from the disposal of assets | 374 | 37,400,000 | revenue |
| `total_revenue` | Total income from continuing operations | 39,898 | 3,989,800,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 9,395 | 939,500,000 | expenses |
| `materials_and_services` | Materials and services | 9,545 | 954,500,000 | expenses |
| `borrowing_costs` | Borrowing costs | 212 | 21,200,000 | expenses |
| `other_expenses` | Other expenses | 1,913 | 191,300,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 21,065 | 2,106,500,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 9,168 | 916,800,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 30,233 | 3,023,300,000 | expenses |
| `net_result` | Net operating result attributable to Council | 9,665 | 966,500,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Narromine Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Narromine Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `narromine-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,065 → 999,082** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1547 → 1564**;
- active GPFS `data_sources` **81 → 82**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Narromine Shire Council`), all rows `fiscal_year: "2025-26"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`narromine-gpfs/2025 2026 NSC Annual Report - Annexure 1 - Financial Statements.pdf` with the
SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official Annual Reports page and the exact PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.narromine.nsw.gov.au/council/annual-reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.narromine.nsw.gov.au/2025%202026%20NSC%20Annual%20Report%20-%20Annexure%201%20-%20Financial%20Statements.pdf?downloadable=1'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_narrominegpfs" \
  npx vitest run --project server server/test/narromine-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 acceptance
and rejection of 2024-25/2026-27 documents, the space-separated year pair, natural-key/idempotency,
no-cross-council totals and discovery/latest selection (full annual report, State of Our Shire,
SPFS/special-schedule, policy and mirror rejection, the documented official fallback pin and the
plain-UA header).
