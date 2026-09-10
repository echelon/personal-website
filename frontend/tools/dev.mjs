import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './serve.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let running = false, pending = false, timer, child, server;
let stopping = false;
function rebuild() {
  if (stopping) return;
  if (running) { pending = true; return; }
  running = true;
  child = spawn('cargo', ['run', '--', 'build'], { cwd: root, stdio: 'inherit' });
  child.on('error', error => { console.error(error); running = false; });
  child.on('exit', code => {
    running = false;
    if (stopping) return;
    if (code === 0 && !server) {
      const port = Number(process.env.PORT ?? 4173);
      server = createStaticServer(resolve(root, 'build'));
      server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port} (refresh after edits)`));
    }
    if (code !== 0) console.error('Build failed. The last successful preview is preserved.');
    if (pending) { pending = false; rebuild(); }
  });
}
const watchers = ['articles', 'crates', 'frontend/libs', 'frontend/tools', 'config.toml', 'Cargo.toml', 'frontend/tsconfig.json']
  .map(path => watch(resolve(root, path), { recursive: true }, () => {
    clearTimeout(timer); timer = setTimeout(rebuild, 180);
  }));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true; clearTimeout(timer);
    watchers.forEach(watcher => watcher.close());
    child?.kill(signal); server?.close();
  });
}
rebuild();
