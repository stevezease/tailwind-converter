/**
 * The reference pages are built from the generated map at build time, so a
 * bad row here becomes a wrong published page rather than a failed build.
 * These tests pin the inversion itself, and then check the whole catalogue
 * against the real map so a Tailwind upgrade that drops a property surfaces
 * as a test failure instead of an empty page.
 */

import { describe, it, expect } from 'vitest';
import {
    rowsForProperty,
    colorExamplesFor,
    spacingUtilitiesFor,
    referenceFor,
} from '../src/core/property-rows.mjs';
import catalog, {
    slugFor,
    plainBlurb,
    CATEGORY_ORDER,
} from '../src/data/property-catalog.mjs';
import map from '../src/generated/tailwind-map.json';

describe('rowsForProperty', () => {
    it('reads single-property utilities out of declarations', () => {
        const rows = rowsForProperty('position', map);
        expect(rows).toContainEqual({ value: 'absolute', utility: 'absolute', also: [] });
    });

    it('matches the property exactly rather than by prefix', () => {
        // `padding` and `padding-top` share a prefix; a `startsWith` check here
        // would fold every side utility into the shorthand's table.
        const rows = rowsForProperty('padding', map);
        expect(rows.every((row) => row.utility.startsWith('p-'))).toBe(true);
    });

    it('keeps the sibling properties of a multi-property utility', () => {
        const truncate = rowsForProperty('text-overflow', map).find(
            (row) => row.utility === 'truncate',
        );
        expect(truncate.also).toEqual(expect.arrayContaining(['overflow', 'white-space']));
    });

    it('leaves out the sr-only recipes', () => {
        // sr-only sets nine declarations to achieve one effect, so it is not
        // the answer to "what class gives me padding: 0".
        const utilities = rowsForProperty('padding', map).map((row) => row.utility);
        expect(utilities).not.toContain('sr-only');
        expect(rowsForProperty('clip-path', map).map((row) => row.utility)).not.toContain('sr-only');
    });

    it('orders numeric values numerically', () => {
        const values = rowsForProperty('z-index', map)
            .map((row) => Number.parseFloat(row.value))
            .filter((value) => !Number.isNaN(value));
        expect(values).toEqual([...values].sort((a, b) => a - b));
    });

    it('returns nothing for a property the map does not cover', () => {
        expect(rowsForProperty('speak-as', map)).toEqual([]);
    });
});

describe('colorExamplesFor', () => {
    it('uses the property own prefix', () => {
        expect(colorExamplesFor('color', map)).toContainEqual({
            value: map.palette.white,
            utility: 'text-white',
            also: [],
        });
        expect(colorExamplesFor('background-color', map).map((row) => row.utility)).toContain(
            'bg-white',
        );
    });

    it('is empty for a property that is not a colour', () => {
        expect(colorExamplesFor('padding', map)).toEqual([]);
    });
});

describe('spacingUtilitiesFor', () => {
    it('inverts the utility-to-properties map', () => {
        expect(spacingUtilitiesFor('padding', map)).toEqual(['p']);
        expect(spacingUtilitiesFor('column-gap', map)).toEqual(['gap-x']);
    });
});

describe('the published catalogue', () => {
    it('has a unique slug per entry', () => {
        const slugs = catalog.map((entry) => slugFor(entry.property));
        expect(new Set(slugs).size).toBe(catalog.length);
    });

    it('only uses categories the index knows how to order', () => {
        for (const entry of catalog) {
            expect(CATEGORY_ORDER).toContain(entry.category);
        }
    });

    it('gives every page something to show', () => {
        // A page whose only content is its own blurb is the thin content this
        // whole exercise is meant to avoid. Two rows is the floor, and the
        // genuinely binary properties (box-sizing, appearance) sit on it.
        for (const entry of catalog) {
            const reference = referenceFor(entry.property, map);
            const count = reference.rows.length + reference.colorExamples.length;
            expect(count, `${entry.property} has ${count} rows`).toBeGreaterThanOrEqual(2);
        }
    });

    it('writes a blurb ending in a full stop for every entry', () => {
        for (const entry of catalog) {
            expect(entry.blurb, entry.property).toMatch(/\.$/);
        }
    });

    it('balances the backticks in every blurb', () => {
        // An unclosed backtick does not fail the build; it renders as a stray
        // character on the page and survives into the meta description.
        for (const entry of catalog) {
            const backticks = (entry.blurb.match(/`/g) ?? []).length;
            expect(backticks % 2, entry.property).toBe(0);
            expect(plainBlurb(entry.blurb)).not.toContain('`');
        }
    });
});
