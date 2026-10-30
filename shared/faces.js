// Faces (표정). Every face keeps the same two small dot eyes set close together; only the mouth
// (and a few small extras) changes. Bought at the 표정 가게 on the plaza.
export const FACES = [
  { id: 'smile', name: '방긋', grade: 'chip', price: 0, mouth: 'hook' },
  { id: 'wah', name: '앗!', grade: 'chip', price: 200, mouth: 'triangle' },
  { id: 'nyam', name: '냠', grade: 'chip', price: 200, mouth: 'curl' },
  { id: 'hmm', name: '음', grade: 'chip', price: 150, mouth: 'flat' },
  { id: 'oh', name: '오', grade: 'soft', price: 600, mouth: 'o' },
  { id: 'cat', name: '냥', grade: 'soft', price: 800, mouth: 'cat' },
  { id: 'sulky', name: '시무룩', grade: 'soft', price: 700, mouth: 'frown' },
  { id: 'grin', name: '헤헤', grade: 'scoop', price: 1800, mouth: 'd' },
  { id: 'wavy', name: '울렁', grade: 'scoop', price: 1800, mouth: 'wave' },
  { id: 'smirk', name: '히죽', grade: 'scoop', price: 2000, mouth: 'smirk' },
  { id: 'tongue', name: '메롱', grade: 'sprinkle', price: 4200, mouth: 'tongue' },
  { id: 'kiss', name: '쪽', grade: 'sprinkle', price: 4500, mouth: 'kiss' },
  { id: 'blush', name: '발그레', grade: 'gelato', price: 9000, mouth: 'hook', extra: 'blush' },
  { id: 'tooth', name: '뻐드렁', grade: 'gelato', price: 9500, mouth: 'tooth' },
  { id: 'drool', name: '츄릅', grade: 'sundae', price: 21000, mouth: 'd', extra: 'drool' },
  { id: 'yay', name: '와아아', grade: 'sundae', price: 24000, mouth: 'big' },
  { id: 'sparkle', name: '반짝', grade: 'glacier', price: 52000, mouth: 'hook', extra: 'sparkle' },
  { id: 'sweat', name: '머쓱', grade: 'aurora', price: 120000, mouth: 'flat', extra: 'sweat' },
  { id: 'star', name: '별빛 미소', grade: 'galaxy', price: 300000, mouth: 'curl', extra: 'stars' },
  { id: 'crown', name: '원조 미소', grade: 'og', price: 800000, mouth: 'hook', extra: 'crown' },
];

export const FACE = Object.fromEntries(FACES.map((f) => [f.id, f]));
