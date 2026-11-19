# Weddin Shire Council — General Purpose Financial Statements

- id: `weddin-gpfs`
- publisher: Weddin Shire Council
- source: <https://www.weddin.nsw.gov.au/Council/Integrated-Planning-and-Reporting/Reports>
- jurisdiction: local
- status: active
- licence: © Weddin Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Weddin Shire Council), audited FY2024-25 General Purpose Financial Statements — the latest audited standalone statements published by the council at 2026-11-19 (no FY2025-26 GPFS is posted; never substituted). The PDF is discovered from the official Integrated Planning and Reporting Reports page (latest dated FY2024-25 statements upload), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
