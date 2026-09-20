import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

for (const busyPort of [false, true]) test(`Rust dev loop rebuilds drafts, recovers from errors, and follows config and new files (${busyPort ? 'busy port' : 'automatic port'})`, { timeout: 120_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'brand-dev-'));
  await mkdir(join(root, 'articles'));
  const config = (output: string) => `
[site]
name = "test"
email = "test@example.com"
base_url = "https://example.com"
title_append = "test"
home_title = "test"
articles_title = "Articles"
description = "Test"
default_theme = "day"
[build]
articles_dir = "articles"
frontend_dir = ${JSON.stringify(join(repository, 'frontend'))}
output_dir = "${output}"
`;
  const article = (body: string) => `+++\ndraft = true\n+++\n${body}\n`;
  const source = join(root, 'articles/demo.md');
  await writeFile(join(root, 'config.toml'), config('build'));
  await writeFile(source, article('Original draft'));
  let port = 0;
  if (busyPort) {
    const occupied = createServer();
    t.after(() => new Promise<void>(resolve => occupied.close(() => resolve())));
    // Reserve a real port with room for the launcher to try a higher one.
    do {
      occupied.listen(0, '127.0.0.1');
      await once(occupied, 'listening');
      const address = occupied.address();
      assert.ok(address && typeof address !== 'string');
      port = address.port;
      if (port === 65535) await new Promise<void>(resolve => occupied.close(() => resolve()));
    } while (port === 65535);
  }
  const child = spawn(process.execPath, ['frontend/tools/dev.ts', '--config', join(root, 'config.toml')], {
    cwd: repository, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  t.after(async () => {
    child.kill('SIGTERM');
    await exited;
    await rm(root, { recursive: true, force: true });
  });
  async function until(predicate: () => boolean, label: string) {
    const deadline = Date.now() + 45_000;
    while (!predicate()) {
      assert.equal(child.exitCode, null, `Dev exited: ${stderr}`);
      assert.ok(Date.now() < deadline, `${label}\n${stdout}\n${stderr}`);
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }
  const builds = () => stdout.split('Rebuilt; refreshing connected browsers.').length - 1;
  await until(() => builds() >= 1 && stdout.includes('Dev: http'), 'Initial build');
  const url = /Dev: (http:\/\/127\.0\.0\.1:\d+)/.exec(stdout)![1]!;
  assert.equal(stdout.split('Dev: http').length - 1, 1, 'print the listening URL only once');
  assert.ok(Number(new URL(url).port) > port, 'use an available port');
  if (busyPort) assert.ok(stdout.includes(`Port ${port} is in use; trying ${port + 1}.`));
  const page = async (path = '/article/demo') => (await fetch(url + path)).text();
  const revision = (html: string) => /data-revision="([^"]+)"/.exec(html)![1]!;
  const original = await page();
  assert.match(original, /Original draft/);
  assert.match(original, /__sitegen\/reload.js/);
  const builtFile = join(root, 'build/article/demo/index.html');
  const diskOriginal = await readFile(builtFile, 'utf8');
  assert.doesNotMatch(diskOriginal, /__sitegen/);

  // A malformed save keeps the old HTML and revision. A later atomic save recovers.
  const errorOffset = stderr.length;
  await writeFile(source, '+++\ntitle = [\n+++\nInvalid');
  await until(() => stderr.slice(errorOffset).includes('Build failed'), 'Failed build');
  assert.equal(await readFile(builtFile, 'utf8'), diskOriginal);
  assert.equal(revision(await page()), revision(original));
  let count = builds();
  await writeFile(join(root, 'articles/.save.tmp'), article('Recovered draft'));
  await rename(join(root, 'articles/.save.tmp'), source);
  await until(() => builds() > count, 'Atomic save');
  assert.match(await page(), /Recovered draft/);
  assert.notEqual(revision(await page()), revision(original));

  // Build installation must not cause a watch/rebuild feedback loop.
  count = builds();
  await new Promise(resolve => setTimeout(resolve, 1400));
  assert.equal(builds(), count, 'generated output must not retrigger the watcher');

  await mkdir(join(root, 'articles/nested'));
  await writeFile(join(root, 'articles/nested/article.md'), 'A newly created article');
  await until(() => builds() > count, 'New directory and article');
  assert.match(await page('/article/nested'), /A newly created article/);
  count = builds();
  await rm(join(root, 'articles/nested/article.md'));
  await until(() => builds() > count, 'Deleted article');
  assert.equal((await fetch(url + '/article/nested')).status, 404);

  // A saved config can change the output directory without restarting the server.
  count = builds();
  await writeFile(join(root, '.config.tmp'), config('alternate-build'));
  await rename(join(root, '.config.tmp'), join(root, 'config.toml'));
  await until(() => builds() > count, 'Changed output directory');
  assert.match(await readFile(join(root, 'alternate-build/article/demo/index.html'), 'utf8'), /Recovered draft/);
  assert.match(await page(), /Recovered draft/);
});
