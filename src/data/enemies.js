// Heat-themed enemies. hp/dmg are wave-1 values and scale with the wave (see game/waves.js).
// r = collision radius (world units), size = art radius, from = first wave it can appear.
export const ENEMIES = {
  heatdrop: { name: '열기방울', hp: 22, spd: 82, dmg: 8, r: 15, size: 15, coin: 1, from: 1, w: 10, ai: 'chase' },
  ember:    { name: '불씨', hp: 8, spd: 150, dmg: 5, r: 9, size: 9, coin: 0.5, from: 2, w: 7, ai: 'swarm' },
  haze:     { name: '아지랑이', hp: 30, spd: 70, dmg: 9, r: 16, size: 16, coin: 1.5, from: 3, w: 5, ai: 'drift' },
  sunling:  { name: '햇살 정령', hp: 34, spd: 60, dmg: 7, r: 16, size: 16, coin: 2, from: 4, w: 5, ai: 'shooter' },
  slime:    { name: '녹은 슬라임', hp: 46, spd: 58, dmg: 10, r: 19, size: 19, coin: 2, from: 5, w: 5, ai: 'hopper', split: 'minislime' },
  minislime:{ name: '꼬마 슬라임', hp: 14, spd: 95, dmg: 6, r: 11, size: 11, coin: 0.5, from: 99, w: 0, ai: 'hopper', art: 'slime' },
  whirl:    { name: '열풍', hp: 40, spd: 75, dmg: 12, r: 17, size: 17, coin: 2.5, from: 7, w: 4, ai: 'dasher' },
  flare:    { name: '흑점 폭탄', hp: 26, spd: 112, dmg: 22, r: 14, size: 14, coin: 2, from: 8, w: 3, ai: 'bomber' },
  magma:    { name: '용암 덩어리', hp: 180, spd: 40, dmg: 18, r: 30, size: 30, coin: 6, from: 6, w: 2, ai: 'tank', heavy: true },

  sunboss:   { name: '이글이글 태양', hp: 2600, spd: 55, dmg: 20, r: 62, size: 62, coin: 120, boss: true, ai: 'sunboss', heavy: true },
  slimeking: { name: '용암 슬라임 킹', hp: 3200, spd: 50, dmg: 24, r: 66, size: 66, coin: 140, boss: true, ai: 'slimeking', heavy: true },
  hazequeen: { name: '아지랑이 여왕', hp: 2800, spd: 70, dmg: 18, r: 58, size: 58, coin: 150, boss: true, ai: 'hazequeen', heavy: true },
};

export const BOSS_ORDER = ['sunboss', 'slimeking', 'hazequeen'];
