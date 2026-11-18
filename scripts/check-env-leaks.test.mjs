import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findViolations } from './check-env-leaks.mjs';

// Build the fixture values at runtime so this test file itself stays clean.
const HOME = ['', 'home'].join('/');
const privateHome = `${HOME}/alice`;
const resolverIp = ['1', '1', '1', '1'].join('.');
const deployFile = ['deploy', 'README.md'].join('/');

test('a newly committed absolute home path fails', () => {
  const found = findViolations([
    {
      file: 'docs/source-discovery/example.md',
      text: `archive: ${privateHome}/ausspend-source-archive/example/file.pdf`,
    },
  ]);

  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'absolute home directory');
  assert.equal(found[0].value.trim(), privateHome);
});

test('portable archive placeholders pass', () => {
  const found = findViolations([
    {
      file: 'docs/source-discovery/example.md',
      text: 'archive: ~/ausspend-source-archive/example/file.pdf\nplaceholder: <archive-root>/example',
    },
    {
      file: 'docs/source-discovery/example.json',
      text: '"local_path": "~/ausspend-source-archive/example/file.pdf"',
    },
  ]);

  assert.deepEqual(found, []);
});

test('the public allow-list only applies to its declared file', () => {
  assert.deepEqual(findViolations([{ file: deployFile, text: `resolver ${resolverIp}` }]), []);

  const found = findViolations([{ file: 'docs/example.md', text: `resolver ${resolverIp}` }]);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'public IPv4 presented as a host');
});
