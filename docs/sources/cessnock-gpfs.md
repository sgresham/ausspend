# Cessnock City Council — General Purpose Financial Statements

- id: `cessnock-gpfs`
- publisher: Cessnock City Council
- source: <https://www.cessnock.nsw.gov.au/Council/Forms-and-documents/Finance-and-budget/Annual-Financial-Statements>
- jurisdiction: local
- status: active
- licence: © Cessnock City Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Cessnock City Council), audited FY2024-25 General Purpose Financial Statements from the standalone Annual Financial Statements PDF with the audit opinion (the FY2024-25 annual report itself is narrative-only and has no GPFS section; that rejection path is retained). The standalone AFS is discovered from the official Annual Financial Statements page linked from the Annual Report page, with the WAF-aware browser path and a documented official fallback pin; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 Total functions and activities, Statement of Comprehensive Income, Statement of Financial Position, Statement of Changes in Equity and Statement of Cash Flows reconcile exactly. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus printed depreciation, reconciled against the printed B1-1 total. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
