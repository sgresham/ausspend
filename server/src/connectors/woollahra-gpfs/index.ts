import { readFile } from 'node:fs/promises';
import type { SpendingRecord } from '@ausspend/shared';
import { extractPdf, type PdfExtraction } from '../pdf-extract.js';
import { fetchPdfHeadless } from '../soc/nsw/headless.js';
import {
  archiveSourceDocument,
  verifySourceDocument,
  type ArchivedSourceRecord,
} from '../source-archive.js';
import type { RawRecord } from '../types.js';
import { createGpfsConnector } from '../gpfs/engine.js';
import {
  parseWoollahraGpfsExtraction,
  type WoollahraDocument,
  type WoollahraParseContext,
} from './parse.js';
import {
  WOOLLAHRA_GPFS_ID,
  WOOLLAHRA_GPFS_META,
  WOOLLAHRA_GPFS_PDF_URL,
  WOOLLAHRA_GPFS_REPORTING_URL,
} from './meta.js';

export * from './parse.js';
export * from './meta.js';
export * from './config.js';

export interface WoollahraGpfsConnectorOptions {
  fetchImpl?: typeof fetch;
  archiveRoot?: string;
  pdfPath?: string;
  document?: WoollahraDocument;
  extraction?: PdfExtraction;
  archive?: WoollahraParseContext['archive'];
  now?: () => Date;
}

const DOCUMENT: WoollahraDocument = {
  id: 'gpfs-2024-25',
  title: 'Woollahra Municipal Council General Purpose Financial Statements 2024-2025',
  url: WOOLLAHRA_GPFS_PDF_URL,
  fiscal_year: '2024-25',
  listing_url: WOOLLAHRA_GPFS_REPORTING_URL,
};

export function createWoollahraGpfsConnector(
  options: WoollahraGpfsConnectorOptions = {},
): import('../types.js').Connector {
  const metadata = {
    lastFetchedAt: null as string | null,
    recordsIngested: 0,
    errors: [] as string[],
    warnings: [] as string[],
  };

  return createGpfsConnector({
    meta: WOOLLAHRA_GPFS_META,
    notes:
      "Woollahra Municipal Council audited FY2024-25 General Purpose Financial Statements (Annual Report Part 3). The PDF is published on the council's Annual Report page; the exact bytes are SHA-256 archived outside the repo. Unit is explicit $'000. Total revenue, total expenses and net result are printed totals; B1-1 function expenses are printed and reconcile to the B1-1 total. Every row is non-additive agency_detail with no region/LGA allocation and is never summed with another council or state row.",
    metadata,
    async fetch(): Promise<RawRecord[]> {
      metadata.warnings = [];
      metadata.errors = [];
      let extraction = options.extraction;
      let archive = options.archive;
      if (!extraction) {
        const bytes = options.pdfPath
          ? await readFile(options.pdfPath)
          : await fetchPdfHeadless(WOOLLAHRA_GPFS_PDF_URL, WOOLLAHRA_GPFS_REPORTING_URL);
        const archived: ArchivedSourceRecord = await archiveSourceDocument({
          source_id: WOOLLAHRA_GPFS_ID,
          title: DOCUMENT.title,
          original_url: WOOLLAHRA_GPFS_PDF_URL,
          retrieved_from: WOOLLAHRA_GPFS_PDF_URL,
          archived_from: 'direct',
          filename:
            'woollahra-annual-report-2024-25-part-3-general-purpose-financial-statements.pdf',
          content_type: 'application/pdf',
          data: bytes,
          ...(options.archiveRoot ? { root: options.archiveRoot } : {}),
          ...(options.now ? { fetched_at: options.now() } : {}),
          notes:
            'Woollahra Municipal Council audited FY2024-25 GPFS (Annual Report Part 3); archived outside the repo, not redistributed.',
        });
        await verifySourceDocument(archived);
        archive = {
          local_path: archived.local_path,
          sha256: archived.sha256,
          bytes: archived.bytes,
          fetched_at: archived.fetched_at,
        };
        extraction = await extractPdf(bytes);
      }
      if (!archive) throw new Error('Woollahra GPFS archive metadata unavailable');
      const context: WoollahraParseContext = {
        document: options.document ?? DOCUMENT,
        archive,
        sourceDate: archive.fetched_at.slice(0, 10),
        reporting_url: WOOLLAHRA_GPFS_REPORTING_URL,
      };
      const parsed = parseWoollahraGpfsExtraction(extraction, context);
      metadata.warnings.push(...parsed.warnings);
      if (parsed.records.length === 0) {
        metadata.errors.push(
          parsed.rejections.map((rejection) => rejection.reason).join('; ') ||
            'no validated GPFS rows extracted',
        );
      }
      return parsed.records.map((record) => ({ kind: 'woollahra-gpfs-measure', record }));
    },
    transform(raw: readonly RawRecord[]): SpendingRecord[] {
      const records: SpendingRecord[] = [];
      for (const entry of raw) {
        if (
          entry.kind !== 'woollahra-gpfs-measure' ||
          typeof entry.record !== 'object' ||
          entry.record === null
        ) {
          metadata.errors.push('raw entry is not a Woollahra GPFS measure; skipped');
          continue;
        }
        records.push(entry.record as SpendingRecord);
      }
      return records;
    },
  });
}

/** Discovered by scripts/generate-connector-manifest.mjs. */
export const connectorModule = {
  id: 'woollahra-gpfs',
  create: createWoollahraGpfsConnector,
} as const;
