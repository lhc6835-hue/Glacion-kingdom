// Every inventory item. value is the trader's buy price in Gold.
// stage: 0 log, 1 plank, 2 board, 3 refined, 4 crafted; wood: the species it came from.
const WOODS = {
  sapling: { ko: '연목', log: 4, color: '#c9a77a', dark: '#8a6a48' },
  pine: { ko: '소나무', log: 9, color: '#d6b27a', dark: '#946c40' },
  birch: { ko: '자작', log: 16, color: '#efe2c6', dark: '#b89a6a' },
  silverleaf: { ko: '은엽', log: 26, color: '#cfd8d4', dark: '#7f9490' },
  mossheart: { ko: '이끼심장', log: 55, color: '#9ec48a', dark: '#4f7a48' },
};

// Value multipliers per stage relative to the raw inputs (2 inputs → 1 output).
export const STAGE_GAIN = [1, 1.4, 1.45, 1.5];
const STAGE_NAMES = ['원목', '판재', '건조 목재', '정제 목재'];

export const ITEMS = {};

for (const [wood, w] of Object.entries(WOODS)) {
  let v = w.log;
  for (let s = 0; s < 4; s++) {
    if (s > 0) v = Math.round(v * 2 * STAGE_GAIN[s]);
    const id = ['log', 'plank', 'board', 'refined'][s] + '_' + wood;
    ITEMS[id] = { id, ko: `${w.ko} ${STAGE_NAMES[s]}`, value: v, stage: s, wood, color: w.color, dark: w.dark, kind: 'wood' };
  }
}

Object.assign(ITEMS, {
  amber_sap: { id: 'amber_sap', ko: '호박 수액', value: 45, stage: -1, kind: 'mat', color: '#f2a640', dark: '#a8601a', desc: '호박 자작나무에서 흘러나온 수액. 가공과 클래스 해금에 쓰인다.' },
  moss_core: { id: 'moss_core', ko: '이끼 핵', value: 220, stage: -1, kind: 'mat', color: '#7ee08a', dark: '#2f7a48', desc: '이끼심장 소나무의 맥동하는 심. 고급 공방에 필요하다.' },
  amber_panel: { id: 'amber_panel', ko: '호박 상감 패널', value: 0, stage: 4, kind: 'craft', wood: 'birch', color: '#f2c070', dark: '#a8702a', desc: '정제 자작 목재에 호박 수액을 상감한 장식 패널.' },
  spirit_carving: { id: 'spirit_carving', ko: '정령 조각상', value: 0, stage: 4, kind: 'craft', wood: 'silverleaf', color: '#cff0f0', dark: '#5f9aa0', desc: '은엽 정제 목재에 정수를 불어넣어 깎은 조각상.' },
});
// Crafted goods are worth their inputs times a premium.
ITEMS.amber_panel.value = Math.round((ITEMS.refined_birch.value + ITEMS.amber_sap.value * 2) * 1.6);
ITEMS.spirit_carving.value = Math.round((ITEMS.refined_silverleaf.value + 3 * 30) * 1.6);

export const WOOD_IDS = Object.keys(WOODS);
export { WOODS };
