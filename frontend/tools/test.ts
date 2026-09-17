import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Discover shared tests and article-local tests without entering dependencies or private assets. */
export async function discoverTests(roots: readonly string[]): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && (!entry.name.startsWith('.') || entry.name === '.tests')) {
          await visit(path);
        }
      } else if (entry.isFile() && /\.test\.(?:ts|mts)$/.test(entry.name)) {
        files.push(path);
      }
    }
  }
  for (const root of roots) await visit(root);
  return files.sort();
}

export async function runTests(files: readonly string[], options: readonly string[] = []): Promise<number> {
  if (!files.length) throw new Error('No TypeScript tests found.');
  const child = spawn(process.execPath, ['--test', ...options, ...files], { stdio: 'inherit' });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const roots = ['./', '../../articles/'].map(path => fileURLToPath(new URL(path, import.meta.url)));
  process.exitCode = await runTests(await discoverTests(roots), process.argv.slice(2));
}
