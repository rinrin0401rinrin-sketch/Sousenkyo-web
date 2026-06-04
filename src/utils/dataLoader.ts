import type {
  ActiveElection,
  Candidate,
  District,
  ElectionBundle,
  ElectionMeta,
  ElectionResults,
  ElectionSummary,
  ElectionsIndex,
  Member,
  Party,
  Prefecture,
  ProportionalBlock,
} from '../types/election';
import type { GlossaryBundle, GlossaryFile } from '../types/glossary';
import { publicPath } from './publicPath';

type ElectionBundleJson = {
  meta: ElectionMeta;
  partiesJson: { parties?: Party[] };
  membersJson: { members?: Member[] };
  prefecturesJson: { prefectures?: Prefecture[] };
  districtsJson: { districts?: District[] };
  blocksJson: { proportionalBlocks?: ProportionalBlock[] };
  summary: Partial<ElectionSummary>;
  candidatesJson?: { candidates?: Candidate[] };
  singleDistrictsJson?: Partial<Pick<ElectionResults, 'singleMemberDistricts'>>;
  resultsJson?: Partial<Pick<ElectionResults, 'proportionalSeats'>>;
};

async function loadJson<T>(path: string): Promise<T> {
  const url = publicPath(path) ?? path;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`${path} を読み込めませんでした (${response.status})`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`${path} がJSONとして配信されていません`);
  }

  return response.json() as Promise<T>;
}

async function loadOptionalJson<T>(path: string): Promise<T | undefined> {
  const url = publicPath(path) ?? path;
  const response = await fetch(url, { cache: 'no-store' });

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`${path} を読み込めませんでした (${response.status})`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined;
  }

  return response.json() as Promise<T>;
}

async function loadFirstAvailableJson<T>(paths: string[]): Promise<T> {
  let lastError: Error | undefined;

  for (const path of paths) {
    try {
      const data = await loadOptionalJson<T>(path);
      if (data) {
        return data;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('データの読み込みに失敗しました');
    }
  }

  throw lastError ?? new Error(`${paths.join(', ')} を読み込めませんでした`);
}

async function loadOptionalFirstAvailableJson<T>(paths: string[]): Promise<T | undefined> {
  for (const path of paths) {
    const data = await loadOptionalJson<T>(path);
    if (data) {
      return data;
    }
  }

  return undefined;
}

export function loadActiveElection(): Promise<ActiveElection> {
  return loadJson<ActiveElection>('/data/active-election.json');
}

export function loadElectionsIndex(): Promise<ElectionsIndex> {
  return loadJson<ElectionsIndex>('/data/elections-index.json');
}

export async function loadGlossaryBundle(): Promise<GlossaryBundle> {
  const [candidates, parties, districts, proportionalBlocks, terms] = await Promise.all([
    loadGlossaryFile('/data/glossary/candidates.json'),
    loadGlossaryFile('/data/glossary/parties.json'),
    loadGlossaryFile('/data/glossary/districts.json'),
    loadGlossaryFile('/data/glossary/proportional-blocks.json'),
    loadGlossaryFile('/data/glossary/terms.json'),
  ]);

  return { candidates, parties, districts, proportionalBlocks, terms };
}

export async function loadGlossaryCandidatesAndParties(): Promise<Pick<GlossaryBundle, 'candidates' | 'parties'>> {
  const [candidates, parties] = await Promise.all([
    loadGlossaryFile('/data/glossary/candidates.json'),
    loadGlossaryFile('/data/glossary/parties.json'),
  ]);

  return { candidates, parties };
}

export async function loadElectionBundle(electionId: string): Promise<ElectionBundle> {
  const encodedId = encodeURIComponent(electionId);
  const basePaths = [`/data/elections/${encodedId}`, `/data/${encodedId}`];
  const pathsFor = (fileName: string) => basePaths.map((basePath) => `${basePath}/${fileName}`);

  const [
    meta,
    partiesJson,
    membersJson,
    prefecturesJson,
    districtsJson,
    blocksJson,
    summary,
    candidatesJson,
    singleDistrictsJson,
    resultsJson,
  ] = await Promise.all([
    loadFirstAvailableJson<ElectionMeta>(pathsFor('election-meta.json')),
    loadFirstAvailableJson<{ parties: Party[] }>(pathsFor('parties.json')),
    loadFirstAvailableJson<{ members: Member[] }>(pathsFor('members.json')),
    loadFirstAvailableJson<{ prefectures: Prefecture[] }>(pathsFor('prefectures.json')),
    loadFirstAvailableJson<{ districts: District[] }>(pathsFor('districts.json')),
    loadFirstAvailableJson<{ proportionalBlocks: ProportionalBlock[] }>(pathsFor('proportional-blocks.json')),
    loadFirstAvailableJson<ElectionSummary>(pathsFor('summary.json')),
    loadOptionalFirstAvailableJson<{ candidates: Candidate[] }>(pathsFor('candidates.json')),
    loadOptionalFirstAvailableJson<Pick<ElectionResults, 'singleMemberDistricts'>>(
      pathsFor('single-member-districts.json'),
    ),
    loadOptionalFirstAvailableJson<Pick<ElectionResults, 'proportionalSeats'>>(pathsFor('results.json')),
  ]);

  return normalizeElectionBundle({
    meta,
    partiesJson,
    membersJson,
    prefecturesJson,
    districtsJson,
    blocksJson,
    summary,
    candidatesJson,
    singleDistrictsJson,
    resultsJson,
  });
}

function normalizeElectionBundle({
  meta,
  partiesJson,
  membersJson,
  prefecturesJson,
  districtsJson,
  blocksJson,
  summary,
  candidatesJson,
  singleDistrictsJson,
  resultsJson,
}: ElectionBundleJson): ElectionBundle {
  const parties = asArray(partiesJson.parties);
  const members = asArray(membersJson.members);
  const candidates = asArray(candidatesJson?.candidates);
  const singleMemberDistricts = asArray(singleDistrictsJson?.singleMemberDistricts).filter(hasMapPoint);
  const proportionalSeats = asArray(resultsJson?.proportionalSeats).filter(hasMapPoint);

  return {
    meta,
    parties,
    candidates: candidates.length > 0 ? candidates : members,
    members,
    prefectures: asArray(prefecturesJson.prefectures),
    districts: asArray(districtsJson.districts),
    proportionalBlocks: asArray(blocksJson.proportionalBlocks),
    results: {
      singleMemberDistricts,
      proportionalSeats,
    },
    summary: {
      totalSeats: safeNumber(summary.totalSeats),
      districtSeats: summary.districtSeats,
      proportionalSeats: summary.proportionalSeats,
      reportingRate: summary.reportingRate,
      updatedAt: summary.updatedAt,
      partySeats: asArray(summary.partySeats),
    },
  };
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

async function loadGlossaryFile(path: string) {
  const file = await loadFirstAvailableJson<GlossaryFile>([path]);
  return asArray(file.entries);
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function hasMapPoint<T extends { mapPoint?: unknown }>(result: T): result is T & { mapPoint: { x: number; y: number; z?: number } } {
  if (!result.mapPoint || typeof result.mapPoint !== 'object') {
    return false;
  }

  const point = result.mapPoint as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && typeof point.y === 'number';
}
