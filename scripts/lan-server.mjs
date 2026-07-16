import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { WebSocketServer } from 'ws';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith('--')) continue;
  const [key, inlineValue] = arg.slice(2).split('=');
  const nextValue = process.argv[index + 1];
  if (inlineValue !== undefined) {
    args.set(key, inlineValue);
  } else if (nextValue && !nextValue.startsWith('--')) {
    args.set(key, nextValue);
    index += 1;
  } else {
    args.set(key, 'true');
  }
}

const port = Number(args.get('port') ?? process.env.PORT ?? 8787);
const maxPlayers = 3;
const clients = new Map();
let roomMode = 'deathmatch';
let nextId = 1;

const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('dxr3d LAN server is running\n');
});

const wss = new WebSocketServer({ server });

function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

function send(socket, payload) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast(payload, exceptId = '') {
  for (const [id, client] of clients) {
    if (id === exceptId) continue;
    send(client.socket, payload);
  }
}

function publicState(client) {
  return {
    id: client.id,
    name: client.name,
    mode: client.mode,
    skin: client.skin,
    health: client.health,
    lives: client.lives,
    kills: client.kills,
    position: client.position,
    rotation: client.rotation,
  };
}

function resetRoomIfEmpty() {
  if (clients.size === 0) roomMode = 'deathmatch';
}

wss.on('connection', (socket) => {
  let id = '';

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      send(socket, { type: 'error', message: 'bad-json' });
      return;
    }

    if (message.type === 'join') {
      if (clients.size >= maxPlayers) {
        send(socket, { type: 'full', message: '房间已满，最多 3 人' });
        socket.close();
        return;
      }

      id = `P${nextId}`;
      nextId += 1;
      if (clients.size === 0) roomMode = message.mode ?? 'deathmatch';
      const client = {
        id,
        socket,
        name: String(message.name ?? id).slice(0, 14),
        mode: roomMode,
        skin: message.skin ?? 'standard',
        health: 10,
        lives: roomMode === 'three-lives' ? 3 : 0,
        kills: 0,
        position: { x: 0, y: 8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      };
      clients.set(id, client);
      send(socket, { type: 'welcome', id, mode: roomMode, maxPlayers });
      send(socket, {
        type: 'snapshot',
        peers: Array.from(clients.values())
          .filter((peer) => peer.id !== id)
          .map(publicState),
      });
      broadcast({ type: 'peer-joined', peer: publicState(client) }, id);
      return;
    }

    const client = clients.get(id);
    if (!client) return;

    if (message.type === 'state') {
      client.skin = message.skin ?? client.skin;
      client.position = message.position ?? client.position;
      client.rotation = message.rotation ?? client.rotation;
      broadcast({ type: 'state', peer: publicState(client) }, id);
    } else if (message.type === 'shot') {
      broadcast({ type: 'shot', id, origin: message.origin, velocity: message.velocity }, id);
    } else if (message.type === 'hit') {
      const target = clients.get(String(message.targetId));
      if (!target || target.health <= 0) return;
      target.health = Math.max(0, target.health - 1);
      if (target.health === 0) {
        client.kills += 1;
        if (roomMode === 'three-lives') target.lives = Math.max(0, target.lives - 1);
        setTimeout(() => {
          if (!clients.has(target.id)) return;
          target.health = 10;
          broadcast({ type: 'state', peer: publicState(target) });
        }, 1800);
      }
      broadcast({
        type: 'hit',
        attackerId: client.id,
        targetId: target.id,
        health: target.health,
        lives: target.lives,
      });
      broadcast({
        type: 'score',
        scores: Object.fromEntries(Array.from(clients.values()).map((peer) => [peer.id, peer.kills])),
      });
    }
  });

  socket.on('close', () => {
    if (!id) return;
    clients.delete(id);
    broadcast({ type: 'peer-left', id });
    resetRoomIfEmpty();
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`LAN server listening on ws://localhost:${port}`);
  for (const address of localAddresses()) {
    console.log(`同一 Wi-Fi 可连接: ws://${address}:${port}`);
  }
});
