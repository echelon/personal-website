import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Load a browser module as ESM, using the same compiler and aliases as production. No DOM is supplied. */
export async function loadBrowserModule(source: URL): Promise<unknown> {
  const { outputFiles } = await build({
    entryPoints: [fileURLToPath(source)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
    nodePaths: [fileURLToPath(new URL('../node_modules/', import.meta.url))],
    logLevel: 'silent',
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
}
