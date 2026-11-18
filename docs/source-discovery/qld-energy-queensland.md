# QLD SOC pilot — Energy Queensland annual-report evidence

**Status:** research/implementation evidence only. The exact PDF is archived outside the repo; no
PDF or raw table is committed. **Entity:** Energy Queensland Limited only (Queensland Government
Owned Corporation). **No QLD total and no other QLD GOC/statutory body/state entity.**

**Checked:** 2026-11-19 (Australia/Sydney), 2026-11-18/19 UTC.

## 1. Discovery and access log

| Step | URL | HTTP | Result |
| --- | --- | --- | --- |
| Official corporate-reports page | <https://www.energyq.com.au/about-us/corporate-reports> | **403** | `content-type: text/html`, `cf-mitigated: challenge`, `server: cloudflare` |
| Official 2025-26 PDF link | <https://www.energyq.com.au/__data/assets/pdf_file/0004/2143372/Energy-Queensland-Limited-Annual-Report-2025-26.pdf> | **403** | Same Cloudflare challenge; direct PDF is not fetchable from this host |
| Queensland Parliament tabled copy (used) | <https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1808/5826t1808.pdf> | **200** | `application/pdf`, 2,150,680 bytes, 128 pages |
| Queensland Parliament 2024-25 copy (older, not used) | <https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5825T1389/5825t1389.pdf> | **200** | `application/pdf`, 2,487,725 bytes; superseded by the 2025-26 report |

The Parliament copy is the official tabled paper for the same Energy Queensland Limited Annual
Report 2025-26. It is the documented fallback for the Cloudflare-gated corporate site, not an
unofficial mirror. The connector discovers the official page first and falls back only when it is
blocked or contains no annual-report PDF.

## 2. Exact document

- **Title:** Energy Queensland Limited Annual Report 2025-26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1808/5826t1808.pdf`
- **Bytes:** 2,150,680.
- **Pages:** 128.
- **SHA-256:** `f0a0286eb6edc7f6473daf071bed880dcfea72150e0ad203410066df0fc50721`.
- **Archive:** exact bytes copied outside the repository under the session archive area; the
  connector also writes them under `AUSSPEND_SOURCE_ARCHIVE` at runtime. The PDF is never committed.

## 3. Printed unit and statement

The consolidated statement of profit or loss is on PDF page 30. Its header reads:

```text
Consolidated statement of profit or loss
For the year ended 30 June 2026
In millions of dollars     Note    2026      2025
```

The printed unit is **`$m` / millions of dollars**. No OCR was used and no unit was inferred from
the magnitude of the values.

```text
Revenue                                                     6,698   6,682
Expenses
  Transmission charges and electricity purchases            1,423   1,653
  Solar photovoltaic feed in tariff                           272     308
  Employee expenses                                         1,354   1,408
  Materials and services                                      768     949
  Depreciation, amortisation and impairments                1,325   1,187
  Net impairment losses on financial assets                    28      26
  Finance costs                                               994     860
  Fair value losses                                           299      31
  Other expenses                                              337     392
Loss before income tax equivalent benefit                    (102)   (132)
Income tax equivalent benefit                                  35      38
Loss after income tax equivalent benefit                      (67)    (94)
```

The statement has no printed **Total expenses** subtotal. The Directors' report on PDF page 26
prints: "Total expenses for the year (excluding income tax) of **$6,800 million**".

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$m` values:

```text
expense components:
  1,423 + 272 + 1,354 + 768 + 1,325 + 28 + 994 + 299 + 337 = 6,800
  = Directors' report printed total expenses 6,800

profit before tax:
  6,698 - 6,800 = -102
  = printed Loss before income tax equivalent benefit (102)

net result:
  (102) + 35 = (67)
  = printed Loss after income tax equivalent benefit (67)
```

The adapter defers the document if any printed line is missing, if the unit is not millions, if the
expense components do not sum to the Directors' report total, or if either profit bridge differs by
one million. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item` | Printed label | `$m` | `amount_cents` | Sign |
| --- | --- | ---: | ---: | --- |
| `total_revenue` | Total revenue | 6,698 | 669,800,000,000 | positive |
| `total_expenses` | Total expenses (derived from printed expense lines) | 6,800 | 680,000,000,000 | positive expense |
| `employee_expenses` | Employee expenses | 1,354 | 135,400,000,000 | positive expense |
| `depreciation_amortisation` | Depreciation, amortisation and impairments | 1,325 | 132,500,000,000 | positive expense |
| `net_result` | Loss after income tax equivalent benefit | 67 | 6,700,000,000 | printed negative |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "QLD"`, `delivery_entity: "Energy
Queensland"`, `aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Energy Queensland is a single entity. No QLD total, no national total and no sum with another
  GOC, statutory body or state is created.
- The consolidated parent is the reporting boundary; Energex, Ergon Energy and other subsidiaries
  are not added as separate rows.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series. They are never added to government program spending or to the ABS GFS
  PNFC benchmark.
- The QLD pilot is the only non-NSW SOC adapter in this change. No other QLD entity was touched.

## 7. How to verify

```bash
# Official Parliament copy: expect HTTP 200 application/pdf and 2,150,680 bytes
curl -sS -L -o /tmp/eq-2025-26.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1808/5826t1808.pdf'
sha256sum /tmp/eq-2025-26.pdf
# expect f0a0286eb6edc7f6473daf071bed880dcfea72150e0ad203410066df0fc50721

# Focused adapter tests
npx vitest run server/test/qld-energy-queensland.test.ts
```
