# Hornsby Shire Council — General Purpose Financial Statements

- id: `hornsby-gpfs`
- publisher: Hornsby Shire Council
- source: <https://www.hornsby.nsw.gov.au/Council/Forms-and-publications/Publications/Financial-Statements>
- jurisdiction: local
- status: active
- licence: © Hornsby Shire Council. Published audited financial statements used for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Hornsby Shire Council), audited FY2025-26 General Purpose Financial Statements published as the official 'Annual Financial Statements 2025/26' PDF linked from the council Financial Statements page. The connector discovers the PDF from the page's own link (no hard-coded document URL when a listing is supplied), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions and activities, Statement of Comprehensive Income and note B3-3 reconcile exactly. The income statement has no discontinued operation: total revenue $207,011k, total expenses $165,975k (printed B1-1 total = expenses excluding depreciation $138,425k + depreciation/amortisation/impairment $27,550k) and net result $41,036k. The printed B1-1 function expense split is emitted as a separate service cut of the same total, never added to the nature-of-expense cut. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
