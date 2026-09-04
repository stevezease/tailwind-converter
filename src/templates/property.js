import React from 'react';
import { Link } from 'gatsby';
import PageShell from '../components/page-shell';
import MappingTable from '../components/mapping-table';
import Blurb from '../components/blurb';
import { plainBlurb } from '../data/property-catalog.mjs';
import StructuredData from '../components/structured-data';
import siteMetadata from '../site-metadata';
import '../style.css';

/**
 * One CSS property, and every Tailwind class the generated map has for it.
 *
 * Everything on the page except the blurb is derived in `gatsby-node.js` from
 * the same map the converter runs on, so these pages cannot drift from the
 * tool's actual behaviour: if a Tailwind release renames a class, the next
 * build says so here too.
 */
const PropertyTemplate = ({ pageContext }) => {
    const {
        property,
        category,
        blurb,
        rows,
        colorExamples,
        spacingUtilities,
        arbitraryPrefix,
        related,
    } = pageContext;

    return (
        <PageShell>
            <p className="text-[11px] uppercase tracking-widest text-slate-500">{category}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                <span className="font-mono">{property}</span> to Tailwind
            </h1>

            <Blurb text={blurb} className="mt-4 block text-base leading-relaxed text-slate-700" />

            <p className="mt-3 text-base leading-relaxed text-slate-700">
                The {rows.length === 1 ? 'mapping' : `${rows.length} mappings`} below{' '}
                {rows.length === 1 ? 'is' : 'are'} read straight out of Tailwind v
                {siteMetadata.tailwindVersion}, not maintained by hand, so this is what the
                converter will actually produce for{' '}
                <span className="font-mono text-[13px]">{property}</span>.
            </p>

            <section className="mt-8">
                <h2 className="text-lg font-semibold tracking-tight">
                    <span className="font-mono">{property}</span> values and their classes
                </h2>
                <div className="mt-3">
                    <MappingTable property={property} rows={rows} />
                </div>
            </section>

            {colorExamples.length > 0 && (
                <section className="mt-10">
                    <h2 className="text-lg font-semibold tracking-tight">Colours</h2>
                    <p className="mt-2 text-base leading-relaxed text-slate-700">
                        Colour values are not a fixed list — the converter matches yours against
                        the Tailwind palette and picks the nearest name, so any of the palette's{' '}
                        shades works the same way. A few worked examples:
                    </p>
                    <div className="mt-3">
                        <MappingTable property={property} rows={colorExamples} />
                    </div>
                </section>
            )}

            {spacingUtilities.length > 0 && (
                <section className="mt-10">
                    <h2 className="text-lg font-semibold tracking-tight">The spacing scale</h2>
                    <p className="mt-2 text-base leading-relaxed text-slate-700">
                        <span className="font-mono text-[13px]">{property}</span> is written with{' '}
                        {spacingUtilities.map((utility, index) => (
                            <React.Fragment key={utility}>
                                {index > 0 && ' and '}
                                <span className="font-mono text-[13px] text-teal-800">
                                    {utility}-*
                                </span>
                            </React.Fragment>
                        ))}
                        , which counts in steps of {siteMetadata.spacingBase}. The step
                        number is the multiplier, so the class number is the value divided by that
                        step rather than a pixel count.
                    </p>
                </section>
            )}

            {arbitraryPrefix && (
                <section className="mt-10">
                    <h2 className="text-lg font-semibold tracking-tight">
                        Values that are not on the scale
                    </h2>
                    <p className="mt-2 text-base leading-relaxed text-slate-700">
                        Anything without a named class is written as an arbitrary value in square
                        brackets. The converter falls back to this rather than rounding your CSS to
                        the nearest class, because silently changing a value is worse than an ugly
                        class name.
                    </p>
                    <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 p-4 font-mono text-[13px] leading-relaxed text-slate-100">
                        {arbitraryPrefix}-[<span className="text-teal-300">your value</span>]
                    </pre>
                </section>
            )}

            {related.length > 0 && (
                <section className="mt-10 border-t border-slate-200 pt-6">
                    <h2 className="text-lg font-semibold tracking-tight">
                        Other {category.toLowerCase()} properties
                    </h2>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                        {related.map((entry) => (
                            <li key={entry.slug}>
                                <Link
                                    to={`/css/${entry.slug}/`}
                                    className="font-mono text-[13px] text-teal-700 underline underline-offset-4"
                                >
                                    {entry.property}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-base font-semibold tracking-tight">
                    Converting a whole stylesheet?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    Paste it into the converter and get every rule at once, shorthands expanded,
                    media queries turned into breakpoint variants, and the parts that have no
                    Tailwind equivalent flagged rather than dropped.
                </p>
                <Link
                    to="/"
                    className="mt-3 inline-block rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                    Open the converter
                </Link>
            </section>
        </PageShell>
    );
};

export default PropertyTemplate;

export const Head = ({ pageContext }) => {
    const { property, blurb, rows, slug } = pageContext;
    const title = `${property} to Tailwind — ${siteMetadata.titleSuffix}`;
    const url = `${siteMetadata.siteUrl}/css/${slug}/`;
    const description = `Every Tailwind class for the CSS ${property} property, generated from Tailwind v${siteMetadata.tailwindVersion}. ${rows.length} mappings, plus how to write values the scale does not cover.`;

    return (
        <>
            <html lang="en" />
            <title>{title}</title>
            <link rel="canonical" href={url} />
            <meta name="description" content={description} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:type" content="article" />
            <meta property="og:url" content={url} />
            <meta name="twitter:card" content="summary" />
            <meta name="twitter:creator" content={siteMetadata.author} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <StructuredData
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        {
                            '@type': 'ListItem',
                            position: 1,
                            name: siteMetadata.tagline,
                            item: `${siteMetadata.siteUrl}/`,
                        },
                        {
                            '@type': 'ListItem',
                            position: 2,
                            name: 'CSS properties',
                            item: `${siteMetadata.siteUrl}/css/`,
                        },
                        { '@type': 'ListItem', position: 3, name: `${property} to Tailwind` },
                    ],
                }}
            />
            <StructuredData
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'TechArticle',
                    headline: `${property} to Tailwind`,
                    description: plainBlurb(blurb),
                    url,
                    author: { '@type': 'Person', name: 'Steven Jin' },
                    about: { '@type': 'Thing', name: `CSS ${property}` },
                    isPartOf: {
                        '@type': 'WebSite',
                        name: siteMetadata.title,
                        url: siteMetadata.siteUrl,
                    },
                }}
            />
        </>
    );
};
