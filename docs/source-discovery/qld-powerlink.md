# QLD SOC — Powerlink Queensland annual-report evidence

**Status:** implementation evidence only. The exact PDF is archived outside the repo; no PDF or raw
table is committed. **Entity:** Powerlink Queensland — Queensland Electricity Transmission
Corporation Limited — only (Queensland Government Owned Corporation under the GOC Act 1993 (Qld);
not a statutory body).
**No QLD total, no Energy Queensland / CS Energy / Stanwell inclusion, and no other QLD
GOC/statutory body/state entity.**

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                      | URL                                                                                                                                                                            | HTTP    | Result                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------- |
| Canonical reports page    | <https://www.powerlink.com.au/reports>                                                                                                                                         | **200** | `text/html`; lists annual-report landing pages (`/annual-report/annual-report-202526`). |
| Latest annual-report page | <https://www.powerlink.com.au/annual-report/annual-report-202526>                                                                                                              | **200** | `text/html`; carries the latest annual-report PDF link.                                 |
| Latest annual-report PDF  | <https://www.powerlink.com.au/sites/default/files/2026-10/Powerlink%20Queensland%20-%20Annual%20Report%20Sustainability%20Report%20and%20Financial%20Statements%202025-26.pdf> | **200** | `application/pdf`, 5,355,423 bytes, 136 PDF pages                                       |

The connector checks the canonical reports page first, parses the annual-report landing-page links,
and follows the newest landing page to its PDF. The PDF URL itself is never hard-coded. Standalone
sustainability reports, transmission annual-planning reports, submissions and newsletters are
rejected by name; the combined report is accepted because its filename names the Annual Report.

## 2. Exact document

- **Title:** Powerlink Queensland Annual Report, Sustainability Report and Financial Statements
  2025-26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.powerlink.com.au/sites/default/files/2026-10/Powerlink%20Queensland%20-%20Annual%20Report%20Sustainability%20Report%20and%20Financial%20Statements%202025-26.pdf`
- **Bytes:** 5,355,423.
- **PDF pages:** 136.
- **SHA-256:** `a4063d58b7c23169df1db3b9d38fb79aaa9e384a206ee7698df5b439d1c96e61`.
- **Archive root:** `~/ausspend-source-archive/qld-powerlink/` (outside the repo; not committed).
  It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, retrieval date, bytes,
  pages and SHA-256. The connector also archives the same bytes under `AUSSPEND_SOURCE_ARCHIVE` at
  runtime.

## 3. Printed unit and statement

The consolidated statement of profit or loss and other comprehensive income is on PDF page 74
(printed page 73). Its header prints `$'000` for both the 2026 and 2025 columns. Note 3: Expenses is
on PDF page 85 (printed page 84) and also prints `$'000`. The unit gate therefore requires
**`$'000` / thousands** on both pages; a `$m`, plain `$` or unit-less read is rejected.

The face statement has no printed **Total revenue** or **Total expenses** subtotal. It prints:

```text
                                                                             2026       2025
                                                                          $'000      $'000
Revenue                                                               1,202,830  1,275,198
Other gains/(losses)                                                       (997)    (5,752)
Expenses from continuing operations                                    (966,901)  (883,045)
Impairment losses                                                      (133,191)          -
PROFIT FROM CONTINUING OPERATIONS                                       101,741    386,401
Finance income                                                           25,999     39,830
Finance costs                                                          (311,741)  (279,012)
NET FINANCE COSTS                                                      (285,742)  (239,182)
PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT                             (184,001)   147,219
Income tax equivalent benefit/(expense)                                  55,123    (44,233)
PROFIT/(LOSS) FOR THE YEAR                                             (128,878)   102,986
```

Note 3 prints the expense components and the employee memo:

```text
                                                                             2026       2025
                                                                          $'000      $'000
Network operations                                                       52,640     48,668
Network maintenance                                                     212,218    186,139
Corporate/business support                                              185,427    134,561
Customer works and other activities                                      61,234     85,244
Depreciation and amortisation                                           455,382    428,433
TOTAL EXPENSES FROM CONTINUING OPERATIONS                               966,901    883,045
Employee benefit expense through the consolidated statement of profit
or loss                                                                 264,426    229,037
```

`Impairment losses` is printed as a nil marker (`-`) in the 2025 column; the adapter reads only the
2026 current-year column. `Employee benefit expense` is a memo **included within** the expense
components; it is not a sixth component and is never added.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$'000` values:

```text
Note 3 components:
  52,640 + 212,218 + 185,427 + 61,234 + 455,382 = 966,901
  = printed TOTAL EXPENSES FROM CONTINUING OPERATIONS
  = face Expenses from continuing operations

profit from continuing operations:
  1,202,830 + (997) - 966,901 - 133,191 = 101,741
  = printed PROFIT FROM CONTINUING OPERATIONS

net finance costs:
  25,999 + (311,741) = (285,742)
  = printed NET FINANCE COSTS

profit before tax:
  101,741 + (285,742) = (184,001)
  = printed PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT

total revenue:
  1,202,830 + (997) + 25,999 = 1,227,832

total expenses:
  966,901 + 133,191 + 311,741 = 1,411,833

total revenue less total expenses:
  1,227,832 - 1,411,833 = (184,001)
  = printed PROFIT/(LOSS) BEFORE INCOME TAX EQUIVALENT

net result:
  (184,001) + 55,123 = (128,878)
  = printed PROFIT/(LOSS) FOR THE YEAR
```

The adapter defers the document if any printed line is missing, if either page's unit is not
thousands, if the Note 3 components do not sum to the printed note total, if the note total does not
equal the face expense line, or if any bridge differs by one thousand. On the 2025-26 report the
deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label                  |   `$'000` |  `amount_cents` | Sign             |
| --------------------------- | -------------------------------------- | --------: | --------------: | ---------------- |
| `total_revenue`             | Total revenue (derived)                | 1,227,832 | 122,783,200,000 | positive         |
| `total_expenses`            | Total expenses (derived)               | 1,411,833 | 141,183,300,000 | positive expense |
| `employee_expenses`         | Employee benefit expense (Note 3 memo) |   264,426 |  26,442,600,000 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation          |   455,382 |  45,538,200,000 | positive expense |
| `net_result`                | Profit/(loss) for the year             |   128,878 |  12,887,800,000 | printed negative |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "QLD"`, `delivery_entity: "Powerlink
Queensland"`, `aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Powerlink is a single entity. No QLD total, no national total and no sum with Energy Queensland,
  CS Energy, Stanwell, another GOC, a statutory body or another state is created.
- The consolidated parent is the reporting boundary; subsidiaries are not added as separate rows.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series. They are never added to government program spending or to the ABS GFS
  PNFC benchmark.
- Energy Queensland, CS Energy and Stanwell rows are untouched by this adapter.

## 7. How to verify

```bash
# Official pages: expect 200 for the reports page and the latest annual-report page.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.powerlink.com.au/reports' | head -1
curl -sSI -L -A 'Mozilla/5.0' 'https://www.powerlink.com.au/annual-report/annual-report-202526' | head -1

# Exact PDF: expect HTTP 200 and 5,355,423 bytes.
curl -sS -L -o /tmp/powerlink-2025-26.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.powerlink.com.au/sites/default/files/2026-10/Powerlink%20Queensland%20-%20Annual%20Report%20Sustainability%20Report%20and%20Financial%20Statements%202025-26.pdf'
sha256sum /tmp/powerlink-2025-26.pdf
# expect a4063d58b7c23169df1db3b9d38fb79aaa9e384a206ee7698df5b439d1c96e61

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/qld-powerlink/SHA256SUMS
cat ~/ausspend-source-archive/qld-powerlink/retrieval.json

# Focused adapter tests
npx vitest run server/test/qld-powerlink.test.ts
```
