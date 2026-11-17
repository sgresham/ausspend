# QLD Budget 2026-27 ingestion (BP3 Capital Statement + BP4 Budget Measures)

**Status: QLD only, live in `ausspend_dev` on 2026-11-17. No VIC/WA/SA/TAS/ACT/NT or federal
source was modified by this item.**

## Sources and discovery

data.qld CKAN is keyless: `https://www.data.qld.gov.au/api/3/action`.

`package_show` was used for both datasets:

- BP3: `fb0df743-a719-476e-a3ae-4d4e3a0d9124` —
  _2026-27 State Budget—Budget Paper 3—Capital Statement_
- BP4: `e37910f7-0ae5-4a20-9e59-dcaa30517080` —
  _2026-27 State Budget—Budget Paper 4—Budget Measures_

| File                                       | Resource id                            | SHA-256                                                            | Bytes   |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------ | ------- |
| `capital-statement-bp3-2026-27-budget.csv` | `aa894f86-6f57-4e81-8f95-8c1541bcd819` | `ae1b6d99d6ce65843091d1a8ddf7174040d8f40287e0c8e6833631c8bb7643d5` | 270,747 |
| BP3 data dictionary                        | `bb5d4369-f12b-4f1a-80f0-60325565a710` | `1152880ba7e19915ac08a07c7c0126ff07f422579f9141b99c0ec8de2804f141` | 2,783   |
| `bp4-open-data-budget-2026-27.csv`         | `1eb033d0-a344-4c24-821a-96fc0a0d57fa` | `20ceebc6ce145217b5af4bfd54dace632f1facaac8eb9ea07785703c923a3243` | 38,777  |
| BP4 data dictionary                        | `da5e8180-1ab7-407d-a01e-f38d35f2db99` | `5197d5d7237e24f9dbe2c2498d90a9b2eab570d42439e98eae98d9a2561c2cda` | 758     |
| BP4 explanatory notes                      | `28333519-6495-4055-9662-c23889518030` | `efaff8eccebd5377729cef34dc07db6eac5d209197b3822956084c47fc9b00ff` | 1,282   |

The five exact files are archived outside the repo under
`AUSSPEND_SOURCE_ARCHIVE/qld-budget/`; the committed manifest is
[`docs/source-archive/qld-budget-2026-27.json`](source-archive/qld-budget-2026-27.json). Both
datasets are **CC BY 4.0**, attributed to `© State of Queensland (Queensland Treasury), 2026`.

## Units — confirmed by the archived dictionaries

- BP3 dictionary, `Total Estimated Cost`, `Expenditure to 30-06-26`, `Budget 2026-27`: **"Amount in
  $'000"**.
- BP4 dictionary columns: **`2026-27 ($'000)`** (and the other years likewise).

Conversion: **1 $'000 = 100,000 cents**. No magnitude-based inference. Quoted thousands such as
`"1,805"` become 180,500,000 cents.

## Rows ingested

| Series                | Raw rows |  Ingested | Excluded                                                                        |
| --------------------- | -------: | --------: | ------------------------------------------------------------------------------- |
| BP3 Capital Statement |      945 |   **943** | 2 rows with a blank `Budget 2026-27`                                            |
| BP4 Budget Measures   |      195 |   **108** | 7 revenue-measure rows; 1 negative capital measure; 79 zero 2026-27 impact rows |
| **Total**             |    1,140 | **1,051** | 89                                                                              |

BP4 section counts: expense 136 raw rows, capital 52 raw rows, revenue 7 raw rows. Revenue measures
are revenue-policy impacts, not spending, so they are excluded. Zero/negative current-year impacts
are not spending amounts and the model stores non-negative cents; they are skipped, never sign
flipped or zero-filled. All exclusions are logged as connector warnings.

## Mapping

Every row:

- `jurisdiction_level: "state"`, `jurisdiction: "QLD"`, `location.state: "QLD"`
- `measure_type: "budget"`, `fiscal_year: "2026-27"`
- `amount_cents` = confirmed `$'000` × 100,000
- `source_id: "qld-budget"`, exact CSV `source_url`, `source_dataset: "QLD Budget 2026-27 BP3/BP4"`
- `verified: false`, `aggregation_role: "additive"`, no COFOG function
- `data_quality_flag: "provisional"`; BP3 rows with coordinates use
  `"provisional; approximate_location"`

BP3: `project_name` = Project Name; `delivery_entity` = Agency; `funding_source` = Portfolio;
`location.sa4_name` = published SA4 text (may be a comma-separated list). Raw latitude/longitude
text is preserved in `notes` only — it may be multi-valued, so no coordinate is parsed, averaged or
invented.

BP4: `project_name` = Measure; `delivery_entity`/`funding_source` = Department; `description` =
Report Title + Section.

Natural keys:

- BP3: `qld-budget:<sha256(resource_id ␟ row ␟ portfolio ␟ agency ␟ project ␟ asset type ␟ SA4)[:40]>`
- BP4: `qld-budget:<sha256(resource_id ␟ source ID ␟ department ␟ measure ␟ section)[:40]>`

## Ingestion and idempotency

```bash
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
AUSSPEND_SOURCE_ARCHIVE=/path/outside/repo \
npm run ingest:qld
```

Observed:

```text
[ingest:qld] qld-budget: success fetched=1051 upserted=1051
[ingest:qld] qld-budget rows=1051 with_function=0 source_documents=5 unit=$'000
[ingest:qld] fiscal_year=2026-27 rows=1051 cents=3571515100000
```

- A second identical run again reported `fetched=1051 upserted=1051`; total measures stayed
  **187,974**, proving upsert idempotency.
- Other source counts were unchanged: AusTender 117,894; GrantConnect 62,128; data.nsw CKAN 3,472;
  PBS 1,231; NSW Budget 1,115; VIC 28; synthetic 810; Dubbo 245.
- `data_sources.records_ingested = 1051`; five `source_documents` rows (BP3, BP3 dictionary, BP4,
  BP4 dictionary, BP4 explanatory notes).

## API / UI

- `GET /api/states/QLD?fiscal_year=2026-27&measure_type=budget` returns all 1,051 rows (state
  detail default limit is 2,000), all QLD/state, total 3,571,515,100,000 cents.
- `GET /api/spending?jurisdiction_level=state&fiscal_year=2026-27` includes QLD rows; per-measure
  totals are never summed across types.
- `GET /api/meta/coverage` reports `qld-budget` active with `records_ingested=1051` and
  `qld_budget_last_ingested_at`.
- `/data-sources` links to the QLD state page; the coverage banner/About/Home name QLD.

## Limitations (explicit)

- No COFOG function is defensible from BP3/BP4: every row has `function_code` absent and is
  `provisional`.
- BP3 capital projects and BP4 budget measures are separate published series, not a complete QLD
  expense total. A state-page sum of same-measure-type rows is not an official QLD budget total.
- BP4 revenue measures are excluded. Zero/negative 2026-27 impacts are skipped.
- BP3 SA4 is raw text (multiple SA4s can be listed). Coordinates are raw source text in notes and
  may be multi-valued; no LGA/SA2/coordinate is invented.
- Figures are Budgeted, not audited actuals. Nothing is human-verified.
