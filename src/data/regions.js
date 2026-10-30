// Regions. Each one is a strip of world running left to right with its own ground shape,
// stations, trees and look. `look` drives how the renderer builds and tints the scene.
export const REGIONS = {
  evergreen: {
    id: 'evergreen', ko: '상록 계곡', en: 'Evergreen Hollow', order: 1,
    width: 2440, minX: 70, maxX: 2330, spawnX: 905, entryX: { sunveil: 2250 },
    ground: { base: 200, amp: [5, 3, 4], freq: [170, 53, 410] },
    stations: [
      { id: 'trader', kind: 'trader', ko: '떠돌이 상인 미르', verb: '거래하기', x: 175, range: 34 },
      { id: 'altar', kind: 'altar', ko: '도끼 제단', verb: '제단에 기도하기', x: 318, range: 26 },
      { id: 'guild', kind: 'guild', ko: '벌목꾼 길드 게시판', verb: '클래스 살펴보기', x: 440, range: 22 },
      { id: 'sawmill', kind: 'sawmill', ko: '물레방아 제재소', verb: '제재소 열기', x: 610, range: 46 },
      { id: 'elder', kind: 'elder', ko: '고목 모스루트', verb: '살펴보기', x: 925, range: 40 },
      { id: 'gate', kind: 'gate', ko: '무너진 바위 길', verb: '살펴보기', x: 2290, range: 30, to: 'sunveil' },
    ],
    trees: [
      ['sapling', 760], ['sapling', 818], ['sapling', 1010], ['sapling', 1062], ['sapling', 1118],
      ['pine', 1190], ['pine', 1250], ['pine', 1318], ['pine', 1385], ['pine', 1452],
      ['birch', 1540], ['birch', 1606], ['birch', 1674], ['birch', 1742],
      ['silverleaf', 1840], ['silverleaf', 1930], ['silverleaf', 2020],
      ['mossheart', 2160],
    ],
    creek: [[480, 760], [1460, 1560], [2060, 2250]],
    lanterns: [128, 262, 520, 702, 1140, 1500, 1800, 2235],
    look: {
      far: 'cliffs', warm: null, rays: 1, flowers: 0.025, butterflies: 6, pollen: false, leaves: null,
      gaps: [70, 190, 330, 470, 600, 760, 880, 975], music: 'valley',
    },
  },
  sunveil: {
    id: 'sunveil', ko: '해비침 숲', en: 'Sunveil Forest', order: 2,
    width: 2600, minX: 60, maxX: 2500, spawnX: 150, entryX: { evergreen: 150 },
    ground: { base: 198, amp: [7, 4, 6], freq: [210, 61, 520] },
    stations: [
      { id: 'westpath', kind: 'path', ko: '상록 계곡으로 가는 길', verb: '계곡으로 돌아가기', x: 96, range: 34, to: 'evergreen' },
      { id: 'trader', kind: 'trader', ko: '꿀빛 교역소 하니', verb: '거래하기', x: 300, range: 34 },
      { id: 'sundial', kind: 'sundial', ko: '빛의 해시계', verb: '살펴보기', x: 1300, range: 30 },
      { id: 'eastpath', kind: 'path', ko: '빛에 잠긴 오솔길', verb: '살펴보기', x: 2470, range: 30 },
    ],
    trees: [
      ['oak', 520], ['oak', 600], ['oak', 690], ['oak', 780],
      ['maple', 900], ['maple', 980], ['maple', 1070], ['maple', 1160],
      ['honeybark', 1420], ['honeybark', 1510], ['honeybark', 1600],
      ['dawnwood', 1760], ['dawnwood', 1860], ['dawnwood', 1960], ['dawnwood', 2060],
      ['sunheart', 2280],
    ],
    creek: [[1180, 1290]],
    lanterns: [210, 420, 1240, 1380, 2180, 2400],
    look: {
      far: 'hills', warm: '#ffc860', rays: 1.65, flowers: 0.07, butterflies: 16, pollen: true, leaves: ['#f2c040', '#e8902a', '#f8dc70'],
      gaps: [40, 130, 210, 300, 380, 470, 560, 640, 730, 820, 900, 980], music: 'sunveil',
    },
    unlock: { cost: { gold: 3000, essence: 12 }, requires: [{ felled: 'silverleaf', n: 3, ko: '은엽수 3그루 쓰러뜨리기' }] },
  },
};

export const LORE = {
  elder: [
    '거대한 고목의 뿌리 사이로 희미한 빛이 흐른다.',
    '껍질에 새겨진 오래된 무늬가 숨을 쉬듯 밝아졌다가 어두워진다.',
    '"에버루트가 약해진 뒤로, 이 나무만은 아직 빛을 기억하고 있지." — 상인 미르',
    '이 나무는 도끼를 거부한다. 정령의 허락 없이는 벨 수 없다.',
  ],
  gate: [
    '바위가 무너져 해비침 숲(Sunveil Forest)으로 가는 길이 막혀 있었다.',
    '바위 틈으로 새어 나오던 황금빛 햇살은, 길을 치우자 숲 전체를 물들이고 있었다.',
  ],
  sundial: [
    '이끼 낀 돌 해시계. 그림자가 아니라 빛이 시간을 가리킨다.',
    '"해비침 숲의 나무는 햇빛을 먹고 자라서, 결마다 금빛이 배어 있지." — 교역상 하니',
    '해시계의 바늘이 가리키는 곳은 동쪽, 에버루트의 뿌리가 지나간다는 방향이다.',
  ],
  eastpath: [
    '오솔길이 빛 속으로 사라진다. 더 깊은 숲은 다음 여정에서 열린다.',
  ],
};
