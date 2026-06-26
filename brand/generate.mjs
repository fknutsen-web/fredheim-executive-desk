// Rasterizes the brand SVGs in /brand into ready-to-use PNGs and copies the
// favicon set from /public. Run after editing any SVG:
//   node brand/generate.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const b = (p) => resolve(here, p);
const pub = (p) => resolve(root, 'public', p);

function render(svgPath, outPath, width) {
  const svg = readFileSync(svgPath, 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  writeFileSync(outPath, png);
  console.log(`  ${outPath.replace(root + '/', '')}  (${width}px wide)`);
}

console.log('Generating Trovant Talent brand assets…');
render(b('logo-horizontal.svg'),      b('png/logo-horizontal.png'),       1120);
render(b('logo-horizontal-dark.svg'), b('png/logo-horizontal-dark.png'),  1120);
render(b('logo-mark.svg'),            b('png/logo-mark.png'),              512);
render(b('linkedin-logo.svg'),        b('png/linkedin-logo.png'),          800);
render(b('linkedin-banner.svg'),      b('png/linkedin-banner.png'),        1584);
render(b('business-card-front.svg'),  b('png/business-card-front.png'),    1050);
render(b('business-card-back.svg'),   b('png/business-card-back.png'),     1050);

// Favicons — the production set lives in /public; mirror it here for handoff.
mkdirSync(b('favicons'), { recursive: true });
for (const f of ['favicon.svg','favicon-32.png','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png']) {
  copyFileSync(pub(f), b(`favicons/${f}`));
  console.log(`  brand/favicons/${f}`);
}
console.log('Done.');
