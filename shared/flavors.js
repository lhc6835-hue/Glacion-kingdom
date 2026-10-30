// 56 flavors. Every scoop layer holds one flavor; its trait is applied at LAYER_STRENGTH[layer].
// look: c = cream colour, p = inclusion pattern, pc = inclusion colours.
// fx.stats are additive deltas (pct values are fractions); fx.procs are event effects (see game/traits.js).
export const FLAVORS = [
  // ── 얼음조각 ─────────────────────────────────────────────
  { id: 'milk', name: '우유', grade: 'chip', c: '#fbf7ee', p: 'none', desc: '층 체력 +8', fx: { stats: { hp: 8 } } },
  { id: 'strawberry', name: '딸기', grade: 'chip', c: '#ffb7c9', p: 'seeds', pc: ['#e2557a'], desc: '공격력 +7%', fx: { stats: { dmg: 0.07 } } },
  { id: 'melon', name: '메론', grade: 'chip', c: '#c6f0a2', p: 'none', desc: '이동 속도 +7%', fx: { stats: { spd: 0.07 } } },
  { id: 'banana', name: '바나나', grade: 'chip', c: '#fff1a6', p: 'none', desc: '코인 획득 +12%', fx: { stats: { coin: 0.12 } } },
  { id: 'orange', name: '오렌지 셔벗', grade: 'chip', c: '#ffc47e', p: 'dots', pc: ['#ff9f43'], desc: '공격 속도 +7%', fx: { stats: { atk: 0.07 } } },
  { id: 'grape', name: '포도', grade: 'chip', c: '#c9a6f2', p: 'none', desc: '치명타 확률 +5%', fx: { stats: { crit: 0.05 } } },
  { id: 'soda', name: '소다', grade: 'chip', c: '#a9e7ff', p: 'fizz', pc: ['#ffffff'], desc: '구르기 대기시간 -10%', fx: { stats: { dashCd: -0.1 } } },
  { id: 'lemon', name: '레몬', grade: 'chip', c: '#fff69c', p: 'none', desc: '치명타 피해 +18%', fx: { stats: { critDmg: 0.18 } } },
  { id: 'peach', name: '복숭아', grade: 'chip', c: '#ffd2b3', p: 'swirl', pc: ['#ffb08a'], desc: '초당 체력 재생 +0.5', fx: { stats: { regen: 0.5 } } },
  { id: 'corn', name: '옥수수', grade: 'chip', c: '#ffe58d', p: 'chunks', pc: ['#f2c23a'], desc: '넉백 +25%', fx: { stats: { knock: 0.25 } } },

  // ── 소프트 ───────────────────────────────────────────────
  { id: 'mint', name: '민트', grade: 'soft', c: '#b4f3dc', p: 'none', desc: '냉기 오라: 주변 적 이동 속도 -18%', fx: { procs: [{ k: 'chillAura', r: 120, slow: 0.18 }] } },
  { id: 'cookie', name: '쿠키앤크림', grade: 'soft', c: '#f3f0ea', p: 'chunks', pc: ['#3b302b', '#56483f'], desc: '처치 시 10% 확률로 쿠키 파편 3개 발사', fx: { procs: [{ k: 'killShards', chance: 0.1, n: 3, dmg: 0.6, color: '#4a3c34' }] } },
  { id: 'blueberry', name: '블루베리', grade: 'soft', c: '#a9b9ff', p: 'seeds', pc: ['#4b5bd6'], desc: '공격 시 12% 확률로 2초 둔화', fx: { procs: [{ k: 'hitSlow', chance: 0.12, slow: 0.45, dur: 2 }] } },
  { id: 'caramel', name: '카라멜', grade: 'soft', c: '#eab56e', p: 'swirl', pc: ['#c98432'], desc: '피격 시 12% 확률로 피해 무시', fx: { procs: [{ k: 'block', chance: 0.12 }] } },
  { id: 'greentea', name: '녹차', grade: 'soft', c: '#a9d084', p: 'none', desc: '초당 체력 재생 +1', fx: { stats: { regen: 1 } } },
  { id: 'coffee', name: '커피', grade: 'soft', c: '#bb8a5f', p: 'dots', pc: ['#7a5232'], desc: '공격 속도 +13%', fx: { stats: { atk: 0.13 } } },
  { id: 'yogurt', name: '요거트', grade: 'soft', c: '#fdfdf6', p: 'swirl', pc: ['#ffc4d6'], desc: '받는 피해 -9%', fx: { stats: { armor: 0.09 } } },
  { id: 'sweetpotato', name: '고구마', grade: 'soft', c: '#dca47c', p: 'chunks', pc: ['#b06f4a'], desc: '층 체력 +14', fx: { stats: { hp: 14 } } },
  { id: 'cherry', name: '체리', grade: 'soft', c: '#ff7d97', p: 'chunks', pc: ['#c21f45'], desc: '처치 시 8% 확률로 체리 폭발', fx: { procs: [{ k: 'killBoom', chance: 0.08, r: 80, dmg: 1.2, color: '#ff4d6d' }] } },

  // ── 스쿱 ─────────────────────────────────────────────────
  { id: 'mintchoco', name: '민트초코', grade: 'scoop', c: '#a7f0d7', p: 'chips', pc: ['#4a2c1c'], desc: '공격 시 12% 확률로 0.9초 빙결', fx: { procs: [{ k: 'hitFreeze', chance: 0.12, dur: 0.9 }] } },
  { id: 'rockyroad', name: '로키로드', grade: 'scoop', c: '#8c5e3d', p: 'chunks', pc: ['#ffffff', '#f4e3d0'], desc: '넉백 +40%, 받는 피해 -6%', fx: { stats: { knock: 0.4, armor: 0.06 } } },
  { id: 'tiramisu', name: '티라미수', grade: 'scoop', c: '#dcbc92', p: 'dust', pc: ['#6b4428'], desc: '치명타 확률 +8%, 치명타 피해 +25%', fx: { stats: { crit: 0.08, critDmg: 0.25 } } },
  { id: 'bubblegum', name: '버블껌', grade: 'scoop', c: '#ffa9da', p: 'dots', pc: ['#7ed6ff', '#fff27a'], desc: '처치한 적이 터지며 주변에 35% 피해', fx: { procs: [{ k: 'killBoom', chance: 1, r: 60, dmg: 0.35, color: '#ff8ccf' }] } },
  { id: 'honey', name: '꿀', grade: 'scoop', c: '#ffd055', p: 'swirl', pc: ['#f0a815'], desc: '피격 시 주변 적을 끈적하게 하고 체력 4 회복', fx: { procs: [{ k: 'hurtSticky', r: 110, slow: 0.5, dur: 2.5, heal: 4 }] } },
  { id: 'sesame', name: '흑임자', grade: 'scoop', c: '#908b86', p: 'seeds', pc: ['#2c2a28'], desc: '관통 +1', fx: { stats: { pierce: 1 } } },
  { id: 'pistachio', name: '피스타치오', grade: 'scoop', c: '#cce39c', p: 'chunks', pc: ['#7fa34a'], desc: '투사체 +1', fx: { stats: { proj: 1 } } },
  { id: 'ramune', name: '라무네', grade: 'scoop', c: '#a2e1ff', p: 'fizz', pc: ['#ffffff'], desc: '공격 시 15% 확률로 탄산 번개가 3명에게 연쇄', fx: { procs: [{ k: 'hitChain', chance: 0.15, n: 3, dmg: 0.55, color: '#8fe3ff' }] } },

  // ── 스프링클 ─────────────────────────────────────────────
  { id: 'rainbow', name: '레인보우 셔벗', grade: 'sprinkle', c: '#ffd1e3', p: 'stripes', pc: ['#ffb3c7', '#ffe08a', '#b6f0a8', '#a9d8ff', '#d4b8ff'], desc: '모든 능력 +6%', fx: { stats: { dmg: 0.06, atk: 0.06, spd: 0.06, armor: 0.06, crit: 0.03, hp: 4 } } },
  { id: 'cottoncandy', name: '솜사탕', grade: 'sprinkle', c: '#cfe0ff', p: 'swirl', pc: ['#ffcdea'], desc: '구르기 대기시간 -18%, 구르기 후 3초간 이동 속도 +30%', fx: { stats: { dashCd: -0.18 }, procs: [{ k: 'dashHaste', spd: 0.3, dur: 3 }] } },
  { id: 'redbean', name: '팥', grade: 'sprinkle', c: '#a95a52', p: 'chunks', pc: ['#6e2e2a'], desc: '층 체력 +22, 받는 피해 -5%', fx: { stats: { hp: 22, armor: 0.05 } } },
  { id: 'mango', name: '망고 탱고', grade: 'sprinkle', c: '#ffb937', p: 'chunks', pc: ['#ff9a1f'], desc: '연속 처치마다 공격 속도 +3% (최대 +36%)', fx: { procs: [{ k: 'comboHaste', per: 0.03, max: 0.36 }] } },
  { id: 'butterpecan', name: '버터피칸', grade: 'sprinkle', c: '#f1d29a', p: 'chunks', pc: ['#9a6332'], desc: '코인 획득 +28%, 자석 범위 +45%', fx: { stats: { coin: 0.28, pickup: 0.45 } } },
  { id: 'lavender', name: '라벤더', grade: 'sprinkle', c: '#cbb6ff', p: 'dust', pc: ['#9a7ae6'], desc: '3초마다 잔잔한 파동으로 주변에 피해와 둔화', fx: { procs: [{ k: 'pulse', every: 3, r: 150, dmg: 0.9, slow: 0.35, dur: 1.5, color: '#c3a8ff' }] } },
  { id: 'cheesecake', name: '딸기 치즈케이크', grade: 'sprinkle', c: '#ffe3e8', p: 'swirl', pc: ['#ff6f8e'], desc: '웨이브 시작마다 피해를 1회 막는 보호막', fx: { procs: [{ k: 'waveShield', n: 1 }] } },

  // ── 젤라또 ───────────────────────────────────────────────
  { id: 'stracciatella', name: '스트라치아텔라', grade: 'gelato', c: '#fdf9f0', p: 'chips', pc: ['#2e1c12'], desc: '치명타 시 초코 파편 2개가 추가로 튀어나감', fx: { procs: [{ k: 'critShards', n: 2, dmg: 0.5, color: '#3a2416' }] } },
  { id: 'gianduja', name: '잔두야', grade: 'gelato', c: '#9e6d46', p: 'swirl', pc: ['#6f4628'], desc: '공격력 +18%, 마지막 한 층일 때 공격력 +35% 추가', fx: { stats: { dmg: 0.18 }, procs: [{ k: 'lastStand', dmg: 0.35 }] } },
  { id: 'limoncello', name: '레몬첼로', grade: 'gelato', c: '#fff47e', p: 'dust', pc: ['#e3c400'], desc: '처치할 때마다 체력 1.5 회복', fx: { procs: [{ k: 'killHeal', heal: 1.5 }] } },
  { id: 'yuzu', name: '유자', grade: 'gelato', c: '#ffdb52', p: 'seeds', pc: ['#d79c00'], desc: '빙결 확률 +8%, 빙결된 적에게 주는 피해 +50%', fx: { procs: [{ k: 'hitFreeze', chance: 0.08, dur: 0.8 }, { k: 'frozenBonus', dmg: 0.5 }] } },
  { id: 'bloodorange', name: '블러드 오렌지', grade: 'gelato', c: '#ff6e4e', p: 'dots', pc: ['#c9301b'], desc: '준 피해의 3%만큼 체력 흡수', fx: { stats: { lifesteal: 0.03 } } },
  { id: 'saltedcaramel', name: '솔티드 카라멜', grade: 'gelato', c: '#e9ab5c', p: 'crystals', pc: ['#ffffff'], desc: '피격 시 소금 결정이 튀어 주변 적에게 큰 피해', fx: { procs: [{ k: 'thorns', r: 120, dmg: 2.2 }] } },

  // ── 선데 ─────────────────────────────────────────────────
  { id: 'ube', name: '우베', grade: 'sundae', c: '#a885e2', p: 'swirl', pc: ['#7f5ac4'], desc: '1.6초마다 가장 가까운 적에게 보라 구슬 자동 발사', fx: { procs: [{ k: 'turret', every: 1.6, dmg: 1.4, color: '#b48cff' }] } },
  { id: 'sakura', name: '벚꽃', grade: 'sundae', c: '#ffcade', p: 'petals', pc: ['#ff9ec2'], desc: '피격 시 꽃잎 폭풍으로 주변 적을 밀어내며 피해 (4초마다)', fx: { procs: [{ k: 'hurtStorm', cd: 4, r: 170, dmg: 1.8, color: '#ffb3d1' }] } },
  { id: 'cola', name: '콜라', grade: 'sundae', c: '#6e3d2c', p: 'fizz', pc: ['#d9a070'], desc: '구르기가 끝나는 곳에서 탄산이 폭발', fx: { procs: [{ k: 'dashBoom', r: 110, dmg: 2.4, color: '#c9894f' }] } },
  { id: 'cookiedough', name: '쿠키 도우', grade: 'sundae', c: '#f4ddb2', p: 'chunks', pc: ['#5b3a21', '#c79a62'], desc: '처치할 때마다 이번 판 공격력 +0.4% (최대 +40%)', fx: { procs: [{ k: 'killStack', per: 0.004, max: 0.4 }] } },
  { id: 'dragonfruit', name: '용과', grade: 'sundae', c: '#ff62aa', p: 'seeds', pc: ['#2b1b22'], desc: '치명타 확률 +12%, 치명타가 적을 둔화', fx: { stats: { crit: 0.12 }, procs: [{ k: 'critSlow', slow: 0.4, dur: 1.5 }] } },

  // ── 빙하 ─────────────────────────────────────────────────
  { id: 'glacierwater', name: '빙하수', grade: 'glacier', c: '#cdf5ff', p: 'glitter', pc: ['#ffffff', '#8fe3ff'], desc: '4초마다 주변을 얼리는 냉기 파동 (1.2초 빙결)', fx: { procs: [{ k: 'freezeNova', every: 4, r: 160, dur: 1.2, dmg: 0.8 }] } },
  { id: 'brownsugar', name: '흑당 버블티', grade: 'glacier', c: '#c69c74', p: 'boba', pc: ['#3a2418'], desc: '타피오카 펄 3개가 주위를 돌며 적을 튕겨냄', fx: { procs: [{ k: 'orbit', n: 3, r: 78, dmg: 1.1, color: '#3a2418' }] } },
  { id: 'milktea', name: '로얄 밀크티', grade: 'glacier', c: '#e2c2a2', p: 'swirl', pc: ['#c49a72'], desc: '받는 피해 -15%, 초당 체력 재생 +1.2', fx: { stats: { armor: 0.15, regen: 1.2 } } },
  { id: 'honeycomb', name: '벌집꿀', grade: 'glacier', c: '#ffc53f', p: 'honeycomb', pc: ['#f09b0f'], desc: '공격력 +15%, 처치 시 15% 확률로 코인 2배', fx: { stats: { dmg: 0.15 }, procs: [{ k: 'killCoin', chance: 0.15 }] } },

  // ── 오로라 ───────────────────────────────────────────────
  { id: 'aurora', name: '오로라 셔벗', grade: 'aurora', c: '#b8ffe3', p: 'aurora', pc: ['#7affc8', '#8fc8ff', '#d8a6ff'], desc: '모든 능력 +8%, 공격 시 20% 확률로 오로라 빛이 5명에게 연쇄', fx: { stats: { dmg: 0.08, atk: 0.08, spd: 0.08, armor: 0.08, crit: 0.04, hp: 6 }, procs: [{ k: 'hitChain', chance: 0.2, n: 5, dmg: 0.7, color: '#8affd0' }] } },
  { id: 'unicorn', name: '유니콘', grade: 'aurora', c: '#fbe8ff', p: 'stripes', pc: ['#ffc2e2', '#c9e4ff', '#fff1b8'], desc: '7초마다 피해를 한 번 막는 무지개 보호막이 생김', fx: { procs: [{ k: 'rechargeShield', every: 7 }] } },
  { id: 'snowflower', name: '눈꽃', grade: 'aurora', c: '#f1f9ff', p: 'snow', pc: ['#bfe6ff'], desc: '공격의 22%가 빙결, 빙결된 적을 처치하면 얼음 파편 폭발', fx: { procs: [{ k: 'hitFreeze', chance: 0.22, dur: 1 }, { k: 'shatter', r: 90, dmg: 1.5 }] } },

  // ── 갤럭시 ───────────────────────────────────────────────
  { id: 'galaxy', name: '갤럭시', grade: 'galaxy', c: '#2d1f63', p: 'stars', pc: ['#ffffff', '#ffd6f6', '#9fd8ff'], desc: '6초마다 적이 가장 많은 곳에 블랙홀을 열어 끌어당김', fx: { procs: [{ k: 'blackhole', every: 6, r: 170, dmg: 0.6, dur: 2.4 }] } },
  { id: 'nebula', name: '네뷸라', grade: 'galaxy', c: '#7c3dff', p: 'nebula', pc: ['#ff62d4', '#62d4ff', '#ffffff'], desc: '공격력 +30%, 치명타 +15%, 처치 시 별똥별이 떨어짐', fx: { stats: { dmg: 0.3, crit: 0.15 }, procs: [{ k: 'killMeteor', chance: 0.35, r: 70, dmg: 1.6 }] } },

  // ── OG ───────────────────────────────────────────────────
  { id: 'vanilla', name: '바닐라', grade: 'og', c: '#fff6dc', p: 'bean', pc: ['#3b2a1a'], desc: '원조의 맛: 다른 층 맛 효과 +40%, 층 체력 +25, 초당 재생 +1.5', fx: { stats: { hp: 25, regen: 1.5 }, procs: [{ k: 'amplify', pct: 0.4 }] } },
  { id: 'chocolate', name: '초코', grade: 'og', c: '#6d4027', p: 'none', desc: '진한 맛: 공격력 +35%, 공격 시 20% 확률로 초코 코팅 기절, 기절한 적 피해 +30%', fx: { stats: { dmg: 0.35 }, procs: [{ k: 'hitStun', chance: 0.2, dur: 1.2 }, { k: 'frozenBonus', dmg: 0.3 }] } },
];

export const FLAVOR = Object.fromEntries(FLAVORS.map((f) => [f.id, f]));
