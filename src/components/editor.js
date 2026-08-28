import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { css as cssLanguage } from '@codemirror/lang-css';
import { formatCss } from '../core/format.mjs';

const SAMPLE_CSS = `/* Paste CSS here */

.card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #1f2937;
}

.card:hover {
  background-color: #f3f4f6;
}

@media (min-width: 768px) {
  .card {
    padding: 32px;
  }
}
`;

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

const Editor = ({ onChange }) => {
    const [value, setValue] = useState(SAMPLE_CSS);
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

    const handleChange = useCallback(
        (next) => {
            setValue(next);
            debouncedOnChange(next);
        },
        [debouncedOnChange]
    );

    const tidy = useCallback(() => {
        setValue((current) => {
            // Unparseable CSS is returned untouched; the conversion panel
            // already reports the syntax error.
            const formatted = formatCss(current);
            onChange(formatted);
            return formatted;
        });
    }, [onChange]);

    // Convert the sample once on mount so the panel is never empty.
    useEffect(() => {
        onChange(SAMPLE_CSS);
        // Deliberately runs only on mount; later edits come through handleChange.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="relative h-full w-full min-w-0 border-r border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
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
