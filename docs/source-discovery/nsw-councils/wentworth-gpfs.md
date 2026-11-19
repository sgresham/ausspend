# Wentworth Shire Council — General Purpose Financial Statements (FY2024-25)

Source id `wentworth-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year check (FY2025-26 not available)

The work-item title said FY2024-25. The official publications page was checked on 2026-11-19. Its
newest financial statements are **FY2024-25** (uploaded 2026-01); **no FY2025-26 audited standalone
statements are published yet**. A direct probe of the 2026/09–2026/12 upload paths found no
FY2025-26 financial-statements PDF. The connector therefore ingests **FY2024-25**, the latest audited
year, and this note records that FY2025-26 is not yet obtainable. If a FY2025-26 PDF is published
later, this source must be retargeted rather than mixed.

## 1. Source and year

- Publisher: **Wentworth Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2025** — FY2024-25. The 119-page PDF carries the signed GPFS, notes, the independent auditor's
  reports and the special-purpose water/sewer statements (the special-purpose statements are not
  parsed).
- FY2024-25 is the **latest audited standalone year** available. The connector targets `2024-25` only
  and never substitutes the later 2025-26 or the earlier 2023-24 document, a budget/planning
  document, the narrative annual report, the SPFS or the special schedules. A link whose label or
  file name maps to any other fiscal year is rejected; the 2025-26 and 2023-24 cases are covered by
  focused tests.
- Official publications page:
  <https://www.wentworth.nsw.gov.au/council/publications-policies-forms/council-publications/>.
- Current exact PDF:
  <https://www.wentworth.nsw.gov.au/wp-content/uploads/2026/01/Wentworth-Shire-Council-Financial-Statements-2024-25.pdf>.
  The same URL is the documented official fallback pin, used only when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Discovery and fetch

The publications page lists the standalone financial-statements PDFs from FY2012-13 onwards. The
connector accepts direct `.pdf` uploads whose label or file name contains "Financial Statements" and
rejects the narrative annual report, SPFS/special schedules, public notices, policies and mirrors.
The fiscal year is derived from the anchor label and file name (e.g.
`Wentworth-Shire-Council-Financial-Statements-2024-25.pdf` → FY2024-25), not from an upload-path date.
A focused test asserts FY2024-25 wins over FY2023-24 and that a newer-only (FY2025-26) or
older-only listing cannot satisfy the target.

The page and PDF serve with `200` to plain fetch. The connector sends an explicit plain `curl/8.5.0`
UA (plus a broad PDF/HTML `Accept`) for deterministic discovery and download; a focused test asserts
that header.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`wentworth-gpfs/Wentworth-Shire-Council-Financial-Statements-2024-25.pdf`:

- URL: `https://www.wentworth.nsw.gov.au/wp-content/uploads/2026/01/Wentworth-Shire-Council-Financial-Statements-2024-25.pdf`
- retrieval date: 2026-11-19
- bytes: **1,707,983**
- SHA-256: `fb90de93371d6629a0b6f63daf72495b8f7e1f2f3b3d103063c3de1eaf3aa8ca`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 57,520 | = 5,752,000,000 cents |
| Revenue components sum (rates 11,076 + user charges 11,498 + other revenues 1,863 + operating grants 8,586 + capital grants 21,813 + interest 2,631 + other income 53; 2025 net gain on disposal nil) | 57,520 | = printed total |
| Expense components sum (employee 11,433 + materials 13,296 + borrowing 1,340 + other 712 + net loss on disposal 1,223 + net share of joint ventures and associates 246) | 28,250 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 12,004 | 40,254 | = total expenses |
| B1-1 Total functions and activities — income | 57,520 | = face total revenue |
| B1-1 Total functions and activities — expenses | 40,254 | = face expense bridge |
| B1-1 Total functions and activities — operating result | 17,266 | = face net result |
| B1-1 grants and contributions | 30,399 | = operating 8,586 + capital 21,813 |
| Total revenue − total expenses | 57,520 − 40,254 = 17,266 | = printed net result |
| Net result − capital grants | 17,266 − 21,813 = −4,547 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | 17,266 | = Income Statement net result |
| Other comprehensive income (revaluation −55,052 + impairment reversal 485) | −54,567 | = printed other comprehensive income |
| Net result + other comprehensive income | 17,266 + −54,567 = −37,301 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (28,250) plus the printed
depreciation/amortisation/impairment line (12,004) = 40,254, which equals the printed B1-1 expense
total. Wentworth prints a real net **loss** on disposal of assets (1,223), emitted as an expense row,
and a **net share of interests in joint ventures and associates** (246), also emitted as an expense
row; the 2025 net gain on disposal is nil and is not emitted. The net result is positive while the
before-capital result is negative (−4,547); the before-capital figure is retained in reconciliation
evidence only. Other comprehensive income has two printed components (revaluation and impairment
reversal), whose sum is checked against the printed OCI and is not emitted as a measure row.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2024-25 report there is no deferral.

## 5. Extracted entity rows (18, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 11,076 | 1,107,600,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 11,498 | 1,149,800,000 | revenue |
| `other_revenue` | Other revenues | 1,863 | 186,300,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 8,586 | 858,600,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 21,813 | 2,181,300,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 2,631 | 263,100,000 | revenue |
| `other_income` | Other income | 53 | 5,300,000 | revenue |
| `total_revenue` | Total income from continuing operations | 57,520 | 5,752,000,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 11,433 | 1,143,300,000 | expenses |
| `materials_and_services` | Materials and services | 13,296 | 1,329,600,000 | expenses |
| `borrowing_costs` | Borrowing costs | 1,340 | 134,000,000 | expenses |
| `other_expenses` | Other expenses | 712 | 71,200,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 1,223 | 122,300,000 | expenses |
| `share_of_joint_ventures_and_associates` | Net share of interests in joint ventures and associates | 246 | 24,600,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 28,250 | 2,825,000,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 12,004 | 1,200,400,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 40,254 | 4,025,400,000 | expenses |
| `net_result` | Net operating result attributable to Council | 17,266 | 1,726,600,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Wentworth Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Wentworth Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `wentworth-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,099 → 999,117** (exactly **+18**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1581 → 1599**;
- active GPFS `data_sources` **83 → 84**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Wentworth Shire Council`), all rows `fiscal_year: "2024-25"`, and no council-total/aggregate row;
- `data_sources` has the source `active` with `records_ingested: 18`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 18`, `records_upserted: 18`;
- a second targeted run left the counts unchanged (idempotent upsert).

The exact PDF is archived outside the repo at the relative path
`wentworth-gpfs/Wentworth-Shire-Council-Financial-Statements-2024-25.pdf` with the SHA-256 above; no
PDF is committed.

## 8. How to verify

```bash
# Official publications page and the exact PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.wentworth.nsw.gov.au/council/publications-policies-forms/council-publications/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.wentworth.nsw.gov.au/wp-content/uploads/2026/01/Wentworth-Shire-Council-Financial-Statements-2024-25.pdf'

# Focused connector tests (18).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_wentworthgpfs" \
  npx vitest run --project server server/test/wentworth-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
OCI and the JV/associates share), FY2024-25 acceptance and rejection of 2025-26/2023-24 documents,
natural-key/idempotency, no-cross-council totals, discovery/latest selection (annual report,
historical statements and mirror rejection), the documented official fallback pin and the plain-UA
header.
