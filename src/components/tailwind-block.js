import React, { useCallback, useEffect, useState } from 'react';

/** Copy to clipboard, with a short confirmation. */
const CopyButton = ({ text }) => {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setCopied(false);
    }, [text]);

    useEffect(() => {
        if (!copied) return undefined;
        const timer = setTimeout(() => setCopied(false), 1600);
        return () => clearTimeout(timer);
    }, [copied]);

    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch {
            // Clipboard access can be denied; the text is selectable either way.
            setCopied(false);
        }
    }, [text]);

    return (
        <button
            type="button"
            onClick={copy}
            aria-label={copied ? 'Copied' : 'Copy classes'}
            className={`shrink-0 rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-widest transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 ${
                copied
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
            }`}
        >
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
};

export default React.memo(CopyButton);
