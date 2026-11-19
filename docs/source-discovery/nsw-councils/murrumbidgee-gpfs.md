# NSW council GPFS — Murrumbidgee Council FY2024-25 evidence

**Status:** implementation evidence only. One council, one audited year. The exact PDF is archived
outside the repo; no PDF or raw table is committed. **Entity:** Murrumbidgee Council only.
**No council total, no state or national total, no OLG summary layer, no SOC/other council rows.**
The FY2024-25 column is used; the FY2023-24 comparative inside the statement is never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 0. Fiscal-year decision (current-available, not calendar)

FY2024-25 is the **latest audited year published** by the council at 2026-11-19. The council has
**not posted an FY2025-26 GPFS**. The accepted current-available year is therefore FY2024-25; the
connector targets `2024-25`, and its stale-year guard rejects other years rather than silently
substituting a 2025-26 or 2023-24 document.

The statement source is the council's **Appendix A Financial Information**, not the narrative annual
report.

## 1. Discovery and access log (with UA probe)

| Step                              | URL                                                                                          | HTTP    | Result                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| Official Annual Reports and Financial Statements page (plain UA) | <https://www.murrumbidgee.nsw.gov.au/My-council/Plans-strategies-policies-council-information/Reporting-our-progress/Annual-Reports-Financial-Statements> | **200** | `text/html`; lists Appendix A, Appendix B and the annual report. |
| Appendix A Financial Information (plain client UA) | <https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/1/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf> | **200** | `application/pdf`, 1,063,092 bytes; redirects to the `/v/2/` path. |
| Same PDF (bare Chrome UA)         | same URL                                                                                     | **403** | `text/html`, 554 bytes — WAF rejects a bare browser UA.                |

**Method recorded.** The host's Akamai WAF returns 200 `application/pdf` to a plain client UA and 403
to a bare Chrome UA. The connector therefore sends an explicit plain `curl/8.5.0` User-Agent (plus a
broad PDF/HTML `Accept`) for both the listing and the PDF; a focused test asserts that header is used
and contains no `Chrome` token.

The connector parses the official page, selects the FY2024-25 **Appendix A** anchor, and ignores the
narrative annual report, Appendix B Governance Report and prior years. A documented official fallback
pin is used only if the page yields no usable anchor. The exact bytes are SHA-256 re-verified before
parsing.

## 2. Exact document

- **Title:** Appendix A Financial Information.
- **Financial year:** 2024-25, for the year ended 30 June 2025.
- **Council URL:** `https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/1/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf`
- **Resolved URL:** `https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/2/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf`
- **Bytes:** 1,063,092.
- **PDF pages:** 100.
- **SHA-256:** `a279e11fdd620d4ea7f08794ea93e8671adafc502ed2e18069fe6b09ff9b0fc1`.
- **Archive:** `murrumbidgee-gpfs/` under the configured source-archive root (outside the repo; not
  committed). It holds the exact PDF plus archive metadata (URL, retrieval date, bytes, SHA-256,
  content type) and the archive record. The connector re-verifies the hash before parsing.

## 3. Printed unit and statement

The Income Statement is on PDF page 4 (printed page 4 of 71). It prints `$ '000` for the 2025 columns.
The unit gate requires **`$ '000` / thousands**; a plain `$`, `$M` or unit-less read is rejected. The
adapter reads the FY2024-25 Actual column only.

The FY2024-25 column prints (whole `$ '000`):

```text
Income from continuing operations
  Rates and annual charges                               6,893
  User charges and fees                                  3,184
  Other revenues                                           455
  Grants and contributions provided for operating purposes 9,519
  Grants and contributions provided for capital purposes  8,183
  Interest and investment income                         1,408
  Net gain from the disposal of assets                     360
  Other income                                             188
  Total income from continuing operations                30,190
Expenses from continuing operations
  Employee benefits and on-costs                        10,401
  Materials and services                                 7,404
  Borrowing costs                                            8
  Net loss from the disposal of assets                       – (nil)
  Other expenses                                           713
  Total expenses ... excluding depreciation             18,526
  Depreciation, amortisation and impairment              8,550
  Operating result from continuing operations             3,114
  Net operating result attributable to Council            3,114
  Net operating result before capital grants             (5,069)
```

The statement prints **no Total expenses line** and its **net loss on disposal is nil for 2025**. The
2024 comparative (112) is never read. Total expenses is the printed face bridge:
expenses-excluding-depreciation `18,526` + depreciation/amortisation/impairment `8,550` = `27,076`,
which equals the B1-1 "Total functions and activities" expense total. Murrumbidgee prints eight
non-zero revenue lines (including a net gain on disposal and other income) and four non-zero expense
lines.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$ '000` values:

```text
revenue components:
  6,893 + 3,184 + 455 + 9,519 + 8,183 + 1,408 + 360 + 188 = 30,190
  = printed Total income

expense components:
  10,401 + 7,404 + 8 + 713 = 18,526
  = printed expenses excluding depreciation

total expenses:
  18,526 + 8,550 = 27,076
  = printed B1-1 Total functions and activities expenses

operating result / net result:
  30,190 - 27,076 = 3,114
  = printed Operating result and net result

before capital grants:
  3,114 - 8,183 = (5,069)
  = printed before-capital result (evidence only)

B1-1 grants and contributions:
  9,519 + 8,183 = 17,702
  = printed B1-1 grants total

other comprehensive income:
  revaluation of IPP&E 15,836 = 15,836
  = printed Total other comprehensive income for the period and Total items not reclassified
  (the intangible revaluation line is nil for 2025; the adapter's revaluation = total-OCI check
  rejects any non-zero second component rather than reading the 2024 comparative)

comprehensive income:
  3,114 + 15,836 = 18,950
  = printed Total comprehensive income
```

The adapter defers the document with **0 rows** if any printed line is missing, if the unit is not
thousands, or if any of these bridges differs by one thousand. On the audited FY2024-25 report there
is no deferral.

## 5. Extracted entity rows (17, non-additive)

| `gpfs_line_item`                        | Printed/derived label                        | `$ '000` | `amount_cents` | Section  |
| --------------------------------------- | -------------------------------------------- | -------: | -------------: | -------- |
| `rates_and_annual_charges`              | Rates and annual charges                     |    6,893 |    689,300,000 | revenue  |
| `user_charges_and_fees`                 | User charges and fees                        |    3,184 |    318,400,000 | revenue  |
| `other_revenues`                        | Other revenues                               |      455 |     45,500,000 | revenue  |
| `government_grants_operating`           | Grants and contributions — operating         |    9,519 |    951,900,000 | revenue  |
| `government_grants_capital`             | Grants and contributions — capital           |    8,183 |    818,300,000 | revenue  |
| `interest_and_investment_income`        | Interest and investment income               |    1,408 |    140,800,000 | revenue  |
| `net_gain_from_disposal_of_assets`      | Net gain from the disposal of assets         |      360 |     36,000,000 | revenue  |
| `other_income`                          | Other income                                 |      188 |     18,800,000 | revenue  |
| `total_revenue`                         | Total income from continuing operations      |   30,190 |  3,019,000,000 | revenue  |
| `employee_expenses`                     | Employee benefits and on-costs               |   10,401 |  1,040,100,000 | expenses |
| `materials_and_services`                | Materials and services                       |    7,404 |    740,400,000 | expenses |
| `borrowing_costs`                       | Borrowing costs                              |        8 |        800,000 | expenses |
| `other_expenses`                        | Other expenses                               |      713 |     71,300,000 | expenses |
| `total_expenses_excluding_depreciation` | Total expenses excluding depreciation        |   18,526 |  1,852,600,000 | expenses |
| `depreciation_amortisation_impairment`  | Depreciation, amortisation and impairment    |    8,550 |    855,000,000 | expenses |
| `total_expenses`                        | Total expenses (documented bridge)           |   27,076 |  2,707,600,000 | expenses |
| `net_result`                            | Net operating result attributable to Council |    3,114 |    311,400,000 | result   |

Every row is `jurisdiction_level: "local"`, `jurisdiction: "NSW"`,
`delivery_entity: "Murrumbidgee Council"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional/local_government"`.
Government grant rows carry `potential_double_count: true`.

## 6. No-total / no-cross-council rule

- Murrumbidgee Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC benchmark
  or the OLG summary layer is created.
- The FY2024-25 column is the reporting boundary; the FY2023-24 comparative is not added.
- Revenue, expenses, components and the net result overlap. They are published rows, not an additive
  spending series.
- Every row is `agency_detail` with no `region_id` and no `location`/LGA allocation.

## 7. How to verify

```bash
# Official page and the exact Appendix A PDF (plain UA required; bare Chrome UA gets 403).
curl -sL -o /dev/null -w '%{http_code}\n' 'https://www.murrumbidgee.nsw.gov.au/My-council/Plans-strategies-policies-council-information/Reporting-our-progress/Annual-Reports-Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  'https://www.murrumbidgee.nsw.gov.au/files/assets/public/v/1/publications/ip-and-r/a-report-2024-25/appendix-a-financial-information.pdf'

# Focused connector tests (17).
TEST_MONGO_URL="mongodb://localhost:27026/ausspend_test_murrumbidgeegpfs" \
  npx vitest run --project server server/test/murrumbidgee-gpfs.test.ts
```

The focused suite covers the unit gate, exact reconciliation/zero tolerance, FY2024-25
current-available acceptance and rejection of 2023-24/2025-26 substitutions, natural-key/idempotency,
no-cross-council totals, discovery/latest selection (Appendix A only, including the documented
official fallback pin and resolved `/v/2/` URL) and the plain-UA WAF header.
