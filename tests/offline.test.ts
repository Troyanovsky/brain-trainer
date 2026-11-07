// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';
import { expect, it } from 'vitest';
it('builds a valid service worker that installs the complete local shell', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'brain-garden-sw-'));
  try {
    mkdirSync(join(directory, 'dist/assets'), { recursive: true });
    mkdirSync(join(directory, 'public'));
    writeFileSync(join(directory, 'dist/index.html'), '<html>local shell</html>');
    writeFileSync(join(directory, 'dist/assets/app-123.js'), 'console.log("local")');
    writeFileSync(join(directory, 'public/sw.js'), readFileSync('public/sw.js'));
    const build = spawnSync(process.execPath, [resolve('scripts/cache-manifest.mjs')], {
      cwd: directory,
    });
    expect(build.status, build.stderr.toString()).toBe(0);
    const script = new Script(readFileSync(join(directory, 'dist/sw.js'), 'utf8'));
    const events: Record<string, (event: unknown) => void> = {};
    let cached: string[] = [];
    script.runInNewContext({
      self: {
        addEventListener: (name: string, callback: (event: unknown) => void) => {
          events[name] = callback;
        },
        skipWaiting: () => Promise.resolve(),
      },
      caches: {
        open: async () => ({
          addAll: async (urls: string[]) => {
            cached = urls;
          },
        }),
      },
    });
    let done: Promise<unknown> = Promise.resolve();
    events.install({
      waitUntil: (promise: Promise<unknown>) => {
        done = promise;
      },
    });
    await done;
    expect([...cached]).toEqual([
      '/',
      '/index.html',
      '/favicon.svg',
      '/manifest.webmanifest',
      '/assets/app-123.js',
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
