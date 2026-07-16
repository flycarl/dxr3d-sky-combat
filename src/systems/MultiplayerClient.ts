import type { AircraftSkinId } from './Customization';

export type MultiplayerMode = 'deathmatch' | 'three-lives' | 'timed-kills';

export type NetworkVector = {
  x: number;
  y: number;
  z: number;
};

export type NetworkRotation = {
  x: number;
  y: number;
  z: number;
};

export type MultiplayerEvent =
  | { type: 'welcome'; id: string; mode: MultiplayerMode; maxPlayers: number; roomCode: string }
  | { type: 'snapshot'; peers: RemotePlayerState[] }
  | { type: 'peer-joined'; peer: RemotePlayerState }
  | { type: 'peer-left'; id: string }
  | { type: 'state'; peer: RemotePlayerState }
  | { type: 'shot'; id: string; origin: NetworkVector; velocity: NetworkVector }
  | { type: 'hit'; attackerId: string; targetId: string; health: number; lives: number }
  | { type: 'score'; scores: Record<string, number> }
  | { type: 'full'; message: string }
  | { type: 'error'; message: string };

export type RemotePlayerState = {
  id: string;
  name: string;
  mode: MultiplayerMode;
  skin: AircraftSkinId;
  health: number;
  lives: number;
  kills: number;
  position: NetworkVector;
  rotation: NetworkRotation;
};

type JoinOptions = {
  action: 'create' | 'join';
  name: string;
  mode: MultiplayerMode;
  skin: AircraftSkinId;
  roomCode?: string;
};

export class MultiplayerClient extends EventTarget {
  id = '';
  private socket: WebSocket | null = null;
  private closingExpected = false;

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(url: string, options: JoinOptions): void {
    this.disconnect();
    this.closingExpected = false;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.send({
        type: options.action === 'create' ? 'create-room' : 'join-room',
        name: options.name,
        mode: options.mode,
        skin: options.skin,
        roomCode: options.roomCode,
      });
      this.dispatchEvent(new CustomEvent('status', { detail: '已连接服务器' }));
    });

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as MultiplayerEvent;
        if (payload.type === 'welcome') this.id = payload.id;
        this.dispatchEvent(new CustomEvent('message', { detail: payload }));
      } catch {
        this.dispatchEvent(new CustomEvent('status', { detail: '收到无法解析的联机数据' }));
      }
    });

    socket.addEventListener('close', () => {
      if (this.closingExpected) return;
      this.dispatchEvent(new CustomEvent('status', { detail: '联机已断开' }));
    });

    socket.addEventListener('error', () => {
      this.dispatchEvent(new CustomEvent('status', { detail: '联机连接失败' }));
    });
  }

  sendState(state: Omit<RemotePlayerState, 'id' | 'name' | 'mode' | 'health' | 'lives' | 'kills'>): void {
    this.send({ type: 'state', ...state });
  }

  sendShot(origin: NetworkVector, velocity: NetworkVector): void {
    this.send({ type: 'shot', origin, velocity });
  }

  sendHit(targetId: string): void {
    this.send({ type: 'hit', targetId });
  }

  disconnect(): void {
    if (!this.socket) return;
    this.closingExpected = true;
    this.socket.close();
    this.socket = null;
    this.id = '';
  }

  private send(payload: object): void {
    if (!this.connected) return;
    this.socket?.send(JSON.stringify(payload));
  }
}
