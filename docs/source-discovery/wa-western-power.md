# WA SOC — Western Power annual-report evidence

**Status:** implementation evidence only. This is the third WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Western Power — Electricity Networks Corporation trading as Western Power — only, a WA GTE under
the Electricity Corporations Act 2005 (WA). **No WA total, no other WA GTE, no QLD/NSW SOC.** The
current-year column is used; the prior-year column is never added.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step              | URL                                                                                                                           | HTTP    | Result                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| Official page     | <https://www.westernpower.com.au/about/reports-publications/annual-report/>                                                     | **200** | `text/html` (131,852 bytes); embeds the report PDF URLs in page JSON.                       |
| Latest report PDF | <https://www.westernpower.com.au/4a8589/siteassets/documents/reports/annual-report/2026-annual-report.pdf>                      | **200** | `application/pdf`, 65,292,260 bytes, 132 PDF pages                                         |

The connector fetches the official annual-report page, unescapes the HTML entities, and reads both
ordinary anchors and embedded JSON `"url":"…"` entries. A link is accepted only when its filename
contains “Annual Report” and a year-ended year (e.g. `2026-annual-report.pdf`,
`annual-report-2023-20230929.pdf`). The FY26 review factsheet, the Statement of Corporate Intent and
other publications are rejected by name. The PDF URL itself is never hard-coded;
`WA_WESTERN_POWER_ANNUAL_REPORT_URL` is the operator override.

## 2. Exact document

- **Title:** Western Power Annual Report 2026 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 65,292,260.
- **PDF pages:** 132.
- **SHA-256:** `fbded32ee826244c0fc54f11cbca48d848e45089d28e47a078d879c1142fd11e`.
- **Archive root:** `~/ausspend-source-archive/wa-western-power/` (outside the repo; not committed).
  It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, discovery page,
  retrieval date, bytes, pages and SHA-256. The connector archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Statement of comprehensive income is on PDF page 76 (printed page 76). It prints `$M` for the
2025/26 and 2024/25 (restated) columns. The unit gate requires **`$M` / millions**; a plain `$`,
`$'000` or unit-less read is rejected. The adapter reads the current **2025/26** column only.

The current-year column prints:

```text
                                                                       2025/26
                                                                           $M
Profit or Loss
Income
Revenue from rendering of services                                      2,548
Other income                                                               12
Total income                                                            2,560
Expenses
Materials and services                                                  (361)
Employee related expenses                                               (290)
Depreciation and amortisation expenses                                  (592)
Other expenses                                                          (296)
Total expense                                                         (1,539)
Net finance costs                                                       (338)
Profit before income tax equivalent expense                               683
Income tax equivalent expense                                           (196)
Profit for the reporting year, net of tax equivalent expense              487
```

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$M` values:

```text
income components:
  2,548 + 12 = 2,560
  = printed Total income

expense components:
  361 + 290 + 592 + 296 = 1,539
  = printed Total expense

profit before income tax equivalent expense:
  2,560 - 1,539 - 338 = 683
  = printed Profit before income tax equivalent expense

net result:
  683 - 196 = 487
  = printed Profit for the reporting year
```

The adapter defers the document if any printed line is missing, if the unit is not millions, if the
income or expense components do not sum to the printed subtotals, or if any result bridge differs by
one million. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed label                                  |   `$M` | `amount_cents`  | Sign             |
| --------------------------- | ---------------------------------------------- | -----: | --------------: | ---------------- |
| `total_revenue`             | Total income                                   |  2,560 | 256,000,000,000 | positive         |
| `total_expenses`            | Total expense                                  |  1,539 | 153,900,000,000 | positive expense |
| `employee_expenses`         | Employee related expenses                      |    290 |  29,000,000,000 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation expenses         |    592 |  59,200,000,000 | positive expense |
| `net_result`                | Profit for the reporting year                  |    487 |  48,700,000,000 | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "WA"`, `delivery_entity: "Western Power"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Western Power is one WA GTE. No WA total, no national total and no sum with Water Corporation,
  Synergy, another WA GTE, a QLD/NSW SOC, a government program or the PNFC benchmark is created.
- The current-year column is the reporting boundary; the prior-year column is not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Water Corporation, Synergy and all QLD/NSW SOC rows are untouched by this adapter.

## 7. How to verify

```bash
# Official page: expect 200 and the embedded report URLs.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.westernpower.com.au/about/reports-publications/annual-report/' | head -1

# Exact PDF: expect HTTP 200 and 65,292,260 bytes.
curl -sS -L -o /tmp/westernpower-2026.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.westernpower.com.au/4a8589/siteassets/documents/reports/annual-report/2026-annual-report.pdf'
sha256sum /tmp/westernpower-2026.pdf
# expect fbded32ee826244c0fc54f11cbca48d848e45089d28e47a078d879c1142fd11e

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/wa-western-power/SHA256SUMS
cat ~/ausspend-source-archive/wa-western-power/retrieval.json

# Focused adapter tests
npx vitest run server/test/wa-western-power.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const wp = db.measures.countDocuments({source_id:"wa-western-power"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonWp = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"wa-western-power"}});
  print(JSON.stringify({wp, soc, nonWp, wa: db.measures.countDocuments({jurisdiction_level:"soc", jurisdiction:"WA"})}));
'
# expect {"wp":5,"soc":160,"nonWp":155,"wa":15}
```
