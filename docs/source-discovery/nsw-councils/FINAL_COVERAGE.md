# NSW general purpose councils — final GPFS coverage reconciliation

**As at:** 2026-11-20. **Scope:** research and reporting only. No ingestion, no connector or
registry change, no database write, no OCR, no search-engine mirror, and no council or
cross-council spending total.

**Evidence base.** Live shared dev database (`ausspend_dev`): **999,801** real measures and
**205** SOC measures; **193** `data_sources` records. Connector registry via
`npm run check:doc-counts` (2026-11-20): `nsw-gpfs=127`, `nsw-local=128`, `registered=189`,
`active=187`, `stub=2`. Per-council source notes under `docs/source-discovery/nsw-councils/`.

---

## 1. Bottom line

The 128-council arithmetic closes, but the brief's gap set is wrong: there are **three**
registered 0-row councils and **one** council with no source, not four registered 0-row councils.

| Basis | Has rows | Registered, 0 rows | No source | Total |
| --- | --: | --: | --: | --: |
| Connector registry (code) | 124 | 3 — Albury, Berrigan, Muswellbrook | 1 — Snowy Valleys | **128** |
| Live DB `data_sources` | 124 | 2 — Albury, Berrigan | 2 — Muswellbrook, Snowy Valleys | **128** |

- The live DB has **126** GPFS `data_sources` rows: **124 active** with **2,283 non-additive GPFS
  measure rows** and **2 degraded** with 0 rows (Albury, Berrigan).
- `muswellbrook-gpfs` is in the 127-entry code registry (and `scripts/audit.mjs`) but has **no**
  `data_sources` row, **no** `ingestion_logs` entry and **0** measures in the shared dev DB. It was
  never ingested here.
- `snowy-valleys-gpfs` has no connector and no source record.
- `dubbo-council-gpfs` shows `records_ingested: 17` but **142 actual rows** because that source
  carries eight audited years (FY2018-19..FY2025-26). `records_ingested` is the last-run count, not
  the total; the measure collection is authoritative for row counts.

No statement-line rows are summed across councils, years or sources in this report.

---

## 2. Premise falsifier

The brief states "4 registered sources have 0 rows" and names "Albury, Berrigan, Snowy Valleys,
Muswellbrook". The live registry and DB falsify that set:

1. **Snowy Valleys is not registered.** There is no `snowy-valleys-gpfs` connector and no
   `data_sources` row; the council is the single **no-source** council.
2. **Muswellbrook is registered in code only.** Its connector exists and the docs' §7.116 record is
   accurate, but the shared dev DB has no `data_sources` row and no ingestion log, so by the live DB
   it is also a no-source council. It is not a 0-row source in the DB.
3. The correct registry split is **124 + 3 + 1 = 128**; the correct live-DB split is
   **124 + 2 + 2 = 128**. Both close; the brief's "4 registered 0-row" does not.
4. The brief's "127 registered, 124 active, 3 degraded" is correct **for the code registry**. It is
   wrong if read as live `data_sources` counts (126 / 124 / 2).

No other council is missing from the 128 list or unaccounted for.

---

## 3. Exact 128-council status

`Registry status` is the 127-source connector registry. `Live DB` is the actual `data_sources`
collection and measure count. Order follows the OLG grouping in `docs/NSW_COUNCILS.md` §1.

| # | Council | OLG group | Source id | DB rows | Registry status | Live DB `data_sources` |
| --: | --- | --: | --- | --: | --- | --- |
| 1 | Sydney | 1 | `city-of-sydney-gpfs` | 18 | has rows | active |
| 2 | Burwood | 2 | `burwood-gpfs` | 18 | has rows | active |
| 3 | Hunters Hill | 2 | `hunters-hill-gpfs` | 21 | has rows | active |
| 4 | Lane Cove | 2 | `lane-cove-gpfs` | 17 | has rows | active |
| 5 | Mosman | 2 | `mosman-gpfs` | 18 | has rows | active |
| 6 | Strathfield | 2 | `strathfield-gpfs` | 17 | has rows | active |
| 7 | Woollahra | 2 | `woollahra-gpfs` | 29 | has rows | active |
| 8 | Bayside | 3 | `bayside-gpfs` | 18 | has rows | active |
| 9 | Blacktown | 3 | `blacktown-gpfs` | 33 | has rows | active |
| 10 | Canada Bay | 3 | `canada-bay-gpfs` | 17 | has rows | active |
| 11 | Canterbury-Bankstown | 3 | `canterbury-bankstown-gpfs` | 17 | has rows | active |
| 12 | Cumberland | 3 | `cumberland-gpfs` | 17 | has rows | active |
| 13 | Fairfield | 3 | `fairfield-gpfs` | 17 | has rows | active |
| 14 | Georges River | 3 | `georges-river-gpfs` | 16 | has rows | active |
| 15 | Inner West | 3 | `inner-west-gpfs` | 18 | has rows | active |
| 16 | Ku-ring-gai | 3 | `ku-ring-gai-gpfs` | 17 | has rows | active |
| 17 | Liverpool | 3 | `liverpool-gpfs` | 17 | has rows | active |
| 18 | North Sydney | 3 | `north-sydney-gpfs` | 18 | has rows | active |
| 19 | Northern Beaches | 3 | `northern-beaches-gpfs` | 18 | has rows | active |
| 20 | Parramatta | 3 | `parramatta-gpfs` | 17 | has rows | active |
| 21 | Randwick | 3 | `randwick-gpfs` | 17 | has rows | active |
| 22 | Ryde | 3 | `ryde-gpfs` | 17 | has rows | active |
| 23 | Sutherland | 3 | `sutherland-shire-gpfs` | 17 | has rows | active |
| 24 | Waverley | 3 | `waverley-gpfs` | 17 | has rows | active |
| 25 | Willoughby | 3 | `willoughby-gpfs` | 18 | has rows | active |
| 26 | Albury | 4 | `albury-gpfs` | 0 | registered 0-row | degraded (0 rows) |
| 27 | Armidale Regional | 4 | `armidale-gpfs` | 17 | has rows | active |
| 28 | Ballina | 4 | `ballina-gpfs` | 17 | has rows | active |
| 29 | Bathurst Regional | 4 | `bathurst-gpfs` | 18 | has rows | active |
| 30 | Bega Valley | 4 | `bega-valley-gpfs` | 16 | has rows | active |
| 31 | Broken Hill | 4 | `broken-hill-gpfs` | 17 | has rows | active |
| 32 | Byron | 4 | `byron-gpfs` | 17 | has rows | active |
| 33 | Cessnock | 4 | `cessnock-gpfs` | 17 | has rows | active |
| 34 | Clarence Valley | 4 | `clarence-valley-gpfs` | 17 | has rows | active |
| 35 | Dubbo Regional | 4 | `dubbo-council-gpfs` | 142 | has rows | active |
| 36 | Eurobodalla | 4 | `eurobodalla-gpfs` | 17 | has rows | active |
| 37 | Goulburn Mulwaree | 4 | `goulburn-mulwaree-gpfs` | 17 | has rows | active |
| 38 | Griffith | 4 | `griffith-gpfs` | 17 | has rows | active |
| 39 | Kempsey | 4 | `kempsey-gpfs` | 16 | has rows | active |
| 40 | Kiama | 4 | `kiama-gpfs` | 19 | has rows | active |
| 41 | Lismore | 4 | `lismore-gpfs` | 17 | has rows | active |
| 42 | Lithgow | 4 | `lithgow-gpfs` | 17 | has rows | active |
| 43 | Mid-Western Regional | 4 | `mid-western-regional-gpfs` | 17 | has rows | active |
| 44 | Orange | 4 | `orange-gpfs` | 17 | has rows | active |
| 45 | Queanbeyan-Palerang Regional | 4 | `queanbeyan-palerang-gpfs` | 17 | has rows | active |
| 46 | Richmond Valley | 4 | `richmond-valley-gpfs` | 17 | has rows | active |
| 47 | Singleton | 4 | `singleton-gpfs` | 17 | has rows | active |
| 48 | Snowy Monaro Regional | 4 | `snowy-monaro-gpfs` | 17 | has rows | active |
| 49 | Tamworth Regional | 4 | `tamworth-gpfs` | 17 | has rows | active |
| 50 | Wagga Wagga | 4 | `wagga-wagga-gpfs` | 17 | has rows | active |
| 51 | Wingecarribee | 4 | `wingecarribee-gpfs` | 17 | has rows | active |
| 52 | Coffs Harbour | 5 | `coffs-harbour-gpfs` | 17 | has rows | active |
| 53 | Lake Macquarie | 5 | `lake-macquarie-gpfs` | 17 | has rows | active |
| 54 | Maitland | 5 | `maitland-gpfs` | 7 | has rows | active |
| 55 | Mid-Coast | 5 | `mid-coast-gpfs` | 17 | has rows | active |
| 56 | Newcastle | 5 | `newcastle-gpfs` | 17 | has rows | active |
| 57 | Port Macquarie-Hastings | 5 | `port-macquarie-hastings-gpfs` | 17 | has rows | active |
| 58 | Port Stephens | 5 | `port-stephens-gpfs` | 17 | has rows | active |
| 59 | Shellharbour | 5 | `shellharbour-gpfs` | 17 | has rows | active |
| 60 | Shoalhaven | 5 | `shoalhaven-gpfs` | 17 | has rows | active |
| 61 | Tweed | 5 | `tweed-shire-gpfs` | 17 | has rows | active |
| 62 | Wollongong | 5 | `wollongong-gpfs` | 17 | has rows | active |
| 63 | Hawkesbury | 6 | `hawkesbury-gpfs` | 19 | has rows | active |
| 64 | Wollondilly | 6 | `wollondilly-gpfs` | 18 | has rows | active |
| 65 | Blue Mountains | 7 | `blue-mountains-gpfs` | 23 | has rows | active |
| 66 | Camden | 7 | `camden-gpfs` | 23 | has rows | active |
| 67 | Campbelltown | 7 | `campbelltown-gpfs` | 22 | has rows | active |
| 68 | Central Coast | 7 | `central-coast-gpfs` | 17 | has rows | active |
| 69 | Hornsby | 7 | `hornsby-gpfs` | 22 | has rows | active |
| 70 | Penrith | 7 | `penrith-gpfs` | 17 | has rows | active |
| 71 | The Hills | 7 | `the-hills-gpfs` | 17 | has rows | active |
| 72 | Brewarrina | 8 | `brewarrina-gpfs` | 16 | has rows | active |
| 73 | Balranald | 9 | `balranald-gpfs` | 18 | has rows | active |
| 74 | Bogan | 9 | `bogan-gpfs` | 17 | has rows | active |
| 75 | Bourke | 9 | `bourke-gpfs` | 17 | has rows | active |
| 76 | Carrathool | 9 | `carrathool-gpfs` | 16 | has rows | active |
| 77 | Central Darling | 9 | `central-darling-gpfs` | 17 | has rows | active |
| 78 | Coolamon | 9 | `coolamon-gpfs` | 17 | has rows | active |
| 79 | Coonamble | 9 | `coonamble-gpfs` | 17 | has rows | active |
| 80 | Gilgandra | 9 | `gilgandra-gpfs` | 16 | has rows | active |
| 81 | Hay | 9 | `hay-gpfs` | 17 | has rows | active |
| 82 | Lockhart | 9 | `lockhart-gpfs` | 17 | has rows | active |
| 83 | Murrumbidgee | 9 | `murrumbidgee-gpfs` | 17 | has rows | active |
| 84 | Walcha | 9 | `walcha-gpfs` | 17 | has rows | active |
| 85 | Warren | 9 | `warren-gpfs` | 17 | has rows | active |
| 86 | Weddin | 9 | `weddin-gpfs` | 17 | has rows | active |
| 87 | Berrigan | 10 | `berrigan-gpfs` | 0 | registered 0-row | degraded (0 rows) |
| 88 | Bland | 10 | `bland-gpfs` | 17 | has rows | active |
| 89 | Blayney | 10 | `blayney-gpfs` | 17 | has rows | active |
| 90 | Cobar | 10 | `cobar-gpfs` | 16 | has rows | active |
| 91 | Dungog | 10 | `dungog-gpfs` | 17 | has rows | active |
| 92 | Edward River | 10 | `edward-river-gpfs` | 15 | has rows | active |
| 93 | Forbes | 10 | `forbes-gpfs` | 17 | has rows | active |
| 94 | Glen Innes Severn | 10 | `glen-innes-severn-gpfs` | 17 | has rows | active |
| 95 | Gwydir | 10 | `gwydir-gpfs` | 17 | has rows | active |
| 96 | Junee | 10 | `junee-gpfs` | 17 | has rows | active |
| 97 | Kyogle | 10 | `kyogle-gpfs` | 16 | has rows | active |
| 98 | Lachlan | 10 | `lachlan-gpfs` | 17 | has rows | active |
| 99 | Liverpool Plains | 10 | `liverpool-plains-gpfs` | 17 | has rows | active |
| 100 | Narrandera | 10 | `narrandera-gpfs` | 17 | has rows | active |
| 101 | Narromine | 10 | `narromine-gpfs` | 17 | has rows | active |
| 102 | Oberon | 10 | `oberon-gpfs` | 17 | has rows | active |
| 103 | Temora | 10 | `temora-gpfs` | 17 | has rows | active |
| 104 | Tenterfield | 10 | `tenterfield-gpfs` | 17 | has rows | active |
| 105 | Upper Lachlan | 10 | `upper-lachlan-gpfs` | 16 | has rows | active |
| 106 | Uralla | 10 | `uralla-gpfs` | 16 | has rows | active |
| 107 | Walgett | 10 | `walgett-gpfs` | 19 | has rows | active |
| 108 | Warrumbungle | 10 | `warrumbungle-gpfs` | 17 | has rows | active |
| 109 | Wentworth | 10 | `wentworth-gpfs` | 18 | has rows | active |
| 110 | Bellingen | 11 | `bellingen-gpfs` | 17 | has rows | active |
| 111 | Cabonne | 11 | `cabonne-gpfs` | 17 | has rows | active |
| 112 | Cootamundra-Gundagai Regional | 11 | `cootamundra-gundagai-gpfs` | 17 | has rows | active |
| 113 | Cowra | 11 | `cowra-gpfs` | 17 | has rows | active |
| 114 | Federation | 11 | `federation-gpfs` | 17 | has rows | active |
| 115 | Greater Hume | 11 | `greater-hume-gpfs` | 18 | has rows | active |
| 116 | Gunnedah | 11 | `gunnedah-gpfs` | 17 | has rows | active |
| 117 | Hilltops | 11 | `hilltops-gpfs` | 17 | has rows | active |
| 118 | Inverell | 11 | `inverell-gpfs` | 17 | has rows | active |
| 119 | Leeton | 11 | `leeton-gpfs` | 17 | has rows | active |
| 120 | Moree Plains | 11 | `moree-plains-gpfs` | 16 | has rows | active |
| 121 | Murray River | 11 | `murray-river-gpfs` | 17 | has rows | active |
| 122 | Muswellbrook | 11 | `muswellbrook-gpfs` | 0 | registered 0-row | **absent** (never ingested) |
| 123 | Nambucca Valley | 11 | `nambucca-valley-gpfs` | 17 | has rows | active |
| 124 | Narrabri | 11 | `narrabri-gpfs` | 17 | has rows | active |
| 125 | Parkes | 11 | `parkes-gpfs` | 17 | has rows | active |
| 126 | Snowy Valleys | 11 | `snowy-valleys-gpfs` | 0 | no source | absent |
| 127 | Upper Hunter | 11 | `upper-hunter-gpfs` | 17 | has rows | active |
| 128 | Yass Valley | 11 | `yass-valley-gpfs` | 17 | has rows | active |

---

## 4. Exact 0-row / no-source gaps

All four official pages/documents below were re-checked on **2026-11-20** with `curl/8.5.0`; all
returned HTTP 200. Reachability is not the blocker — machine-readable audited statements are.

### 4.1 Albury — `albury-gpfs` — registered, degraded, 0 rows

- **Documented reason.** The FY2024-25 annual report is annual-report-only for this item. It has a
  narrative Financial Snapshot on page 32, and page 94 says the audited statements can be viewed on
  the council website, but it does **not** contain the audited GPFS Income Statement, Statement of
  Comprehensive Income or B1-1 section. Exact gap: "audited GPFS section not found in the FY2024-25
  annual report ... no standalone GPFS was substituted; no rows ingested."
- **Official latest reachable?** Yes. Annual Reports page 200; the 18,452,240-byte FY2024-25 annual
  report returns 200 as `application/octet-stream` but is a real PDF. No FY2025-26 annual report was
  published at the check.
- **Ingestible now?** No. The latest official document is the same one already rejected; it has no
  GPFS statement lines. Evidence: `albury-gpfs.md` §4.

### 4.2 Berrigan — `berrigan-gpfs` — registered, degraded, 0 rows

- **Documented reason.** The standalone audited FY2025-26 statements are text-native and the face
  statement reconciles internally, but the printed B1-1 "Total functions and activities" row is
  $1 thousand away from the face statement: B1-1 expenses 32,741 vs face 32,742; B1-1 operating
  result 1,314 vs face net result 1,313. Under the zero-tolerance rule the connector emits nothing.
- **Official latest reachable?** Yes. Financial Statements page 200; the 1,594,806-byte
  `annual_financial_statements-2026-final.pdf` returns 200 as `application/pdf`. FY2025-26 is the
  latest audited standalone year.
- **Ingestible now?** No under the current zero-tolerance rule. It is not a missing document; it is
  an unresolved printed $1k bridge. Evidence: `berrigan-gpfs.md` §4.

### 4.3 Muswellbrook — `muswellbrook-gpfs` — registered in code, absent from live DB

- **Documented reason.** The 196-page FY2024-25 annual report embeds the audited GPFS section at
  pages 79-171, but that section has **no text layer**: pages contain only running headers/footers
  and vector-drawn statement content. No standalone FY2024-25 GPFS PDF was found. OCR is prohibited,
  so no printed line, subtotal or unit can be read.
- **Official latest reachable?** Yes. Strategic Reporting page 200; the 35,369,135-byte FY2024-25
  annual report returns 200 as `application/pdf`. No FY2025-26 annual report was published.
- **Ingestible now?** No without OCR or a new text-native standalone GPFS.
- **DB note.** The connector exists, but its targeted run is **not** in the shared dev DB: no
  `data_sources` row, no `ingestion_logs` entry, 0 measures. Registering it would add a degraded
  0-row source, not data. Evidence: `muswellbrook-gpfs.md`, `docs/NSW_COUNCILS.md` §7.116.

### 4.4 Snowy Valleys — no source

- **Documented reason.** The FY2024-25 signed audited financial statements are a 99-page
  **scanned image-only** PDF with no text layer (0 fonts, 0 extracted characters); the FY2025-26
  audited standalone FS was not published (only a six-monthly progress report). No connector is
  registered. OCR is prohibited.
- **Official latest reachable?** Yes. Integrated Reporting page 200; the 42,979,731-byte FY2024-25
  signed audited financial statements return 200 as `application/pdf`.
- **Ingestible now?** No without OCR or a future text-native audited FS. Evidence:
  `snowy-valleys-gpfs.md`, `group-d/inventory.csv`, `group-d/README.md`.

---

## 5. Stale counts and mismatches

| Location | Stated | Actual on 2026-11-20 | Disposition |
| --- | --- | --- | --- |
| Work-item brief | 4 registered 0-row sources (incl. Snowy Valleys and Muswellbrook) | 3 registered 0-row (Albury, Berrigan, Muswellbrook) + 1 no source (Snowy Valleys) | Corrected here; brief premise is false |
| Work-item brief | 127 registered / 124 active / 3 degraded | Registry: 127 / 124 / 3. Live DB: 126 / 124 / 2 | Registry vs DB distinction must be stated |
| `docs/NSW_COUNCILS.md` §3 | 2,023 rows; 112 GPFS ids; 109 active; 3 degraded/deferred | 2,283 rows; registry 127 (124 with rows, 3 zero-row); live DB 126 (124 active, 2 degraded) | Updated in §3 only |
| `docs/NSW_COUNCILS.md` generated §0 block | 127 GPFS sources / 128 local-government source ids | Matches the code registry; does not describe the live DB (126 GPFS `data_sources`) | Leave generated block; clarified in §3 |
| `docs/NSW_COUNCILS.md` §11 | "ninety-seven council GPFS sources"; "Forty-five council GPFS sources have landed" | Historical landing narrative, not current coverage | Historical; not rewritten |
| `docs/NSW_COUNCILS.md` §7.116 + §11 | `muswellbrook-gpfs` registered, degraded, 0 rows | True in code registry; no live DB source or ingestion log | Registry/DB sync gap, not a data error |
| `GET /api/meta/coverage` | `generated_at` 2026-11-19; 45 GPFS connectors; old `not_covered` list | Stale cache relative to the 127-source registry and 126 DB sources | Out of this item's areas; do not treat as authority |

The generated §0 block is driven by `npm run generate:sources` and is correct for the **registry**
(127). The live DB is one source behind it because `muswellbrook-gpfs` has never been ingested into
the shared dev DB.

---

## 6. Genuine remaining ingestion opportunities

There is **no council in this set that can be ingested today without changing a rule or obtaining a
new document**. The realistic opportunities are:

1. **Muswellbrook (registry/DB sync, not data):** run the existing `muswellbrook-gpfs` connector
   against the shared DB to create the documented degraded 0-row `data_sources` record. This adds no
   measure rows and is outside this report's no-ingestion scope.
2. **Berrigan (policy decision):** the FY2025-26 statements are machine-readable; only the printed
   $1k B1-1/face bridge blocks ingestion. If that gap is formally accepted as a documented bridge,
   the source could be landed. That is a product/accounting decision, not a reason to force or
   fudge the figures in this report.
3. **Albury:** watch for a standalone audited GPFS PDF or a later annual report that actually
   includes the audited statements. The current FY2024-25 annual report does not.
4. **Muswellbrook:** watch for a standalone text-native GPFS; the embedded FY2024-25 section is
   vector-only and OCR is prohibited.
5. **Snowy Valleys:** watch for a text-native FY2025-26 or later audited FS; the FY2024-25 signed
   statements are scanned image-only and OCR is prohibited.

No new council-wide source, no consolidated GPFS dataset and no alternative official all-128
statement-line file was found. Do not use mirrors or OCR to close these gaps.

---

## 7. How to check this

```bash
# Registry/doc-count guard (run from the repo/worktree):
npm run check:doc-counts
# -> [check-doc-counts] OK registry=189 active=187 stub=2 nsw-gpfs=127 nsw-local=128 trade=2 docs=129

# Leak guard:
npm run check:env-leaks
# -> [check-env-leaks] PASS (1548 tracked text files)

# Live DB: 126 GPFS sources, 124 active, 2 zero-row (requires MONGO_URL):
mongosh "$MONGO_URL" --quiet --eval '
  const ds = db.data_sources.find({source_id: /-gpfs$/}, {source_id:1,status:1,records_ingested:1}).toArray();
  printjson({gpfsSources: ds.length, active: ds.filter(d => d.status === "active").length,
             zeroRow: ds.filter(d => d.records_ingested === 0).map(d => d.source_id)});
  printjson(db.measures.aggregate([
    {$match: {source_id: /-gpfs$/}}, {$group: {_id: null, rows: {$sum: 1}}}
  ]).toArray());
'
# Expected: gpfsSources 126, active 124, zeroRow ["berrigan-gpfs","albury-gpfs"], rows 2283

# Official gap documents still reachable (all 200 on 2026-11-20):
curl -sL -o /dev/null -m 45 -w '%{http_code} %{content_type} %{size_download}\n' -A 'curl/8.5.0' \
  'https://www.alburycity.nsw.gov.au/council/publications-and-updates/reports/annual-reports'
curl -sL -o /dev/null -m 45 -w '%{http_code} %{content_type} %{size_download}\n' -A 'curl/8.5.0' \
  'https://www.berriganshire.nsw.gov.au/files/assets/public/v/1/01-council/gov.-amp-transparency/annual_financial_statements-2026-final.pdf'
curl -sL -o /dev/null -m 60 -w '%{http_code} %{content_type} %{size_download}\n' -A 'curl/8.5.0' \
  'https://www.muswellbrook.nsw.gov.au/wp-content/uploads/2025/12/2024-2025-Annual-Report-FINAL-Ready-for-Endorsement-1.pdf'
curl -sL -o /dev/null -m 60 -w '%{http_code} %{content_type} %{size_download}\n' -A 'curl/8.5.0' \
  'https://www.snowyvalleys.nsw.gov.au/files/assets/public/v/1/reports-amp-strategies/202425-ipampr/2024-2025-signed-audited-financial-statements.pdf'
```
