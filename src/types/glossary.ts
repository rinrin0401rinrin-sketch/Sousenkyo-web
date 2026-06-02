export type GlossaryCategory = 'candidate' | 'party' | 'district' | 'proportional' | 'term';

export type GlossaryEntry = {
  id: string;
  label: string;
  category: GlossaryCategory;
  reading?: string;
  description?: string;
  electionIds?: string[];
  relatedIds?: string[];
  photoUrl?: string;
  districtLabel?: string;
  partyLabel?: string;
  statusLabel?: string;
  age?: string;
  wins?: string;
  seatType?: string;
  reviewStatus?: string;
};

export type GlossaryFile = {
  entries: GlossaryEntry[];
};

export type GlossaryBundle = {
  candidates: GlossaryEntry[];
  parties: GlossaryEntry[];
  districts: GlossaryEntry[];
  proportionalBlocks: GlossaryEntry[];
  terms: GlossaryEntry[];
};
