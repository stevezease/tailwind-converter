/**
 * Where a CSS property is documented on tailwindcss.com, and what that page
 * says the utilities are for.
 *
 * Tailwind's v4 documentation names its pages after the CSS property, so most
 * of this is the identity function against the list of pages that exist. Two
 * things it cannot be:
 *
 * - Not every property has a page. `clip-path`, `contain` and `container-type`
 *   convert fine but are documented nowhere, and a slug invented for them is a
 *   404 in the reader's face — so a property with no page links nowhere rather
 *   than somewhere wrong.
 * - The docs are written per utility family, not per longhand. `padding-top`
 *   belongs on the `padding` page, every corner of `border-radius` on one
 *   page, and `top` / `inset-inline-end` on the page Tailwind calls
 *   `top-right-bottom-left`.
 *
 * The list of real pages is generated (`npm run build:docs-pages`); the folds
 * below are the hand-written part, and a test checks every one of them still
 * lands on a page that exists.
 */

import { pages } from '../generated/tailwind-docs-pages.json';

const PAGES = new Map(Object.entries(pages));

/** The documentation's front door, for when no single page applies. */
export const DOCS_INDEX_URL = 'https://tailwindcss.com/docs';

/**
 * The sides and axes Tailwind's per-side longhands are spelled with —
 * physical, logical, and the axis shorthands that sit between them.
 */
const SIDES = [
    'top',
    'right',
    'bottom',
    'left',
    'block',
    'inline',
    'block-start',
    'block-end',
    'inline-start',
    'inline-end',
];

const CORNERS = [
    'top-left',
    'top-right',
    'bottom-right',
    'bottom-left',
    'start-start',
    'start-end',
    'end-start',
    'end-end',
];

/** Longhands and aliases, mapped onto the page that documents them. */
const FOLDS = new Map([
    // Vendor spellings whose unprefixed name is not the page name.
    ['-moz-osx-font-smoothing', 'font-smoothing'],
    ['-webkit-box-orient', 'line-clamp'],

    ['column-gap', 'gap'],
    ['row-gap', 'gap'],
    ['overflow-x', 'overflow'],
    ['overflow-y', 'overflow'],
    ['overscroll-behavior-x', 'overscroll-behavior'],
    ['overscroll-behavior-y', 'overscroll-behavior'],
    ['grid-column-start', 'grid-column'],
    ['grid-column-end', 'grid-column'],
    ['grid-row-start', 'grid-row'],
    ['grid-row-end', 'grid-row'],
]);

const fold = (slug, properties) => {
    for (const property of properties) FOLDS.set(property, slug);
};

fold('margin', SIDES.map((side) => `margin-${side}`));
fold('padding', SIDES.map((side) => `padding-${side}`));
fold('scroll-margin', SIDES.map((side) => `scroll-margin-${side}`));
fold('scroll-padding', SIDES.map((side) => `scroll-padding-${side}`));
fold('border-color', SIDES.map((side) => `border-${side}-color`));
fold('border-width', SIDES.map((side) => `border-${side}-width`));
fold('border-radius', CORNERS.map((corner) => `border-${corner}-radius`));

// Offsets share one page, whichever side or axis they name.
fold('top-right-bottom-left', [
    'inset',
    'top',
    'right',
    'bottom',
    'left',
    ...SIDES.map((side) => `inset-${side}`),
]);

/** `-webkit-user-select` -> `user-select`; most prefixes are just noise. */
const unprefixed = (property) => property.replace(/^-(?:webkit|moz|ms|o)-/, '');

/**
 * The page slug for a property, or `null` when the docs have no page for it.
 */
export function docsSlugFor(property) {
    if (PAGES.has(property)) return property;

    const bare = unprefixed(property);
    if (PAGES.has(bare)) return bare;

    const folded = FOLDS.get(property) ?? FOLDS.get(bare);
    return folded && PAGES.has(folded) ? folded : null;
}

/** The documentation URL for a property, or `null` when it has no page. */
export function docsUrlFor(property) {
    const slug = docsSlugFor(property);
    return slug ? `${DOCS_INDEX_URL}/${slug}` : null;
}

/**
 * Every docs page opens the same way — "Utilities for controlling the border
 * radius of an element" — which is right for a page title and wrong for a
 * line in a card, where the words before the verb are the only ones that
 * differ. The opener is rewritten into the verb it was hiding: "Controls the
 * border radius of an element."
 *
 * Spelled out rather than derived, because turning a gerund into a verb is
 * not a rule English keeps (`setting` -> `sets`, `specifying` -> `specifies`,
 * `opting` -> `opts`). A release that reaches for a new verb fails the test
 * rather than printing something ungrammatical.
 */
const VERBS = new Map([
    ['control', 'Controls'],
    ['controlling', 'Controls'],
    ['applying', 'Applies'],
    ['setting', 'Sets'],
    ['styling', 'Styles'],
    ['specifying', 'Specifies'],
    ['selecting', 'Selects'],
    ['clamping', 'Clamps'],
    ['rotating', 'Rotates'],
    ['scaling', 'Scales'],
    ['skewing', 'Skews'],
    ['transforming', 'Transforms'],
    ['translating', 'Translates'],
    ['optimizing', 'Optimizes'],
    ['animating', 'Animates'],
    ['suppressing', 'Suppresses'],
    ['opting', 'Opts'],
]);

const OPENER = /^Utilities (?:for|to) ([a-z]+) /;

/** The words a description shares with every other description. */
const FILLER = new Set([
    'the',
    'a',
    'an',
    'of',
    'to',
    'in',
    'css',
    'element',
    'elements',
    // What "an element's" leaves behind once the apostrophe is dropped.
    's',
]);

/**
 * Whether a description does more than say the property name back.
 *
 * "Utilities for controlling the border radius of an element" on a card that
 * already shows `border-radius: 10px` is a line of text that teaches nothing,
 * and there are 34 of them. Strip the filler and the property's own words; if
 * nothing is left, the sentence was a restatement and the card is better
 * without it.
 */
function saysSomething(property, sentence) {
    const words = new Set(sentence.toLowerCase().match(/[a-z]+/g));
    for (const word of FILLER) words.delete(word);
    for (const word of property.replace(/^-[a-z]+-/, '').split('-')) words.delete(word);
    return words.size > 0;
}

/**
 * Tailwind's own line about what a property's utilities do, or `null` when
 * there is no page for it or nothing worth saying.
 *
 * The words are the docs page's own meta description, quoted rather than
 * rewritten apart from the opener: the card already explains what one class
 * did to one declaration, and what it cannot say is what the family is *for*.
 * Taking that from the page we link to keeps the two in step.
 */
export function docsSummaryFor(property) {
    const slug = docsSlugFor(property);
    const sentence = slug ? PAGES.get(slug) : null;
    if (!sentence) return null;

    const opener = sentence.match(OPENER);
    if (!opener) return null;

    const verb = VERBS.get(opener[1]);
    if (!verb) return null;

    const rest = sentence.slice(opener[0].length);
    return saysSomething(property, rest) ? `${verb} ${rest}` : null;
}
