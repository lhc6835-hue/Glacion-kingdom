import * as THREE from 'three';

// "Painting" camera for HD-2D: it never pitches. It always looks due north with a vertical
// image plane, and the lens is shifted downward (off-axis frustum). That gives:
//  - the ground near the player seen from above, like a top-down 2D game,
//  - a true horizon in the upper part of the screen with sky and distant landmarks above it,
//  - vertical sprites (trees, buildings, characters) drawn without any distortion.
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.top = 0.27;      // tan of the angle from horizon to the top edge
    this.bottom = -0.95;  // tan of the angle from horizon to the bottom edge
    this.focusTan = -0.66; // where the player sits on screen (tan below horizon)
    this.distance = 24;   // metres from camera to player, horizontally
    this.targetDistance = 24;
    this.minDistance = 13;
    this.maxDistance = 62;
    this.focus = new THREE.Vector3();
    this.smoothFocus = new THREE.Vector3();
    this.shake = 0;
    this.lookAhead = new THREE.Vector2();
    camera.updateProjectionMatrix = () => this.applyProjection();
    this.applyProjection();
  }

  applyProjection() {
    const c = this.camera;
    const n = c.near, aspect = c.aspect || 16 / 9;
    const span = this.top - this.bottom;
    const half = (span * aspect) / 2;
    c.projectionMatrix.makePerspective(-n * half, n * half, n * this.top, n * this.bottom, n, c.far);
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  }

  zoom(delta) {
    this.targetDistance = THREE.MathUtils.clamp(this.targetDistance * (1 + delta), this.minDistance, this.maxDistance);
  }

  snap(focus) {
    this.focus.copy(focus);
    this.smoothFocus.copy(focus);
    this.place();
  }

  update(dt, focus, velocity) {
    this.focus.copy(focus);
    // Look slightly ahead in the direction of travel.
    if (velocity) {
      this.lookAhead.x += (velocity.x * 0.35 - this.lookAhead.x) * Math.min(1, dt * 2);
      this.lookAhead.y += (velocity.z * 0.25 - this.lookAhead.y) * Math.min(1, dt * 2);
    }
    const k = 1 - Math.exp(-dt * 6);
    this.smoothFocus.x += (focus.x + this.lookAhead.x - this.smoothFocus.x) * k;
    this.smoothFocus.z += (focus.z + this.lookAhead.y - this.smoothFocus.z) * k;
    this.smoothFocus.y += (focus.y - this.smoothFocus.y) * (1 - Math.exp(-dt * 3));
    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-dt * 5));
    this.place();
  }

  place() {
    const c = this.camera;
    const h = -this.focusTan * this.distance;
    c.position.set(this.smoothFocus.x, this.smoothFocus.y + h + 1.0, this.smoothFocus.z + this.distance);
    if (this.shake > 0) {
      c.position.x += (Math.random() - 0.5) * this.shake;
      c.position.y += (Math.random() - 0.5) * this.shake;
    }
    c.rotation.set(0, 0, 0); // looking down -z (north), never pitched
    c.updateMatrixWorld(true);
  }
}
