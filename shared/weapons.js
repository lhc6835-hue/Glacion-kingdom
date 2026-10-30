// Weapons, drawn from the weapon gacha. `kind` selects the behaviour in game/weapons.js;
// every kind has its own attack pattern and animation. dmg is per hit, cd is seconds per attack.
export const WEAPONS = [
  { id: 'spoon', name: '나무 숟가락', grade: 'chip', kind: 'swing', dmg: 14, cd: 0.42, range: 92, arc: 2.3, desc: '세 번 이어지는 퍼올리기 베기. 세 번째는 크게 휘두른다.' },
  { id: 'chipgun', name: '초코칩 연사총', grade: 'chip', kind: 'rapid', dmg: 5, cd: 0.1, speed: 820, spread: 0.12, desc: '초코칩을 쉴 새 없이 쏜다.' },
  { id: 'shotgun', name: '스프링클 샷건', grade: 'soft', kind: 'shotgun', dmg: 6, cd: 0.72, speed: 760, pellets: 7, spread: 0.55, desc: '알록달록 스프링클을 부채꼴로 흩뿌린다. 가까울수록 강하다.' },
  { id: 'boomerang', name: '콘 부메랑', grade: 'soft', kind: 'boomerang', dmg: 13, cd: 0.85, range: 380, desc: '콘을 던지면 빙글빙글 돌아온다. 오가며 관통.' },
  { id: 'popsicle', name: '아이스바 창', grade: 'scoop', kind: 'thrust', dmg: 22, cd: 0.62, range: 150, desc: '앞으로 쭉 찌르며 살짝 돌진. 일직선 관통.' },
  { id: 'jelly', name: '젤리 블래스터', grade: 'scoop', kind: 'bouncer', dmg: 11, cd: 0.46, speed: 560, bounces: 3, desc: '말랑한 젤리가 적 사이를 통통 튀어다닌다.' },
  { id: 'cherrybomb', name: '체리 폭탄', grade: 'sprinkle', kind: 'lob', dmg: 30, cd: 1.05, radius: 105, desc: '포물선으로 던진 체리가 펑! 넓게 터진다.' },
  { id: 'syrupwhip', name: '시럽 채찍', grade: 'sprinkle', kind: 'whip', dmg: 18, cd: 0.7, range: 230, desc: '출렁이는 시럽 채찍. 끝부분에 맞으면 치명타.' },
  { id: 'whipcream', name: '휘핑크림 분사기', grade: 'gelato', kind: 'spray', dmg: 4.2, cd: 0.06, range: 230, desc: '누르고 있는 동안 크림을 뿜어 적을 밀고 느리게 한다.' },
  { id: 'lollihammer', name: '막대사탕 해머', grade: 'gelato', kind: 'hammer', dmg: 52, cd: 1.15, radius: 150, desc: '크게 들어 올렸다가 쾅! 충격파로 주변을 기절시킨다.' },
  { id: 'sodalaser', name: '탄산 레이저', grade: 'sundae', kind: 'beam', dmg: 9, cd: 0.09, range: 620, desc: '누르면 기포가 모여 관통 광선이 뿜어진다.' },
  { id: 'candybow', name: '지팡이사탕 활', grade: 'sundae', kind: 'bow', dmg: 34, cd: 0.25, speed: 1150, desc: '당겼다 놓는 활. 끝까지 당기면 관통 화살 3발.' },
  { id: 'cottonwand', name: '솜사탕 구름 지팡이', grade: 'glacier', kind: 'cloud', dmg: 9, cd: 0.16, radius: 120, desc: '조준점을 따라다니는 구름에서 사탕비가 내린다.' },
  { id: 'scooper', name: '스쿱 런처', grade: 'glacier', kind: 'scooplauncher', dmg: 40, cd: 0.95, radius: 90, desc: '커다란 아이스크림 덩이를 발사! 떨어진 곳이 얼어붙는다.' },
  { id: 'aurora', name: '오로라 리본', grade: 'aurora', kind: 'ribbon', dmg: 26, cd: 0.55, range: 340, desc: '리본이 주위를 감싸고, 휘두르면 빛의 파도가 날아간다.' },
  { id: 'macaron', name: '은하 마카롱', grade: 'galaxy', kind: 'orbitals', dmg: 20, cd: 2.4, radius: 120, desc: '마카롱 위성이 돌고, 클릭하면 조준점에 작은 블랙홀을 연다.' },
  { id: 'goldspoon', name: '황금 원조 숟가락', grade: 'og', kind: 'goldswing', dmg: 46, cd: 0.5, range: 130, arc: 2.6, desc: '원조의 일격. 휘두를 때마다 황금빛 스쿱 파동이 날아간다.' },
];

export const WEAPON = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
