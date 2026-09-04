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

    description: `Paste your CSS and get v${tailwindMajor} Tailwind classes. Up to Date. No Sign Ups. No Install.`,

    author: `@StevenJin`,
    siteUrl: `https://tailwind-converter.netlify.app`,
    tailwindVersion: map.tailwindVersion,
    tailwindMajor,
    spacingBase: map.spacingBase,
};
