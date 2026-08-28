/**
 * Turn a match into a side-by-side comparison the UI can render.
 *
 * Where the converter approximates — a rounded length, a nearest palette
 * colour — a class name alone does not tell you what changed. This pairs the
 * declarations you wrote against the ones the chosen utility actually emits,
 * so the difference is inspectable rather than implied.
 *
 * Framework-agnostic: returns data, renders nothing.
 */

import { QUALITY } from './match.mjs';
import { parseColor, toHex, colorDistance } from './color.mjs';
import { normalizeProperty, normalizeValue } from './normalize.mjs';
import { formatNumber } from './css-value.mjs';

/**
 * How far apart two colours have to be before the difference matters.
 * Thresholds are OKLab distances, chosen so the wording matches what a person
 * sees when the two swatches sit next to each other.
 */
const COLOR_BANDS = [
    [0.005, 'indistinguishable'],
    [0.02, 'visually near-identical'],
    [0.05, 'clearly the same intent'],
    [Infinity, 'noticeably different'],
];

function colorBand(distance) {
    for (const [limit, label] of COLOR_BANDS) {
        if (distance < limit) return label;
    }
    return 'noticeably different';
}

/** A value is shown as a swatch when it is a colour with real coordinates. */
function swatchFor(value) {
    const parsed = parseColor(value);
    if (!parsed || !parsed.coords) return null;
    return { css: value, hex: toHex(value) };
}

const LENGTH = /^(-?[\d.]+)(px|rem|em|%)$/;

/**
 * Express the gap between two lengths in a way that is easy to judge:
 * both in px, plus the relative error.
 */
function lengthDelta(from, to, remConversion) {
    const a = LENGTH.exec(from);
    const b = LENGTH.exec(to);
    if (!a || !b) return null;

    const toPx = (number, unit) => {
        const value = parseFloat(number);
        if (unit === 'px') return value;
        if (unit === 'rem' || unit === 'em') return value * remConversion;
        return null;
    };

    const fromPx = toPx(a[1], a[2]);
    const toPxValue = toPx(b[1], b[2]);
    if (fromPx === null || toPxValue === null) return null;
    if (fromPx === toPxValue) return { fromPx, toPx: toPxValue, error: 0, identical: true };

    return {
        fromPx,
        toPx: toPxValue,
        error: fromPx === 0 ? null : Math.abs(toPxValue - fromPx) / Math.abs(fromPx),
        identical: false,
    };
}

/**
 * Where a spacing value came from.
 *
 * Every size in Tailwind's spacing scale is a multiple of one variable, so
 * `p-8` is not an arbitrary token to memorise — it is eight steps of
 * `--spacing`. Saying so is the single most useful thing to tell someone
 * arriving from CSS.
 *
 * Only claimed for utilities that really are on the spacing scale: `text-sm`
 * is also a clean multiple of 0.25rem, and calling it "3.5 spacing steps"
 * would be false.
 */
function spacingDerivation(match, map, remConversion) {
    if (!map?.spacing || !map.spacingBase) return null;

    const utility = String(match.utility).replace(/!$/, '').replace(/^-/, '');
    const dash = utility.lastIndexOf('-');
    if (dash <= 0) return null;

    const prefix = utility.slice(0, dash);
    const step = utility.slice(dash + 1);
    if (!map.spacing[prefix] || !/^\d+(\.\d+)?$/.test(step)) return null;

    const base = parseFloat(map.spacingBase);
    if (!Number.isFinite(base)) return null;

    const rem = parseFloat(step) * base;
    const pixels = rem * remConversion;

    // Spelled all the way out to pixels on purpose. The number in `gap-3` is a
    // count of 0.25rem steps, not a rem value — reading it as rem is the
    // single easiest mistake to make coming from CSS, and stopping at
    // "3 × 0.25rem" leaves the reader to close that gap themselves.
    return {
        text: `${step} × ${map.spacingBase} = ${formatNumber(rem)}rem = ${formatNumber(pixels)}px`,
        hint: `The number counts ${map.spacingBase} steps, not rem — so ${step} × ${formatNumber(base * remConversion)}px.`,
    };
}

/**
 * Pixel equivalents for the rem lengths in a media query, as a separate note.
 *
 * Kept out of the query text itself: interpolating them would produce
 * `(width >= 48rem (768px))`, which is no longer the CSS the prefix compiles
 * to. Breakpoints are always resolved at 16px per rem, since media queries use
 * the initial root font size regardless of the document's.
 */
function pixelNote(params) {
    const lengths = [...params.matchAll(/([\d.]+)rem/g)].map((match) => {
        const pixels = parseFloat(match[1]) * 16;
        return Number.isFinite(pixels) ? `${match[0]} = ${formatNumber(pixels)}px` : null;
    });
    return lengths.filter(Boolean).join(', ') || null;
}

/**
 * What a variant prefix compiles to.
 *
 * Shown as the CSS it produces rather than prose. The audience already reads
 * CSS — `@media (width >= 48rem)` teaches `md:` faster than a sentence would,
 * and it comes from the generated map, so it stays correct across releases
 * instead of being a hand-written glossary.
 */
function variantExplanations(variantNames, map) {
    if (!map?.variants || !variantNames?.length) return [];

    return variantNames
        .map((name) => {
            const variant = map.variants.find((candidate) => candidate.name === name);
            if (!variant) return null;

            const wrappers = variant.atRules.map(([at, params]) => `@${at} ${params}`);
            const selector = variant.selector ? `&${variant.selector}` : '';

            let css;
            if (wrappers.length && selector) css = `${wrappers.join(' ')} { ${selector} }`;
            else if (wrappers.length) css = wrappers.join(' ');
            else css = selector;

            const note = variant.atRules.map(([, params]) => pixelNote(params)).filter(Boolean).join(', ');

            return { name, prefix: `${name}:`, css, note: note || null };
        })
        .filter(Boolean);
}

/**
 * Build the comparison.
 *
 * `sourceDeclarations` is the expanded declaration list the match was made
 * from; `match.sources` indexes into it.
 */
export function explainMatch(match, sourceDeclarations, options = {}) {
    // `options` carries the conversion settings plus, optionally, the map and
    // the rule's variant names — both needed to explain rather than merely
    // compare.
    const settings = options;
    const remConversion = Number(settings.remConversion) || 16;

    const source = new Map();
    for (const index of match.sources || []) {
        const declaration = sourceDeclarations[index];
        if (declaration) source.set(normalizeProperty(declaration.property), normalizeValue(declaration.value));
    }

    const emitted = new Map();
    for (const [property, value] of match.emits || []) {
        emitted.set(normalizeProperty(property), normalizeValue(value));
    }

    const rows = [];
    const seen = new Set();

    for (const [property, from] of source) {
        seen.add(property);
        const to = emitted.get(property);

        if (to === undefined) {
            // The utility does not restate this property; it is carried as-is.
            rows.push({ property, from, to: from, changed: false, kind: 'same' });
            continue;
        }

        const fromSwatch = swatchFor(from);
        const toSwatch = swatchFor(to);

        if (fromSwatch && toSwatch) {
            const distance = colorDistance(parseColor(from), parseColor(to));
            rows.push({
                property,
                from,
                to,
                changed: distance > 1e-6,
                kind: 'color',
                fromSwatch,
                toSwatch,
                distance,
                band: colorBand(distance),
            });
            continue;
        }

        const delta = lengthDelta(from, to, remConversion);
        rows.push({
            property,
            from,
            to,
            changed: from !== to,
            kind: delta ? 'length' : 'value',
            delta,
            // Same measurement written differently, e.g. 16px and 1rem.
            equivalent: Boolean(delta && delta.identical),
        });
    }

    // Declarations the utility adds that the source never had — `text-sm`
    // brings a line-height with it, which is worth knowing before you use it.
    const added = [];
    for (const [property, value] of emitted) {
        if (!seen.has(property)) added.push({ property, value });
    }

    const headline = headlineFor(match, rows, remConversion);

    return {
        utility: match.utility,
        className: match.className ?? match.utility,
        quality: match.quality,
        rows,
        added,
        headline,

        /* Present only when the translation is not a verbatim restatement.
           The UI puts this at the top of the card: if a value was altered at
           all, that is the first thing the reader needs, before any
           explanation of what the class does. */
        approximation: match.quality === QUALITY.EXACT ? null : { headline, quality: match.quality },

        derivation: spacingDerivation(match, options.map, remConversion),
        variants: variantExplanations(options.variants, options.map),
        distance: match.distance,
    };
}

function headlineFor(match, rows, remConversion) {
    switch (match.quality) {
        case QUALITY.EXACT:
            return 'This class emits exactly the declaration you wrote.';

        case QUALITY.CONVERTED: {
            const row = rows.find((candidate) => candidate.equivalent) || rows.find((candidate) => candidate.changed);
            if (row && row.delta) {
                return `Same measurement, written differently — ${row.from} is ${row.to} at ${remConversion}px per rem.`;
            }
            return 'Same value, written differently.';
        }

        case QUALITY.ROUNDED: {
            const row = rows.find((candidate) => candidate.changed && candidate.delta);
            if (row && row.delta && row.delta.error !== null) {
                const direction = row.delta.toPx > row.delta.fromPx ? 'larger' : 'smaller';
                // Both sides in px: comparing "7px" against "0.375rem" makes
                // the reader do the conversion the sentence is explaining.
                const percent = formatNumber(Math.round(row.delta.error * 1000) / 10);
                return `Snapped to the nearest theme value: ${formatNumber(row.delta.fromPx)}px became ${formatNumber(row.delta.toPx)}px — ${percent}% ${direction}.`;
            }
            return 'Snapped to the nearest theme value.';
        }

        case QUALITY.NEAREST_COLOR: {
            const row = rows.find((candidate) => candidate.kind === 'color');
            const band = row ? row.band : colorBand(match.distance ?? 0);
            return `Closest colour in the theme palette — ${band}.`;
        }

        case QUALITY.ARBITRARY:
            return 'No theme value matches, so this is an arbitrary value. Exact, but off the scale.';

        default:
            return '';
    }
}
