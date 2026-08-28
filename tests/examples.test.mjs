/**
 * The curated examples are content, and content rots. These check every one
 * still converts to something worth reading after a Tailwind upgrade or a
 * change to the matcher.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { convertCss } from '../src/core/convert.mjs';
import { severityFor } from '../src/core/severity.mjs';
import examples from '../src/data/examples.mjs';

const map = JSON.parse(fs.readFileSync(new URL('../src/generated/tailwind-map.json', import.meta.url), 'utf8'));

describe('curated examples', () => {
    it('has a stable set of ids', () => {
        const ids = examples.map((example) => example.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeGreaterThanOrEqual(5);
    });

    it.each(examples.map((example) => [example.name, example]))('%s parses and converts', (_name, example) => {
        const result = convertCss(example.css, map);
        expect(result.error).toBeNull();
        expect(result.rules.length).toBeGreaterThan(0);

        // Every rule must produce something; an example that converts to
        // nothing teaches nothing.
        for (const rule of result.rules) {
            expect(rule.classes.length, `${rule.selector} produced no classes`).toBeGreaterThan(0);
        }
    });

    it.each(examples.map((example) => [example.name, example]))(
        '%s carries an explanatory comment',
        (_name, example) => {
            expect(example.css).toContain('/*');
            expect(example.summary.length).toBeGreaterThan(10);
        }
    );

    it('covers exact matches, approximations and things that do not convert', () => {
        // The set as a whole has to show the range, or it only teaches the
        // happy path.
        let exact = 0;
        let approximate = 0;
        let notes = 0;

        for (const example of examples) {
            for (const rule of convertCss(example.css, map).rules) {
                for (const match of rule.matches) {
                    if (severityFor(match)) approximate++;
                    else exact++;
                }
                notes += rule.selectorWarnings.length + rule.unsupportedAtRules.length;
            }
        }

        expect(exact).toBeGreaterThan(10);
        expect(approximate).toBeGreaterThan(10);
        expect(notes).toBeGreaterThan(0);
    });

    it('demonstrates variants somewhere in the set', () => {
        const variants = new Set();
        for (const example of examples) {
            for (const rule of convertCss(example.css, map).rules) {
                for (const name of rule.variants) variants.add(name);
            }
        }
        expect(variants).toContain('hover');
        expect(variants).toContain('md');
        expect(variants).toContain('dark');
    });
});
