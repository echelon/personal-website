import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './serve.ts';
import { LiveReload } from './live-reload.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: ./dev.sh [--config /path/to/config.toml]

Starts Rust watch/builds and the local server with automatic browser refresh.
Drafts are included. Press Ctrl-C to stop both.
Starts on port 4173 and tries the next port if it is busy.
Set PORT to change the starting port, e.g. PORT=4000 ./dev.sh.
Relative config paths are resolved from the repository root.`);
  process.exit(0);
}
const liveReload = new LiveReload();
let output = resolve(root, 'build');
let listening = false, stopping = false;
const server = createStaticServer(() => output, liveReload);
let port = Number(process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer between 0 and 65535');

// A process group lets shutdown also stop an in-flight Cargo/Node build.
const watcher = spawn('cargo', ['run', '--locked', '--features', 'dev', '--', 'watch', '--events', ...args], {
  cwd: root, stdio: ['ignore', 'pipe', 'inherit'], detached: process.platform !== 'win32',
});
const lines = createInterface({ input: watcher.stdout });

function stop(code: number) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  lines.close();
  liveReload.close();
  server.close();
  server.closeAllConnections();
  if (watcher.pid) {
    try {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(watcher.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-watcher.pid, 'SIGTERM');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') console.error(error);
    }
  }
}

lines.on('line', line => {
  try {
    const event: { event: string; output: string } = JSON.parse(line);
    if (!['ready', 'building', 'built', 'failed'].includes(event.event) || typeof event.output !== 'string') throw new Error('Invalid watcher event');
    if (event.event === 'ready') {
      output = event.output;
      if (!listening) {
        listening = true;
        server.listen(port, '127.0.0.1');
      }
    } else if (event.event === 'built') {
      output = event.output;
      liveReload.publish();
      console.log('Rebuilt; refreshing connected browsers.');
    }
  } catch (error) { console.error('Invalid Rust watcher output:', line, error); stop(1); }
});
server.on('listening', () => {
  const address = server.address();
  if (address && typeof address !== 'string') console.log(`Dev: http://127.0.0.1:${address.port} (drafts + automatic reload)`);
});
server.on('error', (error: NodeJS.ErrnoException) => {
  if (stopping) return;
  if (error.code === 'EADDRINUSE' && port > 0 && port < 65535) {
    console.log(`Port ${port} is in use; trying ${port + 1}.`);
    server.listen(++port, '127.0.0.1');
    return;
  }
  console.error(error);
  stop(1);
});
watcher.on('error', error => { console.error('Cannot start Rust watcher:', error); stop(1); });
watcher.on('exit', code => { if (!stopping) stop(code ?? 1); });
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
