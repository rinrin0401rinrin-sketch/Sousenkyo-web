import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertInside, assertSafeElectionId, root } from './data-utils.mjs';

const electionId = process.env.ELECTION_ID ?? '';
const manifestPath = process.env.MANIFEST_PATH ?? '';
const schemaPath = process.env.SCHEMA_PATH ?? '';
const stagedInputDir = process.env.STAGED_INPUT_DIR ?? '';

assertSafeElectionId(electionId);
assertAllowedExistingFile(manifestPath, ['data/import-schemas/'], 'MANIFEST_PATH');
assertAllowedExistingFile(schemaPath, ['data/import-schemas/'], 'SCHEMA_PATH');

if (stagedInputDir) {
  assertAllowedPath(stagedInputDir, ['data/imports/', 'data/source/'], 'STAGED_INPUT_DIR');
}

console.log(`Official pipeline inputs OK: ${electionId}`);

function assertAllowedExistingFile(path, prefixes, label) {
  const resolved = assertAllowedPath(path, prefixes, label);
  if (!existsSync(resolved)) throw new Error(`${label} does not exist: ${path}`);
  if (!resolved.endsWith('.json')) throw new Error(`${label} must be a JSON file: ${path}`);
}

function assertAllowedPath(path, prefixes, label) {
  if (!path || path.includes('\0')) throw new Error(`${label} is invalid`);
  const resolved = resolve(root, path);
  assertInside(root, resolved);
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '');
  if (normalized.startsWith('/') || normalized.includes('..')) {
    throw new Error(`${label} must be a repository-relative path without '..': ${path}`);
  }
  if (!prefixes.some((prefix) => normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix))) {
    throw new Error(`${label} must be inside ${prefixes.join(' or ')}: ${path}`);
  }
  return resolved;
}
