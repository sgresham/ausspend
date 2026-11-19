# NSW council GPFS — Kyogle Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Kyogle Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                            | URL                                                                                                                       | HTTP    | Result                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| Official IP&R reporting page    | <https://www.kyogle.nsw.gov.au/about-council/governance/integrated-planning-reporting>                                    | **200** | `text/html`; lists the current and prior statements plus annual reports.        |
| Current statements upload       | <https://www.kyogle.nsw.gov.au/sites/default/files/2026-11/2025-2026%20Annual%20Financial%20Statements.pdf>               | **200** | `application/pdf`, 3,552,048 bytes, 107 PDF pages.                              |
| Brief's earlier statements path | <https://www.kyogle.nsw.gov.au/sites/default/files/2026-10/Kyogle%20Council%20Annual%20Financial%20Statements%202026.pdf> | **200** | Same final PDF: identical 3,552,048 bytes and SHA-256 (an earlier upload path). |

The connector parses the official reporting page, selects the latest dated FY2025-26 statements
upload, and ignores annual reports, notices and prior years. A documented official fallback pin is
used only if the page yields no usable anchor. The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** 2025-2026 Annual Financial Statements.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.kyogle.nsw.gov.au/sites/default/files/2026-11/2025-2026%20Annual%20Financial%20Statements.pdf`
- **Bytes:** 3,552,048.
- **PDF pages:** 107.
- **SHA-256:** `a18538da7a8b093c25b43a8432b2022559eb11c8c54c2809c4e3c04079b614db`.
- **Archive root:** `~/ausspend-source-archive/kyogle-gpfs/` (outside the repo; not committed). It
  holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256) and the archive
  record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4 of 77). It prints `$ '000` for the 2026
columns. The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is
rejected. The adapter reads the FY2025-26 Actual column only.

The current-year column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               14,019
  User charges and fees                                  13,891
  Other revenues                                             84
  Grants and contributions provided for operating purposes 13,212
  Grants and contributions provided for capital purposes   63,823
  Interest and investment income                          2,021
  Net gain from the disposal of assets                        – (nil)
  Total income from continuing operations                107,050
Expenses from continuing operations
  Employee benefits and on-costs                          11,945
  Materials and services                                  16,445
  Borrowing costs                                            204
  Other expenses                                             350
  Net loss from the disposal of assets                        66
  Total expenses ... excluding depreciation               29,010
  Depreciation, amortisation and impairment               11,342
  Operating result from continuing operations             66,698
  Net operating result for the year attributable to Council 66,698
  Net operating result before capital grants               2,875
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `29,010` + depreciation/amortisation/impairment `11,342` = `40,352`,
which equals the B1-1 "Total functions and activities" expense total. Kyogle prints six non-zero
revenue lines (net gain on disposal is nil) and five expense lines (including borrowing costs and a
net loss on disposal).

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  14,019 + 13,891 + 84 + 13,212 + 63,823 + 2,021 = 107,050
  = printed Total income

expense components:
  11,945 + 16,445 + 204 + 350 + 66 = 29,010
  = printed expenses excluding depreciation

total expenses:
  29,010 + 11,342 = 40,352
  = printed B1-1 Total functions and activities expenses

operating result:
  107,050 - 40,352 = 66,698
  = printed Operating result and net operating result

before capital grants:
  66,698 - 63,823 = 2,875
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  13,212 + 63,823 = 77,035
  = printed B1-1 grants total

comprehensive income:
  66,698 + 34,623 other comprehensive income = 101,321
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the FY2025-26 report there is no
deferral.

## 5. Extracted entity rows (16, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |   14,019 |  1,401,900,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |   13,891 |  1,389,100,000 | revenue  |
| `other_revenues`                        | Other revenues                               |       84 |      8,400,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |   13,212 |  1,321,200,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |   63,823 |  6,382,300,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |    2,021 |    202,100,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |  107,050 | 10,705,000,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |   11,945 |  1,194,500,000 | expenses |
| `materials_and_services`                | Materials and services                       |   16,445 |  1,644,500,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |      204 |     20,400,000 | expenses |
| `other_expenses`                        | Other expenses                               |      350 |     35,000,000 | expenses |
| `net_loss_from_disposal_of_assets`      | Net loss from the disposal of assets         |       66 |      6,600,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   29,010 |  2,901,000,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |   11,342 |  1,134,200,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   40,352 |  4,035,200,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |   66,698 |  6,669,800,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Kyogle Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Kyogle Council is one entity. No council total, no state/national total and no sum with another
  council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark or the
  OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Reporting page lists the statements; the current upload is a native PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  'https://www.kyogle.nsw.gov.au/about-council/governance/integrated-planning-reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.kyogle.nsw.gov.au/sites/default/files/2026-11/2025-2026%20Annual%20Financial%20Statements.pdf'

# Focused connector tests (14).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_kyogle" \
  npx vitest run --project server server/test/kyogle-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, stale-year rejection,
natural-key/idempotency, no-cross-council totals and discovery/latest selection (including selecting
the latest dated upload and the documented official fallback pin).
