import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'sousenkyo-fetch-test-'));
const fetcher = join(root, 'scripts', 'fetch-official-data.mjs');

try {
  expectFailure(
    'URL without allowlist',
    {
      electionId: 'shugiin-50th',
      files: [{ name: 'x.csv', url: 'https://example.com/x.csv' }],
    },
    ['--dry-run'],
    'allowlist',
  );

  expectFailure(
    'http URL',
    {
      electionId: 'shugiin-50th',
      allowedHosts: ['example.com'],
      files: [{ name: 'x.csv', url: 'http://example.com/x.csv' }],
    },
    ['--dry-run'],
    'https',
  );

  expectFailure(
    'disallowed host',
    {
      electionId: 'shugiin-50th',
      allowedHosts: ['www.soumu.go.jp'],
      files: [{ name: 'x.csv', url: 'https://example.com/x.csv' }],
    },
    ['--dry-run'],
    'not allowed',
  );

  expectFailure(
    'unsafe output name',
    {
      electionId: 'shugiin-50th',
      files: [{ name: '../x.csv', path: resolve(root, 'data/source/elections/shugiin-50th/csv/top_level_active.csv') }],
    },
    ['--dry-run'],
    'Invalid output file name',
  );

  const outsideFile = join(tempDir, 'outside.csv');
  writeFileSync(outsideFile, 'id\noutside\n');
  expectFailure(
    'local path outside data source',
    {
      electionId: 'shugiin-50th',
      files: [{ name: 'outside.csv', path: outsideFile }],
    },
    ['--dry-run'],
    'Refusing to write outside',
  );

  expectFailure(
    'sha256 mismatch',
    {
      electionId: 'shugiin-50th',
      files: [
        {
          name: 'top_level_active.csv',
          path: resolve(root, 'data/source/elections/shugiin-50th/csv/top_level_active.csv'),
          sha256: '0'.repeat(64),
        },
      ],
    },
    [],
    'sha256 mismatch',
  );

  const receipt = expectSuccess('local receipt', {
    electionId: 'shugiin-50th',
    files: [{ name: 'top_level_active.csv', path: resolve(root, 'data/source/elections/shugiin-50th/csv/top_level_active.csv') }],
  });
  const firstFile = receipt.files?.[0];
  if (!firstFile?.sha256 || typeof firstFile.bytes !== 'number' || !firstFile.output) {
    throw new Error('local receipt must include sha256, bytes, and output');
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log('fetch-official-data security tests OK');

function manifestPath(name, value) {
  const path = join(tempDir, `${name}.json`);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

function runManifest(name, value, extraArgs = []) {
  const path = manifestPath(name.replaceAll(/\W+/g, '-'), value);
  return execFileSync(process.execPath, [fetcher, `--manifest=${path}`, ...extraArgs], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function expectFailure(name, manifest, extraArgs, expectedText) {
  try {
    runManifest(name, manifest, extraArgs);
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    if (output.includes(expectedText)) return;
    throw new Error(`${name}: expected failure containing "${expectedText}", got:\n${output}`);
  }
  throw new Error(`${name}: expected command to fail`);
}

function expectSuccess(name, manifest) {
  const output = runManifest(name, manifest);
  const match = output.match(/Receipt written: (.+)$/m);
  if (!match) throw new Error(`${name}: receipt path was not printed`);
  const receiptPath = join(root, match[1]);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  rmSync(resolve(root, receipt.rawDir, '..'), { recursive: true, force: true });
  return receipt;
}
