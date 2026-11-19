# Tamworth Regional Council — General Purpose Financial Statements

- id: `tamworth-gpfs`
- publisher: Tamworth Regional Council
- source: <https://www.tamworth.nsw.gov.au/about/reports-and-registers/financial-reporting>
- jurisdiction: local
- status: active
- licence: © Tamworth Regional Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Tamworth Regional Council), audited FY2025-26 General Purpose Financial Statements from the official standalone Annual Financial Statements PDF with the independent auditor's report. The standalone audited FS is discovered from the official Financial Reporting page, with a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Tamworth prints net loss from the disposal of assets as an expense component of the expenses-excluding-depreciation subtotal, so it is emitted as an expense line. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation/amortisation/impairment, equal to the printed B1-1 expense total. B1-1 income includes grants and contributions, so B1-1 income equals the face total income, B1-1 operating result equals the net result, and B1-1 grants equal operating plus capital grants. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
