import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script } from 'node:vm';
import { buildFrontend, parsePlan } from './build.ts';
import type { ThemePreferences } from '../libs/site/src/theme.ts';

test('frontend manifest accepts empty sites and article embed entries', () => {
  const out_dir = join(tmpdir(), 'site-output');
  assert.deepEqual(parsePlan({ out_dir, entries: [] }), { out_dir, entries: [] });
  const entries = [{ source: join(tmpdir(), 'app.ts'), output: 'article/llm-survey/_embeds/1' }];
  assert.deepEqual(parsePlan({ out_dir, entries }), { out_dir, entries });
});

test('frontend manifest rejects malformed inputs and outputs outside article embed paths', () => {
  const out_dir = join(tmpdir(), 'site-output');
  for (const input of [null, [], {}, { out_dir: 'relative', entries: [] }, { out_dir, entries: {} }]) {
    assert.throws(() => parsePlan(input), /Invalid frontend manifest/);
  }
  const source = join(tmpdir(), 'app.ts');
  for (const entry of [
    null, { source: 'relative.ts', output: 'article/demo/_embeds/1' },
    ...['../outside', '/absolute', 'assets/site', 'article/../_embeds/1', 'article/demo/_embeds/0', 'article/demo/_embeds/1.js']
      .map(output => ({ source, output })),
  ]) {
    assert.throws(() => parsePlan({ out_dir, entries: [entry] }), /Invalid embed entry/);
  }
});

test('frontend manifest rejects duplicate embed outputs', () => {
  const entry = { source: join(tmpdir(), 'app.ts'), output: 'article/demo/_embeds/1' };
  assert.throws(() => parsePlan({ out_dir: tmpdir(), entries: [entry, entry] }), /Duplicate embed output/);
});

test('production compiler emits a classic theme initializer and executable TypeScript embeds', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'brand-compiler-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = join(temp, 'app.ts');
  await writeFile(source, `
    import type { EmbedMount } from '@brand/embeds';
    import './style.css';
    const mount: EmbedMount = root => {
      const message: string = 'Mounted TypeScript';
      root.textContent = message;
      return () => { root.textContent = null; };
    };
    export default mount;
  `);
  await writeFile(join(temp, 'style.css'), '.test-embed { color: red; }');
  const out_dir = join(temp, 'output');
  await buildFrontend({ out_dir, entries: [{ source, output: 'article/demo/_embeds/1' }] });

  const initializer = await readFile(join(out_dir, 'assets/theme-init.js'), 'utf8');
  // Classic-script execution catches leaked TypeScript syntax or ESM imports,
  // either of which would stop the theme being chosen before the stylesheet.
  const document = { cookie: 'brand-theme=rain', documentElement: { dataset: { theme: 'day' } } };
  const window: { brandTheme?: ThemePreferences } = {};
  new Script(initializer).runInNewContext({ document, window });
  assert.equal(document.documentElement.dataset.theme, 'rain');
  assert.equal(window.brandTheme?.resolveTheme(), 'rain');

  const embed = await readFile(join(out_dir, 'article/demo/_embeds/1.js'), 'utf8');
  const module: { default: (root: { textContent: string | null }) => () => void } =
    await import(`data:text/javascript;base64,${Buffer.from(embed).toString('base64')}`);
  const root = { textContent: '' as string | null };
  const cleanup = module.default(root);
  assert.equal(root.textContent, 'Mounted TypeScript');
  cleanup();
  assert.equal(root.textContent, null);
  assert.match(await readFile(join(out_dir, 'article/demo/_embeds/1.css'), 'utf8'), /\.test-embed/);
  for (const asset of ['site.js', 'site.css', 'favicon.svg', 'lucide-LICENSE.txt']) {
    assert.ok((await readFile(join(out_dir, 'assets', asset))).length, `Missing asset: ${asset}`);
  }
  assert.ok(!(await readdir(out_dir, { recursive: true })).some(file => /\.[cm]?tsx?$/.test(file)),
    'The published site must not contain TypeScript source files');
});

test('application, tooling, and test source files contain no bare JavaScript', async () => {
  for (const directory of ['../libs/', './']) {
    const files = await readdir(new URL(directory, import.meta.url), { recursive: true });
    assert.deepEqual(files.filter(file => /\.[cm]?jsx?$/.test(file)), [], `JavaScript source in ${directory}`);
  }
});
