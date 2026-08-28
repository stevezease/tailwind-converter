import React, { useCallback, useEffect, useRef, useState } from 'react';
import examples from '../data/examples.mjs';

/**
 * Picker for the curated stylesheets.
 *
 * A plain text button rather than an icon: it is the one control that tells a
 * newcomer there is something here to read, so it should say so.
 */
const ExamplesMenu = ({ onPick }) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const buttonRef = useRef(null);

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (!open) return undefined;

        const onPointerDown = (event) => {
            if (!containerRef.current?.contains(event.target)) close();
        };
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            close();
            buttonRef.current?.focus();
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, close]);

    const pick = (example) => {
        onPick(example.css);
        close();
        buttonRef.current?.focus();
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="menu"
                className="rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
            >
                Examples
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-sm border border-slate-300 bg-white shadow-lg"
                >
                    {examples.map((example) => (
                        <button
                            key={example.id}
                            type="button"
                            role="menuitem"
                            onClick={() => pick(example)}
                            className="block w-full border-b border-slate-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-hidden"
                        >
                            <span className="block text-[13px] font-semibold text-slate-800">
                                {example.name}
                            </span>
                            <span className="block text-[11px] leading-snug text-slate-500">
                                {example.summary}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ExamplesMenu;
