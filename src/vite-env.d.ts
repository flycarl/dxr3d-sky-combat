/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  score: number;
  coins: number;
  targetScore: number;
  complete: boolean;
  mode: 'menu' | 'playing' | 'paused' | 'won' | 'lost';
  timeLeft: number;
  damage: number;
  playerShots?: number;
  homingMissiles?: number;
  missileCooldown?: number;
  coinPickups?: number;
  multiplayer?: {
    connected: boolean;
    mode: 'deathmatch' | 'three-lives' | 'timed-kills' | null;
    peers: number;
  };
  player: {
    position: { x: number; y: number; z: number };
    speed: number;
    aircraftId: string;
    aircraftRecipe: string;
    propulsion: 'propeller' | 'jet';
  };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  __AIRCRAFT_MODEL_CATALOG__?: Array<{
    id: string;
    recipe: string;
    meshes: number;
    propellers: number;
    exhausts: number;
  }>;
}
