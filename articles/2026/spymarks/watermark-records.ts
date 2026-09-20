// Fictional lookup records shared by the text and image demonstrations.
export const watermarkRecords = [
  { id: 173, author: 'Frodo Baggins', date: '2026-05-14', time: '09:41:08 UTC' },
  { id: 90, author: 'Samwise Gamgee', date: '2026-05-15', time: '16:22:31 UTC' },
  { id: 214, author: 'Gandalf the Grey', date: '2026-05-16', time: '11:06:52 UTC' },
] as const;

export const textWatermarkRecords = watermarkRecords.map(record => ({
  ...record,
  politicalAffiliation: record.id === 214 ? 'Wizard-Mutant Alliance' : 'Proudfoot',
  interests: { 173: 'Nair', 90: 'Potatoes', 214: 'Magic: The Gathering' }[record.id],
}));

export const imageWatermarkRecords = watermarkRecords.map(record => ({
  ...record,
  author: record.id === 173 ? 'Shaggy Rogers' : record.author,
  internetHistory: record.id === 173 ? [
    'SpiritHalloween.com — T-rex Costumes',
    'are ghosts real - Google Search',
    'can a ghost sue you in court - Google Search',
  ] : [],
}));
