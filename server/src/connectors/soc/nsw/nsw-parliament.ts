import { sha256Bytes } from '../../source-archive.js';

/**
 * NSW Parliament tabled-paper fallback index.
 *
 * The NSW SOC publisher hosts (WaterNSW, Essential Energy, Forestry Corporation)
 * present a Cloudflare challenge to the ingestion host for both their HTML
 * annual-report pages and the PDF paths. When that happens the connector falls
 * back to the same annual report tabled in NSW Parliament, whose file service
 * (`files.parliament.nsw.gov.au`) serves the artifact through a Cloudflare
 * challenge that ordinary Node `fetch` can pass.
 *
 * The artifact URL is recorded here (not scraped at runtime) because the
 * Parliament HTML search/detail pages are themselves challenged. Each entry is
 * still verified byte-for-byte on every fetch: content type, byte length and
 * SHA-256 must match the recorded values before the document is used. The
 * registry is a discovery index, not a trusted dump. Update it when a new
 * report is tabled; a tested mismatch defers the document instead of ingesting
 * the wrong bytes.
 *
 * Source ids are duplicated as string literals to avoid importing every
 * connector into this module (which would create an import cycle). They must
 * match the connectors' exported constants.
 */
export interface ParliamentTabledPaper {
  source_id: 'waternsw' | 'essential-energy' | 'forestry-corporation';
  fiscal_year: string;
  tabled_paper_id: string;
  title: string;
  /**
   * Publisher URL kept as row provenance. It is the official annual-report PDF
   * URL even when the bytes came from Parliament.
   */
  official_url: string;
  /** Exact NSW Parliament file-service artifact URL. */
  artifact_url: string;
  filename: string;
  sha256: string;
  bytes: number;
  /** False when Parliament tabled a different rendering of the same report. */
  byte_identical_to_official: boolean;
  note: string;
}

export const NSW_BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  accept: 'application/pdf,text/html;q=0.9,*/*;q=0.8',
} as const;

export const NSW_PARLIAMENT_TABLED_PAPERS: readonly ParliamentTabledPaper[] = [
  {
    source_id: 'waternsw',
    fiscal_year: '2024-25',
    tabled_paper_id: '192122',
    title: 'Annual Report 2024–25',
    official_url:
      'https://www.waternsw.com.au/documents/publications/general-publications/annual-reports/WaterNSW-Annual-Report-2024-2025.pdf',
    artifact_url:
      'https://files.parliament.nsw.gov.au/fileapi/ParlFiles/GetArtifact?serverRelativeUrl=%2Ftp%2Ffiles%2F192122%2FAttachment%20C1%20-%20WaterNSW%20Annual%20Report%202024-2025.pdf',
    filename: 'Attachment C1 - WaterNSW Annual Report 2024-2025.pdf',
    sha256: '6240e733e2d2e5562553a15398b1dbe63c8ab454b6fe78a9d5000f354f338b09',
    bytes: 42_917_371,
    byte_identical_to_official: true,
    note: 'NSW Parliament tabled-paper artifact (paper 192122). Its SHA-256 and byte length are identical to the official WaterNSW PDF; the publisher blocks the ingestion host.',
  },
  {
    source_id: 'essential-energy',
    fiscal_year: '2024-25',
    tabled_paper_id: '192060',
    title: 'Annual Report 2024–25',
    official_url:
      'https://www.essentialenergy.com.au/ext/ar2025/files/2025/11/Essential-Energy_Annual-Report_2024-25.pdf',
    artifact_url:
      'https://files.parliament.nsw.gov.au/fileapi/ParlFiles/GetArtifact?serverRelativeUrl=%2Ftp%2Ffiles%2F192060%2FAttachment%20D1%20-%20Essential%20Energy%20Annual%20Report%202024-25.pdf',
    filename: 'Attachment D1 - Essential Energy Annual Report 2024-25.pdf',
    sha256: '99953e63e91d669bca8b41068f22dc5a22c12cb3d85e6cf55e8f0e760257dfbf',
    bytes: 13_513_919,
    byte_identical_to_official: false,
    note: 'NSW Parliament tabled-paper artifact (paper 192060). Parliament tabled a different rendering (13,513,919 bytes) to the official-host PDF (19,147,042 bytes); the consolidated statement and every printed bridge reconcile to the same audited figures, so the statement lines are identical but the bytes are not.',
  },
  {
    source_id: 'forestry-corporation',
    fiscal_year: '2024-25',
    tabled_paper_id: '192061',
    title: 'Annual Report 2024–25',
    official_url:
      'https://www.forestrycorporation.com.au/__data/assets/pdf_file/0009/1650285/annual-report-2024-25.pdf',
    artifact_url:
      'https://files.parliament.nsw.gov.au/fileapi/ParlFiles/GetArtifact?serverRelativeUrl=%2Ftp%2Ffiles%2F192061%2Fforestry-corporation-nsw-annual-report-2024-25.pdf',
    filename: 'forestry-corporation-nsw-annual-report-2024-25.pdf',
    sha256: '18f9fa57718cd6177d505298d0fd214f897028b2db76e8a3e257376aa392be10',
    bytes: 6_448_775,
    byte_identical_to_official: true,
    note: 'NSW Parliament tabled-paper artifact (paper 192061). Its SHA-256 and byte length are identical to the official Forestry Corporation PDF; the publisher blocks the ingestion host.',
  },
];

/** Find the latest tabled paper for a source, preferring an exact fiscal year. */
export function findParliamentTabledPaper(
  sourceId: string,
  fiscalYear?: string,
): ParliamentTabledPaper | null {
  const forSource = NSW_PARLIAMENT_TABLED_PAPERS.filter((paper) => paper.source_id === sourceId);
  if (forSource.length === 0) return null;
  if (fiscalYear) {
    const exact = forSource.find((paper) => paper.fiscal_year === fiscalYear);
    if (exact) return exact;
  }
  return [...forSource].sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year))[0] ?? null;
}

export interface ParliamentFetchResult {
  paper: ParliamentTabledPaper;
  bytes: Buffer;
}

function looksLikePdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 4).toString('latin1') === '%PDF';
}

/**
 * Fetch and verify an NSW Parliament tabled-paper artifact. Returns null when
 * the source has no registry entry; throws when an entry exists but the bytes
 * do not match what was recorded (wrong/truncated document).
 */
export async function fetchParliamentTabledPaper(
  sourceId: string,
  fetchImpl: typeof fetch = globalThis.fetch,
  fiscalYear?: string,
): Promise<ParliamentFetchResult | null> {
  const paper = findParliamentTabledPaper(sourceId, fiscalYear);
  if (!paper) return null;

  const response = await fetchImpl(paper.artifact_url, {
    redirect: 'follow',
    headers: NSW_BROWSER_HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      `${paper.source_id} NSW Parliament artifact HTTP ${response.status} for ${paper.artifact_url}`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !/application\/pdf|application\/octet-stream/i.test(contentType)) {
    throw new Error(
      `${paper.source_id} NSW Parliament artifact returned content-type ${contentType}, expected application/pdf`,
    );
  }
  if (!looksLikePdf(bytes)) {
    throw new Error(`${paper.source_id} NSW Parliament artifact is not a PDF`);
  }
  if (paper.bytes > 0 && bytes.length !== paper.bytes) {
    throw new Error(
      `${paper.source_id} NSW Parliament artifact byte length ${bytes.length} does not match recorded ${paper.bytes}`,
    );
  }
  const digest = sha256Bytes(bytes);
  if (paper.sha256 && digest !== paper.sha256) {
    throw new Error(
      `${paper.source_id} NSW Parliament artifact SHA-256 ${digest} does not match recorded ${paper.sha256}`,
    );
  }
  return { paper, bytes };
}
