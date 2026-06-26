# Trovant Talent — Brand Package

Modern, product-first recruiting-tech identity. Sans-serif, emerald + teal,
clean white, soft rounded geometry. Deliberately distinct from any
maritime/serif/gold treatment.

## Contents

| Asset | Source (vector) | Raster |
| --- | --- | --- |
| Logo — mark only | `logo-mark.svg` | `png/logo-mark.png` |
| Logo — horizontal (light bg) | `logo-horizontal.svg` | `png/logo-horizontal.png` |
| Logo — horizontal (dark bg) | `logo-horizontal-dark.svg` | `png/logo-horizontal-dark.png` |
| LinkedIn banner (1584×396) | `linkedin-banner.svg` | `png/linkedin-banner.png` |
| Business card — front (1050×600) | `business-card-front.svg` | `png/business-card-front.png` |
| Business card — back (1050×600) | `business-card-back.svg` | `png/business-card-back.png` |
| Email signature | — | `email-signature.html` |
| Favicons / app icons | `favicons/` | `favicons/` |

Regenerate all PNGs after editing any SVG:

```bash
node brand/generate.mjs
```

## Brand tokens

**Color**

| Token | Hex | Use |
| --- | --- | --- |
| Emerald (primary) | `#0e9f6e` | CTAs, links, accents |
| Emerald gradient | `#10b981 → #0d9488` | Logo tile, banners |
| Emerald light | `#34d399` / `#a7f3d0` | Accent dot, on-dark text |
| Emerald wash | `#ecfdf5` | Pill / badge backgrounds |
| Ink | `#0b1220` | Headlines |
| Slate-700 / 500 / 400 | `#334155` / `#5b6b85` / `#94a3b8` | Body / muted / hint |
| Paper | `#ffffff` / `#f6f8fb` | Surfaces |
| Rule | `#e2e8f0` | Borders / dividers |

**Type**

- Display / headings: **Inter Tight** (700, tight tracking)
- Body / UI: **Inter** (400–600)
- No serif, no monospace.

## Logo usage

- Keep clear space around the mark equal to the height of the "T" stem.
- Use `logo-horizontal-dark.svg` on dark backgrounds; never place the
  light lockup on a busy or low-contrast photo.
- The mark is a rounded emerald tile with a white "T" and an accent dot —
  don't recolor, outline, or rotate it.

## Email signature

`email-signature.html` is a table-based block that pastes into Gmail,
Outlook, and Apple Mail. The logo loads from
`https://www.trovanttalent.com/icon-192.png`, so it renders without an
attachment **once the site is live**. Update the name, title, and contact
fields per person.

## Contact (current)

Fredrik Knutsen · Managing Director
+1 832-866-3421 · fredrik@trovanttalent.com · trovanttalent.com · Houston, Texas, USA
