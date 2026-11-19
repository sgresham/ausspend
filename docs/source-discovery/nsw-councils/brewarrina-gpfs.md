# NSW council GPFS — Brewarrina Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Brewarrina Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                         | URL                                                                                                                  | HTTP    | Result                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| Official reporting page      | <https://brewarrina.nsw.gov.au/council/access-to-information/>                                                       | **200** | `text/html`; page loads but does **not** embed the financial-statements link. |
| Official media REST endpoint | <https://brewarrina.nsw.gov.au/wp-json/wp/v2/media?search=Financial%20Statements&per_page=100>                       | **200** | `application/json`; lists the standalone FY2025-26 PDF and prior years.       |
| Standalone GPFS PDF          | <https://brewarrina.nsw.gov.au/wp-content/uploads/2026/11/Brewarrina-Shire-Council-Financial-Statements-2025-26.pdf> | **200** | `application/pdf`, 2,817,948 bytes, 65 PDF pages.                             |

The Access to Information page does not link the statements, so the adapter discovers the document
from the council's own WordPress media REST response on the same official domain (never a
hard-coded document URL, never a mirror). It selects the FY2025-26 statement by its printed filename
and rejects the statutory presentation notice, the annual report and prior years.

## 2. Exact document

- **Title:** Brewarrina Shire Council Financial Statements 2025-26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://brewarrina.nsw.gov.au/wp-content/uploads/2026/11/Brewarrina-Shire-Council-Financial-Statements-2025-26.pdf`
- **Bytes:** 2,817,948.
- **PDF pages:** 65.
- **SHA-256:** `62b854e464ef03e796fbfd6edf552bf7fb6f349ceec410e8d3a4481f851e5528`.
- **Archive root:** `~/ausspend-source-archive/brewarrina-gpfs/` (outside the repo; not committed).
  It holds the exact PDF, the archive metadata (URL, retrieval date, bytes, SHA-256) and the archive
  record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4 of 65). It prints `$ '000` for the 2026
columns. The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is
rejected. The adapter reads the FY2025-26 Actual column only.

The current-year column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                                3,093
  User charges and fees                                  10,880
  Other revenues                                            891
  Grants and contributions provided for operating purposes 15,818
  Grants and contributions provided for capital purposes   9,041
  Interest and investment income                            923
  Other income                                              152
  Total income from continuing operations                 40,798
Expenses from continuing operations
  Employee benefits and on-costs                          8,022
  Materials and services                                 15,242
  Other expenses                                            540
  Net loss from the disposal of assets                      247
  Total expenses ... excluding depreciation              24,051
  Depreciation, amortisation and impairment               5,702
  Operating result from continuing operations            11,045
  Net operating result for the year attributable to Council 11,045
  Net operating result before capital grants               2,004
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `24,051` + depreciation/amortisation/impairment `5,702` = `29,753`,
which equals the B1-1 "Total functions and activities" expense total. Brewarrina prints no
borrowing-costs line, so four, not five, expense-by-nature components make up `24,051`.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  3,093 + 10,880 + 891 + 15,818 + 9,041 + 923 + 152 = 40,798
  = printed Total income

expense components:
  8,022 + 15,242 + 540 + 247 = 24,051
  = printed expenses excluding depreciation

total expenses:
  24,051 + 5,702 = 29,753
  = printed B1-1 Total functions and activities expenses

operating result:
  40,798 - 29,753 = 11,045
  = printed Operating result and net operating result

before capital grants:
  11,045 - 9,041 = 2,004
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  15,818 + 9,041 = 24,859
  = printed B1-1 grants total

comprehensive income:
  11,045 + 11,270 other comprehensive income = 22,315
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the FY2025-26 report there is no
deferral.

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    3,093 |    309,300,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |   10,880 |  1,088,000,000 | revenue  |
| `other_revenues`                        | Other revenues                               |      891 |     89,100,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |   15,818 |  1,581,800,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |    9,041 |    904,100,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |      923 |     92,300,000 | revenue  |
| `other_income`                          | Other income                                 |      152 |     15,200,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   40,798 |  4,079,800,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |    8,022 |    802,200,000 | expenses |
| `materials_and_services`                | Materials and services                       |   15,242 |  1,524,200,000 | expenses |
| `other_expenses`                        | Other expenses                               |      540 |     54,000,000 | expenses |
| `net_loss_from_disposal_of_assets`      | Net loss from the disposal of assets         |      247 |     24,700,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   24,051 |  2,405,100,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    5,702 |    570,200,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   29,753 |  2,975,300,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |   11,045 |  1,104,500,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Brewarrina Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Brewarrina Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# The reporting page is 200 but does not link the statements; the media API lists them.
curl -sL -o /dev/null -w '%{http_code}\n' 'https://brewarrina.nsw.gov.au/council/access-to-information/'
curl -sL -o /dev/null -w '%{http_code} %{content_type}\n' \
  'https://brewarrina.nsw.gov.au/wp-json/wp/v2/media?search=Financial%20Statements&per_page=100'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://brewarrina.nsw.gov.au/wp-content/uploads/2026/11/Brewarrina-Shire-Council-Financial-Statements-2025-26.pdf'

# Focused connector tests (13).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_brewarrina" \
  npx vitest run --project server server/test/brewarrina-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, stale-year rejection,
natural-key/idempotency, no-cross-council totals and discovery/latest selection.
