import React from 'react';
import { Link } from 'gatsby';
import PageShell from '../components/page-shell';
import StructuredData from '../components/structured-data';
import Blurb from '../components/blurb';
import siteMetadata from '../site-metadata';
import '../style.css';

/**
 * The hub for the per-property reference pages.
 *
 * Grouped by category rather than listed alphabetically: someone who knows
 * they want the flexbox page but not which property it is can find it here,
 * and an A-Z of 110 monospaced names is unreadable either way.
 */
const PropertyIndexTemplate = ({ pageContext }) => {
    const { groups, total } = pageContext;

    return (
        <PageShell>
            <h1 className="text-3xl font-semibold tracking-tight">CSS properties in Tailwind</h1>
            <p className="mt-4 text-base leading-relaxed text-slate-700">
                {total} CSS properties, each with every value that has a Tailwind class, read out
                of Tailwind v{siteMetadata.tailwindVersion} at build time. Use these to check a
                single property, or{' '}
                <Link to="/" className="text-teal-700 underline underline-offset-4">
                    paste a whole stylesheet into the converter
                </Link>
                .
            </p>

            {groups.map((group) => (
                <section key={group.category} className="mt-10">
                    <h2 className="text-lg font-semibold tracking-tight">{group.category}</h2>
                    <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-200">
                        {group.entries.map((entry) => (
                            <li key={entry.slug} className="py-2.5">
                                <Link
                                    to={`/css/${entry.slug}/`}
                                    className="font-mono text-[13px] font-semibold text-teal-700 underline underline-offset-4"
                                >
                                    {entry.property}
                                </Link>
                                <span className="ml-2 text-[11px] tabular-nums text-slate-400">
                                    {entry.count} {entry.count === 1 ? 'class' : 'classes'}
                                </span>
                                <Blurb
                                    text={entry.blurb}
                                    className="mt-0.5 block text-sm leading-relaxed text-slate-600"
                                />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </PageShell>
    );
};

export default PropertyIndexTemplate;

export const Head = ({ pageContext }) => {
    const { groups, total } = pageContext;
    const title = `CSS properties in Tailwind — ${siteMetadata.titleSuffix}`;
    const url = `${siteMetadata.siteUrl}/css/`;
    const description = `${total} CSS properties and the Tailwind classes for each of their values, generated from Tailwind v${siteMetadata.tailwindVersion}.`;

    return (
        <>
            <html lang="en" />
            <title>{title}</title>
            <link rel="canonical" href={url} />
            <meta name="description" content={description} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:type" content="website" />
            <meta property="og:url" content={url} />
            <meta name="twitter:card" content="summary" />
            <meta name="twitter:creator" content={siteMetadata.author} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <StructuredData
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'CollectionPage',
                    name: 'CSS properties in Tailwind',
                    url,
                    description,
                    isPartOf: {
                        '@type': 'WebSite',
                        name: siteMetadata.title,
                        url: siteMetadata.siteUrl,
                    },
                    hasPart: groups.flatMap((group) =>
                        group.entries.map((entry) => ({
                            '@type': 'TechArticle',
                            name: `${entry.property} to Tailwind`,
                            url: `${siteMetadata.siteUrl}/css/${entry.slug}/`,
                        })),
                    ),
                }}
            />
        </>
    );
};
