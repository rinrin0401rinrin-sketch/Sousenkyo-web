import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { omitEmpty, readCsv, validateCsvHeaders } from './csv-utils.mjs';
import { assertInside, publicDataRoot, readJson, root, toDisplayPath, writeJson } from './data-utils.mjs';
import { glossaryCsvHeaders, glossaryFiles } from './glossary-schema.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const sourceDir = join(root, 'data', 'source', 'glossary', 'csv');
const outputDir = join(publicDataRoot, 'glossary');

if (!existsSync(sourceDir)) {
  console.error(`${toDisplayPath(sourceDir)} がありません。PDF抽出後の確認CSVを配置してください。`);
  process.exit(1);
}

const writes = [];
const allEntries = [];
const electionsIndex = readJson(join(publicDataRoot, 'elections-index.json'));
const electionIds = new Set((electionsIndex.elections ?? []).map((election) => election.id).filter(Boolean));

for (const [csvName, config] of Object.entries(glossaryFiles)) {
  const csvPath = join(sourceDir, csvName);
  validateCsvHeaders(csvPath, glossaryCsvHeaders);
  const entries = readCsv(csvPath).map((row) => normalizeEntry(row, config.category));
  const outputPath = join(outputDir, config.output);
  assertInside(outputDir, outputPath);
  writes.push([outputPath, { entries }]);
  allEntries.push(...entries);
}

validateEntries(allEntries, electionIds);

if (dryRun) {
  console.log(`Dry run: ${writes.length} glossary file(s) would be generated from ${toDisplayPath(sourceDir)}`);
  for (const [outputPath, value] of writes) console.log(`- ${toDisplayPath(outputPath)} (${value.entries.length} entries)`);
  process.exit(0);
}

mkdirSync(outputDir, { recursive: true });
for (const [outputPath, value] of writes) writeJson(outputPath, value);
console.log(`Generated ${writes.length} glossary file(s) from ${toDisplayPath(sourceDir)}`);

function normalizeEntry(row, expectedCategory) {
  if (row.category && row.category !== expectedCategory) {
    throw new Error(`${row.id || 'unknown'}: category は "${expectedCategory}" である必要があります`);
  }

  return omitEmpty({
    id: row.id,
    label: row.label,
    category: row.category || expectedCategory,
    reading: row.reading,
    description: row.description,
    electionIds: splitList(row.electionIds),
    relatedIds: splitList(row.relatedIds),
    photoUrl: row.photoUrl,
    districtLabel: row.districtLabel,
    partyLabel: row.partyLabel,
    statusLabel: row.statusLabel,
    age: row.age,
    wins: row.wins,
    seatType: row.seatType,
    reviewStatus: row.reviewStatus,
  });
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateEntries(entries, electionIds) {
  const seen = new Set();
  const ids = new Set(entries.map((entry) => entry.id).filter(Boolean));

  for (const entry of entries) {
    if (!entry.id) throw new Error('glossary entry id は必須です');
    if (!entry.label) throw new Error(`${entry.id}: label は必須です`);
    if (!entry.category) throw new Error(`${entry.id}: category は必須です`);
    if (seen.has(entry.id)) throw new Error(`glossary id "${entry.id}" が重複しています`);
    seen.add(entry.id);

    for (const relatedId of entry.relatedIds ?? []) {
      if (!ids.has(relatedId)) throw new Error(`${entry.id}: relatedIds "${relatedId}" が単語帳内に存在しません`);
    }

    for (const electionId of entry.electionIds ?? []) {
      if (!electionIds.has(electionId)) throw new Error(`${entry.id}: electionIds "${electionId}" が elections-index.json に存在しません`);
    }
  }
}
