import { build } from 'esbuild';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestIndex = process.argv.indexOf('--manifest');
if (manifestIndex < 0 || !process.argv[manifestIndex + 1]) {
  throw new Error('This compiler is called by Rust. Use cargo run -- build or npm run build.');
}
const plan = JSON.parse(await readFile(process.argv[manifestIndex + 1], 'utf8'));
const entryPoints = [
  { in: resolve(frontend, 'libs/site/src/main.ts'), out: 'assets/site' },
  ...plan.entries.map(({ source, output }) => ({ in: source, out: output })),
];
const result = await build({
  absWorkingDir: frontend,
  entryPoints,
  outdir: plan.out_dir,
  bundle: true,
  splitting: true,
  format: 'esm',
  jsx: 'automatic',
  platform: 'browser',
  publicPath: '/',
  nodePaths: [resolve(frontend, 'node_modules')],
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  metafile: true,
  tsconfig: resolve(frontend, 'tsconfig.json'),
  chunkNames: 'assets/chunks/[name]-[hash]',
  assetNames: 'assets/media/[name]-[hash]',
  loader: { '.wasm': 'file', '.png': 'file', '.jpg': 'file', '.svg': 'file', '.woff2': 'file' },
  logLevel: 'info',
});
for (const entry of plan.entries) {
  const target = resolve(plan.out_dir, `${entry.output}.js`);
  const metadata = Object.entries(result.metafile.outputs).find(([path]) => resolve(frontend, path) === target)?.[1];
  if (!metadata?.exports.includes('default')) {
    throw new Error(`Embed ${entry.source} must export a default mount(root, context) function.`);
  }
}
await mkdir(resolve(plan.out_dir, 'assets'), { recursive: true });
await copyFile(resolve(frontend, 'libs/site/src/favicon.svg'), resolve(plan.out_dir, 'assets/favicon.svg'));
