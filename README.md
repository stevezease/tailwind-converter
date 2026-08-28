# CSS → Tailwind Converter

**[tailwind-converter.netlify.app](https://tailwind-converter.netlify.app/)**

Paste CSS, get the equivalent Tailwind classes.

The conversion map is **generated from the installed Tailwind release**, not
hand-maintained. Upgrading to a new Tailwind version is:

```sh
npm update tailwindcss
npm run build:map
npm test
```

## How it works

`scripts/build-map.mjs` loads Tailwind's own design system, enumerates every
utility it knows, compiles each one to CSS, and inverts the result into a
lookup table at `src/generated/tailwind-map.json`. Theme variables and `calc()`
are resolved, so `p-4` is indexed as `padding: 1rem` rather than
`padding: calc(var(--spacing) * 4)`.

Conversion then runs five stages, all in `src/core/`:

| Stage | Module | What it does |
| --- | --- | --- |
| Parse | `convert.mjs` | PostCSS; syntax errors are reported, not thrown |
| Variants | `convert.mjs` | `:hover` → `hover:`, `@media (min-width: 768px)` → `md:` |
| Expand | `shorthand.mjs` | `padding: 5px 10px` → `padding-block` / `padding-inline` |
| Match | `match.mjs` | Exact → unit-equivalent → spacing arithmetic → nearest colour |
| Emit | `match.mjs` | Anything left becomes an arbitrary value, which is exact |

Every result carries the tier it came from, so the UI can distinguish an exact
match from a rounded or approximated one. Nothing is silently changed.

### Design notes

- **`src/core/` is framework-agnostic.** No React, no Gatsby, no DOM. The UI
  only renders what `convertCss()` returns, so moving to another framework does
  not touch the converter.
- **One normalizer, both directions.** `normalize.mjs` runs over Tailwind's
  compiled output at build time and over the user's CSS at conversion time.
  That symmetry is what makes lookups work.
- **`scripts/design-system.mjs` is the only file that touches Tailwind
  internals.** `__unstable__loadDesignSystem` is the API Tailwind's own
  IntelliSense and Prettier plugin use, but the name warns it may change; the
  adapter keeps that a one-file fix.

## Tests

```sh
npm test
```

The main suite is a **round trip**: for every utility in the map, Tailwind
compiles it, the converter converts that CSS back, and the classes it produces
are recompiled and compared. Roughly 4,900 assertions, all generated from the
installed Tailwind release — so a version bump re-derives the entire suite, and
a release that changes a property family fails immediately rather than silently
converting to nothing.

`tests/convert.test.mjs` covers the other direction: shorthands, unit
spellings, selectors and at-rules that stylesheets contain but Tailwind never
emits.

## Development

```sh
npm install
npm run build:map   # writes src/generated/tailwind-map.json
npm run develop     # http://localhost:8000
npm run build
```

`build:map` runs automatically before `npm run build`. The generated map is
committed so the site builds without it, and a test asserts that regenerating
produces no diff.

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| Pixels per rem | 16 | Only affects px↔rem equivalence, never media queries, where rem is always 16px by spec |
| Colour tolerance | 0.05 | Max OKLab distance still treated as the same colour |
| Arbitrary values | on | Off restores the old strict behaviour, useful for auditing how close a stylesheet already is to the theme |
| Round to theme scale | off | On snaps near misses and reports the delta |
| Tailwind class order | on | Approximates the official Prettier plugin's ordering |
