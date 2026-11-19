# WA SOC — Busselton Water annual-report evidence

**Status:** implementation evidence only. This is the eighth WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Busselton Water — the Busselton Water Corporation — only, a WA GTE under the Government Trading
Enterprises Act 2023 (WA). **No WA total, no other WA GTE, no QLD/NSW SOC.** The 2026 column is used;
the 2025 column is never added.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step                     | URL                                                                                                                           | HTTP    | Result                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| Publications             | <https://www.busseltonwater.wa.gov.au/publications/>                                                                          | **200** | `text/html` (99,185 bytes); links to the annual-reports page.                               |
| Annual reports           | <https://www.busseltonwater.wa.gov.au/publications/annual-reports/>                                                           | **200** | `text/html` (79,350 bytes); lists annual reports 2009-10 to 2025-26 plus related PDFs.       |
| Latest report PDF        | <https://www.busseltonwater.wa.gov.au/wp-content/uploads/2026/10/FINAL-BW-2026-Annual-Report-digital.pdf>                     | **200** | `application/pdf`, 13,222,107 bytes, 70 PDF pages                                          |

The connector fetches the official annual-reports page and parses its PDF links. A link is accepted
only when its filename contains "annual report" and a year; annual water-quality reports, customer
newsletters and other publications are rejected by name. The PDF URL itself is never hard-coded;
`WA_BUSSELTON_WATER_ANNUAL_REPORT_URL` is the operator override.

## 2. Exact document

- **Title:** Busselton Water Annual Report 2026 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 13,222,107.
- **PDF pages:** 70.
- **SHA-256:** `332ea0978170f32b7975a4377e1745cfaa6bfdd7d2b7240647b16775dbb16415`.
- **Archive root:** `~/ausspend-source-archive/wa-busselton-water/` (outside the repo; not
  committed). It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, discovery
  page, retrieval date, bytes, pages and SHA-256. The connector archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Statement of Comprehensive Income is on PDF page 50 (printed page 50). It prints `$` (whole
dollars) for the 2026 and 2025 columns, not `$'000`. The unit gate requires **whole dollars**; a
`$'000`, `$M`, unit-less or ambiguous read is rejected.

The 2026 column prints:

```text
                                                                       2026
                                                                          $
EXPENSES
Employee benefit expenses                                         2,435,979
Cost of sales                                                     5,894,463
Depreciation and amortisation expenses                            3,990,995
Finance costs                                                        45,606
Administration expenses                                           2,180,862
Other expenses                                                    2,102,281
Loss on disposal of non-current assets                              105,532
Total expenses                                                   16,755,718
INCOME
Water sales revenue                                              13,471,006
Grants and contributions                                          7,740,176
Developer contributions - headworks                               1,151,665
Developer contributions - mains                                   1,100,781
Interest income                                                     441,380
Other revenue                                                       258,778
                                                                 24,163,786
Profit before income tax                                          7,408,068
Income tax equivalent expense                                    (1,852,017)
Profit after income tax                                           5,556,051
```

The statement prints a Total expenses subtotal and an **unlabeled** total-income row. The adapter
derives total revenue from the six income lines and checks it against that unlabeled printed total;
total expenses is the printed Total expenses, checked against the seven printed expense lines.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$` values:

```text
total expenses:
  2,435,979 + 5,894,463 + 3,990,995 + 45,606 + 2,180,862 + 2,102,281 + 105,532 = 16,755,718
  = printed Total expenses

total revenue:
  13,471,006 + 7,740,176 + 1,151,665 + 1,100,781 + 441,380 + 258,778 = 24,163,786
  = printed unlabeled total-income row

profit before income tax:
  24,163,786 - 16,755,718 = 7,408,068
  = printed Profit before income tax

net result:
  7,408,068 - 1,852,017 = 5,556,051
  = printed Profit after income tax
```

The adapter defers the document if any printed line is missing, if the unit is not whole dollars, if
the expense components do not sum to the printed Total expenses, if the income components do not
sum to the printed total-income row, or if any result bridge differs by one dollar. On the 2025-26
report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label                  |      `$` |  `amount_cents` | Sign             |
| --------------------------- | -------------------------------------- | -------: | --------------: | ---------------- |
| `total_revenue`             | Total revenue (derived)                | 24,163,786 | 2,416,378,600 | positive         |
| `total_expenses`            | Total expenses                         | 16,755,718 | 1,675,571,800 | positive expense |
| `employee_expenses`         | Employee benefit expenses              |  2,435,979 |   243,597,900 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation expenses |  3,990,995 |   399,099,500 | positive expense |
| `net_result`                | Profit after income tax                |  5,556,051 |   555,605,100 | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "WA"`, `delivery_entity: "Busselton Water"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Busselton Water is one WA GTE. No WA total, no national total and no sum with Water Corporation,
  Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, another WA
  GTE, a QLD/NSW SOC, a government program or the PNFC benchmark is created.
- The 2026 column is the reporting boundary; the prior-year column is not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern
  Ports and all QLD/NSW SOC rows are untouched by this adapter.

## 7. How to verify

```bash
# Official pages and exact PDF: expect 200.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.busseltonwater.wa.gov.au/publications/annual-reports/' | head -1
curl -sS -L -o /tmp/busselton-2026.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.busseltonwater.wa.gov.au/wp-content/uploads/2026/10/FINAL-BW-2026-Annual-Report-digital.pdf'
sha256sum /tmp/busselton-2026.pdf
# expect 332ea0978170f32b7975a4377e1745cfaa6bfdd7d2b7240647b16775dbb16415

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/wa-busselton-water/SHA256SUMS
cat ~/ausspend-source-archive/wa-busselton-water/retrieval.json

# Focused adapter tests
npx vitest run server/test/wa-busselton-water.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const bw = db.measures.countDocuments({source_id:"wa-busselton-water"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonBw = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"wa-busselton-water"}});
  print(JSON.stringify({bw, soc, nonBw, wa: db.measures.countDocuments({jurisdiction_level:"soc", jurisdiction:"WA"})}));
'
# expect {"bw":5,"soc":185,"nonBw":180,"wa":40}
```
