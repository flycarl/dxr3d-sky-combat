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
const rooms = new Map();
const clients = new Map();
let nextId = 1;

const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  response.end('dxr3d LAN room server is running\n');
});

const wss = new WebSocketServer({ server });

function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = '';
    for (let index = 0; index < 4; index += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('无法生成房间邀请码');
}

function send(socket, payload) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(payload));
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

function broadcast(roomCode, payload, exceptId = '') {
  const room = rooms.get(roomCode);
  if (!room) return;
  for (const id of room.clients) {
    if (id === exceptId) continue;
    const client = clients.get(id);
    if (client) send(client.socket, payload);
  }
}

function removeClient(id) {
  const client = clients.get(id);
  if (!client) return;
  const room = rooms.get(client.roomCode);
  clients.delete(id);
  if (!room) return;
  room.clients.delete(id);
  broadcast(client.roomCode, { type: 'peer-left', id });
  if (room.clients.size === 0) rooms.delete(client.roomCode);
}

function joinRoom(socket, id, roomCode, message) {
  const room = rooms.get(roomCode);
  if (!room) {
    send(socket, { type: 'error', message: '没有这个房间' });
    socket.close();
    return null;
  }
  if (room.clients.size >= maxPlayers) {
    send(socket, { type: 'full', message: '房间已满，最多 3 人' });
    socket.close();
    return null;
  }

  const client = {
    id,
    socket,
    roomCode,
    name: String(message.name ?? id).slice(0, 14),
    mode: room.mode,
    skin: message.skin ?? 'standard',
    health: 10,
    lives: room.mode === 'three-lives' ? 3 : 0,
    kills: 0,
    position: { x: 0, y: 8, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  };
  clients.set(id, client);
  room.clients.add(id);
  send(socket, { type: 'welcome', id, mode: room.mode, maxPlayers, roomCode });
  send(socket, {
    type: 'snapshot',
    peers: Array.from(room.clients)
      .filter((peerId) => peerId !== id)
      .map((peerId) => clients.get(peerId))
      .filter(Boolean)
      .map(publicState),
  });
  broadcast(roomCode, { type: 'peer-joined', peer: publicState(client) }, id);
  return client;
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

    if (message.type === 'create-room' || message.type === 'join-room') {
      id = `P${nextId}`;
      nextId += 1;
      const roomCode =
        message.type === 'create-room'
          ? makeRoomCode()
          : String(message.roomCode ?? '').trim().toUpperCase();
      if (message.type === 'create-room') {
        rooms.set(roomCode, {
          code: roomCode,
          mode: message.mode ?? 'deathmatch',
          clients: new Set(),
        });
      }
      joinRoom(socket, id, roomCode, message);
      return;
    }

    const client = clients.get(id);
    if (!client) return;

    if (message.type === 'state') {
      client.skin = message.skin ?? client.skin;
      client.position = message.position ?? client.position;
      client.rotation = message.rotation ?? client.rotation;
      broadcast(client.roomCode, { type: 'state', peer: publicState(client) }, id);
    } else if (message.type === 'shot') {
      broadcast(client.roomCode, { type: 'shot', id, origin: message.origin, velocity: message.velocity }, id);
    } else if (message.type === 'hit') {
      const target = clients.get(String(message.targetId));
      if (!target || target.roomCode !== client.roomCode || target.health <= 0) return;
      target.health = Math.max(0, target.health - 1);
      if (target.health === 0) {
        client.kills += 1;
        if (client.mode === 'three-lives') target.lives = Math.max(0, target.lives - 1);
        setTimeout(() => {
          if (!clients.has(target.id)) return;
          target.health = 10;
          broadcast(target.roomCode, { type: 'state', peer: publicState(target) });
        }, 1800);
      }
      broadcast(client.roomCode, {
        type: 'hit',
        attackerId: client.id,
        targetId: target.id,
        health: target.health,
        lives: target.lives,
      });
      const room = rooms.get(client.roomCode);
      broadcast(client.roomCode, {
        type: 'score',
        scores: Object.fromEntries(
          Array.from(room?.clients ?? []).map((peerId) => {
            const peer = clients.get(peerId);
            return [peerId, peer?.kills ?? 0];
          }),
        ),
      });
    }
  });

  socket.on('close', () => {
    if (id) removeClient(id);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`LAN room server listening on ws://localhost:${port}`);
  for (const address of localAddresses()) {
    console.log(`同一 Wi-Fi 可连接: ws://${address}:${port}`);
  }
});
