# QLD SOC — Port of Townsville Limited annual-report evidence

**Status:** implementation evidence only. **PREMISE FALSIFIED — the FY2025-26 face statement does
not reconcile at zero tolerance, so no rows were ingested.** The exact PDF is archived outside the
repo; no PDF or raw table is committed. **Entity:** Port of Townsville Limited only — a Queensland
Government Owned Corporation (GOC), not a statutory body. No QLD total, no other port, no
parent/subsidiary addition.

**Checked:** 2026-11-19 (Australia/Sydney).

## 1. Discovery and access log

| Step                   | URL                                                                                                                           | HTTP    | Result                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| Official annual reports| <https://www.townsville-port.com.au/media-publications/publications/annual-reports/>                                           | **200** | `text/html` (326,220 bytes); lists the 2025-26 and older annual reports as S3 PDFs.      |
| Latest report PDF      | <https://s3-ap-southeast-2.amazonaws.com/os-data-2/townsville-port-2/bundle13/5826t1739_annual_report_2025-26.pdf>              | **200** | `application/pdf`, 3,372,376 bytes, 84 PDF pages                                        |

The connector fetches the annual-reports page and parses its PDF links. The page mixes absolute and
protocol-relative S3 hrefs; both are resolved before filtering. A link is accepted only when its
filename contains “Annual Report” and a consecutive financial-year span (four-digit `2025-26` or
two-digit `24-25`, `18-19`). The Statement of Corporate Intent (`…_sci_2025-26.pdf`) and other
publications are rejected by name. The PDF URL itself is never hard-coded.

## 2. Exact document

- **Title:** Port of Townsville Limited Annual Report 2025–26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **URL:** `https://s3-ap-southeast-2.amazonaws.com/os-data-2/townsville-port-2/bundle13/5826t1739_annual_report_2025-26.pdf`
- **Bytes:** 3,372,376.
- **PDF pages:** 84.
- **SHA-256:** `5f15e1ed55235a2e796da8f8dfc32002bf3e39a4f41973c93f9b372bb455b839`.
- **Archive root:** `~/ausspend-source-archive/qld-port-of-townsville/` (outside the repo; not
  committed). It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, retrieval
  date, bytes, pages, SHA-256 and `extraction_status: "deferred"`.

## 3. Printed unit and face statement

The Statement of Profit or Loss and Other Comprehensive Income is on PDF page 48 (printed page 48).
Its header prints `$` (whole dollars) for both the 2026 and 2025 columns. The unit gate accepts only
an explicit whole-dollar unit; `$'000`, `$m`, a unit-less read or an ambiguous read is deferred.

Printed current-year column (`$`):

```text
Revenue from Contracts with Customers                                99,855,300
Interest Revenue                                                        838,874
Other Revenue                                                         2,151,403
Fair Value Gains on Investment Properties                             5,218,195
Total Revenue                                                       108,063,771

Employee Expenses                                                    31,851,679
Supplies and Services                                                30,623,273
Depreciation and Amortisation Expense                                15,172,521
Finance Costs                                                         4,147,923
Other Expenses                                                        3,679,258
Total Expenses                                                       85,474,655

OPERATING RESULT BEFORE INCOME TAX EXPENSE                           22,589,116
Income Tax Expense                                                   (6,792,073)
OPERATING RESULT FOR THE YEAR                                        15,797,044

Increase/(Decrease) in Revaluation Surplus                           24,657,584
TOTAL COMPREHENSIVE INCOME                                           40,454,628
```

## 4. Reconciliation attempt (zero tolerance) — the gap

The printed subtotals and bridges do **not** all agree:

```text
revenue components:
  99,855,300 + 838,874 + 2,151,403 + 5,218,195 = 108,063,772
  but printed Total Revenue = 108,063,771        → $1 mismatch

expense components:
  31,851,679 + 30,623,273 + 15,172,521 + 4,147,923 + 3,679,258 = 85,474,654
  but printed Total Expenses = 85,474,655        → $1 mismatch

operating-result bridge:
  108,063,771 - 85,474,655 = 22,589,116
  = printed OPERATING RESULT BEFORE INCOME TAX EXPENSE   → agrees

net-result bridge:
  22,589,116 + (6,792,073) = 15,797,043
  but printed OPERATING RESULT FOR THE YEAR = 15,797,044 → $1 mismatch

total-comprehensive-income bridge:
  15,797,044 + 24,657,584 = 40,454,628
  = printed TOTAL COMPREHENSIVE INCOME                   → agrees
```

The prior-year column has the same component-rounding property (components sum one dollar above the
printed revenue total and one dollar below the printed expense total), while its 2025 net bridge is
exact. The current-year net bridge is one dollar short.

**Outcome:** the adapter returns `deferral.reason` = `reconciliation: statement reconciliation failed
with zero tolerance: revenue component total mismatch …; expense component total mismatch …;
net-result bridge mismatch …` and emits **0 records**. This is the brief's premise-falsifier path:
stop, document the gap, do not fabricate rows. The connector is still registered so the document is
recorded as deferred (not as rows).

## 5. Extracted entity rows

**None.** The FY2025-26 report produced no rows because the printed face statement is one dollar off
on three zero-tolerance checks. No amount was adjusted, rounded or fabricated to force a pass.

## 6. No-total / no-cross-entity rule

- Port of Townsville is a single entity. No QLD total, no national total and no sum with Energy
  Queensland, CS Energy, Stanwell, Powerlink Queensland, Sunwater Limited, Gladstone Ports, another
  GOC, a statutory body or another state is created.
- Revenue, total expenses, components and the net result overlap. They are never added to
  government program spending or to the ABS GFS PNFC benchmark.
- Existing SOC sources and rows are untouched.

## 7. How to verify

```bash
# Official pages: expect 200 for the annual-reports page and the exact PDF.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.townsville-port.com.au/media-publications/publications/annual-reports/' | head -1
curl -sS -L -o /tmp/townsville-2025-26.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://s3-ap-southeast-2.amazonaws.com/os-data-2/townsville-port-2/bundle13/5826t1739_annual_report_2025-26.pdf'
sha256sum /tmp/townsville-2025-26.pdf
# expect 5f15e1ed55235a2e796da8f8dfc32002bf3e39a4f41973c93f9b372bb455b839

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/qld-port-of-townsville/SHA256SUMS
cat ~/ausspend-source-archive/qld-port-of-townsville/retrieval.json

# Focused adapter tests (includes the real-shaped deferral and the reconciled row path)
npx vitest run server/test/qld-port-of-townsville.test.ts

# Shared-dev DB: expect 0 rows and a deferred document, with existing SOC unchanged
mongosh "$MONGO_URL" --quiet --eval '
  print(JSON.stringify({
    rows: db.measures.countDocuments({source_id:"qld-port-of-townsville"}),
    deferred: db.deferred_soc_documents.countDocuments({source_id:"qld-port-of-townsville"}),
    soc_total: db.measures.countDocuments({jurisdiction_level:"soc"})
  }));
'
# expect {"rows":0,"deferred":1,"soc_total":135}
```
