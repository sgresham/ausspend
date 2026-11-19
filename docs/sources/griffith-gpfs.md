# Griffith City Council — General Purpose Financial Statements

- id: `griffith-gpfs`
- publisher: Griffith City Council
- source: <https://www.griffith.nsw.gov.au/Council/Corporate-planning-and-reporting>
- jurisdiction: local
- status: active
- licence: © Griffith City Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Griffith City Council), audited FY2024-25 General Purpose Financial Statements — the statement source is the official standalone audited financial statements (not the narrative annual report), the latest audited year published by the council at 2026-11-19 (no FY2025-26 GPFS is posted; never substituted). The PDF is discovered from the official Corporate planning and reporting page (latest FY2024-25 financial statements upload), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
