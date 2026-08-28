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

    it("writes a breakpoint that is not Tailwind's as an arbitrary variant", () => {
        // Bootstrap's `lg`. Emitting `grid` bare would look right and silently
        // drop the condition.
        expect(classesFor('@media (min-width: 992px) { .a { display: grid; } }')).toBe('min-[992px]:grid');
    });

    it('keeps a condition it has no named variant for', () => {
        expect(classesFor('@supports (display: grid) { .a { display: grid; } }')).toBe(
            '[@supports_(display:_grid)]:grid'
        );
        expect(classesFor('@media (max-width: 767px) { .a { display: grid; } }')).toBe(
            '[@media_(max-width:_767px)]:grid'
        );
    });

    it('names the container a container query belongs to', () => {
        expect(classesFor('@container cards (min-width: 480px) { .a { display: grid; } }')).toBe(
            '@min-[480px]/cards:grid'
        );
    });

    it('reports an at-rule that is not a condition at all', () => {
        const rule = ruleFor('@layer utilities { .a { display: grid; } }');
        expect(rule.unsupportedAtRules).toEqual(['@layer utilities']);
        expect(rule.classes).toEqual(['grid']);
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
        expect(classesFor('.a { text-rendering: geometricPrecision; }')).toBe('[text-rendering:geometricPrecision]');
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

describe('shorthands that used to fall through to arbitrary values', () => {
    it('splits the outline shorthand, the usual way to write a focus ring', () => {
        // Was `[outline:2px_solid_#a5b4fc]` — one arbitrary property for a
        // declaration every one of whose parts has a utility.
        expect(classesFor('.a { outline: 2px solid #a5b4fc; }')).toBe('outline-2 outline-indigo-300');
        expect(classesFor('.a { outline: none; }')).toBe('outline-none');
    });

    it('splits list-style', () => {
        expect(classesFor('.a { list-style: none; }')).toBe('list-none');
        expect(classesFor('.a { list-style: disc inside; }')).toBe('list-inside list-disc');
    });

    it('splits flex-flow onto direction and wrap', () => {
        expect(classesFor('.a { flex-flow: row wrap; }')).toBe('flex-row flex-wrap');
        expect(classesFor('.a { flex-flow: column; }')).toBe('flex-col');
    });

    it('recognises the long spelling of the flex shorthand', () => {
        // CSS defines `<n> 1 0%` as exactly `<n>`; Tailwind only ships the
        // short form, so the long one missed it.
        expect(classesFor('.a { flex: 1 1 0%; }')).toBe('flex-1');
        expect(classesFor('.a { flex: 2 1 0%; }')).toBe('flex-2');
        expect(classesFor('.a { flex: 1 1 auto; }')).toBe('flex-auto');
        expect(classesFor('.a { flex: 0 1 auto; }')).toBe('flex-initial');
        expect(classesFor('.a { flex: 0 0 auto; }')).toBe('flex-none');
    });

    it('leaves a flex value with no keyword equivalent alone', () => {
        expect(classesFor('.a { flex: 1 0 200px; }')).toBe('flex-[1_0_200px]');
    });

    it('reads seconds where Tailwind emits milliseconds', () => {
        expect(classesFor('.a { transition-duration: 0.2s; }')).toBe('duration-200');
        expect(classesFor('.a { transition-delay: 0.3s; }')).toBe('delay-300');
    });
});

describe('legacy colour notation', () => {
    it('matches a v3-era shadow that is identical apart from notation', () => {
        expect(classesFor('.a { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }')).toBe('shadow-xs');
        expect(classesFor('.a { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }')).toBe('shadow-2xl');
    });

    it('reads rgba colours in ordinary properties', () => {
        expect(classesFor('.a { color: rgba(239,68,68,1); }')).toBe('text-red-500');
        expect(classesFor('.a { background-color: rgba(0,0,0,0.5); }')).toBe('bg-black/50');
    });

    it('still refuses a v3 shadow that v4 genuinely changed', () => {
        // v4 altered the second layer's spread and alpha, so this is a
        // different shadow, not a different spelling. Keeping it exact is the
        // right answer.
        expect(
            classesFor('.a { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); }')
        ).toContain('shadow-[');
    });
});

describe('translucent colours', () => {
    it('keeps an alpha the modifier can spell', () => {
        // Bootstrap's hairline. The palette colour matched and the alpha was
        // dropped in silence, turning a 17.5% border into a solid black one.
        expect(classesFor('.a { border-color: rgba(0, 0, 0, 0.175); }')).toBe('border-black/17.5');
        expect(classesFor('.a { background-color: rgba(0, 0, 0, 0.03); }')).toBe('bg-black/3');
    });

    it('falls back to an arbitrary value when it cannot', () => {
        // A third of full opacity has no terminating percentage, so the only
        // exact answer is the value itself.
        expect(classesFor('.a { background-color: rgb(0 0 0 / 33.333333%); }')).toBe('bg-[rgb(0_0_0_/_33.333333%)]');
    });

    it('reports the alpha in what the utility emits', () => {
        const match = ruleFor('.a { color: rgba(0, 0, 0, 0.5); }').matches[0];
        expect(match.emits[0][1]).toContain('/ 0.5');
    });
});

describe('vendor prefixes', () => {
    it('matches a utility from the unprefixed declaration alone', () => {
        // `select-none` emits `-webkit-user-select` too, and requiring both
        // meant the correct spelling fell through to `[user-select:none]`.
        expect(classesFor('.a { user-select: none; }')).toBe('select-none');
        expect(classesFor('.a { -webkit-user-select: none; user-select: none; }')).toBe('select-none');
        expect(classesFor('.a { backdrop-filter: blur(8px); }')).toBe('backdrop-blur-sm');
    });
});

describe('legacy spellings', () => {
    it('reads the aliases every reset stylesheet uses', () => {
        expect(classesFor('.a { word-wrap: break-word; }')).toBe('wrap-break-word');
        expect(classesFor('.a { word-break: break-word; }')).toBe('wrap-break-word');
        expect(classesFor('.a { page-break-after: always; }')).toBe('break-after-page');
        expect(classesFor('.a { page-break-inside: avoid; }')).toBe('break-inside-avoid');
    });

    it('emits one utility when a rule states an alias and its modern name', () => {
        expect(classesFor('.a { overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; }')).toBe(
            'wrap-break-word'
        );
    });

    it('keeps a value the alias does not cover', () => {
        expect(classesFor('.a { word-break: break-all; }')).toBe('break-all');
    });

    it('reads the longhands of the columns shorthand', () => {
        expect(classesFor('.a { column-count: 3; }')).toBe('columns-3');
        expect(classesFor('.a { column-width: 16rem; }')).toBe('columns-3xs');
    });

    it('refuses to rewrite either longhand when the rule states both', () => {
        // `columns` cannot say "three columns of 16rem", so rewriting either
        // one would emit two utilities fighting over the same property.
        expect(classesFor('.a { column-count: 3; column-width: 16rem; }')).toBe(
            '[column-count:3] [column-width:16rem]'
        );
    });
});

describe('values written the long way round', () => {
    it('collapses a box shorthand that repeats itself', () => {
        expect(classesFor('.a { padding: 1rem 1rem; }')).toBe('p-4');
        expect(classesFor('.a { padding: 8px 12px 8px 12px; }')).toBe('px-3 py-2');
        expect(classesFor('.a { border-radius: 4px 4px 4px 4px; }')).toBe('rounded-sm');
    });

    it('folds longhands that agree back into one utility', () => {
        // Bootstrap's `.navbar-brand`, and hand-written CSS generally.
        expect(classesFor('.a { padding-top: 0.3125rem; padding-bottom: 0.3125rem; }')).toBe('py-1.25');
        expect(classesFor('.a { margin-left: auto; margin-right: auto; }')).toBe('mx-auto');
        expect(classesFor('.a { top: 0; right: 0; bottom: 0; left: 0; }')).toBe('inset-0');
    });

    it('leaves longhands that disagree alone', () => {
        expect(classesFor('.a { padding-top: 1rem; padding-bottom: 2rem; }')).toBe('pt-4 pb-8');
        expect(classesFor('.a { overflow-x: hidden; overflow-y: auto; }')).toBe('overflow-x-hidden overflow-y-auto');
        // One side important and the other not is a difference the cascade
        // can see.
        expect(classesFor('.a { padding-top: 1rem; padding-bottom: 1rem !important; }')).toBe('pt-4 pb-4!');
    });

    it('reads the radius everyone writes for a pill', () => {
        expect(classesFor('.a { border-radius: 9999px; }')).toBe('rounded-full');
        expect(classesFor('.a { border-radius: 50rem; }')).toBe('rounded-full');
        // A radius small enough to be a corner stays exact.
        expect(classesFor('.a { border-radius: 100px; }')).toBe('rounded-[100px]');
    });

    it('reads the writing-mode spelling of the alignment keywords', () => {
        expect(classesFor('.a { align-items: start; }')).toBe('items-start');
        expect(classesFor('.a { justify-content: end; }')).toBe('justify-end');
    });
});

describe('the transition shorthand', () => {
    it('splits it into the property, duration and easing utilities', () => {
        // Was one `[transition:…]` arbitrary property — the longest class the
        // converter can emit, hiding a duration and an easing that both have
        // utilities.
        expect(classesFor('.a { transition: opacity 150ms; }')).toBe('transition-opacity');
        expect(classesFor('.a { transition: all 0.2s linear 0.1s; }')).toBe(
            'transition-all delay-100 duration-200 ease-linear'
        );
        expect(classesFor('.a { transition: none; }')).toBe('transition-none');
    });

    it('carries every layer of a property list', () => {
        expect(classesFor('.a { transition: color .15s ease-in-out, background-color .15s ease-in-out; }')).toBe(
            'transition-[color,_background-color] duration-150 ease-[ease-in-out]'
        );
    });

    it('refuses to split layers with different timings', () => {
        // The longhands cannot say "150ms for opacity, 300ms for transform".
        expect(classesFor('.a { transition: opacity 150ms, transform 300ms; }')).toBe(
            '[transition:opacity_150ms,_transform_300ms]'
        );
    });
});

describe('arbitrary values print what was written', () => {
    it('keeps the capitalisation of a value it could not match', () => {
        // CSS does not care, but `transform-[translatey(-2px)]` is not what
        // anybody typed.
        expect(classesFor('.a { transform: translateY(-2px); }')).toBe('transform-[translateY(-2px)]');
        expect(classesFor('.a { font-family: ui-monospace, SFMono-Regular, monospace; }')).toBe(
            'font-[ui-monospace,_SFMono-Regular,_monospace]'
        );
    });

    it('keeps the unit on a zero it prints', () => {
        expect(classesFor('.a { box-shadow: 0px 1px 2px #0001; }')).toContain('shadow-[0px_1px_2px');
    });

    it('names the property when a prefix would be read as another one', () => {
        // `font-[var(--x)]` compiles to a *font-weight*: Tailwind picks the
        // property from the value's shape, and a var() has none.
        expect(classesFor('.a { font-family: var(--brand-font); }')).toBe('[font-family:var(--brand-font)]');
        expect(classesFor('.a { border-width: var(--bw); }')).toBe('[border-width:var(--bw)]');
        // Prefixes that do survive an untypable value keep the short form.
        expect(classesFor('.a { color: var(--brand); }')).toBe('text-[var(--brand)]');
        expect(classesFor('.a { width: var(--w); }')).toBe('w-[var(--w)]');
        // A font stack Tailwind *can* type keeps its prefix.
        expect(classesFor('.a { font-family: ui-monospace, monospace; }')).toBe('font-[ui-monospace,_monospace]');
    });

    it('still matches regardless of case', () => {
        expect(classesFor('.a { COLOR: RED; }')).toBe('text-red-500');
        expect(classesFor('.a { transform: rotateY(180deg); }')).toBe('rotate-y-180');
    });
});
