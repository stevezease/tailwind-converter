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
        // 13px is 3.25 spacing steps, and v4 accepts quarter steps, so this is
        // exact rather than arbitrary — `p-13` would be valid too even though
        // neither appears in Tailwind's enumerated class list.
        const rule = ruleFor('.a { width: 13px; }');
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
        const rule = ruleFor('.a { border-radius: 7px; }', { arbitraryValues: false });
        expect(rule.classNames).toBe('');
        expect(rule.unconverted).toEqual([{ property: 'border-radius', value: '7px' }]);
    });
});

describe('rounding', () => {
    it('is off by default, so nothing is silently changed', () => {
        expect(classesFor('.a { border-radius: 7px; }')).toBe('rounded-[7px]');
    });

    it('snaps to the nearest theme value when enabled, and says so', () => {
        const rule = ruleFor('.a { border-radius: 7px; }', { roundToScale: true });
        expect(rule.matches[0].quality).toBe(QUALITY.ROUNDED);
        expect(rule.matches[0].note).toMatch(/rounded to/);
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
