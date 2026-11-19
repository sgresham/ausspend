# WA SOC — Horizon Power annual-report evidence

**Status:** implementation evidence only. This is the fourth WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Horizon Power — Regional Power Corporation trading as Horizon Power — only, a WA GTE under the
Government Trading Enterprises Act 2023 (WA). **No WA total, no other WA GTE, no QLD/NSW SOC.** The
30 June 2026 column is used; the 30 June 2025 column is never added.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step                     | URL                                                                                                                           | HTTP    | Result                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| Official publications    | <https://www.horizonpower.com.au/about-horizon-power/publications/>                                                            | **403** | `text/html`; Cloudflare/bot challenge to the ingestion host.                                 |
| Official PDF fallback    | <https://www.horizonpower.com.au/globalassets/media/documents/annual-reports/20252026/horizon-power-annual-report-2026.pdf>     | **200** | `application/pdf`, 11,000,133 bytes, 160 PDF pages                                           |

Horizon Power's publications pages are behind a Cloudflare HTML challenge (HTTP 403) from the
ingestion host. The official FY2025-26 annual-report PDF on Horizon Power's own `globalassets` CDN
returns HTTP 200, so the connector tries the official page first and uses that documented official
PDF copy as the fallback. The fallback pin is documented and must be updated when a newer report is
published.

## 2. Exact document

- **Title:** Horizon Power Annual Report 2026 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.horizonpower.com.au/globalassets/media/documents/annual-reports/20252026/horizon-power-annual-report-2026.pdf`
- **Bytes:** 11,000,133.
- **PDF pages:** 160.
- **SHA-256:** `7c24e07cc04e442803c9b88705382e57382d9837079c89cb7d430fb26faa6447`.
- **Archive root:** `~/ausspend-source-archive/wa-horizon-power/` (outside the repo; not committed).
  It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the official-page 403 status,
  fallback URL, retrieval date, bytes, pages and SHA-256. The connector archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Statement of comprehensive income is on PDF page 105 (printed page 105). It prints `$’000` for
the 30 June 2026 and 30 June 2025 columns. The unit gate requires **`$’000` / thousands**; a plain
`$`, `$M` or unit-less read is rejected. The adapter reads the 30 June 2026 column only.

The current-year column prints:

```text
                                                                 30 June 2026
                                                                        $’000
Revenue                                                               498,907
Other income                                                          254,447
Total income                                                          753,354
Expenses
Electricity and fuel purchases                                       (279,767)
Employee benefits expense                                            (105,578)
Materials and services                                               (112,848)
Depreciation and amortisation expense                                (131,448)
Other expenses                                                        (43,169)
Finance costs                                                         (56,992)
Profit before income tax equivalent expense                            23,552
Income tax equivalent expense                                          (6,660)
Profit for the year                                                    16,892
```

The statement prints **no Total expenses subtotal**. Total expenses is derived as the exact sum of
the six printed expense lines.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$’000` values:

```text
income components:
  498,907 + 254,447 = 753,354
  = printed Total income

total expenses (derived):
  279,767 + 105,578 + 112,848 + 131,448 + 43,169 + 56,992 = 729,802

profit before income tax equivalent expense:
  753,354 - 729,802 = 23,552
  = printed Profit before income tax equivalent expense

net result:
  23,552 - 6,660 = 16,892
  = printed Profit for the year
```

The adapter defers the document if any printed line is missing, if the unit is not thousands, if
Total income does not equal Revenue + Other income, or if any result bridge differs by one thousand.
On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label                  |   `$’000` |  `amount_cents` | Sign             |
| --------------------------- | -------------------------------------- | --------: | --------------: | ---------------- |
| `total_revenue`             | Total income                           |   753,354 |  75,335,400,000 | positive         |
| `total_expenses`            | Total expenses (derived)               |   729,802 |  72,980,200,000 | positive expense |
| `employee_expenses`         | Employee benefits expense              |   105,578 |  10,557,800,000 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation expense  |   131,448 |  13,144,800,000 | positive expense |
| `net_result`                | Profit for the year                    |    16,892 |   1,689,200,000 | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "WA"`, `delivery_entity: "Horizon Power"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Horizon Power is one WA GTE. No WA total, no national total and no sum with Water Corporation,
  Synergy, Western Power, another WA GTE, a QLD/NSW SOC, a government program or the PNFC benchmark
  is created.
- The 30 June 2026 column is the reporting boundary; the prior-date column is not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Water Corporation, Synergy, Western Power and all QLD/NSW SOC rows are untouched by this adapter.

## 7. How to verify

```bash
# Official page is Cloudflare-blocked; the official PDF is 200.
curl -sS -o /dev/null -L -A 'Mozilla/5.0' -w '%{http_code}\n' 'https://www.horizonpower.com.au/about-horizon-power/publications/'
curl -sS -L -o /tmp/horizon-2026.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.horizonpower.com.au/globalassets/media/documents/annual-reports/20252026/horizon-power-annual-report-2026.pdf'
sha256sum /tmp/horizon-2026.pdf
# expect 7c24e07cc04e442803c9b88705382e57382d9837079c89cb7d430fb26faa6447

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/wa-horizon-power/SHA256SUMS
cat ~/ausspend-source-archive/wa-horizon-power/retrieval.json

# Focused adapter tests
npx vitest run server/test/wa-horizon-power.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const hp = db.measures.countDocuments({source_id:"wa-horizon-power"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonHp = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"wa-horizon-power"}});
  print(JSON.stringify({hp, soc, nonHp, wa: db.measures.countDocuments({jurisdiction_level:"soc", jurisdiction:"WA"})}));
'
# expect {"hp":5,"soc":165,"nonHp":160,"wa":20}
```
