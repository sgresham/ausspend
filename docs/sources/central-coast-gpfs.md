# Central Coast Council — General Purpose Financial Statements

- id: `central-coast-gpfs`
- publisher: Central Coast Council
- source: <https://www.centralcoast.nsw.gov.au/council/forms-and-publications/annual-report-2024-25>
- jurisdiction: local
- status: active
- licence: © Central Coast Council. Published council documents used here for public-interest research; not an open-data licence grant.

Fortieth NSW council GPFS adapter: one council only (Central Coast Council), audited FY2024-25 General Purpose Financial Statements published as the standalone 'Audited Financial Statement 2024-25' PDF for the year ended 30 June 2025 on the official Annual Report 2024-25 page. The PDF includes the independent auditor's reports on the financial statements. The PDF is discovered from that official page (no hard-coded document URL); the CloudFront CDN returns HTTP 403 to the default Node user agent, so discovery/download send a browser-like User-Agent and the page as Referer, with no browser fallback needed; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Functions or activities and Statement of Comprehensive Income reconcile as printed. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed face-statement bridge (printed expenses excluding depreciation plus printed depreciation/impairment); the printed B1-1 expense total is $2 thousand higher and is recorded as reconciliation evidence only.
