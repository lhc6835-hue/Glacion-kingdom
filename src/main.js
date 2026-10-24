import * as THREE from 'three';
import { Engine } from './core/Engine.js';
import { Sky } from './world/Sky.js';
import { DayNight } from './world/DayNight.js';
import { Terrain } from './world/Terrain.js';
import { Water } from './world/Water.js';
import { atmo } from './gfx/Atmosphere.js';
import { heightAt } from './world/Heightfield.js';
import { START, CASTLE } from './world/WorldLayout.js';

const engine = new Engine(document.getElementById('game'));
const { scene, camera } = engine;
const sky = new Sky(scene);
const dayNight = new DayNight(scene, engine.renderer);
const terrain = new Terrain(scene);
const water = new Water(scene);

const focus = new THREE.Vector3(START.x, heightAt(START.x, START.z) + 1.7, START.z);
camera.position.copy(focus).add(new THREE.Vector3(0, 3, 8));
camera.lookAt(CASTLE.x, 220, CASTLE.z);
terrain.buildAll(camera.position.x, camera.position.z);

engine.add({
  update(dt, t) {
    atmo.uTime.value = t;
    dayNight.update(dt, focus);
    terrain.update(camera.position.x, camera.position.z);
    sky.update(camera);
  },
});
engine.start();
window.__glacion = { engine, dayNight, terrain, camera, THREE };
