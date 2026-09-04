import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { css as cssLanguage } from '@codemirror/lang-css';
import { formatCss } from '../core/format.mjs';


/** Wait for typing to settle before re-converting. */
function useDebounced(callback, delay) {
    const timer = useRef(null);
    return useCallback(
        (...args) => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => callback(...args), delay);
        },
        [callback, delay]
    );
}

const Editor = ({ value, onChange }) => {
    // CodeMirror 6 needs a DOM, so it cannot render during Gatsby's static
    // HTML pass. Mounting it after hydration keeps the server and first client
    // render identical.
    const [mounted, setMounted] = useState(false);

    // CodeMirror is stubbed out during Gatsby's static HTML pass (see
    // gatsby-node.js), so `cssLanguage` does not exist there. Building the
    // extension list only after mount keeps SSR from calling it.
    const extensions = useMemo(() => (mounted ? [cssLanguage()] : []), [mounted]);

    useEffect(() => setMounted(true), []);

    const debouncedOnChange = useDebounced(onChange, 250);

    /* The last text CodeMirror reported, before the debounce.
       Conversion can lag a keystroke or two, but an action taken *on* the text
       cannot: reading the `value` prop inside Tidy would format whatever was
       there up to 250ms ago and silently discard anything typed since. */
    const latestText = useRef(value);
    useEffect(() => {
        latestText.current = value;
    }, [value]);

    // Typing is debounced so a long stylesheet is not reconverted per
    // keystroke; loading an example replaces `value` outright and converts on
    // the spot, since there is nothing to settle.
    const handleChange = useCallback(
        (next) => {
            latestText.current = next;
            debouncedOnChange(next);
        },
        [debouncedOnChange]
    );

    const tidy = useCallback(() => {
        // Unparseable CSS is returned untouched; the conversion panel already
        // reports the syntax error.
        onChange(formatCss(latestText.current));
    }, [onChange]);

    return (
        <div className="relative h-full w-full min-w-0 border-r border-slate-800 bg-slate-900">
            <div className="flex h-10 items-center justify-between border-b border-slate-800 px-3">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    CSS
                </span>
                <button
                    type="button"
                    onClick={tidy}
                    className="rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                    Tidy
                </button>
            </div>
            <div className="h-[calc(100%-37px)] overflow-hidden">
                {mounted ? (
                    <CodeMirror
                        value={value}
                        height="100%"
                        theme="dark"
                        extensions={extensions}
                        onChange={handleChange}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: false,
                            highlightActiveLine: false,
                        }}
                    />
                ) : (
                    <pre className="h-full overflow-auto p-3 font-mono text-[13px] leading-relaxed text-slate-400">
                        {value}
                    </pre>
                )}
            </div>
        </div>
    );
};

export default Editor;
