// Axe database. Every effect listed here is implemented in game/AxeStats.js and game/Combat.js.
// f: damage factor on top of the grade base. blade/accent: colours used to draw the axe.
// price: sold directly by the trader for Gold (others come only from the altar).
//
// Effect types
//   swift {p}            recovery after a swing is p shorter
//   wide {p}             great/good/weak zones p wider (crit zone gets half)
//   critZone {p}         crit zone p wider
//   critMul {v}          +v to the critical multiplier
//   steady {p}           timing marker moves p slower
//   weakGuard            a miss lands as a weak hit
//   combo {p}            +p damage per combo stack (on top of the base 2%)
//   hard {p, def}        +p damage against trees with defence >= def
//   execute {p, below}   +p damage while the tree is under `below` of its HP
//   day {p} / night {p}  +p damage in daylight / at night
//   burn {p, dur}        sets the tree alight: p of the hit as damage over dur seconds (ignores half the defence)
//   frost {def, dur, shatter}  brittle: -def defence for dur s; a critical on a brittle tree deals +shatter
//   poison {p, dur, max, def}  stacking venom: each stack p of the hit per second, -def defence per stack
//   chain {chance, mul, max, onCrit}  extra lightning strikes for mul of the hit
//   void {every, mul}    every Nth landed hit ignores defence and deals mul
//   spirit {p}           chance for +1 log when a tree falls
//   harvest {logs}       +logs when a tree falls
//   essence {p, n}       chance for +n essence when a tree falls
//   rareMat {p}          multiplies rare material drop chance by 1+p
//   gold {p}             +p Gold of the felled tree's log value, paid on the spot
//   regrow {p}           trees you fell regrow p faster
export const AXES = [
  // ── Common ───────────────────────────────────────────────────────────────
  { id: 'worn_hatchet', grade: 0, f: 1.0, ko: '낡은 손도끼', en: 'Worn Hatchet', blade: '#9aa3a6', accent: '#6b5136', effects: [],
    desc: '숲 가장자리 오두막에 걸려 있던 도끼. 날은 무디지만 손에 익는다.' },
  { id: 'light_woodsaxe', grade: 0, f: 0.9, ko: '가벼운 숲도끼', en: 'Light Woodsaxe', blade: '#b4bdbf', accent: '#7c6243', price: 90,
    effects: [{ type: 'swift', p: 0.22 }], desc: '자루가 가늘어 빨리 되돌아온다. 휘두르는 간격이 짧다.' },
  { id: 'broadbit', grade: 0, f: 0.95, ko: '넓은날 도끼', en: 'Broadbit', blade: '#a9b0a8', accent: '#5d4630', price: 140,
    effects: [{ type: 'wide', p: 0.14 }], desc: '날이 넓어 어디를 내려쳐도 대충 맞는다. 판정 구간이 넓어진다.' },
  // ── Uncommon ─────────────────────────────────────────────────────────────
  { id: 'mossbit', grade: 1, f: 1.0, ko: '이끼날 도끼', en: 'Mossbit', blade: '#8fb08a', accent: '#4e5f3a', price: 420,
    effects: [{ type: 'spirit', p: 0.18 }], desc: '날 틈에 이끼가 자란다. 쓰러뜨린 나무에서 목재가 더 나올 때가 있다.' },
  { id: 'ironheart', grade: 1, f: 1.05, ko: '강철심 도끼', en: 'Ironheart', blade: '#8b97a3', accent: '#3e3a3a', price: 560,
    effects: [{ type: 'hard', p: 0.3, def: 4 }], desc: '심에 강철을 박아 단단한 나무에 강하다.' },
  { id: 'cinder_hatchet', grade: 1, f: 0.95, ko: '숯불 손도끼', en: 'Cinder Hatchet', blade: '#c78a5a', accent: '#5a3324',
    effects: [{ type: 'burn', p: 0.22, dur: 3 }], desc: '날이 늘 따뜻하다. 맞은 자리에 불씨가 남는다.' },
  // ── Refined ──────────────────────────────────────────────────────────────
  { id: 'frost_wedge', grade: 2, f: 1.0, ko: '서리 쐐기', en: 'Frost Wedge', blade: '#a8e0f0', accent: '#3c5a73',
    effects: [{ type: 'frost', def: 3, dur: 4, shatter: 0.15 }], desc: '나무껍질을 얼려 무르게 만든다. 언 나무에 크리티컬을 넣으면 깨진다.' },
  { id: 'trackers_axe', grade: 2, f: 1.0, ko: '추적자의 도끼', en: "Tracker's Axe", blade: '#b9b39a', accent: '#4a3c2c',
    effects: [{ type: 'steady', p: 0.14 }], desc: '균형추가 달려 있어 박자가 차분해진다. 마커가 느려진다.' },
  { id: 'reaper_hatchet', grade: 2, f: 0.95, ko: '수확자의 낫도끼', en: 'Reaper Hatchet', blade: '#c4c9b0', accent: '#5b4a2a',
    effects: [{ type: 'harvest', logs: 1 }, { type: 'execute', p: 0.3, below: 0.3 }], desc: '쓰러지기 직전의 나무에 강하고, 목재를 더 거둔다.' },
  // ── Rare ─────────────────────────────────────────────────────────────────
  { id: 'flamebite', grade: 3, f: 1.0, ko: '화염 도끼', en: 'Flamebite', blade: '#ff8a4a', accent: '#6a2618',
    effects: [{ type: 'burn', p: 0.4, dur: 4 }], desc: '타격한 나무에 불을 붙인다. 불은 방어력의 절반을 무시한다.' },
  { id: 'stormcleaver', grade: 3, f: 1.0, ko: '폭풍 도끼', en: 'Stormcleaver', blade: '#ffe27a', accent: '#3b4a7a',
    effects: [{ type: 'chain', chance: 0.25, mul: 0.5, max: 1 }], desc: '타격 순간 번개가 튄다. 확률적으로 한 번 더 내리친다.' },
  { id: 'thornfang', grade: 3, f: 0.95, ko: '독침 도끼', en: 'Thornfang', blade: '#9fd46a', accent: '#3f2a4a',
    effects: [{ type: 'poison', p: 0.08, dur: 5, max: 3, def: 1 }], desc: '독이 겹겹이 쌓이며 나무껍질을 삭힌다.' },
  // ── Superior ─────────────────────────────────────────────────────────────
  { id: 'spiritbough', grade: 4, f: 1.0, ko: '정령 도끼', en: 'Spiritbough', blade: '#b6f0d0', accent: '#2f5a4a',
    effects: [{ type: 'spirit', p: 0.3 }, { type: 'essence', p: 0.2, n: 1 }], desc: '숲 정령이 깃들어 있다. 목재와 정수를 더 얻는다.' },
  { id: 'veinsplitter', grade: 4, f: 1.05, ko: '광맥 도끼', en: 'Veinsplitter', blade: '#9db2c8', accent: '#4a3a5a',
    effects: [{ type: 'hard', p: 0.45, def: 5 }, { type: 'rareMat', p: 0.25 }], desc: '단단한 나무를 쪼개고 희귀한 수액을 찾아낸다.' },
  { id: 'tidecutter', grade: 4, f: 1.0, ko: '흐름의 도끼', en: 'Tidecutter', blade: '#7fd0e8', accent: '#24465a',
    effects: [{ type: 'combo', p: 0.04 }], desc: '박자를 이어갈수록 날이 무거워진다. 콤보 보너스가 커진다.' },
  // ── Epic ─────────────────────────────────────────────────────────────────
  { id: 'moonreaver', grade: 5, f: 1.0, ko: '달빛 도끼', en: 'Moonreaver', blade: '#cfe0ff', accent: '#2a2f5a',
    effects: [{ type: 'night', p: 0.6 }], desc: '달이 뜨면 깨어난다. 밤에 공격력이 크게 오른다.' },
  { id: 'sunsplitter', grade: 5, f: 1.0, ko: '태양 도끼', en: 'Sunsplitter', blade: '#ffd86a', accent: '#7a4a1a',
    effects: [{ type: 'day', p: 0.4 }, { type: 'critMul', v: 0.3 }], desc: '햇빛 아래에서 강해지고 크리티컬이 황금빛으로 터진다.' },
  { id: 'voidedge', grade: 5, f: 1.0, ko: '공허 도끼', en: 'Voidedge', blade: '#7a5ab0', accent: '#1a1424',
    effects: [{ type: 'void', every: 4, mul: 1.5 }], desc: '네 번째 타격마다 방어를 무시하고 1.5배로 벤다.' },
  // ── Heroic ───────────────────────────────────────────────────────────────
  { id: 'twinfell', grade: 6, f: 1.0, ko: '영웅의 쌍날', en: 'Twinfell', blade: '#e6c88a', accent: '#5a2a2a',
    effects: [{ type: 'chain', chance: 0.4, mul: 0.6, max: 1 }, { type: 'swift', p: 0.15 }], desc: '두 날이 번갈아 떨어진다. 추가 타격과 빠른 회복.' },
  { id: 'glacier_maw', grade: 6, f: 1.0, ko: '빙하 처형자', en: 'Glacier Maw', blade: '#bff4ff', accent: '#2a4a6a',
    effects: [{ type: 'frost', def: 8, dur: 5, shatter: 0.25 }], desc: '깊은 냉기로 나무를 얼리고, 크리티컬로 산산이 깬다.' },
  { id: 'forgeheart', grade: 6, f: 1.0, ko: '용광 도끼', en: 'Forgeheart', blade: '#ff6a3a', accent: '#4a1a10',
    effects: [{ type: 'burn', p: 0.6, dur: 4 }, { type: 'wide', p: 0.1 }], desc: '용광로의 심장을 품었다. 강한 화상과 넓은 판정.' },
  // ── Mythic ───────────────────────────────────────────────────────────────
  { id: 'mothshade', grade: 7, f: 1.0, ko: '그림자 나방날', en: 'Mothshade', blade: '#9a8ab8', accent: '#22182e',
    effects: [{ type: 'weakGuard' }, { type: 'steady', p: 0.15 }], desc: '빗나가도 날개처럼 스친다. 실패가 약한 타격이 된다.' },
  { id: 'thunderchain', grade: 7, f: 1.0, ko: '천둥 사슬', en: 'Thunderchain', blade: '#fff08a', accent: '#2a3a7a',
    effects: [{ type: 'chain', chance: 0.55, mul: 0.55, max: 2 }], desc: '번개가 사슬처럼 이어져 최대 두 번 더 내리친다.' },
  { id: 'goldharvest', grade: 7, f: 0.95, ko: '황금 수확', en: 'Goldharvest', blade: '#f2c84a', accent: '#5a4210',
    effects: [{ type: 'harvest', logs: 2 }, { type: 'gold', p: 0.15 }], desc: '목재를 두 개 더 거두고, 쓰러뜨릴 때마다 금화를 줍는다.' },
  // ── Ancient ──────────────────────────────────────────────────────────────
  { id: 'rootwarden', grade: 8, f: 1.0, ko: '고대 뿌리 도끼', en: 'Rootwarden', blade: '#a8c08a', accent: '#3a2a1a',
    effects: [{ type: 'hard', p: 0.6, def: 5 }, { type: 'spirit', p: 0.35 }], desc: '고대 뿌리로 엮은 자루. 단단한 나무를 존중하며 벤다.' },
  { id: 'runecarved', grade: 8, f: 1.0, ko: '룬 새김 도끼', en: 'Runecarved', blade: '#8af0e0', accent: '#2a3a4a',
    effects: [{ type: 'critMul', v: 0.8 }, { type: 'wide', p: 0.15 }], desc: '날에 새긴 룬이 크리티컬을 증폭한다.' },
  { id: 'ashen_oath', grade: 8, f: 1.0, ko: '잿빛 맹세', en: 'Ashen Oath', blade: '#c8a8a0', accent: '#3a2020',
    effects: [{ type: 'burn', p: 0.8, dur: 4 }, { type: 'poison', p: 0.06, dur: 5, max: 3, def: 1 }], desc: '재와 독의 맹세. 불과 독을 함께 남긴다.' },
  // ── Legendary ────────────────────────────────────────────────────────────
  { id: 'everbranch', grade: 9, f: 1.0, ko: '에버루트의 가지', en: 'Everbranch', blade: '#c8ffd8', accent: '#2a6a4a',
    effects: [{ type: 'spirit', p: 0.5 }, { type: 'essence', p: 1, n: 1 }, { type: 'regrow', p: 0.3 }], desc: '에버루트에서 떨어진 가지. 벤 나무가 더 빨리 다시 자란다.' },
  { id: 'stormking', grade: 9, f: 1.0, ko: '폭풍왕의 도끼', en: 'Stormking', blade: '#fff6b0', accent: '#1a2a6a',
    effects: [{ type: 'chain', chance: 0.7, mul: 0.6, max: 2, onCrit: true }], desc: '크리티컬은 반드시 번개를 부른다.' },
  { id: 'hourcleaver', grade: 9, f: 1.0, ko: '시간 절단기', en: 'Hourcleaver', blade: '#e0d0ff', accent: '#3a2a5a',
    effects: [{ type: 'steady', p: 0.25 }, { type: 'swift', p: 0.25 }], desc: '시간의 결을 자른다. 마커가 느려지고 손은 빨라진다.' },
  // ── Relic ────────────────────────────────────────────────────────────────
  { id: 'starfall_edge', grade: 10, f: 1.0, ko: '별 떨어진 날', en: 'Starfall Edge', blade: '#dff0ff', accent: '#1a2040',
    effects: [{ type: 'critZone', p: 0.4 }, { type: 'critMul', v: 0.5 }], desc: '운석으로 벼린 날. 크리티컬 구간이 넓어진다.' },
  { id: 'abyss_fang', grade: 10, f: 1.0, ko: '심연 이빨', en: 'Abyss Fang', blade: '#5a3a8a', accent: '#0e0a18',
    effects: [{ type: 'void', every: 3, mul: 2 }], desc: '세 번째 타격마다 심연이 열려 방어를 무시하고 두 배로 벤다.' },
  { id: 'frostfire', grade: 10, f: 1.0, ko: '서리불꽃', en: 'Frostfire', blade: '#a8d8ff', accent: '#8a2a2a',
    effects: [{ type: 'burn', p: 0.7, dur: 4 }, { type: 'frost', def: 10, dur: 4, shatter: 0.2 }], desc: '얼리고 태운다. 상반된 두 힘이 나무를 무너뜨린다.' },
  // ── Celestial ────────────────────────────────────────────────────────────
  { id: 'celestial_wedge', grade: 11, f: 1.0, ko: '천상의 쐐기', en: 'Celestial Wedge', blade: '#f0fbff', accent: '#4a6a9a',
    effects: [{ type: 'wide', p: 0.25 }, { type: 'combo', p: 0.05 }], desc: '구름 위 장인의 작품. 넓은 판정과 큰 콤보 보너스.' },
  { id: 'dawnbreaker', grade: 11, f: 1.0, ko: '새벽 도끼', en: 'Dawnbreaker', blade: '#ffe0b0', accent: '#6a3a4a',
    effects: [{ type: 'day', p: 0.6 }, { type: 'night', p: 0.3 }], desc: '낮에는 해처럼, 밤에는 새벽을 기다리며 빛난다.' },
  { id: 'cloudsplitter', grade: 11, f: 1.0, ko: '구름 가르개', en: 'Cloudsplitter', blade: '#e8f4ff', accent: '#3a4a6a',
    effects: [{ type: 'chain', chance: 0.8, mul: 0.6, max: 2 }, { type: 'swift', p: 0.2 }], desc: '구름을 가르는 바람이 연달아 몰아친다.' },
  // ── Primordial ───────────────────────────────────────────────────────────
  { id: 'primeval_tooth', grade: 12, f: 1.0, ko: '태초의 이빨', en: 'Primeval Tooth', blade: '#d8e8c0', accent: '#3a3020',
    effects: [{ type: 'hard', p: 1.0, def: 5 }, { type: 'void', every: 5, mul: 1.5 }], desc: '세상이 처음 생길 때의 이빨. 어떤 껍질도 뚫는다.' },
  { id: 'lifepulse', grade: 12, f: 0.95, ko: '생명의 맥동', en: 'Lifepulse', blade: '#a0ffc8', accent: '#1a5a3a',
    effects: [{ type: 'spirit', p: 0.7 }, { type: 'essence', p: 1, n: 2 }], desc: '숲의 맥박이 들린다. 정수가 두 배로 흘러나온다.' },
  { id: 'primordial_caldera', grade: 12, f: 1.0, ko: '태고 화산', en: 'Primordial Caldera', blade: '#ff7a3a', accent: '#2a0a0a',
    effects: [{ type: 'burn', p: 1.2, dur: 5 }], desc: '태고의 불이 잠든 날. 화상이 다섯 초 동안 타오른다.' },
  // ── Eternal ──────────────────────────────────────────────────────────────
  { id: 'eternal_balance', grade: 13, f: 1.0, ko: '영원의 저울', en: 'Eternal Balance', blade: '#f8f4e0', accent: '#5a4a2a',
    effects: [{ type: 'weakGuard' }, { type: 'wide', p: 0.2 }, { type: 'steady', p: 0.2 }], desc: '어떤 손도 흔들리지 않게 한다.' },
  { id: 'endless_chain', grade: 13, f: 1.0, ko: '무한 사슬', en: 'Endless Chain', blade: '#fffac0', accent: '#2a2a6a',
    effects: [{ type: 'chain', chance: 1, mul: 0.5, max: 3 }], desc: '번개가 멈추지 않는다. 매 타격 최대 세 번 더 내리친다.' },
  { id: 'aeon_frost', grade: 13, f: 1.0, ko: '영겁의 서리', en: 'Aeon Frost', blade: '#d8f8ff', accent: '#1a3a5a',
    effects: [{ type: 'frost', def: 20, dur: 6, shatter: 0.5 }], desc: '영겁의 겨울. 얼어붙은 나무는 크리티컬 한 번에 무너진다.' },
  // ── Transcendent ─────────────────────────────────────────────────────────
  { id: 'axenfall', grade: 14, f: 1.0, ko: '액센폴', en: 'Axenfall', blade: '#ffd8f8', accent: '#3a1a4a',
    effects: [{ type: 'critMul', v: 1.0 }, { type: 'wide', p: 0.2 }, { type: 'spirit', p: 0.5 }], desc: '세상의 이름을 딴 도끼. 모든 박자가 노래가 된다.' },
  { id: 'worldroot_sunderer', grade: 14, f: 1.0, ko: '세계수 분쇄자', en: 'Worldroot Sunderer', blade: '#c8ffe0', accent: '#1a2a1a',
    effects: [{ type: 'void', every: 2, mul: 2 }, { type: 'hard', p: 0.8, def: 5 }], desc: '두 번에 한 번, 세계수의 뿌리마저 가른다.' },
  { id: 'transcendent_clock', grade: 14, f: 1.0, ko: '초월의 시계', en: 'Transcendent Clock', blade: '#f0e0ff', accent: '#2a1a3a',
    effects: [{ type: 'steady', p: 0.35 }, { type: 'combo', p: 0.06 }, { type: 'swift', p: 0.3 }], desc: '시간 위에 선 자의 도끼.' },
];

export const AXE_BY_ID = Object.fromEntries(AXES.map((a) => [a.id, a]));

// Korean one-line descriptions of each effect type, used by the UI.
export function effectText(e) {
  const pc = (v) => `${Math.round(v * 100)}%`;
  switch (e.type) {
    case 'swift': return `회복 시간 -${pc(e.p)}`;
    case 'wide': return `판정 구간 +${pc(e.p)}`;
    case 'critZone': return `크리티컬 구간 +${pc(e.p)}`;
    case 'critMul': return `크리티컬 배율 +${e.v.toFixed(1)}`;
    case 'steady': return `마커 속도 -${pc(e.p)}`;
    case 'weakGuard': return '실패 → 약한 타격으로 완충';
    case 'combo': return `콤보당 피해 +${pc(e.p)}`;
    case 'hard': return `방어 ${e.def} 이상 나무에 피해 +${pc(e.p)}`;
    case 'execute': return `HP ${pc(e.below)} 미만 나무에 피해 +${pc(e.p)}`;
    case 'day': return `낮에 피해 +${pc(e.p)}`;
    case 'night': return `밤에 피해 +${pc(e.p)}`;
    case 'burn': return `화상: ${e.dur}초간 타격의 ${pc(e.p)}`;
    case 'frost': return `빙결: ${e.dur}초간 방어 -${e.def}, 크리티컬 시 +${pc(e.shatter)}`;
    case 'poison': return `독: 중첩 ${e.max}회, 초당 ${pc(e.p)}, 중첩당 방어 -${e.def}`;
    case 'chain': return `번개 ${pc(e.chance)} 확률로 ${pc(e.mul)} 추가 타격 (최대 ${e.max}회)${e.onCrit ? ', 크리티컬 시 확정' : ''}`;
    case 'void': return `${e.every}번째 타격마다 방어 무시 ×${e.mul}`;
    case 'spirit': return `쓰러뜨릴 때 ${pc(e.p)} 확률로 목재 +1`;
    case 'harvest': return `쓰러뜨릴 때 목재 +${e.logs}`;
    case 'essence': return `쓰러뜨릴 때 ${pc(e.p)} 확률로 정수 +${e.n}`;
    case 'rareMat': return `희귀 재료 확률 +${pc(e.p)}`;
    case 'gold': return `쓰러뜨릴 때 목재 가치의 ${pc(e.p)}만큼 금화`;
    case 'regrow': return `벤 나무 재생 ${pc(e.p)} 빠름`;
    default: return e.type;
  }
}
