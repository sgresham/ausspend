import { describe, expect, it } from 'vitest';
import {
  pdfFilenameFromUrl,
  resolveSocDocument,
  type SocSourceDocument,
} from '../src/connectors/soc/nsw/soc-document-fetch.js';
import {
  findParliamentTabledPaper,
  type ParliamentTabledPaper,
} from '../src/connectors/soc/nsw/nsw-parliament.js';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');

function document(overrides: Partial<SocSourceDocument> = {}): SocSourceDocument {
  return {
    url: 'https://publisher.example.gov.au/Annual-Report-2024-25.pdf',
    filename: 'Annual-Report-2024-25.pdf',
    fiscal_year: '2024-25',
    title: 'Annual Report 2024–25',
    ...overrides,
  };
}

function pdfResponse(): Response {
  return new Response(PDF, {
    status: 200,
    headers: { 'content-type': 'application/pdf' },
  });
}

function blockedResponse(): Response {
  return new Response('<html>Cloudflare challenge</html>', {
    status: 403,
    headers: { 'content-type': 'text/html' },
  });
}

const PAPER: ParliamentTabledPaper = {
  source_id: 'waternsw',
  fiscal_year: '2024-25',
  tabled_paper_id: '192122',
  title: 'Annual Report 2024–25',
  official_url: 'https://publisher.example.gov.au/Annual-Report-2024-25.pdf',
  artifact_url:
    'https://files.parliament.nsw.gov.au/fileapi/ParlFiles/GetArtifact?serverRelativeUrl=%2Ftp%2Ffiles%2F192122%2Freport.pdf',
  filename: 'report.pdf',
  sha256: '0'.repeat(64),
  bytes: PDF.length,
  byte_identical_to_official: true,
  note: 'fixture',
};

describe('NSW Parliament tabled-paper fallback registry', () => {
  it('has a verified 2024-25 artifact for each degraded NSW SOC source', () => {
    for (const sourceId of ['waternsw', 'essential-energy', 'forestry-corporation']) {
      const paper = findParliamentTabledPaper(sourceId, '2024-25');
      expect(paper, sourceId).not.toBeNull();
      expect(paper?.fiscal_year).toBe('2024-25');
      expect(paper?.artifact_url.startsWith('https://files.parliament.nsw.gov.au/')).toBe(true);
      expect(paper?.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(paper?.bytes).toBeGreaterThan(0);
      expect(paper?.official_url.startsWith('https://')).toBe(true);
      expect(paper?.tabled_paper_id).toMatch(/^\d+$/);
    }
  });

  it('records the exact tabled-paper ids used for the recovery', () => {
    expect(findParliamentTabledPaper('essential-energy')?.tabled_paper_id).toBe('192060');
    expect(findParliamentTabledPaper('forestry-corporation')?.tabled_paper_id).toBe('192061');
    expect(findParliamentTabledPaper('waternsw')?.tabled_paper_id).toBe('192122');
  });

  it('has no entry for an unknown source', () => {
    expect(findParliamentTabledPaper('not-a-source')).toBeNull();
  });
});

describe('SOC direct -> Parliament -> headless strategy ladder', () => {
  it('uses a direct publisher fetch when it works', async () => {
    const resolved = await resolveSocDocument({
      source_id: 'waternsw',
      source_label: 'WaterNSW',
      fetchImpl: (async () => pdfResponse()) as unknown as typeof fetch,
      discoverDirect: async () => document(),
      discoveryPageUrl: 'https://publisher.example.gov.au/annual-reports',
    });
    expect(resolved.strategy).toBe('direct');
    expect(resolved.document.url).toBe(document().url);
    expect(resolved.retrieved_from).toBe(document().url);
    expect(resolved.archived_from).toBe('direct');
    expect(resolved.bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('falls back to the NSW Parliament artifact when the publisher returns 403', async () => {
    const resolved = await resolveSocDocument({
      source_id: 'waternsw',
      source_label: 'WaterNSW',
      fetchImpl: (async (url: string | URL | Request) => {
        if (String(url).includes('files.parliament.nsw.gov.au')) return pdfResponse();
        return blockedResponse();
      }) as unknown as typeof fetch,
      discoverDirect: async () => {
        throw new Error('annual-report page HTTP 403');
      },
      discoveryPageUrl: 'https://publisher.example.gov.au/annual-reports',
      fetchParliament: async () => ({ paper: PAPER, bytes: PDF }),
    });
    expect(resolved.strategy).toBe('parliament_fallback');
    expect(resolved.document.url).toBe(PAPER.official_url);
    expect(resolved.retrieved_from).toBe(PAPER.artifact_url);
    expect(resolved.archived_from).toBe('other');
    // A Parliament artifact must not overwrite the official-host archive file.
    expect(resolved.filename).toBe('report.pdf');
  });

  it('uses a headless browser only after direct and Parliament both fail', async () => {
    const resolved = await resolveSocDocument({
      source_id: 'waternsw',
      source_label: 'WaterNSW',
      fetchImpl: (async () => blockedResponse()) as unknown as typeof fetch,
      discoverDirect: async () => document(),
      discoveryPageUrl: 'https://publisher.example.gov.au/annual-reports',
      fetchParliament: async () => null,
      headlessFetch: async () => PDF,
    });
    expect(resolved.strategy).toBe('headless');
    expect(resolved.retrieved_from).toBe(document().url);
  });

  it('throws with every attempt recorded when all three strategies fail', async () => {
    await expect(
      resolveSocDocument({
        source_id: 'waternsw',
        source_label: 'WaterNSW',
        fetchImpl: (async () => blockedResponse()) as unknown as typeof fetch,
        discoverDirect: async () => document(),
        discoveryPageUrl: 'https://publisher.example.gov.au/annual-reports',
        fetchParliament: async () => null,
        headlessFetch: async () => {
          throw new Error('headless browser unavailable');
        },
      }),
    ).rejects.toThrow(
      /direct download: HTTP 403.*parliament fallback: no NSW Parliament tabled-paper registry entry.*headless: headless browser unavailable/,
    );
  });

  it('keeps official provenance while recording a Parliament mirror', () => {
    expect(pdfFilenameFromUrl(PAPER.artifact_url, PAPER.filename)).toBe('report.pdf');
    expect(pdfFilenameFromUrl('https://x.example.gov.au/a b.pdf', 'fallback.pdf')).toBe('a-b.pdf');
  });

  it('never treats an HTML challenge body as a PDF', async () => {
    await expect(
      resolveSocDocument({
        source_id: 'waternsw',
        source_label: 'WaterNSW',
        fetchImpl: (async () =>
          new Response('<html>challenge</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          })) as unknown as typeof fetch,
        discoverDirect: async () => document(),
        discoveryPageUrl: 'https://publisher.example.gov.au/annual-reports',
        fetchParliament: async () => null,
        headlessFetch: async () => {
          throw new Error('no browser');
        },
      }),
    ).rejects.toThrow(/did not return a PDF|not PDF bytes|expected application\/pdf/);
  });
});
