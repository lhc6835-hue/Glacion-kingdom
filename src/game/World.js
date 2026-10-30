// The region the player is standing in. Exports are live bindings: setRegion() swaps them, and
// every module that imported WORLD, STATIONS, TREE_SPOTS or CREEK sees the new values.
// World units are art pixels; y grows downwards.
import { REGIONS, LORE as REGION_LORE } from '../data/regions.js';

export let REGION = REGIONS.evergreen;
export let WORLD = REGION;
export let STATIONS = REGION.stations;
export let TREE_SPOTS = REGION.trees;
export let CREEK = REGION.creek;
export const LORE = REGION_LORE;

export function setRegion(id) {
  REGION = REGIONS[id] || REGIONS.evergreen;
  WORLD = REGION; STATIONS = REGION.stations; TREE_SPOTS = REGION.trees; CREEK = REGION.creek;
  return REGION;
}

export function groundY(x) {
  const g = REGION.ground;
  return g.base + Math.round(g.amp[0] * Math.sin(x / g.freq[0]) + g.amp[1] * Math.sin(x / g.freq[1] + 1) + g.amp[2] * Math.sin(x / g.freq[2] + 2));
}
