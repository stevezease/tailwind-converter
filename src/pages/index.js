import React, { useMemo, useState } from 'react';
import { Link } from 'gatsby';
import Editor from '../components/editor';
import Output, { hasReviewableMatches } from '../components/output';
import Settings from '../components/settings';
import ExamplesMenu from '../components/examples-menu';
import StructuredData from '../components/structured-data';
import examples from '../data/examples.mjs';
import faqFor from '../data/faq.mjs';
import { convertCss, DEFAULT_SETTINGS } from '../core/convert.mjs';
import tailwindMap from '../generated/tailwind-map.json';
import siteMetadata from '../site-metadata';
import '../style.css';

const INITIAL_SETTINGS = { ...DEFAULT_SETTINGS, sortClasses: true };

const faq = faqFor(tailwindMap.tailwindVersion);

/**
 * The properties linked from the homepage.
 *
 * A short hand-picked list rather than all 110: this is the "start here" set,
 * and a wall of links below the tool would be a sitemap pretending to be
 * content. The full list lives on /css/.
 */
const POPULAR = [
    'display',
    'padding',
    'margin',
    'width',
    'font-size',
    'color',
    'background-color',
    'border-radius',
    'box-shadow',
    'flex-direction',
    'gap',
    'grid-template-columns',
    'position',
    'z-index',
    'transform',
    'transition-duration',
];

const IndexPage = () => {
    // The page owns the stylesheet so the examples menu and the editor are
    // writing to the same place.
    const [css, setCss] = useState(examples[0].css);
    const [settings, setSettings] = useState(INITIAL_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Conversion is pure, so it only needs to rerun when the CSS or a setting
    // changes — not on every render.
    const result = useMemo(() => convertCss(css, tailwindMap, settings), [css, settings]);

    const ruleCount = result.rules.length;
    // The key earns its place only when something in the output actually
    // warrants a look; a permanent legend is noise once the reader has learnt
    // it, and a key for a state that is not on screen is worse than none.
    const showKey = hasReviewableMatches(result, settings);

    return (
        <>
            {/* `h-screen` rather than `h-full`: the tool still owns exactly one
                viewport, but the document now continues past it, so the height
                has to come from the viewport rather than from a locked body. */}
            <main className="flex h-screen w-full flex-col overflow-hidden bg-white text-slate-900 lg:flex-row">
                {/* The visible interface is a two-column tool with no room for a
                    banner heading, but the page still needs one heading that says
                    what it is. The old markup had no h1 at all. */}
                <h1 className="sr-only">{siteMetadata.tagline}</h1>

                <section className="h-1/2 w-full lg:h-full lg:w-5/12" aria-label="CSS input">
                    <Editor value={css} onChange={setCss} />
                </section>

                <section
                    className="flex h-1/2 w-full min-w-0 flex-col lg:h-full lg:w-7/12"
                    aria-label="Tailwind output"
                >
                    <header className="flex items-baseline justify-between border-b border-slate-200 px-4 py-2">
                        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                            Tailwind
                        </h2>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            {showKey && (
                                <span className="text-amber-700">
                                    <span
                                        aria-hidden="true"
                                        className="mr-1 inline-block h-2 w-4 rounded-xs bg-amber-50 underline decoration-amber-400 decoration-wavy align-middle"
                                    />
                                    worth checking
                                </span>
                            )}
                            <span className="tabular-nums">
                                {ruleCount} CSS {ruleCount === 1 ? 'rule' : 'rules'} · Tailwind v
                                {tailwindMap.tailwindVersion}
                            </span>
                            <ExamplesMenu onPick={setCss} />
                        </div>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <Output result={result} settings={settings} />
                    </div>

                    <Settings
                        settings={settings}
                        onChange={setSettings}
                        open={settingsOpen}
                        onToggle={() => setSettingsOpen((value) => !value)}
                    />
                </section>
            </main>

            {/* Everything below the fold is for the reader who arrived from a
                search and wants to know what this is before pasting into it.
                It is deliberately after the tool: someone who already knows
                never has to scroll past prose to reach the thing they came for. */}
            <div className="border-t border-slate-200 bg-white text-slate-900">
                <div className="mx-auto max-w-3xl px-5 py-12">
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Converting CSS to Tailwind
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-slate-700">
                        Paste a stylesheet on the left and each rule comes back as the Tailwind
                        classes that reproduce it. Shorthands are expanded before matching, so a
                        four-value <span className="font-mono text-[13px]">padding</span> becomes
                        the right combination of side classes rather than failing outright.
                        Min-width media queries become breakpoint prefixes, and pseudo-classes
                        become the matching variant.
                    </p>
                    <p className="mt-3 text-base leading-relaxed text-slate-700">
                        The conversion table is generated from Tailwind v
                        {tailwindMap.tailwindVersion} itself, at build time, rather than
                        maintained by hand. That is the whole design: a hand-written mapping drifts
                        the moment Tailwind ships a release, and a converter that answers with
                        class names your Tailwind no longer has is worse than no converter. Nothing
                        is uploaded — the conversion runs in your browser.
                    </p>
                    <p className="mt-3 text-base leading-relaxed text-slate-700">
                        Where CSS has no Tailwind equivalent, the output says so instead of
                        quietly dropping it. Off-scale values become arbitrary values in square
                        brackets, and rules that utilities genuinely cannot express — a descendant
                        selector, say — are flagged with the reason.
                    </p>

                    <h2 className="mt-10 text-2xl font-semibold tracking-tight">
                        Look up a single property
                    </h2>
                    <p className="mt-3 text-base leading-relaxed text-slate-700">
                        Every value and its class, for one property at a time:
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                        {POPULAR.map((property) => (
                            <li key={property}>
                                <Link
                                    to={`/css/${property}-to-tailwind/`}
                                    className="font-mono text-[13px] text-teal-700 underline underline-offset-4"
                                >
                                    {property}
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-4 text-sm">
                        <Link
                            to="/css/"
                            className="font-semibold text-teal-700 underline underline-offset-4"
                        >
                            All CSS properties
                        </Link>
                    </p>

                    <h2 className="mt-10 text-2xl font-semibold tracking-tight">
                        Common questions
                    </h2>
                    <dl className="mt-4 space-y-5">
                        {faq.map((entry) => (
                            <div key={entry.question}>
                                <dt className="text-base font-semibold">{entry.question}</dt>
                                <dd className="mt-1 text-base leading-relaxed text-slate-700">
                                    {entry.answer}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </>
    );
};

export default IndexPage;

/**
 * Reproduces every tag the previous react-helmet `SEO` component emitted, and
 * adds the canonical and og:url it never had.
 *
 * The title used to read "Convert CSS to Tailwind | TailwindCSS Converter",
 * whose second half restated the first in different words. The version is the
 * thing worth spending those characters on instead.
 */
const pageTitle = `${siteMetadata.tagline} — ${siteMetadata.titleSuffix}`;
const pageUrl = `${siteMetadata.siteUrl}/`;

export const Head = () => (
    <>
        <html lang="en" />
        <title>{pageTitle}</title>
        <link rel="canonical" href={pageUrl} />
        <meta name="description" content={siteMetadata.description} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={siteMetadata.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:creator" content={siteMetadata.author} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={siteMetadata.description} />
        <meta
            name="google-site-verification"
            content="MiBwrqoOFZRpmJ4Ar52jHqGy91bRDEdXqFiUZS9pxB8"
        />
        <StructuredData
            data={{
                '@context': 'https://schema.org',
                '@type': 'WebApplication',
                name: siteMetadata.tagline,
                url: pageUrl,
                applicationCategory: 'DeveloperApplication',
                operatingSystem: 'Any',
                browserRequirements: 'Requires JavaScript',
                description: siteMetadata.description,
                author: { '@type': 'Person', name: 'Steven Jin' },
                softwareVersion: siteMetadata.tailwindVersion,
                // The tool is free and needs no account. Stating that as a zero
                // price is what lets a result carry it; the copy alone cannot.
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            }}
        />
        <StructuredData
            data={{
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: faq.map((entry) => ({
                    '@type': 'Question',
                    name: entry.question,
                    acceptedAnswer: { '@type': 'Answer', text: entry.answer },
                })),
            }}
        />
    </>
);
