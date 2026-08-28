#!/usr/bin/env node
/**
 * Generate the CSS-to-Tailwind lookup map from the installed Tailwind release.
 *
 * This replaces the old `src/scripts/scraper.js`, which drove a browser
 * against the v1 documentation site and produced a 1,529-line map that could
 * never be refreshed. Everything here is derived from the package on disk, so
 * upgrading the converter is `npm update tailwindcss && npm run build:map`.
 *
 * Output: src/generated/tailwind-map.json
 */

import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { loadDesignSystem, tailwindVersion } from './design-system.mjs';
import { collectPropertyInitials, extractDeclarations } from './extract.mjs';
import { substituteVars, evaluateCalc } from '../src/core/css-value.mjs';
import { normalizeProperty, normalizeValue, declarationKey } from '../src/core/normalize.mjs';

const OUTPUT_PATH = path.resolve('src/generated/tailwind-map.json');

/**
 * Upper bound on the serialized size of one indexed declaration set.
 *
 * Tailwind's mask utilities compile to stacks of a dozen composed
 * `linear-gradient()` layers — around 6,200 of them, which is 88% of the map's
 * bytes. No hand-written stylesheet contains those declarations verbatim, so
 * indexing them costs a lot and can never pay off. Anything above this bound
 * is treated as a generated composite and left to the arbitrary-value
 * fallback, which still converts it correctly.
 *
 * The bound is deliberately above the largest hand-writable utility
 * (`sr-only`, ~190 bytes) and is applied to the declaration payload alone.
 * The build reports how many were excluded, and a test asserts the utilities
 * people actually write survive the bound — so a future release adding a
 * larger one fails rather than being quietly dropped.
 */
const MAX_INDEXED_DECLARATION_BYTES = 200;

/* ------------------------------------------------------------------ *
 * Step 3 — variant table
 *
 * Derived the same way as the utility map: compile a known-simple utility
 * behind each variant and read back the selector and at-rule wrapper Tailwind
 * produced. Nothing about `:hover`, breakpoints or `::before` is hand-written
 * here, so a Tailwind release that adds or renames variants is picked up by
 * regenerating.
 * ------------------------------------------------------------------ */

/** The utility used as a probe. Its own output is subtracted from the result. */
const PROBE_UTILITY = 'flex';
const PROBE_DECLARATION = { property: 'display', value: 'flex' };

function escapeClassName(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}

/**
 * Collect the selector suffix, at-rule wrapper and declarations a probe
 * compiled to, regardless of how the release nests them.
 *
 * Tailwind changed this shape mid-4.x. Up to 4.2 a variant compiled to nested
 * CSS:
 *
 *     .hover\:flex { &:hover { @media (hover: hover) { display: flex } } }
 *
 * From 4.3 it is flattened:
 *
 *     @media (hover: hover) { .hover\:flex:hover { display: flex } }
 *
 * Walking the tree and accumulating whatever is found handles both, and any
 * further rearrangement that keeps the same pieces.
 */
function walkVariantShape(node, probeClass, found) {
    for (const child of node.nodes || []) {
        if (child.type === 'atrule') {
            if (child.name.toLowerCase() === 'property') continue;
            found.atRules.push([child.name.toLowerCase(), child.params.trim()]);
            walkVariantShape(child, probeClass, found);
        } else if (child.type === 'rule') {
            let selector = child.selector.trim();
            if (selector.includes(probeClass)) selector = selector.split(probeClass).join('');
            // Nested rules address the parent with `&`.
            found.selector += selector.replace(/&/g, '').trim();
            found.matchedProbe = found.matchedProbe || child.selector.includes(probeClass);
            walkVariantShape(child, probeClass, found);
        } else if (child.type === 'decl') {
            found.declarations.push(child);
        }
    }
}

function extractVariants(designSystem, propertyInitials) {
    const variants = [];
    let rejected = 0;

    for (const entry of designSystem.getVariants()) {
        const name = entry.name;
        // Parameterized variants (`data-*`, `supports-*`, `nth-*`, ...) cannot
        // be probed without a value; they compile to null and drop out here.
        const candidate = `${name}:${PROBE_UTILITY}`;
        const css = designSystem.candidatesToCss([candidate])[0];
        if (!css) continue;

        let root;
        try {
            root = postcss.parse(css);
        } catch {
            rejected++;
            continue;
        }

        const probeClass = `.${escapeClassName(candidate)}`;
        const found = { atRules: [], selector: '', declarations: [], matchedProbe: false };
        walkVariantShape(root, probeClass, found);

        // A variant that contributes neither a selector nor an at-rule carries
        // no information. That is not a variant we can skip quietly — it means
        // the output shape changed and this extractor no longer understands
        // it, which is exactly how a Tailwind upgrade could silently stop
        // emitting `hover:` and `md:`.
        if (!found.matchedProbe || (!found.selector && found.atRules.length === 0)) {
            rejected++;
            continue;
        }

        const resolve = (variableName) => {
            const themed = designSystem.resolveThemeValue(variableName);
            if (themed !== undefined) return themed;
            if (propertyInitials.has(variableName)) return propertyInitials.get(variableName);
            return undefined;
        };

        // Some variants inject their own declarations — `before` adds
        // `content: var(--tw-content)`. Recording them lets the matcher treat
        // that declaration as consumed rather than unconverted.
        const injects = [];
        for (const child of found.declarations) {
            const property = normalizeProperty(child.prop);
            if (property.startsWith('--')) continue;
            const value = normalizeValue(evaluateCalc(substituteVars(child.value, resolve)));
            if (property === PROBE_DECLARATION.property && value === PROBE_DECLARATION.value) continue;
            injects.push([property, value]);
        }

        variants.push({ name, atRules: found.atRules, selector: found.selector, injects });
    }

    // Sanity floor. Every 4.x release has had dozens of static variants, so a
    // near-empty table means the probe or the output shape changed rather than
    // that Tailwind removed them.
    if (variants.length < 20) {
        throw new Error(
            `Only ${variants.length} variants could be extracted (${rejected} rejected). ` +
                `Tailwind's compiled variant shape has probably changed — see walkVariantShape().`
        );
    }

    // Longest first so `focus-visible` is peeled before `focus`.
    variants.sort((a, b) => b.selector.length - a.selector.length || a.name.localeCompare(b.name));
    return variants;
}

/* ------------------------------------------------------------------ *
 * Step 4 — arbitrary-value prefixes
 *
 * When no theme value matches, the converter emits an arbitrary value. The
 * arbitrary *property* form `[width:13px]` always works, but `w-[13px]` is
 * what a person would write. This derives the prefix for each property by
 * majority vote over the utilities already indexed, then verifies each guess
 * by compiling it — so a wrong guess is dropped rather than shipped.
 * ------------------------------------------------------------------ */

/** Probes covering the value types utilities accept. */
const ARBITRARY_SENTINELS = ['10px', '10%', 'red', '1.5'];

/**
 * A value Tailwind cannot type.
 *
 * Several properties share one prefix — `font-family`, `font-weight` and
 * `font-stretch` all answer to `font-` — and Tailwind picks between them by
 * looking at the value. A `var()` tells it nothing, so it falls back to one
 * fixed property per prefix: `font-[var(--x)]` is a *font-weight*, which made
 * `font-family: var(--bs-btn-font-family)` come back as a class that sets the
 * wrong property entirely.
 *
 * Compiling this probe records which property each prefix falls back to, so
 * the converter can tell when the prefixed form would be read as something
 * else and reach for `[font-family:var(--x)]` instead.
 */
const UNTYPED_SENTINEL = 'var(--tw-probe)';

function deriveArbitraryPrefixes(designSystem, declarations, groups, propertyInitials) {
    const votes = new Map(); // property -> Map(prefix -> count)

    const vote = (property, utility) => {
        const dash = utility.lastIndexOf('-');
        if (dash <= 0) return;
        const prefix = utility.slice(0, dash);
        if (!votes.has(property)) votes.set(property, new Map());
        const counts = votes.get(property);
        counts.set(prefix, (counts.get(prefix) || 0) + 1);
    };

    for (const key in declarations) {
        vote(key.slice(0, key.indexOf(':')), declarations[key]);
    }
    // Group members vote too, so properties that only ever appear alongside
    // another one — `font-size`, which `text-sm` always pairs with a
    // `line-height` — still get a prefix. Verification rejects bad guesses.
    for (const group of groups) {
        for (const [property] of group.declarations) vote(property, group.utility);
    }

    const prefixes = Object.create(null);

    for (const [property, counts] of votes) {
        const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);

        let best = null;

        for (let rank = 0; rank < ranked.length; rank++) {
            const prefix = ranked[rank][0];

            // Fewest companion declarations wins: for an arbitrary value of a
            // single property we want the utility that sets only that property,
            // so `width` resolves to `w-[10px]` rather than `size-[10px]`,
            // which would also set the height.
            let width = Infinity;
            for (const sentinel of ARBITRARY_SENTINELS) {
                const candidate = `${prefix}-[${sentinel}]`;
                const css = designSystem.candidatesToCss([candidate])[0];
                if (!css) continue;
                const resolved = extractDeclarations(css, candidate, designSystem, propertyInitials);
                if (!resolved) continue;
                // The target property must be the one carrying the probe
                // value, not merely present — `border-[10px]` also emits
                // `border-style`.
                const expected = normalizeValue(sentinel);
                if (resolved.some((decl) => decl.property === property && decl.value === expected)) {
                    width = Math.min(width, resolved.length);
                }
            }

            if (width === Infinity) continue;
            if (!best || width < best.width || (width === best.width && rank < best.rank)) {
                best = { prefix, width, rank };
            }
            if (width === 1) break;
        }

        if (best) prefixes[property] = best.prefix;
    }

    /* Which properties keep their prefix when the value cannot be typed.
       Read straight from the compiled CSS rather than through
       extractDeclarations, which rejects anything still holding a `var()` —
       which is the whole point of the probe. */
    const untypedSafe = [];
    for (const property in prefixes) {
        const candidate = `${prefixes[property]}-[${UNTYPED_SENTINEL}]`;
        const css = designSystem.candidatesToCss([candidate])[0];
        if (!css) continue;

        let emitted;
        try {
            emitted = postcss.parse(css);
        } catch {
            continue;
        }

        let carriesProbe = false;
        emitted.walkDecls((decl) => {
            const name = normalizeProperty(decl.prop);
            if (name.startsWith('--')) return;
            if (name === property && decl.value.includes(UNTYPED_SENTINEL)) carriesProbe = true;
        });

        if (carriesProbe) untypedSafe.push(property);
    }
    untypedSafe.sort();

    return { prefixes, untypedSafe };
}

/* ------------------------------------------------------------------ *
 * Step 5 — collision resolution
 *
 * Several utilities can compile to the same declaration: v4 keeps `flex-grow`
 * as an alias of `grow`, for example. Prefer the shorter name, then sort
 * lexicographically so regeneration is deterministic.
 * ------------------------------------------------------------------ */
function preferred(a, b) {
    if (a === undefined) return b;
    if (a.length !== b.length) return a.length < b.length ? a : b;
    return a < b ? a : b;
}

async function main() {
    const started = Date.now();
    const designSystem = await loadDesignSystem();

    const utilities = designSystem
        .getClassList()
        .map((entry) => entry[0])
        // Negative utilities re-encode a value the positive one already covers;
        // the matcher derives them arithmetically instead.
        .filter((name) => !name.startsWith('-'));

    const compiled = designSystem.candidatesToCss(utilities);
    const propertyInitials = collectPropertyInitials(compiled);

    const declarations = Object.create(null); // "prop:value" -> utility
    const groups = [];                        // multi-declaration utilities
    const palette = Object.create(null);      // "red-500" -> "oklch(...)"
    const colorUtilities = Object.create(null); // "color" -> "text"
    const spacingByPrefix = new Map();        // "px" -> Set(properties)

    const indexedUtilities = new Set();

    /* Property -> utilities that set it, split by whether the utility is
       *about* that property. `sr-only` sets padding, margin, width and a
       border-width, and sorts near the front of Tailwind's order; ranking
       those properties by it put `p-4` ahead of `flex`. A composite utility
       only speaks for a property no dedicated utility covers. */
    const propertyUtilities = new Map(); // property -> Set(utility)
    const compositeUtilities = new Map();

    const noteProperty = (property, utility, dedicated) => {
        const table = dedicated ? propertyUtilities : compositeUtilities;
        if (!table.has(property)) table.set(property, new Set());
        table.get(property).add(utility);
    };

    let indexed = 0;
    let skipped = 0;
    let oversized = 0;

    for (let i = 0; i < utilities.length; i++) {
        const utility = utilities[i];
        const css = compiled[i];
        if (!css) {
            skipped++;
            continue;
        }

        const resolved = extractDeclarations(css, utility, designSystem, propertyInitials);
        if (!resolved) {
            skipped++;
            continue;
        }

        /* --- colors: recorded as a palette plus a property->prefix table,
               never as thousands of exact-match keys. Tailwind's OKLCH palette
               cannot be string-matched against a stylesheet's hex values, so
               indexing every color utility would bloat the map with entries
               that can never be hit. --- */
        const colorVar = resolved.length === 1 && /^var\(--color-([a-z0-9-]+)\)$/i.exec(resolved[0].raw.trim());
        if (colorVar) {
            const colorName = colorVar[1];
            const property = resolved[0].property;
            const suffix = `-${colorName}`;
            if (utility.endsWith(suffix)) {
                const prefix = utility.slice(0, -suffix.length);
                if (prefix) {
                    palette[colorName] = resolved[0].value;
                    colorUtilities[property] = preferred(colorUtilities[property], prefix);
                    indexedUtilities.add(utility);
                    noteProperty(property, utility);
                    continue;
                }
            }
        }

        /* --- spacing: v4's scale is `--spacing` multiplied by any number, so
               `p-13` is valid even though it is absent from getClassList().
               Recording the multiplier shape lets the matcher do arithmetic
               instead of a bounded table lookup. --- */
        const multiplierMatch = /^(\d+(?:\.\d+)?)$/.exec(utility.split('-').pop() ?? '');
        if (multiplierMatch) {
            const step = multiplierMatch[1];
            const usesSpacing = resolved.every((decl) =>
                new RegExp(`^calc\\(var\\(--spacing\\)\\s*\\*\\s*${step}\\)$`).test(decl.raw.trim())
            );
            if (usesSpacing) {
                const prefix = utility.slice(0, -(step.length + 1));
                if (prefix) {
                    const properties = resolved.map((decl) => decl.property).join(',');
                    if (!spacingByPrefix.has(prefix)) spacingByPrefix.set(prefix, properties);
                }
            }
        }

        const required = resolved.filter((decl) => !decl.implied);
        const optional = resolved.filter((decl) => decl.implied);

        // Nothing to match on — every declaration is a default.
        if (required.length === 0) {
            skipped++;
            continue;
        }

        if (required.length === 1 && optional.length === 0) {
            const key = declarationKey(required[0].property, required[0].value);
            declarations[key] = preferred(declarations[key], utility);
        } else {
            const entry = { utility, declarations: required.map((decl) => [decl.property, decl.value]) };
            if (optional.length) entry.optional = optional.map((decl) => [decl.property, decl.value]);

            // Measure the declarations only. Including the utility name would
            // make indexability depend on how long the name happens to be, and
            // the bound is calibrated against declaration payloads.
            const payload = JSON.stringify([entry.declarations, entry.optional ?? []]).length;
            if (payload > MAX_INDEXED_DECLARATION_BYTES) {
                oversized++;
                continue;
            }
            groups.push(entry);
        }
        indexedUtilities.add(utility);
        // Only the declarations the utility is *about*. A utility that merely
        // implies a property — every `transition-*` carries a default duration
        // — must not lend it that utility's rank, or `duration-*` sorts ahead
        // of the `transition-*` class it belongs to.
        for (const decl of required) noteProperty(decl.property, utility, required.length === 1);
        indexed++;
    }

    // Largest groups first: matching `text-sm` (font-size + line-height) must
    // be attempted before any single-declaration fallback claims the font-size.
    groups.sort((a, b) => b.declarations.length - a.declarations.length || a.utility.localeCompare(b.utility));

    /* Canonical ordering. `getClassOrder` is Tailwind's own sort — the one the
       Prettier plugin uses — but it ranks utilities, and at runtime the
       converter knows properties. Ranking each property by the earliest
       utility that sets it reproduces the same grouping in a table small
       enough to ship. */
    const propertyOrder = Object.create(null);
    {
        const ranked = new Map(designSystem.getClassOrder([...indexedUtilities]));
        const rankOf = (utility) => {
            const rank = ranked.get(utility);
            return rank === null || rank === undefined ? null : Number(rank);
        };
        for (const [property, utilities] of [...compositeUtilities, ...propertyUtilities]) {
            const ranks = [];
            for (const utility of utilities) {
                const rank = rankOf(utility);
                if (rank !== null) ranks.push(rank);
            }
            if (ranks.length === 0) continue;

            // The median, not the minimum: `container` is the very first class
            // in Tailwind's order and it sets a width, which is enough to drag
            // every `w-*` ahead of `flex` if one stray utility can speak for
            // the whole property. Utilities that set a property cluster
            // together in the order, so the middle of the cluster is where the
            // property belongs.
            ranks.sort((a, b) => a - b);
            // Dedicated utilities come second in the iteration above, so they
            // overwrite whatever rank a composite utility supplied.
            propertyOrder[property] = ranks[Math.floor(ranks.length / 2)];
        }
        // Compact the ranks to small integers; only their order matters.
        const sorted = Object.keys(propertyOrder).sort((a, b) => propertyOrder[a] - propertyOrder[b]);
        sorted.forEach((property, index) => {
            propertyOrder[property] = index;
        });
    }

    const variants = extractVariants(designSystem, propertyInitials);
    const { prefixes: arbitraryPrefixes, untypedSafe } = deriveArbitraryPrefixes(
        designSystem,
        declarations,
        groups,
        propertyInitials
    );

    const spacing = Object.create(null);
    for (const [prefix, properties] of [...spacingByPrefix].sort()) {
        spacing[prefix] = properties.split(',');
    }

    /* Sanity floors.
       The variant table once silently emptied out when Tailwind changed its
       compiled output shape, and nothing failed — the converter just quietly
       stopped emitting `hover:` and `md:`. These turn that class of
       degradation into a build failure. The numbers are far below what any
       4.x release produces (the smallest, 4.0, yields 3,700+ declaration keys
       and 244 palette entries), so they flag a broken extractor rather than a
       slimmer Tailwind. */
    const floors = [
        ['declaration keys', Object.keys(declarations).length, 1000],
        ['palette entries', Object.keys(palette).length, 50],
        ['colour properties', Object.keys(colorUtilities).length, 5],
        ['spacing prefixes', Object.keys(spacing).length, 10],
        ['arbitrary prefixes', Object.keys(arbitraryPrefixes).length, 50],
        ['ordered properties', Object.keys(propertyOrder).length, 50],
    ];
    for (const [label, actual, minimum] of floors) {
        if (actual < minimum) {
            throw new Error(
                `Only ${actual} ${label} were extracted (expected at least ${minimum}). ` +
                    `Tailwind's output or theme naming has probably changed; see scripts/extract.mjs.`
            );
        }
    }

    const map = {
        tailwindVersion: tailwindVersion(),
        generator: 'scripts/build-map.mjs',
        spacingBase: designSystem.resolveThemeValue('--spacing') ?? '0.25rem',
        colorUtilities,
        palette,
        spacing,
        variants,
        arbitraryPrefixes,
        // Properties whose prefix still means them when the value is a bare
        // `var()`; the rest must use the arbitrary-property form.
        untypedSafe,
        propertyOrder,
        declarations,
        groups,
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(map, null, 0)}\n`);

    const bytes = fs.statSync(OUTPUT_PATH).size;
    process.stdout.write(
        [
            `tailwindcss        ${map.tailwindVersion}`,
            `utilities scanned  ${utilities.length}`,
            `  indexed          ${indexed}`,
            `  skipped          ${skipped}`,
            `  oversized        ${oversized} (generated composites, left to arbitrary values)`,
            `declaration keys   ${Object.keys(declarations).length}`,
            `declaration groups ${groups.length}`,
            `palette entries    ${Object.keys(palette).length}`,
            `color properties   ${Object.keys(colorUtilities).length}`,
            `spacing prefixes   ${Object.keys(spacing).length}`,
            `variants           ${variants.length}`,
            `arbitrary prefixes ${Object.keys(arbitraryPrefixes).length}`,
            `ordered properties ${Object.keys(propertyOrder).length}`,
            `output             ${path.relative(process.cwd(), OUTPUT_PATH)} (${(bytes / 1024).toFixed(0)} KB)`,
            `elapsed            ${Date.now() - started} ms`,
            '',
        ].join('\n')
    );
}

main().catch((error) => {
    process.stderr.write(`build-map failed: ${error?.stack || error}\n`);
    process.exit(1);
});
