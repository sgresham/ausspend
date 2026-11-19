# Berrigan Shire Council — General Purpose Financial Statements (FY2025-26)

Source id `berrigan-gpfs` (NSW local government). One council only; entity-level rows, no council
total and no cross-council or state/federal addition.

**Status: registered but deferred with 0 rows.** The official FY2025-26 statements are retrievable
and their face statement reconciles internally, but the printed B1-1 "Total functions and
activities" row differs from the face statement by $1 thousand. Under the zero-tolerance rule the
connector emits nothing and records the exact gap.

## 0. Stale/current-year check (FY2025-26 is the newest)

The work-item title said FY2025-26. The official **Financial Statements** page was checked on
2026-11-19 and lists **Annual_Financial_Statements-2026-Final** (the year ended 30 June 2026) as the
newest audited standalone statements, above Financial Statements 2024-2025, 2023-2024, 2022-2023 and
older. No later (2026-27) audited standalone statements were published. The connector targets
**FY2025-26** and never substitutes the earlier 2024-25/2023-24 document, the narrative annual
report, the SPFS or the special schedules. A 404/JS-only later-year link would be recorded as a gap,
not a reason to fabricate.

## 1. Source and year

- Publisher: **Berrigan Shire Council**.
- Document: standalone audited **Annual_Financial_Statements-2026-Final** for the year ended 30 June
  2026 — FY2025-26. The 98-page PDF carries the signed GPFS, notes and the independent auditor's
  reports.
- Official page:
  <https://www.berriganshire.nsw.gov.au/Council/Governance-Transparency/Policies-Plans-Documents/Reports/Financial-Statements>.
- Current exact PDF:
  <https://www.berriganshire.nsw.gov.au/files/assets/public/v/1/01-council/gov.-amp-transparency/annual_financial_statements-2026-final.pdf>.
  The same URL is the documented official fallback pin, used when the listing yields no usable
  anchor; the downloaded bytes are SHA-256 verified either way.

## 2. Access, discovery and fetch

The inventory recorded an Akamai bot wall requiring a full browser/JS fetch. In this retrieval run
(2026-11-19) **both the Financial Statements page and the PDF returned `200`** to `curl/8.5.0` (PDF
`application/pdf`, 1,594,806 bytes), so no browser fetch was needed for the live ingest. The
connector still sends an explicit plain `curl/8.5.0` UA and falls back to the documented official pin
if the page is challenged or yields no usable anchor; a focused test simulates a `403` listing and
asserts the pin fallback. `scripts/berrigan-gpfs-browser.ts` is the documented headless-Chromium
fallback for a challenged run: it loads the official page, parses the link from the cleared HTML and
fetches the exact bytes same-origin. No unofficial mirror was used.

The parser accepts direct `.pdf` uploads whose label or file name contains "Financial Statements"
and rejects the narrative annual report, SPFS/special schedules, public notices, policies and
mirrors. The fiscal year is derived from the anchor label and file name
(`annual_financial_statements-2026-final.pdf` → FY2025-26), not from an upload-path date.

## 3. Archive (outside the repo)

The exact downloaded bytes are archived outside the repository under the configured source-archive
root, with the relative archive path `berrigan-gpfs/annual_financial_statements-2026-final.pdf`:

- URL: `https://www.berriganshire.nsw.gov.au/files/assets/public/v/1/01-council/gov.-amp-transparency/annual_financial_statements-2026-final.pdf`
- retrieval date: 2026-11-19
- bytes: **1,594,806**
- SHA-256: `4e9e95ee9b78572e70c8b125b472c01b764f91bc2784a26b7eae66a91cb28a68`
- content type: `application/pdf`

No PDF is committed. The fixture and this note contain only the relative archive path.

## 4. Exact reconciliation finding (deferred)

The printed unit is explicit `$ '000`. The face Income Statement reconciles internally:

| Face check | Printed / derived (`$ '000`) | Result |
| --- | --- | --- |
| Revenue components sum (rates 14,011 + user charges 3,282 + other revenue 1,217 + operating grants 11,339 + capital grants 2,525 + interest 1,464 + other income 217) | 34,055 | = printed total revenue |
| Expense components sum (employee 11,185 + materials 10,195 + borrowing 46 + other 883 + net loss on disposal 305) | 22,614 | = printed expenses excluding depreciation |
| Printed expenses excluding depreciation + printed depreciation/amortisation/impairment 10,128 | 32,742 | = face total expenses |
| Face net result | 34,055 − 32,742 = 1,313 | = printed net result |
| Net result − capital grants | 1,313 − 2,525 = (1,212) | = printed negative before-capital result |
| OCI (single revaluation) | 13,902 | = printed OCI |
| Net result + OCI | 1,313 + 13,902 = 15,215 | = printed total comprehensive income |

However, the printed B1-1 "Total functions and activities" row does **not** reconcile exactly to the
face statement:

| B1-1 check | Printed B1-1 (`$ '000`) | Face / derived (`$ '000`) | Gap |
| --- | ---: | ---: | ---: |
| Total functions and activities — expenses | 32,741 | 32,742 | 1 |
| Total functions and activities — operating result | 1,314 | 1,313 | 1 |
| B1-1 income − B1-1 expenses | 34,055 − 32,741 = 1,314 | face net result 1,313 | 1 |

The B1-1 row is internally consistent at 32,741 / 1,314, but it is $1 thousand away from the face
total expenses and net result. Because the brief requires every printed subtotal/result bridge to
reconcile at zero tolerance, the connector **defers the whole document with 0 rows** and reports
the exact reason:

```
GPFS reconciliation failed: B1-1 operating result = printed net result: printed/derived 1314 != expected 1313; B1-1 expenses = face total expenses bridge: printed/derived 32741 != expected 32742; B1-1 income - B1-1 expenses = printed net result: printed/derived 1314 != expected 1313; no rows ingested
```

No figure was adjusted, averaged or fabricated.

## 5. Extracted entity rows (0, deferred)

No measure rows are emitted. The connector does not publish a partial face-statement slice when the
printed B1-1 bridge is not exact, and it does not invent a council total or any cross-council row.

## 6. No-total / no-cross-council rule

- Berrigan Shire Council is one entity. No council total, no state/national total and no sum with
  another council, the `dubbo-council` budget/estimate rows, a government program, the PNFC
  benchmark or the OLG summary layer is created.
- The FY2025-26 column is the reporting boundary; the FY2024-25 comparative is not added.
- No rows are emitted at all while the printed B1-1 bridge is inexact.

## 7. Database ingest proof (2026-11-19, shared dev DB `ausspend_dev`)

Targeted ingest of **only `berrigan-gpfs`** against the shared dev DB `ausspend_dev`:

- total GPFS `data_sources` **104 → 105** (the new Berrigan source is registered as `degraded`);
- active GPFS `data_sources` stayed at **104** (Berrigan is degraded, not active);
- GPFS measures stayed at **1936**; total measures stayed at **999,454**; Berrigan rows **0**;
- SOC rows (`jurisdiction_level: "soc"`) stayed at **205**; every other per-source count unchanged;
- **0** Berrigan rows, so there is no council-total/aggregate row and no region/LGA allocation;
- `data_sources` records `status: "degraded"`, `records_ingested: 0` for `berrigan-gpfs`;
- the latest `ingestion_logs` entry is `status: "partial"`, `records_fetched: 0`,
  `records_upserted: 0`, with the exact B1-1/face gap in `errors`.

The exact PDF is archived outside the repo at the relative path
`berrigan-gpfs/annual_financial_statements-2026-final.pdf` with the SHA-256 above; no PDF is
committed.

## 8. How to verify

```bash
# Official page and exact FY2025-26 PDF (200 in this retrieval run).
curl -sL -o /dev/null -w '%{http_code}\n' \
  -A 'curl/8.5.0' \
  'https://www.berriganshire.nsw.gov.au/Council/Governance-Transparency/Policies-Plans-Documents/Reports/Financial-Statements'
curl -sL -o /dev/null -w '%{http_code} %{content_type} %{size_download}\n' \
  -A 'curl/8.5.0' \
  'https://www.berriganshire.nsw.gov.au/files/assets/public/v/1/01-council/gov.-amp-transparency/annual_financial_statements-2026-final.pdf'

# Focused connector tests (13).
TEST_MONGO_URL="mongodb://localhost:27017/ausspend_test_berrigangpfs" \
  npx vitest run --project server server/test/berrigan-gpfs.test.ts
```

The focused suite covers discovery/latest selection (annual report, prior-year and mirror
rejection), the `403`→documented-pin WAF fallback, the plain-UA header, the unit gate, the exact
zero-tolerance deferral with the $1 thousand B1-1 gap, natural-key stability, and additive-only
ingestion that preserves existing rows while emitting no Berrigan measure.
