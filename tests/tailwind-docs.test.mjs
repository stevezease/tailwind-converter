/**
 * The converter links every property it explains to tailwindcss.com, so a
 * wrong slug here is a 404 for a reader who is already unsure what the class
 * did. These tests pin the folds, and check the whole map against the
 * generated page list so a Tailwind release that renames or retires a page
 * fails here rather than in front of someone.
 */

import { describe, it, expect } from 'vitest';
import {
    DOCS_INDEX_URL,
    docsSlugFor,
    docsSummaryFor,
    docsUrlFor,
} from '../src/data/tailwind-docs.mjs';
import { pages } from '../src/generated/tailwind-docs-pages.json';
import catalog from '../src/data/property-catalog.mjs';
import map from '../src/generated/tailwind-map.json';

const PROPERTIES = Object.keys(map.propertyOrder);

/**
 * The restatement test, reproduced here so the verb-coverage test can tell a
 * sentence that was dropped on purpose from one dropped for want of a verb.
 */
function saysMoreThanItsName(property) {
    const sentence = pages[docsSlugFor(property)];
    if (!sentence) return false;
    const words = new Set(sentence.toLowerCase().match(/[a-z]+/g));
    const filler = ['utilities', 'for', 'to', 'the', 'a', 'an', 'of', 'in', 'css', 'element', 'elements', 's'];
    for (const word of filler) {
        words.delete(word);
    }
    for (const word of property.replace(/^-[a-z]+-/, '').split('-')) words.delete(word);
    // The opening verb is always left over; anything beyond it is content.
    return words.size > 1;
}

describe('docsSlugFor', () => {
    it('uses the property itself when the docs have a page by that name', () => {
        expect(docsSlugFor('border-radius')).toBe('border-radius');
        expect(docsSlugFor('display')).toBe('display');
    });

    it('folds longhands onto the page that documents the family', () => {
        expect(docsSlugFor('padding-top')).toBe('padding');
        expect(docsSlugFor('margin-inline-end')).toBe('margin');
        expect(docsSlugFor('border-bottom-left-radius')).toBe('border-radius');
        expect(docsSlugFor('border-inline-start-color')).toBe('border-color');
        expect(docsSlugFor('row-gap')).toBe('gap');
        expect(docsSlugFor('grid-column-start')).toBe('grid-column');
        expect(docsSlugFor('overflow-x')).toBe('overflow');
    });

    it('sends every offset to the one page Tailwind documents them on', () => {
        for (const property of ['top', 'right', 'bottom', 'left', 'inset', 'inset-inline-end']) {
            expect(docsSlugFor(property)).toBe('top-right-bottom-left');
        }
    });

    it('drops vendor prefixes', () => {
        expect(docsSlugFor('-webkit-user-select')).toBe('user-select');
        expect(docsSlugFor('-webkit-line-clamp')).toBe('line-clamp');
        expect(docsSlugFor('-webkit-font-smoothing')).toBe('font-smoothing');
        // Not just a prefix: the unprefixed spelling is nobody's page name.
        expect(docsSlugFor('-moz-osx-font-smoothing')).toBe('font-smoothing');
        expect(docsSlugFor('-webkit-box-orient')).toBe('line-clamp');
    });

    it('links nowhere rather than somewhere wrong', () => {
        expect(docsSlugFor('clip-path')).toBeNull();
        expect(docsUrlFor('clip-path')).toBeNull();
    });

    it('only ever names a page that exists', () => {
        const slugs = new Set(Object.keys(pages));
        const invented = PROPERTIES.map(docsSlugFor).filter(
            (slug) => slug !== null && !slugs.has(slug)
        );
        expect(invented).toEqual([]);
    });

    it('builds URLs under the documentation root', () => {
        expect(docsUrlFor('padding-top')).toBe(`${DOCS_INDEX_URL}/padding`);
    });
});

describe('docsSummaryFor', () => {
    it('rewrites the page opener into the verb it was hiding', () => {
        expect(docsSummaryFor('align-items')).toBe(
            "Controls how flex and grid items are positioned along a container's cross axis."
        );
        expect(docsSummaryFor('transition-behavior')).toBe(
            'Controls the behavior of CSS transitions.'
        );
    });

    it('drops a sentence that only says the property name back', () => {
        // "Utilities for controlling the border radius of an element", on a
        // card that is already showing `border-radius`.
        expect(docsSummaryFor('border-radius')).toBeNull();
        expect(docsSummaryFor('background-color')).toBeNull();
    });

    it('gives a longhand the summary of the family that documents it', () => {
        expect(docsSummaryFor('padding-inline')).toBe(docsSummaryFor('padding'));
        expect(docsSummaryFor('top')).toBe(docsSummaryFor('inset-block-end'));
    });

    it('never leaves the boilerplate opener in place', () => {
        const kept = PROPERTIES.map(docsSummaryFor).filter(Boolean);
        expect(kept.filter((sentence) => sentence.startsWith('Utilities'))).toEqual([]);
    });

    /**
     * Every page opens with one of a handful of verbs. A release that reaches
     * for a new one should surface here — where the fix is a word in the
     * table — rather than as a card that silently stopped saying anything.
     */
    it('knows the verb of every page it links', () => {
        const linked = PROPERTIES.filter(docsUrlFor);
        const speechless = linked.filter(
            (property) => !docsSummaryFor(property) && saysMoreThanItsName(property)
        );
        expect(speechless).toEqual([]);
    });

    it('stays short enough to read at a glance', () => {
        const kept = PROPERTIES.map(docsSummaryFor).filter(Boolean);
        expect(kept.filter((sentence) => sentence.length > 160)).toEqual([]);
    });

    it('says nothing for a property it cannot link', () => {
        expect(docsSummaryFor('clip-path')).toBeNull();
    });
});

describe('coverage', () => {
    /**
     * The properties Tailwind converts but does not document. Pinned rather
     * than merely counted: if a release starts documenting one, this list
     * should shrink deliberately, and if a fold silently stops resolving, the
     * list grows and says which property lost its page.
     */
    it('leaves only the properties the docs have no page for', () => {
        const unlinked = PROPERTIES.filter((property) => !docsUrlFor(property));
        expect(unlinked.sort()).toEqual(['clip-path', 'contain', 'container-type', 'transform-box']);
    });

    it('documents every property with a reference page of its own', () => {
        const unlinked = catalog
            .map((entry) => entry.property)
            .filter((property) => !docsUrlFor(property));
        expect(unlinked).toEqual([]);
    });
});
