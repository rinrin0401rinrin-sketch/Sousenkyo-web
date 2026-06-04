import type {
  ElectionBundle,
  ProportionalSeatResult,
  ResultLayer,
  ResultStatus,
  SingleMemberDistrictResult,
} from '../types/election';

export type MapMode = 'single' | 'proportional' | 'both';

export type ElectionFilters = {
  mapMode: MapMode;
  partyId: string;
  prefectureId: string;
  status: string;
};

export type ElectionMapItem =
  | {
      layer: 'single';
      id: string;
      label: string;
      subLabel: string;
      partyId: string;
      partyName: string;
      prefectureId: string;
      status: ResultStatus;
      votes: number;
      voteRate: number;
      turnout?: number;
      photoUrl?: string;
      profileUrl?: string;
      x: number;
      y: number;
      z: number;
      source: SingleMemberDistrictResult;
    }
  | {
      layer: 'proportional';
      id: string;
      label: string;
      subLabel: string;
      partyId: string;
      partyName: string;
      prefectureId: string;
      status: ResultStatus;
      seats: number;
      voteRate: number;
      turnout?: number;
      x: number;
      y: number;
      z: number;
      source: ProportionalSeatResult;
    };

export const defaultElectionFilters: ElectionFilters = {
  mapMode: 'both',
  partyId: 'all',
  prefectureId: 'all',
  status: 'all',
};

export function buildMapItems(bundle: ElectionBundle): ElectionMapItem[] {
  const singleItems: ElectionMapItem[] = bundle.results.singleMemberDistricts.map((result) => ({
    layer: 'single',
    id: result.id,
    label: result.candidateName,
    subLabel: result.districtName,
    partyId: result.partyId,
    partyName: result.partyName,
    prefectureId: result.prefectureId,
    status: result.status,
    votes: result.votes,
    voteRate: result.voteRate,
    turnout: result.turnout,
    photoUrl: result.photoUrl,
    profileUrl: result.profileUrl,
    x: result.mapPoint.x,
    y: result.mapPoint.y,
    z: result.mapPoint.z ?? 1,
    source: result,
  }));

  const proportionalItems: ElectionMapItem[] = bundle.results.proportionalSeats.map((result) => ({
    layer: 'proportional',
    id: result.id,
    label: result.blockName,
    subLabel: result.status === 'pending' || result.status === 'counting' ? '結果未反映' : `${result.seats}議席`,
    partyId: result.partyId,
    partyName: result.partyName,
    prefectureId: result.blockId,
    status: result.status,
    seats: result.seats,
    voteRate: result.voteRate,
    turnout: result.turnout,
    x: result.mapPoint.x,
    y: result.mapPoint.y,
    z: result.mapPoint.z ?? 1,
    source: result,
  }));

  return [...singleItems, ...proportionalItems];
}

export function filterMapItems(items: ElectionMapItem[], filters: ElectionFilters): ElectionMapItem[] {
  return items.filter((item) => {
    if (!matchesMapMode(item.layer, filters.mapMode)) return false;
    if (filters.partyId !== 'all' && item.partyId !== filters.partyId) return false;
    if (filters.prefectureId !== 'all' && item.prefectureId !== filters.prefectureId) return false;
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    return true;
  });
}

function matchesMapMode(layer: ResultLayer, mapMode: MapMode): boolean {
  if (mapMode === 'both') return true;
  return layer === mapMode;
}
