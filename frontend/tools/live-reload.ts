import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { transformSync } from 'esbuild';

/** Entirely local: inject into HTTP responses, never into generated files. */
export class LiveReload {
  revision: string = randomUUID();
  private clients = new Set<ServerResponse>();
  private script = transformSync(readFileSync(new URL('./reload-client.ts', import.meta.url), 'utf8'), {
    loader: 'ts', target: 'es2022', minify: true,
  }).code;

  handle(pathname: string, request: IncomingMessage, response: ServerResponse): boolean {
    if (pathname === '/__sitegen/reload.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : this.script);
      return true;
    }
    if (pathname !== '/__sitegen/events') return false;
    response.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive',
    });
    if (request.method === 'HEAD') { response.end(); return true; }
    response.write(`data: ${this.revision}\n\n`);
    this.clients.add(response);
    response.on('close', () => this.clients.delete(response));
    return true;
  }

  inject(html: string, revision = this.revision): string {
    const script = `<script src="/__sitegen/reload.js" data-revision="${revision}"></script>`;
    return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, `${script}</body>`) : html + script;
  }

  publish(): void {
    this.revision = randomUUID();
    for (const client of this.clients) client.write(`data: ${this.revision}\n\n`);
  }

  close(): void {
    for (const client of this.clients) client.end();
    this.clients.clear();
  }
}
