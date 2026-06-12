export const glossaryCsvHeaders = [
  'id',
  'label',
  'category',
  'reading',
  'description',
  'electionIds',
  'relatedIds',
  'photoUrl',
  'districtLabel',
  'partyLabel',
  'caucusLabel',
  'statusLabel',
  'age',
  'wins',
  'seatType',
  'reviewStatus',
];

export const glossaryFiles = {
  'candidates.csv': { output: 'candidates.json', category: 'candidate' },
  'parties.csv': { output: 'parties.json', category: 'party' },
  'districts.csv': { output: 'districts.json', category: 'district' },
  'proportional-blocks.csv': { output: 'proportional-blocks.json', category: 'proportional' },
  'terms.csv': { output: 'terms.json', category: 'term' },
};
