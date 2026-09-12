/**
 * Shared by gatsby-config (CommonJS) and the Head export in each page.
 *
 * Gatsby's Head API runs outside React context, so it cannot use
 * `useStaticQuery`. Keeping the metadata in a plain module lets both sides
 * read the same values without a GraphQL round trip.
 */

const map = require('./generated/tailwind-map.json');

/**
 * Major version only. The map's full version moves on every Tailwind patch,
 * and a <title> that changes weekly is a title with no history — but the major
 * is the part that actually distinguishes this converter from the ones still
 * answering with v3 class names, so it earns its place in the tag.
 */
const tailwindMajor = map.tailwindVersion.split('.')[0];

module.exports = {
    title: `TailwindCSS Converter`,

    /**
     * The phrase the site is actually found by, and the reason it leads the
     * <title> rather than trailing it. The brand name used to trail it as
     * "| TailwindCSS Converter", which restated the same three words; the
     * version says something the first half does not.
     */
    tagline: `CSS to Tailwind Converter`,

    titleSuffix: `Tailwind v${tailwindMajor}`,

    /**
     * The name Google already prints above the result, inferred from the
     * domain. Declaring it makes the displayed name a decision rather than a
     * guess, and gives a link unfurl something better than a hostname.
     */
    siteName: `Tailwind Converter`,

    /**
     * Written to the ~155 characters a result actually shows, and spent on the
     * interaction rather than on the implementation. Someone searching for a
     * converter wants to know they can paste and be done; that the map is
     * generated from the installed Tailwind is the better engineering story
     * but answers a worry they do not have yet. It keeps its place in the
     * <title> as the version, and in the prose for whoever reads that far.
     */
    description: `Paste CSS on the left, copy Tailwind v${tailwindMajor} classes on the right. Converts as you type — no account, no install, nothing uploaded.`,

    author: `@StevenJin`,
    siteUrl: `https://tailwind-converter.netlify.app`,
    tailwindVersion: map.tailwindVersion,
    tailwindMajor,
    spacingBase: map.spacingBase,
};
