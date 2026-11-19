# Glen Innes Severn Council — General Purpose Financial Statements

- id: `glen-innes-severn-gpfs`
- publisher: Glen Innes Severn Council
- source: <https://www.gisc.nsw.gov.au/Council/Public-Documents-and-Policies/Annual-Reports>
- jurisdiction: local
- status: active
- licence: © Glen Innes Severn Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Glen Innes Severn Council), audited FY2024-25 General Purpose Financial Statements — the statement source is the official standalone annual financial statements (not the narrative annual report); FY2024-25 is the latest audited year available (no FY2025-26 audited statements published as at 2026-11-19), and the connector rejects the later 2025-26 and earlier 2023-24 documents. The PDF is discovered from the official Glen Innes Severn Council Annual Reports page, with the exact standalone FY2024-25 PDF as the documented official fallback pin (the page links only the annual report for 2024-25) only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
