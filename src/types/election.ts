export type ElectionStatus = 'current' | 'past' | 'upcoming';

export type ActiveElection = {
  currentId: string;
};

export type ElectionIndexItem = {
  id: string;
  type: string;
  name: string;
  status: ElectionStatus;
  year?: number;
  isDataReady?: boolean;
};

export type ElectionsIndex = {
  elections: ElectionIndexItem[];
};

export type ElectionMeta = ElectionIndexItem & {
  shortName?: string;
  description?: string;
  visuals?: ElectionVisual[];
};

export type ElectionVisualRole = 'hero' | 'analytics' | 'guide' | 'overview' | 'responsive' | string;

export type ElectionVisual = {
  id: string;
  role: ElectionVisualRole;
  title: string;
  description?: string;
  imageUrl: string;
  alt: string;
};

export type Party = {
  id: string;
  name: string;
  shortName?: string;
  color: string;
};

export type MemberStatus = 'elected' | 'leading' | 'candidate';

export type Member = {
  id: string;
  name: string;
  partyId: string;
  caucusLabel?: string;
  prefectureId: string;
  districtId?: string;
  proportionalBlockId?: string;
  photoUrl?: string;
  wins?: number;
  status?: MemberStatus;
};

export type Prefecture = {
  id: string;
  name: string;
  region?: string;
  districtCount?: number;
};

export type District = {
  id: string;
  name: string;
  prefectureId: string;
  winnerMemberId?: string;
};

export type ProportionalBlock = {
  id: string;
  name: string;
  seats?: number;
};

export type PartySeat = {
  partyId: string;
  seats: number;
};

export type ResultStatus = 'elected' | 'proportionalRevival' | 'runnerUp' | 'counting' | 'pending';

export type ResultLayer = 'single' | 'proportional';

export type MapPoint = {
  x: number;
  y: number;
  z?: number;
};

export type Candidate = {
  id: string;
  name: string;
  partyId: string;
  prefectureId: string;
  districtId?: string;
  proportionalBlockId?: string;
  photoUrl?: string;
  profileUrl?: string;
  wins?: number;
};

export type SingleMemberDistrictResult = {
  id: string;
  electionId: string;
  prefectureId: string;
  prefecture: string;
  districtName: string;
  districtNumber: number;
  candidateId: string;
  candidateName: string;
  partyId: string;
  partyName: string;
  status: ResultStatus;
  votes: number;
  voteRate: number;
  turnout: number;
  photoUrl?: string;
  profileUrl?: string;
  mapPoint: MapPoint;
};

export type ProportionalSeatResult = {
  id: string;
  electionId: string;
  blockId: string;
  blockName: string;
  partyId: string;
  partyName: string;
  status: ResultStatus;
  seats: number;
  voteRate: number;
  turnout?: number;
  mapPoint: MapPoint;
};

export type ElectionResults = {
  singleMemberDistricts: SingleMemberDistrictResult[];
  proportionalSeats: ProportionalSeatResult[];
};

export type ElectionSummary = {
  totalSeats: number;
  districtSeats?: number;
  proportionalSeats?: number;
  reportingRate?: number;
  updatedAt?: string;
  partySeats: PartySeat[];
};

export type ElectionBundle = {
  meta: ElectionMeta;
  parties: Party[];
  candidates: Candidate[];
  members: Member[];
  prefectures: Prefecture[];
  districts: District[];
  proportionalBlocks: ProportionalBlock[];
  results: ElectionResults;
  summary: ElectionSummary;
};
