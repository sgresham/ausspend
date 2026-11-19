# Byron Shire Council — General Purpose Financial Statements

- id: `byron-gpfs`
- publisher: Byron Shire Council
- source: <https://www.byron.nsw.gov.au/Council/Plans-Strategies/Council-Planning-Reporting/Reports-on-Our-Progress>
- jurisdiction: local
- status: active
- licence: © Byron Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Byron Shire Council), audited FY2025-26 General Purpose Financial Statements — the statement source is the official standalone audited financial statements (not the narrative annual report), the latest audited year published by the council at 2026-11-19 (no FY2026-27 GPFS is posted; never substituted). The PDF is discovered from the official Financial statements page (latest dated FY2025-26 audited upload), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
