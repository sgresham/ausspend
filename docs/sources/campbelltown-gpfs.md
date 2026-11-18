# Campbelltown City Council — General Purpose Financial Statements

- id: `campbelltown-gpfs`
- publisher: Campbelltown City Council
- source: <https://www.campbelltown.nsw.gov.au/Council-and-Councillors/Financial-information>
- jurisdiction: local
- status: active
- licence: © Campbelltown City Council. Published council documents used here for public-interest research; not an open-data licence grant.

NSW council GPFS adapter: one council only (Campbelltown City Council), audited FY2024-25 General Purpose Financial Statements published as the official 'Financial Statements 2024-25' PDF linked from the council financial-information page. The connector discovers the PDF from the page's own link (no hard-coded document URL), the exact bytes are SHA-256 archived outside the repo, and parsing happens only when the printed $'000 unit is explicit and the income statement, B1-1 Total functions or activities, Statement of Comprehensive Income and note B3-3 reconcile exactly. The income statement has no discontinued operation: total revenue $306,751k, total expenses $243,664k (printed B1-1 total = expenses excluding depreciation $204,374k + depreciation/amortisation/impairment $39,290k) and net result $63,087k. The printed B1-1 objective expense split is emitted as a separate service cut of the same total, never added to the nature-of-expense cut. Every row is a non-additive agency_detail line (provisional/local_government, unverified) with a distinct source id; no region/LGA allocation and no other council is ingested.
