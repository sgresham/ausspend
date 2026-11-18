# NT Budget 2026-27 — COFOG-A capital works

Source id: `nt-budget`. Publisher: Northern Territory Treasury. Scope: **NT only**, territory-wide;
no local government, agency or project allocation.

## Source and archive

- Budget papers: <https://budget.nt.gov.au/budget-papers> (2026-27).
- Exact PDF: <https://budget.nt.gov.au/__data/assets/pdf_file/0004/1609249/2026-27-budget-bp4.pdf>
  — **Budget Paper No. 4, The Infrastructure Program**.
- Table: **Table 3: Capital works by COFOG-A category 2026-27**.
- SHA-256: `d128f1d8077ed04df1ca5458d31aa59d9fcb2072135d0c73b95f902b515efacd`
- Bytes: `493,573`
- Licence: NT budget papers are Crown copyright. Only derived rows are emitted; the PDF is
  archived outside the repo and not redistributed.
- Archive: `~/ausspend-source-archive/nt-budget/2026-27-budget-bp4.pdf`.
- Metadata manifest: `docs/source-archive/nt-budget-2026-27.json`.

The NT budget site returns a Cloudflare challenge to plain HTTP clients. The connector retrieves
the PDF through the documented headless-browser path, verifies the SHA-256/byte length, archives
the exact bytes, and extracts the table text with the shared PDF extractor.

## Table and mapping

The published table has ten COFOG-A categories in `$ million` plus a `TOTAL GENERAL GOVERNMENT`
row. Those ten labels are mapped by name to COFOG divisions; no label is invented:

| Published category               | COFOG |
| -------------------------------- | ----- |
| General public services          | 01    |
| Public order and safety          | 03    |
| Economic affairs                 | 04    |
| Transport                        | 04    |
| Environmental protection         | 05    |
| Housing and community amenities  | 06    |
| Health                           | 07    |
| Recreation, culture and religion | 08    |
| Education                        | 09    |
| Social protection                | 10    |

Transport and the residual `Economic affairs` category are both COFOG division 04; they remain
separate published rows, so grouping them to 04 does not double count.

## Rows and reconciliation

| Category                         |   $ million |         % |
| -------------------------------- | ----------: | --------: |
| Transport                        |     2,041.1 |      48.0 |
| Housing and community amenities  |       782.1 |      18.4 |
| Economic affairs                 |       496.3 |      11.7 |
| Public order and safety          |       426.3 |      10.0 |
| Education                        |       158.0 |       3.7 |
| Social protection                |       112.1 |       2.7 |
| Health                           |       102.5 |       2.4 |
| Recreation, culture and religion |        99.3 |       2.3 |
| Environmental protection         |        26.3 |       0.6 |
| General public services          |         9.6 |       0.2 |
| **TOTAL GENERAL GOVERNMENT**     | **4,253.6** | **100.0** |

- **10 rows** emitted, one per published category.
- Unit detected from the table header (`$M` / `$ million`) and stored as `AUD_millions`;
  converted explicitly at 100,000,000 cents per million.
- Amount reconciliation: categories sum to **4,253.6 $m** vs printed total **4,253.6 $m**
  (difference 0). Percentage reconciliation: 100.0 vs 100.0.
- The `TOTAL GENERAL GOVERNMENT` row is reconciliation-only and is never emitted.
- Every row: `measure_type=budget`, `fiscal_year=2026-27`, `jurisdiction_level=territory`,
  `jurisdiction=NT`, `location.state=NT`, `aggregation_role=additive`,
  `extraction_confidence=medium`, `data_quality_flag=provisional`, `verified=false`.
- No cross-source total is created.

## DB delta and reproduce

Before: **691,459** measures (source absent). After: **691,469** (+10 all `nt-budget`); no other
source deleted or modified. A second run upserts the same ten natural keys and leaves the DB at
**691,469**.

```bash
export MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev
npm run ingest:nt-budget
# [ingest:nt-budget] nt-budget: success fetched=10 upserted=10
# [ingest:nt-budget] db source_rows=10 violations=0 all_measures=691469
# [ingest:nt-budget] by_cofog=01=1,03=1,04=2,05=1,06=1,07=1,08=1,09=1,10=1
```

Checks: `npm run typecheck`, `npm run lint`, changed files pass Prettier, `npm test` (84 files,
920 passed, 2 skipped), `npm run build`, alt e2e on 3115/5186 (52 passed) and live alt audit on 3115/5186 (38/38). Ports 3001/5173 and production
nginx are not touched.

## Verify

```bash
mongosh 'mongodb://10.10.10.30:27017/ausspend_dev' --quiet --eval '
  print(db.measures.countDocuments({source_id:"nt-budget"}));
  printjson(db.measures.aggregate([{$match:{source_id:"nt-budget"}},
    {$group:{_id:{cofog:"$function_code",quality:"$data_quality_flag",confidence:"$extraction_confidence"},n:{$sum:1}}},
    {$sort:{"_id.cofog":1}}]).toArray());
'
# 10; 01/03/04(2)/05/06/07/08/09/10, all provisional/medium
```
