#!/usr/bin/env node
/**
 * Fail the build if environment-specific values are committed to this public
 * repository. The allow-list is explicit: a public example is only permitted
 * with a written reason and (where relevant) a file scope.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALLOW = [
  {
    ip: '1.1.1.1',
    file: 'deploy/README.md',
    reason: 'Public DNS resolver example, not this deployment.',
  },
  {
    ip: '131.0.0.0',
    file: 'scripts/*-browser.ts',
    reason: 'Illustrative /8 network prefix in a Playwright proxy bypass list, not a host.',
  },
  {
    ip: '131.0.0.0',
    file: 'scripts/check-env-leaks.mjs',
    reason: "The guard's own allow-list example.",
  },
  {
    ip: '1.1.1.1',
    file: 'scripts/check-env-leaks.mjs',
    reason: "The guard's own public-resolver allow-list example.",
  },
  {
    ip: '131.0.0.0',
    file: 'server/src/connectors/hornsby-gpfs/browser.ts',
    reason: 'Chrome major-version token in a public User-Agent string, not a host.',
  },
];

const PRIVATE_IPV4 =
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g;
const KNOWN_PUBLIC = /\b(?:180\.150\.4\.132|103\.42\.108\.46|104\.21\.46\.135)\b/g;
const PUBLIC_IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const HOME_PATH = /(?:^|[^\w])\/(?:home|Users)\/[A-Za-z0-9._-]+/g;
const HOST_Q = /\bhost\s+`?q`?\b/gi;
const INTERNAL_PATHS = /(?:\/opt\/ausspend|\/srv\/ausspend|\/etc\/nginx\/tls)/g;

const LIBRARY_ALLOW = new Set(['127.0.0.1', '0.0.0.0']);

function isPrivate(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => part > 255)) return false;
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function fileMatches(file, pattern) {
  if (!pattern.includes('*')) return file === pattern;
  const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return re.test(file);
}

function allowed(ip, file) {
  return ALLOW.some(
    (entry) =>
      entry.ip === ip &&
      (entry.file === undefined || fileMatches(file, entry.file)) &&
      entry.reason,
  );
}

function extensionSkip(file) {
  return /\.(?:png|jpe?g|gif|webp|pdf|xlsx?|zip|woff2?|ico|mp4|mov|bin)$/i.test(file);
}

/**
 * Check `{ file, text }` entries and return unique violations. Pure so the test
 * fixture can prove a new absolute home path fails without touching the tree.
 */
export function findViolations(entries) {
  const violations = [];

  function check(file, text) {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      const add = (kind, value) => {
        violations.push({ file, line: index + 1, kind, value, text: line.trim().slice(0, 180) });
      };
      for (const match of line.matchAll(PRIVATE_IPV4)) add('RFC1918 IPv4', match[0]);
      for (const match of line.matchAll(KNOWN_PUBLIC)) add('known deployment/public IP', match[0]);
      for (const match of line.matchAll(PUBLIC_IPV4)) {
        const ip = match[0];
        if (LIBRARY_ALLOW.has(ip) || isPrivate(ip)) continue;
        if (allowed(ip, file)) continue;
        add('public IPv4 presented as a host', ip);
      }
      for (const match of line.matchAll(HOME_PATH)) add('absolute home directory', match[0]);
      for (const match of line.matchAll(HOST_Q)) add('placeholder host name', match[0]);
      if (!file.endsWith('.template')) {
        for (const match of line.matchAll(INTERNAL_PATHS)) add('internal absolute path', match[0]);
      }
    });
  }

  for (const { file, text } of entries) {
    if (text.includes('\0')) continue;
    check(file, text);
  }

  return [
    ...new Map(violations.map((v) => [`${v.file}:${v.line}:${v.kind}:${v.value}`, v])).values(),
  ];
}

function main() {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  const files = [...new Set([...tracked, ...untracked])].filter((file) => !extensionSkip(file));

  const entries = [];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    entries.push({ file, text });
  }

  const unique = findViolations(entries);
  if (unique.length === 0) {
    console.log(`[check-env-leaks] PASS (${files.length} tracked text files)`);
    process.exit(0);
  }
  console.error(`[check-env-leaks] FAIL (${unique.length} violation(s))`);
  for (const v of unique.slice(0, 100)) {
    console.error(`${v.file}:${v.line} ${v.kind} ${JSON.stringify(v.value)} :: ${v.text}`);
  }
  if (unique.length > 100) console.error(`... ${unique.length - 100} more`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
