# Yass Valley Council — General Purpose Financial Statements

- id: `yass-valley-gpfs`
- publisher: Yass Valley Council
- source: <https://www.yassvalley.nsw.gov.au/Our-Council/Policies-Plans-and-Reports/Integrated-Planning-and-Reporting-Documents>
- jurisdiction: local
- status: active
- licence: © Yass Valley Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Yass Valley Council), audited FY2024-25 General Purpose Financial Statements — the statement source is the official standalone annual financial statements (not the narrative annual report); FY2024-25 is the latest audited year available (no FY2025-26 audited statements published as at 2026-11-19), and the connector rejects the later 2025-26 and earlier 2023-24 documents. The PDF is discovered from the official Yass Valley Council Integrated Planning and Reporting Documents page (the direct FY2024-25 audited Financial Statements PDF), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
