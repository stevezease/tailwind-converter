/**
 * Color handling for the converter.
 *
 * Tailwind v4 rebuilt its palette in OKLCH and widened the gamut, so its
 * `red-500` is no longer the v1 hex `#ef4444` — same hue and lightness, more
 * chroma. Colors therefore can never be matched by string equality the way
 * lengths and keywords can; every color lookup is a perceptual nearest-match
 * with a reported distance, so the UI can distinguish "exactly your color"
 * from "close enough that you probably meant it".
 */

import { converter, parse, formatHex, differenceEuclidean } from 'culori';

const toOklch = converter('oklch');
const toRgb = converter('rgb');
const distanceInOklab = differenceEuclidean('oklab');

/** CSS-wide keywords that are colors but carry no coordinates. */
const KEYWORD_COLORS = new Set(['currentcolor', 'transparent', 'inherit', 'initial', 'unset', 'revert', 'revert-layer']);

/**
 * Parse any CSS color notation culori understands — hex, rgb()/rgba(),
 * hsl(), oklch(), oklab(), color(), and the named colors — into a normalized
 * record. Returns null for anything that is not a color, which is how callers
 * decide whether a declaration goes down the color path at all.
 */
export function parseColor(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text) return null;

    const lowered = text.toLowerCase();
    if (KEYWORD_COLORS.has(lowered)) {
        return { keyword: lowered, alpha: 1, coords: null };
    }

    let parsed;
    try {
        parsed = parse(text);
    } catch {
        return null;
    }
    if (!parsed) return null;

    const oklch = toOklch(parsed);
    if (!oklch || !Number.isFinite(oklch.l)) return null;

    return {
        keyword: null,
        alpha: parsed.alpha === undefined ? 1 : parsed.alpha,
        coords: { mode: 'oklch', l: oklch.l, c: oklch.c || 0, h: oklch.h || 0 },
    };
}

/** True when `value` is a color in any notation. Used to route declarations. */
export function isColor(value) {
    return parseColor(value) !== null;
}

/**
 * Canonical hex, used only for display. Out-of-sRGB colors are clipped, so
 * this is lossy for wide-gamut values and must never be used as a map key.
 */
export function toHex(value) {
    const parsed = typeof value === 'string' ? parse(value) : value;
    if (!parsed) return null;
    try {
        return formatHex(toRgb(parsed));
    } catch {
        return null;
    }
}

/**
 * Perceptual distance between two colors, ignoring alpha.
 *
 * Euclidean distance in OKLab, which is near enough to uniform that a single
 * scalar threshold behaves consistently across hues — the reason this is not
 * done in sRGB, where the same numeric distance means very different things
 * in blue versus green.
 */
export function colorDistance(a, b) {
    const left = a?.coords ? { mode: 'oklch', ...a.coords } : a;
    const right = b?.coords ? { mode: 'oklch', ...b.coords } : b;
    if (!left || !right) return Infinity;
    try {
        return distanceInOklab(left, right);
    } catch {
        return Infinity;
    }
}

/**
 * Palettes are re-scanned on every lookup and a stylesheet can hold hundreds
 * of colors, so parsed palette entries are memoized by their source string.
 */
const parseCache = new Map();

function parseColorCached(value) {
    if (parseCache.has(value)) return parseCache.get(value);
    const parsed = parseColor(value);
    parseCache.set(value, parsed);
    return parsed;
}

/**
 * Find the closest entry in a palette.
 *
 * `palette` is `{ name: cssColorString }` as emitted by the map generator.
 * Returns null when nothing falls inside `tolerance`, which is what triggers
 * the arbitrary-value fallback rather than a silently wrong color.
 *
 * A tolerance of 0.02 in OKLab is roughly "indistinguishable side by side";
 * 0.05 is "clearly the same intent". Above ~0.1 the match is a different color
 * and should not be offered.
 */
export function nearestPaletteColor(value, palette, tolerance = 0.05) {
    const target = parseColor(value);
    if (!target || !target.coords) return null;

    let best = null;
    let bestDistance = Infinity;

    for (const name in palette) {
        const parsed = parseColorCached(palette[name]);
        if (!parsed || !parsed.coords) continue;

        const distance = colorDistance(target, parsed);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = name;
        }
    }

    if (best === null || bestDistance > tolerance) return null;

    return {
        name: best,
        distance: bestDistance,
        exact: bestDistance < 1e-6,
        alpha: target.alpha,
    };
}

/**
 * Tailwind writes fractional alpha as a percentage modifier: `bg-red-500/50`.
 *
 * Only whole percentages are offered. An alpha of 0.503 would have to be
 * rounded to `/50`, and quietly changing the value is exactly what this
 * converter is built not to do — the caller falls back to an arbitrary value,
 * which reproduces the colour exactly. The epsilon absorbs float noise from
 * parsing `50%`, not genuine precision.
 */
export function alphaModifier(alpha) {
    if (alpha === undefined || alpha === null) return null;
    if (alpha >= 1) return null;
    const percent = alpha * 100;
    const rounded = Math.round(percent);
    if (Math.abs(percent - rounded) > 1e-6) return null;
    return String(rounded);
}
