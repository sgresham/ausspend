# Data, secrets and repository policy

This repository publishes the **platform**, not the data it has collected.

## What belongs in git

- Application code, shared schemas, connector definitions and configuration.
- Documentation, including source URLs, SHA-256 hashes and citation metadata.
- Small, hand-written test fixtures that exercise a parser. These are short excerpts of public
  documents, not datasets, and must stay small.

## What must never be committed

- Source documents: PDFs, XLSX/XLS, CSV/TSV downloads, ZIP/TAR archives.
- Database dumps or backups: `.db`, `.sqlite`, `.bson`, `mongodump` output, JSON/NDJSON exports.
- Extracted datasets or caches of fetched records.
- Secrets: API keys, tokens, private keys, certificates with keys, `.env` files, cloud credentials.
- Runtime scratch: pid files, audit logs, local server output (`.tmp-*`).

`.gitignore` blocks the common extensions and paths as a second line of defence. Ignoring is not
enough on its own: a file added with `git add -f` or before the rule existed still lives in
history. Run the checks below before publishing.

## Where fetched data lives

Connectors fetch their sources at run time. Downloaded documents are written to a source archive
**outside the checkout**:

- default: `~/ausspend-source-archive`
- override: `AUSSPEND_SOURCE_ARCHIVE=/path/to/archive`

The archive is not in git. The application database is an external MongoDB named by `MONGO_URL`;
it is not in the repository, and backups belong outside it too.

## Reproducing the data in a fork

A fork can obtain the same public data by running the documented ingestion commands (for example
`npm run ingest:phase6`, `npm run ingest:federal`, or a single source through its connector). The
connectors discover the current official document from the publisher's page, archive the exact
bytes with a SHA-256 record, and apply unit and reconciliation guards. No data needs to be copied
from this repository for a fork to work.

## Secrets

Secrets are read from the environment or from untracked files. `.env.example` contains placeholders
only. If a real credential is ever committed, rotate it first, then remove it from history; deleting
the working-tree copy is not sufficient.

## Source-document licensing

Downloaded government and council documents remain the property of their publishers and are not
licensed by this repository. Each connector records the publisher's terms. The code's own licence
is whatever the repository owner adds; without a `LICENSE` file, no licence is granted for the code
either.

## Pre-publish checks

```sh
# 1. No data files are tracked
git ls-files | grep -Ei '\.(pdf|xlsx|xls|csv|tsv|zip|gz|tar|db|sqlite|bson|parquet)$'

# 2. No secret-shaped strings in tracked files
git grep -nEI 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|mongodb(\+srv)?://[^ ]*:[^ ]*@'

# 3. No data files or secrets anywhere in history (not just the working tree)
git log --all --diff-filter=A --name-only --pretty=format: \
  | grep -Ei '\.(pdf|xlsx|xls|csv|tsv|zip|gz|tar|db|sqlite|bson|parquet)$'
```

For a thorough history scan, walk every blob and match the same patterns plus any known token
value. A clean working tree does not prove a clean history.
