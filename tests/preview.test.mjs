/**
 * Which comparisons earn a visual specimen.
 *
 * The value of a preview is that it settles a difference the numbers only
 * assert. That means drawing one exactly when the two values would render
 * differently — and not otherwise, since two identical pictures cost space and
 * teach nothing.
 */

import { describe, it, expect } from 'vitest';
import { previewFor, previewPairFor, MAX_BAR_PX } from '../src/core/preview.mjs';

/** Build the row shape `previewPairFor` expects. */
function row(property, from, to, extra = {}) {
    return { property, from, to, changed: from !== to, equivalent: false, ...extra };
}

describe('previewFor', () => {
    it('draws no specimen for a colour', () => {
        // The value row already shows a swatch beside each hex; a second,
        // larger pair underneath repeated it.
        expect(previewFor('color', '#ef4444')).toBeNull();
        expect(previewFor('background-color', 'rgb(0 0 0 / 0.5)')).toBeNull();
    });

    it('draws radius, shadow and opacity on a box', () => {
        expect(previewFor('border-radius', '8px').kind).toBe('box');
        expect(previewFor('box-shadow', '0 1px 2px red').kind).toBe('box');
        expect(previewFor('opacity', '0.5').kind).toBe('box');
    });

    it('draws border thickness on a box, not as a length', () => {
        // A 3px-long bar says nothing about a 3px border.
        const preview = previewFor('border-width', '3px');
        expect(preview.kind).toBe('box');
        expect(preview.style).toEqual({ borderWidth: '3px' });
    });

    it('draws type properties on a run of text', () => {
        expect(previewFor('font-size', '15px').kind).toBe('text');
        expect(previewFor('letter-spacing', '-0.01em').kind).toBe('text');
        expect(previewFor('font-size', '15px').style).toEqual({ fontSize: '15px' });
    });

    it('draws a distance as a bar of that length', () => {
        const preview = previewFor('padding', '24px');
        expect(preview).toMatchObject({ kind: 'bar', pixels: 24, clipped: false });
    });

    it('converts rem to pixels for the bar, honouring the setting', () => {
        expect(previewFor('width', '2rem').pixels).toBe(32);
        expect(previewFor('width', '2rem', { remConversion: 8 }).pixels).toBe(16);
    });

    it('marks an over-long bar as clipped rather than letting it overflow', () => {
        const preview = previewFor('width', '400px');
        expect(preview.clipped).toBe(true);
        expect(preview.style.width).toBe(`${MAX_BAR_PX}px`);
    });

    it('declines values it cannot draw', () => {
        expect(previewFor('width', '50%')).toBeNull();
        expect(previewFor('width', 'auto')).toBeNull();
        expect(previewFor('display', 'flex')).toBeNull();
    });
});

describe('previewPairFor', () => {
    it('draws a pair when the two values render differently', () => {
        expect(previewPairFor(row('border-radius', '10px', '0.5rem')).kind).toBe('box');
        expect(previewPairFor(row('font-size', '15px', '0.875rem')).kind).toBe('text');
    });

    it('draws no pair for colours, which the value row already compares', () => {
        expect(previewPairFor(row('color', '#ef4444', 'oklch(63.7% 0.237 25.331)'))).toBeNull();
    });

    it('skips a unit conversion, which is the same picture twice', () => {
        expect(previewPairFor(row('padding', '16px', '1rem', { equivalent: true }))).toBeNull();
        // Even without the equivalent flag, equal lengths draw equal bars.
        expect(previewPairFor(row('padding', '16px', '1rem'))).toBeNull();
    });

    it('skips a value that did not change', () => {
        expect(previewPairFor(row('display', 'flex', 'flex'))).toBeNull();
    });

    it('skips when only one side can be drawn', () => {
        expect(previewPairFor(row('width', '50%', '2rem'))).toBeNull();
    });
});
