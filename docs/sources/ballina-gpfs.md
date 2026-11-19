# Ballina Shire Council — General Purpose Financial Statements

- id: `ballina-gpfs`
- publisher: Ballina Shire Council
- source: <https://www.ballina.nsw.gov.au/Council/Forms-and-Documents/Integrated-Planning-and-Reporting/Reporting>
- jurisdiction: local
- status: active
- licence: © Ballina Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Ballina Shire Council), audited FY2024-25 General Purpose Financial Statements — the statement source is the audited GPFS section embedded in the official Annual Report 2024-25 (not a narrative-only report); FY2024-25 is the latest audited year available (no FY2025-26 annual report published as at 2026-11-19), and the connector rejects older annual reports. The PDF is discovered from the official Ballina Shire Council Reporting page (the direct FY2024-25 annual report with financial statements PDF), with a documented official fallback pin only when the page yields no usable anchor; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
