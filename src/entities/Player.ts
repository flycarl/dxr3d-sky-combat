import * as THREE from 'three';
import type { InputController } from '../core/InputController';
import { createAircraftModel, type AircraftModel } from './AircraftModelFactory';
import { AIRCRAFT_SKINS, type AircraftSkinId } from '../systems/Customization';

export type PlayerTuning = {
  maxSpeed: number;
  reverseSpeed: number;
  acceleration: number;
  brakePower: number;
  drag: number;
  turnRate: number;
  boostMultiplier: number;
};

export type ArenaBounds = {
  halfWidth: number;
  halfDepth: number;
  minAltitude: number;
  maxAltitude: number;
};

export class Player {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, -1);

  private readonly move = new THREE.Vector2();
  private speed = 8;
  private boostEnergy = 1;
  private hitFlash = 0;
  private propellerSpin = 0;

  private aircraftId: AircraftSkinId = 'standard';
  private aircraft: AircraftModel = createAircraftModel(this.aircraftId);
  private bodyBaseEmissive: Array<{ material: THREE.MeshStandardMaterial; color: THREE.Color; intensity: number }> = [];
  private readonly impactEmissive = new THREE.Color('#ff3d20');

  constructor() {
    this.group.rotation.order = 'YXZ';
    this.group.add(this.aircraft.group);
    this.captureBodyEmissive();
  }

  update(delta: number, elapsed: number, input: InputController, tuning: PlayerTuning, bounds: ArenaBounds): void {
    input.readMovement(this.move);
    const throttle = -this.move.y;
    const steering = this.move.x;
    const boostHeld = input.isDashHeld() && this.boostEnergy > 0.03;
    const boost = boostHeld ? tuning.boostMultiplier : 1;

    if (throttle > 0.04) {
      this.speed += tuning.acceleration * boost * delta;
    } else if (throttle < -0.04) {
      this.speed -= tuning.brakePower * delta;
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 8, Math.min(1, tuning.drag * delta));
    }

    this.speed = THREE.MathUtils.clamp(this.speed, tuning.reverseSpeed, tuning.maxSpeed * boost);
    const speedRatio = THREE.MathUtils.clamp(this.speed / tuning.maxSpeed, 0.25, 1.4);
    this.group.rotation.y -= steering * tuning.turnRate * speedRatio * delta;

    const climb = throttle * 5.4 + (boostHeld ? 0.85 : 0);
    this.group.position.y = THREE.MathUtils.clamp(
      this.group.position.y + climb * delta,
      bounds.minAltitude,
      bounds.maxAltitude,
    );

    this.boostEnergy = THREE.MathUtils.clamp(this.boostEnergy + (boostHeld ? -0.3 : 0.14) * delta, 0, 1);
    this.hitFlash = Math.max(0, this.hitFlash - delta * 4);
    this.updateBodyEmissive();

    const bank = -steering * Math.min(speedRatio, 1.15) * 1.18;
    const climbIntent = THREE.MathUtils.clamp(climb / 5.4, -1, 1);
    const pitch = THREE.MathUtils.clamp(climbIntent * 0.46, -0.42, 0.5);
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, bank, 1 - Math.exp(-delta * 8.5));
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, pitch, 1 - Math.exp(-delta * 8.5));
    this.forward.set(0, 0, -1).applyQuaternion(this.group.quaternion).normalize();
    this.velocity.copy(this.forward).multiplyScalar(this.speed);
    this.velocity.y += climb;
    const travel = new THREE.Vector3(this.forward.x, 0, this.forward.z).normalize();
    this.group.position.addScaledVector(travel, this.speed * delta);

    if (this.group.position.x < -bounds.halfWidth) this.group.position.x = bounds.halfWidth;
    if (this.group.position.x > bounds.halfWidth) this.group.position.x = -bounds.halfWidth;
    if (this.group.position.z < -bounds.halfDepth) this.group.position.z = bounds.halfDepth;
    if (this.group.position.z > bounds.halfDepth) this.group.position.z = -bounds.halfDepth;

    this.group.position.y += Math.sin(elapsed * 6.5) * 0.004;

    this.propellerSpin += delta * (32 + this.speed * 2.8);
    for (const propeller of this.aircraft.propellers) propeller.rotation.z = this.propellerSpin;
    const exhaustPulse = 0.92 + Math.sin(elapsed * 18) * 0.12 + Math.min(0.35, Math.abs(this.speed) * 0.012);
    for (const exhaust of this.aircraft.exhausts) {
      exhaust.scale.setScalar(exhaustPulse);
      exhaust.material.emissiveIntensity = 0.68 + exhaustPulse * 0.42;
    }
  }

  applySkin(skinId: AircraftSkinId): void {
    if (skinId === this.aircraftId) return;
    this.group.remove(this.aircraft.group);
    this.aircraft.dispose();
    this.aircraftId = skinId;
    this.aircraft = createAircraftModel(skinId);
    this.group.add(this.aircraft.group);
    this.captureBodyEmissive();
    this.updateBodyEmissive();
  }

  getAircraftId(): AircraftSkinId {
    return this.aircraftId;
  }

  getAircraftRecipe(): string {
    return AIRCRAFT_SKINS[this.aircraftId].recipe;
  }

  getPropulsionType(): 'propeller' | 'jet' {
    return this.aircraft.propellers.length > 0 ? 'propeller' : 'jet';
  }

  applyImpact(retain = 0.5): void {
    this.speed = Math.max(5, this.speed * retain);
    this.hitFlash = 1;
  }

  reset(position = new THREE.Vector3(0, 8, 18)): void {
    this.group.position.copy(position);
    this.group.rotation.set(0, 0, 0, 'YXZ');
    this.speed = 8;
    this.velocity.set(0, 0, -this.speed);
    this.boostEnergy = 1;
    this.hitFlash = 0;
    this.updateBodyEmissive();
  }

  addBoost(amount: number): void {
    this.boostEnergy = THREE.MathUtils.clamp(this.boostEnergy + amount, 0, 1);
  }

  getSpeedKph(): number {
    return Math.round(this.speed * 18);
  }

  getAltitude(): number {
    return Math.round(this.group.position.y * 28);
  }

  getBoostEnergy(): number {
    return this.boostEnergy;
  }

  private updateBodyEmissive(): void {
    for (const base of this.bodyBaseEmissive) {
      base.material.emissive.copy(base.color).lerp(this.impactEmissive, this.hitFlash);
      base.material.emissiveIntensity = THREE.MathUtils.lerp(base.intensity, 1, this.hitFlash);
    }
  }

  private captureBodyEmissive(): void {
    this.bodyBaseEmissive = this.aircraft.bodyMaterials.map((material) => ({
      material,
      color: material.emissive.clone(),
      intensity: material.emissiveIntensity,
    }));
  }

  dispose(): void {
    this.aircraft.dispose();
  }
}
