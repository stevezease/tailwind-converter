/**
 * Canonical text form for CSS declarations.
 *
 * This module is the reason the lookup works at all. The generator runs it
 * over Tailwind's compiled output; the converter runs it over the user's CSS.
 * Anything that should be considered "the same declaration" has to collapse to
 * the same string here — `0`, `0px` and `0rem` are one value; `1.0REM` and
 * `1rem` are one value.
 *
 * Deliberately NOT handled here: px-to-rem conversion. That depends on a user
 * setting and is lossy, so it belongs in the matcher, which can try the
 * original value first and a converted one second.
 */

import { splitTopLevel, formatNumber } from './css-value.mjs';

/** Length units where a zero magnitude means the same thing as a bare `0`. */
const ZERO_EQUIVALENT_UNITS = new Set(['px', 'rem', 'em', 'ex', 'ch', 'vw', 'vh', 'vmin', 'vmax', 'cm', 'mm', 'in', 'pt', 'pc', 'q', '%']);

const NUMBER_TOKEN = /(^|[\s,(/])([+-]?(?:\d+\.?\d*|\.\d+))([a-z%]*)/gi;

/** Lowercase everything outside quoted strings; CSS keywords are case-insensitive. */
function lowercaseOutsideQuotes(value) {
    let result = '';
    let quote = null;
    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (quote) {
            result += char;
            if (char === quote && value[i - 1] !== '\\') quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            result += char;
            continue;
        }
        result += char.toLowerCase();
    }
    return result;
}

/**
 * Canonicalize numbers: `.5` becomes `0.5`, `1.0` becomes `1`, `+2` becomes
 * `2`, and any zero with a length unit becomes a bare `0`.
 */
function normalizeNumbers(value) {
    return value.replace(NUMBER_TOKEN, (match, lead, number, unit) => {
        const parsed = parseFloat(number);
        if (!Number.isFinite(parsed)) return match;
        const lowerUnit = unit.toLowerCase();
        if (parsed === 0 && (lowerUnit === '' || ZERO_EQUIVALENT_UNITS.has(lowerUnit))) {
            return `${lead}0`;
        }
        return `${lead}${formatNumber(parsed)}${lowerUnit}`;
    });
}

/** Property names are case-insensitive, except custom properties. */
export function normalizeProperty(property) {
    const trimmed = String(property).trim();
    return trimmed.startsWith('--') ? trimmed : trimmed.toLowerCase();
}

/**
 * Canonical form of a declaration value.
 *
 * Collapses whitespace (including around commas and inside functions),
 * lowercases keywords, normalizes number formatting, and strips the `!important`
 * flag — which is a cascade concern, not part of the value's identity.
 */
export function normalizeValue(value) {
    if (value === undefined || value === null) return '';
    let text = String(value).trim().replace(/;+$/, '').trim();
    if (!text) return '';

    text = text.replace(/\s*!\s*important\s*$/i, '');
    text = lowercaseOutsideQuotes(text);

    // Whitespace: collapse runs, then tighten around structural punctuation.
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\s*,\s*/g, ', ');
    text = text.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

    text = normalizeNumbers(text);

    return text.trim();
}

/** True when the declaration carried `!important`. */
export function hasImportant(value) {
    return /!\s*important\s*;?\s*$/i.test(String(value));
}

/** Properties that take the `<offsets> <blur>? <spread>? <color>?` shadow syntax. */
const SHADOW_PROPERTY = /(^|-)shadow$/;

const LENGTH_TOKEN_ONLY = /^-?(?:\d+\.?\d*|\.\d+)([a-z%]*)$/i;

/**
 * Canonicalize the length list in a shadow.
 *
 * CSS lets blur and spread be omitted, so `0 1px 2px rgb(0 0 0 / 0.05)` and
 * `0 1px 2px 0 rgb(0 0 0 / 0.05)` are the same shadow — but only the second
 * spelling is what Tailwind emits, so a stylesheet using the shorter form
 * missed `shadow-xs` entirely and fell through to an arbitrary value.
 *
 * Padding both sides to four lengths makes the two spellings agree. Colour
 * functions survive because the split respects parentheses.
 */
export function canonicalizeShadow(value) {
    if (value === 'none' || !value) return value;

    return splitTopLevel(value, ',')
        .map((layer) => {
            const tokens = splitTopLevel(layer, ' ').filter(Boolean);
            if (tokens.length === 0) return layer;

            const inset = [];
            const lengths = [];
            const rest = [];

            for (const token of tokens) {
                if (token === 'inset' && lengths.length === 0) inset.push(token);
                else if (rest.length === 0 && LENGTH_TOKEN_ONLY.test(token)) lengths.push(token);
                else rest.push(token);
            }

            // Fewer than two lengths is not a shadow we understand; leave it be.
            if (lengths.length < 2 || lengths.length > 4) return layer;
            while (lengths.length < 4) lengths.push('0');

            return [...inset, ...lengths, ...rest].join(' ');
        })
        .join(', ');
}

/**
 * The key both sides of the map agree on. Everything that indexes or looks up
 * a declaration goes through this function and no other.
 */
export function declarationKey(property, value) {
    const prop = normalizeProperty(property);
    let normalized = normalizeValue(value);
    if (SHADOW_PROPERTY.test(prop)) normalized = canonicalizeShadow(normalized);
    return `${prop}:${normalized}`;
}

/**
 * Tailwind builds several properties by composing `--tw-*` slots, most of
 * which sit at a neutral initial value. Once those are substituted in, the
 * result is padded with no-op layers that no hand-written stylesheet would
 * ever contain, so they are stripped before indexing.
 *
 * `box-shadow: 0 0 #0000, 0 0 #0000, 0 2px 4px red` is just `0 2px 4px red`.
 */
const NO_OP_LAYER = /^0\s+0\s+#0000$/;

export function stripNoOpLayers(property, value) {
    if (!value.includes('#0000')) return value;
    if (!/shadow/.test(property)) return value;

    const layers = splitTopLevel(value, ',').filter((layer) => !NO_OP_LAYER.test(layer.trim()));
    if (layers.length === 0) return 'none';
    return layers.join(', ');
}
