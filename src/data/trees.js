// Tree species of the first region. hardness scales processing time at the sawmill.
// drops: extra rolls when the tree falls ({item|essence, chance, min, max}).
// art: which generator in art/trees.js draws it, plus its size.
export const TREES = {
  sapling: {
    ko: '어린 연목', en: 'Softwood Sapling', rarity: 0,
    hp: 30, def: 0, logs: 2, respawn: 14, markerSpeed: 1.0, hardness: 0.6,
    log: 'log_sapling', drops: [],
    art: { kind: 'round', h: 44, w: 26, trunk: 4 },
    lore: '계곡 바닥 어디서나 자라는 무른 나무. 첫 도끼질을 배우기에 좋다.',
  },
  pine: {
    ko: '계곡 소나무', en: 'Valley Pine', rarity: 0,
    hp: 80, def: 2, logs: 3, respawn: 26, markerSpeed: 1.05, hardness: 1.0,
    log: 'log_pine', drops: [],
    art: { kind: 'pine', h: 92, w: 44, trunk: 7 },
    lore: '그늘진 비탈을 따라 곧게 자란다. 송진 냄새가 계곡 공기를 채운다.',
  },
  birch: {
    ko: '호박 자작나무', en: 'Amber Birch', rarity: 1,
    hp: 150, def: 4, logs: 3, respawn: 40, markerSpeed: 1.1, hardness: 1.4,
    log: 'log_birch', drops: [{ item: 'amber_sap', chance: 0.5, min: 1, max: 1 }, { essence: true, chance: 0.3, min: 1, max: 1 }],
    art: { kind: 'birch', h: 84, w: 50, trunk: 5 },
    lore: '하얀 껍질 아래로 호박빛 수액이 흐른다. 서늘한 숲에서 유난히 따뜻해 보인다.',
  },
  silverleaf: {
    ko: '은엽수', en: 'Silverleaf Tree', rarity: 2,
    hp: 240, def: 7, logs: 4, respawn: 60, markerSpeed: 1.18, hardness: 1.8,
    log: 'log_silverleaf', drops: [{ essence: true, chance: 0.7, min: 1, max: 2 }],
    art: { kind: 'silver', h: 104, w: 58, trunk: 7 },
    lore: '잎 뒷면이 은빛이라 바람이 불 때마다 숲이 반짝인다. 정수를 머금고 있다.',
  },
  mossheart: {
    ko: '이끼심장 소나무', en: 'Mossheart Pine', rarity: 3,
    hp: 560, def: 10, logs: 5, respawn: 90, markerSpeed: 1.28, hardness: 2.5,
    log: 'log_mossheart', drops: [{ essence: true, chance: 1, min: 3, max: 5 }, { item: 'moss_core', chance: 0.6, min: 1, max: 1 }],
    art: { kind: 'mossheart', h: 118, w: 60, trunk: 9 },
    lore: '오래된 소나무에 이끼 정령이 깃들어 심장처럼 맥동한다. 드물게 계곡 소나무 자리에 자라난다.',
    rareSpawn: { replaces: 'pine', chance: 0.12 },
  },
  // ── Sunveil Forest ──
  oak: {
    ko: '해비침 참나무', en: 'Sunveil Oak', rarity: 1, region: 'sunveil',
    hp: 320, def: 9, logs: 4, respawn: 40, markerSpeed: 1.12, hardness: 1.9,
    log: 'log_oak', drops: [{ essence: true, chance: 0.25, min: 1, max: 1 }],
    art: { kind: 'oak', h: 100, w: 78, trunk: 11 },
    lore: '수관이 넓게 퍼져 숲 바닥에 황금빛 그늘을 드리운다. 단단하고 결이 곧다.',
  },
  maple: {
    ko: '금엽 단풍', en: 'Goldenleaf Maple', rarity: 1, region: 'sunveil',
    hp: 420, def: 11, logs: 4, respawn: 48, markerSpeed: 1.16, hardness: 2.1,
    log: 'log_maple', drops: [{ item: 'golden_leaf', chance: 0.45, min: 1, max: 2 }],
    art: { kind: 'maple', h: 92, w: 62, trunk: 7 },
    lore: '잎이 햇빛을 머금어 한낮에도 노을처럼 타오른다. 떨어진 잎은 금박처럼 얇다.',
  },
  honeybark: {
    ko: '꿀껍질나무', en: 'Honeybark Tree', rarity: 2, region: 'sunveil',
    hp: 520, def: 13, logs: 4, respawn: 60, markerSpeed: 1.2, hardness: 2.4,
    log: 'log_honeybark', drops: [{ item: 'golden_resin', chance: 0.5, min: 1, max: 1 }, { essence: true, chance: 0.4, min: 1, max: 2 }],
    art: { kind: 'honey', h: 96, w: 56, trunk: 9 },
    lore: '껍질 틈으로 꿀빛 수지가 흘러 굳는다. 숲의 벌레들이 모여드는 나무.',
  },
  dawnwood: {
    ko: '새벽나무', en: 'Dawnwood', rarity: 2, region: 'sunveil',
    hp: 680, def: 15, logs: 5, respawn: 70, markerSpeed: 1.24, hardness: 2.7,
    log: 'log_dawnwood', drops: [{ essence: true, chance: 0.85, min: 1, max: 3 }],
    art: { kind: 'dawn', h: 108, w: 60, trunk: 8 },
    lore: '수관이 새벽 하늘 빛으로 물든다. 해가 뜨는 쪽으로 조금씩 기울어 자란다.',
  },
  sunheart: {
    ko: '태양심장 참나무', en: 'Sunheart Oak', rarity: 3, region: 'sunveil',
    hp: 1400, def: 18, logs: 6, respawn: 110, markerSpeed: 1.34, hardness: 3.2,
    log: 'log_sunheart', drops: [{ essence: true, chance: 1, min: 4, max: 6 }, { item: 'sun_core', chance: 0.6, min: 1, max: 1 }],
    art: { kind: 'sunheart', h: 128, w: 86, trunk: 13 },
    lore: '줄기 깊은 곳에 작은 태양이 박힌 듯 빛나는 고목. 드물게 참나무 자리에 자라난다.',
    rareSpawn: { replaces: 'oak', chance: 0.1 },
  },
};

export const TREE_IDS = Object.keys(TREES);
