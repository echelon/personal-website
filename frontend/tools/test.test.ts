import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';
import { discoverTests, runTests } from './test.ts';

test('test discovery includes nested article tests and shared tests, excluding fixtures and dependencies', async t => {
  const root = await mkdtemp(join(tmpdir(), 'brand-test-discovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const expected = [
    'frontend/tools/shared.test.ts',
    'articles/2030/example/.tests/applet.test.mts',
    'articles/2030/example/.tests/nested/another.test.mts',
    'articles/other/.tests/example.test.ts',
  ];
  const excluded = [
    'articles/2030/example/.tests/fixtures/data.json',
    'articles/2030/example/.tests/helper.mts',
    'articles/2030/example/.private/ignored.test.ts',
    'articles/2030/example/node_modules/package/vendor.test.ts',
    'frontend/tools/.cache/ignored.test.ts',
  ];
  for (const path of [...expected, ...excluded]) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), '');
  }
  assert.deepEqual(await discoverTests([join(root, 'frontend/tools'), join(root, 'articles')]),
    expected.map(path => join(root, path)).sort());
  assert.deepEqual(await discoverTests([join(root, 'articles/2030/example/.tests/fixtures')]), []);
  await assert.rejects(runTests([]), /No TypeScript tests found/);
});

test('every discovered test is checked with Node types and excluded from the browser project', async () => {
  const frontend = fileURLToPath(new URL('../', import.meta.url));
  const files = await discoverTests([join(frontend, 'tools'), join(frontend, '../articles')]);
  function projectFiles(name: string): Set<string> {
    const path = join(frontend, name);
    const config = ts.readConfigFile(path, ts.sys.readFile);
    assert.equal(config.error, undefined);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, frontend, undefined, path);
    assert.deepEqual(parsed.errors, []);
    return new Set(parsed.fileNames);
  }
  const browser = projectFiles('tsconfig.json');
  const tooling = projectFiles('tsconfig.tools.json');
  for (const file of files) {
    assert.ok(tooling.has(file), `Test is missing from the Node project: ${file}`);
    assert.ok(!browser.has(file), `Test is included in the browser project: ${file}`);
  }
});

test('the runner preserves successful and failing test exit codes from another working directory', async t => {
  const root = await mkdtemp(join(tmpdir(), 'brand-test-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'result.test.mts');
  const script = `import { runTests } from ${JSON.stringify(new URL('./test.ts', import.meta.url).href)};
    process.exitCode = await runTests([process.argv[1]], ['--test-reporter=tap']);`;
  // Exercise a fresh CLI invocation; Node otherwise suppresses nested --test runs.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = () => promisify(execFile)(process.execPath, ['--input-type=module', '-e', script, path], { cwd: root, env });
  await writeFile(path, "import test from 'node:test'; test('fixture success', () => {});");
  assert.match((await run()).stdout, /# pass 1/);
  await writeFile(path, "import test from 'node:test'; test('fixture failure', () => { throw new Error('expected failure'); });");
  await assert.rejects(run(), (error: unknown) => {
    assert.ok(error instanceof Error && 'code' in error && 'stdout' in error);
    assert.equal(error.code, 1);
    assert.match(String(error.stdout), /# fail 1/);
    return true;
  });
});
