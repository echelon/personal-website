import { build } from 'esbuild';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export interface FrontendEntry {
  source: string;
  output: string;
}

export interface FrontendPlan {
  out_dir: string;
  entries: FrontendEntry[];
}

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Check the Rust/Node JSON boundary before any compiler writes files. */
export function parsePlan(value: unknown): FrontendPlan {
  if (!isRecord(value) || typeof value.out_dir !== 'string' || !isAbsolute(value.out_dir) || !Array.isArray(value.entries)) {
    throw new Error('Invalid frontend manifest: expected an absolute out_dir and an entries array.');
  }
  const outputs = new Set<string>();
  const entries = value.entries.map((entry: unknown): FrontendEntry => {
    if (!isRecord(entry) || typeof entry.source !== 'string' || !isAbsolute(entry.source)
      || typeof entry.output !== 'string' || !/^article\/[a-z0-9-]+\/_embeds\/[1-9]\d*$/.test(entry.output)) {
      throw new Error('Invalid embed entry: expected an absolute source and article/{slug}/_embeds/{number} output.');
    }
    if (outputs.has(entry.output)) throw new Error(`Duplicate embed output: ${entry.output}`);
    outputs.add(entry.output);
    return { source: entry.source, output: entry.output };
  });
  return { out_dir: value.out_dir, entries };
}

/** Type-check browser code, tools, tests, and even entries from alternate article roots. */
export function checkTypeScript(frontend: string, entries: readonly FrontendEntry[]): void {
  for (const filename of ['tsconfig.json', 'tsconfig.tools.json']) {
    const configPath = resolve(frontend, filename);
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, frontend, undefined, configPath);
    const extraFiles = filename === 'tsconfig.json'
      ? entries.map(entry => entry.source).filter(source => /\.[cm]?tsx?$/.test(source)) : [];
    const program = ts.createProgram([...new Set([...parsed.fileNames, ...extraFiles])], parsed.options);
    const diagnostics = [...(config.error ? [config.error] : []), ...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
    if (diagnostics.length) {
      throw new Error(ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: file => file,
        getCurrentDirectory: () => frontend,
        getNewLine: () => '\n',
      }));
    }
  }
}

export async function buildFrontend(plan: FrontendPlan, frontend = frontendRoot): Promise<void> {
  checkTypeScript(frontend, plan.entries);
  const result = await build({
    absWorkingDir: frontend,
    entryPoints: [
      { in: resolve(frontend, 'libs/site/src/main.ts'), out: 'assets/site' },
      ...plan.entries.map(({ source, output }) => ({ in: source, out: output })),
    ],
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
  // A classic, self-contained bundle runs synchronously before CSS. TypeScript
  // source is never inlined into HTML or sent directly to the browser.
  await build({
    absWorkingDir: frontend,
    entryPoints: [resolve(frontend, 'libs/site/src/theme-init.ts')],
    outfile: resolve(plan.out_dir, 'assets/theme-init.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    minify: true,
    logLevel: 'info',
  });
  await mkdir(resolve(plan.out_dir, 'assets'), { recursive: true });
  await copyFile(resolve(frontend, 'libs/site/src/favicon.svg'), resolve(plan.out_dir, 'assets/favicon.svg'));
  await copyFile(resolve(frontend, 'libs/site/icons/LICENSE'), resolve(plan.out_dir, 'assets/lucide-LICENSE.txt'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifestIndex = process.argv.indexOf('--manifest');
  if (manifestIndex < 0 || !process.argv[manifestIndex + 1]) {
    throw new Error('This compiler is called by Rust. Use cargo run -- build or npm run build.');
  }
  const input: unknown = JSON.parse(await readFile(process.argv[manifestIndex + 1], 'utf8'));
  await buildFrontend(parsePlan(input));
}
