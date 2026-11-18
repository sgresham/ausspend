# Victorian council performance indicators (LGPRF)

- id: `vic-lgprf`
- publisher: Local Government Victoria (Department of Government Services)
- source: <https://www.localgovernment.vic.gov.au/strengthening-councils/performance-reporting>
- dataset: <https://discover.data.vic.gov.au/dataset/local-government-performance-reporting>
- jurisdiction: local
- status: active (performance layer only)
- licence: CC BY 4.0; publisher Local Government Victoria. Source disclaimer forbids overly simplistic council league tables.

The existing layer is **23,068 non-additive performance-indicator rows** for 79 councils,
FY2020-21–FY2024-25. Every row has `amount_cents: 0` and a published `performance_value`.
Units are percentages, ratios, days, counts, scores, and **per-unit AUD rates** (per person, per
property assessment, per square metre, per councillor, per visit, per hour, per food premises, per
planning application, per kerbside bin).

**There is no total-dollar council income or expense indicator in this source.** It is a
performance-reporting layer, not a general-purpose financial statement. No value is converted to a
dollar total, no row is added to `spending_records`, and VIC council financial spending remains
**not available** from LGPRF. A genuine VIC financial layer requires a separate VGC1/ABS/GPFS or
equivalent general-purpose financial source.

Rows are never summed or averaged across councils, indicators or years. The source workbook
(`LGPRF-2020-2025-Full-Council-Data-Set-Nov25-Final-Release.xlsx`, 3,241,185 B, SHA-256
`d88f7ede3a154f1beb6359850dc25a68159d08e23478fec8f138d67d1b787376`) is archived outside the repo;
the existing performance rows are unchanged.
