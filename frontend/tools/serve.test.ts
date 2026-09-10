import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createStaticServer } from './serve.ts';

test('preview serves clean routes, media ranges, Wasm, and real 404s', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'brand-preview-'));
  const root = join(temp, 'build');
  await mkdir(join(root, 'article/demo'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<h1>brand</h1>');
  await writeFile(join(root, 'article/demo/index.html'), '<h1>Demo</h1>');
  await writeFile(join(root, '404.html'), '<h1>Page not found</h1>');
  await writeFile(join(root, 'clip.mp4'), '0123456789');
  await writeFile(join(root, 'game.wasm'), 'wasm');
  await writeFile(join(root, '.sitegen-output'), 'private marker');
  await writeFile(join(temp, 'outside.txt'), 'outside');
  await symlink(join(temp, 'outside.txt'), join(root, 'escape.txt'));
  const server = createStaticServer(root);
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temp, { recursive: true, force: true }); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  for (const path of ['/article/demo', '/article/demo/']) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<h1>Demo</h1>');
  }
  const missing = await fetch(url + '/missing');
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /Page not found/);
  const range = await fetch(url + '/clip.mp4', { headers: { Range: 'bytes=2-5' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(await range.text(), '2345');
  const suffix = await fetch(url + '/clip.mp4', { headers: { Range: 'bytes=-3' } });
  assert.equal(await suffix.text(), '789');
  assert.equal((await fetch(url + '/clip.mp4', { headers: { Range: 'bytes=99-100' } })).status, 416);
  assert.equal((await fetch(url + '/game.wasm')).headers.get('content-type'), 'application/wasm');
  assert.equal((await fetch(url + '/.sitegen-output')).status, 404);
  assert.equal((await fetch(url + '/escape.txt')).status, 403);
  assert.equal((await fetch(url + '/', { method: 'POST' })).status, 405);
  const head = await fetch(url + '/', { method: 'HEAD' });
  assert.equal(await head.text(), '');
});
