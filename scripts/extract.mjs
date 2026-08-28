/**
 * Turning one utility's compiled CSS back into plain, resolved declarations.
 *
 * Shared by the map generator and the round-trip test suite: the test compiles
 * a utility with Tailwind, converts the result back to classes, recompiles
 * those, and compares the declarations both sides produce. Both directions
 * have to read Tailwind's output the same way, so that reading lives here.
 */

import postcss from 'postcss';
import { substituteVars, evaluateCalc, splitTopLevel } from '../src/core/css-value.mjs';
import { normalizeProperty, normalizeValue, stripNoOpLayers } from '../src/core/normalize.mjs';

/** A selector we can index: exactly one class, no pseudo, no combinator. */
const PLAIN_CLASS_SELECTOR = /^\.((?:[^\s,:>+~[\]()\\]|\\.)+)$/;

/** `.w-1\/2` -> `w-1/2` */
function unescapeClassName(selector) {
    return selector.replace(/\\(.)/g, '$1');
}

/* ------------------------------------------------------------------ *
 * Step 1 — collect `@property` initial values
 *
 * Tailwind composes box-shadow, filter, transform and friends out of `--tw-*`
 * slots that sit at a neutral initial value declared via `@property`. Those
 * initials are what let a composite utility be resolved down to the plain CSS
 * a hand-written stylesheet would contain.
 * ------------------------------------------------------------------ */
export function collectPropertyInitials(compiledSheets) {
    const initials = new Map();

    for (const css of compiledSheets) {
        if (!css || !css.includes('@property')) continue;
        let root;
        try {
            root = postcss.parse(css);
        } catch {
            continue;
        }
        root.walkAtRules('property', (atRule) => {
            const name = atRule.params.trim();
            if (initials.has(name)) return;

            // A registered property with no `initial-value` is
            // guaranteed-invalid at computed-value time, so `var()` falls
            // through to its declared fallback. Recording it as an empty
            // string instead would suppress that fallback — which is what
            // silently dropped `text-sm`, whose line-height reads
            // `var(--tw-leading, var(--text-sm--line-height))`.
            let initial;
            atRule.walkDecls('initial-value', (decl) => {
                initial = decl.value;
            });
            if (initial === undefined) return;
            initials.set(name, initial);
        });
    }

    return initials;
}

/* ------------------------------------------------------------------ *
 * Step 2 — turn one utility's compiled CSS into resolved declarations
 * ------------------------------------------------------------------ */
/**
 * Is this declaration a default Tailwind supplies rather than the point of the
 * utility?
 *
 * `border` compiles to `border-style: var(--tw-border-style); border-width: 1px`
 * — the style is a default that arrives via the `@property` initial value, and
 * a stylesheet writing `border-width: 1px` on its own still means `border`.
 * Likewise `text-sm` sets a `line-height` through
 * `var(--tw-leading, var(--text-sm--line-height))`, an override slot whose
 * fallback is the theme default.
 *
 * Both have the same shape: the whole value is one `var()` pointing at a
 * `--tw-*` slot the utility does not itself define. Declarations like that are
 * recorded as optional, so a rule that omits them still matches.
 */
function isImpliedDefault(rawValue, localVars) {
    const value = rawValue.trim();

    // The whole value must be a single var() reference. `mask-conic-0` sets
    // `mask-image: var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)`
    // — three slots, one of which the utility does define — and that is the
    // point of the utility, not a default it inherits.
    const match = /^var\(\s*(--[\w-]+)/.exec(value);
    if (!match || !match[1].startsWith('--tw-')) return false;
    if (splitTopLevel(value, ',').length > 1 && !value.endsWith(')')) return false;
    if (matchParen(value, 3) !== value.length - 1) return false;

    // A locally-defined variable anywhere in the value means the utility is
    // contributing something of its own.
    for (const name of localVars.keys()) {
        if (value.includes(name)) return false;
    }
    return !localVars.has(match[1]);
}

/** Index of the `)` closing the `(` at `openIndex`, or -1 if unbalanced. */
function matchParen(value, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < value.length; i++) {
        if (value[i] === '(') depth++;
        else if (value[i] === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

export function extractDeclarations(css, utility, designSystem, propertyInitials) {
    let root;
    try {
        root = postcss.parse(css);
    } catch {
        return null;
    }

    // Only the first top-level rule matters; the rest is @property boilerplate.
    const rule = root.nodes.find((node) => node.type === 'rule');
    if (!rule) return null;

    const match = PLAIN_CLASS_SELECTOR.exec(rule.selector.trim());
    if (!match || unescapeClassName(match[1]) !== utility) return null;

    const localVars = new Map();
    const visible = [];

    for (const node of rule.nodes || []) {
        if (node.type !== 'decl') continue;
        const property = normalizeProperty(node.prop);
        if (property.startsWith('--')) localVars.set(property, node.value);
        else visible.push({ property, value: node.value, raw: node.value });
    }

    if (visible.length === 0) return null;

    const resolve = (name) => {
        if (localVars.has(name)) return localVars.get(name);
        const themed = designSystem.resolveThemeValue(name);
        if (themed !== undefined) return themed;
        if (propertyInitials.has(name)) return propertyInitials.get(name);
        return undefined;
    };

    const declarations = [];
    for (const decl of visible) {
        let value = substituteVars(decl.value, resolve);
        value = evaluateCalc(value);
        value = normalizeValue(value);
        value = stripNoOpLayers(decl.property, value);

        // A value that still references a variable is not statically knowable
        // (it depends on cascade context), so it cannot be indexed.
        if (!value || value.includes('var(')) return null;

        declarations.push({
            property: decl.property,
            value,
            raw: decl.raw,
            implied: isImpliedDefault(decl.raw, localVars),
        });
    }

    return declarations;
}
