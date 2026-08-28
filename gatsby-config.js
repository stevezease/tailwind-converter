const siteMetadata = require('./src/site-metadata');

module.exports = {
    siteMetadata,
    plugins: [
        {
            resolve: `gatsby-plugin-postcss`,
            options: {
                postCssPlugins: [require('@tailwindcss/postcss')],
            },
        },
        {
            resolve: `gatsby-plugin-manifest`,
            options: {
                name: siteMetadata.title,
                short_name: `TW Converter`,
                start_url: `/`,
                background_color: `#0f172a`,
                theme_color: `#0f172a`,
                display: `minimal-ui`,
                icon: `src/images/tailwind.png`,
            },
        },
    ],
};
