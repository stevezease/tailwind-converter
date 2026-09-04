const path = require('path');
const fs = require('fs/promises');

const siteMetadata = require('./src/site-metadata');
const map = require('./src/generated/tailwind-map.json');

/**
 * CodeMirror 6 requires a DOM and cannot be evaluated during Gatsby's static
 * HTML pass, so it is replaced with an empty module there. The editor mounts
 * it only after hydration (see src/components/editor.js), and nothing else in
 * the build references it.
 *
 * The pattern covers `codemirror`, `@codemirror/*` and `@uiw/react-codemirror`.
 */
exports.onCreateWebpackConfig = ({ stage, loaders, actions }) => {
    if (stage !== 'build-html') return;

    actions.setWebpackConfig({
        module: {
            rules: [{ test: /codemirror/, use: loaders.null() }],
        },
    });
};

/**
 * The per-property reference pages, and the index that links them.
 *
 * The rows are computed here rather than in the template so they ship as page
 * data: the templates are static prose and a table, and pulling the 200KB+
 * conversion map into their bundles to recompute what the build already knows
 * would make every one of these pages carry the whole converter.
 *
 * `src/core/property-rows.mjs` and the catalogue are ESM, and this file is
 * CommonJS because Gatsby loads it that way, so they come in by dynamic
 * import rather than require.
 */
exports.createPages = async ({ actions }) => {
    const [{ referenceFor }, catalogModule] = await Promise.all([
        import('./src/core/property-rows.mjs'),
        import('./src/data/property-catalog.mjs'),
    ]);

    const catalog = catalogModule.default;
    const { slugFor, CATEGORY_ORDER } = catalogModule;

    const propertyTemplate = path.resolve('./src/templates/property.js');
    const indexTemplate = path.resolve('./src/templates/property-index.js');

    const entries = catalog.map((entry) => ({
        ...entry,
        ...referenceFor(entry.property, map),
        slug: slugFor(entry.property),
    }));

    for (const entry of entries) {
        actions.createPage({
            path: `/css/${entry.slug}/`,
            component: propertyTemplate,
            context: {
                property: entry.property,
                category: entry.category,
                blurb: entry.blurb,
                slug: entry.slug,
                rows: entry.rows,
                colorExamples: entry.colorExamples,
                spacingUtilities: entry.spacingUtilities,
                arbitraryPrefix: entry.arbitraryPrefix,
                // Same-category siblings, which is the link a reader on a
                // flexbox page actually wants. Capped because `Layout` has
                // sixteen members and a footer of sixteen links is a footer
                // nobody reads.
                related: entries
                    .filter(
                        (other) =>
                            other.category === entry.category &&
                            other.property !== entry.property,
                    )
                    .slice(0, 12)
                    .map((other) => ({ property: other.property, slug: other.slug })),
            },
        });
    }

    const groups = CATEGORY_ORDER.map((category) => ({
        category,
        entries: entries
            .filter((entry) => entry.category === category)
            .map((entry) => ({
                property: entry.property,
                slug: entry.slug,
                blurb: entry.blurb,
                count: entry.rows.length + entry.colorExamples.length,
            })),
    })).filter((group) => group.entries.length > 0);

    actions.createPage({
        path: '/css/',
        component: indexTemplate,
        context: { groups, total: entries.length },
    });
};

/**
 * robots.txt and sitemap.xml, written straight to the build output.
 *
 * gatsby-plugin-sitemap would do this, but it derives the URL list from a
 * GraphQL query over every page — including the 404 variants, which then have
 * to be filtered back out. The pages here are all created above, so the list
 * is already known and generating the two files by hand is both shorter and
 * exactly right.
 */
exports.onPostBuild = async ({ graphql }) => {
    const { data } = await graphql(`
        {
            allSitePage {
                nodes {
                    path
                }
            }
        }
    `);

    // Gatsby creates /404/ and /404.html as real pages; neither belongs in a
    // sitemap, and /dev-404-page/ only exists during `gatsby develop`.
    const paths = data.allSitePage.nodes
        .map((node) => node.path)
        .filter((pagePath) => !pagePath.includes('404'))
        .sort();

    const lastmod = new Date().toISOString().slice(0, 10);
    const urls = paths
        .map((pagePath) => {
            // The converter is the page worth crawling most often and the one
            // everything else links to; the reference pages only change when
            // Tailwind does.
            const priority = pagePath === '/' ? '1.0' : '0.7';
            return [
                '  <url>',
                `    <loc>${siteMetadata.siteUrl}${pagePath}</loc>`,
                `    <lastmod>${lastmod}</lastmod>`,
                `    <priority>${priority}</priority>`,
                '  </url>',
            ].join('\n');
        })
        .join('\n');

    await fs.writeFile(
        path.join('public', 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );

    await fs.writeFile(
        path.join('public', 'robots.txt'),
        [
            'User-agent: *',
            'Allow: /',
            '',
            `Sitemap: ${siteMetadata.siteUrl}/sitemap.xml`,
            '',
        ].join('\n'),
    );

    console.info(`wrote sitemap.xml with ${paths.length} URLs, and robots.txt`);
};
