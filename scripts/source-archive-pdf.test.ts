import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  moneyToCents,
  detectMoneyUnit,
  extractPdf,
  parseAmountCell,
} from '../server/src/connectors/pdf-extract.js';
import {
  archiveSourceDocument,
  assertOutsideRepo,
  listArchivedRecords,
  readArchivedDocument,
  repoRoot,
  sha256Bytes,
  verifySourceDocument,
} from '../server/src/connectors/source-archive.js';

/**
 * Foundation tests. They live under scripts/ because server/test/ is outside
 * this item's declared areas; run with `npm run test:foundation`.
 */

function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

interface PdfLine {
  x: number;
  y: number;
  text: string;
}

/** Build a tiny valid PDF with positioned Helvetica text — no fixture blob committed. */
function buildTablePdf(lines: PdfLine[]): Buffer {
  const content = [
    'BT',
    ...lines.map((line) => `/F1 11 Tf 1 0 0 1 ${line.x} ${line.y} Tm (${escapePdf(line.text)}) Tj`),
    'ET',
  ];
  const stream = content.join('\n');
  const objects: Record<number, string> = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    4: `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    5: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  };
  let pdf = '%PDF-1.4\n';
  const offsets: Record<number, number> = {};
  for (let i = 1; i <= 5; i += 1) {
    offsets[i] = Buffer.byteLength(pdf);
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function tablePdf(options: {
  unitLine?: string;
  totalColumn?: string;
  rows: Array<{ label: string; values: [string, string, string] }>;
}): Buffer {
  const lines: PdfLine[] = [
    { x: 60, y: 750, text: 'Program' },
    { x: 240, y: 750, text: '2023-24' },
    { x: 340, y: 750, text: '2024-25' },
    { x: 440, y: 750, text: options.totalColumn ?? 'Total' },
  ];
  if (options.unitLine) lines.push({ x: 60, y: 735, text: options.unitLine });
  let y = options.unitLine ? 710 : 720;
  for (const row of options.rows) {
    lines.push({ x: 60, y, text: row.label });
    lines.push({ x: 240, y, text: row.values[0] });
    lines.push({ x: 340, y, text: row.values[1] });
    lines.push({ x: 440, y, text: row.values[2] });
    y -= 15;
  }
  return buildTablePdf(lines);
}

const goodRows = [
  { label: 'Health', values: ['1,200', '1,300', '2,500'] as [string, string, string] },
  { label: 'Education', values: ['800', '900', '1,700'] as [string, string, string] },
  { label: 'Total', values: ['2,000', '2,200', '4,200'] as [string, string, string] },
];

test('unit detection: $000 is thousands, bare/absent units are refused', () => {
  const thousands = detectMoneyUnit(['Program 2023-24 2024-25 Total', "($'000)"]);
  assert.equal(thousands.kind, 'thousands');
  assert.equal(thousands.ambiguous, false);
  assert.equal(thousands.multiplier_to_cents, 100_000);

  const dollars = detectMoneyUnit(['Amount ($)']);
  assert.equal(dollars.kind, 'dollars');

  const missing = detectMoneyUnit(['Program', '2023-24', 'Total']);
  assert.equal(missing.kind, null);
  assert.equal(missing.ambiguous, true);

  const conflicting = detectMoneyUnit(["Amount ($'000)", 'Total ($m)']);
  assert.equal(conflicting.kind, null);
  assert.equal(conflicting.ambiguous, true);
});

test("currency conversion is explicit: $'000 differs from dollars by 1000x", () => {
  assert.equal(moneyToCents(2500, 'thousands'), 250_000_000);
  assert.equal(moneyToCents(2500, 'dollars'), 250_000);
  assert.equal(moneyToCents(2500, 'thousands') / moneyToCents(2500, 'dollars'), 1000);
});

test('numeric cells: commas, parentheses and nil markers', () => {
  assert.equal(parseAmountCell('1,200').value, 1200);
  assert.equal(parseAmountCell('(350)').value, -350);
  assert.equal(parseAmountCell('-').value, null);
  assert.equal(parseAmountCell('').value, null);
  assert.ok(parseAmountCell('1,20x').error);
});

test('extracts a $000 table and reconciles row + column totals', async () => {
  const extraction = await extractPdf(tablePdf({ unitLine: "($'000)", rows: goodRows }));
  assert.equal(extraction.tables.length, 1);
  const table = extraction.tables[0];
  assert.ok(table);
  assert.equal(table.unit.kind, 'thousands');
  assert.equal(table.header[0], 'Program');
  assert.equal(table.rows.length, 3);
  assert.equal(table.totals_verified, true);
  assert.equal(table.extraction_confidence, 'high');
  assert.equal(table.valid, true);
  assert.equal(table.ingestable, true);
  assert.equal(table.checks.filter((check) => check.ok).length, table.checks.length);

  const health = table.rows.find((row) => row.label === 'Health');
  assert.ok(health);
  assert.equal(health.data_quality_flag, 'provisional');
  assert.equal(health.amounts_cents[1], 1200 * 1000 * 100);
  // The 1000x error is impossible to make silently: the value is $'000, not dollars.
  assert.notEqual(health.amounts_cents[1], 1200 * 100);
  assert.equal(health.amounts_cents[1], moneyToCents(1200, 'thousands'));
});

test('rejects a table whose row total does not reconcile', async () => {
  const rows = [
    { label: 'Health', values: ['1,200', '1,300', '2,600'] as [string, string, string] },
    { label: 'Education', values: ['800', '900', '1,700'] as [string, string, string] },
    { label: 'Total', values: ['2,000', '2,200', '4,200'] as [string, string, string] },
  ];
  const extraction = await extractPdf(tablePdf({ unitLine: "($'000)", rows }));
  const table = extraction.tables[0];
  assert.ok(table);
  assert.equal(table.valid, false);
  assert.equal(table.ingestable, false);
  assert.equal(table.extraction_confidence, 'low');
  assert.ok(table.checks.some((check) => !check.ok));
  assert.ok(table.errors.some((error) => /mismatch/.test(error)));
});

test('rejects a total row that disagrees with its own columns', async () => {
  const rows = [
    { label: 'Health', values: ['1,200', '1,300', '2,500'] as [string, string, string] },
    { label: 'Education', values: ['800', '900', '1,700'] as [string, string, string] },
    { label: 'Total', values: ['2,000', '2,200', '4,100'] as [string, string, string] },
  ];
  const extraction = await extractPdf(tablePdf({ unitLine: "($'000)", rows }));
  const table = extraction.tables[0];
  assert.ok(table);
  assert.equal(table.ingestable, false);
  assert.ok(table.errors.some((error) => /mismatch/.test(error)));
});

test('refuses to assume dollars when the unit header is absent', async () => {
  const extraction = await extractPdf(tablePdf({ rows: goodRows }));
  const table = extraction.tables[0];
  assert.ok(table);
  assert.equal(table.unit.kind, null);
  assert.equal(table.unit.ambiguous, true);
  assert.equal(table.ingestable, false);
  assert.equal(table.extraction_confidence, 'low');
  assert.ok(table.errors.some((error) => /explicit unit/.test(error)));
});

test('archive round-trip: write bytes, re-hash, read back, detect tampering', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'ausspend-archive-'));
  const bytes = 'governments publish tables that must be auditable';
  const record = await archiveSourceDocument({
    source_id: 'test-source',
    title: 'Test document',
    original_url: 'https://example.test/report.txt',
    retrieved_from: 'https://example.test/report.txt',
    archived_from: 'direct',
    filename: 'report.txt',
    data: bytes,
    root,
  });
  assert.equal(record.sha256, sha256Bytes(bytes));
  assert.equal(record.bytes, Buffer.byteLength(bytes));
  assert.equal(record.local_path.startsWith(root), true);

  const verified = await verifySourceDocument(record);
  assert.equal(verified.ok, true);
  assert.equal(verified.sha256, record.sha256);

  const readBack = await readArchivedDocument(record);
  assert.equal(readBack.toString(), bytes);

  const listed = await listArchivedRecords({ root, source_id: 'test-source' });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.document_id, record.document_id);

  await writeFile(record.local_path, 'tampered');
  const tampered = await verifySourceDocument(record);
  assert.equal(tampered.ok, false);
  assert.ok(tampered.problems.some((problem) => /sha256 mismatch/.test(problem)));
});

test('archive refuses paths inside the application repo', () => {
  assert.throws(
    () => assertOutsideRepo(path.join(repoRoot(), 'docs', 'evil.bin')),
    /inside the application repo/,
  );
});

test('S1 Wayback XLSX + ArcGIS JSON match the committed manifest (read-only)', async (t) => {
  const manifestPath = path.join(repoRoot(), 'docs', 'source-archive', 'nsw-budget-2025-26.json');
  const fromDir = path.join(homedir(), '.cache', 'ausspend', 'nsw-budget', '2025-26');
  if (!existsSync(manifestPath) || !existsSync(fromDir)) {
    t.skip('S1 archive cache not present on this host');
    return;
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    files: Array<{
      filename: string;
      source_url: string;
      snapshot_url: string;
      sha256: string;
      bytes: number;
    }>;
    arcgis: { layer: string; query_url: string; sha256: string; bytes: number };
  };
  const root = await mkdtemp(path.join(tmpdir(), 'ausspend-s1-adopt-'));
  const financial = manifest.files.find((file) => file.filename.includes('Financial-Statements'));
  assert.ok(financial, 'financial statements workbook present in manifest');

  const xlsx = await archiveSourceDocument({
    source_id: 'nsw-budget-test',
    title: 'S1 Wayback XLSX',
    original_url: financial.source_url,
    retrieved_from: financial.snapshot_url,
    archived_from: 'wayback',
    filename: financial.filename,
    from_path: path.join(fromDir, financial.filename),
    root,
  });
  assert.equal(xlsx.sha256, financial.sha256);
  assert.equal(xlsx.bytes, financial.bytes);
  assert.equal((await verifySourceDocument(xlsx)).ok, true);

  const arcgisPath = path.join(fromDir, 'arcgis-capital-projects.json');
  const arcgis = await archiveSourceDocument({
    source_id: 'nsw-budget-test',
    title: 'S1 ArcGIS capital projects',
    original_url: manifest.arcgis.query_url,
    retrieved_from: manifest.arcgis.query_url,
    archived_from: 'arcgis',
    filename: 'arcgis-capital-projects.json',
    from_path: arcgisPath,
    root,
  });
  assert.equal(arcgis.sha256, manifest.arcgis.sha256);
  assert.equal(arcgis.bytes, manifest.arcgis.bytes);
  assert.equal((await verifySourceDocument(arcgis)).ok, true);

  const outsideRepo = await listArchivedRecords({ root });
  assert.equal(outsideRepo.length, 2);
});
