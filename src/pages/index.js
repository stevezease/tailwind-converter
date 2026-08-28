import React, { useMemo, useState } from 'react';
import Editor from '../components/editor';
import Output from '../components/output';
import Settings from '../components/settings';
import { convertCss, DEFAULT_SETTINGS } from '../core/convert.mjs';
import tailwindMap from '../generated/tailwind-map.json';
import siteMetadata from '../site-metadata';
import '../style.css';

const INITIAL_SETTINGS = { ...DEFAULT_SETTINGS, sortClasses: true };

const IndexPage = () => {
    const [css, setCss] = useState('');
    const [settings, setSettings] = useState(INITIAL_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Conversion is pure, so it only needs to rerun when the CSS or a setting
    // changes — not on every render.
    const result = useMemo(() => convertCss(css, tailwindMap, settings), [css, settings]);

    const ruleCount = result.rules.length;

    return (
        <main className="flex h-full w-full flex-col overflow-hidden bg-white text-slate-900 lg:flex-row">
            {/* The visible interface is a two-column tool with no room for a
                banner heading, but the page still needs one heading that says
                what it is. The old markup had no h1 at all. */}
            <h1 className="sr-only">{siteMetadata.tagline}</h1>

            <section className="h-1/2 w-full lg:h-full lg:w-5/12" aria-label="CSS input">
                <Editor onChange={setCss} />
            </section>

            <section className="flex h-1/2 w-full min-w-0 flex-col lg:h-full lg:w-7/12" aria-label="Tailwind output">
                <header className="flex items-baseline justify-between border-b border-slate-200 px-4 py-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                        Tailwind
                    </h2>
                    <p className="text-[11px] tabular-nums text-slate-400">
                        {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'} · v{tailwindMap.tailwindVersion}
                    </p>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <Output result={result} />
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
