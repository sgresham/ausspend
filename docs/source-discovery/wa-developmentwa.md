# WA SOC — DevelopmentWA annual-report evidence

**Status:** implementation evidence only. This is the sixth WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
DevelopmentWA — the Western Australian Land Authority (WALA) — only, a WA GTE under the Government
Trading Enterprises Act 2023 (WA). **No WA total, no other WA GTE, no QLD/NSW SOC.** The WALA
statements are used; the separate Metropolitan Redevelopment Authority (MRA) statements in the same
report are not added. The 2026 column is used; the 2025 column is never added.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step                | URL                                                                                                                                 | HTTP    | Result                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| Official publications | <https://www.developmentwa.com.au/publications>                                                                                     | **200** | `text/html` (247,670 bytes); lists reports as edocman download links.                       |
| Latest report PDF   | <https://www.developmentwa.com.au/component/edocman/2257-2025-2026-annual-and-sustainability-report-developmentwa/download>          | **200** | `application/pdf`, 8,881,306 bytes, 174 PDF pages                                          |

The connector fetches the official publications page and parses its edocman `/download` links. A
link is accepted only when its slug names a DevelopmentWA/WALA annual report and a year span. MRA and
Landcorp predecessor annual reports, sustainability-only reports, the strategic plan, net-zero and
other plans, and the Statement of Corporate Intent are rejected by name. `viewdocument` variants are
de-duplicated. The PDF URL itself is never hard-coded; `WA_DEVELOPMENTWA_ANNUAL_REPORT_URL` is the
operator override.

## 2. Exact document

- **Title:** DevelopmentWA Annual and Sustainability Report 2025-26 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 8,881,306.
- **PDF pages:** 174.
- **SHA-256:** `e01d0c8fc12a21a16a862d49993b49e779a10489b27308b8271896c0e0691ca7`.
- **Archive root:** `~/ausspend-source-archive/wa-developmentwa/` (outside the repo; not committed).
  It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, discovery page,
  retrieval date, bytes, pages and SHA-256. The connector archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The WALA Statement of profit or loss and other comprehensive income is on PDF page 95 (printed page
95). It prints `$’000` for the 2026 and 2025 columns. The unit gate requires **`$’000` / thousands**;
a plain `$`, `$M` or unit-less read is rejected. The adapter reads the 2026 column only.

The 2026 column prints:

```text
                                                                       2026
                                                                     $’000
Operating revenue                                                  1,103,122
Operating expenses                                                  (770,535)
Gross profit                                                         332,587
Other revenue                                                         19,258
Estate holding expenses                                              (55,492)
Employee benefits expense                                            (42,999)
Consultant expenses                                                   (5,130)
Advertising, public relations and sponsorship                         (8,019)
Impairment reversal of trade receivables                                  71
Other expenses                                                       (56,244)
Results from operating activities                                    184,032
Finance income                                                         6,036
Finance costs                                                         (1,099)
Net finance income                                                     4,937
Profit before income tax                                             188,969
Income tax expense                                                   (56,687)
Profit for the year                                                  132,282
Total comprehensive income for the year                              132,282
```

The face statement prints **no Total revenue and no Total expenses subtotal**. Total revenue is
derived as Operating revenue + Other revenue + Finance income; total expenses is derived as the sum
of the seven printed expense/finance-cost lines. Depreciation and amortisation is not a separate face
line: Note 2(b) (PDF page 103) prints it as **19,049**, a component within the face Other expenses
(56,244), and the Note 2(b) total equals the face Other expenses line.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$’000` values:

```text
total revenue:
  1,103,122 + 19,258 + 6,036 = 1,128,416

total expenses:
  770,535 + 55,492 + 42,999 + 5,130 + 8,019 + 56,244 + 1,099 = 939,518

profit before income tax:
  1,128,416 - 939,518 + 71 = 188,969
  = printed Profit before income tax

net result:
  188,969 - 56,687 = 132,282
  = printed Profit for the year

Note 2(b):
  Total other expenses from operating activities 56,244 = face Other expenses
  Depreciation and amortisation 19,049 is within Other expenses
```

The adapter defers the document if any printed line is missing, if either page's unit is not
thousands, if Note 2(b)'s total does not equal the face Other expenses, or if any result bridge
differs by one thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label                 |   `$’000` |  `amount_cents` | Sign             |
| --------------------------- | ------------------------------------- | --------: | --------------: | ---------------- |
| `total_revenue`             | Total revenue (derived)               | 1,128,416 | 112,841,600,000 | positive         |
| `total_expenses`            | Total expenses (derived)              |   939,518 |  93,951,800,000 | positive expense |
| `employee_expenses`         | Employee benefits expense             |    42,999 |   4,299,900,000 | positive expense |
| `depreciation_amortisation` | Note 2(b) Depreciation and amortisation | 19,049 |   1,904,900,000 | positive expense |
| `net_result`                | Profit for the year                   |   132,282 |  13,228,200,000 | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "WA"`, `delivery_entity: "DevelopmentWA"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- DevelopmentWA is one WA GTE. No WA total, no national total and no sum with Water Corporation,
  Synergy, Western Power, Horizon Power, Fremantle Ports, another WA GTE, a QLD/NSW SOC, a government
  program or the PNFC benchmark is created.
- The WALA statements are the reporting boundary; the separate MRA statements in the same report and
  the prior-year column are not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports and all QLD/NSW SOC rows
  are untouched by this adapter.

## 7. How to verify

```bash
# Official page and exact download: expect 200.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.developmentwa.com.au/publications' | head -1
curl -sS -L -o /tmp/developmentwa-2026.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.developmentwa.com.au/component/edocman/2257-2025-2026-annual-and-sustainability-report-developmentwa/download'
sha256sum /tmp/developmentwa-2026.pdf
# expect e01d0c8fc12a21a16a862d49993b49e779a10489b27308b8271896c0e0691ca7

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/wa-developmentwa/SHA256SUMS
cat ~/ausspend-source-archive/wa-developmentwa/retrieval.json

# Focused adapter tests
npx vitest run server/test/wa-developmentwa.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const dw = db.measures.countDocuments({source_id:"wa-developmentwa"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonDw = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"wa-developmentwa"}});
  print(JSON.stringify({dw, soc, nonDw, wa: db.measures.countDocuments({jurisdiction_level:"soc", jurisdiction:"WA"})}));
'
# expect {"dw":5,"soc":175,"nonDw":170,"wa":30}
```
