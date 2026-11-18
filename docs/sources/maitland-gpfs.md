# Maitland City Council — General Purpose Financial Statements

- id: `maitland-gpfs`
- publisher: Maitland City Council
- source: <https://www.maitland.nsw.gov.au/council/about-council/financial-reports-and-plans>
- jurisdiction: local
- status: active
- licence: © Maitland City Council. Published council documents used here for public-interest research; not an open-data licence grant.

Eleventh NSW council GPFS adapter: one council only (Maitland City Council), audited FY2024-25 General Purpose Financial Statements. The PDF is discovered from the official Financial reports and plans page (no hard-coded document URL) over plain HTTP, the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the Income Statement, B1-1 totals and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Only the printed top-level categories that reconcile exactly are emitted; the published +/-$1 thousand component rounding is retained as reconciliation evidence and components are never summed.
