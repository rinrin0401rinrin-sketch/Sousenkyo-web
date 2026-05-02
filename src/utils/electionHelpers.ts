import type { District, ElectionBundle, Member, Party, Prefecture } from '../types/election';

export function findParty(parties: Party[], partyId: string): Party | undefined {
  return parties.find((party) => party.id === partyId);
}

export function findMember(members: Member[], memberId?: string): Member | undefined {
  return memberId ? members.find((member) => member.id === memberId) : undefined;
}

export function findPrefecture(prefectures: Prefecture[], prefectureId: string): Prefecture | undefined {
  return prefectures.find((prefecture) => prefecture.id === prefectureId);
}

export function districtsForPrefecture(districts: District[], prefectureId: string): District[] {
  return districts.filter((district) => district.prefectureId === prefectureId);
}

export function membersForPrefecture(members: Member[], prefectureId: string): Member[] {
  return members.filter((member) => member.prefectureId === prefectureId);
}

export function getPartySeats(bundle: ElectionBundle) {
  return bundle.summary.partySeats
    .map((seat) => ({
      ...seat,
      party: findParty(bundle.parties, seat.partyId),
    }))
    .filter(({ party, seats }) => party && seats > 0);
}

export function getUndecidedDistrictCount(bundle: ElectionBundle): number {
  return bundle.results.singleMemberDistricts.filter(({ status }) => status === 'counting' || status === 'pending').length;
}
