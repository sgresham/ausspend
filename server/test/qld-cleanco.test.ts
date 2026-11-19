import { describe, expect, it } from 'vitest';
import {
  CLEANCO_ACCESS_GAP_REASON,
  CLEANCO_ENTITY,
  CLEANCO_ID,
  CLEANCO_JURISDICTION,
  CLEANCO_PUBLICATIONS_URL,
  CLEANCO_SOURCE_URL,
  cleancoDeferralFor,
  cleancoFiscalYearFromPublication,
  cleancoNaturalKey,
  createCleancoConnector,
  discoverCleancoAnnualReport,
  parseCleancoPublicationLinks,
  type CleancoAnnualReportArtifact,
} from '../src/connectors/soc/qld/cleanco.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const FLIPSNACK_URL =
  'https://www.flipsnack.com/5CABFCFF8D6/cleanco-queensland-annual-report-2026';
const STALE_PDF_URL =
  'https://cleancoqueensland.com.au/wp-content/uploads/Annual_Report_2025_Accessible_PDF.pdf';

function artifact(overrides: Partial<CleancoAnnualReportArtifact> = {}): CleancoAnnualReportArtifact {
  return {
    url: FLIPSNACK_URL,
    kind: 'flipsnack',
    filename: 'qld-cleanco-annual-report-2025-26.flipsnack.html',
    fiscal_year: '2025-26',
    title: 'CleanCo Queensland Annual Report 2025–26',
    discovery_page: CLEANCO_SOURCE_URL,
    ...overrides,
  };
}

describe('CleanCo Queensland annual-report discovery', () => {
  it('identifies the FY2025-26 Flipsnack viewer as the newest publication and keeps the prior-year PDF separate', () => {
    const html = `
      <a href="https://www.flipsnack.com/5CABFCFF8D6/cleanco-queensland-annual-report-2026">FlippingBook</a>
      <a href="https://cleancoqueensland.com.au/wp-content/uploads/Annual_Report_2025_Accessible_PDF.pdf">Annual Report 2025</a>
      <a href="/wp-content/uploads/2024/10/CleanCo-FY24-Annual-Report_Accessible-1.pdf">FY24</a>
      <a href="/wp-content/uploads/2024/07/CleanCo-Annual-Report-2023.pdf">2023</a>
      <a href="/wp-content/uploads/2026/09/Code-of-Conduct-August-2026-v8.pdf">Code of Conduct</a>
      <a href="https://cleancoqueensland.com.au/wp-content/uploads/CleanCo-Revised-Statement-of-Corporate-Intent-FY25_Final.pdf">SCI</a>
      <a href="/wp-content/uploads/2026/05/RAP_Innovate_Landscape_A4_Final_WEB.pdf">RAP</a>`;
    const artifacts = parseCleancoPublicationLinks(html, CLEANCO_SOURCE_URL);
    expect(artifacts[0]).toMatchObject({
      url: FLIPSNACK_URL,
      kind: 'flipsnack',
      fiscal_year: '2025-26',
    });
    expect(artifacts.find((entry) => entry.kind === 'pdf')?.url).toBe(STALE_PDF_URL);
    expect(artifacts.find((entry) => entry.url === STALE_PDF_URL)?.fiscal_year).toBe('2024-25');
    expect(
      artifacts.some((entry) =>
        /policy|constitution|statement-of-corporate-intent|code-of-conduct|rap/i.test(entry.url),
      ),
    ).toBe(false);
  });

  it('maps official URL slugs and filenames to the correct API fiscal year', () => {
    expect(cleancoFiscalYearFromPublication('cleanco-queensland-annual-report-2026')).toBe(
      '2025-26',
    );
    expect(cleancoFiscalYearFromPublication('Annual_Report_2025_Accessible_PDF.pdf')).toBe(
      '2024-25',
    );
    expect(cleancoFiscalYearFromPublication('Annual_Report_2026.pdf')).toBe('2025-26');
    expect(cleancoFiscalYearFromPublication('cleanco-annual-report-2024-25.pdf')).toBe('2024-25');
    expect(cleancoFiscalYearFromPublication('Conflict-of-Interest-Policy_October-2024.pdf')).toBe(
      null,
    );
    expect(
      cleancoFiscalYearFromPublication('CleanCo-Revised-Statement-of-Corporate-Intent-FY25.pdf'),
    ).toBe(null);
  });

  it('uses the official publication-scheme page first', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === CLEANCO_SOURCE_URL) {
        return new Response(
          `<a href="${FLIPSNACK_URL}">2026</a><a href="${STALE_PDF_URL}">2025</a>`,
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverCleancoAnnualReport(fetchImpl);
    expect(latest.url).toBe(FLIPSNACK_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(latest.kind).toBe('flipsnack');
    expect(fetched).toEqual([CLEANCO_SOURCE_URL]);
  });

  it('falls back to the official publications page and never guesses a PDF URL', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === CLEANCO_SOURCE_URL) return new Response('<html>no reports</html>', { status: 200 });
      if (url === CLEANCO_PUBLICATIONS_URL) {
        return new Response(`<a href="${FLIPSNACK_URL}">2026</a>`, { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverCleancoAnnualReport(fetchImpl);
    expect(latest.url).toBe(FLIPSNACK_URL);
    expect(fetched).toEqual([CLEANCO_SOURCE_URL, CLEANCO_PUBLICATIONS_URL]);
  });

  it('errors when no official annual-report artifact exists instead of inventing one', async () => {
    const fetchImpl = (async () =>
      new Response('<a href="/handbook.pdf">handbook</a>', { status: 200 })) as typeof fetch;
    await expect(discoverCleancoAnnualReport(fetchImpl)).rejects.toThrow(
      /refusing to hard-code a PDF URL/i,
    );
  });
});

describe('CleanCo Queensland access-gap policy', () => {
  it('defers the FY2025-26 Flipsnack-only report with the exact access gap and no rows', () => {
    const deferral = cleancoDeferralFor(artifact());
    expect(deferral.phase).toBe('access');
    expect(deferral.reason).toBe(CLEANCO_ACCESS_GAP_REASON);
    expect(deferral.reason).toMatch(/Flipsnack flipbook/);
    expect(deferral.reason).toMatch(/no direct PDF/);
    expect(deferral.reason).toMatch(/Annual_Report_2025_Accessible_PDF\.pdf/);
    expect(deferral.reason).toMatch(/prior FY2024-25 report/);
  });

  it('refuses to ingest the prior FY2024-25 PDF as the current year', () => {
    const deferral = cleancoDeferralFor(
      artifact({ url: STALE_PDF_URL, kind: 'pdf', fiscal_year: '2024-25' }),
    );
    expect(deferral.phase).toBe('access');
    expect(deferral.reason).toMatch(/refusing to ingest a stale prior year as current/);
    expect(deferral.reason).toContain('2024-25');
  });

  it('defers a future direct FY2025-26 PDF for human verification rather than silently ingesting it', () => {
    const deferral = cleancoDeferralFor(
      artifact({
        url: 'https://cleancoqueensland.com.au/wp-content/uploads/2026/09/CleanCo-Annual-Report-2026.pdf',
        kind: 'pdf',
        fiscal_year: '2025-26',
      }),
    );
    expect(deferral.phase).toBe('direct-pdf');
    expect(deferral.reason).toMatch(/defers it for human verification/);
  });
});

describe('CleanCo Queensland connector contract', () => {
  it('is an entity-level QLD SOC connector that emits no aggregate rows', () => {
    const connector = createCleancoConnector();
    expect(connector.id).toBe(CLEANCO_ID);
    expect(connector.jurisdiction_level).toBe('soc');
    expect(connector.status).toBe('active');
    expect(connector.transform([])).toEqual([]);
    expect(connector.transform([{ kind: 'anything', record: {} }])).toEqual([]);
  });

  it('keeps CleanCo separate from the generic additive spending query and from other QLD GOCs', () => {
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
    expect(CLEANCO_ID).toBe('qld-cleanco');
    expect(CLEANCO_ENTITY).toBe('CleanCo Queensland Limited');
    expect(CLEANCO_JURISDICTION).toBe('QLD');
  });

  it('builds a stable natural key for any future human-verified row', () => {
    const key = cleancoNaturalKey(CLEANCO_ENTITY, '2025-26', 'total_expenses', FLIPSNACK_URL);
    expect(key).toMatch(/^qld-cleanco:[0-9a-f]{40}$/);
    expect(key).toBe(
      cleancoNaturalKey(CLEANCO_ENTITY, '2025-26', 'total_expenses', FLIPSNACK_URL),
    );
    expect(key).not.toBe(
      cleancoNaturalKey(CLEANCO_ENTITY, '2025-26', 'total_revenue', FLIPSNACK_URL),
    );
    expect(key).not.toBe(
      cleancoNaturalKey(CLEANCO_ENTITY, '2024-25', 'total_expenses', FLIPSNACK_URL),
    );
  });

  it('never marks a CleanCo row additive', () => {
    // The deferral path emits no records; this asserts the entity policy for any
    // future record built with the shared SOC fields.
    const row = {
      jurisdiction_level: 'soc' as const,
      aggregation_role: 'agency_detail' as const,
      potential_double_count: false,
    };
    expect(isAdditiveMeasure(row)).toBe(false);
  });
});
