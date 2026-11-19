# Inverell Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `inverell-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year correction (FY2024-25 → FY2025-26)

The work-item title said FY2024-25, but the group-D inventory noted that Inverell publishes both
FY2024-25 and FY2025-26 standalone statements. The official publications page confirms a **FY2025-26**
standalone PDF is published; the current audited year is FY2025-26 (year ended 30 June 2026, auditor
signed 27 October 2026). This connector therefore targets **FY2025-26**. No FY2024-25 rows were ever
ingested, so there were no prior-year rows to delete. The group-D inventory and README are corrected
to FY2025-26.

## 1. Source and year

- Publisher: **Inverell Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2026** — FY2025-26. The 111-page PDF carries the signed GPFS, notes, the independent auditor's
  reports and the special-purpose water/sewer statements (the special-purpose statements are not
  parsed).
- FY2025-26 is the **current audited year**. The connector targets `2025-26` only and never
  substitutes a prior-year (2024-25 or 2023-24), a budget/planning document, the narrative annual
  report, the SPFS or the special schedules. A link whose label or file name maps to any other fiscal
  year is rejected; the FY2024-25 and 2026-27 cases are covered by focused tests.
- Official publications page: <https://inverell.nsw.gov.au/your-council/council-publications>.
- Current exact PDF:
  <https://inverell.nsw.gov.au/wp-content/uploads/2026/11/Annual-Financial-Statements-2025-2026.pdf>.
  The same URL is the documented official fallback pin, used when the listing page yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Discovery and fetch

The HTML publications page returns a **Cloudflare challenge** (`403`, "Just a moment...") to plain
fetch from this environment. The connector attempts the page with a plain UA and, when it is
unavailable or yields no usable FY2025-26 anchor, uses the documented official pin — the exact
FY2025-26 PDF, which is directly fetchable with `200 application/pdf`. A focused test simulates the
403 and asserts the pin fallback. When the page HTML is available, the parser accepts direct `.pdf`
uploads containing "Financial Statements" and rejects the narrative annual report, SPFS/special
schedules, public notices, policies and mirrors. The fiscal year is derived from the anchor label and
file name (hyphenated, space-separated or slashed year pairs), not from an upload-path date.

The connector sends an explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) for
deterministic discovery and download; a focused test asserts that header.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`inverell-gpfs/Annual-Financial-Statements-2025-2026.pdf`:

- URL: `https://inverell.nsw.gov.au/wp-content/uploads/2026/11/Annual-Financial-Statements-2025-2026.pdf`
- retrieval date: 2026-11-19
- bytes: **6,365,791**
- SHA-256: `b8aad9c13719fa5765bedc65750a7166fb4cd920b175b8d19fa22c11ea13405e`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 62,978 | = 6,297,800,000 cents |
| Revenue components sum (rates 27,473 + user charges 7,340 + other revenues 1,266 + operating grants 20,824 + capital grants 1,639 + interest 4,103 + other income 333) | 62,978 | = printed total |
| Expense components sum (employee 16,799 + materials 16,095 + borrowing 707 + other 1,058 + net loss on disposal 590) | 35,249 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 16,136 | 51,385 | = total expenses |
| B1-1 Total functions and activities — income | 62,978 | = face total revenue |
| B1-1 Total functions and activities — expenses | 51,385 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 11,593 | = face net result |
| B1-1 grants and contributions | 22,463 | = operating 20,824 + capital 1,639 |
| Total revenue − total expenses | 62,978 − 51,385 = 11,593 | = printed net result |
| Net result − capital grants | 11,593 − 1,639 = 9,954 | = printed before-capital result (evidence only) |
| Comprehensive-income net result | 11,593 | = Income Statement net result |
| Other comprehensive income (revaluation 122,531) | 122,531 | = printed other comprehensive income |
| Net result + other comprehensive income | 11,593 + 122,531 = 134,124 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (35,249) plus the printed
depreciation/amortisation/impairment line (16,136) = 51,385, which equals the printed B1-1 expense
total. Inverell prints a real net **loss** on disposal of assets (590), emitted as an expense row;
the printed 2026 net gain on disposal is nil and is not emitted. The net result and the
before-capital result are both positive; the before-capital figure is retained in reconciliation
evidence only. Other comprehensive income has a single printed component (revaluation), checked
against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 27,473 | 2,747,300,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 7,340 | 734,000,000 | revenue |
| `other_revenue` | Other revenues | 1,266 | 126,600,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 20,824 | 2,082,400,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 1,639 | 163,900,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 4,103 | 410,300,000 | revenue |
| `other_income` | Other income | 333 | 33,300,000 | revenue |
| `total_revenue` | Total income from continuing operations | 62,978 | 6,297,800,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 16,799 | 1,679,900,000 | expenses |
| `materials_and_services` | Materials and services | 16,095 | 1,609,500,000 | expenses |
| `borrowing_costs` | Borrowing costs | 707 | 70,700,000 | expenses |
| `other_expenses` | Other expenses | 1,058 | 105,800,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 590 | 59,000,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 35,249 | 3,524,900,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 16,136 | 1,613,600,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 51,385 | 5,138,500,000 | expenses |
| `net_result` | Net operating result attributable to Council | 11,593 | 1,159,300,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Inverell Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Inverell Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `inverell-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,082 → 999,099** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1564 → 1581**;
- active GPFS `data_sources` **82 → 83**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Inverell Shire Council`), all rows `fiscal_year: "2025-26"` (no FY2024-25 rows), and no
  council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`inverell-gpfs/Annual-Financial-Statements-2025-2026.pdf` with the SHA-256 above; no PDF is
committed.

## 8. How to verify

```bash
# Official publications page (may return a Cloudflare challenge to plain fetch).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://inverell.nsw.gov.au/your-council/council-publications'
# The exact FY2025-26 PDF is directly fetchable.
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://inverell.nsw.gov.au/wp-content/uploads/2026/11/Annual-Financial-Statements-2025-2026.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_inverellgpfs" \
  npx vitest run --project server server/test/inverell-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 acceptance
and rejection of 2024-25/2026-27 documents, natural-key/idempotency, no-cross-council totals,
discovery/latest selection (annual report, SPFS, special schedules and mirror rejection), the
403→documented-pin fallback and the plain-UA header.
