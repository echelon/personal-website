import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createStaticServer } from './serve.ts';
import { LiveReload } from './live-reload.ts';

test('reload is served only in dev, catches missed events, and leaves disk HTML intact', async t => {
  const root = await mkdtemp(join(tmpdir(), 'brand-reload-'));
  const html = '<!doctype html><html><body><h1>Draft</h1></body></html>';
  await writeFile(join(root, 'index.html'), html);
  await writeFile(join(root, '404.html'), '<h1>Missing</h1>');
  const reload = new LiveReload();
  const dev = createStaticServer(root, reload), preview = createStaticServer(root);
  t.after(async () => {
    reload.close();
    for (const server of [dev, preview]) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
    await rm(root, { recursive: true, force: true });
  });
  const urls: string[] = [];
  for (const server of [dev, preview]) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    urls.push(`http://127.0.0.1:${address.port}`);
  }
  const [devUrl, previewUrl] = urls;
  const response = await fetch(devUrl!);
  const served = await response.text();
  assert.match(served, /src="\/__sitegen\/reload.js"/);
  assert.equal(Number(response.headers.get('content-length')), Buffer.byteLength(served));
  assert.equal(await readFile(join(root, 'index.html'), 'utf8'), html);
  assert.equal(await (await fetch(previewUrl!)).text(), html);
  assert.equal((await fetch(previewUrl + '/__sitegen/events')).status, 404);
  assert.match(await (await fetch(devUrl + '/missing')).text(), /__sitegen\/reload.js/);
  assert.equal(await (await fetch(devUrl!, { method: 'HEAD' })).text(), '');

  const pageRevision = reload.revision;
  reload.publish(); // A build finishes before the old page connects to its stream.
  const controller = new AbortController();
  const stream = await fetch(devUrl + '/__sitegen/events', { signal: controller.signal });
  const reader = stream.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.ok(first.includes(reload.revision));
  assert.ok(!first.includes(pageRevision));
  reload.publish();
  assert.ok(new TextDecoder().decode((await reader.read()).value).includes(reload.revision));
  controller.abort();

  const client = await (await fetch(devUrl + '/__sitegen/reload.js')).text();
  let refreshes = 0;
  const connections: FakeEvents[] = [];
  const listeners = new Map<string, (event: { persisted: boolean }) => void>();
  class FakeScript { dataset = { revision: pageRevision }; }
  class FakeEvents {
    onmessage?: (event: { data: string }) => void;
    closed = false;
    constructor(_url: string) { connections.push(this); }
    close() { this.closed = true; }
  }
  runInNewContext(client, {
    document: { currentScript: new FakeScript() }, HTMLScriptElement: FakeScript, EventSource: FakeEvents,
    window: { location: { reload: () => refreshes++ }, addEventListener: (name: string, callback: (event: { persisted: boolean }) => void) => listeners.set(name, callback) },
  });
  connections[0]!.onmessage!({ data: pageRevision });
  assert.equal(refreshes, 0);
  connections[0]!.onmessage!({ data: reload.revision });
  assert.equal(refreshes, 1);
  assert.equal(connections[0]!.closed, true);
  listeners.get('pageshow')!({ persisted: true });
  assert.equal(connections.length, 2, 'back/forward cache restore reconnects');
});
