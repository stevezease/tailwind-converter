/**
 * Behaviour tests written against CSS as people actually write it.
 *
 * The round-trip suite proves the converter inverts Tailwind's own output.
 * These cover the other direction: shorthands, unit spellings, selectors and
 * at-rules that Tailwind never emits but stylesheets are full of.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { convertCss, QUALITY } from '../src/core/convert.mjs';

const map = JSON.parse(fs.readFileSync(new URL('../src/generated/tailwind-map.json', import.meta.url), 'utf8'));

/** Convert a single rule and return its class string. */
function classesFor(css, settings) {
    const result = convertCss(css, map, settings);
    expect(result.error).toBeNull();
    return result.rules[0]?.classNames ?? '';
}

function ruleFor(css, settings) {
    return convertCss(css, map, settings).rules[0];
}

describe('exact matches', () => {
    it('converts keyword declarations', () => {
        expect(classesFor('.a { display: flex; position: absolute; }')).toBe('absolute flex');
    });

    it('converts theme values given in rem', () => {
        expect(classesFor('.a { padding: 1rem; }')).toBe('p-4');
    });

    it('treats 0, 0px and 0rem as the same value', () => {
        for (const zero of ['0', '0px', '0rem']) {
            expect(classesFor(`.a { margin-top: ${zero}; }`)).toBe('mt-0');
        }
    });
});

describe('unit and spelling equivalence', () => {
    it('converts px to the configured rem scale', () => {
        expect(classesFor('.a { padding: 16px; }')).toBe('p-4');
    });

    it('honours a non-default rem size', () => {
        expect(classesFor('.a { padding: 16px; }', { remConversion: 8 })).toBe('p-8');
    });

    it('matches opacity written as a fraction', () => {
        expect(classesFor('.a { opacity: 0.5; }')).toBe('opacity-50');
    });

    it('matches font-weight keywords', () => {
        expect(classesFor('.a { font-weight: bold; }')).toBe('font-bold');
        expect(classesFor('.a { font-weight: normal; }')).toBe('font-normal');
    });

    it('reports converted values as such, not as exact', () => {
        const rule = ruleFor('.a { padding: 16px; }');
        expect(rule.matches[0].quality).toBe(QUALITY.CONVERTED);
    });
});

describe('shorthands', () => {
    it('expands a two-value box shorthand onto the logical axes', () => {
        // Canonical class order puts the inline axis first.
        expect(classesFor('.a { padding: 8px 16px; }')).toBe('px-4 py-2');
    });

    it('expands a four-value box shorthand onto physical sides', () => {
        expect(classesFor('.a { margin: 0 4px 8px 12px; }')).toBe('mt-0 mr-1 mb-2 ml-3');
    });

    it('expands the border shorthand by token type', () => {
        expect(classesFor('.a { border: 1px solid #e5e7eb; }')).toBe('border border-gray-200');
    });

    it('treats a bare colour background as background-color', () => {
        expect(classesFor('.a { background: #ef4444; }')).toBe('bg-red-500');
    });

    it('leaves a real background layer alone', () => {
        // `background` as a whole has no single-property utility, so this
        // takes the arbitrary-property form rather than being split.
        const rule = ruleFor('.a { background: url(x.png) no-repeat; }');
        expect(rule.classNames).toBe('[background:url(x.png)_no-repeat]');
    });

    it('splits gap into its two axes', () => {
        expect(classesFor('.a { gap: 4px 8px; }')).toBe('gap-x-2 gap-y-1');
    });
});

describe('multi-declaration utilities', () => {
    it('claims font-size and line-height together', () => {
        expect(classesFor('.a { font-size: 0.875rem; line-height: 1.428571; }')).toBe('text-sm');
    });

    it('matches a utility from its required declaration alone', () => {
        expect(classesFor('.a { border-width: 1px; }')).toBe('border');
    });

    it('does not report the implied declaration as unconverted', () => {
        const rule = ruleFor('.a { border-width: 2px; border-style: solid; }');
        expect(rule.classNames).toBe('border-2');
        expect(rule.unconverted).toEqual([]);
    });
});

describe('colours', () => {
    it('maps a v1 palette hex onto its v4 counterpart', () => {
        expect(classesFor('.a { color: #ef4444; }')).toBe('text-red-500');
    });

    it('flags an inexact colour rather than pretending it is exact', () => {
        const rule = ruleFor('.a { color: #ef4444; }');
        expect(rule.matches[0].quality).toBe(QUALITY.NEAREST_COLOR);
        expect(rule.matches[0].distance).toBeGreaterThan(0);
    });

    it('carries alpha through as a modifier', () => {
        expect(classesFor('.a { background-color: rgb(239 68 68 / 50%); }')).toBe('bg-red-500/50');
    });

    it('falls back to an arbitrary value when nothing is close', () => {
        expect(classesFor('.a { color: #00ff00; }')).toBe('text-[#00ff00]');
    });

    it('respects a tighter tolerance', () => {
        expect(classesFor('.a { color: #ef4444; }', { colorTolerance: 0.001 })).toBe('text-[#ef4444]');
    });
});

describe('variants', () => {
    it('turns a pseudo-class into a prefix', () => {
        expect(classesFor('.a:hover { display: flex; }')).toBe('hover:flex');
    });

    it('peels the longest matching pseudo-class first', () => {
        expect(classesFor('.a:focus-visible { display: flex; }')).toBe('focus-visible:flex');
    });

    it('stacks a pseudo-element on a pseudo-class', () => {
        const rule = ruleFor('.a:hover::before { content: ""; display: flex; }');
        expect(rule.variants).toEqual(['hover', 'before']);
        expect(rule.classNames).toBe('hover:before:flex');
    });

    it('maps a min-width media query to its breakpoint', () => {
        expect(classesFor('@media (min-width: 768px) { .a { display: grid; } }')).toBe('md:grid');
    });

    it('maps a media query written in rem to the same breakpoint', () => {
        expect(classesFor('@media (min-width: 48rem) { .a { display: grid; } }')).toBe('md:grid');
    });

    it('maps a dark-mode query', () => {
        expect(classesFor('@media (prefers-color-scheme: dark) { .a { display: flex; } }')).toBe('dark:flex');
    });

    it('reports an at-rule it cannot express', () => {
        const rule = ruleFor('@supports (display: grid) { .a { display: grid; } }');
        expect(rule.unsupportedAtRules).toEqual(['@supports (display: grid)']);
    });
});

describe('arbitrary-value fallback', () => {
    it('uses the prefixed form when a prefix is known', () => {
        expect(classesFor('.a { letter-spacing: 0.033em; }')).toBe('tracking-[0.033em]');
    });

    it('prefers an exact spacing step over an arbitrary value', () => {
        // 13px is 3.25 spacing steps, and v4 accepts quarter steps, so this
        // lands on the scale rather than falling back — `p-13` would be valid
        // too, though neither appears in Tailwind's enumerated class list.
        const rule = ruleFor('.a { width: 13px; }');
        expect(rule.classNames).toBe('w-3.25');
        // Labelled `converted` because the unit changed, exactly as
        // `padding: 16px` -> `p-4` is. No value was lost either way.
        expect(rule.matches[0].quality).toBe(QUALITY.CONVERTED);
        expect(rule.matches[0].emits).toEqual([['width', '0.8125rem']]);
    });

    it('reports a spacing step written in rem as exact', () => {
        const rule = ruleFor('.a { width: 0.8125rem; }');
        expect(rule.classNames).toBe('w-3.25');
        expect(rule.matches[0].quality).toBe(QUALITY.EXACT);
    });

    it('uses the arbitrary-property form otherwise', () => {
        // Deliberately a property Tailwind has never shipped a utility for.
        // Asserting on one it *does* ship (mask-type-alpha, say) would really
        // be testing which release is installed — that failed on 4.0, where
        // the utility does not exist yet and the fallback was correct.
        expect(classesFor('.a { text-rendering: geometricPrecision; }')).toBe('[text-rendering:geometricprecision]');
    });

    it('encodes spaces as underscores', () => {
        expect(classesFor('.a { grid-template-areas: "a b"; }')).toContain('_');
    });

    it('reports declarations as unconverted when the fallback is disabled', () => {
        // 40px is too far from any radius on the scale to snap, so with the
        // fallback off there is nothing left to emit.
        const rule = ruleFor('.a { border-radius: 40px; }', { arbitraryValues: false });
        expect(rule.classNames).toBe('');
        expect(rule.unconverted).toEqual([{ property: 'border-radius', value: '40px' }]);
    });
});

describe('rounding', () => {
    it('prefers a theme value over an arbitrary one when the gap is small', () => {
        // A class on the scale teaches the scale; `rounded-[10px]` teaches
        // only the escape hatch. Nothing is hidden by this: the class is
        // underlined and the hover card shows both numbers.
        expect(classesFor('.a { border-radius: 10px; }')).toBe('rounded-lg');
        expect(ruleFor('.a { border-radius: 10px; }').matches[0].note).toMatch(/rounded to 8px/);
    });

    it('accepts a small pixel gap that a relative threshold alone would reject', () => {
        // 10px -> 8px is 20%, past the relative tolerance, but only 2px.
        const rule = ruleFor('.a { border-radius: 10px; }');
        expect(rule.matches[0].error).toBeGreaterThan(0.15);
        expect(rule.matches[0].offByPx).toBe(2);
    });

    it('refuses a gap that is large in both senses', () => {
        // 40px is 8px from the nearest radius and 20% off; snapping would be a
        // design change, not a translation.
        expect(classesFor('.a { border-radius: 40px; }')).toBe('rounded-[40px]');
    });

    it('can be turned off for a strict, value-preserving pass', () => {
        expect(classesFor('.a { border-radius: 10px; }', { roundToScale: false })).toBe(
            'rounded-[10px]'
        );
    });

    it('never rounds when an exact match exists', () => {
        expect(classesFor('.a { border-radius: 0.5rem; }')).toBe('rounded-lg');
        expect(ruleFor('.a { border-radius: 0.5rem; }').matches[0].quality).toBe(QUALITY.EXACT);
    });
});

describe('important', () => {
    it('moves !important to the trailing modifier', () => {
        expect(classesFor('.a { display: flex !important; }')).toBe('flex!');
    });
});

describe('resilience', () => {
    it('returns a parse error instead of throwing', () => {
        const result = convertCss('.a { color: ', map);
        expect(result.rules).toEqual([]);
        expect(result.error).not.toBeNull();
    });

    it('skips keyframe rules, which have no utility equivalent', () => {
        const result = convertCss('@keyframes spin { from { opacity: 0; } to { opacity: 1; } }', map);
        expect(result.rules).toEqual([]);
    });

    it('handles an empty stylesheet', () => {
        expect(convertCss('', map).rules).toEqual([]);
    });

    it('converts every rule in a selector list once', () => {
        const rule = ruleFor('.a, .b { display: flex; }');
        expect(rule.selectors).toEqual(['.a', '.b']);
        expect(rule.classNames).toBe('flex');
    });
});

describe('what a class list cannot express', () => {
    it('warns when a descendant selector loses its context', () => {
        // The classes go on `.item`; applying them without the `.menu`
        // ancestor is a different rule. Emitting them silently was worse than
        // emitting nothing, because the output looks correct.
        const rule = ruleFor('.menu .item { color: #ef4444; }');
        expect(rule.classNames).toBe('text-red-500');
        expect(rule.selectorWarnings).toHaveLength(1);
        expect(rule.selectorWarnings[0]).toContain('`.item`');
        expect(rule.selectorWarnings[0]).toContain('group-*');
    });

    it('warns about a child combinator too', () => {
        expect(ruleFor('.a > .b { display: flex; }').selectorWarnings).toHaveLength(1);
    });

    it('warns when a condition on the element has no variant', () => {
        const rule = ruleFor('.btn:not(.disabled) { display: flex; }');
        expect(rule.selectorWarnings[0]).toContain(':not(.disabled)');
        expect(rule.selectorWarnings[0]).toContain('unconditionally');
    });

    it('warns about an attribute selector', () => {
        expect(ruleFor('[data-open] { display: block; }').selectorWarnings[0]).toContain('[data-open]');
    });

    it('says nothing about selectors utilities can express', () => {
        for (const selector of ['.card', '.a.b', 'div', '#main', '.card:hover']) {
            expect(ruleFor(`${selector} { display: flex; }`).selectorWarnings).toEqual([]);
        }
    });
});

describe('pseudo-element content', () => {
    it('keeps a real content value instead of swallowing it', () => {
        // The `after:` variant emits `content: var(--tw-content)`, which used
        // to consume the source declaration and lose the value entirely.
        const rule = ruleFor('.a::after { content: "→"; color: #ef4444; }');
        expect(rule.classNames).toContain('after:content-["→"]');
        expect(rule.unconverted).toEqual([]);
    });

    it('still drops a content declaration that only restates the default', () => {
        const rule = ruleFor('.a::before { content: ""; display: block; }');
        expect(rule.classNames).toBe('before:block');
    });
});

describe('rounding to multi-declaration utilities', () => {
    it('snaps a font size the same way it snaps a radius', () => {
        // Every text size is a group (font-size + line-height), so without
        // groups on the scale `font-size: 13px` could not reach `text-xs`
        // while `border-radius: 13px` reached `rounded-xl` — the same 1px gap
        // treated two different ways.
        expect(classesFor('.a { font-size: 15px; }')).toBe('text-sm');
        expect(classesFor('.a { border-radius: 13px; }')).toBe('rounded-xl');
    });

    it('reports the declaration the utility brings with it', () => {
        const rule = ruleFor('.a { font-size: 15px; }');
        expect(rule.matches[0].quality).toBe(QUALITY.ROUNDED);
        // The line-height must stay visible in `emits` so the hover card can
        // show it rather than the rounding hiding it.
        expect(rule.matches[0].emits).toEqual([
            ['font-size', '0.875rem'],
            ['line-height', '1.428571'],
        ]);
    });

    it('still refuses a font size that is genuinely far off', () => {
        const rule = ruleFor('.a { font-size: 40px; }');
        expect(rule.matches[0].offByPx).toBeGreaterThanOrEqual(2);
        expect(rule.matches[0].error).toBeGreaterThanOrEqual(0.1);
    });

    it('does not round to a group that needs more than one declaration', () => {
        // `antialiased` sets two properties; nothing about it is a scale.
        expect(classesFor('.a { -webkit-font-smoothing: antialiased; }')).toContain('antialiased');
    });
});
