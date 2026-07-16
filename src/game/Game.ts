import * as THREE from 'three';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { Player, type ArenaBounds } from '../entities/Player';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig } from '../systems/CameraRig';
import {
  AIRCRAFT_SKINS,
  type AircraftSkinId,
} from '../systems/Customization';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Hud } from '../systems/Hud';
import {
  COIN_REWARDS,
  awardCoins,
  loadProfile,
  saveProfile,
  selectOrBuySkin,
  type PlayerProfile,
} from '../systems/ProfileStore';
import {
  MultiplayerClient,
  type MultiplayerEvent,
  type MultiplayerMode,
  type NetworkVector,
  type RemotePlayerState,
} from '../systems/MultiplayerClient';
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

type RemotePlayer = {
  group: THREE.Group;
  healthFill: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  state: RemotePlayerState;
};

type RepairPickup = {
  group: THREE.Group;
  active: boolean;
  phase: number;
};

type CoinPickup = {
  group: THREE.Group;
  active: boolean;
  phase: number;
};

type ExplosionParticle = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  velocity: THREE.Vector3;
  age: number;
  lifetime: number;
  startScale: number;
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
  private readonly coins: CoinPickup[] = [];
  private readonly explosions: ExplosionParticle[] = [];
  private readonly remotePlayers = new Map<string, RemotePlayer>();
  private readonly audio = new AudioSystem();
  private readonly multiplayer = new MultiplayerClient();
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
  private multiplayerSendTimer = 0;
  private multiplayerMode: MultiplayerMode | null = null;
  private mode: GameMode = 'menu';
  private readonly maxHits = 10;
  private readonly app = this.getElement('#app');
  private readonly startButton = this.getElement('#start-button') as HTMLButtonElement;
  private readonly pauseButton = this.getElement('#pause-button') as HTMLButtonElement;
  private readonly retryButton = this.getElement('#retry-button') as HTMLButtonElement;
  private readonly menuButton = this.getElement('#menu-button') as HTMLButtonElement;
  private readonly createRoomButton = this.getElement('#create-room-button') as HTMLButtonElement;
  private readonly joinRoomButton = this.getElement('#join-room-button') as HTMLButtonElement;
  private readonly serverUrlInput = this.getElement('#server-url') as HTMLInputElement;
  private readonly inviteCodeInput = this.getElement('#invite-code') as HTMLInputElement;
  private readonly matchModeSelect = this.getElement('#match-mode') as HTMLSelectElement;
  private readonly multiplayerStatus = this.getElement('#multiplayer-status');
  private readonly coinBalance = this.getElement('#coin-balance');
  private readonly shopMessage = this.getElement('#shop-message');
  private readonly customizationGrid = this.getElement('#customization-grid');
  private readonly weaponCrosshair = this.getElement('#weapon-crosshair');
  private profile: PlayerProfile = loadProfile();
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
    this.serverUrlInput.value = this.getDefaultServerUrl();
    this.startButton.addEventListener('click', this.startGame);
    this.pauseButton.addEventListener('click', this.togglePause);
    this.retryButton.addEventListener('click', this.startGame);
    this.menuButton.addEventListener('click', this.returnToMenu);
    this.createRoomButton.addEventListener('click', this.createMultiplayerRoom);
    this.joinRoomButton.addEventListener('click', this.joinMultiplayerRoom);
    this.canvas.addEventListener('pointerdown', this.relockPointerFromCanvas);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.multiplayer.addEventListener('message', this.onMultiplayerMessage);
    this.multiplayer.addEventListener('status', this.onMultiplayerStatus);
    this.renderCustomizationShop();
    this.applyProfile();
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
    this.retryButton.removeEventListener('click', this.startGame);
    this.menuButton.removeEventListener('click', this.returnToMenu);
    this.createRoomButton.removeEventListener('click', this.createMultiplayerRoom);
    this.joinRoomButton.removeEventListener('click', this.joinMultiplayerRoom);
    this.canvas.removeEventListener('pointerdown', this.relockPointerFromCanvas);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.multiplayer.removeEventListener('message', this.onMultiplayerMessage);
    this.multiplayer.removeEventListener('status', this.onMultiplayerStatus);
    this.multiplayer.disconnect();
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

    if (this.input.consumePause() && this.mode !== 'menu') this.togglePause();

    const speedRatio = THREE.MathUtils.clamp(this.player.getSpeedKph() / 280, 0, 1);
    if (this.mode === 'playing') {
      this.elapsed += delta;
      this.fireCooldown = Math.max(0, this.fireCooldown - delta);
      this.input.update(delta);
      this.player.update(delta, elapsed, this.input, this.tuning, ARENA);
      this.updatePlayerFire();
      if (this.multiplayerMode) {
        this.updateMultiplayer(delta);
      } else {
        this.updateEnemies(delta);
      }
      this.updatePlayerShots(delta);
      this.updateShots(delta);
      if (this.multiplayerMode !== 'deathmatch') {
        this.updateRepairs(elapsed);
        this.checkRepairPickups();
      }
      this.updateCoins(elapsed);
      this.checkCoinPickups();
      if (!this.multiplayerMode) this.checkEnemyCrash();
      this.checkGroundCrash();
      this.audio.updatePropeller(speedRatio, this.input.isDashHeld());
    }

    this.updateExplosions(delta);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 58 + speedRatio * 5, 1 - Math.exp(-delta * 3));
    this.camera.updateProjectionMatrix();
    this.cameraRig.update(
      delta,
      this.player.group.position,
      this.player.group.rotation.y,
      this.player.group.rotation.x,
      this.tuning.cameraLag,
      speedRatio,
    );
    this.weaponCrosshair.style.setProperty('--pitch-y', `${-this.player.group.rotation.x * 96}px`);
    this.syncShellState();
    this.updateHud();
    this.publishDiagnostics();
  }

  private readonly startGame = (): void => {
    this.multiplayerMode = null;
    this.multiplayer.disconnect();
    this.clearRemotePlayers();
    this.resetMission();
    this.mode = 'playing';
    this.input.setEnabled(false);
    void this.audio.unlock().then(() => {
      if (this.mode === 'playing') this.audio.startPropeller();
    });
    this.requestPointerLock();
    this.syncShellState();
  };

  private readonly createMultiplayerRoom = (): void => {
    const url = this.getServerUrl();
    const selectedMode = this.matchModeSelect.value as MultiplayerMode;
    this.multiplayerStatus.textContent = '正在创建房间...';
    this.multiplayer.connect(url, {
      action: 'create',
      name: `玩家${Math.floor(Math.random() * 900 + 100)}`,
      mode: selectedMode,
      skin: this.profile.selectedSkin,
    });
  };

  private readonly joinMultiplayerRoom = (): void => {
    const url = this.getServerUrl();
    const selectedMode = this.matchModeSelect.value as MultiplayerMode;
    const roomCode = this.inviteCodeInput.value.trim().toUpperCase();
    if (roomCode.length !== 4) {
      this.multiplayerStatus.textContent = '请输入 4 位邀请码';
      return;
    }
    this.inviteCodeInput.value = roomCode;
    this.multiplayerStatus.textContent = '正在加入房间...';
    this.multiplayer.connect(url, {
      action: 'join',
      name: `玩家${Math.floor(Math.random() * 900 + 100)}`,
      mode: selectedMode,
      skin: this.profile.selectedSkin,
      roomCode,
    });
  };

  private readonly onMultiplayerStatus = (event: Event): void => {
    this.multiplayerStatus.textContent = (event as CustomEvent<string>).detail;
  };

  private getServerUrl(): string {
    const value = this.serverUrlInput.value.trim() || this.getDefaultServerUrl();
    this.serverUrlInput.value = value;
    return value;
  }

  private getDefaultServerUrl(): string {
    const host = window.location.hostname;
    if (!host || host === 'flycarl.github.io') return 'ws://localhost:8787';
    return `ws://${host}:8787`;
  }

  private readonly onMultiplayerMessage = (event: Event): void => {
    const message = (event as CustomEvent<MultiplayerEvent>).detail;
    if (message.type === 'welcome') {
      this.multiplayerMode = message.mode;
      this.matchModeSelect.value = message.mode;
      this.inviteCodeInput.value = message.roomCode;
      this.multiplayerStatus.textContent = `邀请码 ${message.roomCode}，${this.getModeLabel(message.mode)}，最多 ${message.maxPlayers} 人`;
      this.resetMission();
      this.mode = 'playing';
      this.input.setEnabled(false);
      this.setAiVisible(false);
      this.setRepairsVisible(message.mode !== 'deathmatch');
      void this.audio.unlock().then(() => {
        if (this.mode === 'playing') this.audio.startPropeller();
      });
      this.requestPointerLock();
      this.syncShellState();
    } else if (message.type === 'snapshot') {
      message.peers.forEach((peer) => this.upsertRemotePlayer(peer));
    } else if (message.type === 'peer-joined' || message.type === 'state') {
      this.upsertRemotePlayer(message.peer);
    } else if (message.type === 'peer-left') {
      this.removeRemotePlayer(message.id);
    } else if (message.type === 'shot') {
      this.spawnRemoteShot(message.origin, message.velocity);
    } else if (message.type === 'hit') {
      const remote = this.remotePlayers.get(message.targetId);
      if (remote) {
        remote.state.health = message.health;
        remote.state.lives = message.lives;
        this.updateRemoteHealth(remote);
      }
    } else if (message.type === 'full' || message.type === 'error') {
      this.multiplayerStatus.textContent = message.message;
    }
  };

  private readonly togglePause = (): void => {
    if (this.mode === 'playing') {
      this.mode = 'paused';
      this.input.setEnabled(false);
      this.audio.stopPropeller();
      this.releasePointerLock();
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
      this.input.setEnabled(false);
      void this.audio.unlock().then(() => {
        if (this.mode === 'playing') this.audio.startPropeller();
      });
      this.requestPointerLock();
    }
    this.syncShellState();
  };

  private readonly relockPointerFromCanvas = (event: PointerEvent): void => {
    if (this.mode !== 'playing') return;
    if (document.pointerLockElement === this.canvas) return;
    event.preventDefault();
    this.input.setEnabled(false);
    this.requestPointerLock();
  };

  private readonly returnToMenu = (): void => {
    this.multiplayer.disconnect();
    this.multiplayerMode = null;
    this.clearRemotePlayers();
    this.resetMission();
    this.mode = 'menu';
    this.input.setEnabled(false);
    this.audio.stopPropeller();
    this.releasePointerLock();
    this.syncShellState();
  };

  private getModeLabel(mode: MultiplayerMode): string {
    if (mode === 'deathmatch') return '死亡竞赛';
    if (mode === 'three-lives') return '三条命';
    return '限时击杀';
  }

  private setAiVisible(visible: boolean): void {
    for (const enemy of this.enemies) {
      enemy.active = visible;
      enemy.group.visible = visible;
      enemy.respawnTimer = 0;
    }
  }

  private setRepairsVisible(visible: boolean): void {
    for (const repair of this.repairs) {
      repair.active = visible;
      repair.group.visible = visible;
    }
  }

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
    const request = this.canvas.requestPointerLock();
    if (request instanceof Promise) {
      void request.catch(() => {
        this.input.setEnabled(false);
        this.syncShellState();
      });
    }
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

  private applyProfile(): void {
    this.player.applySkin(this.profile.selectedSkin);
    this.coinBalance.textContent = String(this.profile.coins);
    this.hud.setCoins(this.profile.coins);
    saveProfile(this.profile);
  }

  private addCoins(amount: number, label: string): void {
    this.profile = awardCoins(this.profile, amount);
    this.applyProfile();
    this.syncSkinButtons();
    this.hud.flashReward(`+${amount} 金币 ${label}`);
  }

  private renderCustomizationShop(): void {
    this.customizationGrid.innerHTML = '';
    for (const skin of Object.values(AIRCRAFT_SKINS)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'style-button skin-button';
      button.dataset.skin = skin.id;
      button.innerHTML = `<span class="style-swatch"></span><span>${skin.label}</span><span class="style-cost">${skin.cost}</span>`;
      const swatch = button.querySelector<HTMLElement>('.style-swatch');
      if (swatch) swatch.style.background = skin.body.color;
      button.addEventListener('click', () => this.buySkin(skin.id));
      this.customizationGrid.append(button);
    }
    this.syncSkinButtons();
  }

  private syncSkinButtons(): void {
    const buttons = this.customizationGrid.querySelectorAll<HTMLButtonElement>('.style-button[data-skin]');
    buttons.forEach((button) => {
      const skin = button.dataset.skin as AircraftSkinId;
      const selected = this.profile.selectedSkin === skin;
      const owned = this.profile.ownedSkins.includes(skin);
      button.classList.toggle('is-selected', selected);
      button.classList.toggle('is-owned', owned);
      const costLabel = button.querySelector<HTMLElement>('.style-cost');
      if (costLabel) {
        costLabel.textContent = selected ? '使用中' : owned ? '已拥有' : String(AIRCRAFT_SKINS[skin].cost);
      }
    });
  }

  private buySkin(skin: AircraftSkinId): void {
    if (this.profile.selectedSkin === skin) {
      this.shopMessage.textContent = `${AIRCRAFT_SKINS[skin].label} 正在使用`;
      return;
    }

    const result = selectOrBuySkin(this.profile, skin);
    if (!result.ok) {
      this.shopMessage.textContent = result.reason === 'insufficient-coins' ? '金币不足' : '无法使用这个皮肤';
      this.shopMessage.animate(
        [
          { transform: 'translateX(0)', color: 'rgba(244, 240, 223, 0.74)' },
          { transform: 'translateX(4px)', color: '#e23d2f' },
          { transform: 'translateX(0)', color: 'rgba(244, 240, 223, 0.74)' },
        ],
        { duration: 240, easing: 'ease-out' },
      );
      return;
    }
    this.profile = result.profile;
    this.shopMessage.textContent =
      result.reason === 'purchased'
        ? `已购买并使用 ${AIRCRAFT_SKINS[skin].label}`
        : `已切换到 ${AIRCRAFT_SKINS[skin].label}`;
    this.applyProfile();
    this.syncSkinButtons();
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
    this.createCoinPickups();
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

  private createRemotePlayer(peer: RemotePlayerState): RemotePlayer {
    const skin = AIRCRAFT_SKINS[peer.skin] ?? AIRCRAFT_SKINS.standard;
    const group = this.createPlaneModel(skin.body.color, skin.wing.color);
    const bar = new THREE.Group();
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.08, 0.06),
      new THREE.MeshBasicMaterial({ color: '#17191b' }),
    );
    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.1, 0.07),
      new THREE.MeshBasicMaterial({ color: '#48baa7' }),
    );
    fill.position.z = 0.01;
    bar.position.set(0, 1.15, 0);
    bar.add(back, fill);
    group.add(bar);
    this.world.add(group);
    const remote = { group, healthFill: fill, state: peer };
    this.updateRemotePlayerTransform(remote);
    this.updateRemoteHealth(remote);
    return remote;
  }

  private upsertRemotePlayer(peer: RemotePlayerState): void {
    if (peer.id === this.multiplayer.id) return;
    let remote = this.remotePlayers.get(peer.id);
    if (!remote) {
      remote = this.createRemotePlayer(peer);
      this.remotePlayers.set(peer.id, remote);
    }
    remote.state = peer;
    this.updateRemotePlayerTransform(remote);
    this.updateRemoteHealth(remote);
  }

  private updateRemotePlayerTransform(remote: RemotePlayer): void {
    remote.group.position.set(remote.state.position.x, remote.state.position.y, remote.state.position.z);
    remote.group.rotation.set(remote.state.rotation.x, remote.state.rotation.y, remote.state.rotation.z);
  }

  private updateRemoteHealth(remote: RemotePlayer): void {
    const healthRatio = THREE.MathUtils.clamp(remote.state.health / 10, 0, 1);
    remote.healthFill.scale.x = Math.max(0.02, healthRatio);
    remote.healthFill.position.x = -0.71 * (1 - healthRatio);
    remote.healthFill.material.color.set(healthRatio > 0.45 ? '#48baa7' : '#ff6757');
  }

  private removeRemotePlayer(id: string): void {
    const remote = this.remotePlayers.get(id);
    if (!remote) return;
    this.world.remove(remote.group);
    disposeObject3D(remote.group);
    this.remotePlayers.delete(id);
  }

  private clearRemotePlayers(): void {
    for (const id of Array.from(this.remotePlayers.keys())) {
      this.removeRemotePlayer(id);
    }
  }

  private createRepairPickups(): void {
    const positions = [
      [-30, 7, 18],
      [30, 8, -6],
      [-8, 10, -34],
    ];
    positions.forEach(([x, y, z], index) => {
      const group = this.createRepairWrench();
      group.position.set(x, y, z);
      this.world.add(group);
      this.repairs.push({ group, active: true, phase: index * 1.4 });
    });
  }

  private createRepairWrench(): THREE.Group {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.045, 8, 42),
      new THREE.MeshBasicMaterial({ color: '#f4f0df' }),
    );
    group.add(ring);

    const metal = new THREE.MeshStandardMaterial({
      color: '#cfd8d8',
      roughness: 0.24,
      metalness: 0.7,
      emissive: '#0d4f49',
      emissiveIntensity: 0.22,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: '#48d6c5',
      roughness: 0.28,
      metalness: 0.45,
      emissive: '#0d4f49',
      emissiveIntensity: 0.32,
    });

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.12, 0.14),
      metal,
    );
    handle.position.set(-0.04, -0.22, 0);
    handle.rotation.z = -0.55;
    handle.castShadow = true;
    group.add(handle);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.22, 0.16),
      accent,
    );
    grip.position.set(-0.36, -0.72, 0);
    grip.rotation.z = -0.55;
    grip.castShadow = true;
    group.add(grip);

    const jaw = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.06, 8, 28, Math.PI * 1.48),
      metal,
    );
    jaw.position.set(0.28, 0.46, 0);
    jaw.rotation.z = -0.26;
    jaw.castShadow = true;
    group.add(jaw);

    const toothA = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.14), metal);
    toothA.position.set(0.53, 0.63, 0);
    toothA.rotation.z = 0.28;
    toothA.castShadow = true;
    group.add(toothA);

    const toothB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.14), metal);
    toothB.position.set(0.42, 0.22, 0);
    toothB.rotation.z = -0.7;
    toothB.castShadow = true;
    group.add(toothB);

    return group;
  }

  private createCoinPickups(): void {
    const positions = [
      [-18, 9, -18],
      [18, 11, -42],
      [36, 8, 28],
      [-38, 12, 42],
      [4, 14, 8],
    ];
    positions.forEach(([x, y, z], index) => {
      const group = this.createCoinModel();
      group.position.set(x, y, z);
      this.world.add(group);
      this.coins.push({ group, active: true, phase: index * 0.9 });
    });
  }

  private createCoinModel(): THREE.Group {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.045, 8, 34),
      new THREE.MeshBasicMaterial({ color: '#fff2a8' }),
    );
    group.add(ring);

    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32),
      new THREE.MeshStandardMaterial({
        color: '#f1d97a',
        roughness: 0.24,
        metalness: 0.72,
        emissive: '#6a4f08',
        emissiveIntensity: 0.22,
      }),
    );
    coin.rotation.x = Math.PI / 2;
    coin.castShadow = true;
    group.add(coin);

    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.5, 0.04),
      new THREE.MeshBasicMaterial({ color: '#fff6c8' }),
    );
    mark.position.z = 0.06;
    group.add(mark);

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

  private updateMultiplayer(delta: number): void {
    this.multiplayerSendTimer -= delta;
    if (!this.multiplayer.connected || this.multiplayerSendTimer > 0) return;
    this.multiplayerSendTimer = 0.05;
    this.multiplayer.sendState({
      skin: this.profile.selectedSkin,
      position: this.toNetworkVector(this.player.group.position),
      rotation: {
        x: this.player.group.rotation.x,
        y: this.player.group.rotation.y,
        z: this.player.group.rotation.z,
      },
    });
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

    const bulletSpeed = 68;
    this.playerShots.push({
      mesh,
      velocity: forward.multiplyScalar(bulletSpeed),
      age: 0,
    });
    if (this.multiplayerMode && this.multiplayer.connected) {
      this.multiplayer.sendShot(this.toNetworkVector(muzzle), this.toNetworkVector(this.playerShots[this.playerShots.length - 1].velocity));
    }
    this.audio.shoot();
    this.fireCooldown = 0.13;
  }

  private spawnRemoteShot(origin: NetworkVector, velocity: NetworkVector): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#ffef8a' }),
    );
    mesh.position.set(origin.x, origin.y, origin.z);
    this.world.add(mesh);
    this.shots.push({
      mesh,
      velocity: new THREE.Vector3(velocity.x, velocity.y, velocity.z),
      age: 0,
    });
  }

  private toNetworkVector(vector: THREE.Vector3): NetworkVector {
    return {
      x: Number(vector.x.toFixed(3)),
      y: Number(vector.y.toFixed(3)),
      z: Number(vector.z.toFixed(3)),
    };
  }

  private updatePlayerShots(delta: number): void {
    for (let index = this.playerShots.length - 1; index >= 0; index -= 1) {
      const shot = this.playerShots[index];
      shot.age += delta;
      shot.mesh.position.addScaledVector(shot.velocity, delta);

      const enemy = this.multiplayerMode
        ? undefined
        : this.enemies.find((candidate) => {
            return candidate.active && candidate.group.position.distanceToSquared(shot.mesh.position) < 1.4 * 1.4;
          });

      if (enemy) {
        this.destroyEnemy(enemy);
        this.hud.flashTargetHit();
        this.addCoins(COIN_REWARDS.aiKill, '击落');
        this.audio.pickup(5);
        this.removePlayerShot(index);
      } else if (this.multiplayerMode && this.checkRemotePlayerHit(shot.mesh.position)) {
        this.hud.flashTargetHit();
        this.audio.pickup(5);
        this.removePlayerShot(index);
      } else if (shot.age > 2.2) {
        this.removePlayerShot(index);
      }
    }
  }

  private checkRemotePlayerHit(position: THREE.Vector3): boolean {
    for (const remote of this.remotePlayers.values()) {
      if (remote.state.health <= 0) continue;
      if (remote.group.position.distanceToSquared(position) >= 1.45 * 1.45) continue;
      remote.state.health = Math.max(0, remote.state.health - 1);
      this.updateRemoteHealth(remote);
      this.multiplayer.sendHit(remote.state.id);
      if (remote.state.health === 0) {
        this.createExplosion(remote.group.position, '#ff8a35');
        remote.group.visible = false;
        window.setTimeout(() => {
          remote.group.visible = true;
        }, 1800);
      }
      return true;
    }
    return false;
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
        this.hud.flashHit(this.getDamageDirectionAngle(shot.mesh.position));
        this.removeShot(index);
        if (this.hits >= this.maxHits) this.crashPlayer();
      } else if (shot.age > 4) {
        this.removeShot(index);
      }
    }
  }

  private getDamageDirectionAngle(source: THREE.Vector3): number {
    const dx = source.x - this.player.group.position.x;
    const dz = source.z - this.player.group.position.z;
    const worldAngle = Math.atan2(dx, -dz);
    return worldAngle - this.player.group.rotation.y;
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

  private destroyEnemy(enemy: Enemy): void {
    if (!enemy.active) return;
    this.createExplosion(enemy.group.position, '#ff8a35');
    enemy.active = false;
    enemy.group.visible = false;
    enemy.respawnTimer = 4.5;
    enemy.burstRemaining = 0;
    enemy.burstTimer = 0;
  }

  private createExplosion(position: THREE.Vector3, color: string): void {
    const baseColor = new THREE.Color(color);
    const smokeColor = new THREE.Color('#2a2f31');
    const particleCount = 24;

    for (let index = 0; index < particleCount; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: index % 4 === 0 ? smokeColor : baseColor.clone().lerp(new THREE.Color('#fff2a8'), Math.random() * 0.45),
        transparent: true,
        opacity: index % 4 === 0 ? 0.58 : 0.92,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(index % 4 === 0 ? 0.16 : 0.11, 8, 6), material);
      mesh.position.copy(position);
      mesh.scale.setScalar(0.4 + Math.random() * 0.7);

      const direction = new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(1),
        THREE.MathUtils.randFloat(0.15, 1.05),
        THREE.MathUtils.randFloatSpread(1),
      ).normalize();
      const speed = THREE.MathUtils.randFloat(4.5, 10.5);
      this.world.add(mesh);
      this.explosions.push({
        mesh,
        velocity: direction.multiplyScalar(speed),
        age: 0,
        lifetime: THREE.MathUtils.randFloat(0.48, 0.9),
        startScale: mesh.scale.x,
      });
    }
  }

  private updateExplosions(delta: number): void {
    for (let index = this.explosions.length - 1; index >= 0; index -= 1) {
      const particle = this.explosions[index];
      particle.age += delta;
      const progress = THREE.MathUtils.clamp(particle.age / particle.lifetime, 0, 1);
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.velocity.multiplyScalar(Math.max(0.88, 1 - delta * 1.8));
      particle.velocity.y -= delta * 1.4;
      particle.mesh.scale.setScalar(particle.startScale * (1 + progress * 2.8));
      particle.mesh.material.opacity = (1 - progress) * 0.92;

      if (particle.age >= particle.lifetime) this.removeExplosion(index);
    }
  }

  private removeExplosion(index: number): void {
    const [particle] = this.explosions.splice(index, 1);
    this.world.remove(particle.mesh);
    particle.mesh.geometry.dispose();
    particle.mesh.material.dispose();
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

  private updateCoins(elapsed: number): void {
    this.coins.forEach((coin) => {
      if (!coin.active) return;
      coin.group.rotation.y += 0.036;
      coin.group.position.y += Math.sin(elapsed * 2.8 + coin.phase) * 0.0045;
    });
  }

  private checkCoinPickups(): void {
    this.coins.forEach((coin) => {
      if (!coin.active) return;
      if (coin.group.position.distanceToSquared(this.player.group.position) < 1.65 * 1.65) {
        this.addCoins(COIN_REWARDS.pickup, '拾取');
        this.audio.pickup(1);
        this.respawnCoinFarAway(coin);
      }
    });
  }

  private respawnCoinFarAway(coin: CoinPickup): void {
    const playerPosition = this.player.group.position;
    let best = new THREE.Vector3(0, 10, 0);
    let bestDistance = -1;

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const x = THREE.MathUtils.randFloatSpread(ARENA.halfWidth * 1.75);
      const z = THREE.MathUtils.randFloatSpread(ARENA.halfDepth * 1.75);
      const terrain = this.getTerrainHeight(x, z);
      const y = THREE.MathUtils.randFloat(Math.max(terrain + 4.5, 6.5), ARENA.maxAltitude - 1.2);
      const candidate = new THREE.Vector3(x, y, z);
      const distance = candidate.distanceTo(playerPosition);
      if (distance > bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
      if (distance > 34) break;
    }

    coin.group.position.copy(best);
    coin.group.visible = true;
    coin.active = true;
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
      this.crashPlayer();
    }
  }

  private checkEnemyCrash(): void {
    const collided = this.enemies.find((enemy) => {
      return enemy.active && enemy.group.position.distanceToSquared(this.player.group.position) < 2.1 * 2.1;
    });
    if (!collided) return;

    this.destroyEnemy(collided);
    this.crashPlayer();
  }

  private crashPlayer(): void {
    if (this.mode === 'lost') return;
    this.mode = 'lost';
    this.hits = this.maxHits;
    this.createExplosion(this.player.group.position, '#ff5f35');
    this.player.group.visible = false;
    this.input.setEnabled(false);
    this.releasePointerLock();
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
    this.player.applySkin(this.profile.selectedSkin);
    this.player.group.visible = true;
    for (let index = this.shots.length - 1; index >= 0; index -= 1) this.removeShot(index);
    for (let index = this.playerShots.length - 1; index >= 0; index -= 1) this.removePlayerShot(index);
    for (let index = this.explosions.length - 1; index >= 0; index -= 1) this.removeExplosion(index);
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
    for (const coin of this.coins) {
      coin.active = true;
      coin.group.visible = true;
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
      coins: this.profile.coins,
      targetScore: this.maxHits,
      complete: false,
      mode: this.mode,
      timeLeft: this.elapsed,
      damage: Math.round((this.hits / this.maxHits) * 100),
      playerShots: this.playerShots.length,
      coinPickups: this.coins.filter((coin) => coin.active).length,
      multiplayer: {
        connected: this.multiplayer.connected,
        mode: this.multiplayerMode,
        peers: this.remotePlayers.size,
      },
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
