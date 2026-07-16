import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';

function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

function printGameUrls() {
  const addresses = localAddresses();
  const path = '/dxr3d-sky-combat/';
  console.log('');
  console.log('============================================================');
  console.log('打开下面这个游戏网址：');
  console.log('');
  if (addresses.length === 0) {
    console.log(`  http://localhost:5174${path}`);
  } else {
    for (const address of addresses) {
      console.log(`  http://${address}:5174${path}`);
    }
  }
  console.log('');
  console.log('这个网址里可以单人，也可以局域网创建/加入房间。');
  console.log('房主和朋友都打开同一个网址，然后用邀请码进同一个房间。');
  console.log('============================================================');
  console.log('');
}

const processes = [
  spawn('npm', ['run', 'lan-server', '--', '--port', '8787'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0'], { stdio: 'inherit' }),
];

setTimeout(printGameUrls, 900);

function shutdown() {
  for (const child of processes) {
    if (!child.killed) child.kill('SIGINT');
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

for (const child of processes) {
  child.on('exit', (code) => {
    if (code === 0 || code === null) return;
    shutdown();
    process.exit(code);
  });
}
