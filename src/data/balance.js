// Tunables for combat, gacha and economy. Everything numeric that designers tweak lives here.
export const TIMING = {
  // Half-widths of each zone on a 0..1 bar centred at 0.5, so crit spans 5%, great 15%, good 24%, weak 40%.
  zones: { crit: 0.025, great: 0.075, good: 0.12, weak: 0.2 },
  // Full sweeps (left→right) per second at speed 1.
  sweepsPerSecond: 1.15,
  caps: { wide: 0.6, critZone: 0.6, steady: 0.4, swift: 0.4 },
};

export const JUDGE = {
  crit: { ko: '크리티컬', mul: 3.0, hitstop: 0.085, shake: 3, color: '#5fb8ff' },
  great: { ko: '그레이트', mul: 1.7, hitstop: 0.05, shake: 1.4, color: '#6fe08a' },
  good: { ko: '굿', mul: 1.25, hitstop: 0.035, shake: 0.6, color: '#f2d45a' },
  weak: { ko: '약함', mul: 0.75, hitstop: 0.02, shake: 0, color: '#c8b8a0' },
  miss: { ko: '빗나감', mul: 0, hitstop: 0, shake: 0, color: '#8a8a8a' },
};

export const SWING = {
  windup: 0.11,   // cock the axe back over the shoulder
  strike: 0.07,   // sweep around the front of the body to impact
  follow: 0.1,    // the axe bites (or whips round on a miss)
  recover: 0.2,   // back to ready; the next swing can be queued from here
};

export const COMBO = { perStack: 0.02, max: 10 };

// Defence is flat: damage = max(minFrac × raw, raw − defence).
export const DEFENSE = { minFrac: 0.1 };

export const GACHA = {
  single: { gold: 120 },
  ten: { gold: 1080 },
  rarePity: 10,        // the 10th pull without Rare+ is Rare+
  epicSoftStart: 60,   // from here Epic+ weight grows each pull
  epicSoftStep: 0.6,   // +60% Epic+ weight per pull past the soft start
  epicHard: 80,        // the 80th pull without Epic+ is Epic+
};

export const STARS = { max: 5, dmgPerStar: 0.08, effectPerStar: 0.05, cost: (star, grade) => Math.round(12 * (star + 1) * (1 + grade * 0.5)) };

export const DAY = {
  minutesPerDay: 24,   // real minutes for one in-game day
  startHour: 8.5,
};
