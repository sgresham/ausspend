# Narrabri Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `narrabri-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

## 0. Stale-year correction (FY2024-25 → FY2025-26)

The work-item title said FY2024-25, but the official Corporate Plans & Reports page publishes both
FY2024-25 and FY2025-26. The FY2025-26 standalone PDF
`.../annual-financial-statements/2025-26-annual-financial-statements-iar-inc.pdf` **actually
downloads** (200 application/pdf, 2,904,515 bytes, year ended 30 June 2026). This connector therefore
targets **FY2025-26**. No FY2024-25 rows were ever ingested, so there were no prior-year rows to
delete. The group-D inventory and README are corrected to FY2025-26.

## 1. Source and year

- Publisher: **Narrabri Shire Council**.
- Document: standalone audited **General Purpose Financial Statements for the year ended 30 June
  2026** — FY2025-26. The 106-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- FY2025-26 is the **current audited year**. The connector targets `2025-26` only and never
  substitutes the prior-year (2024-25) or earlier document, the narrative annual report, the SPFS or
  the special schedules. A link whose label or file name maps to any other fiscal year is rejected;
  the FY2024-25 and FY2026-27 cases are covered by focused tests.
- Official page:
  <https://www.narrabri.nsw.gov.au/Your-Council/Documents-Policies/Corporate-Plans-Reports>.
- Current exact PDF:
  <https://www.narrabri.nsw.gov.au/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2025-26-annual-financial-statements-iar-inc.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Edge/Akamai WAF returning `403 text/html` to plain curl, with the PDF
reachable in headless Chromium. In this retrieval run (2026-11-19) **both the listing page and the PDF
returned `200`** to `curl/8.5.0`, so no browser fetch was needed. The connector still sends an
explicit plain `curl/8.5.0` UA (plus a broad PDF/HTML `Accept`) and falls back to the documented
official pin if the page is challenged or yields no usable anchor; a focused test simulates a `403`
listing and asserts the pin fallback. No unofficial mirror was used.

The official page lists the annual financial statements from prior years, including the FY2025-26
PDF. The parser accepts direct `.pdf` uploads whose label or file name contains "Financial
Statements" and rejects the narrative annual report, SPFS/special schedules, public notices, policies
and mirrors. The fiscal year is derived from the anchor label and file name
(`2025-26-annual-financial-statements-iar-inc.pdf` → FY2025-26), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path
`narrabri-gpfs/2025-26-annual-financial-statements-iar-inc.pdf`:

- URL: `https://www.narrabri.nsw.gov.au/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2025-26-annual-financial-statements-iar-inc.pdf`
- retrieval date: 2026-11-19
- bytes: **2,904,515**
- SHA-256: `dc3f1d831eaba872d0254c6bddf35b3a91a27bdb4441d59c485c92b02dc8f458`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation (zero tolerance)

The printed unit is explicit `$ '000` on the income statement, comprehensive-income statement and
B1-1. A missing or conflicting unit rejects the whole extraction. Nothing is emitted unless all of
these agree exactly (one thousand dollars is a failure):

| Check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Total income from continuing operations (Income Statement) | 70,863 | = 7,086,300,000 cents |
| Revenue components sum (rates 26,190 + user charges 10,739 + other revenues 2,570 + operating grants 19,080 + capital grants 9,681 + interest 2,492 + other income 111) | 70,863 | = printed total |
| Expense components sum (employee 22,424 + materials 23,524 + borrowing 138 + other 983 + net loss on disposal 8,277) | 55,346 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 17,657 | 73,003 | = total expenses |
| B1-1 "Total Services" — income | 70,863 | = face total revenue |
| B1-1 "Total Services" — expenses | 73,003 | = face expense bridge |
| B1-1 "Total Services" — operating result | −2,140 | = face net result |
| B1-1 "Total Services" grants and contributions | 28,761 | = operating 19,080 + capital 9,681 |
| Total revenue − total expenses | 70,863 − 73,003 = −2,140 | = printed net result |
| Net result − capital grants | −2,140 − 9,681 = −11,821 | = printed negative before-capital result (evidence only) |
| Comprehensive-income net result | −2,140 | = Income Statement net result |
| Other comprehensive income (revaluation 23,327; intangible-asset revaluation nil) | 23,327 | = printed other comprehensive income |
| Net result + other comprehensive income | −2,140 + 23,327 = 21,187 | = printed total comprehensive income |

The Income Statement does not print a "Total expenses" line. Total expenses is therefore the
documented bridge of the printed expenses-excluding-depreciation line (55,346) plus the printed
depreciation/amortisation/impairment line (17,657) = 73,003, which equals the printed B1-1 "Total
Services" expense total. Narrabri's B1-1 row is **"Total Services"**, not "Total functions and
activities"; the adapter parses that row. It prints a real net **loss** on disposal of assets
(8,277), emitted as an expense row; there is no net gain on disposal line. The net operating result
is **negative** (−2,140) and is stored with a negative sign marker; the before-capital result
(−11,821) is retained in reconciliation evidence only. Other comprehensive income has a single
non-nil printed component (revaluation); the 2026 intangible-asset revaluation line is nil, and the
revaluation is checked against the printed OCI.

The adapter defers the document with **0 rows** and the exact gap if any printed line is missing, the
unit is not thousands, or any bridge differs. On the audited FY2025-26 report there is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 26,190 | 2,619,000,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 10,739 | 1,073,900,000 | revenue |
| `other_revenue` | Other revenues | 2,570 | 257,000,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 19,080 | 1,908,000,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 9,681 | 968,100,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 2,492 | 249,200,000 | revenue |
| `other_income` | Other income | 111 | 11,100,000 | revenue |
| `total_revenue` | Total income from continuing operations | 70,863 | 7,086,300,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 22,424 | 2,242,400,000 | expenses |
| `materials_and_services` | Materials and services | 23,524 | 2,352,400,000 | expenses |
| `borrowing_costs` | Borrowing costs | 138 | 13,800,000 | expenses |
| `other_expenses` | Other expenses | 983 | 98,300,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 8,277 | 827,700,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 55,346 | 5,534,600,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 17,657 | 1,765,700,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 73,003 | 7,300,300,000 | expenses |
| `net_result` | Net operating result attributable to Council | −2,140 | 214,000,000 | result |

The net-result row stores a magnitude with `gpfs_printed_sign: "negative"` because the printed net
result is −2,140. Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Narrabri Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Narrabri Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `narrabri-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **999,236 → 999,253** (exactly **+17**);
- GPFS rows (`source_id` matching `/gpfs$/`) **1718 → 1735**;
- active GPFS `data_sources` **91 → 92**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one `delivery_entity`
  (`Narrabri Shire Council`), all rows `fiscal_year: "2025-26"`, and no council-total/aggregate row;
- the net-result row stores `214,000,000` cents with `gpfs_printed_sign: "negative"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry for the source is `status: "success"`,
  `records_fetched: 17`, `records_upserted: 17`.

The exact PDF is archived outside the repo at the relative path
`narrabri-gpfs/2025-26-annual-financial-statements-iar-inc.pdf` with the SHA-256 above; no PDF is
committed.

## 8. How to verify

```bash
# Official page and the exact FY2025-26 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.narrabri.nsw.gov.au/Your-Council/Documents-Policies/Corporate-Plans-Reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.narrabri.nsw.gov.au/files/assets/public/v/1/1.-your-council/strategic-and-corporate-plans/annual-reports/annual-financial-statements/2025-26-annual-financial-statements-iar-inc.pdf'

# Focused connector tests (19).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_narrabrigpfs" \
  npx vitest run --project server server/test/narrabri-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including the negative
net result with its sign marker, the negative before-capital result, the net loss on disposal and the
"Total Services" B1-1 row), FY2025-26 acceptance and rejection of 2024-25/2026-27 documents,
natural-key/idempotency, no-cross-council totals, discovery/latest selection (annual report,
prior-year and mirror rejection), the `403`→documented-pin WAF fallback and the plain-UA header.
