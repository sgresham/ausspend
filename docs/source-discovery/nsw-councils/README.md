# NSW councils inventory — unified batch index

Research pass 2026-11-19. Scope: official council annual-report / GPFS PDF discovery only.
This directory holds the four discovery batches (A–D) as one uniform inventory schema so a
single validator/ingest plan can consume them. No code, database, or registry changes; no PDFs
committed.

Companion per-batch notes live in `group-{a,b,c,d}/README.md`; the data is
`group-{a,b,c,d}/inventory.csv`.

## Unified schema (canonical 14 columns)

Every batch file shares exactly this header, in this order (adopted from Batch A/B):

```text
council,olg_group,official_reporting_page_url,annual_report_url,gpfs_pdf_url,fiscal_year,http_status,content_type,bytes,page_count,access_notes,unit,ingest_ready,reason
```

| Column | Meaning |
| --- | --- |
| `council` | Council name (one row per council) |
| `olg_group` | OLG grouping / batch class |
| `official_reporting_page_url` | Official page listing reports/statements |
| `annual_report_url` | Annual report PDF/page URL |
| `gpfs_pdf_url` | Audited GPFS / financial statements PDF URL |
| `fiscal_year` | Fiscal year the document covers |
| `http_status` | Observed HTTP status |
| `content_type` | Observed content type |
| `bytes` | Observed content length |
| `page_count` | PDF page count (`n/a` when not inspected) |
| `access_notes` | Fetch/bot-wall notes |
| `unit` | Reporting unit (for example `Council`) |
| `ingest_ready` | `yes` / `no` |
| `reason` | Why the row is or is not ingest-ready |

Batch C and D previously used different names for the last two columns; they were renamed to
the canonical header without touching any cell:

- C: `reporting_page_url` → `official_reporting_page_url`, `gpfs_url` → `gpfs_pdf_url`
- D: `reporting_page_url` → `official_reporting_page_url`,
  `gpfs_financial_statements_pdf_url` → `gpfs_pdf_url`

No rows or `ingest_ready` values changed in any batch.

## Batches

| File | Rows | `ingest_ready=yes` |
| --- | ---: | ---: |
| `group-a/inventory.csv` | 27 | 16 |
| `group-b/inventory.csv` | 15 | 12 |
| `group-c/inventory.csv` | 23 | 21 |
| `group-d/inventory.csv` | 19 | 15 |
| **Total** | **84** | **64** |

## Uniformity check

Run from the repository root. This is the one-command check: it asserts all four headers are
identical and equal to the canonical 14 columns, asserts the per-batch row/ready invariants
(27/16, 15/12, 23/21, 19/15), and prints the total.

```bash
python3 - <<'PY'
import csv
from pathlib import Path

CANONICAL = (
    "council", "olg_group", "official_reporting_page_url", "annual_report_url",
    "gpfs_pdf_url", "fiscal_year", "http_status", "content_type", "bytes",
    "page_count", "access_notes", "unit", "ingest_ready", "reason",
)
EXPECTED = {
    "group-a": (27, 16),
    "group-b": (15, 12),
    "group-c": (23, 21),
    "group-d": (19, 15),
}
base = Path("docs/source-discovery/nsw-councils")
headers = set()
total_rows = total_ready = 0

for batch, (exp_rows, exp_ready) in EXPECTED.items():
    with (base / batch / "inventory.csv").open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        header = tuple(reader.fieldnames or ())
        rows = list(reader)
    headers.add(header)
    ready = sum(1 for row in rows if row["ingest_ready"] == "yes")
    total_rows += len(rows)
    total_ready += ready
    print(f"{batch} header={header}")
    print(f"{batch} rows={len(rows)} ready={ready}")
    assert header == CANONICAL, f"{batch} header drift: {header}"
    assert (len(rows), ready) == (exp_rows, exp_ready), (
        f"{batch} counts {(len(rows), ready)} != {(exp_rows, exp_ready)}"
    )

assert len(headers) == 1, f"headers differ across batches: {headers}"
assert (total_rows, total_ready) == (84, 64), (total_rows, total_ready)
print(f"headers_identical={len(headers) == 1}")
print(f"total rows={total_rows} ready={total_ready}")
print("OK: schema uniform, counts 27/16 15/12 23/21 19/15")
PY
```

## Notes

- The CSVs are force-added because the repository `.gitignore` ignores `*.csv`. Any change to
  them must be committed with `git add -f`.
- Discovery only: URLs and observed status/size values are as recorded per batch; no ingestion
  or downloads are performed here.
