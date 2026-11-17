import mongoose from 'mongoose';

process.env.AUSSPEND_SOURCE_ARCHIVE = '/home/steve/ausspend-source-archive';
process.env.MONGO_URL = 'mongodb://10.10.10.30:27017/ausspend_dev';

const { getConnector, runIngestion } = await import('../server/src/connectors/index.js');
const { readFile, readdir } = await import('node:fs/promises');
const path = await import('node:path');

await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 5_000 });
const db = mongoose.connection.db!;
const before = await db.collection('measures').countDocuments({});
const beforeCb = await db.collection('measures').countDocuments({ source_id: 'canterbury-bankstown-gpfs' });

const connector = getConnector('canterbury-bankstown-gpfs')!;
const result = await runIngestion({ connectors: [connector] });

const after = await db.collection('measures').countDocuments({});
const afterCb = await db.collection('measures').countDocuments({ source_id: 'canterbury-bankstown-gpfs' });
const sample = await db
  .collection('measures')
  .findOne({ source_id: 'canterbury-bankstown-gpfs' }, { projection: { _id: 0, notes: 1 } });

const dir = '/home/steve/ausspend-source-archive/canterbury-bankstown-gpfs';
const files = await readdir(dir);
const meta = JSON.parse(
  await readFile(
    path.join(dir, 'canterbury-bankstown-financial-statements-2024-25.pdf.meta.json'),
    'utf8',
  ),
);

console.log(
  JSON.stringify(
    {
      before,
      beforeCb,
      after,
      afterCb,
      result: result.results,
      files,
      meta_local_path: meta.local_path,
      meta_sha256: meta.sha256,
      meta_bytes: meta.bytes,
      note_has_persistent_path: sample?.notes?.includes('/home/steve/ausspend-source-archive/'),
    },
    null,
    2,
  ),
);
await mongoose.disconnect();
process.exit(0);
