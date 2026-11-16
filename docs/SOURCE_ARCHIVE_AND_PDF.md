# Source archive and PDF ingestion foundation

This document describes the reusable, source-agnostic foundation added after S1 (NSW Budget).
It is deliberately **not** a new data connector: it archives documents outside the repository,
records their SHA-256 provenance, and extracts text/tables from PDFs with explicit unit and
total validation. S3 (Dubbo council documents) and later BP3 PDFs are expected to consume it.

Nothing here starts CKAN (`data.nsw.gov.au`), Dubbo, VIC/QLD/WA, SOC/charity, or any live
state/federal ingestion. No PDF row is ingested yet, and no PDF row is ever marked `verified`.

## 1. Why an archive

Government pages move, redirect and expire. If a figure came from an XLSX or a PDF, a reviewer
must be able to re-open the _exact bytes_ months later. The rule is:

- a source with no stable direct link **must** be copied locally and linked by SHA-256;
- a source with a stable link still records the exact URL and hash;
- the bytes live **outside** the application repository (default
  `/home/steve/ausspend-source-archive`, override with `AUSSPEND_SOURCE_ARCHIVE`);
- only metadata is committed or written to Mongo — never the blob.

The repository guard `assertOutsideRepo()` refuses any archive path inside the repo
(`/opt/ausspend` in production, or the pool worktree during development).

## 2. `source_documents` model

`server/src/models/source-document.ts` (`SourceDocumentModel`, collection `source_documents`):

| Field            | Meaning                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `document_id`    | Stable id, default `"<source_id>:<sha256 first 24>"`; unique        |
| `source_id`      | Owning source, e.g. `nsw-budget`                                    |
| `title`          | Human description                                                   |
| `original_url`   | Canonical publisher URL (what a citation points at)                 |
| `retrieved_from` | Exact URL that produced the bytes (Wayback snapshot / ArcGIS query) |
| `archived_from`  | `wayback` \| `arcgis` \| `direct` \| `other`                        |
| `local_path`     | Absolute host path; must be outside the repo                        |
| `sha256`         | 64-char lowercase hash of the exact bytes                           |
| `bytes`          | Byte length                                                         |
| `content_type`   | MIME type                                                           |
| `fetched_at`     | When the copy was made                                              |
| `last_modified`  | `Last-Modified`/`x-archive-orig-last-modified` when present         |
| `etag`           | `ETag`/`x-archive-orig-etag` when present                           |
| `hash_verified`  | Re-hashed after archiving                                           |
| `notes`          | Free-text provenance/limitations                                    |

A unique `(source_id, sha256)` index makes accidental duplicate records impossible while still
allowing a source to have several archived versions over time.

## 3. Archive utility and CLI

`server/src/connectors/source-archive.ts` exposes:

- `archiveSourceDocument()` — download, adopt an existing local copy (`from_path`, never copied
  or mutated), or store supplied bytes (`data`); computes SHA-256/bytes and writes a JSON record;
- `verifySourceDocument()` — re-hashes and compares against the record;
- `readArchivedDocument()` — verifies before returning bytes;
- `listArchivedRecords()` — metadata listing without a database;
- `persistArchivedRecord()` — upsert into `source_documents` (never touches `measures`).

```bash
# list archived records (metadata only, no DB needed)
npm run archive -- list --source-id=nsw-budget

# re-hash every archived copy and report mismatches
npm run archive -- verify --source-id=nsw-budget

# adopt S1's existing Wayback XLSX + ArcGIS JSON by reference (see §4)
npm run archive -- adopt-nsw

# optionally upsert the metadata into ausspend_dev
MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev \
  npm run archive -- adopt-nsw --write-db

# archive a new document (bytes go outside the repo)
npm run archive -- fetch --source-id=dubbo \
  --title="Dubbo Annual Report 2024-25" --url=https://example.gov.au/report.pdf \
  --archived-from=direct --filename=report.pdf
```

The archive root also stores a metadata sidecar (`<file>.meta.json`) and
`<root>/<source_id>/records/<document_id>.json`, so a copy can be verified without Mongo.

### Read-only API

```http
GET /api/source-documents
GET /api/source-documents?source_id=nsw-budget
GET /api/v1/source-documents?source_id=nsw-budget&limit=200
```

It returns metadata only (`local_path`, `sha256`, URL, timestamps) and never serves bytes.

## 4. S1 (NSW Budget) copies adopted by reference

S1 already downloaded the 12 official 2025-26 XLSX workbooks, the open-data page and the ArcGIS
capital-projects JSON into `~/.cache/ausspend/nsw-budget/2025-26`. `adopt-nsw` reads the committed
manifest `docs/source-archive/nsw-budget-2025-26.json`, re-hashes each existing copy, refuses to
continue on any mismatch, and writes provenance records without copying or mutating S1's files.

Examples verified on this host:

| Document                                   | SHA-256                                                            | Bytes   |
| ------------------------------------------ | ------------------------------------------------------------------ | ------- |
| `open-data-2025-26.html` (Wayback)         | `9a0a79b17088ab9e33ef1968eb506171976d0bf141d88d717f806e3b00b12438` | 23,684  |
| `2025-26-Budget-Financial-Statements.xlsx` | `c3e4fb8e30f554fea06cb8878d9418060de44c6b3a4bc3271047aa6d50661c09` | 178,309 |
| `arcgis-capital-projects.json` (ArcGIS)    | `7229c636fbe1a845a1b2d563b1fb55ed940a14fc255a27a7143ab3f65d935a6b` | 797,716 |

The ArcGIS layer has 974 features. `local_path` for these records is S1's cache path; the files
are **not** duplicated into the new archive root. If the cache is ever cleaned, `verify` fails
loudly and the manifest hash is the authority.

## 5. PDF extraction and validation

`server/src/connectors/pdf-extract.ts` uses the pinned `pdfjs-dist` (exact version in
`server/package.json`) and reconstructs tables from positioned text items.

```bash
npm run pdf:extract -- --file=/path/to/report.pdf            # summary + ingestability
npm run pdf:extract -- --file=/path/to/report.pdf --json     # full pages/tables/rows JSON
npm run pdf:extract -- --url=https://example.gov.au/report.pdf
npm run pdf:extract -- --document-id=nsw-budget:<id>
```

Output:

- `pages[]` — page text and positioned items;
- `tables[]` — header, columns, rows, `unit`, `checks`, `totals_verified`,
  `extraction_confidence`, `valid`, `ingestable`, `warnings`, `errors`;
- every row has `data_quality_flag: "provisional"` and the table's confidence; there is no
  `verified` path in this module.

### Units

`detectMoneyUnit()` recognises explicit `$`, `$'000`/`$000`/`$k`, `$m`/`$ million`, and
`$b`/`$ billion` (including the typographic apostrophe PDF.js emits). It refuses to guess:

- no explicit unit → `ambiguous: true`, table `ingestable: false`;
- conflicting units (e.g. `$'000` and `$m`) → `ambiguous: true`, `ingestable: false`;
- a larger unit also contains `$`; that is not treated as a conflict.

`moneyToCents(value, unit)` uses explicit multipliers (`dollars: 100`, `thousands: 100_000`,
`millions: 100_000_000`, `billions: 100_000_000_000`) and rounds once to integer cents. A
`$'000` figure is therefore exactly 1,000× the same number read as dollars, and the unit is
carried in the output so a silent 1000× error cannot occur.

### Totals

Where the table has a total column and/or total row, the extractor checks, in cents:

- each data row: sum of numeric non-total columns = the row's total cell;
- each numeric column: sum of data rows = the total row's cell;
- the grand total row: sum of its own numeric columns = its total cell.

Any mismatch sets `valid: false`, `ingestable: false`, `extraction_confidence: "low"` and adds a
verbatim `errors` entry. A table with no totals is `ingestable: true` but only `"medium"`
confidence — it can be ingested with a warning, never silently as verified.

## 6. Tests and proof

```bash
npm run test:foundation   # 10 foundation tests, no network
npm run typecheck
npm run lint
npm run format:check
npm run build
```

`scripts/source-archive-pdf.test.ts` covers:

- a generated fixture PDF (no fixture blob committed) with a `$'000` table;
- unit detection, including the missing-unit and conflicting-unit refusals;
- `$'000` vs dollars differing by exactly 1000×;
- row-total mismatch and grand-total mismatch rejection;
- archive write → re-hash → read-back round-trip and tamper detection;
- repo-path refusal;
- read-only verification of S1's real Wayback XLSX and ArcGIS JSON against the manifest.

`npm test` (Vitest) remains green and `measures` stays at **121,050** rows; this item adds no
spending rows and never writes to `measures`.

## 7. Boundaries

This foundation stops before:

- `data.nsw.gov.au` CKAN ingestion;
- Dubbo / any local-government ingestion;
- VIC, QLD or WA sources;
- SOC/charity sources;
- live federal/state PDF ingestion;
- human verification of PDF rows.

S3/Dubbo and later PDF work must call this foundation, keep those rows `provisional`, and run a
human review before anything is marked `verified`.
