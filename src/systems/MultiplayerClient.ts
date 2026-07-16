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
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (error) {
      this.dispatchEvent(new CustomEvent('status', { detail: this.describeConnectionError(url, error) }));
      return;
    }
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
        if (payload.type === 'full' || payload.type === 'error') this.closingExpected = true;
        this.dispatchEvent(new CustomEvent('message', { detail: payload }));
      } catch {
        this.dispatchEvent(new CustomEvent('status', { detail: '收到无法解析的联机数据' }));
      }
    });

    socket.addEventListener('close', (event) => {
      if (this.closingExpected) return;
      const reason = event.reason ? `：${event.reason}` : '';
      this.dispatchEvent(new CustomEvent('status', { detail: `联机已断开${reason}` }));
    });

    socket.addEventListener('error', () => {
      this.dispatchEvent(new CustomEvent('status', { detail: this.describeConnectionError(url) }));
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

  private describeConnectionError(url: string, error?: unknown): string {
    if (window.location.protocol === 'https:' && url.startsWith('ws://')) {
      return '线上 HTTPS 页面不能连 ws://。请用本地 http://电脑IP:5174 打开游戏';
    }
    if (url.includes('localhost') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return '服务器地址不能用 localhost，请填开服电脑的 ws://电脑IP:8787';
    }
    if (error instanceof Error && error.message) return `联机连接失败：${error.message}`;
    return '联机连接失败，请确认服务器已开启、地址和端口正确';
  }
}
