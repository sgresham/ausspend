# WA SOC — Southern Ports annual-report evidence

**Status:** implementation evidence only. This is the seventh WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Southern Ports — the Southern Ports Authority — only, a WA GTE under the Government Trading
Enterprises Act 2023 (WA) and the Port Authorities Act 1999 (WA). **No WA total, no other WA GTE, no
QLD/NSW SOC.** The 2026 column is used; the 2025 column is never added.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step                   | URL                                                                                                                           | HTTP    | Result                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| Official publications  | <https://www.southernports.com.au/governance/publications>                                                                     | **200** | `text/html` (241,859 bytes); lists annual reports 2022–2026 plus other PDFs.                |
| Latest report PDF      | <https://www.southernports.com.au/docs/default-source/report/annual-report-2026.pdf>                                           | **200** | `application/pdf`, 20,313,477 bytes, 124 PDF pages                                         |

The connector fetches the official publications page and parses its PDF links. Links are
de-duplicated by pathname (the page repeats each report with query parameters). A link is accepted
only when its filename contains “annual report” and a year-ended year. The strategic-direction
poster, the modern-slavery statement, corporate plans and the Statement of Corporate Intent are
rejected by name. The PDF URL itself is never hard-coded; `WA_SOUTHERN_PORTS_ANNUAL_REPORT_URL` is the
operator override.

## 2. Exact document

- **Title:** Southern Ports Annual Report 2026 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 20,313,477.
- **PDF pages:** 124.
- **SHA-256:** `3c2b9d228e8f381c1a0a34e4132d8ec46d2a0237e503052b7742d11535648aee`.
- **Archive root:** `~/ausspend-source-archive/wa-southern-ports/` (outside the repo; not
  committed). It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, discovery
  page, retrieval date, bytes, pages and SHA-256. The connector archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Statement of profit or loss and other comprehensive income is on PDF page 96 (printed page 96).
It prints `($’000)` for the 2026 and 2025 columns. The unit gate requires **`$’000` / thousands**; a
plain `$`, `$M` or unit-less read is rejected. The adapter reads the 2026 column only.

The 2026 column prints:

```text
                                                                       2026
                                                                   ($’000)
INCOME
Revenue                                                              183,700
Other income                                                          10,098
EXPENDITURE
Employee benefits expense                                            (60,378)
Contracts and services                                               (53,348)
Utilities                                                             (8,652)
Depreciation                                                         (18,211)
Impairment                                                              (732)
Materials and supplies                                                (8,218)
Government charges                                                    (7,275)
Finance costs                                                           (498)
Insurance                                                             (3,417)
Other expenses                                                        (8,270)
Profit before income tax                                              24,799
Income tax expense                                                    (7,848)
PROFIT FOR THE YEAR                                                   16,951
```

The face statement prints **no Total income and no Total expenses subtotal**. Total income is derived
as Revenue + Other income; total expenses is derived as the sum of the ten printed expense lines.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$’000` values:

```text
total income:
  183,700 + 10,098 = 193,798

total expenses:
  60,378 + 53,348 + 8,652 + 18,211 + 732 + 8,218 + 7,275 + 498 + 3,417 + 8,270 = 168,999

profit before income tax:
  193,798 - 168,999 = 24,799
  = printed Profit before income tax

net result:
  24,799 - 7,848 = 16,951
  = printed Profit for the year
```

The adapter defers the document if any printed line is missing, if the unit is not thousands, or if
either result bridge differs by one thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label           |   `$’000` |  `amount_cents` | Sign             |
| --------------------------- | ------------------------------- | --------: | --------------: | ---------------- |
| `total_revenue`             | Total revenue (derived)         |   193,798 |  19,379,800,000 | positive         |
| `total_expenses`            | Total expenses (derived)        |   168,999 |  16,899,900,000 | positive expense |
| `employee_expenses`         | Employee benefits expense       |    60,378 |   6,037,800,000 | positive expense |
| `depreciation_amortisation` | Depreciation                    |    18,211 |   1,821,100,000 | positive expense |
| `net_result`                | Profit for the year             |    16,951 |   1,695,100,000 | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "WA"`, `delivery_entity: "Southern Ports"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Southern Ports is one WA GTE. No WA total, no national total and no sum with Water Corporation,
  Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, another WA GTE, a QLD/NSW
  SOC, a government program or the PNFC benchmark is created.
- The 2026 column is the reporting boundary; the prior-year column is not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA and all
  QLD/NSW SOC rows are untouched by this adapter.

## 7. How to verify

```bash
# Official page and exact PDF: expect 200.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.southernports.com.au/governance/publications' | head -1
curl -sS -L -o /tmp/southern-2026.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.southernports.com.au/docs/default-source/report/annual-report-2026.pdf'
sha256sum /tmp/southern-2026.pdf
# expect 3c2b9d228e8f381c1a0a34e4132d8ec46d2a0237e503052b7742d11535648aee

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/wa-southern-ports/SHA256SUMS
cat ~/ausspend-source-archive/wa-southern-ports/retrieval.json

# Focused adapter tests
npx vitest run server/test/wa-southern-ports.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const sp = db.measures.countDocuments({source_id:"wa-southern-ports"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonSp = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"wa-southern-ports"}});
  print(JSON.stringify({sp, soc, nonSp, wa: db.measures.countDocuments({jurisdiction_level:"soc", jurisdiction:"WA"})}));
'
# expect {"sp":5,"soc":180,"nonSp":175,"wa":35}
```
