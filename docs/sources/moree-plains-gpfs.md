# Moree Plains Shire Council — General Purpose Financial Statements

- id: `moree-plains-gpfs`
- publisher: Moree Plains Shire Council
- source: <https://www.mpsc.nsw.gov.au/budget/annual-report-and-financial-statements>
- jurisdiction: local
- status: active
- licence: © Moree Plains Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Moree Plains Shire Council), audited FY2024-25 General Purpose Financial Statements — the latest audited standalone statements published by the council at 2026-11-19 (no FY2025-26 GPFS exists yet; never substituted). The PDF is discovered from the official Annual Report and Financial Statements page (latest dated FY2024-25 statements upload), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
