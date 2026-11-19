# Forbes Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `forbes-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available)

The work-item title said FY2024-25. The official reports page was checked on 2026-11-19. Its newest
financial statements are **FY2024-25** (`Annual_Financial_Statements-2025.pdf.aspx`, uploaded
2026-01); **no FY2025-26 audited standalone statements are published yet**. A direct probe of likely
2026 financial-statements file names found none. The connector therefore ingests **FY2024-25**, the
latest audited year, and this note records that FY2025-26 is not yet obtainable. If a FY2025-26 PDF
is published later, this source must be retargeted rather than mixed.

## 1. Source and year

- Publisher: **Forbes Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2025** — FY2024-25. The 106-page PDF carries the signed GPFS, notes, the independent auditor's
  reports and the special-purpose water/sewer statements (the special-purpose statements are not
  parsed).
- FY2024-25 is the **latest audited standalone year** available. The connector targets `2024-25` only
  and never substitutes the later 2025-26 or the earlier 2023-24 document, a budget/planning or
  quarterly-review document, the narrative annual report, the SPFS or the special schedules. A link
  whose label or file name maps to any other fiscal year is rejected; the 2025-26 and 2023-24 cases
  are covered by focused tests.
- Official reports page: <https://www.forbes.nsw.gov.au/council/council-documents/reports>.
- Current exact PDF (ASP.NET `.pdf.aspx`, returns `application/pdf`):
  <https://www.forbes.nsw.gov.au/ArticleDocuments/211/Annual_Financial_Statements-2025.pdf.aspx>.
  The same URL is the documented official fallback pin, used only when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Discovery and fetch

The reports page lists the standalone financial-statements document together with the narrative
annual report, quarterly budget reviews and older annual reports. The connector accepts direct
`.pdf` / `.pdf.aspx` anchors whose label or file name contains "Financial Statements" and rejects the
annual report, SPFS/special schedules, public notices, quarterly reviews, policies and mirrors. The
fiscal year is derived from the anchor label and file name
(`Annual_Financial_Statements-2025.pdf.aspx` → FY2024-25; the file's year is the June year-end), not
from an upload-path date. A focused test asserts FY2024-25 is selected and that a newer-only
(FY2025-26) or older-only listing cannot satisfy the target.

The page and the `.pdf.aspx` document serve with `200` to plain fetch. The connector sends an
explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) for deterministic discovery and
download; a focused test asserts that header.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path `forbes-gpfs/Annual_Financial_Statements-2025.pdf`:

- URL: `https://www.forbes.nsw.gov.au/ArticleDocuments/211/Annual_Financial_Statements-2025.pdf.aspx`
- retrieval date: 2026-11-19
- bytes: **2,560,081**
- SHA-256: `6f512014865b7ae2e23d12daf5e670b3137e445023272eab8c656cb0db34ca62`
- content type: `application/pdf` (genuine PDF despite the `.aspx` wrapper)

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 67,967 | = 6,796,700,000 cents |
| Revenue components sum (rates 15,712 + user charges 20,622 + other revenues 1,710 + operating grants 13,845 + capital grants 11,538 + interest 1,618 + other income 1,068 + net gain on disposal 1,854) | 67,967 | = printed total |
| Expense components sum (employee 16,043 + materials 26,767 + borrowing 1,802 + other 1,130) | 45,742 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 16,096 | 61,838 | = total expenses |
| B1-1 Total functions and activities — income | 67,967 | = face total revenue |
| B1-1 Total functions and activities — expenses | 61,838 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 6,129 | = face net result |
| B1-1 grants and contributions | 25,383 | = operating 13,845 + capital 11,538 |
| Total revenue − total expenses | 67,967 − 61,838 = 6,129 | = printed net result |
| Net result − capital grants | 6,129 − 11,538 = −5,409 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 6,129 | = Income Statement net result |
| Other comprehensive income (revaluation 54,664) | 54,664 | = printed other comprehensive income |
| Net result + other comprehensive income | 6,129 + 54,664 = 60,793 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (45,742) plus the printed
depreciation/amortisation/impairment line (16,096) = 61,838, which equals the printed B1-1 expense
total. Forbes prints a real net **gain** on disposal of assets (1,854), emitted as a revenue row;
there is no net loss on disposal line. The net result is positive while the before-capital result is
negative (−5,409); the before-capital figure is retained in reconciliation evidence only. Other
comprehensive income has a single printed component (revaluation), checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 15,712 | 1,571,200,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 20,622 | 2,062,200,000 | revenue |
| `other_revenue` | Other revenues | 1,710 | 171,000,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 13,845 | 1,384,500,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 11,538 | 1,153,800,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 1,618 | 161,800,000 | revenue |
| `other_income` | Other income | 1,068 | 106,800,000 | revenue |
| `net_gain_from_disposal_of_assets` | Net gain from the disposal of assets | 1,854 | 185,400,000 | revenue |
| `total_revenue` | Total income from continuing operations | 67,967 | 6,796,700,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 16,043 | 1,604,300,000 | expenses |
| `materials_and_services` | Materials and services | 26,767 | 2,676,700,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,802 | 180,200,000 | expenses |
| `other_expenses` | Other expenses | 1,130 | 113,000,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 45,742 | 4,574,200,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 16,096 | 1,609,600,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 61,838 | 6,183,800,000 | expenses |
| `net_result` | Net operating result attributable to Council | 6,129 | 612,900,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Forbes Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Forbes Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `forbes-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,117 → 999,134** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1599 → 1616**;
- active GPFS `data_sources` **84 → 85**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Forbes Shire Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`forbes-gpfs/Annual_Financial_Statements-2025.pdf` with the SHA-256 above; no PDF is committed.

## 8. How to verify

```bash
# Official reports page and the exact PDF (genuine PDF behind .pdf.aspx).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.forbes.nsw.gov.au/council/council-documents/reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.forbes.nsw.gov.au/ArticleDocuments/211/Annual_Financial_Statements-2025.pdf.aspx'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_forbesgpfs" \
  npx vitest run --project server server/test/forbes-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
before-capital result), FY2024-25 acceptance and rejection of 2025-26/2023-24 documents,
natural-key/idempotency, no-cross-council totals, discovery/latest selection (annual report,
quarterly review, historical statements and mirror rejection), the documented official fallback pin
and the plain-UA header.
