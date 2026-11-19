# NT SOC — Territory Generation annual-report evidence

**Status:** implementation evidence only. This is the **second Northern Territory state-owned-entity
source**, after Jacana Energy. The exact PDF is archived outside the repo; no PDF or raw table is
committed. **Entity:** **Territory Generation** only — a Northern Territory Government Owned
Corporation (GOC) and electricity generator. **The NT GOC list is not claimed to be complete.** No
other NT GOC or government business division and **no NT, state or national total** is created; no
parent+subsidiary addition is made, and the two implemented NT entities are never added together.

**Checked:** 2026-11-19.

## 1. Discovery and access log

| Step              | URL                                                                                                                | HTTP | Result                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------ |
| Official page     | <https://www.territorygeneration.com.au/news-publications/corporate-publications/>                                 | 200  | `text/html`, 93,496 bytes; lists the current annual report and previous years. |
| Latest report PDF | <https://www.territorygeneration.com.au/wp-content/uploads/2026/10/Territory-Generation-Annual-Report-2025-26.pdf> | 200  | `application/pdf`, **8,695,953 bytes**, Last-Modified 2026-10-28; FY2025-26.   |
| Older reports     | The same page lists 2024-25, 2023-24, 2022-23, 2021-22, 2020-21 and earlier PDFs (not used).                       | —    | Ignored by the latest-year selection; no stale prior-year row is substituted.  |
| Not used          | Statements of Corporate Intent linked from the same page.                                                          | —    | Ignored: the filename does not contain "annual report".                        |

The connector fetches the official page and parses PDF links whose filename contains “annual
report” and a start/end year range (`2025-26` → fiscal year `2025-26`). The newest fiscal year wins.
The PDF URL is **not hard-coded**; `NT_TERRITORY_GENERATION_ANNUAL_REPORT_URL` is an operator
override only, and discovery fails loudly rather than pinning a dead URL. No fallback to an
unofficial copy is used.

## 2. Exact document

- **Title:** Territory Generation Annual Report 2025–26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 8,695,953.
- **Content type:** `application/pdf`.
- **Last-Modified:** 2026-10-28.
- **SHA-256:** `f801b948156383c110245fb622a59a0dda4b5e0fe5b163fa599f2227abc17c9e`.
- **Archive root:** `~/ausspend-source-archive/nt-territory-generation/` (outside the repo; not
  committed). It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the document URL,
  discovery page, retrieval date, bytes, PDF page count and SHA-256. The connector re-verifies the
  hash before parsing.

```text
cat ~/ausspend-source-archive/nt-territory-generation/SHA256SUMS
cat ~/ausspend-source-archive/nt-territory-generation/retrieval.json
sha256sum ~/ausspend-source-archive/nt-territory-generation/*.pdf
```

## 3. Printed unit and statement

The audited Statement of profit or loss and other comprehensive income and Notes 3 and 4 print an
explicit `$’000` unit. The unit gate requires one explicit supported unit (`$'000`, `$M` or whole
`$`); a missing or ambiguous unit defers the document with 0 rows. It never guesses by magnitude.

The face statement is PDF page 71 (printed page 67); Notes 3 Revenue and 4 Expenses are PDF page 84
(printed page 80); the Note 20 profit-to-cash reconciliation is PDF page 95 (printed page 91).

| Printed line                            | 2026 ($'000) | PDF page (printed page) |
| --------------------------------------- | -----------: | ----------------------- |
| Revenue                                 |      337,441 | 71 (67)                 |
| Cost of energy                          |    (280,132) | 71 (67)                 |
| Gross profit                            |       57,309 | 71 (67)                 |
| Other income                            |        4,259 | 71 (67)                 |
| Administrative expenses                 |     (23,241) | 71 (67)                 |
| Other expenses                          |      (3,428) | 71 (67)                 |
| Impairment (reversals)/expenses         |     (12,779) | 71 (67)                 |
| Finance costs                           |     (13,471) | 71 (67)                 |
| Profit before income tax                |       34,207 | 71 (67)                 |
| Income tax expense                      |        9,945 | 71 (67)                 |
| Profit for the year                     |       24,262 | 71 (67)                 |
| Total comprehensive income for the year |       24,262 | 71 (67)                 |

There is **no single printed Total revenue or Total expenses line**. Total revenue is the exact sum
of the printed Revenue + Other income lines (337,441 + 4,259 = **341,700**). Total expenses is the
exact sum of the printed Cost of energy + Administrative expenses + Other expenses + Impairment +
Finance costs lines (280,132 + 23,241 + 3,428 − 12,779 + 13,471 = **307,493**). They are accepted
only because the printed Gross profit, Profit before income tax, net-result and comprehensive-income
bridges agree exactly.

## 4. Reconciliation (zero tolerance)

The 2026 column of the notes prints:

- **Note 3 revenue:** Electricity sales 331,858 + Deferred grant income 4,146 + Other revenue 1,437 =
  **337,441** (equal to the face Revenue line). Other income: Claim recoveries and other income
  2,347 + Interest income 1,912 = **4,259** (equal to the face Other income line).
- **Note 4(a) total cost of energy:** Energy costs 172,453 + Repairs and maintenance 32,799 +
  Employee benefits expense 33,901 + Property costs 5,366 + Other administrative costs 5,264 +
  Inventory valuation 509 + Depreciation and amortisation 29,840 = **280,132**.
- **Note 4(b) total administrative expenses:** Employee benefits expense 11,600 + Insurance 3,564 +
  IT and communications 3,038 + Professional fees 1,724 + Other administrative costs 1,955 +
  Depreciation and amortisation 1,360 = **23,241**.
- **Note 4(c) total other expenses:** Operational projects 3,132 + Foreign exchange loss/(gain) 296 =
  **3,428**.
- **Note 4(d) total net impairment of assets:** Impairment expense 0 − Impairment reversal 12,779 =
  **−12,779**.
- **Note 4(e) total finance costs:** Interest and finance charges 13,471 = **13,471**.
- **Gross profit bridge:** 337,441 − 280,132 = **57,309** (printed).
- **Profit before income tax bridge:** 341,700 − 307,493 = **34,207** (printed).
- **Net-result bridge:** 34,207 − 9,945 = **24,262** (printed).
- **Total comprehensive income:** 24,262 (other comprehensive income nil).
- **Employee expenses:** the two printed Note 4 Employee benefits expense lines (Cost of energy
  33,901 + Administrative expenses 11,600) = **45,501**. Each component already reconciles into its
  printed note subtotal.
- **Depreciation and amortisation:** the two printed Note 4 lines (Cost of energy 29,840 +
  Administrative expenses 1,360) = **31,200**, which must equal the printed Note 20 reconciliation
  **31,200**.

Any mismatch, missing printed line or ambiguous unit defers the whole document with **0 rows**.

## 5. Rows

Exactly five entity-level SOC statement lines are emitted for FY2025-26:

| `soc_line_item`             | Printed source                                               | Amount (cents) |
| --------------------------- | ------------------------------------------------------------ | -------------: |
| `total_revenue`             | face Revenue + Other income (derived, bridged)               | 34,170,000,000 |
| `total_expenses`            | face cost/expense lines (derived, bridged)                   | 30,749,300,000 |
| `employee_expenses`         | Note 4(a) + Note 4(b) Employee benefits expense              |  4,550,100,000 |
| `depreciation_amortisation` | Note 4(a) + Note 4(b) lines, equal to Note 20 reconciliation |  3,120,000,000 |
| `net_result`                | face Profit for the year                                     |  2,426,200,000 |

Every row has jurisdiction `NT`, jurisdiction_level `soc`, aggregation_role `agency_detail`,
measure_type `actual`, `verified:false`, `potential_double_count:false`, and a deterministic natural
key (`nt-territory-generation:<sha256(entity|fiscal_year|line|document_url)>`).

## 6. Implementation and tests

- Adapter: `server/src/connectors/soc/nt/territory-generation.ts`.
- Registered in `server/src/connectors/registry.ts`; exported from
  `server/src/connectors/index.ts`; listed in `/api/soc`, the SOC page and
  `scripts/ingest-soc.ts`.
- Tests: `server/test/nt-territory-generation.test.ts` — discovery/latest (ignoring Statements of
  Corporate Intent), filename/year conversion, unit gate, ambiguous-unit gate, zero-tolerance
  note-subtotal failure, face expense-to-profit bridge failure, Note 4 vs Note 20 depreciation
  failure, natural-key/idempotency and no-cross-entity/NT aggregate.

## 7. Caveat

Entity-level only. Never add Territory Generation to government program spending, the PNFC
benchmark, Jacana Energy, another NT GOC or government business division, another state's SOC/GTE,
an NT total, a state total, a national total, or another SOC line. The NT GOC list is not claimed to
be complete; this source is one entity, not the Territory.
