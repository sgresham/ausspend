# NT SOC — Jacana Energy annual-report evidence

**Status:** implementation evidence only. This is the **first Northern Territory state-owned-entity
source**. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Jacana Energy only — the trading name of **Power Retail Corporation**, a Northern Territory
Government Owned Corporation (GOC) under the Power Retail Corporation Act 2014. **The NT GOC list is
not claimed to be complete.** No other NT GOC or government business division and **no NT, state or
national total** is created; no parent+subsidiary addition is made.

**Checked:** 2026-11-19.

## 1. Discovery and access log

| Step              | URL                                                                                                             | HTTP | Result                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| Official page     | <https://www.jacanaenergy.com.au/about/who-we-are>                                                              | 200  | `text/html`, 63,712 bytes; states Jacana is a government-owned corporation and links annual reports. |
| Latest report PDF | <https://www.jacanaenergy.com.au/sites/default/files/2026-10/Jacana%20Energy%20Annual%20Report%202025-2026.pdf> | 200  | `application/pdf`, **2,435,076 bytes**, 60 PDF pages, Last-Modified 2026-10-23; FY2025-26.           |
| Older reports     | The same page lists 2024-25, 2023-24, 2022-23, 2021-22 and earlier PDFs (not used).                             | —    | Ignored by the latest-year selection; no stale prior-year row is substituted.                        |

The connector fetches the official page and parses PDF links whose filename contains “annual
report” and a start/end year range (`2025-2026` → fiscal year `2025-26`). The newest fiscal year
wins. The PDF URL is **not hard-coded**;
`NT_JACANA_ENERGY_ANNUAL_REPORT_URL` is an operator override only, and discovery fails loudly rather
than pinning a dead URL. No fallback to an unofficial copy is used.

## 2. Exact document

- **Title:** Jacana Energy Annual Report 2025–26.
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 2,435,076.
- **PDF pages:** 60.
- **SHA-256:** `c5ac0c972e9021f452789d9e240956f42d173d2dd42e4f55fc78c80db831fc55`.
- **Content type:** `application/pdf`.
- **Archive root:** `~/ausspend-source-archive/nt-jacana-energy/` (outside the repo; not committed).
  It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the document URL, discovery
  page, retrieval date, bytes, PDF page count and SHA-256. The connector re-verifies the hash before
  parsing.

```text
cat ~/ausspend-source-archive/nt-jacana-energy/SHA256SUMS
cat ~/ausspend-source-archive/nt-jacana-energy/retrieval.json
sha256sum ~/ausspend-source-archive/nt-jacana-energy/*.pdf
```

## 3. Printed unit and statement

The audited Statement of profit or loss and other comprehensive income and Notes 4 and 5 print an
explicit `$’000` unit. The unit gate requires one explicit supported unit (`$'000`, `$M` or whole
`$`); a missing or ambiguous unit defers the document with 0 rows. It never guesses by magnitude.

The 2026 column prints:

| Printed line                          | 2026 ($'000) | PDF page (printed page) |
| ------------------------------------- | -----------: | ----------------------- |
| Electricity revenue                   |      461,652 | 30 (28)                 |
| Community Service Obligation revenue  |      131,347 | 30 (28)                 |
| Interest income                       |        3,640 | 30 (28)                 |
| Energy costs of sales                 |    (545,152) | 30 (28)                 |
| Employee benefits expense             |     (13,606) | 30 (28)                 |
| External service agreements           |        (652) | 30 (28)                 |
| Depreciation and amortisation expense |        (842) | 30 (28)                 |
| Other expenses                        |     (11,727) | 30 (28)                 |
| Finance costs                         |         (70) | 30 (28)                 |
| Profit before tax                     |       24,590 | 30 (28)                 |
| Income tax expense                    |        7,380 | 30 (28)                 |
| Profit for the year                   |       17,210 | 30 (28)                 |
| **Note 4 Total revenue**              |  **596,639** | 42 (40)                 |
| **Note 5 Total expenses**             |  **572,049** | 43 (41)                 |

Notes 4 and 5 print the two totals; the face statement prints the revenue/expense components, Profit
before tax and Profit for the year. All five reported rows are therefore printed values, not a
magnitude-scaled guess:

1. **Total revenue** — Note 4 Total revenue `596,639`.
2. **Total expenses** — Note 5 Total expenses `572,049`.
3. **Employee benefits expense** — face-statement line `13,606` (equal to Note 5(b)).
4. **Depreciation and amortisation expense** — face-statement line `842` (equal to Note 5(d)).
5. **Profit for the year** — face-statement line `17,210` (net result).

## 4. Reconciliation (zero tolerance)

Every printed subtotal and result bridge is checked; any mismatch defers the whole document with 0
rows:

- Note 4(a) electricity subtotal: 456,840 + 4,812 = **461,652**.
- Note 4 Total revenue: 461,652 + 131,347 + 3,640 = **596,639**.
- Note 5(a) energy costs subtotal: 531,675 + 9,529 + 3,627 + 321 = **545,152**.
- Note 5(b) employee benefits subtotal: 11,354 + 1,183 + 47 + 678 + 344 = **13,606**.
- Note 5(e) other expenses subtotal: 200 + 3,098 + 205 + 27 + 1,775 + 917 + 1,129 + 4,376 =
  **11,727**.
- Note 5 Total expenses: 545,152 + 13,606 + 652 + 842 + 11,727 + 70 = **572,049**.
- Face-line values equal the Note 4/5 subtotals: electricity, CSO, interest, energy costs,
  employee benefits, external services, depreciation, other expenses and finance costs.
- Profit before tax: 596,639 − 572,049 = **24,590**.
- Net result: 24,590 − 7,380 = **17,210**.
- Total comprehensive income: **17,210** (other comprehensive income nil).

## 5. Rows, flags and boundaries

Exactly five entity-level SOC statement lines are written:

| `soc_line_item`             | Amount (source $'000) |
| --------------------------- | --------------------: |
| `total_revenue`             |               596,639 |
| `total_expenses`            |               572,049 |
| `employee_expenses`         |                13,606 |
| `depreciation_amortisation` |                   842 |
| `net_result`                |                17,210 |

Every row has `jurisdiction: "NT"`, `jurisdiction_level: "soc"`, `aggregation_role:
"agency_detail"`, `measure_type: "actual"`, `verified: false` and `potential_double_count: false`,
plus a deterministic natural key over entity + fiscal year + line item + document URL. The rows are
provisional and unverified until a human spot-check.

No NT/state/national aggregate row is created. Jacana Energy is never added to government program
spending, the PNFC benchmark, another NT GOC or government business division, another state's
SOC/GTE, an NT total, a state total, a national total, or another SOC line. The NT GOC list is not
claimed complete: this source is one self-identifying, report-verifiable entity, not the Territory.

## 6. Implementation and checks

- Adapter: `server/src/connectors/soc/nt/jacana-energy.ts`.
- Registration: `server/src/connectors/registry.ts`, `server/src/connectors/index.ts`,
  `server/src/api/soc.ts`, `client/src/pages/SocPage.tsx`, `scripts/ingest-soc.ts`.
- Tests: `server/test/nt-jacana-energy.test.ts` (discovery/latest, filename/year conversion, unit
  gate, ambiguous-unit gate, zero-tolerance reconciliation failure, natural-key/idempotency and
  no-cross-entity/NT aggregate).
- Targeted ingest:

```text
MONGO_URL="$AUSSPEND_DEV_MONGO_URL" \
SOC_ONLY_SOURCE_IDS=nt-jacana-energy \
npm run ingest:soc
```

Expected proof: `measures` for `nt-jacana-energy` = 5; `data_sources.records_ingested` = 5, status
active, no errors; a `success` `ingestion_logs` row; SOC total 190 → 195; and no NT/state/national
aggregate row created.
