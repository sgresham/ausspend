import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceDocumentModel, type SourceDocumentDocument } from '../models/index.js';

/**
 * Reusable source-document archive.
 *
 * Every document we rely on is copied to a host directory *outside* the app
 * repository and identified by its SHA-256. The application repo only ever
 * holds metadata (a JSON manifest/record); the bytes never leave the archive
 * root. This is what makes an "alternate source" auditable months later.
 */

export type SourceArchivedFrom = 'wayback' | 'arcgis' | 'direct' | 'other';

export interface ArchivedSourceRecord {
  document_id: string;
  source_id: string;
  title: string;
  original_url: string;
  retrieved_from: string;
  archived_from: SourceArchivedFrom;
  local_path: string;
  sha256: string;
  bytes: number;
  content_type: string;
  fetched_at: string;
  last_modified: string | null;
  etag: string | null;
  hash_verified: boolean;
  notes?: string;
}

export interface ArchiveSourceOptions {
  source_id: string;
  title: string;
  original_url: string;
  /** Exact URL the bytes came from; defaults to original_url. */
  retrieved_from?: string;
  archived_from: SourceArchivedFrom;
  filename: string;
  content_type?: string;
  /** Archive root; defaults to AUSSPEND_SOURCE_ARCHIVE or ~/ausspend-source-archive. */
  root?: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  notes?: string;
  /** Adopt an already-downloaded local file instead of fetching/copying it. */
  from_path?: string;
  /** Use in-memory bytes instead of a network fetch (tests, CLI stdin). */
  data?: Uint8Array | string;
  document_id?: string;
  fetched_at?: Date;
  max_bytes?: number;
}

export interface VerifyResult {
  ok: boolean;
  sha256: string;
  bytes: number;
  problems: string[];
}

export const SOURCE_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/i;
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

export function repoRoot(): string {
  return path.resolve(
    process.env.AUSSPEND_REPO_ROOT ?? fileURLToPath(new URL('../../../', import.meta.url)),
  );
}

export function sourceArchiveRoot(root?: string): string {
  return path.resolve(
    root ?? process.env.AUSSPEND_SOURCE_ARCHIVE ?? path.join(homedir(), 'ausspend-source-archive'),
  );
}

export function sha256Bytes(input: Uint8Array | string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

export function safeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^A-Za-z0-9._-]+/g, '-');
  const trimmed = base.replace(/^[-.]+/, '');
  if (!trimmed || trimmed === '.' || trimmed === '..') {
    throw new Error(`unsafe source filename: ${JSON.stringify(filename)}`);
  }
  return trimmed;
}

function assertSourceId(sourceId: string): void {
  if (!SOURCE_ID_REGEX.test(sourceId)) {
    throw new Error(`invalid source_id ${JSON.stringify(sourceId)} (expected ${SOURCE_ID_REGEX})`);
  }
}

/** Refuse any archive path inside the application repo. */
export function assertOutsideRepo(
  localPath: string,
  forbiddenRoots: string[] = [repoRoot()],
): void {
  const resolved = path.resolve(localPath);
  for (const forbidden of forbiddenRoots) {
    const root = path.resolve(forbidden);
    if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error(
        `source archive path ${resolved} is inside the application repo (${root}); ` +
          'archive bytes must live outside the repo',
      );
    }
  }
}

export function inferContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.geojson': 'application/geo+json',
    '.pdf': 'application/pdf',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
  };
  return types[ext] ?? 'application/octet-stream';
}

export function sourceDocumentId(sourceId: string, sha256: string): string {
  return `${sourceId}:${sha256.slice(0, 24)}`;
}

function recordPath(root: string, sourceId: string, documentId: string): string {
  const safeId = documentId.replace(/[^A-Za-z0-9._-]+/g, '-');
  return path.join(root, sourceId, 'records', `${safeId}.json`);
}

async function writeRecord(root: string, record: ArchivedSourceRecord): Promise<void> {
  const target = recordPath(root, record.source_id, record.document_id);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(record, null, 2)}\n`);
}

async function hashAndSize(filePath: string): Promise<{ sha256: string; bytes: number }> {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error(`source archive path is not a file: ${filePath}`);
  return { sha256: await sha256File(filePath), bytes: info.size };
}

/**
 * Download (or adopt) a source document into the archive.
 *
 * - `from_path` adopts an existing copy **without moving or mutating it** (used
 *   to reference S1's already-downloaded NSW XLSX/ArcGIS JSON).
 * - `data` writes supplied bytes into the archive.
 * - otherwise the document is fetched from `retrieved_from ?? original_url`.
 */
export async function archiveSourceDocument(
  options: ArchiveSourceOptions,
): Promise<ArchivedSourceRecord> {
  assertSourceId(options.source_id);
  const root = sourceArchiveRoot(options.root);
  const filename = safeFilename(options.filename);
  const dir = path.join(root, options.source_id);
  const localPathCandidate = path.join(dir, filename);
  assertOutsideRepo(localPathCandidate);

  let localPath = localPathCandidate;
  let lastModified: string | null = null;
  let etag: string | null = null;
  let contentType = options.content_type ?? inferContentType(filename);
  let fetchedAt = options.fetched_at ?? new Date();

  if (options.from_path) {
    localPath = path.resolve(options.from_path);
    assertOutsideRepo(localPath);
    const info = await stat(localPath);
    if (info.size > (options.max_bytes ?? DEFAULT_MAX_BYTES)) {
      throw new Error(`source document ${localPath} exceeds max_bytes`);
    }
    lastModified ??= info.mtime.toISOString();
  } else if (options.data !== undefined) {
    const bytes =
      typeof options.data === 'string' ? Buffer.from(options.data) : Buffer.from(options.data);
    if (bytes.length > (options.max_bytes ?? DEFAULT_MAX_BYTES)) {
      throw new Error(`source document ${filename} exceeds max_bytes`);
    }
    await mkdir(dir, { recursive: true });
    await writeFile(localPath, bytes);
  } else {
    const url = options.retrieved_from ?? options.original_url;
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: options.headers,
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`source fetch HTTP ${response.status} for ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > (options.max_bytes ?? DEFAULT_MAX_BYTES)) {
      throw new Error(`source document ${filename} exceeds max_bytes`);
    }
    await mkdir(dir, { recursive: true });
    await writeFile(localPath, bytes);
    lastModified =
      response.headers.get('last-modified') ??
      response.headers.get('x-archive-orig-last-modified') ??
      null;
    etag = response.headers.get('etag') ?? response.headers.get('x-archive-orig-etag') ?? null;
    contentType = options.content_type ?? response.headers.get('content-type') ?? contentType;
    fetchedAt = options.fetched_at ?? new Date();
  }

  const { sha256, bytes } = await hashAndSize(localPath);
  const record: ArchivedSourceRecord = {
    document_id: options.document_id ?? sourceDocumentId(options.source_id, sha256),
    source_id: options.source_id,
    title: options.title,
    original_url: options.original_url,
    retrieved_from: options.retrieved_from ?? options.original_url,
    archived_from: options.archived_from,
    local_path: localPath,
    sha256,
    bytes,
    content_type: contentType,
    fetched_at: fetchedAt.toISOString(),
    last_modified: lastModified,
    etag,
    hash_verified: true,
    ...(options.notes ? { notes: options.notes } : {}),
  };

  // Metadata-only sidecar under our archive root; adopted files are untouched.
  await writeRecord(root, record);
  if (!options.from_path) {
    await writeFile(`${localPath}.meta.json`, `${JSON.stringify(record, null, 2)}\n`);
  }
  return record;
}

/** Re-hash an archived document and confirm it still matches its record. */
export async function verifySourceDocument(
  record: Pick<ArchivedSourceRecord, 'local_path' | 'sha256' | 'bytes'>,
): Promise<VerifyResult> {
  const problems: string[] = [];
  let actualSha = '';
  let actualBytes = 0;
  try {
    const actual = await hashAndSize(record.local_path);
    actualSha = actual.sha256;
    actualBytes = actual.bytes;
    if (actual.sha256 !== record.sha256) {
      problems.push(`sha256 mismatch: expected ${record.sha256}, got ${actual.sha256}`);
    }
    if (actual.bytes !== record.bytes) {
      problems.push(`byte length mismatch: expected ${record.bytes}, got ${actual.bytes}`);
    }
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }
  return { ok: problems.length === 0, sha256: actualSha, bytes: actualBytes, problems };
}

/** Read a document's bytes for extraction; verifies the hash first. */
export async function readArchivedDocument(
  record: Pick<ArchivedSourceRecord, 'local_path' | 'sha256' | 'bytes'>,
): Promise<Buffer> {
  const check = await verifySourceDocument(record);
  if (!check.ok) {
    throw new Error(`archived document failed verification: ${check.problems.join('; ')}`);
  }
  return readFile(record.local_path);
}

/** List records written under the archive root (metadata only, no DB needed). */
export async function listArchivedRecords(
  options: { root?: string; source_id?: string } = {},
): Promise<ArchivedSourceRecord[]> {
  const root = sourceArchiveRoot(options.root);
  const sourceIds = options.source_id
    ? [options.source_id]
    : await readdir(root, { withFileTypes: true })
        .then((entries) =>
          entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
        )
        .catch((): string[] => []);
  const records: ArchivedSourceRecord[] = [];
  for (const sourceId of sourceIds) {
    const dir = path.join(root, sourceId, 'records');
    let files: string[];
    try {
      files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        records.push(
          JSON.parse(await readFile(path.join(dir, file), 'utf8')) as ArchivedSourceRecord,
        );
      } catch {
        // Ignore a partially-written metadata file; verify/refetch will fix it.
      }
    }
  }
  return records;
}

/** Upsert archive metadata into MongoDB (`source_documents`). Never touches measures. */
export async function persistArchivedRecord(
  record: ArchivedSourceRecord,
): Promise<SourceDocumentDocument> {
  const doc = await SourceDocumentModel.findOneAndUpdate(
    { document_id: record.document_id },
    {
      $set: {
        source_id: record.source_id,
        title: record.title,
        original_url: record.original_url,
        retrieved_from: record.retrieved_from,
        archived_from: record.archived_from,
        local_path: record.local_path,
        sha256: record.sha256,
        bytes: record.bytes,
        content_type: record.content_type,
        fetched_at: new Date(record.fetched_at),
        last_modified: record.last_modified,
        etag: record.etag,
        hash_verified: record.hash_verified,
        notes: record.notes,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  if (!doc) throw new Error(`failed to persist source document ${record.document_id}`);
  return doc;
}
