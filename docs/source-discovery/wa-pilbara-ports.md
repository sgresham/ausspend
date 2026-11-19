# WA SOC — Pilbara Ports Authority annual-report evidence

**Status:** implementation evidence only. **Entity:** Pilbara Ports Authority only — a Western
Australian Government Trading Enterprise (GTE) under the Government Trading Enterprises Act 2023
(WA) and a port authority under the Port Authorities Act 1999 (WA). **No WA total, no other WA GTE,
no QLD/NSW SOC and no national total.**

**Current outcome: deferred with 0 rows (official-source access gap).** No official current
FY2025-26 PDF is obtainable by a plain fetch: the entity's own annual-report and publications pages
answer with an Incapsula JavaScript challenge shell, the official sitemap lists pages only, and the
WA Parliament tabled-papers route is behind an Azure WAF JavaScript challenge. No unofficial or
search-engine copy and no prior-year report was ingested or presented as current.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

All probes were read-only, with a browser user-agent and `redirect: follow`. No PDF is committed to
the repo.

| Step                            | URL                                                                                              | HTTP        | Bytes                    | Result                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ----------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Entity home page                | <https://www.pilbaraports.com.au/>                                                               | **200**     | 212, later 842           | `text/html`; Incapsula `noindex,nofollow` shell / "Request unsuccessful. Incapsula incident ID". No page content.                          |
| Official publications page      | <https://www.pilbaraports.com.au/about-pilbara-ports/publications>                               | **200**     | 212, later 844           | Same Incapsula challenge shell. No report title or PDF href.                                                                              |
| Official annual-report page     | <https://www.pilbaraports.com.au/about-pilbara-ports/publications/annual-report>                 | **200**     | 212, later 842           | Same Incapsula challenge shell (a full browser-header retry returned a 946-byte incident page). No report title or PDF href.              |
| Brief's assumed pages           | <https://www.pilbaraports.com.au/about-us/publications/> and `…/annual-reports/`                 | **200**     | 212                      | Same Incapsula challenge shell; those paths are not the live slugs (`/about-pilbara-ports/...` is).                                        |
| Official sitemap                | <https://www.pilbaraports.com.au/sitemap.xml>                                                    | **200**     | 76,175                   | `text/xml`; **457** `<loc>` entries, **0** PDF / `getmedia` / `.ashx` document locations — pages only.                                     |
| Official robots                 | <https://www.pilbaraports.com.au/robots.txt>                                                     | **200**     | 651                      | `text/plain`; no annual-report or document location.                                                                                       |
| Official WordPress APIs (wrong) | `/wp-json/wp/v2/media?search=annual%20report` and `/wp-json/wp/v2/search?search=annual%20report`  | **200**     | 947–960                  | Incapsula challenge shell; the site is Kentico/IIS, not WordPress, so these endpoints have no data.                                        |
| WA Parliament site root         | <https://www.parliament.wa.gov.au/>                                                              | **200**     | 45,331                   | `text/html`; Azure WAF JavaScript challenge (`Azure WAF JS Challenge`). No navigation or tabled-papers content.                            |
| WA Parliament tabled papers     | <https://www.parliament.wa.gov.au/publications/tabledpapers.nsf>                                 | **200→404 / 403** | 283 / 225 / 8,034  | First a 283-byte meta-refresh to `/WebCMS/WebCMS.nsf/content/tabled-papers`, which returned **404 — "Entry not found in index"**; later retries returned **403** with the Azure WAF JS challenge. |
| WA Parliament WebCMS            | <https://www.parliament.wa.gov.au/WebCMS/WebCMS.nsf>                                             | **404**     | 267                      | Notes "Entry not found in index"; the migrated tabled-papers content is not reachable by plain HTTP.                                       |
| WA data portal CKAN API         | <https://data.wa.gov.au/api/3/action/package_search?q=pilbara%20ports&rows=5>                    | **500**     | 170                      | nginx 500; no catalogue result.                                                                                                            |
| WA Treasury / wa.gov.au         | <https://www.treasury.wa.gov.au/> and <https://www.wa.gov.au/government/publications>            | **200**     | 107,350 / 63,188         | Reachable, but no Pilbara Ports entity annual-report link or PDF. The Treasury page links only its own DTF reports.                        |

No official direct or tabled FY2025-26 PDF was found. No unofficial/search-engine copy was used.

## 2. Exact document

**There is no parseable official FY2025-26 document to archive.** The only official annual-report
page that exists is:

- **URL:** <https://www.pilbaraports.com.au/about-pilbara-ports/publications/annual-report>
- **Response:** HTTP 200, 212-byte Incapsula shell with
  `<META NAME="robots" CONTENT="noindex,nofollow">` and a `/_Incapsula_Resource` script; the body
  carries no annual-report title, year or PDF link.
- **Archive:** none. No bytes are archived because no document was obtained.

The official sitemap confirms the annual-report page exists but exposes no document:
`https://www.pilbaraports.com.au/sitemap.xml` returned 76,175 bytes with 457 `<loc>` page URLs and
zero PDF/`getmedia` URLs.

## 3. Why this is an access gap, not a unit or reconciliation gap

The adapter never reaches a statement, so there is no printed unit to gate and no face statement to
reconcile. The gap is upstream of parsing:

- The official Pilbara Ports site answers all content pages with an Incapsula JavaScript challenge
  shell. It is not a prior-year problem and not a table-layout problem: the bytes never contain a
  document.
- The official sitemap lists page routes only; it does not list PDFs or media assets. Guessing a
  `getmedia/<GUID>/...pdf` URL is forbidden and is not done.
- The WA Parliament tabled-papers route — the documented official fallback used for NQBP — is
  itself behind an Azure WAF JavaScript challenge, and the legacy Notes database no longer resolves
  its tabled-papers entry. A tabled copy therefore could not be located or fetched by plain HTTP.
- The adapter records a deferred document for the official annual-report page with the exact probes
  and emits **0 rows**. It never substitutes the prior year or an unofficial copy.

## 4. Ingest proof (shared dev DB)

The targeted SOC ingest ran with `SOC_ONLY_SOURCE_IDS=wa-pilbara-ports` against
`MONGO_URL=mongodb://10.10.10.30:27017/ausspend_dev`:

```text
[ingest:soc] target=ausspend_dev sources=wa-pilbara-ports
[ingest:soc] wa-pilbara-ports: partial fetched=0 upserted=0 errors=deferred 2025-26: access: …
[ingest:soc] manifest=docs/source-archive/wa-pilbara-ports-annual-report.json files=0
[ingest:soc] wa-pilbara-ports rows=0 source_documents=0 verified=0 potential_double_count=0 deferred_documents=1
[ingest:soc] done target=ausspend_dev errored=0
```

Captured DB state after the run:

- `measures` for `source_id=wa-pilbara-ports`: **0**.
- `data_sources.records_ingested`: **0**; status `degraded` with the exact Incapsula/access-gap
  reason in `errors`; `last_successful_fetch` set to the probe time.
- `ingestion_logs`: one `partial` log, `records_fetched=0`, `records_upserted=0`, with the exact
  access-gap reason.
- `deferred_soc_documents`: one `deferred` record, fiscal year `2025-26`, entity
  `Pilbara Ports Authority`, document URL the official annual-report page.
- SOC total: **190 before and 190 after** (no rows added).
- Total measures: **998,429 before and 998,429 after**.
- No stale-year row: zero measures for `source_id=wa-pilbara-ports` at fiscal year `2024-25`.
- No WA/state/national aggregate row: no measure with `source_id` matching `wa-total`, `wa-state` or
  `wa-aggregate`.

## 5. Extracted rows if a future report proves the five lines

The five-row path is implemented and tested with a synthetic unit gate and natural key. If an
official FY2025-26 PDF is later published and a human verifies it, the expected entity-level rows
would be:

| `soc_line_item`             | Printed/derived label           | Sign             |
| --------------------------- | ------------------------------- | ---------------- |
| `total_revenue`             | Total revenue                   | positive         |
| `total_expenses`            | Total expenses                  | positive expense |
| `employee_expenses`         | Employee expenses               | positive expense |
| `depreciation_amortisation` | Depreciation and amortisation   | positive expense |
| `net_result`                | Net result                      | positive         |

Every row would be `jurisdiction_level: "soc"`, `jurisdiction: "WA"`,
`delivery_entity: "Pilbara Ports Authority"`, `aggregation_role: "agency_detail"`,
`measure_type: "actual"`, `verified: false`, `data_quality_flag: "provisional"`,
`potential_double_count: false`, with the printed unit gated to explicit `$'000` and zero-tolerance
reconciliation. The adapter will defer a discovered current PDF for human verification rather than
silently parse an unvalidated document.

## 6. No-total / no-cross-entity rule

- Pilbara Ports Authority is one WA GTE. No WA total, no national total and no sum with Water
  Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern
  Ports, Busselton Water, Mid West Ports, Kimberley Ports Authority, another WA GTE, a QLD/NSW SOC,
  a government program or the PNFC benchmark is created.
- The 2026 column is the reporting boundary if a future report is parsed; the prior-year column is
  never added.
- Revenue, total expenses, components and the net result overlap. They would be published rows, not
  an additive spending series.
- The adapter emits no aggregate row and no parent+subsidiary addition.

## 7. Implementation and tests

- Adapter: `server/src/connectors/soc/wa/pilbara-ports.ts`.
- Registration: `server/src/connectors/registry.ts`, `server/src/connectors/index.ts`,
  `server/src/api/soc.ts`, `client/src/pages/SocPage.tsx`, `scripts/ingest-soc.ts`.
- Tests: `server/test/wa-pilbara-ports.test.ts` — Incapsula shell detection, discovery/latest and
  publication-page fallback, unit-of-failure policy (challenge shell, no-PDF page, stale prior year,
  future direct PDF), natural key/idempotency and no-cross-entity total.
- The adapter is entity-level only and never deploys by itself; no deploy was run.

## 8. How to verify

```bash
# Official pages: expect HTTP 200 with the Incapsula challenge, not a document.
curl -sS -L -A 'Mozilla/5.0' -o /dev/null -w '%{http_code} %{size_download}\n' \
  'https://www.pilbaraports.com.au/about-pilbara-ports/publications/annual-report'
# Official sitemap: expect 457 loc entries and 0 pdf/getmedia locs.
curl -sS -L -A 'Mozilla/5.0' 'https://www.pilbaraports.com.au/sitemap.xml' \
  | grep -oiE '<loc>' | wc -l

# Focused adapter tests
npx vitest run server/test/wa-pilbara-ports.test.ts

# Targeted ingest and DB invariants (MONGO_URL is the ausspend_dev database)
MONGO_URL='mongodb://10.10.10.30:27017/ausspend_dev' SOC_ONLY_SOURCE_IDS=wa-pilbara-ports \
  npm run ingest:soc
mongosh "$MONGO_URL" --quiet --eval '
  const rows = db.measures.countDocuments({source_id:"wa-pilbara-ports"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const deferred = db.deferred_soc_documents.countDocuments({source_id:"wa-pilbara-ports",status:"deferred"});
  const stale = db.measures.countDocuments({source_id:"wa-pilbara-ports"});
  print(JSON.stringify({rows, soc, deferred, stale}));
'
# expect {"rows":0,"soc":190,"deferred":1,"stale":0} (no rows added)
```
