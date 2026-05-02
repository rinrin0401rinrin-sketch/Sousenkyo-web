import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';

export const root = process.cwd();
export const publicDataRoot = join(root, 'public', 'data');
export const sourceRoot = join(root, 'data', 'source', 'elections');

export const electionFiles = [
  'election-meta.json',
  'parties.json',
  'members.json',
  'prefectures.json',
  'districts.json',
  'proportional-blocks.json',
  'summary.json',
  'candidates.json',
  'single-member-districts.json',
  'results.json',
];

export const topLevelFiles = ['active-election.json', 'elections-index.json'];

export function assertSafeElectionId(electionId) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(electionId)) {
    throw new Error(`Invalid electionId: ${electionId}`);
  }
}

export function assertInside(baseDir, targetPath) {
  const base = resolve(baseDir);
  const target = resolve(targetPath);
  if (target !== base && !target.startsWith(`${base}/`)) {
    throw new Error(`Refusing to write outside ${relative(root, baseDir)}: ${targetPath}`);
  }
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${stableStringify(value)}\n`);
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value), null, 2);
}

export function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((next, key) => {
        next[key] = sortValue(value[key]);
        return next;
      }, {});
  }

  return value;
}

export function sourceFileFor(electionId) {
  assertSafeElectionId(electionId);
  return join(sourceRoot, electionId, 'election.json');
}

export function publicElectionDir(electionId) {
  assertSafeElectionId(electionId);
  return join(publicDataRoot, electionId);
}

export function ensureSourceShape(source, electionId) {
  if (!source || typeof source !== 'object') {
    throw new Error('Source must be a JSON object');
  }

  if (!source.election || typeof source.election !== 'object') {
    throw new Error('Source must include an election object');
  }

  if (source.election.id !== electionId) {
    throw new Error(`Source election.id (${source.election.id}) must match ${electionId}`);
  }

  for (const fileName of electionFiles) {
    if (!source.files || !(fileName in source.files)) {
      throw new Error(`Source missing files.${fileName}`);
    }
  }
}

export function readOptionalJson(path) {
  return existsSync(path) ? readJson(path) : undefined;
}

export function toDisplayPath(path) {
  return normalize(relative(root, path));
}
