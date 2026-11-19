# NSW council GPFS — Uralla Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Uralla Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                                            | URL                                                                                                                                                  | HTTP    | Result                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| Official Council Reporting and Performance page | <https://www.uralla.nsw.gov.au/Your-Council/Council-plans-reporting-and-documents/Council-reporting-and-performance>                                 | **200** | `text/html`; lists the signed audited financial statements and prior years.                       |
| Signed FY2025-26 statements                     | <https://www.uralla.nsw.gov.au/files/assets/public/v/1/council/financial-statements/uralla_financial_statements-2026-signed-by-council.pdf>          | **200** | `application/pdf`, 1,293,828 bytes, 97 PDF pages.                                                 |
| Brief's URL (1-page public notice)              | <https://www.uralla.nsw.gov.au/files/assets/public/v/1/templateimages/operational-plan-parts-1-5/general-purpose-financial-statements-2025-2026.pdf> | **200** | `application/pdf`, 135,915 bytes, **1 page** — a Section 418(3) public notice only; **not used**. |

The brief's byte count (135,915) is the one-page notice, not the statements. The connector parses the
official reporting page, selects the latest dated signed FY2025-26 statements upload, and ignores
annual reports, public notices and prior years. A documented official fallback pin is used only if the
page yields no usable anchor. The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Financial Statements for the year ended 30 June 2026.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.uralla.nsw.gov.au/files/assets/public/v/1/council/financial-statements/uralla_financial_statements-2026-signed-by-council.pdf`
- **Bytes:** 1,293,828.
- **PDF pages:** 97.
- **SHA-256:** `59cea26584613a39c6766c0ab62e9368ba34c0ea28299588492a9102b42927f8`.
- **Archive root:** `~/ausspend-source-archive/uralla-gpfs/` (outside the repo; not committed). It
  holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256) and the archive
  record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4 of 76). It prints `$ '000` for the 2026
columns. The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is
rejected. The adapter reads the FY2025-26 Actual column only.

The current-year column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                                8,953
  User charges and fees                                   6,216
  Other revenues                                          1,119
  Grants and contributions provided for operating purposes 13,108
  Grants and contributions provided for capital purposes  2,739
  Interest and investment income                          1,246
  Net gain from the disposal of assets                        – (nil)
  Total income from continuing operations                 33,381
Expenses from continuing operations
  Employee benefits and on-costs                         15,779
  Materials and services                                 10,948
  Borrowing costs                                           244
  Other expenses                                            362
  Net loss from the disposal of assets                    1,296
  Total expenses ... excluding depreciation              28,629
  Depreciation, amortisation and impairment               7,069
  Operating result from continuing operations             (2,317)
  Net operating result for the year attributable to Council (2,317)
  Net operating result before capital grants              (5,056)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `28,629` + depreciation/amortisation/impairment `7,069` = `35,698`,
which equals the B1-1 "Total functions and activities" expense total. Uralla prints six non-zero
revenue lines (its net gain on disposal is nil) and five expense lines (including borrowing costs and
a net loss on disposal).

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  8,953 + 6,216 + 1,119 + 13,108 + 2,739 + 1,246 = 33,381
  = printed Total income

expense components:
  15,779 + 10,948 + 244 + 362 + 1,296 = 28,629
  = printed expenses excluding depreciation

total expenses:
  28,629 + 7,069 = 35,698
  = printed B1-1 Total functions and activities expenses

operating result:
  33,381 - 35,698 = (2,317)
  = printed Operating result and net operating result

before capital grants:
  (2,317) - 2,739 = (5,056)
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  13,108 + 2,739 = 15,847
  = printed B1-1 grants total

comprehensive income:
  (2,317) + 18,821 other comprehensive income = 16,504
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the signed FY2025-26 report there is
no deferral.

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section                       |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | ----------------------------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    8,953 |    895,300,000 | revenue                       |
| `user_charges_and_fees`                 | User charges and fees                        |    6,216 |    621,600,000 | revenue                       |
| `other_revenues`                        | Other revenues                               |    1,119 |    111,900,000 | revenue                       |
| `government_grants_operating`           | Grants and contributions — operating         |   13,108 |  1,310,800,000 | revenue                       |
| `government_grants_capital`             | Grants and contributions — capital           |    2,739 |    273,900,000 | revenue                       |
| `interest_and_investment_income`        | Interest and investment income               |    1,246 |    124,600,000 | revenue                       |
| `total_revenue`                         | Total income from continuing operations      |   33,381 |  3,338,100,000 | revenue                       |
| `employee_expenses`                     | Employee benefits and on-costs               |   15,779 |  1,577,900,000 | expenses                      |
| `materials_and_services`                | Materials and services                       |   10,948 |  1,094,800,000 | expenses                      |
| `borrowing_costs`                       | Borrowing costs                              |      244 |     24,400,000 | expenses                      |
| `other_expenses`                        | Other expenses                               |      362 |     36,200,000 | expenses                      |
| `net_loss_from_disposal_of_assets`      | Net loss from the disposal of assets         |    1,296 |    129,600,000 | expenses                      |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   28,629 |  2,862,900,000 | expenses                      |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    7,069 |    706,900,000 | expenses                      |
| `total_expenses`                        | Total expenses (documented bridge)           |   35,698 |  3,569,800,000 | expenses                      |
| `net_result`                            | Net operating result attributable to Council |  (2,317) |    231,700,000 | result (negative sign marker) |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Uralla Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`. The `net_result` row stores a non-negative
magnitude and carries `gpfs_printed_sign: "negative"`.

## 6. No-total / no-cross-council rule

- Uralla Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Reporting page lists the signed statements; the current upload is a native PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  'https://www.uralla.nsw.gov.au/Your-Council/Council-plans-reporting-and-documents/Council-reporting-and-performance'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.uralla.nsw.gov.au/files/assets/public/v/1/council/financial-statements/uralla_financial_statements-2026-signed-by-council.pdf'

# Focused connector tests (14).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_uralla" \
  npx vitest run --project server server/test/uralla-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance (including a negative net
result), stale-year rejection, natural-key/idempotency, no-cross-council totals and discovery/latest
selection (including excluding the one-page public notice and the documented official fallback pin).
