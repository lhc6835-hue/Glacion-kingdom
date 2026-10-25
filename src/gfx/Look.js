import * as THREE from 'three';

// Global "look" uniforms shared by every world shader: light, tint, haze and time.
// Art is painted with light coming from the upper left (west), as in the reference painting;
// the time of day shifts colour temperature and brightness rather than relighting the paint.
export const look = {
  uTime: { value: 0 },
  uLight: { value: new THREE.Color(1, 1, 1) },     // multiplies painted colour
  uShadow: { value: new THREE.Color(0.55, 0.62, 0.8) }, // tint of shaded faces
  uSunDir: { value: new THREE.Vector3(-0.6, 0.6, 0.5).normalize() },
  uHaze: { value: new THREE.Color(0.74, 0.84, 0.95) },
  uHazeNear: { value: 280 },
  uHazeFar: { value: 4600 },
  uNight: { value: 0 },
  uGlow: { value: 0 },        // window / lantern emission strength
  uWind: { value: 1 },
  uWet: { value: 0 },
  uSnow: { value: 0 },
};

export const glslCommon = /* glsl */`
uniform float uTime, uNight, uGlow, uWind, uWet, uSnow, uHazeNear, uHazeFar;
uniform vec3 uLight, uShadow, uSunDir, uHaze;
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
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*snoise(p); p*=2.03; a*=0.5;} return s; }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 srgb(vec3 c){ return pow(c, vec3(2.2)); }
// Aerial perspective: distant things fade into the sky haze.
vec3 haze(vec3 col, float dist){
  float t = smoothstep(uHazeNear, uHazeFar, dist);
  return mix(col, uHaze, t * 0.85);
}
`;
