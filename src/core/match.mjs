/**
 * Tiered matching of CSS declarations against the generated Tailwind map.
 *
 * The tiers run in order of confidence, and every result carries the tier it
 * came from so the UI can distinguish "this is exactly your CSS" from "this is
 * close to your CSS". The v1 converter rounded silently and reported nothing,
 * which meant a 13px padding quietly became 12px.
 *
 * The last tier cannot fail: anything unmatched becomes an arbitrary value,
 * which is exact by construction.
 */

import { declarationKey, normalizeValue, normalizeProperty } from './normalize.mjs';
import { formatNumber } from './css-value.mjs';
import { nearestPaletteColor, alphaModifier, isColor } from './color.mjs';

export const DEFAULT_SETTINGS = {
    /** Pixels per rem, used only to offer px<->rem alternatives. */
    remConversion: 16,
    /** Max OKLab distance still considered the same color. */
    colorTolerance: 0.05,
    /** Emit `w-[13px]` instead of giving up. */
    arbitraryValues: true,
    /**
     * Snap to the nearest theme value when nothing matches exactly.
     *
     * On by default. A snapped value is never silent: it is underlined, the
     * hover card shows both numbers and the size of the change, and anything
     * that moves a length by more than a few percent is flagged for review. A
     * class on the theme scale teaches the scale; `rounded-[10px]` teaches
     * only the escape hatch.
     */
    roundToScale: true,

    /**
     * How far a value may be from a theme value and still snap to it.
     *
     * Two limits, either of which is enough, because relative error alone
     * misjudges both ends of the scale: 2px off a 10px radius is invisible but
     * is 20% of it, while 15% of a 100px radius is 15px and plainly wrong.
     */
    scaleTolerance: 0.15,
    absoluteTolerancePx: 2,
};

/** How much to trust a result, best first. Surfaced in the UI. */
export const QUALITY = {
    EXACT: 'exact',
    CONVERTED: 'converted',
    ROUNDED: 'rounded',
    NEAREST_COLOR: 'nearest-color',
    ARBITRARY: 'arbitrary',
};

const SINGLE_NUMBER = /^([+-]?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;
const LENGTH_TOKEN = /([+-]?(?:\d+\.?\d*|\.\d+))(px|rem)\b/gi;

/**
 * Keyword spellings CSS treats as equal to a computed value. Tailwind only
 * emits the numeric form, so `font-weight: bold` needs translating to reach
 * `font-bold`. This is CSS semantics rather than anything Tailwind exposes, so
 * unlike the rest of the map it is written out here — deliberately short, and
 * limited to cases where the equivalence is exact.
 */
const KEYWORD_EQUIVALENTS = {
    'font-weight': { normal: '400', bold: '700' },
};

/**
 * Tailwind arbitrary values may not contain spaces, which are written as
 * underscores; literal underscores are escaped.
 */
function toArbitrary(value) {
    return value.replace(/_/g, '\\_').replace(/\s+/g, '_');
}

function parseSingleNumber(value) {
    const match = SINGLE_NUMBER.exec(value.trim());
    if (!match) return null;
    return { number: parseFloat(match[1]), unit: match[2].toLowerCase() };
}

/** Convert a length to rem for comparison. Returns null for other units. */
function toRem(value, remConversion) {
    const parsed = parseSingleNumber(value);
    if (!parsed) return null;
    if (parsed.unit === 'rem') return parsed.number;
    if (parsed.unit === 'px') return parsed.number / remConversion;
    if (parsed.number === 0 && parsed.unit === '') return 0;
    return null;
}

export function createMatcher(map, userSettings = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...userSettings };
    const remConversion = Number(settings.remConversion) || DEFAULT_SETTINGS.remConversion;

    /* --- indexes derived once per matcher --- */

    // Every declaration key that appears in a group, so group candidates can be
    // looked up rather than scanned.
    const groupsByKey = new Map();
    map.groups.forEach((group, groupIndex) => {
        for (const [property, value] of group.declarations) {
            const key = declarationKey(property, value);
            if (!groupsByKey.has(key)) groupsByKey.set(key, []);
            groupsByKey.get(key).push(groupIndex);
        }
    });

    // Spacing prefixes that control exactly one property, for the arithmetic
    // tier. v4's spacing scale is `--spacing` times any number, so `p-13` is
    // valid despite being absent from the enumerated class list.
    const spacingByProperty = new Map();
    for (const prefix in map.spacing) {
        const properties = map.spacing[prefix];
        if (properties.length !== 1) continue;
        const existing = spacingByProperty.get(properties[0]);
        if (!existing || prefix.length < existing.length) spacingByProperty.set(properties[0], prefix);
    }
    const spacingStep = toRem(map.spacingBase, remConversion);

    // Numeric candidates per property, for the rounding tier.
    let numericScales = null;
    function scaleFor(property) {
        if (numericScales === null) {
            numericScales = new Map();

            const add = (prop, rem, utility, emits) => {
                if (rem === null) return;
                if (!numericScales.has(prop)) numericScales.set(prop, []);
                numericScales.get(prop).push({ rem, utility, emits });
            };

            for (const key in map.declarations) {
                const separator = key.indexOf(':');
                const prop = key.slice(0, separator);
                const value = key.slice(separator + 1);
                add(prop, toRem(value, remConversion), map.declarations[key], [[prop, value]]);
            }

            /* Groups with a single required declaration belong on the scale
               too. Every text size is one — `text-sm` sets a font-size and
               brings a line-height with it — so without this, `font-size: 13px`
               could not reach `text-sm` while `border-radius: 13px` happily
               reached `rounded-xl`. The line-height comes along either way,
               and the card reports it under "Also sets". */
            for (const group of map.groups) {
                if (group.declarations.length !== 1) continue;
                const [prop, value] = group.declarations[0];
                add(prop, toRem(value, remConversion), group.utility, [
                    ...group.declarations,
                    ...(group.optional || []),
                ]);
            }

            for (const list of numericScales.values()) list.sort((a, b) => a.rem - b.rem);
        }
        return numericScales.get(property) || null;
    }

    /* --- tiers --- */

    function lookupExact(property, value) {
        return map.declarations[declarationKey(property, value)];
    }

    /** Equivalent spellings of the same value, tried after an exact miss. */
    function alternativeValues(property, value) {
        const alternatives = [];

        const keyword = KEYWORD_EQUIVALENTS[property]?.[value];
        if (keyword) alternatives.push(keyword);

        if (LENGTH_TOKEN.test(value)) {
            LENGTH_TOKEN.lastIndex = 0;
            alternatives.push(
                value.replace(LENGTH_TOKEN, (match, number, unit) =>
                    unit.toLowerCase() === 'px' ? `${formatNumber(parseFloat(number) / remConversion)}rem` : match
                )
            );
            LENGTH_TOKEN.lastIndex = 0;
            alternatives.push(
                value.replace(LENGTH_TOKEN, (match, number, unit) =>
                    unit.toLowerCase() === 'rem' ? `${formatNumber(parseFloat(number) * remConversion)}px` : match
                )
            );
        }
        LENGTH_TOKEN.lastIndex = 0;

        // `opacity: 0.5` and `opacity: 50%` are the same declaration; Tailwind
        // emits the percentage form.
        const single = parseSingleNumber(value);
        if (single) {
            if (single.unit === '') alternatives.push(`${formatNumber(single.number * 100)}%`);
            if (single.unit === '%') alternatives.push(formatNumber(single.number / 100));
        }

        return alternatives.filter((alternative) => alternative && alternative !== value);
    }

    function matchSpacing(property, value) {
        const prefix = spacingByProperty.get(property);
        if (!prefix || !spacingStep) return null;

        const rem = toRem(value, remConversion);
        if (rem === null) return null;

        const steps = rem / spacingStep;
        const rounded = Math.round(steps * 4) / 4;
        if (Math.abs(steps - rounded) > 1e-6 || rounded === 0) return null;

        const magnitude = formatNumber(Math.abs(rounded));
        return {
            utility: rounded < 0 ? `-${prefix}-${magnitude}` : `${prefix}-${magnitude}`,
            emits: [[property, normalizeValue(`${formatNumber(rounded * spacingStep)}rem`)]],
            steps: rounded,
        };
    }

    function matchColor(property, value) {
        const prefix = map.colorUtilities[property];
        if (!prefix || !isColor(value)) return null;

        const nearest = nearestPaletteColor(value, map.palette, settings.colorTolerance);
        if (!nearest) return null;

        const alpha = alphaModifier(nearest.alpha);
        const utility = `${prefix}-${nearest.name}${alpha ? `/${alpha}` : ''}`;
        return {
            utility,
            distance: nearest.distance,
            themeName: nearest.name,
            themeValue: map.palette[nearest.name],
            alpha: nearest.alpha,
            emits: [[property, map.palette[nearest.name]]],
        };
    }

    function matchRounded(property, value) {
        if (!settings.roundToScale) return null;
        const scale = scaleFor(property);
        if (!scale) return null;

        const rem = toRem(value, remConversion);
        if (rem === null || rem === 0) return null;

        let best = null;
        for (const entry of scale) {
            const error = Math.abs(entry.rem - rem) / Math.abs(rem);
            if (!best || error < best.error) best = { ...entry, error };
        }
        if (!best) return null;

        const offByPx = Math.abs(best.rem - rem) * remConversion;
        const withinRelative = best.error <= settings.scaleTolerance;
        const withinAbsolute = offByPx <= (settings.absoluteTolerancePx ?? DEFAULT_SETTINGS.absoluteTolerancePx);
        if (!withinRelative && !withinAbsolute) return null;

        return {
            utility: best.utility,
            note: `${value} rounded to ${formatNumber(best.rem * remConversion)}px`,
            // The chosen utility's own declarations, so a group's extra
            // declaration is reported rather than hidden by the rounding.
            emits: best.emits,
            error: best.error,
            offByPx,
        };
    }

    function matchArbitrary(property, value) {
        if (!settings.arbitraryValues) return null;
        const prefix = map.arbitraryPrefixes[property];
        const encoded = toArbitrary(value);
        // The arbitrary-property form works for every property; the prefixed
        // form is preferred only because it is what a person would write.
        return prefix ? `${prefix}-[${encoded}]` : `[${normalizeProperty(property)}:${encoded}]`;
    }

    function resolveSingle(declaration) {
        const { property, value } = declaration;

        // Every tier reports `emits`: the declarations the chosen utility
        // actually produces. For an exact match that is the input verbatim;
        // where the tiers approximate, it is what the stylesheet would become,
        // which is exactly what the UI needs to show a side-by-side diff.
        const exact = lookupExact(property, value);
        if (exact) return { utility: exact, quality: QUALITY.EXACT, emits: [[property, value]] };

        for (const alternative of alternativeValues(property, value)) {
            const hit = lookupExact(property, alternative);
            if (hit) {
                return {
                    utility: hit,
                    quality: QUALITY.CONVERTED,
                    note: `${value} = ${alternative}`,
                    emits: [[property, alternative]],
                };
            }
        }

        const spacing = matchSpacing(property, value);
        if (spacing) {
            return {
                utility: spacing.utility,
                quality: spacing.emits[0][1] === value ? QUALITY.EXACT : QUALITY.CONVERTED,
                note: spacing.emits[0][1] === value ? undefined : `${value} = ${spacing.emits[0][1]}`,
                emits: spacing.emits,
                steps: spacing.steps,
            };
        }

        const color = matchColor(property, value);
        if (color) {
            const isExact = color.distance < 1e-6;
            return {
                utility: color.utility,
                quality: isExact ? QUALITY.EXACT : QUALITY.NEAREST_COLOR,
                note: isExact ? undefined : `nearest palette color to ${value}`,
                distance: color.distance,
                themeName: color.themeName,
                themeValue: color.themeValue,
                alpha: color.alpha,
                emits: color.emits,
            };
        }

        const rounded = matchRounded(property, value);
        if (rounded) {
            return {
                utility: rounded.utility,
                quality: QUALITY.ROUNDED,
                note: rounded.note,
                emits: rounded.emits,
                error: rounded.error,
                offByPx: rounded.offByPx,
            };
        }

        const arbitrary = matchArbitrary(property, value);
        if (arbitrary) {
            return { utility: arbitrary, quality: QUALITY.ARBITRARY, emits: [[property, value]] };
        }

        return null;
    }

    /**
     * Match a rule's declarations.
     *
     * Returns `{ matches, unconverted }`. `unconverted` is only ever non-empty
     * when arbitrary values are disabled.
     */
    function match(declarations) {
        const pool = declarations.map((declaration, index) => ({
            index,
            property: normalizeProperty(declaration.property),
            value: normalizeValue(declaration.value),
            important: Boolean(declaration.important),
            consumed: false,
        }));

        const matches = [];
        const unconverted = [];

        /* --- tier 1: multi-declaration groups ---
           Tried first and largest-first, so `text-sm` claims its font-size and
           line-height before a single-declaration match can take the
           font-size on its own. */
        // Index each declaration under its own key *and* its equivalent
        // spellings, so a group is reachable from `font-size: 14px` as well as
        // from the `0.875rem` Tailwind emits.
        const byKey = new Map();
        const addKey = (key, entry) => {
            if (!byKey.has(key)) byKey.set(key, []);
            byKey.get(key).push(entry);
        };
        for (const entry of pool) {
            addKey(declarationKey(entry.property, entry.value), entry);
            for (const alternative of alternativeValues(entry.property, entry.value)) {
                entry.alternateKeys = entry.alternateKeys || new Set();
                const key = declarationKey(entry.property, alternative);
                entry.alternateKeys.add(key);
                addKey(key, entry);
            }
        }

        const candidateGroups = new Set();
        for (const key of byKey.keys()) {
            for (const groupIndex of groupsByKey.get(key) || []) candidateGroups.add(groupIndex);
        }

        for (const groupIndex of [...candidateGroups].sort((a, b) =>
            map.groups[b].declarations.length - map.groups[a].declarations.length || a - b
        )) {
            const group = map.groups[groupIndex];
            const claimed = [];
            const usedAlternate = new Set();

            for (const [property, value] of group.declarations) {
                const key = declarationKey(property, value);
                const entry = (byKey.get(key) || []).find((item) => !item.consumed && !claimed.includes(item));
                if (!entry) {
                    claimed.length = 0;
                    usedAlternate.clear();
                    break;
                }
                if (entry.alternateKeys?.has(key)) usedAlternate.add(entry);
                claimed.push(entry);
            }

            if (claimed.length !== group.declarations.length) continue;

            // Defaults the utility supplies anyway — `border`'s `border-style`,
            // `text-sm`'s `line-height`. They are not required for the match,
            // but when the stylesheet does state them they are covered by this
            // utility and must not be reported separately.
            for (const [property, value] of group.optional || []) {
                const key = declarationKey(property, value);
                const entry = (byKey.get(key) || []).find((item) => !item.consumed && !claimed.includes(item));
                if (entry) claimed.push(entry);
            }

            for (const entry of claimed) entry.consumed = true;
            const viaAlternate = claimed.some((entry) => usedAlternate.has(entry));
            matches.push({
                utility: group.utility,
                quality: viaAlternate ? QUALITY.CONVERTED : QUALITY.EXACT,
                emits: [...group.declarations, ...(group.optional || [])],
                sources: claimed.map((entry) => entry.index),
                important: claimed.some((entry) => entry.important),
            });
        }

        /* --- tiers 2-6: one declaration at a time --- */
        for (const entry of pool) {
            if (entry.consumed) continue;

            const resolved = resolveSingle(entry);
            if (!resolved) {
                unconverted.push({ property: entry.property, value: entry.value });
                continue;
            }

            entry.consumed = true;
            matches.push({
                ...resolved,
                sources: [entry.index],
                important: entry.important,
            });
        }

        // `!important` is a trailing `!` on the utility in v4.
        for (const item of matches) {
            if (item.important) item.utility = `${item.utility}!`;
        }

        matches.sort((a, b) => Math.min(...a.sources) - Math.min(...b.sources));
        return { matches, unconverted };
    }

    return { match, settings };
}
