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

/** `text-decoration` is `<line> || <style> || <color> || <thickness>`. */
const DECORATION_LINES = new Set(['none', 'underline', 'overline', 'line-through', 'blink']);
const DECORATION_STYLES = new Set(['solid', 'double', 'dotted', 'dashed', 'wavy']);

/**
 * Keywords that modify the value beside them rather than being a value of
 * their own. `place-content: safe center` is one alignment, not two — so it
 * must not be split across the two axes.
 */
const POSITION_MODIFIERS = new Set(['safe', 'unsafe', 'first', 'last']);

/** `list-style: <type> || <position> || <image>` */
const LIST_STYLE_POSITIONS = new Set(['inside', 'outside']);

/** `flex-flow: <direction> || <wrap>` */
const FLEX_DIRECTIONS = new Set(['row', 'row-reverse', 'column', 'column-reverse']);
const FLEX_WRAPS = new Set(['nowrap', 'wrap', 'wrap-reverse']);

/** Values that mean "reset everything" and must not be split across longhands. */
const GLOBAL_KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

/**
 * The shortest spelling of a 1–4 value box shorthand.
 *
 * `padding: 1rem 1rem` is `padding: 1rem`, and only the short spelling reaches
 * `p-4` — the long one produced `px-4 py-4`, which is the same padding written
 * twice. Stylesheets that repeat a value are common enough (`margin: 0 auto 0
 * auto`, `padding: 8px 12px 8px 12px`) to be worth collapsing before the split.
 */
function collapseBoxValues(values) {
    let result = values;
    if (result.length === 4 && result[1] === result[3]) result = result.slice(0, 3);
    if (result.length === 3 && result[0] === result[2]) result = result.slice(0, 2);
    if (result.length === 2 && result[0] === result[1]) result = result.slice(0, 1);
    return result;
}

function expandBox(targets, rawValues) {
    const [whole, block, inline, top, right, bottom, left] = targets;
    const values = collapseBoxValues(rawValues);

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

    const values = collapseBoxValues(splitTopLevel(value, ' ').filter(Boolean));
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
 * `text-decoration: underline` — Tailwind's `underline` utility sets
 * `text-decoration-line`, so the shorthand has to be split or the most common
 * spelling of the most common decoration misses it entirely.
 */
function expandTextDecoration(value) {
    const values = splitTopLevel(value, ' ').filter(Boolean);
    if (values.length === 0 || values.length > 4) return null;

    const result = [];
    let sawLine = false;
    let sawStyle = false;
    let sawColor = false;
    let sawThickness = false;

    for (const token of values) {
        if (!sawLine && DECORATION_LINES.has(token)) {
            result.push(['text-decoration-line', token]);
            sawLine = true;
        } else if (!sawStyle && DECORATION_STYLES.has(token)) {
            result.push(['text-decoration-style', token]);
            sawStyle = true;
        } else if (!sawThickness && (token === 'auto' || token === 'from-font' || /^[\d.]+[a-z%]*$/.test(token))) {
            result.push(['text-decoration-thickness', token]);
            sawThickness = true;
        } else if (!sawColor && isColor(token)) {
            result.push(['text-decoration-color', token]);
            sawColor = true;
        } else {
            return null;
        }
    }

    return result.length ? result : null;
}

/**
 * `outline: 2px solid #a5b4fc` — the same `<width> || <style> || <color>`
 * shape as `border`, and just as common for focus rings, but it was never
 * expanded, so every focus ring in a stylesheet became one arbitrary property.
 */
function expandOutline(value) {
    const values = splitTopLevel(value, ' ').filter(Boolean);
    if (values.length === 0 || values.length > 3) return null;

    const result = [];
    let sawStyle = false;
    let sawWidth = false;
    let sawColor = false;

    for (const token of values) {
        if (!sawStyle && (BORDER_STYLE_KEYWORDS.has(token) || token === 'auto')) {
            result.push(['outline-style', token]);
            sawStyle = true;
        } else if (!sawWidth && (LENGTH_KEYWORDS.has(token) || /^[\d.]+[a-z%]*$/.test(token))) {
            result.push(['outline-width', token]);
            sawWidth = true;
        } else if (!sawColor && isColor(token)) {
            result.push(['outline-color', token]);
            sawColor = true;
        } else {
            return null;
        }
    }

    return result.length ? result : null;
}

/** `list-style: none` and `list-style: disc inside`. */
function expandListStyle(value) {
    const values = splitTopLevel(value, ' ').filter(Boolean);
    if (values.length === 0 || values.length > 2) return null;

    const result = [];
    let sawPosition = false;
    let sawType = false;

    for (const token of values) {
        if (!sawPosition && LIST_STYLE_POSITIONS.has(token)) {
            result.push(['list-style-position', token]);
            sawPosition = true;
        } else if (!sawType) {
            // Anything else in this shorthand is the marker type.
            result.push(['list-style-type', token]);
            sawType = true;
        } else {
            return null;
        }
    }

    return result.length ? result : null;
}

/** `flex-flow: row wrap`. */
function expandFlexFlow(value) {
    const values = splitTopLevel(value, ' ').filter(Boolean);
    if (values.length === 0 || values.length > 2) return null;

    const result = [];
    for (const token of values) {
        if (FLEX_DIRECTIONS.has(token)) result.push(['flex-direction', token]);
        else if (FLEX_WRAPS.has(token)) result.push(['flex-wrap', token]);
        else return null;
    }
    return result.length ? result : null;
}

/** `transition: <property> <duration> <timing-function> <delay>`, per layer. */
const TIMING_KEYWORDS = new Set(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end']);
const TIMING_FUNCTION = /^(cubic-bezier|steps|linear)\(/;
const TIME_VALUE = /^-?(?:\d+\.?\d*|\.\d+)m?s$/;

/**
 * `transition: color .15s ease-in-out, background-color .15s ease-in-out`.
 *
 * Transitions are everywhere in real stylesheets and every one of them landed
 * in a single `[transition:…]` arbitrary property — the longest, least
 * readable class the converter can emit, and one that hides a duration and an
 * easing that both have utilities of their own.
 *
 * Expansion is refused unless every layer agrees on duration, easing and
 * delay, because the longhands cannot say anything else: `transition: opacity
 * 150ms, transform 300ms` is two timings on one property list, and splitting
 * it would silently give both properties the same one.
 */
function expandTransition(value) {
    if (value === 'none') return [['transition-property', 'none']];

    const layers = splitTopLevel(value, ',')
        .map((layer) => layer.trim())
        .filter(Boolean);
    if (layers.length === 0) return null;

    const properties = [];
    let duration;
    let timing;
    let delay;
    let first = true;

    for (const layer of layers) {
        const tokens = splitTopLevel(layer, ' ').filter(Boolean);
        if (tokens.length === 0 || tokens.length > 4) return null;

        let property;
        const times = [];
        let easing;

        for (const token of tokens) {
            if (TIME_VALUE.test(token)) {
                if (times.length === 2) return null;
                times.push(token);
            } else if (!easing && (TIMING_KEYWORDS.has(token) || TIMING_FUNCTION.test(token))) {
                easing = token;
            } else if (!property && /^[a-z-]+$/.test(token)) {
                property = token;
            } else {
                return null;
            }
        }

        const layerDuration = times[0];
        const layerDelay = times[1];

        if (first) {
            duration = layerDuration;
            timing = easing;
            delay = layerDelay;
            first = false;
        } else if (layerDuration !== duration || easing !== timing || layerDelay !== delay) {
            return null;
        }

        properties.push(property ?? 'all');
    }

    const result = [['transition-property', properties.join(', ')]];
    if (duration) result.push(['transition-duration', duration]);
    if (timing) result.push(['transition-timing-function', timing]);
    if (delay) result.push(['transition-delay', delay]);
    return result;
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

    if (prop === 'text-decoration') {
        return expandTextDecoration(val) || identity;
    }

    if (prop === 'outline') {
        return expandOutline(val) || identity;
    }

    if (prop === 'list-style') {
        return expandListStyle(val) || identity;
    }

    if (prop === 'flex-flow') {
        return expandFlexFlow(val) || identity;
    }

    if (prop === 'transition') {
        return expandTransition(val) || identity;
    }

    // `background: gray` is a color, not a layer stack. The v1 converter
    // special-cased this and it is worth keeping.
    if (prop === 'background' && isColor(val)) {
        return [['background-color', val]];
    }

    return identity;
}

/**
 * Legacy spellings of a declaration Tailwind knows under another name.
 *
 * These are not shorthands: each rewrites one declaration into one other
 * declaration that means the same thing. Without them the modern property has
 * a utility and the spelling stylesheets actually use does not — `word-wrap:
 * break-word` is in every reset ever written and reached only
 * `[word-wrap:break-word]`.
 *
 * Each entry names the property it produces, so a rewrite can be skipped when
 * the rule already states that property itself. A rule that sets both
 * `column-count` and `column-width` means something the `columns` shorthand
 * cannot say from one of them alone, and rewriting either would have emitted
 * two utilities that fight over the same property.
 */
const ALIASES = {
    // A true alias: the two names are one property.
    'word-wrap': (value) => ['overflow-wrap', value],
    // Only this one value; `break-all` and `keep-all` are genuinely
    // word-break.
    'word-break': (value) => (value === 'break-word' ? ['overflow-wrap', 'break-word'] : null),
    // Longhands of `columns`, which is the property Tailwind's `columns-*`
    // utilities set.
    'column-count': (value) => (/^\d+$/.test(value) ? ['columns', value] : null),
    'column-width': (value) => (value === 'auto' ? null : ['columns', value]),
    // CSS defines the `page-break-*` properties as aliases of `break-*`, and
    // print stylesheets are full of them.
    'page-break-before': (value) => breakAlias('break-before', value),
    'page-break-after': (value) => breakAlias('break-after', value),
    'page-break-inside': (value) => breakAlias('break-inside', value),
};

/** `always` is the one value whose name changed; the rest carry over. */
const BREAK_VALUES = new Set(['auto', 'avoid', 'left', 'right', 'page', 'recto', 'verso']);

function breakAlias(property, value) {
    if (value === 'always') return [property, 'page'];
    return BREAK_VALUES.has(value) ? [property, value] : null;
}

function aliasCandidate(property, value) {
    const rewrite = ALIASES[property];
    return rewrite ? rewrite(value) : null;
}

/**
 * Pairs of longhands that are one shorthand when they agree, innermost first.
 *
 * Stylesheets write the sides out — Bootstrap's `.navbar-brand` sets
 * `padding-top` and `padding-bottom` to the same value — and expansion alone
 * cannot help, because there was no shorthand to expand. The result was
 * `pt-1.25 pb-1.25` where `py-1.25` says it once. Running the table in order
 * folds four sides into two axes and then into one property.
 */
const MERGES = [
    [['padding-top', 'padding-bottom'], 'padding-block'],
    [['padding-left', 'padding-right'], 'padding-inline'],
    [['padding-block', 'padding-inline'], 'padding'],
    [['margin-top', 'margin-bottom'], 'margin-block'],
    [['margin-left', 'margin-right'], 'margin-inline'],
    [['margin-block', 'margin-inline'], 'margin'],
    [['top', 'bottom'], 'inset-block'],
    [['left', 'right'], 'inset-inline'],
    [['inset-block', 'inset-inline'], 'inset'],
    [['border-top-width', 'border-bottom-width'], 'border-block-width'],
    [['border-left-width', 'border-right-width'], 'border-inline-width'],
    [['border-block-width', 'border-inline-width'], 'border-width'],
    [['border-top-color', 'border-bottom-color'], 'border-block-color'],
    [['border-left-color', 'border-right-color'], 'border-inline-color'],
    [['border-block-color', 'border-inline-color'], 'border-color'],
    [['border-top-style', 'border-bottom-style'], 'border-block-style'],
    [['border-left-style', 'border-right-style'], 'border-inline-style'],
    [['border-block-style', 'border-inline-style'], 'border-style'],
    [['scroll-margin-top', 'scroll-margin-bottom'], 'scroll-margin-block'],
    [['scroll-margin-left', 'scroll-margin-right'], 'scroll-margin-inline'],
    [['scroll-padding-top', 'scroll-padding-bottom'], 'scroll-padding-block'],
    [['scroll-padding-left', 'scroll-padding-right'], 'scroll-padding-inline'],
    [['overflow-x', 'overflow-y'], 'overflow'],
    [['overscroll-behavior-x', 'overscroll-behavior-y'], 'overscroll-behavior'],
    [['row-gap', 'column-gap'], 'gap'],
];

/**
 * Fold longhands that agree back into the property that covers both.
 *
 * Only exact agreement merges — same value, same `!important` — so nothing is
 * rewritten that the cascade could tell apart, and a rule that sets one side
 * differently keeps both sides.
 */
export function mergeLonghands(declarations) {
    let result = declarations;

    for (const [[first, second], target] of MERGES) {
        const firstIndex = result.findIndex((entry) => entry.property === first);
        if (firstIndex === -1) continue;
        const secondIndex = result.findIndex((entry) => entry.property === second);
        if (secondIndex === -1) continue;

        const a = result[firstIndex];
        const b = result[secondIndex];
        if (a.value !== b.value || a.important !== b.important) continue;

        // A property stated twice is a cascade this cannot see through.
        if (result.filter((entry) => entry.property === first || entry.property === second).length !== 2) continue;

        const merged = { ...a, property: target };
        result = result.filter((entry, index) => index !== firstIndex && index !== secondIndex);
        result.splice(Math.min(firstIndex, secondIndex), 0, merged);
    }

    return result;
}

/** Expand a whole rule's declarations, preserving order. */
export function expandDeclarations(declarations) {
    const stated = new Map();
    for (const { property, value } of declarations) {
        const prop = normalizeProperty(property);
        if (!stated.has(prop)) stated.set(prop, normalizeValue(value));
    }

    /* Which rewrites are safe. An alias is only applied when everything in the
       rule that could produce its target property agrees on the value: a rule
       setting `column-count: 3` *and* `column-width: 16rem` says something
       `columns` cannot say from either one alone, and rewriting both emitted
       two utilities fighting over one property. Where they do agree, the
       legacy spelling is the same declaration written twice — the usual
       `overflow-wrap` / `word-wrap` / `word-break` trio — and only one
       utility should come out. */
    const valuesByTarget = new Map();
    for (const { property, value } of declarations) {
        const candidate = aliasCandidate(normalizeProperty(property), normalizeValue(value));
        if (!candidate) continue;
        if (!valuesByTarget.has(candidate[0])) valuesByTarget.set(candidate[0], new Set());
        valuesByTarget.get(candidate[0]).add(candidate[1]);
    }

    const emitted = new Set();
    const expanded = [];

    for (const { property, value, raw, important } of declarations) {
        const prop = normalizeProperty(property);
        const val = normalizeValue(value);
        const candidate = aliasCandidate(prop, val);

        let source = [property, value];
        if (candidate) {
            const [target, targetValue] = candidate;
            const agreed =
                valuesByTarget.get(target).size === 1 && (!stated.has(target) || stated.get(target) === targetValue);

            if (agreed) {
                if (emitted.has(target)) continue;
                emitted.add(target);
                source = candidate;
            }
        } else if (ALIASES[prop] === undefined && valuesByTarget.has(prop)) {
            // The modern spelling of a property some alias also produces. It
            // wins, and the aliases that agreed with it were dropped above.
            emitted.add(prop);
        }

        const pairs = expandDeclaration(source[0], source[1]);

        // A value that came through whole keeps the author's capitalisation.
        // A shorthand that was split has been rewritten by the time it gets
        // here, and there is nothing to carry it on.
        const untouched = pairs.length === 1 && pairs[0][1] === normalizeValue(source[1]);

        for (const [expandedProperty, expandedValue] of pairs) {
            expanded.push({
                property: expandedProperty,
                value: expandedValue,
                raw: untouched && raw !== undefined ? raw : expandedValue,
                important: Boolean(important),
            });
        }
    }

    return mergeLonghands(expanded);
}
