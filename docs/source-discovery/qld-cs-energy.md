# QLD SOC — CS Energy annual-report evidence

**Status:** implementation evidence only. The exact PDF is archived outside the repo; no PDF or raw
table is committed. **Entity:** CS Energy Limited only (Queensland Government Owned Corporation).
**No QLD total, no Energy Queensland inclusion, and no other QLD GOC/statutory body/state entity.**

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official annual-reports page | <https://www.csenergy.com.au/who-we-are/reports-and-publications/annual-reports> | **200** | `text/html`; links Annual Report 2026, 2025 and 2024 |
| Latest annual-report PDF | <https://www.csenergy.com.au/ArticleDocuments/276/CS%20ENERGY%20ANNUAL%20REPORT%202026.pdf.aspx> | **200** | `application/pdf`, 2,712,680 bytes, 124 pages |

The page is current and reachable from the ingestion host; no fallback mirror was needed. The
`.pdf.aspx` URL is CS Energy's official document link.

## 2. Exact document

- **Title:** CS Energy Annual Report 2026.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.csenergy.com.au/ArticleDocuments/276/CS%20ENERGY%20ANNUAL%20REPORT%202026.pdf.aspx`
- **Bytes:** 2,712,680.
- **Pages:** 124.
- **SHA-256:** `6fbf258f057820989a9e72096181c06c82b7d7c94c4102015b61d387c0bd12c3`.
- **Archive root:** `~/ausspend-source-archive/qld-cs-energy/` (outside the repo; not committed).
  It contains `CS-ENERGY-ANNUAL-REPORT-2026.pdf`, `SHA256SUMS` and `retrieval.json` with the URL,
  retrieval date, bytes, pages and SHA-256. The connector also archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime.

## 3. Printed unit and statement

The consolidated statement of profit or loss and other comprehensive income is on PDF page 37
(printed page 35). Its header prints `$'000` for both the 2026 and 2025 columns. The Basis of
Preparation on page 41 states amounts are rounded to the nearest thousand dollars. The unit gate
therefore requires **`$'000` / thousands**; a `$m` or whole-dollar read is rejected.

The statement has no printed **Total revenue** or **Total expenses** subtotal. It prints:

```text
                                                      2026       2025
                                                      $'000      $'000
Revenue                                             1,856,656  1,904,008
Loss on disposed assets                               (33,188)      (260)
Interest income                                        20,866     37,466
Other income                                          236,097      4,858
Expenses
  Fuel                                               (211,428)   (172,456)
  Electricity and energy services expense             (751,653)   (875,361)
  Services and consultants                            (304,841)   (337,736)
  Finance costs                                      (103,865)    (99,336)
  Employee benefit expense                           (218,087)   (202,071)
  Raw materials and consumables                       (90,546)    (61,976)
  Capacity payments and operating leases              (51,379)    (49,973)
  Other expenses                                     (151,784)   (115,080)
  Fair value through profit/(loss)                    (63,561)   (123,781)
  Depreciation and amortisation                      (120,268)   (147,341)
  Impairment (losses)                                 (11,311)    (82,906)
  Provision remeasurements                            (12,284)    109,861
Loss before income tax expense                       (10,576)   (212,084)
Income tax expense                                   (16,851)   (112,299)
Loss after income tax expense for the year           (27,427)   (324,383)
```

The extracted text layer contains two complete copies of this face statement in content order (a
print/overlay artefact). The adapter preserves content order and parses the first complete copy;
sorting by y-position would interleave the copies and attach the wrong value to a label.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$'000` values:

```text
total revenue:
  1,856,656 + 20,866 + 236,097 = 2,113,619

total expenses:
  33,188 + 211,428 + 751,653 + 304,841 + 103,865 + 218,087
  + 90,546 + 51,379 + 151,784 + 63,561 + 120,268 + 11,311 + 12,284
  = 2,124,195

profit before tax:
  2,113,619 - 2,124,195 = (10,576)
  = printed Loss before income tax expense

net result:
  (10,576) + (16,851) = (27,427)
  = printed Loss after income tax expense for the year
```

The adapter defers the document if any printed line is missing, if the unit is not thousands, or if
either bridge differs by one thousand. On the 2026 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item` | Printed/derived label | `$'000` | `amount_cents` | Sign |
| --- | --- | ---: | ---: | --- |
| `total_revenue` | Total revenue (derived) | 2,113,619 | 211,361,900,000 | positive |
| `total_expenses` | Total expenses (derived) | 2,124,195 | 212,419,500,000 | positive expense |
| `employee_expenses` | Employee benefit expense | 218,087 | 21,808,700,000 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation | 120,268 | 12,026,800,000 | positive expense |
| `net_result` | Loss after income tax expense for the year | 27,427 | 2,742,700,000 | printed negative |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "QLD"`, `delivery_entity: "CS Energy"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- CS Energy is a single entity. No QLD total, no national total and no sum with Energy Queensland,
  another GOC, a statutory body or another state is created.
- The consolidated parent is the reporting boundary; subsidiaries are not added as separate rows.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series. They are never added to government program spending or to the ABS GFS
  PNFC benchmark.
- Energy Queensland rows are untouched by this adapter.

## 7. How to verify

```bash
# Official page and PDF: expect HTTP 200
curl -sSI -L -A 'Mozilla/5.0' 'https://www.csenergy.com.au/who-we-are/reports-and-publications/annual-reports' | head
curl -sS -L -o /tmp/cs-2025-26.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.csenergy.com.au/ArticleDocuments/276/CS%20ENERGY%20ANNUAL%20REPORT%202026.pdf.aspx'
sha256sum /tmp/cs-2025-26.pdf
# expect 6fbf258f057820989a9e72096181c06c82b7d7c94c4102015b61d387c0bd12c3

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/qld-cs-energy/SHA256SUMS
cat ~/ausspend-source-archive/qld-cs-energy/retrieval.json

# Focused adapter tests
npx vitest run server/test/qld-cs-energy.test.ts
```
