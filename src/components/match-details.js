import React, { useCallback, useEffect, useRef, useState } from 'react';
import { explainMatch } from '../core/explain.mjs';
import { previewPairFor } from '../core/preview.mjs';
import Specimen from './specimen';
import map from '../generated/tailwind-map.json';
import { QUALITY } from '../core/convert.mjs';

const QUALITY_LABEL = {
    [QUALITY.EXACT]: 'exact',
    [QUALITY.CONVERTED]: 'unit converted',
    [QUALITY.ROUNDED]: 'rounded',
    [QUALITY.NEAREST_COLOR]: 'nearest colour',
    [QUALITY.ARBITRARY]: 'arbitrary value',
};

/** A colour chip, with a checkerboard behind it so alpha is visible. */
const Swatch = ({ swatch }) => (
    <span
        className="inline-block size-4 shrink-0 rounded-xs border border-black/15"
        style={{
            backgroundColor: swatch.css,
            backgroundImage:
                'linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%)',
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 4px 4px',
            boxShadow: `inset 0 0 0 999px ${swatch.css}`,
        }}
    />
);

const ValueCell = ({ value, swatch }) => (
    <div className="flex min-w-0 items-center gap-1.5">
        {swatch && <Swatch swatch={swatch} />}
        <span className="truncate font-mono text-[11px]">{swatch?.hex ?? value}</span>
    </div>
);

/**
 * The before/after specimens for one row, laid out on the same grid as the
 * values above them so each sits under its own number.
 */
const PreviewPair = ({ row, settings }) => {
    const pair = previewPairFor(row, settings);
    if (!pair) return null;

    return (
        <span className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
            <Specimen preview={pair.from} label={pair.kind === 'bar' ? row.from : null} />
            <span aria-hidden="true" className="text-transparent">
                →
            </span>
            <Specimen preview={pair.to} label={pair.kind === 'bar' ? row.to : null} />
        </span>
    );
};

/**
 * What the class emits, and — when that differs from what you wrote — what
 * changed.
 *
 * An exact match is shown as plain CSS rather than a two-column diff: a
 * `display: flex → flex` comparison of identical values is noise, and for
 * someone learning Tailwind the useful thing is simply *this class means this
 * declaration*.
 */
const Comparison = ({ detail, settings }) => {
    const changed = detail.rows.filter((row) => row.changed);

    if (changed.length === 0) {
        return (
            <span className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-widest text-slate-400">
                    Emits
                </span>
                {detail.rows.map((row) => (
                    <code key={row.property} className="block font-mono text-[11px] text-slate-700">
                        {row.property}: {row.to};
                    </code>
                ))}
            </span>
        );
    }

    return (
        <span className="block space-y-2">
            <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 text-[10px] uppercase tracking-widest text-slate-400">
                <span>Your CSS</span>
                <span aria-hidden="true" />
                <span>Tailwind emits</span>
            </span>

            {detail.rows.map((row) => (
                <span key={row.property} className="block space-y-0.5">
                    <span className="block font-mono text-[10px] text-slate-400">{row.property}</span>
                    <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                        <ValueCell value={row.from} swatch={row.fromSwatch} />
                        <span
                            aria-hidden="true"
                            className={row.changed ? 'text-amber-500' : 'text-slate-300'}
                        >
                            →
                        </span>
                        <ValueCell value={row.to} swatch={row.toSwatch} />
                    </span>

                    {/* Seeing the difference beats reading it. Drawn only
                        when the two values would actually render differently,
                        so a unit conversion does not get the same picture
                        twice. */}
                    <PreviewPair row={row} settings={settings} />

                    {row.kind === 'color' && row.changed && (
                        <span className="block text-[10px] text-slate-400">
                            Δ {row.distance.toFixed(4)} in OKLab — {row.band}
                        </span>
                    )}
                    {row.kind === 'length' && row.delta && (
                        <span className="block text-[10px] text-slate-400">
                            {row.delta.identical
                                ? `Same length — ${row.delta.fromPx}px either way`
                                : `${row.delta.fromPx}px → ${row.delta.toPx}px`}
                        </span>
                    )}
                </span>
            ))}
        </span>
    );
};

/** Declarations the utility brings along that the source never asked for. */
const AlsoSets = ({ added }) =>
    added.length === 0 ? null : (
        <span className="mt-2 block border-t border-slate-200 pt-2">
            <span className="mb-0.5 block text-[10px] uppercase tracking-widest text-slate-400">
                Also sets
            </span>
            {added.map((item) => (
                <code key={item.property} className="block font-mono text-[11px] text-slate-600">
                    {item.property}: {item.value};
                </code>
            ))}
        </span>
    );

/**
 * Hover card for one converted class.
 *
 * Opens on hover and on keyboard focus, and is positioned with `fixed`
 * coordinates measured from the trigger — the results panel scrolls and clips
 * its children, so an absolutely positioned card would be cut off.
 */
/**
 * Layout frame shared by every class pill, hoverable or not.
 *
 * It must be `inline-flex`, not `inline-block`. Inside the flex row of
 * classes this element is a flex item, so `inline-block` blockifies to
 * `block` and its height comes from the inherited line box — leaving the pill
 * inside it `inline`, where vertical padding does not contribute to layout.
 * That made hoverable pills render 4.5px shorter and 3.7px lower than plain
 * ones. As `inline-flex` the pill becomes a flex item itself, so its padding
 * applies and both paths line up.
 *
 * Exact matches use the same frame without the hover behaviour, so the DOM
 * shape is identical either way.
 */
export const PILL_FRAME = 'relative inline-flex items-center';

const MatchDetails = ({ match, declarations, variants, settings, children }) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);
    const triggerRef = useRef(null);

    const show = useCallback(() => {
        const element = triggerRef.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const width = 300;
        setPosition({
            // Keep the card on screen when the trigger sits near an edge.
            left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
            top: rect.bottom + 6,
            flip: rect.bottom + 200 > window.innerHeight,
            bottom: window.innerHeight - rect.top + 6,
            width,
        });
        setOpen(true);
    }, []);

    const hide = useCallback(() => setOpen(false), []);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') hide();
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', hide, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('scroll', hide, true);
        };
    }, [open, hide]);

    const detail = open ? explainMatch(match, declarations, { ...settings, map, variants }) : null;

    return (
        <span
            ref={triggerRef}
            className={PILL_FRAME}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
            tabIndex={0}
            role="button"
            aria-expanded={open}
            aria-label={`${match.className}: ${QUALITY_LABEL[match.quality]}. Show details.`}
        >
            {children}

            {open && detail && position && (
                <span
                    role="tooltip"
                    /* `select-none`: the card is a DOM descendant of the pill,
                       which sits inside the click-to-copy block. Without this,
                       drag-selecting the row while a card happens to be open
                       copies the card's entire contents along with the class
                       names. */
                    className="fixed z-50 block w-[300px] select-none overflow-hidden rounded-sm border border-slate-300 bg-white text-slate-700 shadow-lg"
                    style={{
                        left: position.left,
                        width: position.width,
                        ...(position.flip ? { bottom: position.bottom } : { top: position.top }),
                    }}
                >
                    {/* Anything that altered a value comes first. Whatever the
                        class means matters less than knowing it is not quite
                        what you wrote. */}
                    {detail.approximation && (
                        <span
                            className={`block px-3 py-2 text-[11px] leading-snug ${
                                detail.quality === QUALITY.NEAREST_COLOR ||
                                detail.quality === QUALITY.ROUNDED
                                    ? 'bg-amber-50 text-amber-900'
                                    : 'bg-slate-50 text-slate-600'
                            }`}
                        >
                            <span className="mr-1 font-semibold uppercase tracking-widest">
                                {QUALITY_LABEL[detail.quality]}
                            </span>
                            {detail.approximation.headline}
                        </span>
                    )}

                    <span className="block p-3">
                        <code
                            className={`block font-mono text-[13px] font-semibold text-slate-900 ${
                                detail.approximation ? 'mb-2' : ''
                            }`}
                        >
                            {detail.className}
                        </code>
                        {/* The banner above already carries this sentence for
                            anything approximate; repeating it here would say
                            the same thing twice. */}
                        {!detail.approximation && (
                            <span className="mb-2 block text-[11px] leading-snug text-slate-500">
                                {detail.headline}
                            </span>
                        )}

                        <Comparison detail={detail} settings={settings} />

                        <AlsoSets added={detail.added} />

                        {/* Why this class has this name. */}
                        {detail.derivation && (
                            <span className="mt-2 block border-t border-slate-200 pt-2">
                                <code className="block font-mono text-[11px] text-slate-700">
                                    {detail.derivation.text}
                                </code>
                                <span className="mt-0.5 block text-[10px] leading-snug text-slate-400">
                                    {detail.derivation.hint}
                                </span>
                            </span>
                        )}

                        {/* What each prefix compiles to, shown as CSS — the
                            fastest way to teach `md:` to someone who already
                            reads media queries. */}
                        {detail.variants.length > 0 && (
                            <span className="mt-2 block border-t border-slate-200 pt-2">
                                {detail.variants.map((variant) => (
                                    <span key={variant.name} className="mb-1 block last:mb-0">
                                        <code className="font-mono text-[11px] font-semibold text-slate-900">
                                            {variant.prefix}
                                        </code>{' '}
                                        <code className="font-mono text-[11px] text-slate-600">
                                            {variant.css}
                                        </code>
                                        {variant.note && (
                                            <span className="block text-[10px] text-slate-400">
                                                {variant.note}
                                            </span>
                                        )}
                                    </span>
                                ))}
                            </span>
                        )}
                    </span>
                </span>
            )}
        </span>
    );
};

export default MatchDetails;
