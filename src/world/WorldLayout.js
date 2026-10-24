// The hand-authored geography of Glacion. Procedural noise fills in the detail,
// but every landmark that matters for composition and story is placed here on purpose.
//
// Axes: +x = east, -z = north, y = up. Units are metres.
// The opening vista looks north from Sunmeadow Rise: the lake at the bottom of the frame,
// the Royal Plateau and castle on the right, the Greyspire cliffs and old fortress on the left,
// the Silverrun gorge and the Gorge Bridge in the middle, and the Frostcrown range behind.

export const WORLD_HALF = 3000;
export const LAKE_LEVEL = 30;
export const CITY_LEVEL = 150;

export const START = { x: -118, z: 642, yaw: Math.PI * 0.92 }; // facing north-north-east toward the castle

export const LAKE = { x: 40, z: 330, rx: 330, rz: 215, rot: 0.18 };

export const ROYAL_PLATEAU = { x: 380, z: -120, rx: 430, rz: 370, height: CITY_LEVEL };
export const CASTLE = { x: 470, z: -330, rockHeight: 34 }; // castle sits on a rock above the city

// The city wall follows this ellipse (slightly inside the plateau rim).
export const CITY_WALL = { x: 390, z: -110, rx: 320, rz: 275 };

export const GREYSPIRE = { x: -560, z: -80, rx: 360, rz: 470, height: 168 };
export const GREYSPIRE_HOLD = { x: -275, z: -120 }; // the old fortress on the east rim of the cliffs

// Gorge bridge from the Greyspire rim to the Cliff Gate of the city.
export const GORGE_BRIDGE = {
  a: { x: -222, z: -95 },
  b: { x: 18, z: -95 },
  deck: 157,
  width: 9,
};

// Rivers: polyline points with a water surface height `y` and half-width `w`.
// Waterfalls are simply segments where the surface height drops sharply.
export const RIVERS = [
  {
    id: 'silverrun', name: '은빛 강', points: [
      { x: -60, z: -1500, y: 330, w: 14 },
      { x: -95, z: -1150, y: 210, w: 16 },
      { x: -120, z: -820, y: 118, w: 18 },
      { x: -110, z: -520, y: 74, w: 18 },
      { x: -108, z: -300, y: 62, w: 17 },
      { x: -112, z: -95, y: 56, w: 16 },
      { x: -96, z: 50, y: 52, w: 17 },
      { x: -82, z: 92, y: 50, w: 17 },
      { x: -74, z: 108, y: 31, w: 18 }, // Gorgemouth Falls into the lake
      { x: -66, z: 140, y: 30, w: 22 },
    ],
  },
  {
    // Fed by springs beneath the castle rock; runs as a canal through the city
    // and plunges off the south-west rim: the Crownfall.
    id: 'crowncanal', name: '왕관 수로', canal: true, points: [
      { x: 430, z: -255, y: 150.6, w: 4.5 },
      { x: 360, z: -170, y: 150.0, w: 4.5 },
      { x: 300, z: -60, y: 149.4, w: 5 },
      { x: 205, z: 40, y: 148.8, w: 5.5 },
      { x: 150, z: 96, y: 148.4, w: 6.5 },
      { x: 128, z: 118, y: 148.0, w: 7.5 },
      { x: 112, z: 134, y: 31, w: 10 }, // Crownfall
      { x: 92, z: 160, y: 30, w: 14 },
    ],
  },
  {
    // A tumbling stream off the Greyspire heights, falling in tiers into the lake's west bay.
    id: 'tierstream', name: '계단 개울', points: [
      { x: -520, z: 330, y: 150, w: 4 },
      { x: -455, z: 360, y: 140, w: 4.5 },
      { x: -420, z: 372, y: 108, w: 5 },
      { x: -380, z: 385, y: 104, w: 5.5 },
      { x: -352, z: 392, y: 74, w: 6 },
      { x: -318, z: 398, y: 70, w: 6.5 },
      { x: -306, z: 402, y: 46, w: 7 },
      { x: -288, z: 404, y: 42, w: 8 },
      { x: -270, z: 405, y: 30.5, w: 9 },
      { x: -240, z: 402, y: 30, w: 12 },
    ],
  },
  {
    id: 'lowmere', name: '로우미어 강', points: [
      { x: 330, z: 455, y: 30, w: 16 },
      { x: 470, z: 620, y: 27, w: 20 },
      { x: 610, z: 860, y: 23, w: 22 },
      { x: 700, z: 1200, y: 18, w: 24 },
      { x: 850, z: 1600, y: 12, w: 26 },
      { x: 1050, z: 2100, y: 6, w: 28 },
      { x: 1200, z: 2900, y: 2, w: 30 },
    ],
  },
];

// Roads: the terrain is graded to the road so it is always walkable.
export const ROADS = [
  {
    // The King's Road: from Sunmeadow Rise, around the lake's east shore, up to the South Gate.
    id: 'kingsroad', name: '왕의 길', width: 7, points: [
      { x: -175, z: 860 }, { x: -160, z: 760 }, { x: -128, z: 680 }, { x: -60, z: 650 }, { x: 70, z: 630 },
      { x: 210, z: 600 }, { x: 330, z: 560 }, { x: 430, z: 500 }, { x: 520, z: 400 },
      { x: 590, z: 300 }, { x: 600, z: 230 }, { x: 560, z: 190 }, { x: 500, z: 175 },
    ],
  },
  {
    // Old west road: from the Greyspire bridge-head, south along the cliffs to the tier stream.
    id: 'cliffroad', name: '절벽 옛길', width: 5, points: [
      { x: -230, z: -95 }, { x: -300, z: -40 }, { x: -340, z: 80 }, { x: -380, z: 200 },
      { x: -420, z: 290 }, { x: -470, z: 400 }, { x: -420, z: 560 }, { x: -300, z: 720 }, { x: -175, z: 790 },
    ],
  },
  {
    // East trade road toward the Emberleaf highlands.
    id: 'eastroad', name: '동쪽 교역로', width: 6, points: [
      { x: 690, z: -60 }, { x: 820, z: -10 }, { x: 980, z: 60 }, { x: 1200, z: 120 }, { x: 1500, z: 140 },
    ],
  },
  {
    // South road into the Elderwood and the river ford.
    id: 'southroad', name: '남쪽 숲길', width: 5, points: [
      { x: 330, z: 560 }, { x: 420, z: 720 }, { x: 560, z: 900 }, { x: 640, z: 1060 }, { x: 760, z: 1300 },
    ],
  },
];

// Named places. `hidden` places do not show on the compass until discovered.
export const PLACES = [
  { id: 'sunmeadow', name: '햇살 언덕', sub: 'Sunmeadow Rise', x: -160, z: 780, r: 140 },
  { id: 'mirrorlake', name: '청옥 호수', sub: 'Mirrorlake', x: 40, z: 330, r: 260 },
  { id: 'crownfall', name: '왕관 폭포', sub: 'The Crownfall', x: 110, z: 150, r: 90 },
  { id: 'gorgemouth', name: '협곡 어귀 폭포', sub: 'Gorgemouth Falls', x: -76, z: 112, r: 70 },
  { id: 'tierfalls', name: '계단 폭포', sub: 'Tierfalls', x: -350, z: 392, r: 90, hidden: true },
  { id: 'city', name: '글래시온 왕도', sub: 'Royal City of Glacion', x: 390, z: -110, r: 300 },
  { id: 'castle', name: '글래시온 왕성', sub: 'Castle Valcrest', x: 470, z: -330, r: 110 },
  { id: 'bridge', name: '협곡 대교', sub: 'The Gorge Bridge', x: -100, z: -95, r: 80 },
  { id: 'greyspire', name: '잿빛 첨탑 요새', sub: 'Greyspire Hold (ruins)', x: -275, z: -120, r: 90 },
  { id: 'gorge', name: '은빛 협곡', sub: 'Silverrun Gorge', x: -110, z: -400, r: 150, hidden: true },
  { id: 'elderwood', name: '노목의 숲', sub: 'The Elderwood', x: 650, z: 1050, r: 350 },
  { id: 'emberleaf', name: '불잎 고원', sub: 'Emberleaf Highlands', x: 1300, z: 100, r: 400 },
  { id: 'frostcrown', name: '서리왕관 산', sub: 'Frostcrown', x: 250, z: -1600, r: 300 },
  { id: 'mistfen', name: '안개 습지', sub: 'Mistfen', x: -900, z: 1000, r: 380, hidden: true },
];
