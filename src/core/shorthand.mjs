/**
 * Shorthand expansion.
 *
 * The v1 converter gave up on every shorthand — `padding: 5px 10px` landed in
 * the "Unable to Convert" box, and the expansion code sat commented out in
 * `wip.js`. This finishes it.
 *
 * The expansion targets are chosen to match how Tailwind v4 actually models
 * these properties: a two-value box shorthand becomes the *logical* pair
 * (`padding-block` / `padding-inline`), because that is what `py-*` and `px-*`
 * compile to. Expanding to four physical longhands instead would produce four
 * classes where two are correct.
 */

import { splitTopLevel } from './css-value.mjs';
import { normalizeProperty, normalizeValue } from './normalize.mjs';
import { isColor } from './color.mjs';

/** Properties whose 1–4 values follow the box pattern. */
const BOX_SHORTHANDS = {
    'padding': ['padding', 'padding-block', 'padding-inline', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
    'margin': ['margin', 'margin-block', 'margin-inline', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
    'inset': ['inset', 'inset-block', 'inset-inline', 'top', 'right', 'bottom', 'left'],
    'border-width': ['border-width', 'border-block-width', 'border-inline-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
    'border-color': ['border-color', 'border-block-color', 'border-inline-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
    'border-style': ['border-style', 'border-block-style', 'border-inline-style', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
    'scroll-padding': ['scroll-padding', 'scroll-padding-block', 'scroll-padding-inline', 'scroll-padding-top', 'scroll-padding-right', 'scroll-padding-bottom', 'scroll-padding-left'],
    'scroll-margin': ['scroll-margin', 'scroll-margin-block', 'scroll-margin-inline', 'scroll-margin-top', 'scroll-margin-right', 'scroll-margin-bottom', 'scroll-margin-left'],
};

/** Properties whose two values are an x/y pair. */
const AXIS_SHORTHANDS = {
    'gap': ['row-gap', 'column-gap'],
    'overflow': ['overflow-y', 'overflow-x'],
    'overscroll-behavior': ['overscroll-behavior-y', 'overscroll-behavior-x'],
    'place-items': ['align-items', 'justify-items'],
    'place-content': ['align-content', 'justify-content'],
    'place-self': ['align-self', 'justify-self'],
};

/** The four corners of `border-radius`, in CSS order. */
const RADIUS_CORNERS = [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
];

const BORDER_STYLE_KEYWORDS = new Set([
    'none', 'hidden', 'dotted', 'dashed', 'solid', 'double',
    'groove', 'ridge', 'inset', 'outset',
]);

const LENGTH_KEYWORDS = new Set(['thin', 'medium', 'thick']);

/**
 * Keywords that modify the value beside them rather than being a value of
 * their own. `place-content: safe center` is one alignment, not two — so it
 * must not be split across the two axes.
 */
const POSITION_MODIFIERS = new Set(['safe', 'unsafe', 'first', 'last']);

/** Values that mean "reset everything" and must not be split across longhands. */
const GLOBAL_KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

function expandBox(targets, values) {
    const [whole, block, inline, top, right, bottom, left] = targets;

    switch (values.length) {
        case 1:
            // Already the canonical single-property form; leave it alone so it
            // matches `p-4` directly rather than becoming four declarations.
            return [[whole, values[0]]];
        case 2:
            return [[block, values[0]], [inline, values[1]]];
        case 3:
            return [[top, values[0]], [inline, values[1]], [bottom, values[2]]];
        case 4:
            return [[top, values[0]], [right, values[1]], [bottom, values[2]], [left, values[3]]];
        default:
            return null;
    }
}

function expandRadius(value) {
    // The elliptical form (`10px / 20px`) has no Tailwind equivalent; leave it
    // whole so it falls through to an arbitrary value.
    if (value.includes('/')) return null;

    const values = splitTopLevel(value, ' ').filter(Boolean);
    if (values.length === 1) return [['border-radius', values[0]]];
    if (values.length === 2) {
        return [
            [RADIUS_CORNERS[0], values[0]], [RADIUS_CORNERS[2], values[0]],
            [RADIUS_CORNERS[1], values[1]], [RADIUS_CORNERS[3], values[1]],
        ];
    }
    if (values.length === 3) {
        return [
            [RADIUS_CORNERS[0], values[0]],
            [RADIUS_CORNERS[1], values[1]], [RADIUS_CORNERS[3], values[1]],
            [RADIUS_CORNERS[2], values[2]],
        ];
    }
    if (values.length === 4) return RADIUS_CORNERS.map((corner, index) => [corner, values[index]]);
    return null;
}

/**
 * `border: 1px solid red` — classify each token by what it can be. Order is
 * not fixed in CSS, so tokens are identified by shape rather than position.
 */
function expandBorder(property, value) {
    const values = splitTopLevel(value, ' ').filter(Boolean);
    if (values.length === 0 || values.length > 3) return null;

    const suffix = property === 'border' ? '' : property.slice('border'.length);
    const result = [];
    let sawStyle = false;
    let sawWidth = false;
    let sawColor = false;

    for (const token of values) {
        if (!sawStyle && BORDER_STYLE_KEYWORDS.has(token)) {
            result.push([`border${suffix}-style`, token]);
            sawStyle = true;
        } else if (!sawWidth && (LENGTH_KEYWORDS.has(token) || /^[\d.]+[a-z%]*$/.test(token))) {
            result.push([`border${suffix}-width`, token]);
            sawWidth = true;
        } else if (!sawColor && isColor(token)) {
            result.push([`border${suffix}-color`, token]);
            sawColor = true;
        } else {
            return null;
        }
    }

    return result.length ? result : null;
}

/**
 * Expand one declaration into the longhands the matcher can look up.
 *
 * Returns an array of `[property, value]` pairs — always at least the input
 * itself, so callers can treat this as a total function.
 */
export function expandDeclaration(property, value) {
    const prop = normalizeProperty(property);
    const val = normalizeValue(value);
    const identity = [[prop, val]];

    if (!val || GLOBAL_KEYWORDS.has(val)) return identity;
    // A var() reference cannot be split without knowing its value.
    if (val.includes('var(')) return identity;

    if (BOX_SHORTHANDS[prop]) {
        const values = splitTopLevel(val, ' ').filter(Boolean);
        return expandBox(BOX_SHORTHANDS[prop], values) || identity;
    }

    if (prop === 'border-radius') {
        return expandRadius(val) || identity;
    }

    if (AXIS_SHORTHANDS[prop]) {
        const values = splitTopLevel(val, ' ').filter(Boolean);
        if (values.length === 2 && !values.some((token) => POSITION_MODIFIERS.has(token))) {
            const [first, second] = AXIS_SHORTHANDS[prop];
            return [[first, values[0]], [second, values[1]]];
        }
        return identity;
    }

    if (prop === 'border' || /^border-(top|right|bottom|left|block|inline)$/.test(prop)) {
        return expandBorder(prop, val) || identity;
    }

    // `background: gray` is a color, not a layer stack. The v1 converter
    // special-cased this and it is worth keeping.
    if (prop === 'background' && isColor(val)) {
        return [['background-color', val]];
    }

    return identity;
}

/** Expand a whole rule's declarations, preserving order. */
export function expandDeclarations(declarations) {
    const expanded = [];
    for (const { property, value, important } of declarations) {
        for (const [prop, val] of expandDeclaration(property, value)) {
            expanded.push({ property: prop, value: val, important: Boolean(important) });
        }
    }
    return expanded;
}
