import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LiveReload } from './live-reload.ts';

const types: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.vtt': 'text/vtt; charset=utf-8', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf',
};

/** Serve clean static routes, correct MIME types, and video byte ranges. */
export function createStaticServer(directory: string | (() => string), liveReload?: LiveReload) {
  return createServer(async (request, response) => {
    try {
      const root = resolve(typeof directory === 'function' ? directory() : directory);
      // Capture before asynchronous reads so a build during this request cannot
      // attach a new revision to stale HTML and cause the browser to miss a reload.
      const revision = liveReload?.revision;
      if (!['GET', 'HEAD'].includes(request.method ?? '')) {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
      }
      let pathname;
      try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); }
      catch { response.writeHead(400).end('Bad request'); return; }
      if (liveReload?.handle(pathname, request, response)) return;
      let file = resolve(root, '.' + pathname);
      if (!file.startsWith(root + sep) && file !== root || pathname.includes('\0')) {
        response.writeHead(403).end('Forbidden'); return;
      }
      if (pathname.split('/').some(part => part.startsWith('.'))) {
        response.writeHead(404).end('Not found'); return;
      }
      let info;
      try {
        info = await stat(file);
        if (info.isDirectory()) { file = resolve(file, 'index.html'); info = await stat(file); }
        const canonical = await realpath(file);
        if (!canonical.startsWith(await realpath(root) + sep)) {
          response.writeHead(403).end('Forbidden'); return;
        }
      } catch {
        const body = await readFile(resolve(root, '404.html')).catch(() => Buffer.from('Page not found'));
        response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(request.method === 'HEAD' ? undefined : liveReload ? liveReload.inject(body.toString(), revision) : body); return;
      }
      const headers: Record<string, string> = {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
      };
      if (liveReload && extname(file) === '.html') {
        const body = Buffer.from(liveReload.inject(await readFile(file, 'utf8'), revision));
        // Development HTML is transformed; serve its full representation even if
        // a Range was requested. Media range handling below remains unchanged.
        headers['Content-Length'] = String(body.length);
        delete headers['Accept-Ranges'];
        response.writeHead(200, headers);
        response.end(request.method === 'HEAD' ? undefined : body);
        return;
      }
      let start = 0, end = info.size - 1, status = 200;
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (!match || (!match[1] && !match[2])) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
        if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
        else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
        if (start > end || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
          response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return;
        }
        status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      }
      headers['Content-Length'] = String(Math.max(0, end - start + 1));
      response.writeHead(status, headers);
      if (request.method === 'HEAD' || info.size === 0) { response.end(); return; }
      const stream = createReadStream(file, { start, end });
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch (error) {
      console.error(error);
      if (!response.headersSent) response.writeHead(500);
      response.end('Preview server error');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const directory = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(root, 'build');
  const port = Number(process.env.PORT ?? 4173);
  createStaticServer(directory).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}`));
}
