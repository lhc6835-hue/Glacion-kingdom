// Axe grade table. Gacha weights are in basis points (1 = 0.01%) so they sum to exactly 10000.
// base: grade base damage before the axe's own factor. shard: shards granted for a duplicate pull.
export const GRADES = [
  { id: 'common',       ko: '일반',   en: 'Common',       color: '#9aa7a0', weight: 3810, base: 6,   shard: 2 },
  { id: 'uncommon',     ko: '고급',   en: 'Uncommon',     color: '#7fc47a', weight: 2400, base: 9,   shard: 3 },
  { id: 'refined',      ko: '정련',   en: 'Refined',      color: '#5fc2b0', weight: 1400, base: 13,  shard: 5 },
  { id: 'rare',         ko: '희귀',   en: 'Rare',         color: '#4f9be8', weight: 900,  base: 18,  shard: 8 },
  { id: 'superior',     ko: '상급',   en: 'Superior',     color: '#6f7ff0', weight: 600,  base: 25,  shard: 12 },
  { id: 'epic',         ko: '서사',   en: 'Epic',         color: '#a874ee', weight: 400,  base: 34,  shard: 18 },
  { id: 'heroic',       ko: '영웅',   en: 'Heroic',       color: '#d86fd0', weight: 220,  base: 46,  shard: 26 },
  { id: 'mythic',       ko: '신화',   en: 'Mythic',       color: '#ee6f8c', weight: 120,  base: 62,  shard: 36 },
  { id: 'ancient',      ko: '고대',   en: 'Ancient',      color: '#e0884a', weight: 70,   base: 84,  shard: 50 },
  { id: 'legendary',    ko: '전설',   en: 'Legendary',    color: '#f2b544', weight: 40,   base: 112, shard: 70 },
  { id: 'relic',        ko: '유물',   en: 'Relic',        color: '#e8d26a', weight: 22,   base: 150, shard: 95 },
  { id: 'celestial',    ko: '천상',   en: 'Celestial',    color: '#9fe6f2', weight: 10,   base: 200, shard: 130 },
  { id: 'primordial',   ko: '태초',   en: 'Primordial',   color: '#7ef0b4', weight: 5,    base: 265, shard: 175 },
  { id: 'eternal',      ko: '영원',   en: 'Eternal',      color: '#f4f0d8', weight: 2,    base: 350, shard: 235 },
  { id: 'transcendent', ko: '초월',   en: 'Transcendent', color: '#ff9ff0', weight: 1,    base: 460, shard: 320 },
];

export const GRADE_INDEX = Object.fromEntries(GRADES.map((g, i) => [g.id, i]));
