# ABS International Trade (Data API Beta)

- id: `abs-international-trade`
- publisher: Australian Bureau of Statistics
- source: <https://www.abs.gov.au/statistics/economy/international-trade>
- jurisdiction: federal
- status: active
- licence: © Australian Bureau of Statistics. Data API Beta, keyless access; ABS data used under the ABS website terms. Not an open-data licence grant for third-party reuse.

ABS International Trade via the keyless Data API Beta (https://data.api.abs.gov.au/rest/). Goods: ITGS 1.2.0, MEASURE=M1 current prices, TSEST=10 original, REGION=AUS, FREQ=M, DATA_ITEM 1000/2000 plus printed commodity categories, ingested from the discovered earliest month (1971-07 at the 2026-11-18 check) through the latest available month (2026-09), in 60-month chunks. Services: TRADE_SERV_CNTRY_FY 1.0.0, EXP_IMP EXP/IMP, EBOPS TOTAL, COUNTRY TOT, FREQ=A, every available financial year (2000–2024) labelled by 1 July start year, in per-year requests. Trade values are observed AUD millions converted to integer cents. Latest-month anchor: ABS Sep-2026 536801.xlsx (171,559 B; SHA-256 4a55f3d60a43e3e976f4eb339137755bdc02e3ca4283db81762f1be1ec0760b4), archived outside the repo; it prints seasonally adjusted total goods credits 48,434 $m and debits 45,609 $m, while the API original series prints 48,173 $m and 46,547 $m, so the XLSX is an existence/magnitude check only and is not ingested. Limitations: no goods+services total, no cross-source total, no spending or profit data, and the SA XLSX is not an equality anchor for the original series.
