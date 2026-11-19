# WA SOC — Synergy annual-report evidence

**Status:** implementation evidence only. This is the second WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Synergy only — a WA GTE (a corporation under the Electricity Corporations Act 2005 (WA)).
**No WA total, no other WA GTE, no QLD/NSW SOC.** The Group current-year column is used; the
Corporation column and subsidiaries are never added.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step                | URL                                                                                                                           | HTTP    | Result                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| Official index      | <https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports>                                                    | **200** | `text/html` (331,274 bytes); lists annual-report landing pages 2021–2026.                |
| Latest report page  | <https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports/Synergy-2026-annual-report>                          | **200** | `text/html` (341,315 bytes); carries the PDF link.                                      |
| Latest report PDF   | <https://www.synergy.net.au/-/media/Documents/Reports/Synergy-Annual-Report-2026.pdf>                                           | **200** | `application/pdf`, 12,603,580 bytes, 87 PDF pages                                       |

The connector fetches the official index, parses the annual-report landing-page links (e.g.
`/Annual-reports/Synergy-2026-annual-report`), follows the newest landing page and reads its PDF
link. No PDF URL is hard-coded. If the index itself links a PDF directly, that is used as a
fallback. `WA_SYNERGY_ANNUAL_REPORT_URL` is the operator override.

## 2. Exact document

- **Title:** Synergy Annual Report 2026 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 12,603,580.
- **PDF pages:** 87.
- **SHA-256:** `af9dede0f0ea729775df5a2acbf70e5cf67d7e780bc2850691586a0711e00707`.
- **Archive root:** `~/ausspend-source-archive/wa-synergy/` (outside the repo; not committed). It
  contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, discovery page, retrieval
  date, bytes, pages and SHA-256. The connector archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Statement of profit or loss is on PDF page 55 (printed page 108). It prints `$'000` for the Group
2026/2025 and Corporation 2026/2025 columns. The unit gate requires **`$'000` / thousands**; a plain
`$`, `$M` or unit-less read is rejected. The adapter reads the **Group 2026** column only.

The Group current-year column prints:

```text
                                                                  Group 2026
                                                                       $'000
Sales revenue                                                        3,523,507
Other revenue                                                          384,650
Total revenue                                                        3,908,157
Fuel, networks and other direct costs                               (3,362,040)
Materials and services                                                (111,891)
Employee expenses                                                     (220,605)
Other expenses                                                        (257,100)
Depreciation and amortisation                                         (165,236)
Other impairment expenses                                              (84,802)
Total expenses                                                      (4,201,674)
Other operating income                                                  12,211
Finance income                                                           6,230
Finance costs                                                         (107,763)
Net finance costs                                                     (101,533)
Share of profit from joint ventures                                          -
Share of profit from associates                                            408
Loss before tax                                                       (382,431)
Income tax expense                                                        (166)
Loss for the year                                                     (382,597)
```

`Share of profit from joint ventures` prints a nil marker (`-`) in the current-year column, read as a
printed zero.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$'000` values:

```text
revenue components:
  3,523,507 + 384,650 = 3,908,157
  = printed Total revenue

expense components:
  3,362,040 + 111,891 + 220,605 + 257,100 + 165,236 + 84,802 = 4,201,674
  = printed Total expenses

net finance costs:
  6,230 - 107,763 = (101,533)
  = printed Net finance costs

loss before tax:
  3,908,157 - 4,201,674 + 12,211 + (101,533) + 0 + 408 = (382,431)
  = printed Loss before tax

loss for the year:
  (382,431) + (166) = (382,597)
  = printed Loss for the year
```

The adapter defers the document if any printed line is missing, if the unit is not thousands, if the
revenue or expense components do not sum to the printed subtotals, or if any result bridge differs by
one thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed label                  |   `$’000` |  `amount_cents` | Sign             |
| --------------------------- | ------------------------------ | --------: | --------------: | ---------------- |
| `total_revenue`             | Total revenue                  | 3,908,157 | 390,815,700,000 | positive         |
| `total_expenses`            | Total expenses                 | 4,201,674 | 420,167,400,000 | positive expense |
| `employee_expenses`         | Employee expenses              |   220,605 |  22,060,500,000 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation  |   165,236 |  16,523,600,000 | positive expense |
| `net_result`                | Loss for the year              |   382,597 |  38,259,700,000 | printed negative |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "WA"`, `delivery_entity: "Synergy"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Synergy is one WA GTE. No WA total, no national total and no sum with Water Corporation, another WA
  GTE, a QLD/NSW SOC, a government program or the PNFC benchmark is created.
- The Group current-year column is the reporting boundary; the Corporation column and subsidiaries
  are not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Water Corporation and all QLD/NSW SOC rows are untouched by this adapter.

## 7. How to verify

```bash
# Official index and latest report page: expect 200.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports' | head -1
curl -sSI -L -A 'Mozilla/5.0' 'https://www.synergy.net.au/About-us/News-and-announcements/Annual-reports/Synergy-2026-annual-report' | head -1

# Exact PDF: expect HTTP 200 and 12,603,580 bytes.
curl -sS -L -o /tmp/synergy-2026.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.synergy.net.au/-/media/Documents/Reports/Synergy-Annual-Report-2026.pdf'
sha256sum /tmp/synergy-2026.pdf
# expect af9dede0f0ea729775df5a2acbf70e5cf67d7e780bc2850691586a0711e00707

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/wa-synergy/SHA256SUMS
cat ~/ausspend-source-archive/wa-synergy/retrieval.json

# Focused adapter tests
npx vitest run server/test/wa-synergy.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const sy = db.measures.countDocuments({source_id:"wa-synergy"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonSy = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"wa-synergy"}});
  print(JSON.stringify({sy, soc, nonSy, wa: db.measures.countDocuments({jurisdiction_level:"soc", jurisdiction:"WA"})}));
'
# expect {"sy":5,"soc":155,"nonSy":150,"wa":10}
```
