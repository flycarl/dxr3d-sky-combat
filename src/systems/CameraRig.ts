import * as THREE from 'three';

export class CameraRig {
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly offset = new THREE.Vector3(0, 2.2, 8.8),
  ) {}

  snapTo(target: THREE.Vector3): void {
    this.desiredPosition.copy(target).add(this.offset);
    this.camera.position.copy(this.desiredPosition);
    this.lookTarget.copy(target).add(new THREE.Vector3(0, 0.4, 0));
    this.camera.lookAt(this.lookTarget);
  }

  update(delta: number, target: THREE.Vector3, heading: number, lag: number, speedRatio = 0): void {
    this.desiredPosition
      .set(0, this.offset.y + speedRatio * 0.28, this.offset.z + speedRatio * 0.9)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), heading)
      .add(target);
    const factor = 1 - Math.exp(-delta / Math.max(0.001, lag));
    this.camera.position.lerp(this.desiredPosition, factor);
    this.lookTarget
      .set(0, 0.38, -5.5 - speedRatio * 2.4)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), heading)
      .add(target);
    this.camera.lookAt(this.lookTarget);
  }
}
