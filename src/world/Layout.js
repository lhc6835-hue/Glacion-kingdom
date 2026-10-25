// The hand-authored geography of Glacion (2D / HD-2D edition).
// Axes: +x = east, -z = north (up the screen), y = height in metres. One map cell = 2 m.
// The camera always faces north, so south-facing cliffs, facades and waterfalls face the player.
//
// Opening view from Sunmeadow Rise looks north across Mirrorlake: the Royal Plateau and Castle
// Valcrest on the right, the Greyspire cliffs and the old fortress on the left, the Gorge Bridge
// between them, and the Frostcrown range on the horizon.

export const CELL = 2;
export const N = 1024;              // cells per side
export const HALF = (N * CELL) / 2; // 1024 m
export const WATER = 0;
export const CITY_H = 56;

export const START = { x: 132, z: 446 };

export const LAKE = { x: 20, z: 205, rx: 262, rz: 172 };

// Mesas are flat-topped plateaus with sheer cliff edges.
export const MESAS = [
  { id: 'royal', x: 300, z: -160, rx: 330, rz: 252, h: 56, rim: 0.05 },
  { id: 'castle', x: 382, z: -304, rx: 112, rz: 78, h: 84, rim: 0.08 },
  { id: 'greyspire', x: -432, z: -60, rx: 252, rz: 330, h: 58, rim: 0.07 },
  { id: 'greyspire-crown', x: -470, z: -150, rx: 120, rz: 140, h: 74, rim: 0.1 },
  { id: 'gorge', x: -104, z: -480, rx: 86, rz: 540, h: 14, rim: 0.04 },
  { id: 'ledge-1', x: -338, z: 256, rx: 46, rz: 40, h: 40, rim: 0.08 },
  { id: 'ledge-2', x: -290, z: 262, rx: 40, rz: 34, h: 20, rim: 0.08 },
  { id: 'eastbluff', x: 760, z: 80, rx: 160, rz: 120, h: 26, rim: 0.12 },
];

export const CITY_WALL = { x: 300, z: -146, rx: 268, rz: 202 };
export const CASTLE = { x: 382, z: -310 };

export const GORGE_BRIDGE = { x0: -192, x1: -24, z: -112, deck: 57, width: 8 };

// Rivers follow the ground; wherever the ground under the river drops sharply a waterfall forms.
export const RIVERS = [
  {
    id: 'silverrun', name: '은빛 강', points: [
      { x: -82, z: -1030, w: 9 }, { x: -96, z: -760, w: 10 }, { x: -112, z: -520, w: 11 },
      { x: -100, z: -300, w: 11 }, { x: -108, z: -112, w: 11 }, { x: -98, z: -10, w: 12 },
      { x: -94, z: 40, w: 12 }, { x: -90, z: 72, w: 13 },
    ],
  },
  {
    // Spring-fed canal from beneath the castle rock, through the city, off the south-west rim.
    id: 'crowncanal', name: '왕관 수로', canal: true, points: [
      { x: 344, z: -238, w: 3.2 }, { x: 300, z: -170, w: 3.2 }, { x: 236, z: -96, w: 3.4 },
      { x: 160, z: -34, w: 3.6 }, { x: 96, z: 4, w: 4.2 }, { x: 70, z: 22, w: 5 }, { x: 52, z: 60, w: 7 },
    ],
  },
  {
    // A second, slimmer veil to the east of the Crownfall.
    id: 'veilcanal', name: '면사포 수로', canal: true, points: [
      { x: 236, z: -96, w: 2.2 }, { x: 196, z: -10, w: 2.2 }, { x: 178, z: 50, w: 2.6 }, { x: 170, z: 96, w: 4 },
    ],
  },
  {
    id: 'tierstream', name: '계단 개울', points: [
      { x: -452, z: 170, w: 3 }, { x: -404, z: 236, w: 3.4 }, { x: -370, z: 254, w: 3.6 },
      { x: -338, z: 256, w: 3.8 }, { x: -290, z: 262, w: 4 }, { x: -250, z: 262, w: 4.4 }, { x: -222, z: 252, w: 6 },
    ],
  },
  {
    id: 'lowmere', name: '로우미어 강', points: [
      { x: 236, z: 310, w: 12 }, { x: 330, z: 420, w: 13 }, { x: 420, z: 560, w: 14 },
      { x: 520, z: 760, w: 15 }, { x: 600, z: 1030, w: 16 },
    ],
  },
];

// Roads. Points with `y` force the road to that height (ramps and causeways);
// points without follow the land.
export const ROADS = [
  {
    id: 'kingsroad', name: '왕의 길', width: 6, points: [
      { x: -150, z: 600 }, { x: -110, z: 480 }, { x: -30, z: 430 }, { x: 100, z: 405 }, { x: 222, z: 394 },
      { x: 300, z: 370 }, { x: 440, z: 300 }, { x: 560, z: 230 }, { x: 640, z: 170, y: 2 },
      { x: 600, z: 128, y: 12 }, { x: 530, z: 104, y: 30 }, { x: 460, z: 88, y: 48 }, { x: 410, z: 80, y: 56 },
      { x: 340, z: 70, y: 56 }, { x: 300, z: 60, y: 56 }, { x: 300, z: 30, y: 56 },
    ],
  },
  {
    // Up the south face of the Greyspire heights to the ruined fortress and the bridge.
    id: 'cliffroad', name: '절벽 옛길', width: 4, points: [
      { x: -150, z: 600 }, { x: -300, z: 520 }, { x: -440, z: 470 }, { x: -520, z: 430, y: 2 },
      { x: -580, z: 380, y: 18 }, { x: -590, z: 310, y: 38 }, { x: -560, z: 262, y: 58 },
      { x: -460, z: 160, y: 58 }, { x: -330, z: 40, y: 58 }, { x: -240, z: -80, y: 58 }, { x: -200, z: -112, y: 58 },
    ],
  },
  {
    // Ramp up the south face of the castle rock to the castle gate.
    id: 'castleramp', name: '왕성 오르막', width: 5, points: [
      { x: 470, z: -150, y: 56 }, { x: 476, z: -196, y: 58 }, { x: 452, z: -216, y: 66 },
      { x: 412, z: -222, y: 76 }, { x: 388, z: -226, y: 84 }, { x: 382, z: -250, y: 84 },
    ],
  },
  {
    id: 'eastroad', name: '동쪽 교역로', width: 5, points: [
      { x: 640, z: 170 }, { x: 700, z: 210 }, { x: 860, z: 260 }, { x: 1030, z: 300 },
    ],
  },
  {
    id: 'southroad', name: '남쪽 숲길', width: 4, points: [
      { x: 300, z: 370 }, { x: 330, z: 520 }, { x: 300, z: 700 }, { x: 360, z: 880 }, { x: 420, z: 1030 },
    ],
  },
];

// Named places. Hidden places stay off the compass until discovered.
export const PLACES = [
  { id: 'sunmeadow', name: '햇살 언덕', sub: 'Sunmeadow Rise', x: 110, z: 500, r: 110 },
  { id: 'mirrorlake', name: '청옥 호수', sub: 'Mirrorlake', x: 20, z: 205, r: 220 },
  { id: 'crownfall', name: '왕관 폭포', sub: 'The Crownfall', x: 62, z: 40, r: 70 },
  { id: 'tierfalls', name: '계단 폭포', sub: 'Tierfalls', x: -300, z: 262, r: 70, hidden: true },
  { id: 'gorgemouth', name: '협곡 어귀', sub: 'Gorgemouth', x: -94, z: 50, r: 60, hidden: true },
  { id: 'city', name: '글래시온 왕도', sub: 'Royal City of Glacion', x: 300, z: -140, r: 230 },
  { id: 'castle', name: '발크레스트 왕성', sub: 'Castle Valcrest', x: 382, z: -310, r: 100 },
  { id: 'bridge', name: '협곡 대교', sub: 'The Gorge Bridge', x: -108, z: -112, r: 70 },
  { id: 'greyspire', name: '잿빛 첨탑 요새', sub: 'Greyspire Hold (ruins)', x: -214, z: -150, r: 70 },
  { id: 'gorge', name: '은빛 협곡', sub: 'Silverrun Gorge', x: -104, z: -400, r: 120, hidden: true },
  { id: 'elderwood', name: '노목의 숲', sub: 'The Elderwood', x: 420, z: 780, r: 260 },
  { id: 'eastbluff', name: '동쪽 망루 언덕', sub: 'Eastwatch Bluff', x: 760, z: 80, r: 140 },
];
