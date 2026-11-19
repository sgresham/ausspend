# WA SOC — Mid West Ports annual-report evidence

**Status:** implementation evidence only. This is the ninth WA Government Trading Enterprise (GTE)
pilot. The exact PDF is archived outside the repo; no PDF or raw table is committed. **Entity:**
Mid West Ports — the Mid West Ports Authority — only, a WA GTE under the Government Trading
Enterprises Act 2023 (WA) and the Port Authorities Act 1999 (WA). **No WA total, no other WA GTE, no
QLD/NSW SOC.** The 2026 column is used; the 2025 column is never added.

**Checked:** 2026-11-19 (Australia/Perth).

## 1. Discovery and access log

| Step              | URL                                                                                                                                                                   | HTTP    | Result                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| Publications      | <https://www.midwestports.com.au/our-port/publications-forms.aspx>                                                                                                    | **200** | `text/html`; links to the annual-reports page.                     |
| Annual reports    | <https://www.midwestports.com.au/our-port/publications/annual-reports.aspx>                                                                                           | **200** | `text/html`; lists annual reports 2001-02 to 2025-26 as PDF links. |
| Latest report PDF | <https://www.midwestports.com.au/Profiles/midwestports/Assets/ClientData/Documents/AnnualReport/2025-26/MWP16729_Annual_Report_2026_A4_LNDSCP_V25_LR_WEB_SPREADS.pdf> | **200** | `application/pdf`, 10,824,762 bytes, 54 PDF pages                  |

The connector fetches the official annual-reports page and parses its PDF links. A link is accepted
only when its filename contains "annual report" and a year; port handbooks, trade statistics,
statements of corporate intent and corporate plans are rejected by name. The PDF URL itself is never
hard-coded; `WA_MID_WEST_PORTS_ANNUAL_REPORT_URL` is the operator override. If the discovery page is
unreachable or contains no annual-report PDF link, the connector errors and defers rather than
guessing a URL or ingesting a stale hard-coded document.

## 2. Exact document

- **Title:** Mid West Ports Annual Report 2025-26 (FY2025-26).
- **Financial year:** 2025-26, for the year ended 30 June 2026.
- **Bytes:** 10,824,762.
- **PDF pages:** 54.
- **SHA-256:** `192f512d5702d998f5bc388be110c5184c2209fcb831781821f51929f9e27fe6`.
- **Archive root:** `~/ausspend-source-archive/wa-mid-west-ports/` (outside the repo; not committed).
  It contains the exact PDF, `SHA256SUMS` and `retrieval.json` with the URL, discovery page, retrieval
  date, bytes, pages and SHA-256. The connector archives the same bytes under `AUSSPEND_SOURCE_ARCHIVE`
  at runtime and verifies the hash before parsing.

## 3. Printed unit and statement

The Statement of Profit or Loss and Other Comprehensive Income is on PDF page 42. It prints `$’000`
for the 2026 and 2025 columns. The unit gate requires **explicit thousands**; a whole-dollar, `$M`,
unit-less or ambiguous read is rejected and the document is deferred without rows.

The 2026 column prints:

```text
                                                        2026      2025
                                                      $’000     $’000
Income
Revenue                                            138,740   117,077
Other income                                         4,309     4,723
Expenditure
Employee benefit expense                          (38,224)  (33,268)
Supplies and services                             (15,845)  (13,702)
Asset maintenance                                 (16,178)  (13,874)
Government charges                                 (1,970)   (1,736)
Utilities                                            (824)     (863)
Depreciation, amortisation and impairment         (11,698)   (9,906)
Insurance                                          (1,396)   (1,398)
Finance costs                                        (334)     (368)
Other expenses                                     (5,853)   (5,291)
Profit before income tax                           50,727    41,394
Income tax expense                                (15,698)  (12,441)
Profit for the year                                35,029    28,953
```

This face statement has **no printed Total income subtotal and no printed Total expenses subtotal**.
Total income is therefore the exact sum of Revenue + Other income, and total expenses is the exact
sum of the nine printed expense lines; both are accepted only because they bridge to the printed
Profit before income tax and Profit for the year at zero tolerance. The adapter defers rather than
fabricating either derived total.

## 4. Reconciliation (zero tolerance)

All arithmetic is in printed `$’000` values:

```text
total income:
  138,740 + 4,309 = 143,049   (derived; no printed Total income subtotal)

total expenses:
  38,224 + 15,845 + 16,178 + 1,970 + 824 + 11,698 + 1,396 + 334 + 5,853 = 92,322
  (derived; no printed Total expenses subtotal)

profit before income tax:
  143,049 − 92,322 = 50,727
  = printed Profit before income tax 50,727

net result:
  50,727 − 15,698 = 35,029
  = printed Profit for the year 35,029
```

The adapter defers the document if any printed line is missing, if the unit is not explicit `$’000`,
if the profit-before-tax bridge differs by one thousand, or if the net-result bridge differs by one
thousand. On the 2025-26 report the deferral is `null`.

## 5. Extracted entity rows (five, non-additive)

| `soc_line_item`             | Printed/derived label                     | `$’000` | `amount_cents` | Sign             |
| --------------------------- | ----------------------------------------- | ------: | -------------: | ---------------- |
| `total_revenue`             | Total revenue (derived)                   | 143,049 | 14,304,900,000 | positive         |
| `total_expenses`            | Total expenses (derived)                  |  92,322 |  9,232,200,000 | positive expense |
| `employee_expenses`         | Employee benefit expense                  |  38,224 |  3,822,400,000 | positive expense |
| `depreciation_amortisation` | Depreciation, amortisation and impairment |  11,698 |  1,169,800,000 | positive expense |
| `net_result`                | Profit for the year                       |  35,029 |  3,502,900,000 | positive         |

Every row is `jurisdiction_level: "soc"`, `jurisdiction: "WA"`, `delivery_entity: "Mid West Ports"`,
`aggregation_role: "agency_detail"`, `measure_type: "actual"`, `verified: false`,
`data_quality_flag: "provisional"`, `potential_double_count: false`.

## 6. No-total / no-cross-entity rule

- Mid West Ports is one WA GTE. No WA total, no national total and no sum with Water Corporation,
  Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern Ports, Busselton
  Water, another WA GTE, a QLD/NSW SOC, a government program or the PNFC benchmark is created.
- The 2026 column is the reporting boundary; the prior-year column is not added.
- Revenue, total expenses, components and the net result overlap. They are published rows, not an
  additive spending series.
- Water Corporation, Synergy, Western Power, Horizon Power, Fremantle Ports, DevelopmentWA, Southern
  Ports, Busselton Water and all QLD/NSW SOC rows are untouched by this adapter.

## 7. How to verify

```bash
# Official pages and exact PDF: expect 200.
curl -sSI -L -A 'Mozilla/5.0' 'https://www.midwestports.com.au/our-port/publications/annual-reports.aspx' | head -1
curl -sS -L -o /tmp/midwest-2026.pdf -w '%{http_code} %{size_download} %{content_type}\n' \
  'https://www.midwestports.com.au/Profiles/midwestports/Assets/ClientData/Documents/AnnualReport/2025-26/MWP16729_Annual_Report_2026_A4_LNDSCP_V25_LR_WEB_SPREADS.pdf'
sha256sum /tmp/midwest-2026.pdf
# expect 192f512d5702d998f5bc388be110c5184c2209fcb831781821f51929f9e27fe6

# Durable archive (outside the repo)
cat ~/ausspend-source-archive/wa-mid-west-ports/SHA256SUMS
cat ~/ausspend-source-archive/wa-mid-west-ports/retrieval.json

# Focused adapter tests
npx vitest run server/test/wa-mid-west-ports.test.ts

# Shared-dev DB invariants (MONGO_URL is the ausspend_dev database)
mongosh "$MONGO_URL" --quiet --eval '
  const mw = db.measures.countDocuments({source_id:"wa-mid-west-ports"});
  const soc = db.measures.countDocuments({jurisdiction_level:"soc"});
  const nonMw = db.measures.countDocuments({jurisdiction_level:"soc", source_id:{$ne:"wa-mid-west-ports"}});
  print(JSON.stringify({mw, soc, nonMw, wa: db.measures.countDocuments({jurisdiction_level:"soc", jurisdiction:"WA"})}));
'
# expect {"mw":5,...,"wa":45} after ingesting this adapter on top of the eight existing WA GTE pilots
```
