# NSW council GPFS — Hilltops Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Hilltops Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2024-25 column is used; the FY2023-24 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (latest audited, not current calendar)

FY2024-25 is the **latest audited standalone General Purpose Financial Statements** published by the
council at 2026-11-19. The council has **not published an FY2025-26 GPFS** yet. The brief's accepted
current-available year is therefore FY2024-25; the connector targets `2024-25`, and its stale-year
guard rejects other years rather than silently substituting a 2025-26 or 2023-24 document.

## 1. Discovery and access log

| Step                                     | URL                                                                                                                | HTTP    | Result                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------ |
| Official Council Policies and Plans page | <https://www.hilltops.nsw.gov.au/council/council-policies-plans/>                                                  | **200** | `text/html`; lists the FY2024-25 statements and prior years. |
| Audited FY2024-25 statements             | <https://www.hilltops.nsw.gov.au/wp-content/uploads/2025/08/Hilltops-Council-Annual-Financial-Statements-2025.pdf> | **200** | `application/pdf`, 5,068,393 bytes, 112 PDF pages.           |

The connector parses the official page, selects the FY2024-25 statements upload, and ignores annual
reports, public notices and prior years. A documented official fallback pin is used only if the page
yields no usable anchor. The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Hilltops Council Annual Financial Statements 2025.
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.hilltops.nsw.gov.au/wp-content/uploads/2025/08/Hilltops-Council-Annual-Financial-Statements-2025.pdf`
- **Bytes:** 5,068,393.
- **PDF pages:** 112.
- **SHA-256:** `80d1ddc794f8600628615d2aa0a30275daa1997b2a91655d650ed13d2be11eeb`.
- **Archive root:** `~/ausspend-source-archive/hilltops-gpfs/` (outside the repo; not committed). It
  holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256) and the archive
  record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4 of 83). It prints `$ '000` for the 2025
columns. The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is
rejected. The adapter reads the FY2024-25 Actual column only.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               28,042
  User charges and fees                                  16,950
  Other revenues                                          1,514
  Grants and contributions provided for operating purposes 15,478
  Grants and contributions provided for capital purposes  20,985
  Interest and investment income                          2,947
  Other income                                              724
  Net gain from the disposal of assets                       83
  Total income from continuing operations                 86,723
Expenses from continuing operations
  Employee benefits and on-costs                         23,947
  Materials and services                                 27,389
  Borrowing costs                                         1,084
  Other expenses                                          1,437
  Net loss from the disposal of assets                        – (nil)
  Total expenses ... excluding depreciation              53,857
  Depreciation, amortisation and impairment              24,161
  Operating result from continuing operations             8,705
  Net operating result before capital grants             (12,280)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `53,857` + depreciation/amortisation/impairment `24,161` = `78,018`,
which equals the B1-1 "Total functions and activities" expense total. Hilltops prints eight revenue
lines (including other income and a net gain on disposal) and four expense lines (including borrowing
costs). It has **no separate "Net operating result for the year attributable to Council" line**: the
net result is its printed "Operating result from continuing operations" line (`8,705`), read from the
last occurrence because the phrase also appears in the "excluding depreciation..." line.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  28,042 + 16,950 + 1,514 + 15,478 + 20,985 + 2,947 + 724 + 83 = 86,723
  = printed Total income

expense components:
  23,947 + 27,389 + 1,084 + 1,437 = 53,857
  = printed expenses excluding depreciation

total expenses:
  53,857 + 24,161 = 78,018
  = printed B1-1 Total functions and activities expenses

operating result:
  86,723 - 78,018 = 8,705
  = printed Operating result and net result

before capital grants:
  8,705 - 20,985 = (12,280)
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  15,478 + 20,985 = 36,463
  = printed B1-1 grants total

comprehensive income:
  8,705 + 24,300 other comprehensive income = 33,005
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2024-25 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                       | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | ------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                    |   28,042 |  2,804,200,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                       |   16,950 |  1,695,000,000 | revenue  |
| `other_revenues`                        | Other revenues                              |    1,514 |    151,400,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating        |   15,478 |  1,547,800,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital          |   20,985 |  2,098,500,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income              |    2,947 |    294,700,000 | revenue  |
| `other_income`                          | Other income                                |      724 |     72,400,000 | revenue  |
| `net_gain_from_disposal_of_assets`      | Net gain from the disposal of assets        |       83 |      8,300,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations     |   86,723 |  8,672,300,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs              |   23,947 |  2,394,700,000 | expenses |
| `materials_and_services`                | Materials and services                      |   27,389 |  2,738,900,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                             |    1,084 |    108,400,000 | expenses |
| `other_expenses`                        | Other expenses                              |    1,437 |    143,700,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation       |   53,857 |  5,385,700,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment   |   24,161 |  2,416,100,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)          |   78,018 |  7,801,800,000 | expenses |
| `net_result`                            | Operating result from continuing operations |    8,705 |    870,500,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Hilltops Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Hilltops Council is one entity. No council total, no state/national total and no sum with another
  council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark or the
  OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page lists the statements; the current upload is a native PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  'https://www.hilltops.nsw.gov.au/council/council-policies-plans/'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.hilltops.nsw.gov.au/wp-content/uploads/2025/08/Hilltops-Council-Annual-Financial-Statements-2025.pdf'

# Focused connector tests (15).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_hilltops" \
  npx vitest run --project server server/test/hilltops-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2024-25 stale-year
rejection and no-substitution of a different year, natural-key/idempotency, no-cross-council totals
and discovery/latest selection (including the documented official fallback pin).
