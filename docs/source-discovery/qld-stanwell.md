# QLD SOC — Stanwell Corporation annual-report evidence

**Status:** implementation evidence only. The exact PDF is archived outside the repo; no PDF or raw
table is committed. **Entity:** Stanwell Corporation Limited only (Queensland Government Owned
Corporation under the GOC Act 1993 (Qld); not a statutory body).
**No QLD total, no Energy Queensland or CS Energy inclusion, and no other QLD GOC/statutory
body/state entity.**

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                                | URL                                                                                                                                                 | HTTP    | Result                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| Canonical publications page (brief) | <https://www.stanwell.com/about-us/publications>                                                                                                    | **404** | `text/html`; no report links. This page has moved/been removed.                   |
| Official fallback page 1            | <https://www.stanwell.com/about-us>                                                                                                                 | **200** | `text/html`; carries the latest `Annual Report` PDF link.                         |
| Official fallback page 2            | <https://www.stanwell.com/information-publication-scheme>                                                                                           | **200** | `text/html`; carries the same annual-report PDF link in the publication register. |
| Latest annual-report PDF            | <https://assets.ctfassets.net/g6959sqmk0wu/6tf7j1YqIxYVp19TAh4H5n/34c80c2ffcf28585b9786885a3cdb6d3/Stanwell-Corporation--Annual-Report-2025-26.pdf> | **200** | `application/pdf`, 7,405,029 bytes, 146 pages                                     |

The connector checks the canonical publications page first, then the two live official pages, and
selects the newest annual-report PDF by its `YYYY-YY` filename span. The PDF URL itself is never
hard-coded. Sustainability reports, submissions and community newsletters on the same asset host
are rejected by name.

## 2. Exact document

- **Title:** Stanwell Corporation Annual Report 2025-26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://assets.ctfassets.net/g6959sqmk0wu/6tf7j1YqIxYVp19TAh4H5n/34c80c2ffcf28585b9786885a3cdb6d3/Stanwell-Corporation--Annual-Report-2025-26.pdf`
- **Bytes:** 7,405,029.
- **Pages:** 146.
- **SHA-256:** `02b079d10fa451f19144dffd9caa9786d8d7ebc60347c97be5866ffefdf47db6`.
- **Archive root:** `~/ausspend-source-archive/qld-stanwell/` (outside the repo; not committed).
  It contains `Stanwell-Corporation--Annual-Report-2025-26.pdf`, `SHA256SUMS` and
  `retrieval.json` with the URL, retrieval date, bytes, pages and SHA-256. The connector also
  archives the same bytes under `AUSSPEND_SOURCE_ARCHIVE` at runtime.

## 3. Printed unit and statement

The consolidated statement of profit or loss and other comprehensive income is on PDF page 69
(printed page 69). Its header prints `$’000` for both the 2026 and 2025 columns. The unit gate
therefore requires **`$’000` / thousands**; a `$m`, plain `$` or unit-less read is rejected.

The statement has no printed **Total revenue** or **Total expenses** subtotal. It prints:

```text
                                                                           2026       2025
                                                                        $’000      $’000
Revenue and other income                                              3,173,199  3,377,924
Finance income                                                           69,327     75,225
Expenses
  Electricity and energy services expense                            (1,358,558) (1,558,030)
  Fuel costs                                                           (425,112)   (436,467)
  Raw materials and consumables used                                   (102,288)    (80,419)
  Employee benefits expense                                            (228,716)   (210,032)
  Depreciation and amortisation expense                                (270,134)   (195,761)
  Other expenses                                                       (327,004)   (236,174)
  Finance costs                                                         (96,982)    (65,548)
  Expected credit loss (expense)/reversal on receivables                 117,155   (117,252)
  Loss arising from the renegotiation of supply contract               (661,559)    (32,192)
  Impairment reversal                                                         -      411,628
  Non hedge accounted change in fair value of derivative instruments   (492,083)   (300,151)
Profit/(loss) before income tax equivalent (expense)/benefit           (602,755)    632,751
Income tax equivalent (expense)/benefit                                 188,091   (203,519)
Profit/(loss) after income tax equivalent (expense)/benefit for year   (414,664)    429,232
```

`Impairment reversal` is printed as a nil marker (`-`) in the current-year column. It is read as
zero for the expense bridge; the adapter records that the nil marker was used.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$’000` values:

```text
total revenue:
  3,173,199 + 69,327 = 3,242,526

total expenses (signed expense lines, net of the expected-credit-loss reversal):
  1,358,558 + 425,112 + 102,288 + 228,716 + 270,134 + 327,004 + 96,982
  - 117,155 + 661,559 + 0 + 492,083
  = 3,845,281

profit before tax:
  3,242,526 - 3,845,281 = (602,755)
  = printed Profit/(loss) before income tax equivalent

net result:
  (602,755) + 188,091 = (414,664)
  = printed Profit/(loss) after income tax equivalent for the year
```

The adapter defers the document if any printed line is missing, if the unit is not thousands, or if
either bridge differs by one thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label                                  |   `$’000` |  `amount_cents` | Sign             |
| --------------------------- | ------------------------------------------------------ | --------: | --------------: | ---------------- |
| `total_revenue`             | Total revenue (derived)                                | 3,242,526 | 324,252,600,000 | positive         |
| `total_expenses`            | Total expenses (derived)                               | 3,845,281 | 384,528,100,000 | positive expense |
| `employee_expenses`         | Employee benefits expense                              |   228,716 |  22,871,600,000 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation expense                  |   270,134 |  27,013,400,000 | positive expense |
| `net_result`                | Profit/(loss) after income tax equivalent for the year |   414,664 |  41,466,400,000 | printed negative |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "QLD"`, `delivery_entity: "Stanwell
Corporation"`, `aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Stanwell is a single entity. No QLD total, no national total and no sum with Energy Queensland,
  CS Energy, another GOC, a statutory body or another state is created.
- The consolidated parent is the reporting boundary; subsidiaries are not added as separate rows.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series. They are never added to government program spending or to the ABS GFS
  PNFC benchmark.
- Energy Queensland and CS Energy rows are untouched by this adapter.

## 7. How to verify

```bash
# Official pages: expect 404 for the canonical page and 200 for the two fallbacks.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.stanwell.com/about-us/publications' | head -1
curl -sSI -L -A 'Mozilla/5.0' 'https://www.stanwell.com/about-us' | head -1
curl -sSI -L -A 'Mozilla/5.0' 'https://www.stanwell.com/information-publication-scheme' | head -1

# Exact PDF: expect HTTP 200 and 7,405,029 bytes.
curl -sS -L -o /tmp/stanwell-2025-26.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://assets.ctfassets.net/g6959sqmk0wu/6tf7j1YqIxYVp19TAh4H5n/34c80c2ffcf28585b9786885a3cdb6d3/Stanwell-Corporation--Annual-Report-2025-26.pdf'
sha256sum /tmp/stanwell-2025-26.pdf
# expect 02b079d10fa451f19144dffd9caa9786d8d7ebc60347c97be5866ffefdf47db6

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/qld-stanwell/SHA256SUMS
cat ~/ausspend-source-archive/qld-stanwell/retrieval.json

# Focused adapter tests
npx vitest run server/test/qld-stanwell.test.ts
```
