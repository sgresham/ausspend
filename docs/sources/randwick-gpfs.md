# Randwick City Council — General Purpose Financial Statements

- id: `randwick-gpfs`
- publisher: Randwick City Council
- source: <https://www.randwick.nsw.gov.au/about-us/integrated-planning-and-reporting/our-reports>
- jurisdiction: local
- status: active
- licence: © Randwick City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twenty-second NSW council GPFS adapter: one council only (Randwick City Council), audited FY2024-25 General Purpose Financial Statements published as the standalone 'Financial Statements - 2024-25' PDF on the official Our reports page. The PDF includes the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL); randwick.nsw.gov.au serves a Cloudflare challenge to non-browser clients, so the documented headless Chromium path clears it and the connector still selects the link from the cleared HTML; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to the printed expenses-excluding-depreciation line plus the printed depreciation/impairment line.
