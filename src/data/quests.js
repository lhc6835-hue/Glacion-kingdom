// Board requests. None of them have to be done in order. Objective types:
//   visit   — reach a named place (PLACES id)
//   talk    — speak with an NPC by name
//   inspect — examine an interactable (by kind or id)
//   collect — pick up `count` items with the given pickup id
// `turnIn` names the NPC who hands out the reward (otherwise it pays out on completion).

export const QUESTS = [
  {
    id: 'first-flight', title: '첫 날갯짓', type: '탐험', difficulty: 1, rec: 1, giver: '길드장 하르반', region: '청옥 호수',
    reward: { coins: 30, xp: 40 }, risk: '없음. 다만 절벽 끝에서는 발밑을 조심할 것.',
    desc: '새내기 모험가라면 왕관 폭포가 호수로 떨어지는 모습을 가까이에서 봐야 한다. 그걸 보고도 가슴이 뛰지 않는다면 모험가는 그만두는 게 좋다.',
    objectives: [{ type: 'visit', target: 'crownfall', text: '왕관 폭포 가까이 가 보기' }],
    turnIn: '길드장 하르반',
  },
  {
    id: 'moon-moss', title: '호숫가의 달맞이이끼', type: '수집', difficulty: 1, rec: 1, giver: '약사 미엘', region: '청옥 호수',
    reward: { coins: 45, xp: 50, item: '하늘빛 물약' }, risk: '낮음. 물가가 미끄럽다.',
    desc: '날개 피로를 푸는 약에는 청옥 호숫가 바위틈에 자라는 달맞이이끼가 필요하다. 은은하게 빛나서 찾기 어렵지 않을 것이다.',
    objectives: [{ type: 'collect', target: 'moonmoss', count: 5, text: '달맞이이끼 모으기' }],
    turnIn: '약사 미엘',
  },
  {
    id: 'lost-letter', title: '다리 위의 편지', type: '배달', difficulty: 2, rec: 2, giver: '사서 엘로웬', region: '협곡 대교',
    reward: { coins: 60, xp: 70 }, risk: '낮음. 바람이 강한 날은 다리 위에서 날아가지 않게 주의.',
    desc: '잿빛 첨탑 쪽에서 오던 전령이 협곡 대교 위에서 편지 꾸러미를 떨어뜨렸다고 한다. 바람에 날아가기 전에 찾아 도서관으로 가져다 달라.',
    objectives: [{ type: 'collect', target: 'letter', count: 1, text: '협곡 대교에서 편지 찾기' }],
    turnIn: '사서 엘로웬',
  },
  {
    id: 'ruin-epitaph', title: '무너진 비석의 글귀', type: '조사', difficulty: 2, rec: 2, giver: '사서 엘로웬', region: '잿빛 첨탑 요새',
    reward: { coins: 50, xp: 90, lore: 'ostmere-1' }, risk: '보통. 폐허의 벽은 언제 무너질지 모른다.',
    desc: '오스트미어 왕국의 마지막 요새에 남은 비석의 문장을 옮겨 적어 와 달라. 사서의 기록에 빠진 한 줄이 있다고 한다.',
    objectives: [{ type: 'inspect', target: 'lore', text: '잿빛 첨탑 요새의 비석 살펴보기' }],
    turnIn: '사서 엘로웬',
  },
  {
    id: 'gorge-echo', title: '협곡의 메아리', type: '조사', difficulty: 3, rec: 3, giver: '길드장 하르반', region: '은빛 협곡',
    reward: { coins: 120, xp: 160 }, risk: '높음. 협곡 바닥은 급류와 낙석이 잦다. 활공할 높이를 확보할 것.',
    desc: '은빛 협곡 깊은 곳에서 누군가 부르는 듯한 메아리가 들린다는 보고가 잇따른다. 협곡 안쪽까지 들어가 무엇이 있는지 확인하라.',
    objectives: [{ type: 'visit', target: 'gorge', text: '은빛 협곡 깊숙이 들어가기' }, { type: 'visit', target: 'gorgemouth', text: '협곡 어귀 폭포 확인하기' }],
    turnIn: '길드장 하르반',
  },
  {
    id: 'bread-run', title: '경비병의 아침', type: '배달', difficulty: 1, rec: 1, giver: '제빵사 몰리', region: '왕도',
    reward: { coins: 20, xp: 25, item: '해바라기씨 롤' }, risk: '없음.',
    desc: '남문 경비병들이 밤새 근무하느라 아침을 못 먹었다. 갓 구운 롤을 전해 주자.',
    objectives: [{ type: 'talk', target: '남문 경비병', text: '남문 경비병에게 빵 전해 주기' }],
    turnIn: '제빵사 몰리',
  },
  {
    id: 'tierfalls', title: '계단 폭포를 찾아서', type: '탐험', difficulty: 2, rec: 2, giver: '수집가 피핀', region: '잿빛 첨탑 남쪽',
    reward: { coins: 55, xp: 80 }, risk: '보통. 지도에 없는 곳이다.',
    desc: '잿빛 절벽 남쪽 어딘가에 물이 계단처럼 세 번 떨어지는 폭포가 있다는 옛 지도를 샀다. 정말 있는지 확인해 줄 사람?',
    objectives: [{ type: 'visit', target: 'tierfalls', text: '계단 폭포 찾기' }],
    turnIn: '수집가 피핀',
  },
  {
    id: 'ruin-shards', title: '반짝이는 파편', type: '수집', difficulty: 2, rec: 2, giver: '수집가 피핀', region: '잿빛 첨탑 요새',
    reward: { coins: 80, xp: 60 }, risk: '보통.',
    desc: '폐허 바닥에 떨어진 오스트미어 유리 파편은 햇빛을 받으면 무지개를 만든다. 세 개만 주워 와 달라.',
    objectives: [{ type: 'collect', target: 'shard', count: 3, text: '오스트미어 유리 파편 줍기' }],
    turnIn: '수집가 피핀',
  },
  {
    id: 'eastwatch', title: '동쪽 망루 언덕 정찰', type: '탐험', difficulty: 2, rec: 2, giver: '경비대장 레이븐', region: '동쪽 망루 언덕',
    reward: { coins: 70, xp: 90 }, risk: '보통. 고원 길이 험하다.',
    desc: '동쪽 교역로를 내려다보는 망루 언덕에 올라 이상이 없는지 살펴보고 오라.',
    objectives: [{ type: 'visit', target: 'eastbluff', text: '동쪽 망루 언덕 오르기' }],
    turnIn: '경비대장 레이븐',
  },
  {
    id: 'elderwood', title: '노목의 숲으로', type: '탐험', difficulty: 3, rec: 3, giver: '요리사 바질', region: '노목의 숲',
    reward: { coins: 90, xp: 110, item: '숲버섯 꾸러미' }, risk: '보통. 숲이 깊어 길을 잃기 쉽다.',
    desc: '남쪽 숲길 끝, 오래된 나무들이 하늘을 가리는 숲에 들어가 길이 아직 살아 있는지 확인해 주게. 버섯이 필요하거든.',
    objectives: [{ type: 'visit', target: 'elderwood', text: '노목의 숲 깊숙이 들어가기' }],
    turnIn: '요리사 바질',
  },
  {
    id: 'castle-view', title: '성문 앞에서 본 풍경', type: '탐험', difficulty: 1, rec: 1, giver: '재봉사 리넷', region: '발크레스트 왕성',
    reward: { coins: 35, xp: 40 }, risk: '없음.',
    desc: '새 망토 무늬로 왕국의 전경을 넣고 싶다. 왕성 오르막을 끝까지 올라가 성문 앞에서 내려다본 풍경을 이야기해 달라.',
    objectives: [{ type: 'visit', target: 'castle', text: '왕성 정문 앞까지 오르기' }, { type: 'inspect', target: 'castle-gate', text: '왕성 정문 살펴보기' }],
    turnIn: '재봉사 리넷',
  },
  {
    id: 'fountain-riddle', title: '「바람은 돌아온다」', type: '조사', difficulty: 1, rec: 1, giver: '사제 세라핀', region: '왕관 광장',
    reward: { coins: 25, xp: 60, lore: 'aura-1' }, risk: '없음.',
    desc: '광장 분수의 글귀가 무슨 뜻인지 아는 이는 드물다. 분수를 살펴보고 신전으로 돌아오라.',
    objectives: [{ type: 'inspect', target: 'fountain', text: '광장 분수 살펴보기' }],
    turnIn: '사제 세라핀',
  },
];

export const LORE = {
  'ostmere-1': { title: '오스트미어의 마지막 날개', text: '글래시온 이전, 서쪽 절벽 위에는 오스트미어라는 왕국이 있었다. 그들은 「노래하는 빙하수」로 하늘을 다스렸다고 전해진다. 노래가 끊긴 날, 왕국은 하룻밤 사이에 잿빛으로 변했다.' },
  'aura-1': { title: '창공의 어머니 아우라', text: '깃털족은 모든 바람이 언젠가 처음 불어온 곳으로 돌아간다고 믿는다. 떠난 이를 배웅할 때 「바람은 돌아온다」고 말하는 것은 그 때문이다.' },
};
