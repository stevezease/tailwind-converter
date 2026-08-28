/**
 * The hover card's data layer: what changed, by how much, and what the utility
 * brings along that the source never asked for.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { convertCss, QUALITY } from '../src/core/convert.mjs';
import { explainMatch } from '../src/core/explain.mjs';

const map = JSON.parse(fs.readFileSync(new URL('../src/generated/tailwind-map.json', import.meta.url), 'utf8'));

/** Explain the first match of the first rule. */
function explain(css, settings = {}) {
    const rule = convertCss(css, map, settings).rules[0];
    const match = rule.matches.find((candidate) => candidate.quality !== QUALITY.EXACT) ?? rule.matches[0];
    return explainMatch(match, rule.declarations, settings);
}

describe('explainMatch', () => {
    it('shows a unit conversion as the same measurement', () => {
        const detail = explain('.a { padding: 16px; }');
        expect(detail.rows[0]).toMatchObject({ property: 'padding', from: '16px', to: '1rem', changed: true });
        expect(detail.rows[0].delta).toMatchObject({ fromPx: 16, toPx: 16, identical: true });
        expect(detail.headline).toContain('Same measurement');
    });

    it('quantifies a rounded value in pixels, not mixed units', () => {
        const detail = explain('.a { border-radius: 7px; }', { roundToScale: true });
        expect(detail.quality).toBe(QUALITY.ROUNDED);
        expect(detail.headline).toBe(
            'Snapped to the nearest theme value: 7px became 6px — 14.3% smaller.'
        );
    });

    it('gives both colours as swatches with a perceptual distance', () => {
        const detail = explain('.a { color: #ef4444; }');
        const row = detail.rows[0];
        expect(row.kind).toBe('color');
        expect(row.fromSwatch.hex).toBe('#ef4444');
        expect(row.toSwatch.hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(row.distance).toBeGreaterThan(0);
        expect(row.band).toBe('clearly the same intent');
    });

    it('describes an arbitrary value as exact but off-scale', () => {
        const detail = explain('.a { letter-spacing: 0.033em; }');
        expect(detail.quality).toBe(QUALITY.ARBITRARY);
        expect(detail.rows[0].changed).toBe(false);
        expect(detail.headline).toContain('off the scale');
    });

    it('surfaces declarations the utility adds on its own', () => {
        // `text-sm` brings a line-height the stylesheet never asked for.
        const detail = explain('.a { font-size: 14px; }');
        expect(detail.added).toEqual([{ property: 'line-height', value: '1.428571' }]);
    });

    it('adds nothing when the source already states the extra declaration', () => {
        const detail = explain('.a { font-size: 14px; line-height: 1.428571; }');
        expect(detail.added).toEqual([]);
    });

    it('follows the rem setting when describing a conversion', () => {
        const detail = explain('.a { padding: 16px; }', { remConversion: 8 });
        expect(detail.headline).toContain('8px per rem');
    });
});

describe('teaching content', () => {
    const map = JSON.parse(fs.readFileSync(new URL('../src/generated/tailwind-map.json', import.meta.url), 'utf8'));

    function explainFirst(css, settings = {}) {
        const rule = convertCss(css, map, settings).rules[0];
        return explainMatch(rule.matches[0], rule.declarations, {
            ...settings,
            map,
            variants: rule.variants,
        });
    }

    it('flags an approximation so the UI can lead with it', () => {
        const detail = explainFirst('.a { padding: 16px; }');
        expect(detail.approximation).toMatchObject({ quality: QUALITY.CONVERTED });
        expect(detail.approximation.headline).toContain('Same measurement');
    });

    it('leaves an exact match with nothing to warn about', () => {
        const detail = explainFirst('.a { display: flex; }');
        expect(detail.approximation).toBeNull();
        expect(detail.headline).toBe('This class emits exactly the declaration you wrote.');
    });

    it('spells a spacing number all the way out to pixels', () => {
        // `gap-3` is three 0.25rem steps, not 3rem and not 0.75 of anything —
        // reading the number as rem is the easiest mistake coming from CSS.
        const detail = explainFirst('.a { gap: 12px; }');
        expect(detail.derivation.text).toBe('3 × 0.25rem = 0.75rem = 12px');
        expect(detail.derivation.hint).toContain('counts 0.25rem steps, not rem');
    });

    it('follows the rem setting in the derivation', () => {
        const detail = explainFirst('.a { padding: 2rem; }', { remConversion: 8 });
        expect(detail.derivation.text).toBe('8 × 0.25rem = 2rem = 16px');
    });

    it('does not claim the spacing scale for utilities that are not on it', () => {
        // 0.875rem is a clean multiple of 0.25rem, but `text-sm` is a font
        // size, not a spacing step.
        const detail = explainFirst('.a { font-size: 0.875rem; }');
        expect(detail.derivation).toBeNull();
    });

    it('shows what a breakpoint prefix compiles to, with pixels', () => {
        const detail = explainFirst('@media (min-width: 768px) { .a { display: flex; } }');
        expect(detail.variants).toHaveLength(1);
        expect(detail.variants[0]).toMatchObject({ prefix: 'md:', css: '@media (width >= 48rem)' });
        expect(detail.variants[0].note).toBe('48rem = 768px');
    });

    it('shows a pseudo-class prefix as the selector it produces', () => {
        const detail = explainFirst('.a:hover { display: flex; }');
        expect(detail.variants[0].css).toContain('&:hover');
    });

    it('explains every prefix on a stacked variant', () => {
        const detail = explainFirst('@media (min-width: 768px) { .a:hover { display: flex; } }');
        expect(detail.variants.map((v) => v.prefix)).toEqual(['md:', 'hover:']);
    });
});
