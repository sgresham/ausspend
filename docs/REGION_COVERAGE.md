# Region and state coverage

This document records what the region and state/territory pages actually cover,
and what they deliberately do not. It is a visibility and copy contract, not a
data migration: no row is assigned a curated `region_id` and no cross-state or
national total is invented.

## Routes

| Route                                | Matches                                                                | Never matches                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/api/regions/:regionId` (national)  | `region_id = <national _id>`                                           | federal contracts/grants by location; the ABS GFS benchmark                                 |
| `/api/regions/:regionId` (state)     | `region_id = <state _id>`                                              | the state jurisdiction by code; the ABS GFS benchmark                                       |
| `/api/regions/:regionId` (sub-state) | the shared area profile                                                | unrelated jurisdictions                                                                     |
| `/api/states/:code`                  | `jurisdiction = <code>` at `jurisdiction_level` **state or territory** | federal rows merely located in the state; local-council rows; `aggregation_role: benchmark` |

The state/territory route includes both levels because the ACT and NT budget
connectors publish their rows at `jurisdiction_level: "territory"`. A
state-only filter previously returned zero for those real budget rows. The
change does not alter NSW, VIC, QLD, WA or SA results: those jurisdictions have
no territory-level rows.

## Why most region pages are empty

The curated region layer is intentionally small. As observed on 2026-11-19,
roughly 245 of 998,149 measure rows carry a `region_id`; the remainder have no
curated region. The Australia/NSW/VIC/QLD/WA curated-region pages therefore
return zero _by design_ for national or state spending-by-curated-region.

The cure is honest copy, not a backfill:

- National region page: an explicit national coverage note. No national
  actual/budget/estimate project series with a curated region exists, federal
  contracts are **not** mapped to a national region, and the ABS GFS COFOG-A
  benchmark is linked at `/benchmark` as a separate non-additive layer.
- TAS state page: TAS's only state-level rows are `tas-budget` / `abs-gfs`
  benchmark aggregates. The page reports zero additive rows and exposes a
  separate benchmark count, source ids and a `/benchmark` link. Benchmark rows
  never enter the count, per-type totals or headline total.
- ACT/NT state pages: territory budget rows are now reachable through the
  state/territory level inclusion.

## API coverage field

Region/state detail responses include:

```json
{
  "coverage": {
    "scope": "national | state | region",
    "reason": "has-additive-rows | national-no-project-series | benchmark-only | no-additive-rows",
    "additive_count": 0,
    "benchmark_count": 0,
    "benchmark_sources": [],
    "benchmark_available": false,
    "benchmark_href": "/benchmark",
    "message": "…"
  }
}
```

`benchmark_count` and `benchmark_sources` exist only to explain an otherwise
empty page. No benchmark amount is returned by the region/state route and no
benchmark row is added to an additive total.

## What must not change

- No `region_id` backfill and no fabricated mapping of federal contracts to a
  national region.
- No cross-state or national spending total.
- No benchmark or SOC rows in additive totals.
- No new connector or source; this is a routing/visibility cure.

## How to check

With a populated database:

```bash
curl -s localhost:3000/api/states/ACT | jq '{count, total_cents, coverage}'
curl -s localhost:3000/api/states/NT | jq '{count, total_cents, coverage}'
curl -s localhost:3000/api/states/TAS | jq '{count, total_cents, coverage}'
curl -s "localhost:3000/api/regions?type=state&limit=200" | jq '.regions[] | select(.code=="AUS") | ._id'
curl -s localhost:3000/api/regions/<national _id> | jq '{count, total_cents, coverage}'
```

The TAS and national responses must show `count: 0` with a `coverage.message`
that points at `/benchmark`; they must not show a positive additive total.

Focused tests:

```bash
npx vitest run server/test/states.test.ts server/test/region-detail.test.ts
```
