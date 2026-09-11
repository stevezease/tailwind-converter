#!/usr/bin/env node
/**
 * Record the pages of the Tailwind documentation, and what each one covers.
 *
 * The card in the converter links every property it shows to the page that
 * documents it on tailwindcss.com, and says in a line what that family of
 * utilities is for. Neither can be derived: `border-radius` has a page,
 * `clip-path` does not, and a guessed slug is a 404 in the reader's face.
 *
 * The summaries are the pages' own meta descriptions — Tailwind describing
 * its own utilities, which is the point of linking there rather than
 * paraphrasing it here.
 *
 * The docs navigation lists every page on every page, so one request gives
 * the list and one request per page gives the rest. Unlike `build:map`, this
 * is not part of `prebuild`: it needs the network, and the answer changes
 * when Tailwind ships docs, not when this repository builds. Run it by hand
 * after a Tailwind upgrade:
 *
 *     npm run build:docs-pages
 *
 * Output: src/generated/tailwind-docs-pages.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { tailwindVersion } from './design-system.mjs';

const SOURCE_URL = 'https://tailwindcss.com/docs/border-radius';
const OUTPUT_PATH = path.resolve('src/generated/tailwind-docs-pages.json');

/** How many pages to have in flight at once. Politeness, not throughput. */
const CONCURRENCY = 6;

/** Every `/docs/<slug>` the navigation links to, deduped and sorted. */
function slugsFrom(html) {
    const slugs = new Set();
    for (const [, slug] of html.matchAll(/"\/docs\/([a-z0-9-]+)"/g)) slugs.add(slug);
    return [...slugs].sort();
}

/** The handful of entities that show up in a sentence of prose. */
function decodeEntities(text) {
    return text
        .replace(/&#x27;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#x2F;/g, '/')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');
}

/** A page's own one-line summary of what its utilities do. */
function summaryFrom(html) {
    const match = html.match(/<meta name="description" content="([^"]*)"/);
    return match ? decodeEntities(match[1]).trim() : null;
}

/** Run `work` over `items`, a few at a time. */
async function mapWithLimit(items, work) {
    const results = new Array(items.length);
    let next = 0;

    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await work(items[index]);
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return results;
}

async function fetchPage(slug) {
    const response = await fetch(`https://tailwindcss.com/docs/${slug}`);
    if (!response.ok) throw new Error(`/docs/${slug} responded ${response.status}`);
    return summaryFrom(await response.text());
}

const response = await fetch(SOURCE_URL);
if (!response.ok) {
    throw new Error(`${SOURCE_URL} responded ${response.status}`);
}

const slugs = slugsFrom(await response.text());

// A page that lost its navigation, or a redirect to somewhere unexpected,
// would otherwise be written out as an empty list and silently unlink every
// property in the UI.
if (slugs.length < 100) {
    throw new Error(`Found only ${slugs.length} docs pages; the page layout has probably changed`);
}

const summaries = await mapWithLimit(slugs, fetchPage);

const pages = {};
slugs.forEach((slug, index) => {
    pages[slug] = summaries[index];
});

const described = Object.values(pages).filter(Boolean).length;

fs.writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify({ source: SOURCE_URL, tailwindVersion: tailwindVersion(), pages }, null, 4)}\n`
);

console.log(
    `Wrote ${slugs.length} documentation pages (${described} with a summary) to ` +
        path.relative('.', OUTPUT_PATH)
);
