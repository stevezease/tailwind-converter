/**
 * Shared by gatsby-config (CommonJS) and the Head export in each page.
 *
 * Gatsby's Head API runs outside React context, so it cannot use
 * `useStaticQuery`. Keeping the metadata in a plain module lets both sides
 * read the same values without a GraphQL round trip.
 */
module.exports = {
    title: `TailwindCSS Converter`,

    /**
     * The phrase the site is actually found by, and the reason it leads the
     * <title> rather than trailing it. The previous react-helmet setup built
     * the same shape via `titleTemplate="%s | ${title}"`; this keeps that
     * wording so existing rankings and links stay pointed at the same page.
     */
    tagline: `Convert CSS to Tailwind`,

    description: `Convert CSS to Tailwind utility classes. Paste your CSS and get the equivalent Tailwind classes, generated from the installed Tailwind release.`,
    author: `@StevenJin`,
    siteUrl: `https://tailwind-converter.netlify.app`,
};
