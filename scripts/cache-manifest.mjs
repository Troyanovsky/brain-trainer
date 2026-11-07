import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const assets = (await readdir('dist/assets')).map((file) => `/assets/${file}`);
const html = await readFile('dist/index.html', 'utf8');
const version = createHash('sha256').update(html).digest('hex').slice(0, 12);
const template = await readFile('public/sw.js', 'utf8');
await writeFile(
  'dist/sw.js',
  template
    .replace('__VERSION__', version)
    .replace(
      '/*__ASSETS__*/ []',
      JSON.stringify(['/', '/index.html', '/favicon.svg', '/manifest.webmanifest', ...assets]),
    ),
);
