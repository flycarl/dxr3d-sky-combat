import { spawn } from 'node:child_process';

const processes = [
  spawn('npm', ['run', 'lan-server', '--', '--port', '8787'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0'], { stdio: 'inherit' }),
];

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
