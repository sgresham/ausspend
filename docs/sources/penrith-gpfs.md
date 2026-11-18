# Penrith City Council — General Purpose Financial Statements

- id: `penrith-gpfs`
- publisher: Penrith City Council
- source: <https://www.penrithcity.nsw.gov.au/resources-documents/documents/organisational-performance>
- jurisdiction: local
- status: active
- licence: © Penrith City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Forty-second NSW council GPFS adapter: one council only (Penrith City Council), audited FY2024-25 General Purpose Financial Statements published as the standalone '2024-25 Financial Statements' PDF for the year ended 30 June 2025 on the official Organisational Performance page. The PDF includes the independent auditor's reports on the general purpose financial statements. The PDF is discovered from that official page (no hard-coded document URL); the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Functions or activities and Statement of Comprehensive Income reconcile as printed. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the printed face-statement bridge (printed expenses excluding depreciation plus printed depreciation/impairment), equal to the printed B1-1 total; the B1-1 function split is a second cut of the same total and is not added.
