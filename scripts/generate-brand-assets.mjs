// Rasterizes the brand SVGs in /public into the PNG variants browsers and
// social platforms need (favicons, app/avatar icons, OG/LinkedIn preview).
// Run after editing any source SVG:  node scripts/generate-brand-assets.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (p) => resolve(root, 'public', p);

function render(svgPath, outPath, width) {
  const svg = readFileSync(svgPath, 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
    .render()
    .asPng();
  writeFileSync(outPath, png);
  console.log(`  ${outPath.replace(root + '/', '')}  (${width}px)`);
}

console.log('Generating brand assets…');
// App / avatar icon (navy background) — used for PWA, apple-touch, LinkedIn avatar.
render(pub('icon.svg'), pub('icon-512.png'), 512);
render(pub('icon.svg'), pub('icon-192.png'), 192);
render(pub('icon.svg'), pub('apple-touch-icon.png'), 180);
// Favicon raster fallback for legacy contexts.
render(pub('favicon.svg'), pub('favicon-32.png'), 32);
// Social / Open Graph preview (1200×630).
render(pub('og-image.svg'), pub('og-image.png'), 1200);
console.log('Done.');
