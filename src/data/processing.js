// Sawmill levels and recipes. cost is paid to reach that level (level 1 = repairing the ruined mill).
// Levels 6-10 belong to later regions and are not defined yet.
export const SAWMILL_LEVELS = [
  null,
  { level: 1, ko: '작은 제재소', cost: { gold: 800 }, slots: 1, speed: 1.0, quality: 1.0,
    desc: '물레방아로 톱을 돌리는 작은 제재소. 원목 두 개로 판재 하나를 켠다.' },
  { level: 2, ko: '정밀 제재소', cost: { gold: 1400 }, slots: 2, speed: 1.25, quality: 1.1,
    desc: '톱날을 새로 갈고 작업대를 늘렸다. 생산 슬롯 2개, 속도와 품질이 오른다.' },
  { level: 3, ko: '건조 공방', cost: { gold: 5200, amber_sap: 8 }, slots: 2, speed: 1.35, quality: 1.15,
    desc: '건조실을 지어 판재를 말린 건조 목재를 만든다.' },
  { level: 4, ko: '목재 정제소', cost: { gold: 17000, essence: 25 }, slots: 3, speed: 1.55, quality: 1.2,
    desc: '정수로 결을 다듬는 정제 목재를 만든다. 슬롯 3개.' },
  { level: 5, ko: '장인 공방', cost: { gold: 52000, moss_core: 4 }, slots: 3, speed: 1.8, quality: 1.25,
    desc: '장인이 머무는 공방. 정제 목재와 희귀 재료로 장식품을 만든다.' },
];

// stage recipes apply to any wood; craft recipes are fixed.
// time: base seconds per output before hardness and speed.
export const RECIPES = [
  { id: 'plank', ko: '판재 켜기', level: 1, from: 'log', to: 'plank', n: 2, time: 6 },
  { id: 'board', ko: '건조하기', level: 3, from: 'plank', to: 'board', n: 2, time: 14 },
  { id: 'refined', ko: '정제하기', level: 4, from: 'board', to: 'refined', n: 2, time: 24 },
  { id: 'amber_panel', ko: '호박 상감', level: 5, inputs: { refined_birch: 1, amber_sap: 2 }, out: 'amber_panel', time: 40, hardness: 1.4 },
  { id: 'spirit_carving', ko: '정령 조각', level: 5, inputs: { refined_silverleaf: 1 }, essence: 3, out: 'spirit_carving', time: 55, hardness: 1.8 },
];

export const OFFLINE_CAP_SECONDS = 8 * 3600;
