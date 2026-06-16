import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assertInside, assertSafeElectionId, publicDataRoot, readJson, root, toDisplayPath } from './data-utils.mjs';

const args = process.argv.slice(2);
const failOnDiff = args.includes('--fail-on-diff');
const electionId = readOption('--election') ?? readOption('--election-id') ?? args.find((arg) => !arg.startsWith('--'));
const officialPath = readOption('--official') ?? readOption('--input');

if (!electionId || !officialPath) {
  console.error('Usage: node scripts/validate-official-caucus.mjs <electionId> --official=<official-caucus.json> [--fail-on-diff]');
  process.exit(1);
}

assertSafeElectionId(electionId);
const officialJsonPath = resolve(root, officialPath);
assertInside(root, officialJsonPath);
if (!existsSync(officialJsonPath)) throw new Error(`Missing official caucus JSON: ${officialPath}`);
if (!officialJsonPath.endsWith('.json')) throw new Error(`Official caucus input must be JSON: ${officialPath}`);

const official = readJson(officialJsonPath);
const glossaryPath = join(publicDataRoot, 'glossary', 'candidates.json');
const glossary = readJson(glossaryPath);
const errors = [];
const warnings = [];

const caucuses = normalizeOfficialCaucuses(official);
const glossaryCandidates = (glossary.entries ?? []).filter((entry) => (entry.electionIds ?? []).includes(electionId));
const glossaryByCaucus = groupGlossaryCandidates(glossaryCandidates);
const diffs = [];

if (official.electionId && official.electionId !== electionId) {
  errors.push(`official.electionId "${official.electionId}" does not match ${electionId}`);
}

for (const caucus of caucuses) {
  if (!caucus.label) {
    errors.push('official caucus label is required');
    continue;
  }
  if (caucus.count !== undefined && (!Number.isInteger(caucus.count) || caucus.count < 0)) {
    errors.push(`${caucus.label}: count must be a non-negative integer`);
  }
  if (caucus.memberIds.length > 0 && caucus.count !== undefined && caucus.memberIds.length !== caucus.count) {
    warnings.push(`${caucus.label}: memberIds length(${caucus.memberIds.length}) does not match count(${caucus.count})`);
  }
  if (caucus.memberNames.length > 0 && caucus.count !== undefined && caucus.memberNames.length !== caucus.count) {
    warnings.push(`${caucus.label}: memberNames length(${caucus.memberNames.length}) does not match count(${caucus.count})`);
  }
}

for (const caucus of caucuses) {
  const rows = glossaryByCaucus.get(caucus.label) ?? [];
  const actualCount = rows.length;
  const expectedCount = caucus.count ?? (caucus.memberIds.length || caucus.memberNames.length);

  if (expectedCount !== actualCount) {
    diffs.push(`${caucus.label}: official(${expectedCount}) vs glossary(${actualCount})`);
  }

  if (caucus.memberIds.length > 0) {
    const actualIds = new Set(rows.map((row) => row.id));
    const missingIds = caucus.memberIds.filter((id) => !actualIds.has(id));
    const extraIds = rows.map((row) => row.id).filter((id) => !caucus.memberIds.includes(id));
    if (missingIds.length > 0) diffs.push(`${caucus.label}: missing memberIds ${missingIds.join(', ')}`);
    if (extraIds.length > 0) diffs.push(`${caucus.label}: extra memberIds ${extraIds.join(', ')}`);
  }

  if (caucus.memberNames.length > 0) {
    const actualNames = new Set(rows.map((row) => row.label));
    const missingNames = caucus.memberNames.filter((name) => !actualNames.has(name));
    const extraNames = rows.map((row) => row.label).filter((name) => !caucus.memberNames.includes(name));
    if (missingNames.length > 0) diffs.push(`${caucus.label}: missing memberNames ${missingNames.join(', ')}`);
    if (extraNames.length > 0) diffs.push(`${caucus.label}: extra memberNames ${extraNames.join(', ')}`);
  }

  glossaryByCaucus.delete(caucus.label);
}

for (const [label, rows] of glossaryByCaucus) {
  if (!label) {
    diffs.push(`glossary candidates without caucusLabel: ${rows.length}`);
    continue;
  }
  diffs.push(`${label}: not present in official JSON, glossary(${rows.length})`);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const diff of diffs) console.log(`DIFF ${diff}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`\nOfficial caucus validation failed: ${errors.length} error(s), ${warnings.length} warning(s), ${diffs.length} diff(s)`);
  process.exit(1);
}

if (failOnDiff && diffs.length > 0) {
  console.error(`Official caucus diff detected: ${diffs.length} diff(s)`);
  process.exit(1);
}

console.log(
  `Official caucus validation OK: ${electionId}, ${caucuses.length} caucus(es), ${diffs.length} diff(s), input ${toDisplayPath(officialJsonPath)}`,
);

function normalizeOfficialCaucuses(value) {
  const rows = Array.isArray(value) ? value : value.caucuses;
  if (!Array.isArray(rows)) {
    errors.push('Official caucus JSON must be an array or an object with caucuses[]');
    return [];
  }

  return rows.map((row) => {
    const label = row.label ?? row.name ?? row.caucusLabel ?? '';
    const count = row.count ?? row.memberCount ?? row.seats;
    return {
      label: String(label).trim(),
      count: count === undefined || count === '' ? undefined : Number(count),
      memberIds: normalizeStringList(row.memberIds ?? row.ids),
      memberNames: normalizeStringList(row.memberNames ?? row.names ?? row.members),
    };
  });
}

function groupGlossaryCandidates(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const label = entry.caucusLabel ?? '';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(entry);
  }
  return groups;
}

function normalizeStringList(value) {
  if (value === undefined || value === '') return [];
  if (!Array.isArray(value)) return [String(value).trim()].filter(Boolean);
  return value
    .map((item) => (typeof item === 'string' ? item : item?.id ?? item?.name ?? item?.label ?? ''))
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function readOption(name) {
  const exact = args.indexOf(name);
  if (exact >= 0) return args[exact + 1];

  const prefix = `${name}=`;
  const option = args.find((arg) => arg.startsWith(prefix));
  return option ? option.slice(prefix.length) : undefined;
}
