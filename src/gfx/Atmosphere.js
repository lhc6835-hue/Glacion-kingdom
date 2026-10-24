import * as THREE from 'three';

// Shared atmosphere state: every world material reads these same uniform objects,
// so the time-of-day system updates sky, fog and lighting for the whole scene in one place.
export const atmo = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  uHorizon: { value: new THREE.Color(0.75, 0.85, 0.95) },
  uZenith: { value: new THREE.Color(0.25, 0.5, 0.9) },
  uFogColor: { value: new THREE.Color(0.72, 0.82, 0.92) },
  uFogDensity: { value: 0.00028 },
  uFogHeight: { value: 0.0042 }, // height falloff: haze pools in valleys
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(1, 0.3) },
  uWindStrength: { value: 1 },
  uNight: { value: 0 },
  uWet: { value: 0 },
  uSnow: { value: 0 },
};

// Exponential height fog with sun in-scattering (after Quilez). Distant mountains fade into
// a blue haze, valleys hold mist, and the haze glows warm when looking toward the sun.
export const fogParsVertex = /* glsl */`
varying vec3 vAtmoWorldPos;
`;
export const fogVertex = /* glsl */`
// project_vertex has already produced mvPosition (instancing and any vertex animation included).
vAtmoWorldPos = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
`;
export const fogParsFragment = /* glsl */`
varying vec3 vAtmoWorldPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogHeight;
vec3 applyAtmosphere(vec3 col, vec3 worldPos) {
  vec3 rel = worldPos - cameraPosition;
  float dist = length(rel);
  vec3 rd = rel / max(dist, 1e-4);
  float b = uFogHeight;
  float camH = max(cameraPosition.y - 20.0, 0.0);
  float ry = abs(rd.y) < 1e-3 ? 1e-3 * sign(rd.y + 1e-6) : rd.y;
  float heightFog = exp(-camH * b) * (1.0 - exp(-dist * ry * b)) / (ry * b);
  float amount = 1.0 - exp(-uFogDensity * (heightFog * 0.65 + dist * 0.35));
  float sunAmt = pow(max(dot(rd, uSunDir), 0.0), 6.0);
  vec3 fogCol = mix(uFogColor, uFogColor * 0.6 + uSunColor * 0.55, sunAmt * clamp(uSunDir.y * 4.0 + 0.4, 0.0, 1.0));
  return mix(col, fogCol, clamp(amount, 0.0, 1.0));
}
`;
export const fogFragment = /* glsl */`
gl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmoWorldPos);
`;

// Patch a built-in material so it uses the shared atmosphere fog. `extra` can further edit
// the shader (vegetation wind, terrain splatting...). Keeps material caching stable via customProgramCacheKey.
export function patchMaterial(mat, key, extra) {
  mat.fog = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    Object.assign(shader.uniforms, atmo);
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', fogParsVertex)
      .replace('#include <fog_vertex>', fogVertex);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', fogParsFragment)
      .replace('#include <fog_fragment>', fogFragment);
    if (extra) extra(shader);
  };
  mat.customProgramCacheKey = () => 'atmo-' + key;
  return mat;
}

export const noiseGLSL = /* glsl */`
vec3 _m289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 _m289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 _perm(vec3 x){return _m289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=_m289(i);
  vec3 p=_perm(_perm(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm2(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*snoise(p); p*=2.03; a*=0.5;} return s; }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
`;
