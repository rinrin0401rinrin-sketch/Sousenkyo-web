import { existsSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { readCsv, validateCsvHeaders } from './csv-utils.mjs';
import { publicDataRoot, readOptionalJson, root } from './data-utils.mjs';

const strict = process.argv.includes('--strict');
const materialsDir = join(root, 'data', 'source', 'materials');
const officialSourcesPath = join(materialsDir, 'official-sources.csv');
const photoRightsPath = join(materialsDir, 'photo-rights.csv');
const errors = [];
const warnings = [];

const officialSourceHeaders = [
  'id',
  'electionId',
  'publisher',
  'sourceType',
  'format',
  'title',
  'url',
  'retrievedAt',
  'publishedAt',
  'licenseStatus',
  'notes',
];
const photoRightsHeaders = ['candidateId', 'electionId', 'photoFile', 'sourceUrl', 'rightHolder', 'rightsStatus', 'retrievedAt', 'notes'];
const sourceTypes = new Set([
  'result',
  'candidate-list',
  'district-list',
  'party-list',
  'proportional-list',
  'caucus-list',
  'caucus-members',
  'turnout',
  'other',
  '',
]);
const formats = new Set(['csv', 'xlsx', 'pdf', 'html', 'json', 'other', '']);
const rightsStatuses = new Set(['confirmed', 'needs-review', 'restricted', 'unknown', '']);

const electionIds = readElectionIds();
validateOfficialSources();
validatePhotoRights();

for (const warning of warnings) console.warn(`WARN ${warning}`);

if (strict && warnings.length > 0) {
  errors.push(`--strict では warning が残っている素材台帳を許可しません (${warnings.length} warning(s))`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`\n素材台帳検証に失敗しました: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(`素材台帳検証OK: ${relative(root, materialsDir)}${strict ? ' (--strict)' : ''}`);

function readElectionIds() {
  const index = readOptionalJson(join(publicDataRoot, 'elections-index.json'));
  return new Set((index?.elections ?? []).map((election) => election.id).filter(Boolean));
}

function validateOfficialSources() {
  validateRequiredCsv(officialSourcesPath, officialSourceHeaders);
  if (!existsSync(officialSourcesPath)) return;

  const seen = new Set();
  for (const row of readCsv(officialSourcesPath)) {
    requireValue(row.id, 'official-sources.csv id');
    requireKnownElection(row.electionId, `official-sources.csv ${row.id || 'unknown'}.electionId`);
    requireValue(row.publisher, `official-sources.csv ${row.id || 'unknown'}.publisher`);
    requireValue(row.title, `official-sources.csv ${row.id || 'unknown'}.title`);
    requireValue(row.url, `official-sources.csv ${row.id || 'unknown'}.url`);
    requireValue(row.retrievedAt, `official-sources.csv ${row.id || 'unknown'}.retrievedAt`);
    requireUnique(seen, row.id, 'official-sources.csv id');

    if (!sourceTypes.has(row.sourceType)) warnings.push(`official-sources.csv ${row.id}: sourceType "${row.sourceType}" は未定義です`);
    if (!formats.has(row.format)) warnings.push(`official-sources.csv ${row.id}: format "${row.format}" は未定義です`);
    if (!rightsStatuses.has(row.licenseStatus)) warnings.push(`official-sources.csv ${row.id}: licenseStatus "${row.licenseStatus}" は未定義です`);
    if (row.url && !isAllowedUrlOrPath(row.url)) {
      warnings.push(`official-sources.csv ${row.id}: url は公式URLまたはローカルパスにしてください`);
    }
  }
}

function validatePhotoRights() {
  validateRequiredCsv(photoRightsPath, photoRightsHeaders);
  if (!existsSync(photoRightsPath)) return;

  const seen = new Set();
  const rightsRows = readCsv(photoRightsPath);
  const rightsByPhoto = new Map();
  const photoReferences = collectPhotoReferences();
  const referencesByPhoto = new Map(photoReferences.map((reference) => [reference.path, reference]));

  for (const row of rightsRows) {
    requireValue(row.candidateId, 'photo-rights.csv candidateId');
    requireKnownElection(row.electionId, `photo-rights.csv ${row.candidateId || 'unknown'}.electionId`);
    requireValue(row.photoFile, `photo-rights.csv ${row.candidateId || 'unknown'}.photoFile`);
    requireValue(row.sourceUrl, `photo-rights.csv ${row.candidateId || 'unknown'}.sourceUrl`);
    requireValue(row.rightsStatus, `photo-rights.csv ${row.candidateId || 'unknown'}.rightsStatus`);
    requireUnique(seen, `${row.electionId}:${row.candidateId}:${row.photoFile}`, 'photo-rights.csv row');

    if (!rightsStatuses.has(row.rightsStatus)) warnings.push(`photo-rights.csv ${row.candidateId}: rightsStatus "${row.rightsStatus}" は未定義です`);
    if (row.rightsStatus && row.rightsStatus !== 'confirmed') {
      warnings.push(`photo-rights.csv ${row.candidateId}: rightsStatus が confirmed ではありません`);
    }
    if (row.sourceUrl && !isAllowedUrlOrPath(row.sourceUrl)) {
      warnings.push(`photo-rights.csv ${row.candidateId}: sourceUrl は公式URLまたはローカルパスにしてください`);
    }

    const normalizedPhoto = normalizePhotoPath(row.photoFile, row.electionId);
    validatePhotoFile(row, normalizedPhoto);
    rightsByPhoto.set(normalizedPhoto, row);

    const reference = referencesByPhoto.get(normalizedPhoto);
    if (!reference) {
      warnings.push(`photo-rights.csv ${row.candidateId}: ${normalizedPhoto} は公開JSONの photoUrl から参照されていません`);
    } else if (row.candidateId !== reference.candidateId) {
      warnings.push(`photo-rights.csv ${row.candidateId}: ${normalizedPhoto} は公開JSON側の candidateId "${reference.candidateId}" と一致しません`);
    }
  }

  for (const reference of photoReferences) {
    if (reference.path.includes('/placeholder.')) continue;
    if (!rightsByPhoto.has(reference.path)) {
      warnings.push(`${reference.label}: ${reference.path} の写真台帳行がありません`);
    }
  }
}

function validateRequiredCsv(path, headers) {
  try {
    validateCsvHeaders(path, headers);
  } catch (error) {
    errors.push(error.message);
  }
}

function requireValue(value, label) {
  if (!String(value ?? '').trim()) errors.push(`${label} は必須です`);
}

function requireKnownElection(electionId, label) {
  requireValue(electionId, label);
  if (electionId && !electionIds.has(electionId)) errors.push(`${label}: "${electionId}" が elections-index.json に存在しません`);
}

function requireUnique(seen, value, label) {
  if (!value) return;
  if (seen.has(value)) errors.push(`${label}: "${value}" が重複しています`);
  seen.add(value);
}

function isAllowedUrlOrPath(value) {
  return /^(https?:\/\/|file:|\/|data\/)/.test(value);
}

function normalizePhotoPath(photoFile, electionId) {
  if (!photoFile) return '';
  if (photoFile.startsWith('/data/')) return photoFile;
  if (photoFile.startsWith('photos/')) return `/data/${electionId}/${photoFile}`;
  return photoFile;
}

function validatePhotoFile(row, normalizedPhoto) {
  if (!normalizedPhoto) return;

  const allowedPhotoPrefixes = [`/data/${row.electionId}/photos/`, `/data/glossary/photos/${row.electionId}/`];
  if (!allowedPhotoPrefixes.some((prefix) => normalizedPhoto.startsWith(prefix))) {
    warnings.push(`photo-rights.csv ${row.candidateId}: photoFile は /data/${row.electionId}/photos/...、/data/glossary/photos/${row.electionId}/... または photos/... を推奨します`);
  }

  const fileName = basename(normalizedPhoto);
  if (!/^[a-z0-9][a-z0-9-]*\.(?:png|jpe?g|webp|svg)$/i.test(fileName)) {
    warnings.push(`photo-rights.csv ${row.candidateId}: photoFile のファイル名は小文字英数字とハイフンを推奨します`);
  }
  if (row.candidateId && !fileName.toLowerCase().startsWith(`${row.candidateId.toLowerCase()}.`)) {
    warnings.push(`photo-rights.csv ${row.candidateId}: photoFile は candidateId と同じ basename を推奨します`);
  }

  if (normalizedPhoto.startsWith('/data/')) {
    const publicPath = join(root, 'public', normalizedPhoto.replace(/^\//, ''));
    if (!existsSync(publicPath)) {
      warnings.push(`photo-rights.csv ${row.candidateId}: ${normalizedPhoto} の実ファイルが public にありません`);
    }
  }
}

function collectPhotoReferences() {
  const refs = [];
  for (const electionId of electionIds) {
    const dir = join(publicDataRoot, electionId);
    const files = [
      ['members.json', 'members'],
      ['candidates.json', 'candidates'],
      ['single-member-districts.json', 'singleMemberDistricts'],
    ];
    for (const [fileName, key] of files) {
      const data = readOptionalJson(join(dir, fileName));
      for (const item of data?.[key] ?? []) {
        const candidateId = item.candidateId || item.id || '';
        if (item.photoUrl) {
          refs.push({
            path: item.photoUrl,
            candidateId,
            label: `${electionId}/${fileName}.${candidateId || 'unknown'}`,
          });
        }
      }
    }
  }
  const glossaryCandidates = readOptionalJson(join(publicDataRoot, 'glossary', 'candidates.json'));
  for (const item of glossaryCandidates?.entries ?? []) {
    if (item.photoUrl) {
      const electionId = item.electionIds?.[0] || 'glossary';
      refs.push({
        path: item.photoUrl,
        candidateId: item.id || '',
        label: `glossary/candidates.json.${item.id || 'unknown'} (${electionId})`,
      });
    }
  }
  return refs;
}
