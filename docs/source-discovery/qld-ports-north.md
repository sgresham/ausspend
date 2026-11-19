# QLD SOC — Ports North annual-report evidence

**Status:** implementation evidence only. The exact PDF is archived outside the repo; no PDF or raw
table is committed. **Entity:** Ports North — Far North Queensland Ports Corporation Limited — only
(a Queensland Government Owned Corporation under the GOC Act 1993 (Qld); not a statutory body).
**No QLD total, no other port, no parent/subsidiary addition.**

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                    | URL                                                                                                                           | HTTP    | Result                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| Official annual reports | <https://www.portsnorth.com.au/news-publications/annual-reports/>                                                              | **200** | `text/html` (103,358 bytes); lists annual reports as protocol-relative S3 PDFs.         |
| Latest report PDF       | <https://os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/port_north_annual_report_2026_final.pdf>          | **200** | `application/pdf`, 2,456,133 bytes, 68 PDF pages                                       |

The connector fetches the annual-reports page and parses its PDF links. The page uses
protocol-relative S3 hrefs; both are resolved before filtering. A link is accepted only when its
filename contains “Annual Report” and carries a recognisable year: a full span (`2021-22`,
`2020-2021`), an `fy` prefix (`fy2025`, `fy23`) or a single year-ended year (`2026`). Statements of
Corporate Intent (`…_statement_of_corporate_intent_…`) are rejected by name. The PDF URL itself is
never hard-coded.

## 2. Exact document

- **Title:** Ports North Annual Report 2025–26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/port_north_annual_report_2026_final.pdf`
- **Bytes:** 2,456,133.
- **PDF pages:** 68.
- **SHA-256:** `d61326bf72795da8ea16582715638ab5ed38b0f32dfaf405e39763d48c0d3b94`.
- **Archive root:** `~/ausspend-source-archive/qld-ports-north/` (outside the repo; not committed).
  It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, retrieval date, bytes,
  pages and SHA-256. The connector archives the same bytes under `AUSSPEND_SOURCE_ARCHIVE` at
  runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Statement of Comprehensive Income is on PDF page 30 (printed page 30). Its header prints `$’000`
for both the 2026 and 2025 columns. The unit gate requires **`$’000` / thousands**; a `$m`, plain `$`
or unit-less read is rejected.

The face statement prints:

```text
                                                                             2026       2025
                                                                          $’000      $’000
INCOME
Revenue
User charges                                                              76,925     71,480
Interest revenue                                                           2,068      3,345
Other revenue                                                                  -         33
Gain on sale of property, plant and equipment                                 21          -
Increase in Fair Value of Investment property                             17,653     12,565
Total Income                                                              96,667     87,423
EXPENSES
Supplies and services                                                     42,629     40,496
Employee expenses                                                         19,442     19,105
Finance Costs                                                                 52         53
Depreciation                                                               7,507      7,254
Write off of Property, Plant and Equipment work in progress                   37          -
Revaluation decrement of property, plant and equipment                    13,774     12,861
Total Expenses                                                            83,441     79,769
Operating Result before Income tax (equivalent) expense                   13,226      7,654
Income tax equivalent expense/(benefit)                                    4,084      2,352
Operating Result for the year                                              9,142      5,302
Other Comprehensive Income
Increase/(decrease) in asset revaluation surplus                        (11,638)   (10,380)
Other deferred tax adjustments                                             3,549      3,114
Total Other Comprehensive Income for the period, net of income tax       (8,089)    (7,266)
Total Comprehensive Income                                                 1,053     (1,964)
```

`Other revenue` prints a nil marker (`-`) in the current-year column, read as a printed zero.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$’000` values:

```text
income components:
  76,925 + 2,068 + 0 + 21 + 17,653 = 96,667
  = printed Total Income

expense components:
  42,629 + 19,442 + 52 + 7,507 + 37 + 13,774 = 83,441
  = printed Total Expenses

operating result before income tax:
  96,667 - 83,441 = 13,226
  = printed Operating Result before Income tax

net result:
  13,226 - 4,084 = 9,142
  = printed Operating Result for the year

total OCI:
  (11,638) + 3,549 = (8,089)
  = printed Total Other Comprehensive Income

total comprehensive income:
  9,142 + (8,089) = 1,053
  = printed Total Comprehensive Income
```

The adapter defers the document if any printed line is missing, if the unit is not thousands, if the
income or expense components do not sum to the printed subtotals, or if any bridge differs by one
thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed label                     |   `$’000` |  `amount_cents` | Sign             |
| --------------------------- | --------------------------------- | --------: | --------------: | ---------------- |
| `total_revenue`             | Total Income                      |    96,667 |   9,666,700,000 | positive         |
| `total_expenses`            | Total Expenses                    |    83,441 |   8,344,100,000 | positive expense |
| `employee_expenses`         | Employee expenses                 |    19,442 |   1,944,200,000 | positive expense |
| `depreciation_amortisation` | Depreciation                      |     7,507 |     750,700,000 | positive expense |
| `net_result`                | Operating Result for the year     |     9,142 |     914,200,000 | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "QLD"`, `delivery_entity: "Ports North"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Ports North is a single entity. No QLD total, no national total and no sum with Energy Queensland,
  CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports Corporation Limited,
  Port of Townsville Limited, another GOC, a statutory body or another state is created.
- The consolidated parent is the reporting boundary; subsidiaries are not added as separate rows.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series. They are never added to government program spending or to the ABS GFS
  PNFC benchmark.

## 7. How to verify

```bash
# Official pages: expect 200 for the annual-reports page and the exact PDF.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.portsnorth.com.au/news-publications/annual-reports/' | head -1
curl -sS -L -o /tmp/ports-north-2026.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://os-data-2.s3-ap-southeast-2.amazonaws.com/portsnorth-com-au/bundle1/port_north_annual_report_2026_final.pdf'
sha256sum /tmp/ports-north-2026.pdf
# expect d61326bf72795da8ea16582715638ab5ed38b0f32dfaf405e39763d48c0d3b94

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/qld-ports-north/SHA256SUMS
cat ~/ausspend-source-archive/qld-ports-north/retrieval.json

# Focused adapter tests
npx vitest run server/test/qld-ports-north.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const pn = db.measures.countDocuments({source_id:"qld-ports-north"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonPn = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"qld-ports-north"}});
  print(JSON.stringify({pn, soc, nonPn}));
'
# expect {"pn":5,"soc":140,"nonPn":135}
```
