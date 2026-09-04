import React from 'react';
import siteMetadata from '../site-metadata';
import '../style.css';

const NotFoundPage = () => (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-white text-slate-900">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <a className="text-teal-700 underline underline-offset-4" href="/">
            Back to the converter
        </a>
    </main>
);

export default NotFoundPage;

export const Head = () => (
    <>
        <html lang="en" />
        <title>Page not found | {siteMetadata.title}</title>
        {/* A 404 has nothing worth indexing, and Netlify serves it for any
            unmatched path — including the starter's removed /page-2. */}
        <meta name="robots" content="noindex, follow" />
    </>
);
