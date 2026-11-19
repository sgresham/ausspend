# Bogan Shire Council — General Purpose Financial Statements

- id: `bogan-gpfs`
- publisher: Bogan Shire Council
- source: <https://bogan.nsw.gov.au/your-council/publications/integrated-planning-and-reporting>
- jurisdiction: local
- status: active
- licence: © Bogan Shire Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Bogan Shire Council), audited FY2025-26 General Purpose Financial Statements. The PDF is discovered from the official Annual Report page when it exposes a fiscal-year link, with the council's documented official ArticleDocuments pin as the fallback because the site renders its document lists client-side; the exact bytes are SHA-256 archived outside the repo, and parsed only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities and Statement of Comprehensive Income reconcile exactly. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested. Total expenses is the documented bridge of the printed expenses-excluding-depreciation line plus the printed depreciation line, reconciled against the printed B1-1 totals.
