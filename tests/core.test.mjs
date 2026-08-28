/**
 * Unit tests for the value-level machinery. These pin down the behaviours the
 * higher-level suites depend on but would not localise a failure for.
 */

import { describe, it, expect } from 'vitest';
import { splitTopLevel, substituteVars, evaluateCalc } from '../src/core/css-value.mjs';
import {
    normalizeValue,
    declarationKey,
    stripNoOpLayers,
    canonicalizeShadow,
    canonicalizeColorNotation,
    canonicalizeFlex,
} from '../src/core/normalize.mjs';
import { expandDeclaration } from '../src/core/shorthand.mjs';
import { parseColor, isColor, nearestPaletteColor, alphaModifier, withAlpha } from '../src/core/color.mjs';
import { normalizeAtRuleParams } from '../src/core/convert.mjs';

describe('splitTopLevel', () => {
    it('ignores separators inside functions', () => {
        expect(splitTopLevel('0 4px rgb(0 0 0 / 0.1), 0 2px red')).toEqual(['0 4px rgb(0 0 0 / 0.1)', '0 2px red']);
    });

    it('ignores separators inside quotes', () => {
        expect(splitTopLevel('"a,b", c')).toEqual(['"a,b"', 'c']);
    });
});

describe('substituteVars', () => {
    const theme = (name) => ({ '--spacing': '0.25rem', '--text-sm--line-height': '1.25' })[name];

    it('resolves a known variable', () => {
        expect(substituteVars('var(--spacing)', theme)).toBe('0.25rem');
    });

    it('falls back when the variable is unknown', () => {
        expect(substituteVars('var(--nope, 4px)', theme)).toBe('4px');
    });

    it('resolves nested fallbacks', () => {
        expect(substituteVars('var(--nope, var(--text-sm--line-height))', theme)).toBe('1.25');
    });

    it('treats an empty fallback as an empty value, not a missing one', () => {
        expect(substituteVars('var(--nope,)', theme)).toBe('');
    });

    it('leaves an unresolvable variable in place so callers can detect it', () => {
        expect(substituteVars('var(--nope)', theme)).toBe('var(--nope)');
    });
});

describe('evaluateCalc', () => {
    it('multiplies', () => {
        expect(evaluateCalc('calc(0.25rem * 4)')).toBe('1rem');
    });

    it('divides, which a multiply-only implementation would drop', () => {
        expect(evaluateCalc('calc(1 / 2 * 100%)')).toBe('50%');
    });

    it('handles negatives', () => {
        expect(evaluateCalc('calc(0.25rem * -1.5)')).toBe('-0.375rem');
    });

    it('nests', () => {
        expect(evaluateCalc('calc(calc(2 * 2) * 1px)')).toBe('4px');
    });

    it('refuses to combine incompatible units', () => {
        expect(evaluateCalc('calc(100% - 8px)')).toBe('calc(100% - 8px)');
    });
});

describe('normalizeValue', () => {
    it('unifies zero lengths', () => {
        for (const zero of ['0', '0px', '0rem', '0%']) expect(normalizeValue(zero)).toBe('0');
    });

    it('canonicalises number formatting', () => {
        expect(normalizeValue('.50rem')).toBe('0.5rem');
        expect(normalizeValue('1.0rem')).toBe('1rem');
    });

    it('lowercases keywords but preserves quoted strings', () => {
        expect(normalizeValue('"Segoe UI", ARIAL')).toBe('"Segoe UI", arial');
    });

    it('strips !important, which is not part of the value', () => {
        expect(normalizeValue('red !important')).toBe('red');
    });

    it('produces the same key for equivalent spellings', () => {
        expect(declarationKey('PADDING', '0px')).toBe(declarationKey('padding', '0'));
    });
});

describe('stripNoOpLayers', () => {
    it('drops the neutral shadow layers Tailwind composes with', () => {
        expect(stripNoOpLayers('box-shadow', '0 0 #0000, 0 0 #0000, 0 2px 4px red')).toBe('0 2px 4px red');
    });

    it('collapses an all-neutral stack to none', () => {
        expect(stripNoOpLayers('box-shadow', '0 0 #0000, 0 0 #0000')).toBe('none');
    });

    it('leaves unrelated properties alone', () => {
        expect(stripNoOpLayers('color', '#0000')).toBe('#0000');
    });
});

describe('expandDeclaration', () => {
    it('leaves a single-value shorthand alone so it matches directly', () => {
        expect(expandDeclaration('padding', '16px')).toEqual([['padding', '16px']]);
    });

    it('maps two values onto the logical axes, matching how px-* and py-* compile', () => {
        expect(expandDeclaration('padding', '5px 10px')).toEqual([
            ['padding-block', '5px'],
            ['padding-inline', '10px'],
        ]);
    });

    it('does not split a global keyword across longhands', () => {
        expect(expandDeclaration('margin', 'inherit')).toEqual([['margin', 'inherit']]);
    });

    it('does not split a value it cannot see inside', () => {
        expect(expandDeclaration('padding', 'var(--pad)')).toEqual([['padding', 'var(--pad)']]);
    });

    it('classifies border tokens by shape, not position', () => {
        expect(expandDeclaration('border', 'solid red 2px')).toEqual([
            ['border-style', 'solid'],
            ['border-color', 'red'],
            ['border-width', '2px'],
        ]);
    });

    it('keeps the elliptical radius form whole', () => {
        expect(expandDeclaration('border-radius', '10px / 20px')).toEqual([['border-radius', '10px / 20px']]);
    });
});

describe('colour', () => {
    it('recognises every common notation', () => {
        for (const value of ['#ef4444', 'rgb(0 0 0 / .1)', 'hsl(210 40% 50%)', 'red', 'transparent', 'oklch(63.7% 0.237 25.331)']) {
            expect(isColor(value)).toBe(true);
        }
    });

    it('does not mistake lengths or keywords for colours', () => {
        for (const value of ['12px', 'space-between', '1.5']) expect(isColor(value)).toBe(false);
    });

    it('keeps alpha separate from the coordinates', () => {
        expect(parseColor('rgba(0,0,0,0.5)').alpha).toBe(0.5);
    });

    it('finds the nearest palette entry within tolerance', () => {
        const palette = { 'red-500': 'oklch(63.7% 0.237 25.331)', 'blue-500': 'oklch(62.3% 0.214 259.815)' };
        expect(nearestPaletteColor('#ef4444', palette, 0.05).name).toBe('red-500');
    });

    it('returns nothing when the nearest entry is still too far', () => {
        const palette = { 'red-500': 'oklch(63.7% 0.237 25.331)' };
        expect(nearestPaletteColor('#00ff00', palette, 0.05)).toBeNull();
    });

    it('only offers an alpha modifier it can express exactly', () => {
        expect(alphaModifier(0.5)).toBe('50');
        expect(alphaModifier(1)).toBeNull();
        // Tailwind takes a fractional modifier, so these are exact.
        expect(alphaModifier(0.503)).toBe('50.3');
        expect(alphaModifier(0.175)).toBe('17.5');
        // A percentage that does not terminate has no exact spelling.
        expect(alphaModifier(1 / 3)).toBeNull();
    });

    it('applies an alpha to a palette colour', () => {
        expect(withAlpha('oklch(0.5 0.1 250)', 0.25)).toBe('oklch(0.5 0.1 250 / 0.25)');
        expect(withAlpha('oklch(0.5 0.1 250)', 1)).toBe('oklch(0.5 0.1 250)');
    });
});

describe('normalizeAtRuleParams', () => {
    it('rewrites min-width into the range form Tailwind emits', () => {
        expect(normalizeAtRuleParams('media', '(min-width: 768px)')).toBe('(width >= 48rem)');
    });

    it('rewrites max-width', () => {
        expect(normalizeAtRuleParams('media', '(max-width: 1024px)')).toBe('(width <= 64rem)');
    });

    it('converts media lengths at 16px per rem regardless of the user setting', () => {
        // Inside a media query, rem always refers to the initial root font size.
        expect(normalizeAtRuleParams('media', '(min-width: 48rem)')).toBe('(width >= 48rem)');
    });

    it('leaves non-media at-rules untouched apart from whitespace', () => {
        expect(normalizeAtRuleParams('supports', '(display:  grid)')).toBe('(display: grid)');
    });
});

describe('canonicalizeShadow', () => {
    it('pads an omitted spread so both spellings agree', () => {
        // CSS lets blur and spread be dropped. Tailwind always emits four
        // lengths, so without this a stylesheet using the short form missed
        // the utility entirely and fell through to an arbitrary value.
        expect(declarationKey('box-shadow', '0 1px 2px rgb(0 0 0 / 0.05)')).toBe(
            declarationKey('box-shadow', '0 1px 2px 0 rgb(0 0 0 / 0.05)')
        );
    });

    it('pads an omitted blur as well', () => {
        expect(declarationKey('box-shadow', '0 1px red')).toBe(
            declarationKey('box-shadow', '0 1px 0 0 red')
        );
    });

    it('keeps the inset keyword in front of the lengths', () => {
        expect(canonicalizeShadow('inset 0 2px 4px red')).toBe('inset 0 2px 4px 0 red');
    });

    it('handles every layer of a stack independently', () => {
        expect(canonicalizeShadow('0 1px 2px red, 0 4px 6px -1px blue')).toBe(
            '0 1px 2px 0 red, 0 4px 6px -1px blue'
        );
    });

    it('does not disturb a colour function containing spaces', () => {
        expect(canonicalizeShadow('0 1px 2px rgb(0 0 0 / 0.05)')).toBe(
            '0 1px 2px 0 rgb(0 0 0 / 0.05)'
        );
    });

    it('leaves none alone', () => {
        expect(canonicalizeShadow('none')).toBe('none');
    });
});

describe('canonicalizeColorNotation', () => {
    it('rewrites legacy comma syntax to the modern form', () => {
        expect(canonicalizeColorNotation('rgba(0, 0, 0, 0.05)')).toBe('rgb(0 0 0 / 0.05)');
        expect(canonicalizeColorNotation('rgb(239, 68, 68)')).toBe('rgb(239 68 68)');
        expect(canonicalizeColorNotation('hsla(210, 40%, 50%, 0.5)')).toBe('hsl(210 40% 50% / 0.5)');
    });

    it('drops an alpha of 1, which is what omitting it means', () => {
        expect(canonicalizeColorNotation('rgba(0, 0, 0, 1)')).toBe('rgb(0 0 0)');
    });

    it('leaves the modern form untouched', () => {
        expect(canonicalizeColorNotation('rgb(0 0 0 / 0.05)')).toBe('rgb(0 0 0 / 0.05)');
    });

    it('rewrites every colour in a multi-layer value', () => {
        expect(canonicalizeColorNotation('0 1px rgba(0,0,0,0.1), 0 2px rgba(0,0,0,0.2)')).toBe(
            '0 1px rgb(0 0 0 / 0.1), 0 2px rgb(0 0 0 / 0.2)'
        );
    });

    it('makes an rgba shadow match the identical rgb one', () => {
        // A v3 stylesheet's `shadow-2xl` is byte-for-byte v4's, apart from the
        // colour notation.
        expect(declarationKey('box-shadow', '0 25px 50px -12px rgba(0,0,0,0.25)')).toBe(
            declarationKey('box-shadow', '0 25px 50px -12px rgb(0 0 0 / 0.25)')
        );
    });
});

describe('canonicalizeFlex', () => {
    it('recognises the long spelling of a numeric flex', () => {
        expect(canonicalizeFlex('1 1 0')).toBe('1');
        expect(canonicalizeFlex('2 1 0')).toBe('2');
    });

    it('recognises the keyword spellings', () => {
        expect(canonicalizeFlex('1 1 auto')).toBe('auto');
        expect(canonicalizeFlex('0 0 auto')).toBe('none');
        expect(canonicalizeFlex('0 1 auto')).toBe('0 auto');
    });

    it('leaves a value with no keyword equivalent alone', () => {
        expect(canonicalizeFlex('1 0 200px')).toBe('1 0 200px');
    });
});
