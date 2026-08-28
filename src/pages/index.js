import React, { useMemo, useState } from 'react';
import Editor from '../components/editor';
import Output, { hasReviewableMatches } from '../components/output';
import Settings from '../components/settings';
import ExamplesMenu from '../components/examples-menu';
import examples from '../data/examples.mjs';
import { convertCss, DEFAULT_SETTINGS } from '../core/convert.mjs';
import tailwindMap from '../generated/tailwind-map.json';
import siteMetadata from '../site-metadata';
import '../style.css';

const INITIAL_SETTINGS = { ...DEFAULT_SETTINGS, sortClasses: true };

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
        <main className="flex h-full w-full flex-col overflow-hidden bg-white text-slate-900 lg:flex-row">
            {/* The visible interface is a two-column tool with no room for a
                banner heading, but the page still needs one heading that says
                what it is. The old markup had no h1 at all. */}
            <h1 className="sr-only">{siteMetadata.tagline}</h1>

            <section className="h-1/2 w-full lg:h-full lg:w-5/12" aria-label="CSS input">
                <Editor value={css} onChange={setCss} />
            </section>

            <section className="flex h-1/2 w-full min-w-0 flex-col lg:h-full lg:w-7/12" aria-label="Tailwind output">
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
    );
};

export default IndexPage;

/**
 * Reproduces every tag the previous react-helmet `SEO` component emitted,
 * including the `%s | TailwindCSS Converter` title shape, and adds the
 * canonical and og:url it never had.
 */
const pageTitle = `${siteMetadata.tagline} | ${siteMetadata.title}`;
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
    </>
);
