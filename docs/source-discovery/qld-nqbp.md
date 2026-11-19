# QLD SOC — North Queensland Bulk Ports annual-report evidence

**Status:** implementation evidence only. The exact PDF is archived outside the repo; no PDF or raw
table is committed. **Entity:** North Queensland Bulk Ports Corporation Limited (NQBP) only — a
Queensland Government Owned Corporation (GOC), not a statutory body.
**No QLD total, no other port, no parent/subsidiary addition.** The Consolidated current-year column
is used; the Parent column and subsidiaries are never added.

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                     | URL                                                                                                                           | HTTP    | Result                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| Official publications    | <https://nqbp.com.au/about-us/publications>                                                                                    | **403** | `text/html`; Cloudflare/bot challenge to the ingestion host.                                 |
| Official tabled fallback | <https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1741/5826t1741.pdf>                             | **200** | `application/pdf`, 5,530,354 bytes, 96 PDF pages; the tabled NQBP Annual Report 2025-26.     |

NQBP's corporate site is behind a Cloudflare HTML challenge (HTTP 403) from the ingestion host, so
the connector uses the **official Queensland Parliament tabled-paper copy** of the same annual
report as a documented fallback. The connector tries the official publications page first; when it
is blocked or carries no annual-report PDF, it returns the tabled copy. The fallback pin is
documented and must be updated when a newer report is tabled.

## 2. Exact document

- **Title:** NQBP Annual Report 2025–26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL (official tabled copy):** `https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1741/5826t1741.pdf`
- **Official page:** `https://nqbp.com.au/about-us/publications` (HTTP 403 from the ingestion host).
- **Bytes:** 5,530,354.
- **PDF pages:** 96.
- **SHA-256:** `a52868953f69c6c512f66d4ae8fe68d41d4853df6e29159e4d7803465a8d3ebe`.
- **Archive root:** `~/ausspend-source-archive/qld-nqbp/` (outside the repo; not committed). It
  contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the official-page 403 status,
  fallback URL, retrieval date, bytes, pages and SHA-256. The connector archives the same bytes
  under `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Consolidated Statement of Comprehensive Income is on PDF page 53 (printed page 53). It prints
`$'000` for the Consolidated 2026/2025 and Parent 2026/2025 columns. The unit gate requires
**`$'000` / thousands**; a `$m`, plain `$` or unit-less read is rejected. The adapter reads the
**Consolidated 2026** column only.

The consolidated current-year column prints:

```text
                                                                  Consolidated 2026
                                                                              $'000
Income from operations
Revenue from contracts with customers                                       109,092
Other income                                                                 44,017
Income from operations                                                      153,109
Expenses from operations
Employee benefits expenses                                                  (32,271)
Supplies and services                                                       (43,469)
Depreciation and amortisation                                               (14,312)
Impairment losses / fair value adjustments                                     (275)
Other expenses                                                               (5,845)
Expenses from operations                                                    (96,172)
Operating result                                                             56,937
Financial income                                                              4,103
Financial expenses                                                           (8,340)
Interest expense on lease liabilities                                           (218)
Net finance costs                                                            (4,455)
Profit/(Loss) before income tax                                              52,482
Income tax expense                                                          (14,806)
Profit/(Loss) after income tax                                               37,676
Other comprehensive income
Increase (decrease) in revaluation surplus                                   46,640
Income tax expense on increase (decrease) in revaluation surplus            (13,334)
Total other comprehensive income net of income tax                           33,306
Total comprehensive income for the year                                      70,982
```

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$'000` values:

```text
income components:
  109,092 + 44,017 = 153,109
  = printed Income from operations

expense components:
  32,271 + 43,469 + 14,312 + 275 + 5,845 = 96,172
  = printed Expenses from operations

operating result:
  153,109 - 96,172 = 56,937
  = printed Operating result

net finance costs:
  4,103 + (8,340) + (218) = (4,455)
  = printed Net finance costs

profit before income tax:
  56,937 + (4,455) = 52,482
  = printed Profit/(Loss) before income tax

net result:
  52,482 + (14,806) = 37,676
  = printed Profit/(Loss) after income tax

total OCI:
  46,640 + (13,334) = 33,306
  = printed Total other comprehensive income

total comprehensive income:
  37,676 + 33,306 = 70,982
  = printed Total comprehensive income
```

The adapter defers the document if any printed line is missing, if the unit is not thousands, if the
income or expense components do not sum to the printed subtotals, or if any result/OCI/comprehensive
bridge differs by one thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed label                     |   `$’000` |  `amount_cents` | Sign             |
| --------------------------- | --------------------------------- | --------: | --------------: | ---------------- |
| `total_revenue`             | Income from operations            |   153,109 |  15,310,900,000 | positive         |
| `total_expenses`            | Expenses from operations          |    96,172 |   9,617,200,000 | positive expense |
| `employee_expenses`         | Employee benefits expenses        |    32,271 |   3,227,100,000 | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation     |    14,312 |   1,431,200,000 | positive expense |
| `net_result`                | Profit/(Loss) after income tax    |    37,676 |   3,767,600,000 | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "QLD"`, `delivery_entity: "North
Queensland Bulk Ports Corporation Limited"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional"`,
`potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- NQBP is a single consolidated entity. No QLD total, no national total and no sum with Energy
  Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports
  Corporation Limited, Port of Townsville Limited, Ports North, another GOC, a statutory body or
  another state is created.
- The Consolidated current-year column is the reporting boundary; the Parent column and
  subsidiaries are not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series. They are never added to government program spending or to the ABS GFS
  PNFC benchmark.

## 7. How to verify

```bash
# Official page is Cloudflare-blocked; the tabled copy is 200.
curl -sS -o /dev/null -L -A 'Mozilla/5.0' -w '%{http_code}\n' 'https://nqbp.com.au/about-us/publications'
curl -sS -L -o /tmp/nqbp-2025-26.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Tabled-Papers/docs/5826T1741/5826t1741.pdf'
sha256sum /tmp/nqbp-2025-26.pdf
# expect a52868953f69c6c512f66d4ae8fe68d41d4853df6e29159e4d7803465a8d3ebe

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/qld-nqbp/SHA256SUMS
cat ~/ausspend-source-archive/qld-nqbp/retrieval.json

# Focused adapter tests
npx vitest run server/test/qld-nqbp.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const nq = db.measures.countDocuments({source_id:"qld-nqbp"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonNq = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"qld-nqbp"}});
  print(JSON.stringify({nq, soc, nonNq}));
'
# expect {"nq":5,"soc":145,"nonNq":140}
```
