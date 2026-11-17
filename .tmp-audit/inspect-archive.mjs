import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = '/home/steve/ausspend-source-archive';
console.log('exists root:', root);
try {
  const entries = await readdir(root, { withFileTypes: true });
  for (const e of entries) console.log(e.isDirectory() ? 'DIR ' : 'FILE', e.name);
} catch (err) {
  console.log('root error:', err.message);
}
for (const id of ['northern-beaches-gpfs', 'parramatta-gpfs']) {
  const d = path.join(root, id);
  try {
    const entries = await readdir(d, { withFileTypes: true });
    console.log(`\n== ${id} ==`);
    for (const e of entries) console.log(e.isDirectory() ? 'DIR ' : 'FILE', e.name);
    const meta = entries.find((e) => e.name.endsWith('.meta.json'));
    if (meta) {
      const m = JSON.parse(await readFile(path.join(d, meta.name), 'utf8'));
      console.log('meta local_path:', m.local_path);
      console.log('meta sha256:', m.sha256);
    }
  } catch (err) {
    console.log(`\n== ${id} == error:`, err.message);
  }
}
