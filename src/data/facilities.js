// Facilities of the Royal City. Each has a keeper, hours, services and lines of dialogue.
// `look` refers to LOOKS in art/characters.js. Hours are [open, close] in game hours.

export const FACILITIES = [
  {
    id: 'guild', name: '모험가 길드 「바람깃」', icon: 'sword', kind: 'hall', hours: [6, 24],
    keeper: { name: '길드장 하르반', look: 'adventurer' },
    desc: '왕국 곳곳에서 들어온 의뢰가 모이는 곳. 입구 옆 게시판에는 오늘도 새 의뢰서가 붙어 있다.',
    services: ['quests', 'rank'],
    lines: [
      '어서 와, 새내기. 깃털이 아직 보송보송하구먼.',
      '게시판 의뢰는 아무거나 골라도 돼. 순서 같은 건 없어. 대신 위험 표시는 꼭 읽고 가라고.',
      '요즘 협곡 쪽에서 이상한 메아리가 들린다는 보고가 늘었어.',
    ],
  },
  {
    id: 'smithy', name: '대장간 「붉은 모루」', icon: 'anvil', kind: 'house', hours: [7, 19],
    keeper: { name: '대장장이 브론', look: 'smith' },
    desc: '화덕 불빛이 골목까지 새어 나온다. 쇠를 두드리는 소리가 하루 종일 끊이지 않는다.',
    services: ['shop:smith', 'repair', 'upgrade'],
    lines: [
      '부리로 쇠를 잡는 건 아니고, 집게가 있지. 무슨 생각을 한 거야?',
      '좋은 날개깃 칼은 가볍고 단단해야 해. 은빛 강 바닥에서 나는 청강석이 최고지.',
      '수리할 장비 있으면 내려놔. 해 지기 전까진 끝내 줄게.',
    ],
  },
  {
    id: 'potion', name: '물약상 「이슬방울」', icon: 'potion', kind: 'house', hours: [8, 20],
    keeper: { name: '약사 미엘', look: 'alchemist' },
    desc: '선반마다 색색의 병이 줄지어 있다. 말린 허브 향이 은은하다.',
    services: ['shop:potion', 'brew'],
    lines: [
      '회복약은 빨강, 해독제는 초록, 날개 피로엔 하늘색이야. 헷갈리지 마.',
      '청옥 호숫가에 피는 달맞이이끼를 가져오면 좋은 걸 만들어 줄게.',
    ],
  },
  {
    id: 'magic', name: '마법 상점 「별을 세는 올빼미」', icon: 'star', kind: 'house', hours: [16, 4],
    keeper: { name: '마도사 오르넬', look: 'mage' },
    desc: '해가 진 뒤에야 문을 여는 이상한 가게. 천장에 매달린 별 모양 등이 저절로 빛난다.',
    services: ['shop:magic', 'identify'],
    lines: [
      '울림의 마법은 깃털 하나하나가 공명하는 데서 시작하지. 들리나? 바람의 음이.',
      '낮엔 졸려. 밤에 와.',
    ],
  },
  {
    id: 'junk', name: '고물상 「잡동사니 둥지」', icon: 'gear', kind: 'house', hours: [9, 18],
    keeper: { name: '수집가 피핀', look: 'merchant' },
    desc: '부서진 시계, 녹슨 투구, 정체 모를 유물이 아무렇게나 쌓여 있다.',
    services: ['shop:junk', 'appraise'],
    lines: [
      '반짝이는 건 일단 모으는 게 우리 까치 가문의 철학이지. 나는 참새지만.',
      '잿빛 첨탑 폐허에서 주운 물건이 있으면 비싸게 쳐줄게.',
    ],
  },
  {
    id: 'inn', name: '여관 「은빛 깃털」', icon: 'tankard', kind: 'house', hours: [0, 24],
    keeper: { name: '여관 주인 로제', look: 'innkeeper' },
    desc: '벽난로 앞 자리는 늘 꽉 차 있다. 여행자들의 소문이 모이는 곳.',
    services: ['rest', 'rumors', 'shop:food'],
    lines: [
      '쉬어 가렴. 깃털이 젖었구나. 따뜻한 씨앗죽 한 그릇 줄까?',
      '어젯밤 동쪽에서 온 상인이 불잎 고원에 불타는 새가 나타났다고 하더라.',
    ],
  },
  {
    id: 'food', name: '음식점 「따뜻한 둥지」', icon: 'bread', kind: 'house', hours: [10, 22],
    keeper: { name: '요리사 바질', look: 'farmer' },
    desc: '갓 구운 씨앗빵 냄새가 거리까지 퍼진다.',
    services: ['shop:food', 'cook'],
    lines: ['오늘의 특선은 산딸기 씨앗파이! 먹으면 한동안 발걸음이 가벼워져.'],
  },
  {
    id: 'store', name: '잡화점 「바구니」', icon: 'bag', kind: 'house', hours: [7, 20],
    keeper: { name: '상인 토비', look: 'merchant' },
    desc: '밧줄, 등잔, 지도, 낚싯대까지 모험에 필요한 건 대부분 있다.',
    services: ['shop:general'],
    lines: ['지도는 공짜로 못 줘. 대신 네가 직접 걸어서 그리는 건 공짜지.'],
  },
  {
    id: 'library', name: '왕립 도서관', icon: 'book', kind: 'hall', hours: [8, 21],
    keeper: { name: '사서 엘로웬', look: 'scholar' },
    desc: '천장까지 닿는 책장. 왕국 건국기와 옛 오스트미어 왕국의 기록이 보관되어 있다.',
    services: ['lore'],
    lines: [
      '글래시온이라는 이름은 「빙하의 노래」에서 왔단다. 북쪽 서리왕관 산의 빙하가 녹아 흐르는 물이 이 땅을 키웠지.',
      '조용히 하렴. 책들도 깃털처럼 예민하단다.',
    ],
  },
  {
    id: 'temple', name: '하늘빛 신전', icon: 'star', kind: 'hall', hours: [5, 22],
    keeper: { name: '사제 세라핀', look: 'priest' },
    desc: '창공의 어머니 「아우라」를 모시는 신전. 높은 종탑에서 아침마다 종이 울린다.',
    services: ['bless', 'save'],
    lines: ['바람이 너의 날개 아래에 있기를.'],
  },
  {
    id: 'bank', name: '깃털 은행', icon: 'bag', kind: 'stone', hours: [9, 17],
    keeper: { name: '출납관 그레이', look: 'scholar' },
    desc: '두꺼운 돌벽과 철문. 왕국의 금화 「깃전」을 보관한다.',
    services: ['bank'],
    lines: ['맡기실 깃전이 있으신가요? 이자는 계절마다 붙습니다.'],
  },
  {
    id: 'auction', name: '경매장 「망치새」', icon: 'gear', kind: 'hall', hours: [12, 20],
    keeper: { name: '경매인 카스', look: 'noble' },
    desc: '희귀한 유물과 장비가 매일 오후 경매에 오른다.',
    services: ['auction'],
    lines: ['오늘의 출품작: 오스트미어 근위대의 은빛 깃장식! 시작가 300깃전!'],
  },
  {
    id: 'stable', name: '마구간 「구름사슴」', icon: 'bag', kind: 'house', hours: [6, 21],
    keeper: { name: '마부 도린', look: 'farmer' },
    desc: '먼 길을 가는 깃털족은 순한 구름사슴의 등에 올라탄다.',
    services: ['mount'],
    lines: ['구름사슴은 겁이 많아. 천둥 치는 날엔 태워 주지 않을 거야.'],
  },
  {
    id: 'barracks', name: '경비대 막사', icon: 'sword', kind: 'stone', hours: [0, 24],
    keeper: { name: '경비대장 레이븐', look: 'guard' },
    desc: '까마귀 경비대가 교대로 성문과 성벽을 지킨다.',
    services: ['bounty'],
    lines: ['성 안에서 소란 피우지 마라. 우린 눈이 좋거든.'],
  },
  {
    id: 'tailor', name: '재봉소 「바늘깃」', icon: 'bag', kind: 'house', hours: [9, 19],
    keeper: { name: '재봉사 리넷', look: 'noble' },
    desc: '목도리, 모자, 망토. 깃털족에게 딱 맞는 옷을 짓는다.',
    services: ['shop:tailor', 'dye'],
    lines: ['그 목도리, 바람에 잘 날리게 조금만 길게 해 줄까?'],
  },
  {
    id: 'bakery', name: '빵집 「씨앗과 꿀」', icon: 'bread', kind: 'house', hours: [5, 15],
    keeper: { name: '제빵사 몰리', look: 'innkeeper' },
    desc: '해가 뜨기도 전에 불이 켜지는 집.',
    services: ['shop:food'],
    lines: ['새벽에 오면 갓 나온 해바라기씨 롤을 먹을 수 있어!'],
  },
];
