# NSW council GPFS — Bogan Shire Council FY2025-26 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Bogan Shire Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2025-26 column is used; the FY2024-25 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                                                      | URL                                                                                                                   | HTTP    | Result                                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| Official IP&R reporting page                              | <https://bogan.nsw.gov.au/your-council/publications/integrated-planning-and-reporting>                                | **200** | `text/html`; document lists are rendered client-side and do not expose the standalone statements link to a plain fetch. |
| Official annual-report page                               | <https://bogan.nsw.gov.au/your-council/publications/integrated-planning-and-reporting/ip-r-documents/annual-report25> | **200** | `text/html`; links the 2024-25 annual report, not the standalone 2025-26 statements.                                    |
| Standalone financial statements (documented official pin) | <https://bogan.nsw.gov.au/ArticleDocuments/517/14.10.2026%20Annual_Financial_Statements-2026.pdf.aspx>                | **200** | `application/pdf`, 1,847,355 bytes, 104 PDF pages (genuine PDF despite `.pdf.aspx`).                                    |

The connector first tries the official Annual Report page for an FY2025-26 statements anchor. Because
the council's listing is client-side and exposes no such anchor to a plain fetch, it falls back to
the council's documented official `ArticleDocuments` pin for the exact standalone PDF (never a mirror
or search-engine copy). The bytes are still SHA-256 re-verified before parsing.

## 2. Exact document

- **Title:** Annual Financial Statements 2025-26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://bogan.nsw.gov.au/ArticleDocuments/517/14.10.2026%20Annual_Financial_Statements-2026.pdf.aspx`
- **Bytes:** 1,847,355.
- **PDF pages:** 104.
- **SHA-256:** `02132e1e7c7b6d4da20b5b8e2e14d26918fab026b1f64d0f59513fd846f0a779`.
- **Archive root:** `~/ausspend-source-archive/bogan-gpfs/` (outside the repo; not committed). It
  holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256) and the archive
  record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 6 (printed page 5). It prints `$ '000` for the 2026 columns. The
unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2025-26 Actual column only.

The current-year column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                                5,935
  User charges and fees                                  8,235
  Other revenues                                            261
  Grants and contributions provided for operating purposes 13,436
  Grants and contributions provided for capital purposes   6,701
  Interest and investment income                          1,363
  Other income                                              298
  Net gain from the disposal of assets                      158
  Total income from continuing operations                 36,387
Expenses from continuing operations
  Employee benefits and on-costs                         10,020
  Materials and services                                 13,597
  Borrowing costs                                            54
  Other expenses                                            265
  Total expenses ... excluding depreciation              23,936
  Depreciation, amortisation and impairment               6,659
  Operating result from continuing operations             5,792
  Net operating result for the year attributable to Council 5,792
  Net operating result before capital grants               (909)
```

The statement prints **no Total expenses line**. Total expenses is the printed face bridge:
expenses-excluding-depreciation `23,936` + depreciation/amortisation/impairment `6,659` = `30,595`,
which equals the B1-1 "Total functions and activities" expense total. Bogan prints eight revenue
lines (including a net gain on disposal) and four expense lines (including borrowing costs).

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  5,935 + 8,235 + 261 + 13,436 + 6,701 + 1,363 + 298 + 158 = 36,387
  = printed Total income

expense components:
  10,020 + 13,597 + 54 + 265 = 23,936
  = printed expenses excluding depreciation

total expenses:
  23,936 + 6,659 = 30,595
  = printed B1-1 Total functions and activities expenses

operating result:
  36,387 - 30,595 = 5,792
  = printed Operating result and net operating result

before capital grants:
  5,792 - 6,701 = (909)
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  13,436 + 6,701 = 20,137
  = printed B1-1 grants total

comprehensive income:
  5,792 + 15,304 other comprehensive income = 21,096
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the FY2025-26 report there is no
deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    5,935 |    593,500,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |    8,235 |    823,500,000 | revenue  |
| `other_revenues`                        | Other revenues                               |      261 |     26,100,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |   13,436 |  1,343,600,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |    6,701 |    670,100,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |    1,363 |    136,300,000 | revenue  |
| `other_income`                          | Other income                                 |      298 |     29,800,000 | revenue  |
| `net_gain_from_disposal_of_assets`      | Net gain from the disposal of assets         |      158 |     15,800,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   36,387 |  3,638,700,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |   10,020 |  1,002,000,000 | expenses |
| `materials_and_services`                | Materials and services                       |   13,597 |  1,359,700,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |       54 |      5,400,000 | expenses |
| `other_expenses`                        | Other expenses                               |      265 |     26,500,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   23,936 |  2,393,600,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    6,659 |    665,900,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   30,595 |  3,059,500,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |    5,792 |    579,200,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Bogan Shire Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Bogan Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# The reporting page is 200 but the document list is client-side; the .pdf.aspx pin is a real PDF.
curl -sL -o /dev/null -w '%{http_code}\n' \
  'https://bogan.nsw.gov.au/your-council/publications/integrated-planning-and-reporting'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://bogan.nsw.gov.au/ArticleDocuments/517/14.10.2026%20Annual_Financial_Statements-2026.pdf.aspx'

# Focused connector tests (14).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_bogan" \
  npx vitest run --project server server/test/bogan-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, stale-year rejection,
natural-key/idempotency, no-cross-council totals and discovery/latest selection (including the
documented official pin fallback).
