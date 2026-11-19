# Bega Valley Shire Council — General Purpose Financial Statements

- id: `bega-valley-gpfs`
- publisher: Bega Valley Shire Council
- source: <https://www.begavalley.nsw.gov.au/About-Council/Plans-and-Reporting/Financial-Statements>
- jurisdiction: local
- status: active
- licence: © Bega Valley Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Bega Valley Shire Council), audited FY2024-25 General Purpose Financial Statements — the statement source is the official standalone annual financial statements (not the narrative annual report); FY2024-25 is the accepted year for this source, and the connector rejects other years (the page also lists a 2025-26 document but this item does not substitute it). The PDF is discovered from the official Financial Statements page (latest FY2024-25 financial statements upload), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
