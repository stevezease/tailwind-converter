/**
 * Top-level conversion: a CSS string in, Tailwind classes out.
 *
 * Framework-agnostic on purpose — no React, no Gatsby, no DOM. The UI layer
 * only renders what this returns, so moving the app to another framework does
 * not touch the converter.
 */

import postcss from 'postcss';
import { createMatcher, DEFAULT_SETTINGS, QUALITY } from './match.mjs';
import { expandDeclarations } from './shorthand.mjs';
import { normalizeProperty, normalizeValue, hasImportant } from './normalize.mjs';
import { formatNumber } from './css-value.mjs';

export { QUALITY, DEFAULT_SETTINGS };

/**
 * Canonicalize a media query so a user's `(min-width: 768px)` matches
 * Tailwind's `(width >= 48rem)`.
 *
 * Lengths are converted at 16px per rem regardless of the user's rem setting:
 * inside a media query, `rem` always refers to the initial root font size, not
 * the document's.
 */
const MEDIA_ROOT_FONT_SIZE = 16;

export function normalizeAtRuleParams(name, params) {
    let text = String(params).trim().toLowerCase().replace(/\s+/g, ' ');
    if (name !== 'media') return text;

    text = text
        .replace(/\(\s*min-(width|height)\s*:\s*([^)]+)\)/g, (_, axis, value) => `(${axis} >= ${value.trim()})`)
        .replace(/\(\s*max-(width|height)\s*:\s*([^)]+)\)/g, (_, axis, value) => `(${axis} <= ${value.trim()})`);

    text = text.replace(/([\d.]+)px\b/g, (match, number) => {
        const rem = parseFloat(number) / MEDIA_ROOT_FONT_SIZE;
        return Number.isFinite(rem) ? `${formatNumber(rem)}rem` : match;
    });

    return text.replace(/\s*([<>]=?)\s*/g, ' $1 ').replace(/\s+/g, ' ').trim();
}

function buildVariantIndex(map) {
    const bySelector = [];
    const byAtRule = new Map();

    for (const variant of map.variants) {
        if (variant.selector) {
            bySelector.push(variant);
        } else if (variant.atRules.length === 1) {
            const [name, params] = variant.atRules[0];
            const key = `${name} ${normalizeAtRuleParams(name, params)}`;
            if (!byAtRule.has(key)) byAtRule.set(key, variant);
        }
    }

    // Longest first so `:focus-visible` is peeled before `:focus`.
    bySelector.sort((a, b) => b.selector.length - a.selector.length);
    return { bySelector, byAtRule };
}

/**
 * Peel known variant selectors off the end of a selector.
 *
 * `.card:hover::before` yields variants `['before', 'hover']` and a base of
 * `.card`. The v1 converter detected `:hover` and then discarded it.
 */
function splitSelector(selector, variantIndex) {
    let remaining = selector.trim();
    const variants = [];
    const injected = [];

    let peeling = true;
    while (peeling && remaining) {
        peeling = false;
        for (const variant of variantIndex.bySelector) {
            if (remaining.length > variant.selector.length && remaining.endsWith(variant.selector)) {
                remaining = remaining.slice(0, -variant.selector.length).trim();
                variants.unshift(variant.name);
                for (const inject of variant.injects) injected.push(inject);
                peeling = true;
                break;
            }
        }
    }

    return { baseSelector: remaining, variants, injected };
}

/**
 * What a selector asks for that utility classes cannot express.
 *
 * Utilities go on one element. A selector that also describes *which* element —
 * an ancestor, a sibling, an attribute, a `:not()` — carries a condition that
 * survives nowhere in the class list. The converter used to emit the classes
 * anyway with nothing said, so `.menu .item { color: red }` came back as
 * `text-red-500`: correct-looking, and wrong the moment you put it on `.item`.
 *
 * These are reported rather than fixed. Tailwind can express some of them
 * (`group-*`, `peer-*`, arbitrary variants), but which one is right depends on
 * markup the converter cannot see.
 */
function splitOnCombinators(selector) {
    const parts = [];
    let depth = 0;
    let current = '';

    for (let i = 0; i < selector.length; i++) {
        const char = selector[i];
        if (char === '[' || char === '(') depth++;
        else if (char === ']' || char === ')') depth--;

        if (depth === 0 && (char === '>' || char === '+' || char === '~' || /\s/.test(char))) {
            if (current.trim()) parts.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
}

/** Conditions inside one compound selector, e.g. `[data-open]` or `:not(.x)`. */
function conditionsIn(compound) {
    const found = [];
    let depth = 0;
    let current = '';

    const flush = () => {
        if (current && (current[0] === '[' || current[0] === ':')) found.push(current);
        current = '';
    };

    for (let i = 0; i < compound.length; i++) {
        const char = compound[i];
        if (depth === 0 && (char === '[' || char === ':') && current) flush();
        if (char === '[' || char === '(') depth++;
        else if (char === ']' || char === ')') depth--;
        current += char;
    }
    flush();
    return found;
}

export function analyzeSelector(baseSelector) {
    const warnings = [];
    const selector = baseSelector.trim();
    if (!selector) return warnings;

    const parts = splitOnCombinators(selector);
    if (parts.length > 1) {
        warnings.push(
            `These classes go on \`${parts[parts.length - 1]}\`. The rest of \`${selector}\` describes where that element sits, which utility classes cannot express — look at \`group-*\` or \`peer-*\` for that.`
        );
    }

    const conditions = conditionsIn(parts[parts.length - 1] ?? selector);
    if (conditions.length > 0) {
        warnings.push(
            `\`${conditions.join('')}\` decides *when* the rule applies and has no variant here, so these classes will apply unconditionally.`
        );
    }

    return warnings;
}

/**
 * Declarations a variant contributes on its own — `::before` implies
 * `content` — are consumed rather than reported as unconverted.
 */
/** Values that add nothing over what the variant already supplies. */
const EMPTY_CONTENT = new Set(['""', "''", 'none', '']);

function dropInjectedDeclarations(declarations, injected) {
    if (injected.length === 0) return declarations;

    const remaining = [];
    const pending = injected.map(([property]) => normalizeProperty(property));

    for (const declaration of declarations) {
        const position = pending.indexOf(declaration.property);

        // Only drop it when the stylesheet is restating the variant's own
        // default. `::after { content: "" }` is redundant with `after:`, but
        // `content: "→"` is the point of the rule and has its own utility —
        // swallowing it lost the value silently.
        if (position !== -1 && EMPTY_CONTENT.has(declaration.value)) {
            pending.splice(position, 1);
            continue;
        }
        remaining.push(declaration);
    }
    return remaining;
}

function collectAtRuleVariants(ancestors, variantIndex) {
    const variants = [];
    const unmatched = [];

    for (const { name, params } of ancestors) {
        const key = `${name} ${normalizeAtRuleParams(name, params)}`;
        const variant = variantIndex.byAtRule.get(key);
        if (variant) variants.push(variant.name);
        else unmatched.push(`@${name} ${params}`.trim());
    }

    return { variants, unmatched };
}

/**
 * Reorder matches into Tailwind's canonical class order — the same grouping
 * the official Prettier plugin produces — instead of the order the properties
 * happened to appear in the source.
 *
 * Ranking is by property, since that is what a match is derived from.
 * Properties the map has no rank for sort last, keeping their relative order.
 */
function sortByTailwindOrder(matches, declarations, map) {
    const order = map.propertyOrder || {};

    const rankOf = (match) => {
        let best = Infinity;
        for (const index of match.sources) {
            const property = declarations[index]?.property;
            const rank = order[property];
            if (rank !== undefined && rank < best) best = rank;
        }
        return best;
    };

    matches
        .map((match, index) => ({ match, index, rank: rankOf(match) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .forEach((entry, position) => {
            matches[position] = entry.match;
        });
}

/**
 * Matcher and variant-index cache.
 *
 * Building these means walking every group in the map and keying each of its
 * declarations — with ~1,800 groups that is ~96% of the cost of a conversion,
 * and `convertCss` is called on every keystroke in the editor and once per
 * utility in the round-trip suite. Reusing them makes matching around 50x
 * faster and changes nothing about the result, since both are pure functions
 * of the map and the settings.
 *
 * Keyed weakly by map so a discarded map is collectable, then by the settings
 * that actually affect the indexes.
 */
const indexCache = new WeakMap();

function indexesFor(map, settings) {
    let bySettings = indexCache.get(map);
    if (!bySettings) {
        bySettings = new Map();
        indexCache.set(map, bySettings);
    }

    const key = JSON.stringify(settings);
    let entry = bySettings.get(key);
    if (!entry) {
        entry = { matcher: createMatcher(map, settings), variantIndex: buildVariantIndex(map) };
        bySettings.set(key, entry);
    }
    return entry;
}

/**
 * Convert a CSS string.
 *
 * Returns one entry per rule, in source order. Parse errors are returned
 * rather than thrown, so a half-typed stylesheet still converts the rules that
 * are valid.
 */
export function convertCss(css, map, userSettings = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...userSettings };
    const { matcher, variantIndex } = indexesFor(map, settings);

    let root;
    try {
        root = postcss.parse(css);
    } catch (error) {
        return {
            rules: [],
            error: {
                message: error.reason || error.message,
                line: error.line,
                column: error.column,
            },
        };
    }

    const rules = [];

    root.walkRules((rule) => {
        // Rules inside @keyframes are frame selectors (`from`, `50%`), not
        // element selectors, and have no utility equivalent.
        const ancestors = [];
        for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
            if (parent.type !== 'atrule') continue;
            if (/^(-\w+-)?keyframes$/.test(parent.name)) return;
            ancestors.unshift({ name: parent.name.toLowerCase(), params: parent.params });
        }

        const declarations = [];
        for (const node of rule.nodes || []) {
            if (node.type !== 'decl') continue;
            declarations.push({
                property: normalizeProperty(node.prop),
                value: normalizeValue(node.value),
                important: node.important || hasImportant(node.value),
            });
        }
        if (declarations.length === 0) return;

        const atRuleResult = collectAtRuleVariants(ancestors, variantIndex);

        // A selector list (`.a, .b`) shares one set of declarations, so it
        // converts once and applies to each selector.
        const selectors = rule.selectors && rule.selectors.length ? rule.selectors : [rule.selector];
        const split = splitSelector(selectors[0], variantIndex);

        const expanded = expandDeclarations(dropInjectedDeclarations(declarations, split.injected));
        const { matches, unconverted } = matcher.match(expanded);

        if (settings.sortClasses !== false) sortByTailwindOrder(matches, expanded, map);

        const prefix = [...atRuleResult.variants, ...split.variants].map((name) => `${name}:`).join('');
        const classes = matches.map((item) => `${prefix}${item.utility}`);

        rules.push({
            selector: rule.selector,
            selectors,
            baseSelector: split.baseSelector,
            variants: [...atRuleResult.variants, ...split.variants],
            unsupportedAtRules: atRuleResult.unmatched,
            selectorWarnings: analyzeSelector(split.baseSelector),
            classes,
            classNames: classes.join(' '),
            matches: matches.map((item, index) => ({ ...item, className: classes[index] })),
            // The post-shorthand-expansion declarations each match was made
            // from. `match.sources` indexes into this, which is what
            // explainMatch() needs to diff source against emitted output.
            // Exposed rather than pre-explained so conversion stays cheap; the
            // UI explains only what the reader actually hovers.
            declarations: expanded,
            unconverted,
        });
    });

    return { rules, error: null };
}
