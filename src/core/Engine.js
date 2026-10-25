import * as THREE from 'three';
import { Post } from '../gfx/Post.js';

// Renderer, camera and the frame loop. Systems register update callbacks in order.
export class Engine {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // ?lowres renders at reduced resolution (used by automated screenshot tests on software GL).
    this.params = new URLSearchParams(location.search);
    this.renderer.setPixelRatio(this.params.has('lowres') ? 0.5 : Math.min(window.devicePixelRatio, this.params.get('q') === 'low' ? 1 : 1.75));
        // Painted colours are authored for display; keep tone mapping neutral.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 14000);
    this.clock = new THREE.Clock();
    this.systems = [];
    this.renderFn = () => this.renderer.render(this.scene, this.camera);
    this.elapsed = 0;
    this.frame = 0;
    this.running = false;

    this.resize();
    // Post-processing (light shafts, glow, grading) unless the low-quality mode is asked for.
    if (this.params.get('q') !== 'low') {
      this.post = new Post(this.renderer, this.scene, this.camera);
      this.renderFn = () => this.post.render();
    }
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post?.resize(w, h);
    for (const s of this.systems) s.resize?.(w, h);
  }

  add(system) { this.systems.push(system); return system; }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.step();
    };
    requestAnimationFrame(loop);
  }

  step(fixedDt) {
    const dt = fixedDt ?? Math.min(this.clock.getDelta(), 1 / 20);
    this.elapsed += dt;
    this.frame++;
    for (const s of this.systems) s.update?.(dt, this.elapsed);
    this.renderFn();
  }
}
