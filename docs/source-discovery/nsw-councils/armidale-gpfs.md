# NSW council GPFS — Armidale Regional Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Armidale Regional Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2025-26 is the **latest audited standalone financial statements** published by the council at
2026-11-19: the statements are for the year ended 30 June 2026. The connector targets `2025-26`, and
its stale-year guard rejects other years rather than silently substituting a 2026-27 or 2023-24
document.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official Financial statements page | <https://www.armidale.nsw.gov.au/Council/Administration/Financial-statements> | **200** | `text/html; charset=utf-8`, 80,589 bytes; lists eight years of audited statements. |
| Audited FY2025-26 statements | <https://www.armidale.nsw.gov.au/files/assets/public/v/1/council/documents/final_audited-financial-statements-2025-26.pdf> | **200** | `application/pdf`, 2,568,853 bytes, 93 PDF pages; `last-modified: Tue, 03 Nov 2026 01:05:01 GMT`, `etag: "34e460ea-6edb-484c-93cd-c766c614c625"`. |

**Akamai UA quirk.** The same PDF URL returns **200** `application/pdf` to a plain client UA
(`curl/8.5.0`) and **403** to a bare Chrome UA. The connector sends an explicit plain client UA
(plus a broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header
is used and contains no `Chrome` token.

The connector parses the official Financial statements page, selects the **audited FY2025-26**
statements anchor, and ignores prior years, the narrative annual report, special-purpose/special
schedule documents and off-host mirrors. A documented official fallback pin is used only if the page
yields no usable anchor. The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Armidale Regional Council — Annual Financial Statements for the year ended 30 June 2026.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.armidale.nsw.gov.au/files/assets/public/v/1/council/documents/final_audited-financial-statements-2025-26.pdf`
- **Bytes:** 2,568,853.
- **PDF pages:** 93.
- **SHA-256:** `c43ab813cfaa8f64aee298887d0b1c0b2b3217e3ccf11809353d675068b112a6`.
- **Archive:** `armidale-gpfs/final_audited-financial-statements-2025-26.pdf` under the configured
  source-archive root (outside the repo; not committed). It holds the exact PDF plus archive metadata
  (URL, retrieval date, bytes, SHA-256, content type) and the archive record. The connector
  re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 5). It prints `$ '000` for the 2026 columns. The
unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2025-26 Actual column only, not the Original unaudited budget column that prints
before each label.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               52,217
  User charges and fees                                  32,663
  Other revenues                                          4,856
  Grants and contributions provided for operating purposes 18,033
  Grants and contributions provided for capital purposes 24,833
  Interest and investment income                          7,198
  Other income                                            1,109
  Total income from continuing operations                140,909
Expenses from continuing operations
  Employee benefits and on-costs                         35,890
  Materials and services                                 38,670
  Borrowing costs                                           990
  Other expenses                                          2,043
  Net loss from the disposal of assets                    5,424
  Total expenses ... excluding depreciation              83,017
  Depreciation, amortisation and impairment              27,927
  Operating result from continuing operations            29,965
  Net operating result attributable to Council           29,965
  Net operating result before capital grants              5,132
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `83,017` + depreciation/amortisation/impairment `27,927` = `110,944`,
which equals the B1-1 "Total functions and activities" expense total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  52,217 + 32,663 + 4,856 + 18,033 + 24,833 + 7,198 + 1,109 = 140,909
  = printed Total income

expense components:
  35,890 + 38,670 + 990 + 2,043 + 5,424 = 83,017
  = printed expenses excluding depreciation

total expenses:
  83,017 + 27,927 = 110,944
  = printed B1-1 Total functions and activities expenses

operating result:
  140,909 - 110,944 = 29,965
  = printed Operating result

net result:
  29,965 = printed Net operating result attributable to Council

before capital grants:
  29,965 - 24,833 = 5,132
  = printed before-capital result (evidence only)

B1-1:
  income = 140,909
  expenses = 110,944
  operating result = 29,965
  grants = 18,033 + 24,833 = 42,866

other comprehensive income:
  revaluation = 44,164 = 44,164
  = printed Total other comprehensive income for the year and Total items not reclassified

comprehensive income:
  29,965 + 44,164 = 74,129
  = printed Total comprehensive income
```

B1-1 income is the face total revenue. The adapter checks `B1-1 operating result = printed net
result`, `B1-1 grants = operating grants + capital grants`, `B1-1 income = face total revenue`,
`B1-1 expenses = face total expenses bridge` and `B1-1 income − B1-1 expenses = printed net result`.
The before-capital result is retained in reconciliation evidence only, not emitted as a row.

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item` | Printed/derived label | `$ '000` | `amount_cents` | Section |
| --- | --- | ---: | ---: | --- |
| `rates_and_annual_charges` | Rates and annual charges | 52,217 | 5,221,700,000 | revenue |
| `user_charges_and_fees` | User charges and fees | 32,663 | 3,266,300,000 | revenue |
| `other_revenues` | Other revenues | 4,856 | 485,600,000 | revenue |
| `government_grants_operating` | Grants and contributions — operating | 18,033 | 1,803,300,000 | revenue |
| `government_grants_capital` | Grants and contributions — capital | 24,833 | 2,483,300,000 | revenue |
| `interest_and_investment_income` | Interest and investment income | 7,198 | 719,800,000 | revenue |
| `other_income` | Other income | 1,109 | 110,900,000 | revenue |
| `total_revenue` | Total income from continuing operations | 140,909 | 14,090,900,000 | revenue |
| `employee_expenses` | Employee benefits and on-costs | 35,890 | 3,589,000,000 | expenses |
| `materials_and_services` | Materials and services | 38,670 | 3,867,000,000 | expenses |
| `borrowing_costs` | Borrowing costs | 990 | 99,000,000 | expenses |
| `other_expenses` | Other expenses | 2,043 | 204,300,000 | expenses |
| `net_loss_from_disposal_of_assets` | Net loss from the disposal of assets | 5,424 | 542,400,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation | 83,017 | 8,301,700,000 | expenses |
| `depreciation_amortisation_impairment` | Depreciation, amortisation and impairment | 27,927 | 2,792,700,000 | expenses |
| `total_expenses` | Total expenses (documented bridge) | 110,944 | 11,094,400,000 | expenses |
| `net_result` | Net operating result attributable to Council | 29,965 | 2,996,500,000 | result |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Armidale Regional Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Armidale Regional Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `armidale-gpfs`** against the shared dev DB `ausspend_dev`:

- total measures **998,728 → 998,745** (exactly **+17**);
- GPFS rows **1210 → 1227**;
- active GPFS `data_sources` **61 → 62**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** non-`agency_detail` rows, **0** rows with `region_id`/`location`, one
  `delivery_entity` (`Armidale Regional Council`), all rows `fiscal_year: "2025-26"`;
- `data_sources` has the source `active` with `records_ingested: 17`;
- the latest `ingestion_logs` entry is `status: "success"`, `records_fetched: 17`,
  `records_upserted: 17`;
- a second ingest upserted the same 17 SHA-anchored natural keys and left the total at **998,745**
  (idempotent, no duplicates).

## 8. How to verify

```bash
# Official page and the exact GPFS PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' 'https://www.armidale.nsw.gov.au/Council/Administration/Financial-statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.armidale.nsw.gov.au/files/assets/public/v/1/council/documents/final_audited-financial-statements-2025-26.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27018/ausspend_test_armidalegpfs" \
  npx vitest run --project server server/test/armidale-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26
current-available acceptance and rejection of 2024-25/2026-27 substitutions, natural-key/idempotency,
no-cross-council totals and discovery/latest selection (including the documented official fallback
pin and the plain-UA Akamai header).
