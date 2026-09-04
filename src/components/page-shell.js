import React from 'react';
import { Link } from 'gatsby';
import siteMetadata from '../site-metadata';

/**
 * Chrome for the prose pages.
 *
 * The converter itself is deliberately chrome-free — it is a two-pane tool and
 * a nav bar would eat a pane — but the reference pages are documents, and a
 * document that a search engine dropped someone into needs a way back to the
 * thing it is documenting. Hence a header on these pages and not on that one.
 */
const PageShell = ({ children }) => (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
        <header className="border-b border-slate-200">
            <div className="mx-auto flex max-w-3xl items-baseline justify-between px-5 py-3">
                <Link
                    to="/"
                    className="text-sm font-semibold text-slate-900 hover:text-teal-700"
                >
                    {siteMetadata.tagline}
                </Link>
                <nav className="flex items-center gap-4 text-[11px] uppercase tracking-widest text-slate-500">
                    <Link to="/css/" className="hover:text-teal-700">
                        Properties
                    </Link>
                    <span className="tabular-nums">Tailwind v{siteMetadata.tailwindVersion}</span>
                </nav>
            </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">{children}</main>

        <footer className="border-t border-slate-200">
            <div className="mx-auto max-w-3xl px-5 py-6 text-xs text-slate-500">
                Generated from Tailwind v{siteMetadata.tailwindVersion}.{' '}
                <Link to="/" className="text-teal-700 underline underline-offset-4">
                    Convert your own CSS
                </Link>
                .
            </div>
        </footer>
    </div>
);

export default PageShell;
