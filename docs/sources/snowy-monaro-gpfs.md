# Snowy Monaro Regional Council — General Purpose Financial Statements

- id: `snowy-monaro-gpfs`
- publisher: Snowy Monaro Regional Council
- source: <https://www.snowymonaro.nsw.gov.au/Have-Your-Say/Feedback-invited-on-Councils-audited-202526-Financial-Statements>
- jurisdiction: local
- status: active
- licence: © Snowy Monaro Regional Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Snowy Monaro Regional Council), audited FY2025-26 General Purpose Financial Statements — the statement source is the official standalone annual financial statements (not the narrative annual report); FY2025-26 is the current year for this source, and the connector rejects prior-year (2024-25/2023-24) documents. The PDF is discovered from the official Have Your Say exhibition document library (latest FY2025-26 GPFS attachment), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
