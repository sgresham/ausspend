# Synthetic-seed removal readiness

Status: **executed 2026-11-17.** The 810 `source_id: synthetic-seed` measures and their one
`data_sources` register document were deleted after a verified backup. The database is now
**348,939 measures, 0 synthetic**, across 11 real sources. The default seed/bootstrap is real-only.
Every real source count is unchanged. This document keeps the dependency audit and the gate that
was met, followed by the recorded removal evidence.

## Post-removal baseline (executed, verified)

| Metric                                    |   Value |
| ----------------------------------------- | ------: |
| Total measures                            | 348,939 |
| `synthetic-seed` measures                 |       0 |
| Real measures                             | 348,939 |
| `data_sources` records                    |      11 |
| AusTender contracts (`aus-tender`)        | 117,894 |
| ACNC charity expenses (`acnc-charity`)    | 127,606 |
| GrantConnect awards (`grantconnect`)      |  62,128 |
| QLD QGIP (`qld-qgip`)                     |  34,000 |
| data.nsw.gov.au CKAN (`data-nsw-ckan`)    |   3,472 |
| PBS budget line items (`data-gov-au-pbs`) |   1,231 |
| NSW Budget 2025-26 (`nsw-budget`)         |   1,115 |
| QLD Budget 2026-27 (`qld-budget`)         |   1,051 |
| Dubbo Regional Council (`dubbo-council`)  |     245 |
| ABS GFS benchmark (`abs-gfs`)             |     169 |
| VIC Budget 2026-27 (`vic-budget`)         |      28 |

Verified backup taken before deletion:
`~/ausspend-backups/2026-11-17T03-26-35.175Z` (total 349,749; synthetic 810; ABS GFS 169;
natural-key count 348,939, checksum
`71a5c5f5b3a4c949ef9130e0365d4d92a9220a66f0fad488da51b1dfd2dd755c`).

## Pre-removal baseline (the ready state)

| Metric                                    |   Value |
| ----------------------------------------- | ------: |
| Total measures                            | 349,749 |
| `synthetic-seed` measures                 |     810 |
| Real measures                             | 348,939 |
| AusTender contracts (`aus-tender`)        | 117,894 |
| ACNC charity expenses (`acnc-charity`)    | 127,606 |
| GrantConnect awards (`grantconnect`)      |  62,128 |
| QLD QGIP (`qld-qgip`)                     |  34,000 |
| data.nsw.gov.au CKAN (`data-nsw-ckan`)    |   3,472 |
| PBS budget line items (`data-gov-au-pbs`) |   1,231 |
| NSW Budget 2025-26 (`nsw-budget`)         |   1,115 |
| QLD Budget 2026-27 (`qld-budget`)         |   1,051 |
| Dubbo Regional Council (`dubbo-council`)  |     245 |
| ABS GFS benchmark (`abs-gfs`)             |     169 |
| VIC Budget 2026-27 (`vic-budget`)         |      28 |

Synthetic rows by dimension (all removed):

| Dimension      | Counts                                             |
| -------------- | -------------------------------------------------- |
| `measure_type` | actual 270, budget 270, estimate 270               |
| `fiscal_year`  | 2023-24 270, 2024-25 270, 2025-26 270              |
| region         | AUS, NSW, VIC, QLD, WA, SA, TAS, ACT, NT — 90 each |
| function       | COFOG 01–10 — 81 each                              |

## Dependency audit

| Area                                                                                                 | Dependency on `synthetic-seed`                                               | Readiness change                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/seed/synthetic.ts`                                                                       | Only seed implementation; always deletes/reinserts synthetic rows            | `mode: 'synthetic' \| 'real'`; **real is now the default**. Real mode writes taxonomy + real source register, **0** synthetic rows, and never deletes existing rows |
| `scripts/seed.ts`                                                                                    | No mode flag                                                                 | **Real-only is the default**; synthetic requires `--synthetic` / `SEED_MODE=synthetic`. Prints mode and `synthetic_written`                                         |
| `package.json`                                                                                       | `seed` only                                                                  | `seed` is real-only; added `seed:real`, explicit `seed:synthetic` and `clean:synthetic`                                                                             |
| `docker-compose.yml`                                                                                 | Compose seed always synthetic; comment says only synthetic rows are replaced | Seed service passes `SEED_MODE` and now defaults to **`real`**; synthetic is an explicit opt-in                                                                     |
| `server/src/seed/clean.ts` (new)                                                                     | —                                                                            | Dry-run inventory + guarded execute; the only writes are `source_id: 'synthetic-seed'`                                                                              |
| `scripts/clean-synthetic.ts` (new)                                                                   | —                                                                            | CLI: dry run by default; `--execute` requires a verified backup                                                                                                     |
| `shared/src/data-source.ts`                                                                          | Defines `SYNTHETIC_SOURCE` and anchor `/data-sources#synthetic-seed`         | Kept: real-only mode simply does not register it; cleanup removes that one register doc                                                                             |
| `server/src/api/coverage.ts`                                                                         | `synthetic: true` hard-coded; synthetic-only limitation text                 | `synthetic` is now derived from the row count; added `synthetic_measures`, `real_measures`, `counts.*` and `coverage_gaps`; no-synthetic limitation text            |
| `server/src/api/data-sources.ts`                                                                     | Lists whatever is in the register                                            | No code change; synthetic disappears when its register doc is removed                                                                                               |
| Global coverage banner (removed 2026-11-18)                                                          | Always said seed rows sit beside live rows                                   | Removed from the global Layout; the limitations remain on `/coverage-limitations` and the source/metadata pages                                                     |
| `client/src/pages/HomePage.tsx`                                                                      | Intro/alert claimed every amount is a placeholder                            | Conditional real-only wording                                                                                                                                       |
| `client/src/pages/AboutPage.tsx`                                                                     | Warning and scope bullet assumed synthetic present                           | Conditional wording                                                                                                                                                 |
| `client/src/pages/DataSourcesPage.tsx`                                                               | Intro assumed the synthetic anchor always exists                             | Conditional "when present" wording                                                                                                                                  |
| `client/src/components/FunctionDetailView.tsx`                                                       | Intro/note/empty state mention the synthetic seed                            | Empty state now says “No real data for this dimension yet” when synthetic is absent; still never zero-fills                                                         |
| `client/src/components/RegionDetailView.tsx`                                                         | Intro/note/empty state mention the synthetic seed                            | Same conditional empty state; state/region wording distinguishes `region_id` from `location.state`                                                                  |
| `client/src/pages/SearchPage.tsx`                                                                    | Empty state mentions whole DB; applied-filters note named synthetic seed     | Conditional “No real data for this dimension yet”; neutral whole-DB wording                                                                                         |
| `client/src/api/types.ts`                                                                            | Coverage type had no synthetic/real counts or gaps                           | Added `synthetic_measures`, `real_measures`, `coverage_gaps`                                                                                                        |
| `server/test/seed-safety.test.ts`                                                                    | Only synthetic mode tested                                                   | Added: real-only on empty DB → 0 synthetic; real-only never deletes existing synthetic/real rows                                                                    |
| `server/test/clean-synthetic.test.ts` (new)                                                          | —                                                                            | Dry run deletes 0; fake real row survives; execute requires backup check; deletes only synthetic; idempotent                                                        |
| `server/test/m2-api.test.ts`                                                                         | Coverage assertions only                                                     | Added synthetic/real count and `coverage_gaps` assertions                                                                                                           |
| `e2e/mock-api.ts`                                                                                    | Fixtures always include synthetic source/rows                                | Added `{ empty: true }` mode: synthetic source/rows absent, empty function/state/search                                                                             |
| `e2e/empty-states.spec.ts` (new)                                                                     | —                                                                            | Function, state and search empty states; banner says no synthetic rows; source register omits synthetic                                                             |
| `scripts/audit.mjs`                                                                                  | Live audit required the synthetic source and synthetic provenance footers    | Synthetic source check is conditional; provenance footers accept any real source id                                                                                 |
| `README.md`, `docs/QA.md`                                                                            | Seed/coverage text assumed synthetic always present                          | Real-only mode, `clean:synthetic`, coverage fields and gate documented                                                                                              |
| Existing `e2e` fixtures (`home`, `data-sources`, `search`, `functions`, `regions`, `areas`, `about`) | Use synthetic fixture rows deliberately                                      | Left as-is: they exercise the mixed-data UI; the new empty-state spec covers the retired case                                                                       |

## What becomes empty or misleading if the 810 rows disappear today

Real rows do not cover the same dimensions as the seed:

| Real source       |    Rows | Has COFOG | Has curated region                   | Type                   |
| ----------------- | ------: | --------- | ------------------------------------ | ---------------------- |
| `aus-tender`      | 117,894 | 0         | 0 (only `location.state`)            | contract               |
| `data-gov-au-pbs` |   1,231 | 1,020     | 0 (`location.state: "Commonwealth"`) | budget                 |
| `nsw-budget`      |   1,115 | 657       | 0 (only `location.state: "NSW"`)     | actual/budget/estimate |
| `data-nsw-ckan`   |   3,472 | 3,224     | 0 (only `location.state: "NSW"`)     | actual/budget          |
| `dubbo-council`   |     245 | 19        | 245 (Dubbo only)                     | budget/estimate        |

Synthetic rows to be removed vs real coverage:

| View / summary                                    | Today with 810 synthetic rows                                         | After removal today                                                                                                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| National region page (`/regions/<AUS _id>`)       | 270 synthetic national rows                                           | **Empty** — no real source sets a national `region_id`; PBS is Commonwealth-wide but has no `region_id`                                                                                                                                                  |
| VIC / QLD / WA / SA / TAS / ACT / NT region pages | 90 synthetic rows each                                                | **Empty** — no real `region_id` for these regions                                                                                                                                                                                                        |
| State pages (`/states/:code`)                     | state-jurisdiction rows (no synthetic; synthetic has no jurisdiction) | Matches `jurisdiction = <code>` at level `state`: NSW gets NSW Budget + CKAN, VIC gets VIC Budget, QLD gets QLD BP3/BP4 + QGIP. Location-tagged federal AusTender rows and local-council rows are excluded. No COFOG-complete actual/estimate series yet |
| Function pages (`/functions/:code`)               | 81 synthetic rows per division                                        | Real budget/actual rows exist for most divisions via PBS/CKAN/NSW/Dubbo, but **no national or state actual/estimate series with both COFOG and region**. Rankings by state disappear; mixed/empty states must be honest                                  |
| Function ranked-state list                        | 9 states ranked per type                                              | **No real region-tagged budget rows outside Dubbo**, so the ranked list is empty/near-empty                                                                                                                                                              |
| Search by `measure_type=actual`                   | 270 synthetic actual rows (plus 183 real)                             | Actual rows collapse to 183 real rows: 10 CKAN actual + 173 NSW Budget actual; no national or non-NSW state actual series                                                                                                                                |
| Search by `measure_type=estimate`                 | 270 synthetic estimate rows (plus 283 real)                           | Estimate rows collapse to 283 real rows: 173 Dubbo estimate + 110 NSW Budget estimate; no national/state estimate series                                                                                                                                 |
| Search by `measure_type=budget`                   | 270 synthetic budget rows (plus 5,597 real)                           | 5,597 real budget rows remain (PBS, NSW Budget, CKAN, Dubbo)                                                                                                                                                                                             |
| `fiscal_year` filters 2023-24 / 2024-25 / 2025-26 | 270 synthetic each                                                    | Real coverage is mostly 2025-26 (PBS/NSW/CKAN/Dubbo) plus contract dates; **2023-24 and 2024-25 budget/actual coverage is thin or absent**                                                                                                               |
| Region/function summaries and charts              | Derived from synthetic rows                                           | Per-type totals remain only where real rows exist; no synthetic placeholder or zero-fill is shown                                                                                                                                                        |

Real coverage gaps:

- **No national actual/budget/estimate series with COFOG.** PBS is budget-only and programme-level.
- **No state/territory actual or estimate series with both COFOG and region.**
- **AusTender contracts have no COFOG and no curated region** — only `location.state`.
- **PBS has COFOG for defensible portfolios but no region**; `location.state` is literally
  `Commonwealth`.
- **NSW only** for state budget/actual coverage; VIC/QLD/WA/SA/TAS/ACT/NT are stubs or absent.
- **CKAN is targeted**, not whole-of-portal, and has no curated region.
- **Exactly one local council (Dubbo)**; no other council is covered.
- **2023-24 and 2024-25 actual/budget/estimate coverage is not provided by the live feeds** at the
  same breadth as the seed.

## Empty and coverage states

- Function, region/state and search empty states now distinguish the retired-seed case:
  “**No real data for this dimension yet** — nothing is estimated, zero-filled or replaced with a
  placeholder.”
- `/api/meta/coverage` exposes `synthetic` (derived), `synthetic_measures`, `real_measures` and
  `coverage_gaps`; the banner changes to “No synthetic seed rows are present…” and states the
  national/state actual/estimate gap.
- The data-source register simply omits `synthetic-seed` once its register document is removed; no
  page fabricates an anchor or a zero.

## Real-only seed and cleanup tooling (implemented and executed)

```bash
# Real-only bootstrap (now the default): taxonomy + real source register, 0 synthetic rows.
npm run seed
# Explicit aliases: npm run seed:real | SEED_MODE=real npm run seed
# Legacy opt-in only: npm run seed:synthetic | SEED_MODE=synthetic npm run seed

# Cleanup: DRY RUN by default, prints counts, writes nothing.
npm run clean:synthetic

# Deletion (executed 2026-11-17): requires a complete, recent, verified backup.
npm run clean:synthetic -- --execute \
  --backup ~/ausspend-backups/2026-11-17T03-26-35.175Z
```

`clean:synthetic --execute`:

1. Refuses a missing `--backup`, a backup from another database, a backup older than
   `--max-age-minutes` (default 120), an incomplete/truncated backup, or a natural-key checksum
   mismatch.
2. Refuses a backup whose `measures_count` is lower than the live measure count, or whose
   `data_sources` list does not include `synthetic-seed`.
3. Executes exactly `deleteMany({ source_id: 'synthetic-seed' })` on measures and
   `deleteOne({ source_id: 'synthetic-seed' })` on `data_sources`. Nothing else can match.
4. Re-inventories and fails loudly if the non-synthetic measure count changed.

## Removal execution and verification

See the item completion evidence for exact commands/output. In summary:

- `npm run clean:synthetic` dry run before deletion: synthetic 810 / total 349,749 /
  non-synthetic 348,939; after = identical; 0 deleted.
- Verified backup: `~/ausspend-backups/2026-11-17T03-26-35.175Z`; manifest measures 349,749,
  810 synthetic rows, ABS GFS 169, natural-key count 348,939/digest verified.
- `npm run clean:synthetic -- --execute --backup <dir>` deleted **810 measures + 1 data-source
  record**; after = synthetic 0 / total 348,939 / non-synthetic 348,939, and all 11 real per-source
  counts were identical before/after.
- Default `npm run seed` is real-only: on a scratch database it writes 0 synthetic rows and
  preserves any existing real rows; a synthetic run requires `npm run seed:synthetic`.
- Scratch tests: real-only seed emits 0 synthetic; dry run preserves a fake real row; execute
  (with a stubbed verified-backup check) deletes only synthetic and preserves the real row.
- `npm run seed:real` on an `ausspend_test_*` scratch DB: synthetic 0, regions 9, functions 53,
  real source register created, real rows preserved.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`,
  `npm run test:e2e` (alt ports 3101/5174) and `npm run audit` against an alt-port stack.

## Deletion gate (met and executed 2026-11-17)

The gate below was satisfied before the executed deletion. It remains the required check for any
future backup/cleanup run:

1. **S1 + S2 + S3 are complete and verified** (NSW Budget, targeted data.nsw.gov.au CKAN, Dubbo
   Regional Council), with their ingestion logs and provenance checks green.
2. **State-source research is complete for VIC, QLD, WA, SA, TAS, ACT and NT** and at least one
   real state/territory actual or budget source is implemented for the dimensions the UI claims.
3. **A real national/state actuals source is live** — specifically an ABS Government Finance
   Statistics (GFS) ingestion (or an equivalent official national/state actual series) that
   provides actual expenditure by COFOG and jurisdiction, so removing the seed does not leave
   national/state actual and estimate pages permanently empty. Budget/estimate coverage should be
   explicit about what is and is not available.
4. **The UI empty states and coverage gaps are accepted** for every remaining dimension (function
   pages, national/state pages, search by `measure_type`, fiscal-year filters), with the no-real-
   data wording reviewed by the product owner.
5. **A fresh verified backup exists**: `npm run db:backup -- --prune 14` completed, and the
   manifest's collection counts, natural-key checksum and `data_sources` statuses have been
   verified by `clean:synthetic` (or `db:restore` into a scratch DB).
6. **Scratch restore drill passed**: restore the backup into an `ausspend_restore_test_*` database,
   run the clean dry run there, then execute there and confirm non-synthetic rows are unchanged.
7. **Human sign-off** recorded for the deletion, including the exact backup path and the
   post-clean expected counts (synthetic 0, total = 348,939 for the executed run; the earlier
   readiness estimate of 123,957 predates the GrantConnect, QGIP, ACNC, VIC, QLD and ABS GFS
   ingestions).

All seven were true for the 2026-11-17 execution (human instruction to proceed without another
approval gate recorded on the work item). The default seed is now real-only and the default
`clean:synthetic` mode remains non-destructive.
