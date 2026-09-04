/**
 * Turns the generated Tailwind map inside out.
 *
 * The converter reads the map declaration-first: given `padding: 12px`, find
 * the class. The reference pages need the opposite view — given `padding`,
 * list every value that maps to something — and nothing in the map is indexed
 * that way, so this module builds that index.
 *
 * Two sources have to be merged. `declarations` holds the one-property
 * utilities as flat `"prop:value" -> class` pairs. `groups` holds the
 * utilities that set several properties at once (`text-2xl` is font-size *and*
 * line-height, `truncate` is three properties), and those are exactly the
 * cases a reader is most likely to get wrong — so a row keeps the sibling
 * properties in `also` rather than quietly presenting the class as if it did
 * one thing.
 */

/** Declaration count at which a group stops being a mapping and starts being a recipe. */
const RECIPE_DECLARATION_COUNT = 5;

/**
 * Sorts values the way a reader scans them: numerically where they are
 * numbers, so 2px sits before 10px, and alphabetically otherwise. A plain
 * string sort puts "10px" before "2px", which makes a spacing table unreadable.
 */
const compareValues = (a, b) => {
    const na = Number.parseFloat(a);
    const nb = Number.parseFloat(b);
    const aNumeric = !Number.isNaN(na) && /^-?[\d.]/.test(a);
    const bNumeric = !Number.isNaN(nb) && /^-?[\d.]/.test(b);

    if (aNumeric && bNumeric && na !== nb) return na - nb;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a.localeCompare(b);
};

/**
 * Every value/class pair the map knows for one property.
 *
 * Returns rows of `{ value, utility, also }`, where `also` lists the other
 * properties a multi-property utility sets. A `(value, utility)` pair can be
 * reached from both sources; the first one wins so a group's `also` is not
 * lost to a later bare declaration.
 */
export const rowsForProperty = (property, map) => {
    const seen = new Map();

    for (const [key, utility] of Object.entries(map.declarations)) {
        const separator = key.indexOf(':');
        if (key.slice(0, separator) !== property) continue;

        const value = key.slice(separator + 1);
        const id = `${value} ${utility}`;
        if (!seen.has(id)) seen.set(id, { value, utility, also: [] });
    }

    for (const group of map.groups) {
        // `sr-only` and `not-sr-only` are recipes, not property mappings: they
        // set eight or nine unrelated declarations to achieve one effect, so
        // listing them as the class for `padding: 0` or `width: 1px` would be
        // actively misleading. They are the only two groups this large.
        if (group.declarations.length >= RECIPE_DECLARATION_COUNT) continue;

        const match = group.declarations.find(([name]) => name === property);
        if (!match) continue;

        const id = `${match[1]} ${group.utility}`;
        if (seen.has(id)) continue;

        seen.set(id, {
            value: match[1],
            utility: group.utility,
            also: group.declarations
                .map(([name]) => name)
                .filter((name) => name !== property),
        });
    }

    return [...seen.values()].sort(
        (a, b) => compareValues(a.value, b.value) || a.utility.localeCompare(b.utility),
    );
};

/**
 * A handful of palette rows for a colour property.
 *
 * Colours are not in `declarations` — the converter resolves them against the
 * palette at match time — so a colour page would otherwise show two keyword
 * rows and nothing else. These are worked examples of the naming pattern, not
 * the whole palette: repeating all 288 shades on each of the nineteen colour
 * properties would be the same table nineteen times.
 */
const PALETTE_SAMPLE = [
    'white',
    'black',
    'slate-100',
    'slate-500',
    'slate-900',
    'red-500',
    'emerald-500',
    'sky-500',
];

export const colorExamplesFor = (property, map) => {
    const prefix = map.colorUtilities[property];
    if (!prefix) return [];

    return PALETTE_SAMPLE.filter((name) => map.palette[name]).map((name) => ({
        value: map.palette[name],
        utility: `${prefix}-${name}`,
        also: [],
    }));
};

/**
 * The spacing utilities that write this property, e.g. `padding-top` -> `pt`.
 *
 * The map stores this the other way round (utility -> the properties it sets),
 * which is the direction the converter needs and the opposite of this one.
 */
export const spacingUtilitiesFor = (property, map) =>
    Object.entries(map.spacing)
        .filter(([, properties]) => properties.includes(property))
        .map(([utility]) => utility)
        .sort();

/** Everything one reference page needs, assembled in a single pass. */
export const referenceFor = (property, map) => ({
    property,
    rows: rowsForProperty(property, map),
    colorExamples: colorExamplesFor(property, map),
    spacingUtilities: spacingUtilitiesFor(property, map),
    arbitraryPrefix: map.arbitraryPrefixes[property] ?? null,
    supportsArbitrary: map.untypedSafe.includes(property),
});
