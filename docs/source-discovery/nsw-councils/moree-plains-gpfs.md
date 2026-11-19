# NSW council GPFS — Moree Plains Shire Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Moree Plains Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2024-25 column is used; the FY2023-24 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (latest audited, not current calendar)

FY2024-25 is the **latest audited standalone General Purpose Financial Statements** published by the
council at 2026-11-19. The council has **not published an FY2025-26 GPFS** yet. The brief's accepted
current-available year is therefore FY2024-25; the connector targets `2024-25`, and its stale-year
guard rejects other years rather than silently substituting a 2025-26 or 2020-21 document.

## 1. Discovery and access log

| Step                                                 | URL                                                                                                                    | HTTP    | Result                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| Official Annual Report and Financial Statements page | <https://www.mpsc.nsw.gov.au/budget/annual-report-and-financial-statements>                                            | **200** | `text/html`; lists the FY2024-25 statements and prior years.     |
| Audited FY2024-25 statements                         | <https://www.mpsc.nsw.gov.au/publications-documents/financial-statements/2911-2024-25-annual-financial-statement/file> | **200** | `application/pdf;charset=utf-8`, 1,999,180 bytes, 114 PDF pages. |

The document is served from an official `/file` endpoint (no `.pdf` suffix). The connector parses the
official page, accepts both `.pdf`/`.pdf.aspx` and `/file` document links, selects the FY2024-25
statement upload, and ignores annual reports, notices and prior years. A documented official fallback
pin is used only if the page yields no usable anchor. The exact bytes are SHA-256 re-verified before
parsing.

## 2. Exact document

- **Title:** Moree Plains Shire Council 2024-25 Annual Financial Statement.
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **URL:** `https://www.mpsc.nsw.gov.au/publications-documents/financial-statements/2911-2024-25-annual-financial-statement/file`
- **Bytes:** 1,999,180.
- **PDF pages:** 114.
- **SHA-256:** `dee19c9e693ccd0e95d76ae52f27133393479e7a8099f8071bc08bcc9425edef`.
- **Archive root:** `~/ausspend-source-archive/moree-plains-gpfs/` (outside the repo; not committed).
  It holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256) and the archive
  record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4 of 87). It prints `$ '000` for the 2025
columns. The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is
rejected. The adapter reads the FY2024-25 Actual column only.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               34,036
  User charges and fees                                  20,301
  Other revenues                                          2,368
  Grants and contributions provided for operating purposes 18,179
  Grants and contributions provided for capital purposes  15,248
  Interest and investment income                          2,006
  Total income from continuing operations                 92,138
Expenses from continuing operations
  Employee benefits and on-costs                         24,862
  Materials and services                                 37,280
  Borrowing costs                                         2,549
  Other expenses                                          1,210
  Net loss from the disposal of assets                      968
  Total expenses ... excluding depreciation              66,869
  Depreciation, amortisation and impairment              19,793
  Operating result from continuing operations             5,476
  Net operating result for the year attributable to Council 5,476
  Net operating result before capital grants              (9,772)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `66,869` + depreciation/amortisation/impairment `19,793` = `86,662`,
which equals the B1-1 "Total functions and activities" expense total. Moree Plains prints six revenue
lines (no other-income or net-gain line) and five expense lines (including borrowing costs and a net
loss on disposal).

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  34,036 + 20,301 + 2,368 + 18,179 + 15,248 + 2,006 = 92,138
  = printed Total income

expense components:
  24,862 + 37,280 + 2,549 + 1,210 + 968 = 66,869
  = printed expenses excluding depreciation

total expenses:
  66,869 + 19,793 = 86,662
  = printed B1-1 Total functions and activities expenses

operating result:
  92,138 - 86,662 = 5,476
  = printed Operating result and net operating result

before capital grants:
  5,476 - 15,248 = (9,772)
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  18,179 + 15,248 = 33,427
  = printed B1-1 grants total

comprehensive income:
  5,476 + 22,090 other comprehensive income = 27,566
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2024-25 report there
is no deferral.

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |   34,036 |  3,403,600,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |   20,301 |  2,030,100,000 | revenue  |
| `other_revenues`                        | Other revenues                               |    2,368 |    236,800,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |   18,179 |  1,817,900,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |   15,248 |  1,524,800,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |    2,006 |    200,600,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   92,138 |  9,213,800,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |   24,862 |  2,486,200,000 | expenses |
| `materials_and_services`                | Materials and services                       |   37,280 |  3,728,000,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |    2,549 |    254,900,000 | expenses |
| `other_expenses`                        | Other expenses                               |    1,210 |    121,000,000 | expenses |
| `net_loss_from_disposal_of_assets`      | Net loss from the disposal of assets         |      968 |     96,800,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   66,869 |  6,686,900,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |   19,793 |  1,979,300,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   86,662 |  8,666,200,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |    5,476 |    547,600,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Moree Plains Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Moree Plains Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page lists the statements; the document is served from an official /file endpoint.
curl -sL -o /dev/null -w '%{http_code}\n' \
  'https://www.mpsc.nsw.gov.au/budget/annual-report-and-financial-statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.mpsc.nsw.gov.au/publications-documents/financial-statements/2911-2024-25-annual-financial-statement/file'

# Focused connector tests (15).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_moree" \
  npx vitest run --project server server/test/moree-plains-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2024-25 stale-year
rejection and no-substitution of a different year, natural-key/idempotency, no-cross-council totals
and discovery/latest selection (including `/file` links and the documented official fallback pin).
