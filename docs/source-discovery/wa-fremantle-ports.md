# WA SOC — Fremantle Ports annual-report evidence

**Status:** implementation evidence only. This is the fifth WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Fremantle Ports — the Fremantle Port Authority — only, a WA GTE under the Government Trading
Enterprises Act 2023 (WA) and the Port Authorities Act 1999 (WA). **No WA total, no other WA GTE, no
QLD/NSW SOC.** The 2026 column is used; the 2025 column is never added.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step                   | URL                                                                                                                           | HTTP    | Result                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| Official publications  | <https://www.fremantleports.com.au/publications>                                                                               | **200** | `text/html` (54,641 bytes); lists annual reports 2007–2026 (each twice with `?sfvrsn`).     |
| Latest report PDF      | <https://www.fremantleports.com.au/docs/default-source/annual-reports/244491-frepor-annual-report-2026-web---interactive.pdf>   | **200** | `application/pdf`, 19,999,051 bytes, 83 PDF pages                                          |

The connector fetches the official publications page and parses its PDF links. Links are
de-duplicated by pathname (the page lists each report with and without a `?sfvrsn` query; the
queryless URL wins). A link is accepted only when its filename contains “annual report” and a
year-ended year. The spreads version of the same report, trade overviews, sustainability reports and
the Statement of Corporate Intent are rejected by name. The PDF URL itself is never hard-coded;
`WA_FREMANTLE_PORTS_ANNUAL_REPORT_URL` is the operator override.

## 2. Exact document

- **Title:** Fremantle Ports Annual Report 2026 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 19,999,051.
- **PDF pages:** 83.
- **SHA-256:** `0ee59985460ad5d80adccd0c53ada8cc7d985f50f253f5855afa69a3bb942f04`.
- **Archive root:** `~/ausspend-source-archive/wa-fremantle-ports/` (outside the repo; not
  committed). It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, discovery
  page, retrieval date, bytes, pages and SHA-256. The connector archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Statement of Comprehensive Income is on PDF page 40 (printed pages 76–77). It prints `$’000` for
the 2026 and 2025 columns. The unit gate requires **`$’000` / thousands**; a plain `$`, `$M` or
unit-less read is rejected. The adapter reads the 2026 column only.

The 2026 column prints:

```text
                                                                       2026
                                                                     $’000
Income
Revenue                                                              315,544
Interest income                                                        6,801
Expenditure
Employee benefits                                                    (70,538)
Service and maintenance                                              (48,227)
Contracts and consultants                                            (35,316)
Government charges                                                   (10,782)
Utilities                                                              (7,914)
Insurance                                                              (5,893)
Other expenses                                                       (21,431)
Depreciation and amortisation                                        (26,868)
Finance costs                                                          (7,992)
Profit before income tax                                              87,384
Income tax expense                                                   (26,363)
Profit after income tax for the year                                  61,021
```

The statement prints **no Total income and no Total expenses subtotal**. Total income is derived as
Revenue + Interest income; total expenses is derived as the sum of the nine printed expense lines.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$’000` values:

```text
total income:
  315,544 + 6,801 = 322,345

total expenses:
  70,538 + 48,227 + 35,316 + 10,782 + 7,914 + 5,893 + 21,431 + 26,868 + 7,992 = 234,961

profit before income tax:
  322,345 - 234,961 = 87,384
  = printed Profit before income tax

net result:
  87,384 - 26,363 = 61,021
  = printed Profit after income tax for the year
```

The adapter defers the document if any printed line is missing, if the unit is not thousands, or if
either result bridge differs by one thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label                    |   `$’000` |  `amount_cents` | Sign             |
| --------------------------- | ---------------------------------------- | --------: | --------------: | ---------------- |
| `total_revenue`             | Total revenue (derived)                  |   322,345 |  32,234,500,000 | positive         |
| `total_expenses`            | Total expenses (derived)                 |   234,961 |  23,496,100,000 | positive expense |
| `employee_expenses`         | Employee benefits                        |    70,538 |   7,053,800,000 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation            |    26,868 |   2,686,800,000 | positive expense |
| `net_result`                | Profit after income tax for the year     |    61,021 |   6,102,100,000 | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "WA"`, `delivery_entity: "Fremantle Ports"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Fremantle Ports is one WA GTE. No WA total, no national total and no sum with Water Corporation,
  Synergy, Western Power, Horizon Power, another WA GTE, a QLD/NSW SOC, a government program or the
  PNFC benchmark is created.
- The 2026 column is the reporting boundary; the prior-year column is not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Water Corporation, Synergy, Western Power, Horizon Power and all QLD/NSW SOC rows are untouched by
  this adapter.

## 7. How to verify

```bash
# Official page and exact PDF: expect 200.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.fremantleports.com.au/publications' | head -1
curl -sS -L -o /tmp/fremantle-2026.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.fremantleports.com.au/docs/default-source/annual-reports/244491-frepor-annual-report-2026-web---interactive.pdf'
sha256sum /tmp/fremantle-2026.pdf
# expect 0ee59985460ad5d80adccd0c53ada8cc7d985f50f253f5855afa69a3bb942f04

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/wa-fremantle-ports/SHA256SUMS
cat ~/ausspend-source-archive/wa-fremantle-ports/retrieval.json

# Focused adapter tests
npx vitest run server/test/wa-fremantle-ports.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const fp = db.measures.countDocuments({source_id:"wa-fremantle-ports"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonFp = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"wa-fremantle-ports"}});
  print(JSON.stringify({fp, soc, nonFp, wa: db.measures.countDocuments({jurisdiction_level:"soc", jurisdiction:"WA"})}));
'
# expect {"fp":5,"soc":170,"nonFp":165,"wa":25}
```
