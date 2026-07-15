import * as THREE from 'three';
import type { InputController } from '../core/InputController';
import { applyStyleToMaterial, type AircraftCustomization } from '../systems/Customization';

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

  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#f05b3f',
    roughness: 0.34,
    metalness: 0.22,
  });
  private readonly leftWingMaterial = new THREE.MeshStandardMaterial({
    color: '#48d6c5',
    roughness: 0.28,
    metalness: 0.26,
    emissive: '#0d4f49',
    emissiveIntensity: 0.32,
  });
  private readonly rightWingMaterial = this.leftWingMaterial.clone();
  private readonly tailMaterial = this.leftWingMaterial.clone();
  private readonly glassMaterial = new THREE.MeshStandardMaterial({
    color: '#122c39',
    roughness: 0.14,
    metalness: 0.12,
    emissive: '#143847',
    emissiveIntensity: 0.24,
  });
  private readonly propellerMaterial = new THREE.MeshStandardMaterial({
    color: '#17191b',
    roughness: 0.58,
    metalness: 0.18,
  });
  private readonly fuselageGeometry = new THREE.CylinderGeometry(0.28, 0.42, 2.6, 18);
  private readonly noseGeometry = new THREE.ConeGeometry(0.32, 0.66, 18);
  private readonly wingGeometry = new THREE.BoxGeometry(3.25, 0.08, 0.54);
  private readonly tailWingGeometry = new THREE.BoxGeometry(1.28, 0.06, 0.32);
  private readonly finGeometry = new THREE.BoxGeometry(0.1, 0.72, 0.34);
  private readonly canopyGeometry = new THREE.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  private readonly propellerGeometry = new THREE.BoxGeometry(0.12, 1.18, 0.04);
  private readonly propellerHubGeometry = new THREE.SphereGeometry(0.12, 12, 8);
  private readonly propeller = new THREE.Group();

  constructor() {
    const fuselage = new THREE.Mesh(this.fuselageGeometry, this.bodyMaterial);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    this.group.add(fuselage);

    const nose = new THREE.Mesh(this.noseGeometry, this.bodyMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.62;
    nose.castShadow = true;
    this.group.add(nose);

    const leftWing = new THREE.Mesh(this.wingGeometry, this.leftWingMaterial);
    leftWing.position.set(-0.82, -0.02, -0.18);
    leftWing.scale.x = 0.5;
    leftWing.castShadow = true;
    leftWing.receiveShadow = true;
    this.group.add(leftWing);

    const rightWing = new THREE.Mesh(this.wingGeometry, this.rightWingMaterial);
    rightWing.position.set(0.82, -0.02, -0.18);
    rightWing.scale.x = 0.5;
    rightWing.castShadow = true;
    rightWing.receiveShadow = true;
    this.group.add(rightWing);

    const tail = new THREE.Mesh(this.tailWingGeometry, this.tailMaterial);
    tail.position.set(0, 0.08, 1.12);
    tail.castShadow = true;
    this.group.add(tail);

    const fin = new THREE.Mesh(this.finGeometry, this.tailMaterial);
    fin.position.set(0, 0.42, 1.08);
    fin.castShadow = true;
    this.group.add(fin);

    const canopy = new THREE.Mesh(this.canopyGeometry, this.glassMaterial);
    canopy.position.set(0, 0.27, -0.36);
    canopy.scale.set(1, 0.72, 1.18);
    canopy.castShadow = true;
    this.group.add(canopy);

    const bladeA = new THREE.Mesh(this.propellerGeometry, this.propellerMaterial);
    const bladeB = new THREE.Mesh(this.propellerGeometry, this.propellerMaterial);
    bladeB.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(this.propellerHubGeometry, this.propellerMaterial);
    this.propeller.position.z = -1.98;
    this.propeller.add(bladeA, bladeB, hub);
    this.group.add(this.propeller);
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

    this.forward.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y);
    this.velocity.copy(this.forward).multiplyScalar(this.speed);
    this.velocity.y = climb;
    this.group.position.addScaledVector(this.forward, this.speed * delta);

    if (this.group.position.x < -bounds.halfWidth) this.group.position.x = bounds.halfWidth;
    if (this.group.position.x > bounds.halfWidth) this.group.position.x = -bounds.halfWidth;
    if (this.group.position.z < -bounds.halfDepth) this.group.position.z = bounds.halfDepth;
    if (this.group.position.z > bounds.halfDepth) this.group.position.z = -bounds.halfDepth;

    this.boostEnergy = THREE.MathUtils.clamp(this.boostEnergy + (boostHeld ? -0.3 : 0.14) * delta, 0, 1);
    this.hitFlash = Math.max(0, this.hitFlash - delta * 4);
    this.bodyMaterial.emissive.set(this.hitFlash > 0 ? '#5b120c' : '#000000');
    this.bodyMaterial.emissiveIntensity = this.hitFlash > 0 ? this.hitFlash : 0;

    const bank = -steering * Math.min(speedRatio, 1.15) * 1.18;
    const pitch = THREE.MathUtils.clamp(throttle * 0.46, -0.42, 0.5);
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, bank, 1 - Math.exp(-delta * 8.5));
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, pitch, 1 - Math.exp(-delta * 8.5));
    this.group.position.y += Math.sin(elapsed * 6.5) * 0.004;

    this.propellerSpin += delta * (32 + this.speed * 2.8);
    this.propeller.rotation.z = this.propellerSpin;
  }

  applyCustomization(customization: AircraftCustomization): void {
    applyStyleToMaterial(this.bodyMaterial, customization.body);
    applyStyleToMaterial(this.leftWingMaterial, customization.leftWing);
    applyStyleToMaterial(this.rightWingMaterial, customization.rightWing);
    applyStyleToMaterial(this.propellerMaterial, customization.propeller);
    applyStyleToMaterial(this.tailMaterial, customization.leftWing);
  }

  applyImpact(retain = 0.5): void {
    this.speed = Math.max(5, this.speed * retain);
    this.hitFlash = 1;
  }

  reset(position = new THREE.Vector3(0, 8, 18)): void {
    this.group.position.copy(position);
    this.group.rotation.set(0, 0, 0);
    this.speed = 8;
    this.velocity.set(0, 0, -this.speed);
    this.boostEnergy = 1;
    this.hitFlash = 0;
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

  dispose(): void {
    this.fuselageGeometry.dispose();
    this.noseGeometry.dispose();
    this.wingGeometry.dispose();
    this.tailWingGeometry.dispose();
    this.finGeometry.dispose();
    this.canopyGeometry.dispose();
    this.propellerGeometry.dispose();
    this.propellerHubGeometry.dispose();
    this.bodyMaterial.dispose();
    this.leftWingMaterial.dispose();
    this.rightWingMaterial.dispose();
    this.tailMaterial.dispose();
    this.glassMaterial.dispose();
    this.propellerMaterial.dispose();
  }
}
