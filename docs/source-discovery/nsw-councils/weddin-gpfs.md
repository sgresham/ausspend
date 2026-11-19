# NSW council GPFS — Weddin Shire Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Weddin Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2024-25 column is used; the FY2023-24 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2024-25 is the **latest audited standalone General Purpose Financial Statements** published by the
council at 2026-11-19. The council has **not posted an FY2025-26 GPFS**. The accepted
current-available year is therefore FY2024-25; the connector targets `2024-25`, and its stale-year
guard rejects other years rather than silently substituting a 2025-26 or 2023-24 document.

## 1. Discovery and access log (with UA probe)

| Step                              | URL                                                                                          | HTTP    | Result                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| Official Integrated Planning and Reporting Reports page (plain UA) | <https://www.weddin.nsw.gov.au/Council/Integrated-Planning-and-Reporting/Reports> | **200** | `text/html`; lists the FY2024-25 statements and prior years.      |
| Audited FY2024-25 statements (plain client UA) | <https://www.weddin.nsw.gov.au/files/assets/public/v/1/council/plans-strategies-amp-reports/other-plans-amp-strategies/20251106-2024-2025-annual-financial-statements.pdf> | **200** | `application/pdf`, 5,166,514 bytes, 98 PDF pages.                     |
| Same PDF (bare Chrome UA)         | same URL                                                                                     | **403** | `text/html`, 599 bytes — WAF rejects a bare browser UA.                |

**Method recorded.** The host's Akamai WAF returns 200 `application/pdf` to a plain client UA and 403
to a bare Chrome UA. The connector therefore sends an explicit plain `curl/8.5.0` User-Agent (plus a
broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header is used
and contains no `Chrome` token.

The connector parses the official page, selects the FY2024-25 statements upload, and ignores annual
reports (including the annual-report PDF), annual-report-path prior years and other documents. A
documented official fallback pin is used only if the page yields no usable anchor. The exact bytes are
SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Annual Financial Statements 2024-2025 (2024 - 2025 Annual Financials Statements).
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.weddin.nsw.gov.au/files/assets/public/v/1/council/plans-strategies-amp-reports/other-plans-amp-strategies/20251106-2024-2025-annual-financial-statements.pdf`
- **Bytes:** 5,166,514.
- **PDF pages:** 98.
- **SHA-256:** `4c34af5f30efefc842b42c77f9f4b3b39567e98a40d598a8fc775aa66ddf309b`.
- **Archive:** `weddin-gpfs/` under the configured source-archive root (outside the repo; not
  committed). It holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256,
  content type) and the archive record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 4 (printed page 4 of 78). It prints `$ '000` for the 2025 columns.
The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2024-25 Actual column only.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               4,632
  User charges and fees                                  8,514
  Other revenues                                         1,301
  Grants and contributions provided for operating purposes 7,684
  Grants and contributions provided for capital purposes  6,831
  Interest and investment income                           573
  Other income                                             174
  Net gain from the disposal of assets                       – (nil)
  Total income from continuing operations                29,709
Expenses from continuing operations
  Employee benefits and on-costs                         7,794
  Materials and services                                16,151
  Borrowing costs                                          157
  Other expenses                                           399
  Net loss from the disposal of assets                   1,010
  Total expenses ... excluding depreciation             25,511
  Depreciation, amortisation and impairment              6,234
  Operating result from continuing operations           (2,036)
  Net operating result attributable to Council          (2,036)
  Net operating result before capital grants            (8,867)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `25,511` + depreciation/amortisation/impairment `6,234` = `31,745`,
which equals the B1-1 "Total functions and activities" expense total. Weddin prints seven non-zero
revenue lines (its net gain on disposal is nil and is not emitted) and five expense lines including a
net loss on disposal.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  4,632 + 8,514 + 1,301 + 7,684 + 6,831 + 573 + 174 = 29,709
  = printed Total income

expense components:
  7,794 + 16,151 + 157 + 399 + 1,010 = 25,511
  = printed expenses excluding depreciation

total expenses:
  25,511 + 6,234 = 31,745
  = printed B1-1 Total functions and activities expenses

operating result / net result:
  29,709 - 31,745 = (2,036)
  = printed Operating result and net result

before capital grants:
  (2,036) - 6,831 = (8,867)
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  7,684 + 6,831 = 14,515
  = printed B1-1 grants total

other comprehensive income:
  32,252 revaluation + 4,058 impairment reversal + 904 joint ventures = 37,214
  = printed Total other comprehensive income and Total items not reclassified

comprehensive income:
  (2,036) + 37,214 = 35,178
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2024-25 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    4,632 |    463,200,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |    8,514 |    851,400,000 | revenue  |
| `other_revenues`                        | Other revenues                               |    1,301 |    130,100,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |    7,684 |    768,400,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |    6,831 |    683,100,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |      573 |     57,300,000 | revenue  |
| `other_income`                          | Other income                                 |      174 |     17,400,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   29,709 |  2,970,900,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |    7,794 |    779,400,000 | expenses |
| `materials_and_services`                | Materials and services                       |   16,151 |  1,615,100,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |      157 |     15,700,000 | expenses |
| `other_expenses`                        | Other expenses                               |      399 |     39,900,000 | expenses |
| `net_loss_from_disposal_of_assets`      | Net loss from the disposal of assets         |    1,010 |    101,000,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   25,511 |  2,551,100,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    6,234 |    623,400,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   31,745 |  3,174,500,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |  (2,036) |    203,600,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Weddin Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The negative net result is stored as a
non-negative magnitude with `gpfs_printed_sign: "negative"`.

## 6. No-total / no-cross-council rule

- Weddin Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page and the exact PDF (plain UA required; bare Chrome UA gets 403).
curl -sL -o /dev/null -w '%{http_code}\n' 'https://www.weddin.nsw.gov.au/Council/Integrated-Planning-and-Reporting/Reports'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.weddin.nsw.gov.au/files/assets/public/v/1/council/plans-strategies-amp-reports/other-plans-amp-strategies/20251106-2024-2025-annual-financial-statements.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27024/ausspend_test_weddingpfs" \
  npx vitest run --project server server/test/weddin-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2024-25
current-available acceptance and rejection of 2023-24/2025-26 substitutions, natural-key/idempotency,
no-cross-council totals, discovery/latest selection (including the documented official fallback pin)
and the plain-UA WAF header.
