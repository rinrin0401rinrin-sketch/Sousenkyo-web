import type { Party } from '../types/election';
import type { PartySeat } from '../types/election';
import type { GlossaryEntry } from '../types/glossary';

export type CaucusCount = {
  id: string;
  label: string;
  color: string;
  count: number;
};

const DEFAULT_COLOR = '#64748b';

const CAUCUS_BY_PARTY_LABEL: Record<string, string> = {
  自由民主党: '自由民主党・無所属の会',
  国民民主党: '国民民主党・無所属クラブ',
};

const COLOR_BY_PARTY_LABEL: Record<string, string> = {
  自由民主党: '#2563eb',
  中道改革連合: '#16a34a',
  日本維新の会: '#84cc16',
  国民民主党: '#f59e0b',
  日本共産党: '#ef4444',
  れいわ新選組: '#ec4899',
  参政党: '#f97316',
  日本保守党: '#0f766e',
  社会民主党: '#e11d48',
  無所属: '#64748b',
  チームみらい: '#06b6d4',
  ゆうこく連合: '#7c3aed',
};

export function getCaucusLabelFromPartyLabel(partyLabel?: string) {
  if (!partyLabel) return '未設定';
  return CAUCUS_BY_PARTY_LABEL[partyLabel] ?? partyLabel;
}

export function getGlossaryCaucusRoster(candidates: GlossaryEntry[], parties: GlossaryEntry[]): CaucusCount[] {
  const partyColorByLabel = new Map(parties.map((party) => [party.label, getGlossaryPartyColor(party)]));
  const counts = new Map<string, CaucusCount>();

  for (const candidate of candidates) {
    const partyLabel = candidate.partyLabel;
    const label = candidate.caucusLabel || '会派未設定';
    const current = counts.get(label);
    const color = partyLabel ? (partyColorByLabel.get(partyLabel) ?? COLOR_BY_PARTY_LABEL[partyLabel] ?? DEFAULT_COLOR) : DEFAULT_COLOR;

    counts.set(label, {
      id: toCaucusId(label),
      label,
      color: current?.color ?? color,
      count: (current?.count ?? 0) + 1,
    });
  }

  return sortCaucusCounts([...counts.values()]);
}

export function getBundleCaucusCandidateCounts(
  members: Array<{ partyId: string; caucusLabel?: string }>,
  parties: Party[],
): CaucusCount[] {
  const partyById = new Map(parties.map((party) => [party.id, party]));
  const counts = new Map<string, CaucusCount>();

  for (const member of members) {
    const party = partyById.get(member.partyId);
    const label = member.caucusLabel ?? getCaucusLabelFromPartyLabel(party?.name ?? party?.shortName);
    const current = counts.get(label);

    counts.set(label, {
      id: toCaucusId(label),
      label,
      color: current?.color ?? party?.color ?? DEFAULT_COLOR,
      count: (current?.count ?? 0) + 1,
    });
  }

  return sortCaucusCounts([...counts.values()]);
}

export function getCaucusSeatCounts(partySeats: PartySeat[], parties: Party[]): CaucusCount[] {
  const partyById = new Map(parties.map((party) => [party.id, party]));
  const counts = new Map<string, CaucusCount>();

  for (const partySeat of partySeats) {
    const party = partyById.get(partySeat.partyId);
    const label = getCaucusLabelFromPartyLabel(party?.name ?? party?.shortName);
    const current = counts.get(label);

    counts.set(label, {
      id: toCaucusId(label),
      label,
      color: current?.color ?? party?.color ?? DEFAULT_COLOR,
      count: (current?.count ?? 0) + partySeat.seats,
    });
  }

  return sortCaucusCounts([...counts.values()]);
}

function getGlossaryPartyColor(party: GlossaryEntry) {
  const swatch = party.relatedIds?.find((item) => item.startsWith('#'));
  return swatch ?? COLOR_BY_PARTY_LABEL[party.label] ?? DEFAULT_COLOR;
}

function sortCaucusCounts(items: CaucusCount[]) {
  return items.sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'ja'));
}

function toCaucusId(label: string) {
  return label
    .normalize('NFKC')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
