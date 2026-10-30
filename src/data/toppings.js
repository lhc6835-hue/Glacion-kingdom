// Toppings: in-run upgrades. After every wave you pick one of three. They stack and last for the run.
// `w` is the draw weight; `max` caps how many of one topping a run can take.
export const TOPPINGS = [
  { id: 'sprinkles', name: '스프링클 한 줌', icon: '✨', w: 10, max: 8, desc: '공격력 +10%', fx: { stats: { dmg: 0.1 } } },
  { id: 'espresso', name: '에스프레소 샷', icon: '☕', w: 10, max: 8, desc: '공격 속도 +10%', fx: { stats: { atk: 0.1 } } },
  { id: 'wafer', name: '웨이퍼 날개', icon: '🪶', w: 9, max: 6, desc: '이동 속도 +8%', fx: { stats: { spd: 0.08 } } },
  { id: 'cream', name: '휘핑 듬뿍', icon: '☁️', w: 9, max: 8, desc: '층 체력 +10 (모든 층 즉시 회복)', fx: { stats: { hp: 10 } }, onTake: 'healAll' },
  { id: 'nuts', name: '견과류 토핑', icon: '🥜', w: 8, max: 6, desc: '받는 피해 -6%', fx: { stats: { armor: 0.06 } } },
  { id: 'syrup', name: '시럽 한 바퀴', icon: '🍯', w: 8, max: 6, desc: '초당 체력 재생 +0.8', fx: { stats: { regen: 0.8 } } },
  { id: 'cherrytop', name: '꼭대기 체리', icon: '🍒', w: 7, max: 6, desc: '치명타 확률 +6%, 치명타 피해 +15%', fx: { stats: { crit: 0.06, critDmg: 0.15 } } },
  { id: 'magnet', name: '설탕 자석', icon: '🧲', w: 6, max: 4, desc: '자석 범위 +50%, 코인 +10%', fx: { stats: { pickup: 0.5, coin: 0.1 } } },
  { id: 'double', name: '더블 디핑', icon: '➕', w: 4, max: 3, desc: '투사체 +1', fx: { stats: { proj: 1 } } },
  { id: 'pierce', name: '얇은 웨이퍼', icon: '📌', w: 5, max: 3, desc: '관통 +1', fx: { stats: { pierce: 1 } } },
  { id: 'bigscoop', name: '왕 스쿱', icon: '⭕', w: 6, max: 5, desc: '공격 범위 +15%', fx: { stats: { area: 0.15 } } },
  { id: 'dashsugar', name: '슈가 러시', icon: '💨', w: 6, max: 4, desc: '구르기 대기시간 -15%', fx: { stats: { dashCd: -0.15 } } },
  { id: 'frost', name: '서리 가루', icon: '❄️', w: 5, max: 4, desc: '공격 시 8% 확률로 빙결', fx: { procs: [{ k: 'hitFreeze', chance: 0.08, dur: 0.8 }] } },
  { id: 'poprocks', name: '팝핑 캔디', icon: '💥', w: 5, max: 4, desc: '처치 시 15% 확률로 작은 폭발', fx: { procs: [{ k: 'killBoom', chance: 0.15, r: 70, dmg: 0.9, color: '#ff9ad5' }] } },
  { id: 'fizz', name: '사이다 거품', icon: '⚡', w: 4, max: 4, desc: '공격 시 10% 확률로 번개 연쇄', fx: { procs: [{ k: 'hitChain', chance: 0.1, n: 3, dmg: 0.5, color: '#bff4ff' }] } },
  { id: 'orbitchoc', name: '초코볼 위성', icon: '🟤', w: 4, max: 3, desc: '초코볼 2개가 주위를 돈다', fx: { procs: [{ k: 'orbit', n: 2, r: 70, dmg: 0.9, color: '#5a3622' }] } },
  { id: 'vampire', name: '라즈베리 잼', icon: '🩸', w: 3, max: 3, desc: '흡혈 +2%', fx: { stats: { lifesteal: 0.02 } } },
  { id: 'saltspike', name: '소금 결정', icon: '🧂', w: 4, max: 3, desc: '피격 시 주변 적에게 반사 피해', fx: { procs: [{ k: 'thorns', r: 100, dmg: 1.2 }] } },
  { id: 'refill', name: '리필 스쿱', icon: '🍨', w: 0, max: 99, desc: '녹아버린 층 하나를 되살린다', fx: {}, onTake: 'restoreLayer' },
];

export const TOPPING = Object.fromEntries(TOPPINGS.map((t) => [t.id, t]));
