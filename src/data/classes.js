// Classes are bought, never pulled. Only the active class applies; owning several lets you switch.
// mods are read by game/Combat.js, game/Processing.js and game/Economy.js.
// active: Q ability. requires: conditions checked against GameState (see ClassSystem.requirementsMet).
export const CLASSES = [
  {
    id: 'lumberjack', ko: '벌목꾼', en: 'Lumberjack', tier: 0, color: '#c9a36a',
    cost: {}, requires: [],
    style: '안정적인 기본 클래스. 타이밍 바를 익히기 좋다.',
    passives: ['나무를 쓰러뜨릴 때 목재 +1'],
    mods: { fellLogs: 1 },
    active: { id: 'heavy_chop', ko: '힘껏 내려찍기', cd: 20, desc: '다음 타격 피해 ×1.6' },
  },
  {
    id: 'precision_warden', ko: '정밀 감시자', en: 'Precision Warden', tier: 1, color: '#5fb0f0',
    cost: { gold: 2200, essence: 15 }, requires: [{ stat: 'crits', n: 30, ko: '크리티컬 30회 달성' }],
    style: '정확한 손을 보상한다. 연속 크리티컬이 쌓일수록 강해지는 고숙련 클래스.',
    passives: ['크리티컬 배율 +0.6', '연속 크리티컬마다 피해 +8% (최대 5회)', '초록 구간 +15%', '실패해도 콤보의 절반 유지'],
    mods: { critMul: 0.6, critChain: 0.08, critChainMax: 5, greatZone: 0.15, missKeepsHalfCombo: true },
    active: { id: 'focus', ko: '집중', cd: 30, dur: 6, desc: '6초간 마커 속도 -35%' },
  },
  {
    id: 'pyroforger', ko: '화염 단조공', en: 'Pyroforger', tier: 1, color: '#f07a3a',
    cost: { gold: 6200, amber_sap: 12 }, requires: [{ sawmill: 2, ko: '제재소 2단계' }],
    style: '불을 다루는 장인. 어떤 도끼로도 불씨를 남기고, 화염 도끼와는 폭발적인 시너지.',
    passives: ['화상 피해 ×1.7', '상태 이상 지속시간 ×1.5', '크리티컬 시 화상 (타격의 25%, 3초)'],
    mods: { burnMul: 1.7, statusDur: 1.5, critIgnite: { p: 0.25, dur: 3 } },
    active: { id: 'ignite', ko: '점화', cd: 25, charges: 3, desc: '다음 3번의 타격에 강한 화상 (타격의 60%, 4초)' },
  },
  {
    id: 'gearwright', ko: '기계공', en: 'Gearwright', tier: 2, color: '#d8c070',
    cost: { gold: 9500, essence: 40 }, requires: [{ sawmill: 3, ko: '제재소 3단계' }],
    style: '도끼보다 톱니를 믿는다. 가공 산업을 키우는 경제 클래스.',
    passives: ['가공 속도 ×1.4', '생산 슬롯 +1', '제재소 업그레이드 비용 -15%', '가공품 판매가 +12%'],
    mods: { procSpeed: 1.4, procSlots: 1, upgradeDiscount: 0.15, processedSell: 0.12 },
    active: { id: 'overclock', ko: '가속 톱니', cd: 45, desc: '진행 중인 모든 가공 작업을 20초 앞당김' },
  },
];

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
