# VIC SOC — Melbourne Water annual-report evidence

**Status:** implementation evidence only. This is the **first Victorian water-corporation source**.
The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
**Melbourne Water** only — a Victorian **statutory water corporation** established under the
**Water Act 1989 (Vic)**. It is **not** a Government Business Enterprise or State business
corporation under the State Owned Enterprises Act 1992 (Vic). **No complete Victorian
water-corporation set is claimed**, and **no VIC, water-sector, state or national total** is created.
No parent+subsidiary addition is made and Melbourne Water is never combined with any other entity.

**Checked:** 2026-11-19.

## 1. Discovery and access log

| Step              | URL                                                                                             | HTTP | Result                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| Official page     | <https://www.melbournewater.com.au/about/publications/annual-report>                            | 200  | `text/html`, 131,789 bytes; names the 2025-26 Annual Report and an accessible version.                 |
| Latest report PDF | <https://www.melbournewater.com.au/media/eyJtZWRpYSI6IjMxNTg2In0%3D/downloads>                  | 200  | `application/pdf`, **26,868,975 bytes**; FY2025-26 accessible version.                                 |
| Same-year copy    | <https://www.melbournewater.com.au/media/eyJtZWRpYSI6IjMxNTgxIn0%3D/downloads>                  | 200  | `application/pdf`, standard (non-accessible) 2025-26 report; not used because accessible is preferred. |
| Older reports     | The page lists 2024-25, 2023-24, 2022-23, 2021-22, 2020-21 and earlier (not used).              | —    | Ignored by the latest-year selection; no stale prior-year row is substituted.                          |
| Not used          | Other `/media/<encoded>/downloads` links on the same page (corporate plan, other publications). | —    | Ignored: the anchor text does not name an annual report with a year range.                             |

The connector fetches the official page and parses `/media/<encoded>/downloads` links whose anchor
text contains “annual report” and a start/end year range (`2025-26` → fiscal year `2025-26`). The
newest fiscal year wins; within a year the “Accessible version” PDF is preferred. The PDF URL is
**not hard-coded**; `VIC_MELBOURNE_WATER_ANNUAL_REPORT_URL` is an operator override only, and
discovery fails loudly rather than pinning a dead URL. No fallback to an unofficial copy is used.

## 2. Exact document

- **Title:** Melbourne Water Annual Report 2025-26 (Accessible version).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 26,868,975.
- **Content type:** `application/pdf`.
- **SHA-256:** `a272cff4933d81e4f73ee683d245e1e3389c4e295cdf4309aa206ecb977081e1`.
- **Archive root:** `~/ausspend-source-archive/vic-melbourne-water/` (outside the repo; not
  committed). It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the document URL,
  discovery page, retrieval date, bytes, PDF page count (220) and SHA-256. The connector re-verifies
  the hash before parsing.

```text
cat ~/ausspend-source-archive/vic-melbourne-water/SHA256SUMS
cat ~/ausspend-source-archive/vic-melbourne-water/retrieval.json
sha256sum -c ~/ausspend-source-archive/vic-melbourne-water/SHA256SUMS
```

## 3. Printed unit and statement

The audited Statement of Profit or Loss and Other Comprehensive Income prints an explicit
**`($ thousands)`** unit. The unit gate requires one explicit supported unit (`$'000`, `$M` or whole
`$`); a missing or ambiguous unit defers the document with 0 rows. It never guesses by magnitude.

The statement is PDF page 111 (printed page 109). All five required rows are **printed face lines**;
none is derived:

| Printed line                                    |  2026 ($'000) |
| ----------------------------------------------- | ------------: |
| Revenue from contracts with customers           |     2,205,314 |
| Other revenue                                   |        17,816 |
| **Total revenue**                               | **2,223,130** |
| Depreciation and amortisation                   |       538,676 |
| Operational expenses                            |       343,146 |
| **Employee benefits**                           |   **189,952** |
| Repairs and maintenance                         |       119,023 |
| Administrative expenses                         |        74,214 |
| Finance expenses                                |       605,577 |
| Government rates and taxes                      |        86,526 |
| Asset transfers to Councils                     |        61,188 |
| Other expenses                                  |        12,340 |
| Net loss on revaluation of non-financial assets |        13,619 |
| **Total expenses**                              | **2,044,261** |
| Net profit from operations before tax           |       178,869 |
| Tax expense                                     |        83,393 |
| **Net profit for the period after tax**         |    **95,476** |

Employee benefits is cross-checked to Note 3.2 (PDF page 122): salary and wages 145,830 + leave
18,285 + defined contribution 18,058 + other employee expenses 7,779 = **189,952**, matching the
printed Total employee benefits expenses and the face line. Depreciation and amortisation is
cross-checked to Note 4.1.3 (PDF page 138): component depreciation 530,152 + total amortisation
8,524 = **538,676**, matching the printed Total depreciation and amortisation and the face line.

## 4. Zero-tolerance reconciliation

Every check below is exact (no rounding tolerance); any mismatch defers the whole document with 0
rows:

- Revenue components: 2,205,314 + 17,816 = 2,223,130 = printed Total revenue.
- Expense components: 538,676 + 343,146 + 189,952 + 119,023 + 74,214 + 605,577 + 86,526 + 61,188 +
  12,340 + 13,619 = 2,044,261 = printed Total expenses.
- Result bridge 1: 2,223,130 − 2,044,261 = 178,869 = printed Net profit from operations before tax.
- Result bridge 2: 178,869 − 83,393 = 95,476 = printed Net profit for the period after tax.
- Note 3.2: four components = 189,952 = printed Total employee benefits expenses = face Employee
  benefits.
- Note 4.1.3: seven depreciation components = 530,152 = printed Total depreciation; intangible
  amortisation 8,524 = printed Total amortisation; 530,152 + 8,524 = 538,676 = printed Total
  depreciation and amortisation = face Depreciation and amortisation.
- Comprehensive income: 95,476 + 1,969,192 = 2,064,668 = printed Total comprehensive income.

## 5. Rows and legal-class caveat

Exactly five entity-level SOC statement lines are ingested — `total_revenue`, `total_expenses`,
`employee_expenses`, `depreciation_amortisation`, `net_result` — with jurisdiction `VIC`,
jurisdiction_level `soc`, aggregation_role `agency_detail`, measure_type `actual`, `verified:false`,
`potential_double_count:false` and a deterministic natural key.

Melbourne Water is a **statutory water corporation under the Water Act 1989 (Vic)**. It is **not** a
GBE / State business corporation under the State Owned Enterprises Act 1992 (Vic). No VIC total and
no Victorian water-corporation set total exists, and Melbourne Water is never added to government
program spending, the PNFC benchmark, another water corporation or state-owned entity, a state total
or a national total.

## 6. Targeted ingest evidence (2026-11-19)

Source id `vic-melbourne-water`, run with `SOC_ONLY_SOURCE_IDS=vic-melbourne-water` against the
shared dev database `ausspend_dev` on the internal dev Mongo host:

- `data_sources.records_ingested` = **5**, status `active`, no errors.
- Latest `ingestion_logs` row: **success**, `records_fetched` = 5, `records_upserted` = 5, no errors.
- Measures for the source: **5** (one per printed line); no row is `verified` or
  `potential_double_count`.
- SOC measures **200 → 205**; overall measures **998,439 → 998,444**.
- Other sources unchanged (e.g. `nt-jacana-energy` 5, `nt-territory-generation` 5,
  `wa-busselton-water` 5).
- No VIC/water-sector/state/national aggregate row: 0 non-`agency_detail` rows and 0
  `*_total` line items for this source.
