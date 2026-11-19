# NSW council GPFS — Coolamon Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Coolamon Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision

FY2025-26 is the **latest audited standalone combined General Purpose Financial Statements (including
the audit reports)** published by the council at 2026-11-19, for the year ended 30 June 2026. The
connector targets `2025-26`, and its stale-year guard rejects other years rather than silently
substituting a prior-year statement, annual report, GIPA/PID return or notice.

## 1. Discovery and access log

| Step                          | URL                                                                                                | HTTP    | Result                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| Official Integrated Planning and Reporting page | <https://coolamon.nsw.gov.au/integrated-planning-and-reporting>                    | **200** | `text/html`; currently exposes no usable combined-statements anchor.   |
| Audited FY2025-26 combined statements (council URL) | <https://coolamon.nsw.gov.au/s/Coolamon-Shire-Council-Combined-Financial-Statements-FY2026-inc-Audit-Reports.pdf> | **200** | `application/pdf`, redirects to the Squarespace CDN; 3,172,590 bytes. |
| Final CDN URL                 | <https://static1.squarespace.com/static/6119a6edaf35db238026cbe1/t/6ac446da51a2154d0c86e9d8/1791248090045/Coolamon+Shire+Council+Combined+Financial+Statements+FY2026+inc+Audit+Reports.pdf> | **200** | `application/pdf`, 109 PDF pages.                                      |

The connector parses the official page for a combined financial-statements anchor and, because the
page currently yields none, uses the documented official fallback pin. The council URL's redirect is
followed and the resolved CDN URL is recorded in the measure provenance alongside the council URL.
Annual reports, GIPA/PID returns, special-purpose statements, operational plans, long-term financial
plans and prior years are never selected. The exact bytes are SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Coolamon Shire Council Combined Financial Statements FY2026 inc Audit Reports.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Council URL:** `https://coolamon.nsw.gov.au/s/Coolamon-Shire-Council-Combined-Financial-Statements-FY2026-inc-Audit-Reports.pdf`
- **Resolved CDN URL:** `https://static1.squarespace.com/static/6119a6edaf35db238026cbe1/t/6ac446da51a2154d0c86e9d8/1791248090045/Coolamon+Shire+Council+Combined+Financial+Statements+FY2026+inc+Audit+Reports.pdf`
- **Bytes:** 3,172,590.
- **PDF pages:** 109.
- **SHA-256:** `2579c4bec349a2846c81229a6b95547b7ff3d98058ed898a2f4ce0b476c87833`.
- **Archive:** `coolamon-gpfs/` under the configured source-archive root (outside the repo; not
  committed). It holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256,
  content type) and the archive record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 5 (printed page 4 of 88). It prints `$ '000` for the 2026 columns.
The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2025-26 Actual column only.

The FY2025-26 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               4,870
  User charges and fees                                  8,529
  Other revenues                                           484
  Grants and contributions provided for operating purposes 10,940
  Grants and contributions provided for capital purposes  2,392
  Interest and investment income                          1,288
  Other income                                              503
  Net gain from the disposal of assets                      198
  Total income from continuing operations                29,204
Expenses from continuing operations
  Employee benefits and on-costs                        11,037
  Materials and services                                 7,615
  Borrowing costs                                           29
  Other expenses                                           485
  Total expenses ... excluding depreciation             19,166
  Depreciation, amortisation and impairment               5,689
  Operating result from continuing operations             4,349
  Net operating result attributable to Council            4,349
  Net operating result before capital grants              1,957
```

The statement prints **no Total expenses line** and **no net loss on disposal line**. Total expenses
is the printed face bridge: expenses-excluding-depreciation `19,166` +
depreciation/amortisation/impairment `5,689` = `24,855`, which equals the B1-1 "Total functions and
activities" expense total. Coolamon prints eight non-zero revenue lines (including other income and a
net gain on disposal) and four expense lines (including borrowing costs).

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  4,870 + 8,529 + 484 + 10,940 + 2,392 + 1,288 + 503 + 198 = 29,204
  = printed Total income

expense components:
  11,037 + 7,615 + 29 + 485 = 19,166
  = printed expenses excluding depreciation

total expenses:
  19,166 + 5,689 = 24,855
  = printed B1-1 Total functions and activities expenses

operating result / net result:
  29,204 - 24,855 = 4,349
  = printed Operating result and net result

before capital grants:
  4,349 - 2,392 = 1,957
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  10,940 + 2,392 = 13,332
  = printed B1-1 grants total

other comprehensive income:
  10,834 revaluation + 34 joint ventures = 10,868
  = printed Total other comprehensive income and Total items not reclassified

comprehensive income:
  4,349 + 10,868 = 15,217
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2025-26 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    4,870 |    487,000,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |    8,529 |    852,900,000 | revenue  |
| `other_revenues`                        | Other revenues                               |      484 |     48,400,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |   10,940 |  1,094,000,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |    2,392 |    239,200,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |    1,288 |    128,800,000 | revenue  |
| `other_income`                          | Other income                                 |      503 |     50,300,000 | revenue  |
| `net_gain_from_disposal_of_assets`      | Net gain from the disposal of assets         |      198 |     19,800,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   29,204 |  2,920,400,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |   11,037 |  1,103,700,000 | expenses |
| `materials_and_services`                | Materials and services                       |    7,615 |    761,500,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |       29 |      2,900,000 | expenses |
| `other_expenses`                        | Other expenses                               |      485 |     48,500,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   19,166 |  1,916,600,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    5,689 |    568,900,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   24,855 |  2,485,500,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |    4,349 |    434,900,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Coolamon Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Coolamon Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page and the exact PDF (council URL redirects to the Squarespace CDN).
curl -sL -o /dev/null -w '%{http_code}\n' 'https://coolamon.nsw.gov.au/integrated-planning-and-reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://coolamon.nsw.gov.au/s/Coolamon-Shire-Council-Combined-Financial-Statements-FY2026-inc-Audit-Reports.pdf'

# Focused connector tests (15).
TEST_MONGO_URL="mongodb://localhost:27020/ausspend_test_coolamongpfs" \
  npx vitest run --project server server/test/coolamon-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2025-26 stale-year
rejection and no-substitution of another year, natural-key/idempotency, no-cross-council totals and
discovery/latest selection (including the documented official fallback pin and resolved CDN URL).
