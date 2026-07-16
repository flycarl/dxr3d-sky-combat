import * as THREE from 'three';

export class CameraRig {
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly offset = new THREE.Vector3(0, 1.55, 7.25),
  ) {}

  snapTo(target: THREE.Vector3): void {
    this.desiredPosition.copy(target).add(this.offset);
    this.camera.position.copy(this.desiredPosition);
    this.lookTarget.copy(target).add(new THREE.Vector3(0, 0.4, 0));
    this.camera.lookAt(this.lookTarget);
  }

  update(delta: number, target: THREE.Vector3, heading: number, pitch: number, lag: number, speedRatio = 0): void {
    const followRotation = new THREE.Euler(pitch * 0.55, heading, 0, 'YXZ');
    this.desiredPosition
      .set(0, this.offset.y + speedRatio * 0.2, this.offset.z + speedRatio * 0.65)
      .applyEuler(followRotation)
      .add(target);
    const factor = 1 - Math.exp(-delta / Math.max(0.001, lag));
    this.camera.position.lerp(this.desiredPosition, factor);
    this.lookTarget
      .set(0, 0.3, -7.2 - speedRatio * 2.0)
      .applyEuler(followRotation)
      .add(target);
    this.camera.lookAt(this.lookTarget);
  }
}
