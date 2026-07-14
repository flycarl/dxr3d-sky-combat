import * as THREE from 'three';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { Player, type ArenaBounds } from '../entities/Player';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig } from '../systems/CameraRig';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Hud } from '../systems/Hud';
import { disposeObject3D } from '../utils/dispose';

const ARENA: ArenaBounds = {
  halfWidth: 54,
  halfDepth: 74,
  minAltitude: 0.7,
  maxAltitude: 19,
};

type GameMode = 'menu' | 'playing' | 'paused' | 'won' | 'lost';

type Enemy = {
  group: THREE.Group;
  center: THREE.Vector3;
  angle: number;
  radius: number;
  altitude: number;
  cooldown: number;
  burstRemaining: number;
  burstTimer: number;
  agility: number;
  active: boolean;
  respawnTimer: number;
};

type EnemyShot = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
};

type PlayerShot = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
};

type RepairPickup = {
  group: THREE.Group;
  active: boolean;
  phase: number;
};

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly world = new THREE.Group();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
  private readonly input: InputController;
  private readonly player = new Player();
  private readonly enemies: Enemy[] = [];
  private readonly shots: EnemyShot[] = [];
  private readonly playerShots: PlayerShot[] = [];
  private readonly repairs: RepairPickup[] = [];
  private readonly audio = new AudioSystem();
  private readonly hud = new Hud();
  private readonly cameraRig = new CameraRig(this.camera);
  private readonly loop = new Loop(
    (delta, elapsed) => this.update(delta, elapsed),
    () => this.render(),
  );

  private readonly tuning: DebugTuning = {
    maxSpeed: 16,
    reverseSpeed: 5.4,
    acceleration: 8.2,
    brakePower: 7.2,
    drag: 1.12,
    turnRate: 1.72,
    boostMultiplier: 1.46,
    cameraLag: 0.12,
    exposure: 1.08,
    maxDpr: 2,
  };

  private readonly debugTools: DebugTools;
  private frame = 0;
  private elapsed = 0;
  private hits = 0;
  private fireCooldown = 0;
  private mode: GameMode = 'menu';
  private readonly maxHits = 10;
  private readonly app = this.getElement('#app');
  private readonly startButton = this.getElement('#start-button') as HTMLButtonElement;
  private readonly pauseButton = this.getElement('#pause-button') as HTMLButtonElement;
  private pointerLockReleaseExpected = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = this.tuning.exposure;

    const stick = this.getElement('#touch-stick');
    const knob = this.getElement('#touch-knob');
    const dashButton = this.getElement('#dash-button');
    const reticle = this.getElement('#reticle');
    this.input = new InputController(stick, knob, dashButton, reticle);

    this.debugTools = new DebugTools(this.tuning, () => {
      this.renderer.toneMappingExposure = this.tuning.exposure;
      resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    });

    this.createScene();
    this.resetMission();
    this.mode = 'menu';
    this.input.setEnabled(false);
    this.startButton.addEventListener('click', this.startGame);
    this.pauseButton.addEventListener('click', this.togglePause);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    this.publishDiagnostics();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.startButton.removeEventListener('click', this.startGame);
    this.pauseButton.removeEventListener('click', this.togglePause);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.releasePointerLock();
    this.audio.dispose();
    this.debugTools.dispose();
    this.player.dispose();
    disposeObject3D(this.world);
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
  }

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);

    if (this.input.consumeRestart() && this.mode !== 'menu') this.startGame();
    if (this.input.consumePause() && this.mode !== 'menu') this.togglePause();

    const speedRatio = THREE.MathUtils.clamp(this.player.getSpeedKph() / 280, 0, 1);
    if (this.mode === 'playing') {
      this.elapsed += delta;
      this.fireCooldown = Math.max(0, this.fireCooldown - delta);
      this.input.update(delta);
      this.player.update(delta, elapsed, this.input, this.tuning, ARENA);
      this.updatePlayerFire();
      this.updateEnemies(delta);
      this.updatePlayerShots(delta);
      this.updateShots(delta);
      this.updateRepairs(elapsed);
      this.checkRepairPickups();
      this.checkEnemyCrash();
      this.checkGroundCrash();
      this.audio.updatePropeller(speedRatio, this.input.isDashHeld());
    }

    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 58 + speedRatio * 5, 1 - Math.exp(-delta * 3));
    this.camera.updateProjectionMatrix();
    this.cameraRig.update(delta, this.player.group.position, this.player.group.rotation.y, this.tuning.cameraLag, speedRatio);
    this.syncShellState();
    this.updateHud();
    this.publishDiagnostics();
  }

  private readonly startGame = (): void => {
    this.resetMission();
    this.mode = 'playing';
    this.input.setEnabled(true);
    void this.audio.unlock().then(() => {
      if (this.mode === 'playing') this.audio.startPropeller();
    });
    this.requestPointerLock();
    this.syncShellState();
  };

  private readonly togglePause = (): void => {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.input.setEnabled(false);
      this.audio.stopPropeller();
      this.releasePointerLock();
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
      this.input.setEnabled(true);
      void this.audio.unlock().then(() => {
        if (this.mode === 'playing') this.audio.startPropeller();
      });
      this.requestPointerLock();
    }
    this.syncShellState();
  };

  private readonly onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.canvas;
    if (locked) {
      this.pointerLockReleaseExpected = false;
      if (this.mode === 'playing') this.input.setEnabled(true);
      return;
    }

    this.input.setEnabled(false);
    if (this.mode === 'playing' && !this.pointerLockReleaseExpected) {
      this.mode = 'paused';
      this.audio.stopPropeller();
    }
    this.pointerLockReleaseExpected = false;
    this.syncShellState();
  };

  private requestPointerLock(): void {
    if (document.pointerLockElement === this.canvas) return;
    if (!this.canvas.requestPointerLock) {
      this.input.setEnabled(this.mode === 'playing');
      return;
    }
    void this.canvas.requestPointerLock().catch(() => {
      this.input.setEnabled(this.mode === 'playing');
    });
  }

  private releasePointerLock(): void {
    if (document.pointerLockElement !== this.canvas) return;
    this.pointerLockReleaseExpected = true;
    document.exitPointerLock();
  }

  private syncShellState(): void {
    this.app.classList.toggle('has-started', this.mode !== 'menu');
    this.app.classList.toggle('is-active', this.mode === 'playing');
    this.app.classList.toggle('is-paused', this.mode === 'paused');
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private createScene(): void {
    this.scene.background = new THREE.Color('#8fc8df');
    this.scene.fog = new THREE.Fog('#8fc8df', 54, 150);
    this.scene.add(this.world);

    const hemisphere = new THREE.HemisphereLight('#fff6d8', '#496b7b', 1.65);
    this.world.add(hemisphere);

    const sun = new THREE.DirectionalLight('#fff1b8', 3);
    sun.position.set(-22, 32, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    this.world.add(sun);

    this.world.add(this.createMountainTerrain());
    this.world.add(this.createCloudLayer());
    this.world.add(this.player.group);
    this.createEnemies();
    this.createRepairPickups();
  }

  private createMountainTerrain(): THREE.Group {
    const terrain = new THREE.Group();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.halfWidth * 2, ARENA.halfDepth * 2, 48, 64),
      new THREE.MeshStandardMaterial({
        color: '#506a43',
        roughness: 0.86,
        metalness: 0.02,
        flatShading: true,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    terrain.add(ground);

    const mountainMaterial = new THREE.MeshStandardMaterial({
      color: '#6d7466',
      roughness: 0.82,
      metalness: 0.04,
      flatShading: true,
    });
    const snowMaterial = new THREE.MeshStandardMaterial({
      color: '#f4f0df',
      roughness: 0.75,
      metalness: 0,
      flatShading: true,
    });

    const mountains = [
      [-34, -42, 8, 8],
      [-14, -50, 6, 6],
      [26, -38, 7, 7],
      [-42, 2, 9, 9],
      [38, 8, 8, 8],
      [-24, 38, 6.5, 7],
      [20, 46, 9, 10],
      [4, -8, 5, 5.5],
    ];

    mountains.forEach(([x, z, radius, height]) => {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), mountainMaterial);
      peak.position.set(x, height / 2 - 0.1, z);
      peak.castShadow = true;
      peak.receiveShadow = true;
      terrain.add(peak);

      const snow = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.34, height * 0.32, 7), snowMaterial);
      snow.position.set(x, height * 0.86, z);
      snow.castShadow = true;
      terrain.add(snow);
    });

    return terrain;
  }

  private createCloudLayer(): THREE.Group {
    const clouds = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: '#f4f0df', roughness: 0.86 });
    for (let i = 0; i < 14; i += 1) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.1 + j * 0.12, 16, 8), material);
        puff.position.set((j - 1.5) * 1.3, 0, Math.sin(i + j) * 0.5);
        puff.scale.y = 0.32;
        cloud.add(puff);
      }
      cloud.position.set(
        -ARENA.halfWidth + 8 + ((i * 17) % (ARENA.halfWidth * 2 - 16)),
        2.4 + (i % 4) * 0.35,
        -ARENA.halfDepth + 8 + ((i * 23) % (ARENA.halfDepth * 2 - 16)),
      );
      clouds.add(cloud);
    }
    return clouds;
  }

  private createEnemies(): void {
    const configs = [
      [-18, -12, 9, 10],
      [22, -28, 11, 12],
      [-26, 34, 8.5, 11],
      [28, 24, 10, 9],
    ];

    configs.forEach(([x, z, altitude, radius], index) => {
      const group = this.createPlaneModel('#394e75', '#ff6757');
      group.position.set(x, altitude, z);
      this.world.add(group);
      this.enemies.push({
        group,
        center: new THREE.Vector3(x, altitude, z),
        angle: index * 1.7,
        radius,
        altitude,
        cooldown: 0.5 + index * 0.4,
        burstRemaining: 0,
        burstTimer: 0,
        agility: 0.8 + index * 0.22,
        active: true,
        respawnTimer: 0,
      });
    });
  }

  private createPlaneModel(bodyColor: string, wingColor: string): THREE.Group {
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.38, metalness: 0.18 });
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: wingColor,
      roughness: 0.3,
      metalness: 0.2,
      emissive: wingColor,
      emissiveIntensity: 0.12,
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.1, 14), bodyMaterial);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    group.add(body);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.52, 14), bodyMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.3;
    nose.castShadow = true;
    group.add(nose);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.06, 0.42), wingMaterial);
    wing.position.z = -0.08;
    wing.castShadow = true;
    group.add(wing);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.28), wingMaterial);
    tail.position.z = 0.92;
    tail.castShadow = true;
    group.add(tail);
    return group;
  }

  private createRepairPickups(): void {
    const positions = [
      [-30, 7, 18],
      [30, 8, -6],
      [-8, 10, -34],
    ];
    positions.forEach(([x, y, z], index) => {
      const group = this.createRepairHammer();
      group.position.set(x, y, z);
      this.world.add(group);
      this.repairs.push({ group, active: true, phase: index * 1.4 });
    });
  }

  private createRepairHammer(): THREE.Group {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.045, 8, 42),
      new THREE.MeshBasicMaterial({ color: '#f4f0df' }),
    );
    group.add(ring);

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.35, 0.16),
      new THREE.MeshStandardMaterial({ color: '#6c4a2c', roughness: 0.62 }),
    );
    handle.rotation.z = -0.55;
    group.add(handle);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.28, 0.34),
      new THREE.MeshStandardMaterial({
        color: '#48d6c5',
        roughness: 0.26,
        metalness: 0.35,
        emissive: '#0d4f49',
        emissiveIntensity: 0.35,
      }),
    );
    head.position.set(0.28, 0.48, 0);
    head.rotation.z = -0.55;
    group.add(head);
    return group;
  }

  private updateEnemies(delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) {
        enemy.respawnTimer -= delta;
        if (enemy.respawnTimer <= 0) {
          enemy.active = true;
          enemy.group.visible = true;
          enemy.cooldown = 0.8;
          enemy.burstRemaining = 0;
          enemy.burstTimer = 0;
        }
        continue;
      }

      enemy.angle += delta * (0.46 + Math.sin(this.elapsed * 0.9 + enemy.agility) * 0.14);
      const radius = enemy.radius + Math.sin(this.elapsed * 1.35 + enemy.agility * 2.1) * 3.2;
      const altitude = enemy.altitude + Math.sin(enemy.angle * 1.9 + enemy.agility) * 1.8;
      enemy.group.position.set(
        enemy.center.x + Math.cos(enemy.angle) * radius,
        altitude,
        enemy.center.z + Math.sin(enemy.angle * 1.12) * radius,
      );
      const next = new THREE.Vector3(
        enemy.center.x + Math.cos(enemy.angle + 0.08) * radius,
        enemy.group.position.y,
        enemy.center.z + Math.sin((enemy.angle + 0.08) * 1.12) * radius,
      );
      enemy.group.lookAt(next);

      if (enemy.burstRemaining > 0) {
        enemy.burstTimer -= delta;
        if (enemy.burstTimer <= 0) {
          this.fireEnemyShot(enemy);
          enemy.burstRemaining -= 1;
          enemy.burstTimer = 0.12 + Math.random() * 0.06;
        }
      }

      enemy.cooldown -= delta;
      if (enemy.cooldown <= 0 && enemy.burstRemaining <= 0) {
        enemy.burstRemaining = THREE.MathUtils.randInt(3, 5);
        enemy.burstTimer = 0;
        enemy.cooldown = 2.0 + Math.random() * 0.8;
      }
    }
  }

  private fireEnemyShot(enemy: Enemy): void {
    const toPlayer = this.player.group.position.clone().sub(enemy.group.position);
    if (toPlayer.length() > 55) return;
    const spread = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(0.08),
      THREE.MathUtils.randFloatSpread(0.05),
      THREE.MathUtils.randFloatSpread(0.08),
    );
    const velocity = toPlayer.normalize().add(spread).normalize().multiplyScalar(29);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#ffef8a' }),
    );
    mesh.position.copy(enemy.group.position);
    this.world.add(mesh);
    this.shots.push({ mesh, velocity, age: 0 });
  }

  private updatePlayerFire(): void {
    if (!this.input.isFireHeld() || this.fireCooldown > 0) return;

    const forward = this.player.forward.clone().normalize();
    const muzzle = this.player.group.position.clone().addScaledVector(forward, 2.2);
    muzzle.y += 0.05;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#48d6c5' }),
    );
    mesh.position.copy(muzzle);
    this.world.add(mesh);

    const bulletSpeed = 46;
    this.playerShots.push({
      mesh,
      velocity: forward.multiplyScalar(bulletSpeed),
      age: 0,
    });
    this.audio.shoot();
    this.fireCooldown = 0.13;
  }

  private updatePlayerShots(delta: number): void {
    for (let index = this.playerShots.length - 1; index >= 0; index -= 1) {
      const shot = this.playerShots[index];
      shot.age += delta;
      shot.mesh.position.addScaledVector(shot.velocity, delta);

      const enemy = this.enemies.find((candidate) => {
        return candidate.active && candidate.group.position.distanceToSquared(shot.mesh.position) < 1.4 * 1.4;
      });

      if (enemy) {
        enemy.active = false;
        enemy.group.visible = false;
        enemy.respawnTimer = 4.5;
        this.audio.pickup(5);
        this.removePlayerShot(index);
      } else if (shot.age > 2.2) {
        this.removePlayerShot(index);
      }
    }
  }

  private updateShots(delta: number): void {
    for (let index = this.shots.length - 1; index >= 0; index -= 1) {
      const shot = this.shots[index];
      shot.age += delta;
      shot.mesh.position.addScaledVector(shot.velocity, delta);
      if (shot.mesh.position.distanceToSquared(this.player.group.position) < 0.85 * 0.85) {
        this.hits = Math.min(this.maxHits, this.hits + 1);
        this.player.applyImpact(0.86);
        this.audio.crash();
        this.hud.flashHit();
        this.removeShot(index);
        if (this.hits >= this.maxHits) this.mode = 'lost';
      } else if (shot.age > 4) {
        this.removeShot(index);
      }
    }
  }

  private removeShot(index: number): void {
    const [shot] = this.shots.splice(index, 1);
    this.world.remove(shot.mesh);
    shot.mesh.geometry.dispose();
    const materials = Array.isArray(shot.mesh.material) ? shot.mesh.material : [shot.mesh.material];
    materials.forEach((material) => material.dispose());
  }

  private removePlayerShot(index: number): void {
    const [shot] = this.playerShots.splice(index, 1);
    this.world.remove(shot.mesh);
    shot.mesh.geometry.dispose();
    const materials = Array.isArray(shot.mesh.material) ? shot.mesh.material : [shot.mesh.material];
    materials.forEach((material) => material.dispose());
  }

  private updateRepairs(elapsed: number): void {
    this.repairs.forEach((repair) => {
      if (!repair.active) return;
      repair.group.rotation.y += 0.022;
      repair.group.position.y += Math.sin(elapsed * 2.2 + repair.phase) * 0.004;
    });
  }

  private checkRepairPickups(): void {
    this.repairs.forEach((repair) => {
      if (!repair.active) return;
      if (repair.group.position.distanceToSquared(this.player.group.position) < 1.8 * 1.8) {
        this.hits = 0;
        this.player.addBoost(1);
        this.audio.pickup(3);
        this.hud.flashPickup();
        this.respawnRepairFarAway(repair);
      }
    });
  }

  private respawnRepairFarAway(repair: RepairPickup): void {
    const playerPosition = this.player.group.position;
    let best = new THREE.Vector3(0, 9, 0);
    let bestDistance = -1;

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const x = THREE.MathUtils.randFloatSpread(ARENA.halfWidth * 1.75);
      const z = THREE.MathUtils.randFloatSpread(ARENA.halfDepth * 1.75);
      const terrain = this.getTerrainHeight(x, z);
      const y = THREE.MathUtils.randFloat(Math.max(terrain + 4.2, 6.5), ARENA.maxAltitude - 1.5);
      const candidate = new THREE.Vector3(x, y, z);
      const distance = candidate.distanceTo(playerPosition);
      if (distance > bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
      if (distance > 34) break;
    }

    repair.group.position.copy(best);
    repair.group.visible = true;
    repair.active = true;
  }

  private checkGroundCrash(): void {
    const ground = this.getTerrainHeight(this.player.group.position.x, this.player.group.position.z);
    if (this.player.group.position.y <= ground + 0.9) {
      this.mode = 'lost';
      this.hits = this.maxHits;
      this.audio.stopPropeller();
      this.audio.crash();
    }
  }

  private checkEnemyCrash(): void {
    const collided = this.enemies.some((enemy) => {
      return enemy.active && enemy.group.position.distanceToSquared(this.player.group.position) < 2.1 * 2.1;
    });
    if (!collided) return;

    this.mode = 'lost';
    this.hits = this.maxHits;
    this.audio.stopPropeller();
    this.audio.crash();
  }

  private getTerrainHeight(x: number, z: number): number {
    const peaks = [
      [-34, -42, 8, 8],
      [-14, -50, 6, 6],
      [26, -38, 7, 7],
      [-42, 2, 9, 9],
      [38, 8, 8, 8],
      [-24, 38, 6.5, 7],
      [20, 46, 9, 10],
      [4, -8, 5, 5.5],
    ];
    let height = 0;
    for (const [px, pz, radius, peak] of peaks) {
      const distance = Math.hypot(x - px, z - pz);
      const influence = THREE.MathUtils.clamp(1 - distance / radius, 0, 1);
      height = Math.max(height, influence * peak);
    }
    return height;
  }

  private resetMission(): void {
    this.elapsed = 0;
    this.hits = 0;
    this.mode = 'playing';
    this.player.reset();
    for (let index = this.shots.length - 1; index >= 0; index -= 1) this.removeShot(index);
    for (let index = this.playerShots.length - 1; index >= 0; index -= 1) this.removePlayerShot(index);
    this.fireCooldown = 0;
    for (const enemy of this.enemies) {
      enemy.active = true;
      enemy.group.visible = true;
      enemy.respawnTimer = 0;
    }
    for (const repair of this.repairs) {
      repair.active = true;
      repair.group.visible = true;
    }
    this.cameraRig.snapTo(this.player.group.position);
  }

  private updateHud(): void {
    this.hud.update({
      gates: this.hits,
      target: this.maxHits,
      timeLeft: Math.floor(this.elapsed),
      speed: this.player.getSpeedKph(),
      altitude: this.player.getAltitude(),
      boost: this.player.getBoostEnergy(),
      damage: Math.round((this.hits / this.maxHits) * 100),
      mode: this.mode,
    });
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.hits,
      targetScore: this.maxHits,
      complete: false,
      mode: this.mode,
      timeLeft: this.elapsed,
      damage: Math.round((this.hits / this.maxHits) * 100),
      playerShots: this.playerShots.length,
      player: {
        position: {
          x: this.player.group.position.x,
          y: this.player.group.position.y,
          z: this.player.group.position.z,
        },
        speed: this.player.velocity.length(),
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, this.tuning.maxDpr),
      },
    };
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
  }
}
