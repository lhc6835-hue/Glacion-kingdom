// Rarity ladder shared by molds, flavors, weapons and faces. Index 0 is the most common.
// `rate` is the gacha weight (percent); `price` is the base shop price for molds/faces of that grade.
export const GRADES = [
  { id: 'chip',     name: '얼음조각', color: '#9fb4c7', glow: '#dbe6f0', rate: 32.0,  price: 150 },
  { id: 'soft',     name: '소프트',   color: '#7ccf8f', glow: '#d2f5da', rate: 24.0,  price: 700 },
  { id: 'scoop',    name: '스쿱',     color: '#5aaeff', glow: '#cfe7ff', rate: 17.0,  price: 2200 },
  { id: 'sprinkle', name: '스프링클', color: '#a77bff', glow: '#e6dbff', rate: 12.0,  price: 5500 },
  { id: 'gelato',   name: '젤라또',   color: '#ff7fbf', glow: '#ffd9ec', rate: 7.5,   price: 13000 },
  { id: 'sundae',   name: '선데',     color: '#ffa13d', glow: '#ffe3c2', rate: 4.3,   price: 30000 },
  { id: 'glacier',  name: '빙하',     color: '#38d6e8', glow: '#c9f7ff', rate: 1.9,   price: 65000 },
  { id: 'aurora',   name: '오로라',   color: '#5ef0b4', glow: '#e0fff2', rate: 0.85,  price: 150000, fancy: 'aurora' },
  { id: 'galaxy',   name: '갤럭시',   color: '#7b5cff', glow: '#d9d0ff', rate: 0.4,   price: 380000, fancy: 'galaxy' },
  { id: 'og',       name: 'OG',       color: '#f2c14e', glow: '#fff2c4', rate: 0.05,  price: 1000000, fancy: 'og' },
];

export const GRADE_INDEX = Object.fromEntries(GRADES.map((g, i) => [g.id, i]));
export const grade = (id) => GRADES[GRADE_INDEX[id]];

// Flavor strength by layer, top scoop first. The top scoop is the one that melts first.
export const LAYER_STRENGTH = [1, 0.75, 0.6, 0.5, 0.42];

// Owning duplicates raises an item's level; each level adds this much to its effect strength.
export const LEVEL_BONUS = 0.08;
export const MAX_LEVEL = 10;
