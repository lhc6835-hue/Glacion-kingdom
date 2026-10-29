// Layout of the first region, Evergreen Hollow: a shaded valley floor running left to right.
// World units are art pixels; y grows downwards.
export const WORLD = {
  id: 'evergreen', ko: '상록 계곡', en: 'Evergreen Hollow', width: 2440,
  minX: 70, maxX: 2330,
  spawnX: 905,
};

export function groundY(x) {
  return 200 + Math.round(5 * Math.sin(x / 170) + 3 * Math.sin(x / 53 + 1) + 4 * Math.sin(x / 410 + 2));
}

// Places you can press E at. range: half-width of the interaction area.
export const STATIONS = [
  { id: 'trader', ko: '떠돌이 상인 미르', verb: '거래하기', x: 175, range: 34 },
  { id: 'altar', ko: '도끼 제단', verb: '제단에 기도하기', x: 318, range: 26 },
  { id: 'guild', ko: '벌목꾼 길드 게시판', verb: '클래스 살펴보기', x: 440, range: 22 },
  { id: 'sawmill', ko: '물레방아 제재소', verb: '제재소 열기', x: 610, range: 46 },
  { id: 'elder', ko: '고목 모스루트', verb: '살펴보기', x: 925, range: 40 },
  { id: 'gate', ko: '무너진 바위 길', verb: '살펴보기', x: 2290, range: 30 },
];

export const TREE_SPOTS = [
  ['sapling', 760], ['sapling', 818], ['sapling', 1010], ['sapling', 1062], ['sapling', 1118],
  ['pine', 1190], ['pine', 1250], ['pine', 1318], ['pine', 1385], ['pine', 1452],
  ['birch', 1540], ['birch', 1606], ['birch', 1674], ['birch', 1742],
  ['silverleaf', 1840], ['silverleaf', 1930], ['silverleaf', 2020],
  ['mossheart', 2160],
];

// Creek segments visible behind the walkable bank.
export const CREEK = [[480, 760], [1460, 1560], [2060, 2250]];

export const LORE = {
  elder: [
    '거대한 고목의 뿌리 사이로 희미한 빛이 흐른다.',
    '껍질에 새겨진 오래된 무늬가 숨을 쉬듯 밝아졌다가 어두워진다.',
    '"에버루트가 약해진 뒤로, 이 나무만은 아직 빛을 기억하고 있지." — 상인 미르',
    '이 나무는 도끼를 거부한다. 정령의 허락 없이는 벨 수 없다.',
  ],
  gate: [
    '바위가 무너져 해비침 숲(Sunveil Forest)으로 가는 길이 막혀 있다.',
    '바위 틈으로 황금빛 햇살이 새어 나온다. 길을 여는 방법은 다음 여정에서 찾게 된다.',
  ],
};
