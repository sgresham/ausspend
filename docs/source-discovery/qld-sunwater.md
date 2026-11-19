# QLD SOC — Sunwater Limited annual-report evidence

**Status:** implementation evidence only. The exact PDF is archived outside the repo; no PDF or raw
table is committed. **Entity:** Sunwater Limited only — a Queensland Government Owned Corporation
(GOC), not a statutory body.
**No QLD total, no Energy Queensland / CS Energy / Stanwell / Powerlink inclusion, and no other
QLD GOC/statutory body/state entity.**

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                  | URL                                                                                                                           | HTTP    | Result                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| Official publications | <https://www.sunwater.com.au/about/publications>                                                                              | **200** | `text/html` (119,749 bytes); lists annual reports, scheme statistics, SCI and other publications.           |
| Latest annual report  | <https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Sunwater_2025-26_Annual_Report.pdf>                    | **200** | `application/pdf`, 3,667,807 bytes, 141 PDF pages                                                         |

The connector fetches the publications page and parses its PDF links. A link is accepted only when
its filename contains “Annual Report” and a consecutive financial-year span (`2025-26`,
`2024-2025`, `22-23`). Scheme-statistics PDFs (`Water_supply_scheme_statistics_*.pdf`), the
Statement of Corporate Intent and environmental/other publications are rejected by name. The PDF URL
itself is never hard-coded.

## 2. Exact document

- **Title:** Sunwater Annual Report 2025–26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Sunwater_2025-26_Annual_Report.pdf`
- **Bytes:** 3,667,807.
- **PDF pages:** 141.
- **SHA-256:** `09ab5654a76e33437b63011a5e3b53762f96d6936696f0946fb3eb46da67145e`.
- **Archive root:** `~/ausspend-source-archive/qld-sunwater/` (outside the repo; not committed).
  It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, retrieval date, bytes,
  pages and SHA-256. The connector archives the same bytes under `AUSSPEND_SOURCE_ARCHIVE` at
  runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The consolidated statement of profit or loss and other comprehensive income is on PDF page 53
(printed page 50). Its header prints `$’000` for both the 2026 and 2025 columns. Note 3B: Employee
benefits is on PDF page 63 (printed page 60) and also prints `$’000`. The unit gate therefore
requires **`$’000` / thousands** on both pages; a `$m`, plain `$` or unit-less read is rejected.

The face statement prints:

```text
                                                                             2026       2025
                                                                          $’000      $’000
Revenue from contracts with customers                                     397,160    452,546
Other income                                                               20,674     16,754
Total revenue and other income                                            417,834    469,300
Expenses
Operating expenditure                                                    (152,458)  (163,532)
Employee benefits                                                         (94,136)   (90,092)
Depreciation and amortisation                                             (48,176)   (46,394)
Impairment of assets                                                     (172,098)  (150,372)
Loss on disposal of assets                                                    (85)       (56)
Operating profit                                                          (49,119)    18,854
Finance costs                                                             (18,797)   (17,230)
Profit before income tax                                                  (67,916)     1,624
Income tax credit                                                               -          -
Profit for the year                                                       (67,916)     1,624
Other comprehensive income                                                      -          -
Total comprehensive income for the year                                   (67,916)     1,624
```

Note 3B prints the employee-benefits components and the total (PDF page 63):

```text
                                                                             2026       2025
                                                                          $’000      $’000
Salaries and allowances                                                    63,919     61,445
Annual leave, banked time and time off in lieu (TOIL)                       8,666      8,128
Long service leave expenses                                                 2,256      2,110
Employer superannuation contributions                                      11,358     10,538
Workers’ compensation premium                                                 239        219
Payroll tax                                                                 5,732      5,241
Other employee-related expenses                                             1,966      2,411
Total employee benefits                                                    94,136     90,092
```

The face statement prints a **Total revenue and other income** line but no **Total expenses**
subtotal. `Income tax credit` prints a nil marker (`-`), read as a printed zero.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$’000` values:

```text
total revenue and other income:
  397,160 + 20,674 = 417,834
  = printed Total revenue and other income

total expenses (derived):
  152,458 + 94,136 + 48,176 + 172,098 + 85 = 466,953

operating profit:
  417,834 - 466,953 = (49,119)
  = printed Operating profit

profit before income tax:
  (49,119) + (18,797) = (67,916)
  = printed Profit before income tax

net result:
  (67,916) + 0 = (67,916)
  = printed Profit for the year

Note 3B:
  Total employee benefits 94,136 = face Employee benefits 94,136
```

The adapter defers the document if any printed line is missing, if either page's unit is not
thousands, if Total revenue and other income does not equal Revenue from contracts with customers +
Other income, if Note 3B's total does not equal the face Employee benefits line, or if any bridge
differs by one thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label                  |   `$’000` |  `amount_cents` | Sign             |
| --------------------------- | -------------------------------------- | --------: | --------------: | ---------------- |
| `total_revenue`             | Total revenue and other income         |   417,834 |  41,783,400,000 | positive         |
| `total_expenses`            | Total expenses (derived)               |   466,953 |  46,695,300,000 | positive expense |
| `employee_expenses`         | Employee benefits (face; Note 3B)      |    94,136 |   9,413,600,000 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation          |    48,176 |   4,817,600,000 | positive expense |
| `net_result`                | Profit for the year                    |    67,916 |   6,791,600,000 | printed negative |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "QLD"`, `delivery_entity: "Sunwater
Limited"`, `aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Sunwater is a single entity. No QLD total, no national total and no sum with Energy Queensland,
  CS Energy, Stanwell, Powerlink Queensland, another GOC, a statutory body or another state is
  created.
- The consolidated parent is the reporting boundary; subsidiaries are not added as separate rows.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series. They are never added to government program spending or to the ABS GFS
  PNFC benchmark.
- Energy Queensland, CS Energy, Stanwell and Powerlink Queensland rows are untouched by this
  adapter.

## 7. How to verify

```bash
# Official pages: expect 200 for the publications page and the exact PDF.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.sunwater.com.au/about/publications' | head -1
curl -sS -L -o /tmp/sunwater-2025-26.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.sunwater.com.au/wp-content/uploads/Home/About/Publications/Sunwater_2025-26_Annual_Report.pdf'
sha256sum /tmp/sunwater-2025-26.pdf
# expect 09ab5654a76e33437b63011a5e3b53762f96d6936696f0946fb3eb46da67145e

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/qld-sunwater/SHA256SUMS
cat ~/ausspend-source-archive/qld-sunwater/retrieval.json

# Focused adapter tests
npx vitest run server/test/qld-sunwater.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const sun = db.measures.countDocuments({source_id:"qld-sunwater"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonSun = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"qld-sunwater"}});
  print(JSON.stringify({sun, soc, nonSun, powerlink: db.measures.countDocuments({source_id:"qld-powerlink"})}));
'
# expect {"sun":5,"soc":130,"nonSun":125,"powerlink":5}
```
