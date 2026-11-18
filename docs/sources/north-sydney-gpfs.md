# North Sydney Council — General Purpose Financial Statements

- id: `north-sydney-gpfs`
- publisher: North Sydney Council
- source: <https://www.northsydney.nsw.gov.au/downloads/download/265/financial-statements>
- jurisdiction: local
- status: active
- licence: © North Sydney Council. Published council documents used here for public-interest research; not an open-data licence grant.

Twenty-fourth NSW council GPFS adapter: one council only (North Sydney Council), audited FY2024-25 General Purpose Financial Statements published as the standalone 'Financial Statements 2024-2025' PDF on the official Financial Statements document listing. The PDF includes the independent auditor's reports on the financial statements. The PDF is discovered from that official listing (no hard-coded document URL); the listing and file endpoints sit behind an AWS WAF challenge, so the documented headless Chromium path (channel chromium, not the headless shell) clears it and the connector still selects the link from the cleared HTML and re-verifies the bytes. The exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed B1-1 total, equal to printed expenses excluding depreciation plus printed depreciation/amortisation/impairment; note B3-4 depreciation plus gross IPPE impairment equals that face line.
