# WA SOC — Water Corporation annual-report evidence

**Status:** implementation evidence only. This is the first WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Water Corporation only — a WA GTE under the Government Trading Enterprises Act 2023 (WA).
**No WA total, no other WA GTE, no QLD/NSW SOC.** The Group current-year column is used; the
Corporation column and the consolidated subsidiary are never added.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step              | URL                                                                                                                            | HTTP    | Result                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------ |
| Official page     | <https://www.watercorporation.com.au/about-us/our-performance/annual-report>                                                     | **200** | `text/html` (238,401 bytes); lists annual reports 2020–2026, quarterly reports and the SCI. |
| Latest report PDF | Water Corporation CDN, `…/2026-annual-report/water-corporation-annual-report-2026.pdf?rev=…&hash=…`                              | **200** | `application/pdf`, 19,632,537 bytes, 70 PDF pages                                          |

The connector fetches the official annual report page and parses its PDF links. A link is accepted
only when its filename contains “Annual Report” and a year-ended year (e.g.
`water-corporation-annual-report-2026.pdf`, `annual-report-2023.pdf`). Quarterly performance reports,
the Statement of Corporate Intent and other publications are rejected by name. The PDF URL itself is
never hard-coded; `WA_WATER_CORPORATION_ANNUAL_REPORT_URL` is the operator override, and discovery
fails loudly rather than pinning a dead URL.

## 2. Exact document

- **Title:** Water Corporation Annual Report 2026 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 19,632,537.
- **PDF pages:** 70.
- **SHA-256:** `7e928be840af3096496f7bb38fc83fc15d9ef7b95836bb1e9565637538a69a9b`.
- **Archive root:** `~/ausspend-source-archive/wa-water-corporation/` (outside the repo; not
  committed). It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, discovery
  page, retrieval date, bytes, pages and SHA-256. The connector archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Statement of Comprehensive Income is on PDF page 46 (printed page 90). It prints `$M` for the
Group 2026/2025 and Corporation 2026/2025 columns. The unit gate requires **`$M` / millions**; a
plain `$`, `$'000` or unit-less read is rejected. The adapter reads the **Group 2026** column only.

The Group current-year column prints:

```text
                                                                  Group 2026
                                                                         $M
Revenue
Annual service charges                                                1,654
Volume charges                                                        1,012
Operating subsidies                                                     668
Developers’ contributions                                               419
Other revenue                                                           211
Total revenue                                                         3,964
Expenses
Depreciation and amortisation                                          (590)
Employee benefits expense                                              (533)
Hired and contracted services                                          (340)
Energy expenses                                                        (195)
Other expenses                                                         (486)
Total expenses                                                       (2,144)
Results from operating activities                                     1,820
Net finance costs                                                      (128)
Profit before income tax equivalent                                   1,692
Income tax equivalent expense                                          (534)
Profit for the year                                                   1,158
Remeasurements of defined benefits                                        1
Other comprehensive income/(loss), net of tax equivalent                  1
Total comprehensive income for the year                               1,159
```

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$M` values:

```text
revenue components:
  1,654 + 1,012 + 668 + 419 + 211 = 3,964
  = printed Total revenue

expense components:
  590 + 533 + 340 + 195 + 486 = 2,144
  = printed Total expenses

results from operating activities:
  3,964 - 2,144 = 1,820
  = printed Results from operating activities

profit before income tax equivalent:
  1,820 - 128 = 1,692
  = printed Profit before income tax equivalent

net result:
  1,692 - 534 = 1,158
  = printed Profit for the year

other comprehensive income:
  remeasurements 1 = printed Other comprehensive income/(loss) 1

total comprehensive income:
  1,158 + 1 = 1,159
  = printed Total comprehensive income for the year
```

The adapter defers the document if any printed line is missing, if the unit is not millions, if the
revenue or expense components do not sum to the printed subtotals, or if any result/OCI/comprehensive
bridge differs by one million. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed label                     |   `$M` |     `amount_cents` | Sign             |
| --------------------------- | --------------------------------- | -----: | -----------------: | ---------------- |
| `total_revenue`             | Total revenue                     |  3,964 |  396,400,000,000   | positive         |
| `total_expenses`            | Total expenses                    |  2,144 |  214,400,000,000   | positive expense |
| `employee_expenses`         | Employee benefits expense         |    533 |   53,300,000,000   | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation     |    590 |   59,000,000,000   | positive expense |
| `net_result`                | Profit for the year               |  1,158 |  115,800,000,000   | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "WA"`, `delivery_entity: "Water
Corporation"`, `aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Water Corporation is one WA GTE. No WA total, no national total and no sum with another WA GTE, a
  QLD/NSW SOC, a government program or the PNFC benchmark is created.
- The Group current-year column is the reporting boundary; the Corporation column and the
  consolidated subsidiary are not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- QLD and NSW SOC rows are untouched by this adapter.

## 7. How to verify

```bash
# Official page: expect 200 and the annual-report links.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.watercorporation.com.au/about-us/our-performance/annual-report' | head -1

# Exact PDF (from the page link): expect HTTP 200 and 19,632,537 bytes.
#   Save the discovered link, then:
sha256sum /tmp/watercorp-2026.pdf
# expect 7e928be840af3096496f7bb38fc83fc15d9ef7b95836bb1e9565637538a69a9b

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/wa-water-corporation/SHA256SUMS
cat ~/ausspend-source-archive/wa-water-corporation/retrieval.json

# Focused adapter tests
npx vitest run server/test/wa-water-corporation.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const wc = db.measures.countDocuments({source_id:"wa-water-corporation"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonWc = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"wa-water-corporation"}});
  print(JSON.stringify({wc, soc, nonWc}));
'
# expect {"wc":5,"soc":150,"nonWc":145}
```
