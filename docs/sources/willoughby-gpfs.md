# Willoughby City Council — General Purpose Financial Statements

- id: `willoughby-gpfs`
- publisher: Willoughby City Council
- source: <https://www.willoughby.nsw.gov.au/Council/Policies-and-publications/Publications/2025-Annual-Financial-Statements-2024-2025>
- jurisdiction: local
- status: active
- licence: © Willoughby City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Nineteenth NSW council GPFS adapter: one council only (Willoughby City Council), audited FY2024-25 General Purpose Financial Statements published as the official 'Annual Financial Statements 2024-2025'. Node's plain fetch is rejected with a Cloudflare 403, so the PDF is discovered from the official 'Annual Financial Statements 2024-2025' page via the documented headless Chromium path (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.
