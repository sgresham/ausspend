# WA SOC — Kimberley Ports Authority annual-report evidence

**Status:** implementation evidence only. This is the next WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Kimberley Ports Authority only, a WA GTE under the Government Trading Enterprises Act 2023 (WA) and
the Port Authorities Act 1999 (WA). **No WA total, no other WA GTE, no QLD/NSW SOC.** The 2026 column
is used; the 2025 column is never added.

**Current outcome: deferred with 0 rows.** The 2025-26 face statement reconciles its printed totals
and result bridges exactly, but it does not print a total employee benefits expense, so the five-row
SOC line set cannot be proved without inventing the undisclosed employee component.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step                     | URL                                                                                                          | HTTP          | Result                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------------- |
| Official news item       | <https://kimberleyports.wa.gov.au/news-and-media/news/2026/09/kpas-annual-report-for-2025-26>                | **200**       | `text/html`; links the download endpoint.                                                                 |
| Publications page        | <https://kimberleyports.wa.gov.au/forms-and-publications>                                                    | **200**       | `text/html`; exposes no direct PDF hrefs.                                                                 |
| Official download route  | <https://kimberleyports.wa.gov.au/?document=annual-report-2025-2026>                                         | **301 → 200** | `application/pdf`; final URL below.                                                                       |
| Final PDF                | <https://kimberleyports.wa.gov.au/wp-content/uploads/2026/09/0421_KPA-2026-Annual-Report_FINAL-ART2_WEB.pdf> | **200**       | `application/pdf`, 15,791,779 bytes, 102 PDF pages.                                                       |
| Official search fallback | <https://kimberleyports.wa.gov.au/wp-json/wp/v2/search?search=annual%20report&per_page=20>                   | **200**       | `application/json`; returns the `document` posts `Annual Report 2025-2026` and `Annual Report 2024-2025`. |

The connector fetches the official publications page first. Because that page exposes no direct PDF
hrefs, discovery falls back to the official WordPress search endpoint for the `document` post type.
A document is accepted only when it names an annual report and a year; port handbooks, trade
statistics, community-investment reports, statements of corporate intent and corporate plans are
rejected by name. The PDF URL itself is never hard-coded; `WA_KIMBERLEY_PORTS_ANNUAL_REPORT_URL` is
the operator override. If neither the page nor the search endpoint returns an annual-report document,
the connector errors and defers rather than guessing a URL.

The `?document=` route is followed through its HTTP 301 redirect. The archived `original_url` is the
final PDF URL and `retrieved_from` is the official `?document=` endpoint.

## 2. Exact document

- **Title:** Kimberley Ports Authority Annual Report 2025-26 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 15,791,779.
- **PDF pages:** 102.
- **SHA-256:** `ee09e9a6cf684d4595c7e7133d891e86a3aa2a2cd76d1a75abe2339a209e7c36`.
- **Archive root:** `~/ausspend-source-archive/wa-kimberley-ports/` (outside the repo; not committed).
  It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, discovery page, retrieval
  date, bytes and SHA-256. The connector archives the same bytes under `AUSSPEND_SOURCE_ARCHIVE` at
  runtime and verifies the hash before parsing.
- **Redirection:** the official `?document=annual-report-2025-2026` endpoint answered HTTP 301 and
  redirected to the final PDF URL above, which answered HTTP 200 with `application/pdf`.

## 3. Printed unit and statement

The Statement of Comprehensive Income is on PDF page 59 (printed page 57). It prints `$'000` for the
2026 and 2025 columns. The unit gate requires **explicit thousands**; a whole-dollar, `$M`, unit-less
or ambiguous read is rejected and the document is deferred without rows.

The left (financial statement) panel of the 2026 column prints:

```text
                                                        2026      2025
                                                      $'000     $'000
REVENUE
Revenue                                            32,824    37,389
Other Income                                        2,486     5,251
EXPENDITURE
Port operations expenses                          (12,170)  (13,449)
Depreciation and amortisation                      (5,752)   (6,322)
General administration expenses                    (7,927)   (8,298)
Asset maintenance                                  (3,503)   (2,840)
Port utilities                                     (1,284)   (1,419)
Finance expenses                                      (222)     (255)
Safety & security                                     (635)     (584)
Environmental expenses                                (246)     (751)
Other expenses                                     (1,310)   (1,937)
Profit before income tax                            2,261     6,785
Income tax expense                                 (1,065)   (1,155)
Net Profit after tax                                1,196     5,630
```

The right panel prints other comprehensive income of nil and total comprehensive income equal to net
profit; it is not added to the face-statement lines.

## 4. Reconciliation (zero tolerance)

All arithmetic is in printed `$'000` values:

```text
total revenue:
  32,824 + 2,486 = 35,310   (derived; no printed Total revenue subtotal)

total expenses:
  12,170 + 5,752 + 7,927 + 3,503 + 1,284 + 222 + 635 + 246 + 1,310 = 33,049
  (derived; no printed Total expenses subtotal)

profit before income tax:
  35,310 − 33,049 = 2,261
  = printed Profit before income tax 2,261

net result:
  2,261 − 1,065 = 1,196
  = printed Net Profit after tax 1,196
```

Depreciation and amortisation is the printed face line **5,752**, also confirmed by Note 6's printed
"Total depreciation and amortisation 5,752". The adapter defers the document if any printed line is
missing, if the unit is not explicit thousands, if the profit-before-tax bridge differs by one
thousand, or if the net-result bridge differs by one thousand.

## 5. The exact gap: no printed total employee benefits expense

The required five-row set includes **employee expenses**, but the 2025-26 face statement does not
print a total employee benefits expense. The notes do not supply one:

- Note 1(b): "the Authority has allocated employee benefits expenses to various line items on the
  Statement of Comprehensive Income including port operations expenses, general administration, and
  asset maintenance."
- Note 5 — Port operations expenses prints "Indirect salaries and wages - operations" **5,529**, plus
  shipping activity and minor asset purchases; it does not print a total employee component.
- Note 7 — General administration expenses prints "Administration employee expenses" **4,238** and
  "Administration expenses" 3,689, totalling 7,927.
- Note 9 — Other expenses prints "Employee on-costs" **878**, short-term/low-value leases 80 and
  other 352, totalling 1,310.
- Asset maintenance is the printed face line **3,503** with **no note split**, even though Note 1 says
  employee benefits are allocated into it.

The disclosed employee-related amounts (5,529 + 4,238 + 878 = 10,645) are therefore not a total
employee expense: they omit any employee benefit inside Asset maintenance and do not reconcile to a
printed subtotal. Adding them as "employee expenses" would fabricate a total the report does not
print. The adapter therefore defers the document with phase `employee` and ingests **0 rows**.

## 6. Ingest proof (shared dev DB)

The targeted SOC ingest ran with `SOC_ONLY_SOURCE_IDS=wa-kimberley-ports` against the
shared `ausspend_dev` database selected by `MONGO_URL`:

- `measures` for `source_id=wa-kimberley-ports`: **0**.
- `data_sources.records_ingested`: **0**; status `degraded` with the exact employee gap in `errors`.
- `ingestion_logs`: one `partial` log, `records_fetched=0`, `records_upserted=0`, with the exact gap.
- `deferred_soc_documents`: one `deferred` record, fiscal year `2025-26`, SHA-256 above.
- `source_documents`: one record for the final PDF (15,791,779 bytes, SHA-256 above).
- SOC total: **190 before and 190 after** (no rows added).
- Total measures: **998,429 before and 998,429 after**.
- No WA/state/national aggregate row: no measure with `source_id` matching `wa-total`, `wa-state` or
  `wa-aggregate`; the new source has zero measures.

## 7. Extracted rows if a future report proves a total employee expense

The five-row path is implemented and tested with a reconciled fixture. On a future report that prints
a total employee benefits expense, the rows would be:

| `soc_line_item`             | Printed/derived label               | `$'000` | `amount_cents` | Sign             |
| --------------------------- | ----------------------------------- | ------: | -------------: | ---------------- |
| `total_revenue`             | Total revenue (derived)             |  35,310 |  3,531,000,000 | positive         |
| `total_expenses`            | Total expenses (derived)            |  33,049 |  3,304,900,000 | positive expense |
| `employee_expenses`         | Employee benefits expense (printed) |       — |              — | component        |
| `depreciation_amortisation` | Depreciation and amortisation       |   5,752 |    575,200,000 | positive expense |
| `net_result`                | Net Profit after tax                |   1,196 |    119,600,000 | positive         |

Every row would be `jurisdiction_level: "soc"`, `jurisdiction: "WA"`,
`delivery_entity: "Kimberley Ports Authority"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional"`,
`potential_double_count: false`.

## 8. No-total / no-cross-entity rule

- Kimberley Ports Authority is one WA GTE. No WA total, no national total and no sum with Water
  Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports,
  Busselton Water, Mid West Ports, another WA GTE, a QLD/NSW SOC, a government program or the PNFC
  benchmark is created.
- The 2026 column is the reporting boundary; the prior-year column is not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- The adapter emits no aggregate row and no parent+subsidiary addition.

## 9. Implementation and tests

- Adapter: `server/src/connectors/soc/wa/kimberley-ports.ts`.
- Registration: `server/src/connectors/registry.ts`, `server/src/connectors/index.ts`,
  `server/src/api/soc.ts`, `client/src/pages/SocPage.tsx`, `scripts/ingest-soc.ts`.
- Tests: `server/test/wa-kimberley-ports.test.ts` — discovery/latest and fallback, unit gate,
  reconciliation failure, the live-shaped employee-expense deferral, a reconciled five-row fixture,
  natural key/idempotency and no-cross-entity total.
- The adapter is entity-level only and never deploys by itself; no deploy was run.
