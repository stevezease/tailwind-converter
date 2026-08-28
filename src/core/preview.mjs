/**
 * Visual specimens for a comparison row.
 *
 * Reading "10px rounded to 8px" requires trusting the numbers; seeing two
 * corners side by side settles it in a glance. This decides *what kind* of
 * specimen a property deserves and hands back a plain style object — the
 * rendering lives in the UI, so this stays testable and framework-free.
 *
 * Returns null when a preview would not help, which is the common case: a
 * keyword, a value that cannot be drawn at this size, or two values that would
 * render identically.
 */

import { parseColor } from './color.mjs';

/** Properties whose effect is legible on a small filled rectangle. */
const BOX_PROPERTIES = [
    [/(^|-)radius$/, 'borderRadius'],
    [/(^|-)shadow$/, 'boxShadow'],
    [/^opacity$/, 'opacity'],
    // Thickness, not length: a 3px-long bar says nothing about a 3px border.
    [/^border(-(top|right|bottom|left|inline|block))?-width$/, 'borderWidth'],
    [/^outline-width$/, 'outlineWidth'],
];

/** Properties whose effect is legible on a short run of text. */
const TEXT_PROPERTIES = new Set([
    'font-size',
    'line-height',
    'letter-spacing',
    'word-spacing',
    'font-weight',
    'font-style',
    'font-family',
    'text-transform',
    'text-decoration-line',
    'text-decoration-style',
]);

/**
 * Properties that are a plain distance. Drawn as a bar of that length, which
 * compares two sizes far more directly than two numbers do.
 */
const LENGTH_PROPERTIES =
    /^(width|height|min-width|min-height|max-width|max-height|gap|row-gap|column-gap|flex-basis|top|right|bottom|left|inset(-.*)?|(padding|margin|scroll-padding|scroll-margin)(-.*)?|outline-offset|text-indent)$/;

/** A length we can draw, in px. Percentages and keywords cannot be drawn. */
function toPixels(value, remConversion) {
    const match = /^(-?\d*\.?\d+)(px|rem|em)$/.exec(String(value).trim());
    if (!match) return null;
    const number = parseFloat(match[1]);
    if (!Number.isFinite(number)) return null;
    if (match[2] === 'px') return number;
    return number * remConversion;
}

/** Bars beyond this are clipped; the number beside them carries the rest. */
export const MAX_BAR_PX = 120;

/**
 * Describe the specimen for one value.
 *
 * `kind` tells the UI which demo element to draw:
 *   'box'     a filled rectangle carrying the declaration
 *   'text'    a short run of text carrying the declaration
 *   'bar'     a rule whose length is the value
 */
export function previewFor(property, value, options = {}) {
    const remConversion = Number(options.remConversion) || 16;
    const prop = String(property);

    // Colours deliberately get no specimen. The value row already renders a
    // swatch beside each hex, so drawing a second, larger pair underneath said
    // the same thing twice.
    if (parseColor(value)?.coords) return null;

    for (const [pattern, cssProperty] of BOX_PROPERTIES) {
        if (pattern.test(prop)) {
            return { kind: 'box', style: { [cssProperty]: value } };
        }
    }

    if (TEXT_PROPERTIES.has(prop)) {
        // camelCase for React's style object.
        const cssProperty = prop.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return { kind: 'text', style: { [cssProperty]: value } };
    }

    if (LENGTH_PROPERTIES.test(prop)) {
        const pixels = toPixels(value, remConversion);
        if (pixels === null || pixels < 0) return null;
        return {
            kind: 'bar',
            pixels,
            clipped: pixels > MAX_BAR_PX,
            style: { width: `${Math.min(pixels, MAX_BAR_PX)}px` },
        };
    }

    return null;
}

/**
 * A specimen pair for a comparison row, or null when one would not earn its
 * space.
 *
 * Skipped when the two values would draw identically — a unit conversion like
 * `16px` to `1rem` is the same picture twice, and an arbitrary value is the
 * input unchanged.
 */
export function previewPairFor(row, options = {}) {
    if (!row.changed || row.equivalent) return null;

    const from = previewFor(row.property, row.from, options);
    const to = previewFor(row.property, row.to, options);
    if (!from || !to || from.kind !== to.kind) return null;

    // Bars of equal length say nothing.
    if (from.kind === 'bar' && from.pixels === to.pixels) return null;

    return { kind: from.kind, from, to };
}
