# QLD SOC — Gladstone Ports Corporation Limited annual-report evidence

**Status:** implementation evidence only. The exact PDF is archived outside the repo; no PDF or raw
table is committed. **Entity:** Gladstone Ports Corporation Limited only — a Queensland Government
Owned Corporation (GOC), not a statutory body.
**No QLD total, no Energy Queensland / CS Energy / Stanwell / Powerlink / Sunwater inclusion, and no
other QLD GOC/statutory body/state entity.** The 100%-owned subsidiary Gladstone Marine Pilot
Services Pty Ltd is consolidated, not added as a separate row.

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step              | URL                                                                                                                           | HTTP    | Result                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| Official reports  | <https://gpcl.com.au/who-we-are/corporate-governance/reports/>                                                                 | **200** | `text/html` (94,281 bytes); lists the 2025-26 and 2024-25 annual-report PDFs.              |
| Latest report PDF | <https://gpcl.com.au/wp-content/uploads/2026/09/Gladstone-Ports-Corporation-Annual-Report-2025-26.pdf>                          | **200** | `application/pdf`, 29,631,105 bytes, 131 PDF pages                                        |

The connector fetches the reports page and parses its PDF links. A link is accepted only when its
filename contains “Annual Report” and a consecutive financial-year span (`2025-26`, `2024-25`). The
page currently lists exactly two PDFs, both annual reports; other publications are rejected by name.
The PDF URL itself is never hard-coded.

## 2. Exact document

- **Title:** Gladstone Ports Corporation Limited Annual Report 2025–26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://gpcl.com.au/wp-content/uploads/2026/09/Gladstone-Ports-Corporation-Annual-Report-2025-26.pdf`
- **Bytes:** 29,631,105.
- **PDF pages:** 131.
- **SHA-256:** `ff36d4681acbda7e472be06ac79b1d5f3f39409f4ce570e1049b00b19569ce87`.
- **Archive root:** `~/ausspend-source-archive/qld-gladstone-ports/` (outside the repo; not
  committed). It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, retrieval
  date, bytes, pages and SHA-256. The connector archives the same bytes under
  `AUSSPEND_SOURCE_ARCHIVE` at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The consolidated statement of profit or loss and other comprehensive income is on PDF page 56
(printed page 13). Its header prints `$’000` for both the 2026 and 2025 columns. Note 6(d): Employee
benefits expenses is on PDF page 66 (printed page 23) and also prints `$’000`. The unit gate therefore
requires **`$’000` / thousands** on both pages; a `$m`, plain `$` or unit-less read is rejected.

The face statement prints:

```text
                                                                             2026       2025
                                                                          $’000      $’000
Revenue from contracts with customers                                     605,164    580,361
Other income                                                               69,004     59,072
Total revenue and other income                                            674,168    639,433
Employee benefits expenses                                               (178,914)  (182,846)
Operational expenses                                                     (158,697)  (155,631)
Depreciation/amortisation expenses                                       (107,741)   (90,054)
Finance costs                                                             (34,563)   (31,012)
Impairment                                                                   (326)    (3,746)
Reversal of prior impairment                                                  216        620
Net profit / (Loss) on disposal of non-current assets                        (911)      (652)
Fair value revaluation increase / (decrease) of property, plant
  and equipment                                                             2,791     26,945
Revaluation increase of investment properties                                8,291      8,993
Profit before income tax                                                  204,314    212,050
Income tax expense                                                        (61,289)   (63,398)
Profit for the year                                                       143,025    148,652
```

Note 6(d) prints the employee-benefits components and the total (PDF page 66):

```text
                                                                             2026       2025
                                                                          $’000      $’000
Wages and salaries                                                        128,158    136,452
Annual leave expense                                                        7,811     10,385
Personal leave expense                                                      5,064      3,502
Long service leave expense                                                  1,953        256
Employer superannuation contributions                                      16,783     16,817
Employer defined benefits contribution                                      1,886      1,630
Other employee benefits                                                     2,839      1,593
Workers compensation premium                                                1,688      1,446
Payroll tax expense                                                         8,307      7,181
Other employee related expenses                                             4,425      3,584
Total                                                                     178,914    182,846
```

The face statement prints a **Total revenue and other income** line but no **Total expenses**
subtotal. The Reversal of prior impairment and the two revaluation increases are printed gains in the
profit-or-loss, not expense reductions; the Net loss on disposal is a printed expense.

## 4. Reconciliation (zero tolerance)

All arithmetic is in whole printed `$’000` values:

```text
total revenue and other income:
  605,164 + 69,004 = 674,168
  = printed Total revenue and other income

total expenses (derived: expense/deduction lines only):
  178,914 + 158,697 + 107,741 + 34,563 + 326 + 911 = 481,152

profit before income tax:
  674,168 - 481,152 + 216 + 2,791 + 8,291 = 204,314
  = printed Profit before income tax

net result:
  204,314 + (61,289) = 143,025
  = printed Profit for the year

Note 6(d):
  Total employee benefits 178,914 = face Employee benefits expenses 178,914
```

The adapter defers the document if any printed line is missing, if either page's unit is not
thousands, if Total revenue and other income does not equal Revenue from contracts with customers +
Other income, if Note 6(d)'s total does not equal the face Employee benefits expenses line, or if any
bridge differs by one thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label                    |   `$’000` |  `amount_cents` | Sign            |
| --------------------------- | ---------------------------------------- | --------: | --------------: | --------------- |
| `total_revenue`             | Total revenue and other income           |   674,168 |  67,416,800,000 | positive        |
| `total_expenses`            | Total expenses (derived)                 |   481,152 |  48,115,200,000 | positive expense|
| `employee_expenses`         | Employee benefits expenses (face; 6(d))  |   178,914 |  17,891,400,000 | positive expense|
| `depreciation_amortisation` | Depreciation/amortisation expenses       |   107,741 |  10,774,100,000 | positive expense|
| `net_result`                | Profit for the year                      |   143,025 |  14,302,500,000 | positive        |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "QLD"`, `delivery_entity: "Gladstone Ports
Corporation Limited"`, `aggregation_role: "agency_detail"`, `measure_type: "actual"`,
`verified: false`, `data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Gladstone Ports is a single entity. No QLD total, no national total and no sum with Energy
  Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, another GOC, a statutory
  body or another state is created.
- The consolidated parent is the reporting boundary; Gladstone Marine Pilot Services Pty Ltd is
  consolidated, not added as a separate row.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series. They are never added to government program spending or to the ABS GFS
  PNFC benchmark.
- Energy Queensland, CS Energy, Stanwell, Powerlink Queensland and Sunwater Limited rows are
  untouched by this adapter.

## 7. How to verify

```bash
# Official pages: expect 200 for the reports page and the exact PDF.
curl -sSI -L -A 'Mozilla/5.0' 'https://gpcl.com.au/who-we-are/corporate-governance/reports/' | head -1
curl -sS -L -o /tmp/gladstone-2025-26.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://gpcl.com.au/wp-content/uploads/2026/09/Gladstone-Ports-Corporation-Annual-Report-2025-26.pdf'
sha256sum /tmp/gladstone-2025-26.pdf
# expect ff36d4681acbda7e472be06ac79b1d5f3f39409f4ce570e1049b00b19569ce87

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/qld-gladstone-ports/SHA256SUMS
cat ~/ausspend-source-archive/qld-gladstone-ports/retrieval.json

# Focused adapter tests
npx vitest run server/test/qld-gladstone-ports.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const gp = db.measures.countDocuments({source_id:"qld-gladstone-ports"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonGp = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"qld-gladstone-ports"}});
  print(JSON.stringify({gp, soc, nonGp}));
'
# expect {"gp":5,"soc":135,"nonGp":130}
```
