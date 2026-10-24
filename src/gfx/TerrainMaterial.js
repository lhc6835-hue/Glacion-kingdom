import * as THREE from 'three';
import { patchMaterial, noiseGLSL, atmo } from './Atmosphere.js';
import { LAKE_LEVEL, CITY_WALL } from '../world/WorldLayout.js';

// Procedural terrain shading: no tiling textures, everything is derived from world position,
// slope, altitude and the road mask, so the land never shows a repeating pattern.
export function createTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  patchMaterial(mat, 'terrain', (shader) => {
    shader.uniforms.uLake = { value: LAKE_LEVEL };
    shader.uniforms.uCity = { value: new THREE.Vector4(CITY_WALL.x, CITY_WALL.z, CITY_WALL.rx, CITY_WALL.rz) };
    shader.uniforms.uWet = atmo.uWet;
    shader.uniforms.uSnow = atmo.uSnow;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aRoad;
        varying float vRoad;
        varying vec3 vTerrN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRoad = aRoad;
        vTerrN = normal;`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLake;
        uniform vec4 uCity;
        uniform float uWet;
        uniform float uSnow;
        varying float vRoad;
        varying vec3 vTerrN;
        ${noiseGLSL}
        vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
        // Voronoi cobbles: returns (edge distance, cell id)
        vec2 cobble(vec2 p){
          vec2 n = floor(p), f = fract(p);
          float d1 = 8.0, d2 = 8.0; float id = 0.0;
          for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g) * 0.8 + 0.1;
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < d1) { d2 = d1; d1 = d; id = hash12(n + g); } else if (d < d2) { d2 = d; }
          }
          return vec2(sqrt(d2) - sqrt(d1), id);
        }
        // Triplanar noise so cliff faces are not stretched.
        float triNoise(vec3 P, vec3 w, float k){
          return snoise(P.zy * k) * w.x + snoise(P.xz * k) * w.y + snoise(P.xy * k) * w.z;
        }
        float gTerrBump = 0.0;
        float gTerrRough = 0.95;
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 P = vAtmoWorldPos;
          vec3 N = normalize(vTerrN);
          float slope = 1.0 - N.y;
          float h = P.y;
          float n1 = fbm2(P.xz * 0.0035);
          float n2 = snoise(P.xz * 0.031);
          float n3 = snoise(P.xz * 0.27);
          float n4 = snoise(P.xz * 1.9);

          // Meadow grass: lush, golden and deep greens in broad drifting patches.
          vec3 grass = mix(lin(vec3(0.40, 0.58, 0.20)), lin(vec3(0.64, 0.66, 0.27)), smoothstep(-0.35, 0.65, n1));
          grass = mix(grass, lin(vec3(0.22, 0.40, 0.17)), smoothstep(0.05, 0.85, n2) * 0.55);
          grass = mix(grass, lin(vec3(0.30, 0.47, 0.33)), smoothstep(0.4, 1.0, -n1) * 0.45);
          grass *= 0.88 + 0.16 * n3 + 0.06 * n4;
          // Alpine turf above the tree line turns olive and brown.
          float alpine = smoothstep(260.0, 420.0, h + n2 * 40.0);
          grass = mix(grass, lin(vec3(0.46, 0.47, 0.30)) * (0.9 + 0.2 * n3), alpine);

          // Stone: warm grey with strata, cooler and bluer on high faces.
          vec3 tw = abs(N); tw /= (tw.x + tw.y + tw.z);
          float r1 = triNoise(P, tw, 0.045), r2 = triNoise(P, tw, 0.21), r3 = triNoise(P, tw, 0.9);
          float sArg = h * 0.16 + r1 * 1.8;
          float strataAA = 1.0 - smoothstep(0.15, 0.8, fwidth(sArg));
          float strata = 0.5 + 0.5 * sin(sArg) * strataAA;
          vec3 rock = mix(lin(vec3(0.58, 0.55, 0.50)), lin(vec3(0.36, 0.37, 0.40)), strata * 0.45 + r2 * 0.22 + r3 * 0.08);
          rock = mix(rock, lin(vec3(0.66, 0.60, 0.50)), smoothstep(0.3, 0.9, r1) * 0.35); // ochre weathering
          rock = mix(rock, lin(vec3(0.50, 0.55, 0.62)), smoothstep(200.0, 700.0, h) * 0.5);
          rock = mix(rock, lin(vec3(0.33, 0.42, 0.22)), smoothstep(0.35, 0.9, n2) * (1.0 - alpine) * 0.35); // moss
          float rockAmt = smoothstep(0.30, 0.52, slope + n2 * 0.07 + n4 * 0.02);

          vec3 col = mix(grass, rock, rockAmt);

          // Shores: sand and pebbles at the waterline, darker wet silt just below.
          float shore = 1.0 - smoothstep(uLake + 0.6, uLake + 3.2 + n3 * 1.2, h);
          vec3 sand = mix(lin(vec3(0.74, 0.67, 0.52)), lin(vec3(0.58, 0.56, 0.50)), smoothstep(0.2, 0.7, n4));
          col = mix(col, sand, shore * (1.0 - rockAmt * 0.6));
          float under = 1.0 - smoothstep(uLake - 4.0, uLake + 0.2, h);
          col = mix(col, lin(vec3(0.42, 0.45, 0.36)) * (0.8 + 0.2 * n3), under * 0.8);

          // Snow cap: thicker on gentle slopes; global snow (weather) lowers the line.
          float snowLine = mix(560.0, 140.0, uSnow);
          float snow = smoothstep(snowLine - 30.0, snowLine + 40.0, h + n1 * 70.0 + n3 * 12.0)
                     * (1.0 - smoothstep(0.5, 0.8, slope - uSnow * 0.2));
          col = mix(col, lin(vec3(0.93, 0.95, 0.98)), snow);

          // Roads: packed earth with wheel ruts outside, cobbles inside the city walls.
          vec2 cd = (P.xz - uCity.xy) / uCity.zw;
          float inCity = 1.0 - smoothstep(0.98, 1.02, length(cd));
          float road = smoothstep(0.15, 0.6, vRoad + n4 * 0.1);
          vec3 earth = mix(lin(vec3(0.55, 0.44, 0.31)), lin(vec3(0.66, 0.58, 0.44)), 0.5 + 0.5 * n3);
          col = mix(col, earth, road * (1.0 - inCity));
          vec2 cb = cobble(P.xz * 1.6);
          vec3 stone = lin(vec3(0.62, 0.59, 0.54)) * (0.78 + 0.32 * cb.y) * (0.92 + 0.1 * n3);
          vec3 mortar = lin(vec3(0.36, 0.34, 0.30));
          float paved = inCity * (1.0 - rockAmt);
          vec3 cobbleCol = mix(mortar, stone, smoothstep(0.03, 0.12, cb.x));
          // Grass survives between the cobbles in the quieter parts of town.
          cobbleCol = mix(cobbleCol, grass * 0.8, (1.0 - smoothstep(0.0, 0.08, cb.x)) * smoothstep(0.3, 0.9, n2) * 0.6);
          col = mix(col, cobbleCol, paved);

          // Rain darkens and saturates everything.
          col *= 1.0 - uWet * 0.28;

          diffuseColor.rgb = col;
          gTerrRough = mix(0.96, 0.88, rockAmt);
          gTerrRough = mix(gTerrRough, 0.55, snow);
          gTerrRough = mix(gTerrRough, 0.25, uWet * (0.6 + 0.4 * paved));
          gTerrBump = rockAmt * (r2 * 0.5 + r3 * 0.12)
                    + paved * smoothstep(0.0, 0.14, cb.x) * 0.035
                    + (1.0 - rockAmt) * (1.0 - paved) * n4 * 0.012;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = gTerrRough;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // Procedural bump (derivative-based) for rock strata and cobbles.
          vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
          float dhx = dFdx(gTerrBump), dhy = dFdy(gTerrBump);
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  });
  return mat;
}
