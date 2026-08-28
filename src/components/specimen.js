import React from 'react';
import { MAX_BAR_PX } from '../core/preview.mjs';

/**
 * The demo elements a comparison row is drawn on.
 *
 * Each kind is a neutral, fixed base with the one declaration under discussion
 * applied on top, so the only visible difference between the pair is the value
 * being compared. Everything else about the two specimens is identical by
 * construction.
 */

const Specimen = ({ preview, label }) => {
    switch (preview.kind) {
        case 'box':
            // A filled tile carrying the declaration — radius, shadow, border
            // thickness and opacity all read clearly at this size.
            return (
                <span
                    aria-hidden="true"
                    className="inline-block size-8 shrink-0 border-slate-500 bg-slate-300"
                    style={{ borderStyle: 'solid', borderWidth: 0, outlineStyle: 'solid', ...preview.style }}
                />
            );

        case 'text':
            return (
                <span
                    aria-hidden="true"
                    className="inline-block max-w-full truncate leading-none text-slate-700"
                    style={preview.style}
                >
                    Ag
                </span>
            );

        case 'bar':
            // Length shown as length. Clipped bars get a ragged end so a
            // truncated bar is never mistaken for the real measurement.
            return (
                <span aria-hidden="true" className="inline-flex items-center gap-1">
                    <span
                        className="inline-block h-2 shrink-0 rounded-xs bg-slate-400"
                        style={{ ...preview.style, maxWidth: `${MAX_BAR_PX}px` }}
                    />
                    {preview.clipped && <span className="text-[10px] text-slate-400">…</span>}
                    {label && <span className="text-[10px] tabular-nums text-slate-400">{label}</span>}
                </span>
            );

        default:
            return null;
    }
};

export default Specimen;
