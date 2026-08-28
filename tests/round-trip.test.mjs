/**
 * The test that matters.
 *
 * For every utility in the generated map: ask Tailwind to compile it, feed the
 * resulting CSS back through the converter, then compile whatever classes came
 * out and compare the declarations. If the two sides agree, the converter
 * inverted Tailwind correctly.
 *
 * The assertion is on declarations rather than class names on purpose. Several
 * utilities compile identically — v4 keeps `flex-grow` as an alias of `grow` —
 * and picking either one is right. What would not be right is producing CSS
 * that differs from the input.
 *
 * Because the cases are generated from the installed Tailwind release, a
 * version bump re-derives the whole suite. A release that changes a property
 * family fails here immediately instead of silently converting to nothing.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { loadDesignSystem } from '../scripts/design-system.mjs';
import { collectPropertyInitials, extractDeclarations } from '../scripts/extract.mjs';
import { convertCss } from '../src/core/convert.mjs';

const map = JSON.parse(fs.readFileSync(new URL('../src/generated/tailwind-map.json', import.meta.url), 'utf8'));

let designSystem;
let propertyInitials;

beforeAll(async () => {
    designSystem = await loadDesignSystem();
    propertyInitials = collectPropertyInitials(
        designSystem.candidatesToCss(designSystem.getClassList().map((entry) => entry[0]))
    );
});

/**
 * Hand control back to the event loop periodically.
 *
 * These suites run thousands of iterations in a tight synchronous loop, which
 * starves Vitest's worker RPC and surfaces as
 * `[vitest-worker]: Timeout calling "onTaskUpdate"` — an unhandled error that
 * Vitest itself warns may cause false positives. Yielding keeps the worker
 * responsive without changing what is asserted.
 */
async function breathe(iteration, every = 250) {
    if (iteration % every === 0) await new Promise((resolve) => setImmediate(resolve));
}

/** Compile a candidate and read back its resolved declarations. */
function declarationsOf(candidate) {
    const css = designSystem.candidatesToCss([candidate])[0];
    if (!css) return null;
    const resolved = extractDeclarations(css, candidate, designSystem, propertyInitials);
    if (!resolved) return null;
    return resolved
        .map((decl) => `${decl.property}: ${decl.value}`)
        .sort()
        .join('; ');
}

/** Every utility the map claims it can produce. */
function indexedUtilities() {
    const utilities = new Set(Object.values(map.declarations));
    for (const group of map.groups) utilities.add(group.utility);
    return [...utilities].sort();
}

describe('round trip: Tailwind utility -> CSS -> converter -> Tailwind utility', () => {
    it('map is built from the installed Tailwind release', () => {
        const installed = JSON.parse(
            fs.readFileSync(new URL('../node_modules/tailwindcss/package.json', import.meta.url), 'utf8')
        ).version;
        expect(map.tailwindVersion).toBe(installed);
    });

    it('reproduces the original declarations for every indexed utility', async () => {
        const utilities = indexedUtilities();
        expect(utilities.length).toBeGreaterThan(2000);

        const failures = [];
        let processed = 0;

        for (const utility of utilities) {
            await breathe(++processed);
            const expected = declarationsOf(utility);
            if (expected === null) continue;

            // Reconstruct the CSS a person would have written for this utility.
            const source = `.probe { ${expected.split('; ').join('; ')} }`;
            const result = convertCss(source, map, { sortClasses: false });
            const rule = result.rules[0];

            if (!rule || rule.classes.length === 0) {
                failures.push({ utility, reason: 'no classes produced', source });
                continue;
            }
            if (rule.unconverted.length > 0) {
                failures.push({ utility, reason: `unconverted: ${JSON.stringify(rule.unconverted)}`, source });
                continue;
            }

            const actual = declarationsOf(rule.classes[0]);
            if (rule.classes.length === 1 && actual === expected) continue;

            // Multiple classes are fine as long as together they restate the
            // same declarations.
            const combined = rule.classes
                .flatMap((candidate) => {
                    const css = designSystem.candidatesToCss([candidate])[0];
                    if (!css) return [`${candidate}: <did not compile>`];
                    const parsed = extractDeclarations(css, candidate, designSystem, propertyInitials);
                    return parsed ? parsed.map((decl) => `${decl.property}: ${decl.value}`) : [`${candidate}: <unreadable>`];
                })
                .sort()
                .join('; ');

            if (combined !== expected) {
                failures.push({
                    utility,
                    reason: `got "${rule.classes.join(' ')}"`,
                    expected,
                    actual: combined,
                });
            }
        }

        if (failures.length) {
            const sample = failures.slice(0, 25)
                .map((failure) => `  ${failure.utility}: ${failure.reason}\n      expected ${failure.expected}\n      actual   ${failure.actual}`)
                .join('\n');
            throw new Error(`${failures.length} of ${utilities.length} utilities failed to round trip:\n${sample}`);
        }
    }, 120000);
});

describe('round trip: variants', () => {
    /**
     * Variants were not covered by the utility round trip above, and that gap
     * hid a real bug: Tailwind emitted variants as nested CSS up to 4.2 and
     * flattened them in 4.3, so an extractor that understood only one shape
     * produced an empty variant table without erroring — the converter simply
     * stopped emitting `hover:` and `md:`. This closes that gap.
     */
    it('reproduces the variant prefix for every variant in the map', async () => {
        expect(map.variants.length).toBeGreaterThan(20);

        const failures = [];
        let processed = 0;

        for (const variant of map.variants) {
            await breathe(++processed, 25);
            const candidate = `${variant.name}:flex`;
            const expected = declarationsOf(candidate);
            if (expected === null) continue;

            const css = designSystem.candidatesToCss([candidate])[0];
            const result = convertCss(css, map, { sortClasses: false });
            const rule = result.rules[0];

            if (!rule) {
                failures.push(`${candidate}: produced no rule`);
                continue;
            }
            if (rule.classNames !== candidate) {
                failures.push(`${candidate}: got "${rule.classNames}"`);
            }
        }

        if (failures.length) {
            throw new Error(
                `${failures.length} of ${map.variants.length} variants failed to round trip:\n` +
                    failures.slice(0, 20).map((line) => `  ${line}`).join('\n')
            );
        }
    }, 60000);

    it('applies a variant to hand-written CSS, not just to Tailwind output', () => {
        // The narrowest possible regression guard for the bug above.
        expect(convertCss('.a:hover { display: flex }', map).rules[0].classNames).toBe('hover:flex');
        expect(
            convertCss('@media (min-width: 768px) { .a { display: flex } }', map).rules[0].classNames
        ).toBe('md:flex');
    });
});

describe('map coverage', () => {
    /**
     * The generator drops declaration sets above a size bound, because
     * Tailwind's mask utilities compile to gradient stacks that make up ~88%
     * of the map's bytes and can never match hand-written CSS. The bound sits
     * just above the largest utility a person would actually write, so a
     * future release adding a bigger one would see it silently excluded.
     */
    it('keeps the multi-declaration utilities people actually write', () => {
        const indexed = new Set(map.groups.map((group) => group.utility));
        for (const utility of ['sr-only', 'truncate', 'antialiased']) {
            // Skip any the installed release does not ship at all.
            if (!designSystem.candidatesToCss([utility])[0]) continue;
            expect(indexed.has(utility), `${utility} is missing from the map`).toBe(true);
        }
    });
});

describe('map generation', () => {
    it('is deterministic, so a regenerated map produces no diff', async () => {
        // Guards the CI check described in the migration plan: if regenerating
        // changes the committed map, either Tailwind moved or the generator is
        // not stable, and both need a human look.
        // execFile rather than execFileSync: the synchronous form blocks the
        // worker for the ~2s the generator takes, which is the other half of
        // the RPC starvation described above.
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const mapPath = new URL('../src/generated/tailwind-map.json', import.meta.url);
        const before = fs.readFileSync(mapPath, 'utf8');

        await promisify(execFile)(process.execPath, ['scripts/build-map.mjs'], {
            cwd: new URL('..', import.meta.url).pathname,
        });

        expect(fs.readFileSync(mapPath, 'utf8')).toBe(before);
    }, 60000);
});
