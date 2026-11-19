import { describe, expect, it } from 'vitest';
import {
  PILBARA_PORTS_ACCESS_GAP_REASON,
  PILBARA_PORTS_ENTITY,
  PILBARA_PORTS_ID,
  PILBARA_PORTS_JURISDICTION,
  PILBARA_PORTS_NO_PDF_REASON,
  PILBARA_PORTS_PUBLICATIONS_URL,
  PILBARA_PORTS_SOURCE_URL,
  createPilbaraPortsConnector,
  discoverPilbaraPortsAnnualReport,
  isIncapsulaChallenge,
  parsePilbaraPortsAnnualReportLinks,
  pilbaraPortsDeferralFor,
  pilbaraPortsFiscalYearFromPublication,
  pilbaraPortsNaturalKey,
  type PilbaraPortsAnnualReportArtifact,
} from '../src/connectors/soc/wa/pilbara-ports.js';
import { measureQuery } from '../src/api/filters.js';
import { isAdditiveMeasure } from '../src/api/measure-summary.js';

const CURRENT_PDF_URL =
  'https://www.pilbaraports.com.au/getmedia/01234567-89ab-cdef-0123-456789abcdef/Pilbara-Ports-Annual-Report-2026.pdf';
const STALE_PDF_URL =
  'https://www.pilbaraports.com.au/getmedia/89abcdef-0123-4567-89ab-cdef01234567/Pilbara-Ports-Annual-Report-2025.pdf';

const INCAPSULA_SHELL = `\n<html>
<head>
<META NAME="robots" CONTENT="noindex,nofollow">
<script src="/_Incapsula_Resource?SWJIYLWA=5074a744e2e3d891814e9a2dace20bd4,719d34d31c8e3a6e6fffd425f7e032f3">
</script>
<body>
</body></html>`;

const INCAPSULA_INCIDENT = `\n<html style="height:100%"><head><META NAME="ROBOTS" CONTENT="NOINDEX, NOFOLLOW"><script type="text/javascript" src="/_Incapsula_Resource?SWJIYLWA=719d34d31c8e3a6e6fffd425f7e032f3"></script></head><body><iframe id="main-iframe" src="/_Incapsula_Resource?SWUDNSAI=31"></iframe>Request unsuccessful. Incapsula incident ID: 1048000050017822481-6224215134437742</body></html>`;

function artifact(
  overrides: Partial<PilbaraPortsAnnualReportArtifact> = {},
): PilbaraPortsAnnualReportArtifact {
  return {
    url: PILBARA_PORTS_SOURCE_URL,
    kind: 'incapsula-challenge',
    filename: 'wa-pilbara-ports-annual-report-2025-26.incapsula.html',
    fiscal_year: '2025-26',
    title: 'Pilbara Ports Authority Annual Report 2025–26',
    discovery_page: PILBARA_PORTS_SOURCE_URL,
    ...overrides,
  };
}

describe('Pilbara Ports Authority annual-report discovery', () => {
  it('recognises the Incapsula challenge shell and incident page', () => {
    expect(isIncapsulaChallenge(INCAPSULA_SHELL)).toBe(true);
    expect(isIncapsulaChallenge(INCAPSULA_INCIDENT)).toBe(true);
    expect(isIncapsulaChallenge('<html><a href="/annual-report-2026.pdf">report</a></html>')).toBe(
      false,
    );
  });

  it('parses only annual-report PDFs and keeps prior years separate', () => {
    const html = `
      <a href="${CURRENT_PDF_URL}">Annual Report 2025-26</a>
      <a href="${STALE_PDF_URL}">Annual Report 2024-25</a>
      <a href="/getmedia/aaa/Pilbara-Ports-Modern-Slavery-Statement-2026.pdf">Modern Slavery</a>
      <a href="/getmedia/bbb/Pilbara-Ports-Statement-of-Corporate-Intent-2026.pdf">SCI</a>
      <a href="/getmedia/ccc/Port-Handbook-2026.pdf">Handbook</a>
      <a href="/about-pilbara-ports/publications/policies">Policies</a>`;
    const artifacts = parsePilbaraPortsAnnualReportLinks(html, PILBARA_PORTS_SOURCE_URL);
    expect(artifacts.map((entry) => entry.url)).toEqual([CURRENT_PDF_URL, STALE_PDF_URL]);
    expect(artifacts[0]?.fiscal_year).toBe('2025-26');
    expect(artifacts[1]?.fiscal_year).toBe('2024-25');
  });

  it('maps official URL slugs and filenames to the correct API fiscal year', () => {
    expect(pilbaraPortsFiscalYearFromPublication('Pilbara-Ports-Annual-Report-2026.pdf')).toBe(
      '2025-26',
    );
    expect(pilbaraPortsFiscalYearFromPublication('annual-report-2024-25.pdf')).toBe('2024-25');
    expect(
      pilbaraPortsFiscalYearFromPublication('Pilbara-Ports-Modern-Slavery-Statement-2026.pdf'),
    ).toBe(null);
    expect(
      pilbaraPortsFiscalYearFromPublication('Pilbara-Ports-Statement-of-Corporate-Intent-2026.pdf'),
    ).toBe(null);
  });

  it('returns an explicit challenge artifact instead of guessing a PDF URL', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      fetched.push(String(input));
      return new Response(INCAPSULA_SHELL, { status: 200 });
    }) as typeof fetch;
    const latest = await discoverPilbaraPortsAnnualReport(fetchImpl);
    expect(latest.kind).toBe('incapsula-challenge');
    expect(latest.fiscal_year).toBe('2025-26');
    expect(latest.url).toBe(PILBARA_PORTS_SOURCE_URL);
    expect(fetched).toEqual([PILBARA_PORTS_SOURCE_URL, PILBARA_PORTS_PUBLICATIONS_URL]);
  });

  it('falls back to the official publications page for a current PDF', async () => {
    const fetched: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      fetched.push(url);
      if (url === PILBARA_PORTS_SOURCE_URL) return new Response(INCAPSULA_SHELL, { status: 200 });
      if (url === PILBARA_PORTS_PUBLICATIONS_URL) {
        return new Response(`<a href="${CURRENT_PDF_URL}">Annual Report 2025-26</a>`, {
          status: 200,
        });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const latest = await discoverPilbaraPortsAnnualReport(fetchImpl);
    expect(latest.kind).toBe('pdf');
    expect(latest.url).toBe(CURRENT_PDF_URL);
    expect(latest.fiscal_year).toBe('2025-26');
    expect(fetched).toEqual([PILBARA_PORTS_SOURCE_URL, PILBARA_PORTS_PUBLICATIONS_URL]);
  });

  it('errors when no official page is reachable instead of inventing a PDF', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 503 })) as typeof fetch;
    await expect(discoverPilbaraPortsAnnualReport(fetchImpl)).rejects.toThrow(
      /refusing to hard-code a PDF URL/i,
    );
  });
});

describe('Pilbara Ports Authority access-gap policy', () => {
  it('defers the challenge-shell report with the exact access gap and no rows', () => {
    const deferral = pilbaraPortsDeferralFor(artifact());
    expect(deferral.phase).toBe('access');
    expect(deferral.reason).toBe(PILBARA_PORTS_ACCESS_GAP_REASON);
    expect(deferral.reason).toMatch(/Incapsula/);
    expect(deferral.reason).toMatch(/no official current FY2025-26 PDF/i);
  });

  it('defers a reachable page that lists no annual-report PDF', () => {
    const deferral = pilbaraPortsDeferralFor(artifact({ kind: 'html-no-report' }));
    expect(deferral.phase).toBe('access');
    expect(deferral.reason).toBe(PILBARA_PORTS_NO_PDF_REASON);
  });

  it('refuses to ingest a prior-year PDF as the current year', () => {
    const deferral = pilbaraPortsDeferralFor(
      artifact({ kind: 'pdf', url: STALE_PDF_URL, fiscal_year: '2024-25' }),
    );
    expect(deferral.phase).toBe('access');
    expect(deferral.reason).toMatch(/refusing to ingest a stale prior year as current/);
    expect(deferral.reason).toContain('2024-25');
  });

  it('defers a future direct FY2025-26 PDF for human verification rather than silently ingesting it', () => {
    const deferral = pilbaraPortsDeferralFor(
      artifact({ kind: 'pdf', url: CURRENT_PDF_URL, fiscal_year: '2025-26' }),
    );
    expect(deferral.phase).toBe('direct-pdf');
    expect(deferral.reason).toMatch(/defers it for human verification/);
  });
});

describe('Pilbara Ports Authority connector contract', () => {
  it('is an entity-level WA SOC connector that emits no aggregate rows', () => {
    const connector = createPilbaraPortsConnector();
    expect(connector.id).toBe(PILBARA_PORTS_ID);
    expect(connector.jurisdiction_level).toBe('soc');
    expect(connector.status).toBe('active');
    expect(connector.transform([])).toEqual([]);
    expect(connector.transform([{ kind: 'anything', record: {} }])).toEqual([]);
  });

  it('keeps Pilbara Ports separate from the generic additive query and from other WA GTEs', () => {
    const query = measureQuery({ limit: 10 });
    expect(query.jurisdiction_level).toEqual({ $ne: 'soc' });
    expect(PILBARA_PORTS_ID).toBe('wa-pilbara-ports');
    expect(PILBARA_PORTS_ENTITY).toBe('Pilbara Ports Authority');
    expect(PILBARA_PORTS_JURISDICTION).toBe('WA');
  });

  it('builds a stable natural key for any future human-verified row', () => {
    const key = pilbaraPortsNaturalKey(
      PILBARA_PORTS_ENTITY,
      '2025-26',
      'total_expenses',
      CURRENT_PDF_URL,
    );
    expect(key).toMatch(/^wa-pilbara-ports:[0-9a-f]{40}$/);
    expect(key).toBe(
      pilbaraPortsNaturalKey(PILBARA_PORTS_ENTITY, '2025-26', 'total_expenses', CURRENT_PDF_URL),
    );
    expect(key).not.toBe(
      pilbaraPortsNaturalKey(PILBARA_PORTS_ENTITY, '2025-26', 'total_revenue', CURRENT_PDF_URL),
    );
    expect(key).not.toBe(
      pilbaraPortsNaturalKey(PILBARA_PORTS_ENTITY, '2024-25', 'total_expenses', CURRENT_PDF_URL),
    );
  });

  it('never marks a Pilbara Ports row additive', () => {
    const row = {
      jurisdiction_level: 'soc' as const,
      aggregation_role: 'agency_detail' as const,
      potential_double_count: false,
    };
    expect(isAdditiveMeasure(row)).toBe(false);
  });
});
