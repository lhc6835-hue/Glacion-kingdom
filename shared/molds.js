// Molds (틀): the vessel the ice cream stands in. Decides how many scoop layers (= lives) you have
// and gives its own trait. Sold in the 틀 갤러리, one floor per pair of grades.
export const MOLDS = [
  // 1층 — 얼음조각 · 소프트
  { id: 'papercup', name: '종이컵', grade: 'chip', layers: 1, price: 0, desc: '가벼움: 이동 속도 +6%', fx: { stats: { spd: 0.06 } } },
  { id: 'stick', name: '나무 막대', grade: 'chip', layers: 1, price: 180, desc: '손에 착: 공격 속도 +9%', fx: { stats: { atk: 0.09 } } },
  { id: 'cakecone', name: '케이크콘', grade: 'chip', layers: 2, price: 420, desc: '든든한 바닥: 층 체력 +5', fx: { stats: { hp: 5 } } },
  { id: 'sugarcone', name: '슈가콘', grade: 'soft', layers: 2, price: 900, desc: '달콤한 행운: 코인 획득 +15%', fx: { stats: { coin: 0.15 } } },
  { id: 'minicup', name: '미니컵', grade: 'soft', layers: 1, price: 1100, desc: '작고 재빠름: 이동 속도 +16%, 몸집 -15%', fx: { stats: { spd: 0.16, size: -0.15 } } },
  { id: 'wafflebowl', name: '와플 볼', grade: 'soft', layers: 2, price: 1500, desc: '바삭한 갑옷: 받는 피해 -9%', fx: { stats: { armor: 0.09 } } },
  // 2층 — 스쿱 · 스프링클
  { id: 'glass', name: '유리 디저트 잔', grade: 'scoop', layers: 2, price: 2400, desc: '반짝임: 치명타 확률 +9%', fx: { stats: { crit: 0.09 } } },
  { id: 'fishbread', name: '붕어빵 콘', grade: 'scoop', layers: 2, price: 3000, desc: '팥 속 여유: 피격 후 무적 시간 +50%', fx: { stats: { iframe: 0.5 } } },
  { id: 'waffle', name: '와플콘', grade: 'scoop', layers: 3, price: 3800, desc: '세 층의 기본기: 층 체력 +4', fx: { stats: { hp: 4 } } },
  { id: 'pretzel', name: '프레첼 콘', grade: 'sprinkle', layers: 3, price: 5600, desc: '짭짤한 손맛: 넉백 +30%, 공격력 +6%', fx: { stats: { knock: 0.3, dmg: 0.06 } } },
  { id: 'macaron', name: '마카롱 샌드', grade: 'sprinkle', layers: 2, price: 6800, desc: '말랑 점프: 구르기 대기시간 -28%', fx: { stats: { dashCd: -0.28 } } },
  { id: 'dipcone', name: '초코 딥 콘', grade: 'sprinkle', layers: 3, price: 8200, desc: '초코 코팅: 공격력 +11%', fx: { stats: { dmg: 0.11 } } },
  // 3층 — 젤라또 · 선데
  { id: 'gelatocup', name: '젤라또 컵', grade: 'gelato', layers: 3, price: 13500, desc: '장인의 주걱: 공격 속도 +13%', fx: { stats: { atk: 0.13 } } },
  { id: 'mochi', name: '찹쌀떡', grade: 'gelato', layers: 2, price: 16000, desc: '쫀득함: 나를 때린 적이 2초간 40% 둔화', fx: { stats: { hp: 8 }, procs: [{ k: 'hurtSticky', r: 60, slow: 0.4, dur: 2, heal: 0 }] } },
  { id: 'crepe', name: '크레페', grade: 'gelato', layers: 3, price: 19500, desc: '돌돌 말기: 자석 범위 +60%, 코인 +15%', fx: { stats: { pickup: 0.6, coin: 0.15 } } },
  { id: 'croffle', name: '크로플', grade: 'sundae', layers: 3, price: 30000, desc: '겹겹이 버터: 처치 시 4% 확률로 체력 6 회복', fx: { procs: [{ k: 'killHeal', heal: 6, chance: 0.04 }] } },
  { id: 'boat', name: '바나나 스플릿 보트', grade: 'sundae', layers: 3, price: 34000, desc: '세 갈래: 투사체 +1', fx: { stats: { proj: 1 } } },
  { id: 'parfait', name: '파르페 잔', grade: 'sundae', layers: 4, price: 38000, desc: '높이 쌓기: 네 층까지 쌓을 수 있음', fx: { stats: {} } },
  // 4층 — 빙하 · 오로라
  { id: 'bingsu', name: '빙수 그릇', grade: 'glacier', layers: 3, price: 62000, desc: '눈꽃 얼음: 주변 적 이동 속도 -22%', fx: { procs: [{ k: 'chillAura', r: 135, slow: 0.22 }] } },
  { id: 'affogato', name: '아포가토 잔', grade: 'glacier', layers: 2, price: 70000, desc: '에스프레소 샷: 공격 속도 +30%, 이동 속도 +10%', fx: { stats: { atk: 0.3, spd: 0.1 } } },
  { id: 'cake', name: '아이스크림 케이크', grade: 'glacier', layers: 4, price: 88000, desc: '축하의 층: 층 체력 +14, 받는 피해 -10%', fx: { stats: { hp: 14, armor: 0.1 } } },
  { id: 'turkish', name: '터키 아이스크림 콘', grade: 'aurora', layers: 3, price: 150000, desc: '밀당의 달인: 50% 확률로 공격 회피', fx: { stats: { dodge: 0.5 } } },
  { id: 'cloud', name: '구름 콘', grade: 'aurora', layers: 3, price: 175000, desc: '두둥실: 바닥 장판 피해 무시, 이동 속도 +20%', fx: { stats: { spd: 0.2, floaty: 1 } } },
  // 5층 — 갤럭시 · OG
  { id: 'space', name: '우주 아이스크림 팩', grade: 'galaxy', layers: 4, price: 380000, desc: '무중력: 구르기 거리 2배, 구르며 부딪힌 적에게 피해', fx: { stats: { dashDist: 1 }, procs: [{ k: 'dashHit', dmg: 2 }] } },
  { id: 'chalice', name: '크리스탈 성배', grade: 'galaxy', layers: 5, price: 450000, desc: '다섯 층의 성배: 층 체력 +10', fx: { stats: { hp: 10 } } },
  { id: 'classic', name: '기본 아이스크림 콘', grade: 'og', layers: 3, price: 1000000, desc: '원조: 아래층 맛 효과가 줄지 않음, 모든 능력 +10%, 한 판에 한 번 모든 층을 되살림', fx: { stats: { dmg: 0.1, atk: 0.1, spd: 0.1, armor: 0.1, hp: 6 }, procs: [{ k: 'noDecay' }, { k: 'revive' }] } },
];

export const MOLD = Object.fromEntries(MOLDS.map((m) => [m.id, m]));
