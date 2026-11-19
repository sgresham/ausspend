# Performance

## `/api/spending` search latency

### Symptom

`GET /api/spending?q=…` spent roughly 6 seconds on the server before returning a
page. The delay was in MongoDB, not in Cloudflare or the browser: the same wall
time was reproduced with `curl` against `127.0.0.1:3001`.

### Profiling (`explain('executionStats')`)

The route ran the filtered set **twice**:

1. a projected `find()` to build the whole-set summary and breakdowns, and
2. a sorted `find().skip().limit()` for the requested page.

With a text `q`, the planner could not use an index for the case-insensitive
`$or` regex on `project_name` / `description` / `delivery_entity`. It walked the
`source_id_1` index (the `$ne` AIHW filter) and fetched almost every document,
then did a blocking in-memory `SORT`. On a database of ~998k measures:

| Query                           | Plan                                          | keysExamined | docsExamined | executionTimeMillis |
| ------------------------------- | --------------------------------------------- | ------------ | ------------ | ------------------- |
| `q=health` (regex, former path) | `IXSCAN source_id_1` → `FETCH` → `SORT`       | 998,122      | 998,121      | 3,016               |
| `q=health` (text, new path)     | `IXSCAN search_text` → `TEXT_MATCH` → `FETCH` | 19,676       | 39,352       | 208                 |

The summary scan and the page scan each cost about the same, so the total was
~6s; the no-`q` listing was worse still (~14.8s) because it scanned and sorted
~996k rows twice.

### Fix

1. **Text index** `search_text` on `project_name`, `description`,
   `delivery_entity`, with `default_language: 'none'` (no stemming, no stop
   words). `q` word tokens are sent as quoted terms (`"health" "dubbo"`), so
   every token must match (AND) and each token may match any indexed field (OR
   across fields).
2. **Single `$facet`** for the text path: one `$match` feeds both the summary
   projection and the sorted page, instead of scanning the collection twice.
3. **Compound sort indexes** for the four documented sorts
   (`{amount_cents:-1,_id:1}`, `{amount_cents:1,_id:1}`,
   `{fiscal_year:-1,amount_cents:-1,_id:1}`,
   `{fiscal_year:1,amount_cents:-1,_id:1}`).
4. **No second full scan without `q`** (and for punctuation-only `q`): the
   projected filtered set is loaded once, sorted in memory with the same sort
   order, and only the requested page is fetched by `_id`.

`/api/spending/:id`, the response shape, pagination fields, whole-set summary,
per-measure-type totals and the non-additivity rules are unchanged.

### Measured result (median of 5 direct local calls, same database)

| Query                             | Before    | After      |
| --------------------------------- | --------- | ---------- |
| `q=health&sort=amount_desc`       | ~6,100 ms | **260 ms** |
| `q=dubbo&sort=amount_desc`        | ~5,870 ms | **22 ms**  |
| `q=telstra&sort=amount_desc`      | ~6,440 ms | **56 ms**  |
| `q=waternsw&sort=amount_desc`     | ~5,830 ms | **4 ms**   |
| `q=zzzz-not-found`                | ~5,470 ms | **50 ms**  |
| `q=health&sort=amount_asc&page=2` | ~6,100 ms | **268 ms** |

### Trade-off: whole-word text matching

A MongoDB text index matches whole words, not arbitrary substrings. A single
`q` word therefore no longer matches inside a longer word: `q=health` matched
20,708 rows with the old substring regex and 18,676 rows with the text index on
the sample database (the difference is rows such as `healthcare` / `Healthier`
that are not the token `health`). Multi-word AND, case-insensitivity, the three
searched fields, and pagination/summary consistency are preserved.

Queries whose tokens contain characters other than letters, digits, `_` or `-`
(for example `.*`, `(`, `Bridge.*`) keep the literal regex path, so regex
metacharacters are still treated as text. If a fresh database has not finished
building `search_text` yet, the route falls back to the literal path instead of
returning a 500.

### Index build cost / rollout

- `search_text` build on ~998k measures took ~38s in this environment; the four
  sort indexes build in seconds. Expect additional disk for the text index and
  for the four compound indexes.
- Mongoose creates the indexes declared on `MeasureModel` at startup
  (`autoIndex`), or build them explicitly:

```js
db.measures.createIndex(
  { project_name: 'text', description: 'text', delivery_entity: 'text' },
  { name: 'search_text', default_language: 'none' },
);
```

### How to check

```bash
# direct API timing
curl -s -o /dev/null -w '%{time_total}\n' \
  'http://127.0.0.1:3001/api/spending?q=health&sort=amount_desc&page=1&page_size=20'

# plan proof (MONGO_URL points at the database)
mongosh "$MONGO_URL" --eval '
  db.measures.aggregate([
    { $match: { $text: { $search: "\"health\"" } } },
    { $facet: {
        summary: [{ $project: { amount_cents: 1 } }],
        page: [{ $sort: { amount_cents: -1, _id: 1 } }, { $skip: 0 }, { $limit: 20 }],
    } },
  ]).explain("executionStats")'
```

Look for `IXSCAN … indexName: "search_text"` and `docsExamined` in the tens of
thousands rather than ~998k.

## Root page load

### Symptom

The root page made six API calls and shipped one ~1.1 MB JS bundle. Two of the
calls were duplicates: `DiscoveryProvider` and `HomePage` each fetched
`/api/functions` and `/api/data-sources` under different `useApi` keys. Every
route was imported eagerly in `App.tsx`, so `recharts` (used only by the
function/region chart views) was in the initial bundle.

### Fix

1. **One request per root resource.** `HomePage` now reads the functions and
   data-sources state from `useDiscovery()` instead of calling `useApi` again.
   Root calls are `coverage`, `functions`, `regions`, `data-sources` — four, not
   six.
2. **Bounded coverage cache with ETag.** `GET /api/meta/coverage` caches the
   serialised payload for 30s and serves
   `Cache-Control: public, max-age=30, stale-while-revalidate=30` plus an ETag;
   `If-None-Match` returns `304`. The cache key includes the newest ingestion-log
   `_id`, so a completed ingestion (which always writes a log) invalidates it
   immediately instead of waiting for the TTL. `invalidateCoverageCache()` is
   exported for tests/in-process callers. The payload itself is unchanged.
3. **Route-level splitting.** `App.tsx` keeps the shell, providers and `HomePage`
   eager and wraps every other route in `React.lazy` + `Suspense` with a visible
   loading state. `vite.config.ts` adds vendor `manualChunks` (`react`, `mui`,
   and a separate `charts` chunk for `recharts`).

### Measured result

API (`/api/meta/coverage`, same database, direct calls):

|                      | Before (no cache) | After (cold / warm)                       |
| -------------------- | ----------------- | ----------------------------------------- |
| `/api/meta/coverage` | ~430–550 ms       | **496 ms cold, ~7 ms warm (median of 5)** |

Client production build (`npm run build -w client`):

|                       | Before                                | After                                                      |
| --------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Initial JS            | 1,114.36 kB (333.36 kB gzip), 1 chunk | **604.17 kB (190.90 kB gzip)** — `index` + `react` + `mui` |
| `charts` (`recharts`) | in the initial bundle                 | **390.23 kB (112.76 kB gzip), separate lazy chunk**        |
| Route chunks          | none                                  | per-route chunks (Search 25.1 kB, Data sources 18.9 kB, …) |

The initial JS is ~46% smaller uncompressed (~43% gzip) and the root page no
longer downloads recharts. Duplicate `/api/functions` and `/api/data-sources`
requests are gone: only `DiscoveryProvider` calls those two endpoints; `HomePage`
exposes its cached state through `useDiscovery()`. The spending search path and
`/api/spending` indexes were not touched, so search latency is unchanged.

### How to check

```bash
# cold then warm coverage, headers and 304
curl -s -D - -o /dev/null 'http://127.0.0.1:3001/api/meta/coverage'
curl -s -D - -o /dev/null -H 'If-None-Match: <etag>' 'http://127.0.0.1:3001/api/meta/coverage'

# bundle split: look for separate charts-*.js and no recharts in index-*.js
npm run build -w client
ls client/dist/assets

# one request per root endpoint (only DiscoveryProvider calls these)
grep -rn "/api/functions'\\|/api/data-sources'" client/src
```
