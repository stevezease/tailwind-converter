import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { explainMatch } from '../core/explain.mjs';
import { DOCS_INDEX_URL, docsSummaryFor, docsUrlFor } from '../data/tailwind-docs.mjs';
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

/**
 * Every link out of the card opens in a new tab.
 *
 * The card belongs to CSS the reader is in the middle of converting, and the
 * editor does not survive a navigation. Looking a property up should never
 * cost someone the thing they came to convert.
 *
 * The card also sits inside the click-to-copy row, whose handler is on an
 * ancestor div, so every link here has to stop its click from bubbling —
 * otherwise following it copies the rule on the way out.
 */
const REFERENCE_LINK_PROPS = {
    target: '_blank',
    rel: 'noreferrer',
    onClick: (event) => event.stopPropagation(),
};

/** The mark that says a link leaves for a tab of its own. */
const NewTabIcon = ({ className = '' }) => (
    <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`inline-block size-3.5 shrink-0 ${className}`}
    >
        <path d="M6.5 3H3.5v9.5H13V9.5" />
        <path d="M9.5 2.5H13V6" />
        <path d="M13 2.5 7.5 8" />
    </svg>
);

/** A property name in the card, linked to its Tailwind documentation. */
const PropertyLink = ({ property, className = '' }) => {
    const url = docsUrlFor(property);
    if (!url) return <span className={className}>{property}</span>;

    return (
        <a
            href={url}
            {...REFERENCE_LINK_PROPS}
            /* The footer says "new tab" in its own label; these are bare
               property names, so they have to say it themselves. */
            aria-label={`${property} Tailwind docs — opens in a new tab`}
            className={`${className} underline decoration-dotted underline-offset-2 hover:text-teal-700`}
        >
            {property}
        </a>
    );
};

/**
 * The way out of the card and into Tailwind's documentation.
 *
 * It sits on the title line, opposite the class name, because that line is
 * the first thing under the pill: the pointer is already there when the card
 * opens, and a target at the far end of a 250px card is one the pointer
 * overshoots on the way down. The property names in the body link to the same
 * pages, but they are 10px of inline text — fine to notice, poor to aim at.
 *
 * It follows the first property on the card that is documented, which is the
 * one the reader came for; when none is, the docs index is still somewhere to
 * land.
 */
/**
 * The property the card is really about: the first one Tailwind documents.
 *
 * A card can name several — `border` sets a width and a style — but they are
 * one utility's worth of the same idea, and the docs page for the first is
 * where that idea is explained.
 */
const documentedProperty = (detail) =>
    [...detail.rows, ...detail.added].map((row) => row.property).find((name) => docsUrlFor(name));

const DocsLink = ({ detail }) => {
    const property = documentedProperty(detail);

    const label = property ? `${property} Tailwind docs` : 'Tailwind docs';

    return (
        <a
            href={property ? docsUrlFor(property) : DOCS_INDEX_URL}
            {...REFERENCE_LINK_PROPS}
            aria-label={`${label} — opens in a new tab`}
            /* `-my-1 py-1`: the hit area is taller than the 11px text without
               pushing the title line apart. */
            className="-my-1 flex shrink-0 items-center gap-1 rounded-xs py-1 pl-2 text-[11px] font-semibold text-teal-700 underline decoration-teal-400 underline-offset-2 transition hover:text-teal-900 hover:decoration-teal-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
        >
            Tailwind docs
            <NewTabIcon className="size-3" />
        </a>
    );
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
                        <PropertyLink property={row.property} />: {row.to};
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
                    <span className="block font-mono text-[10px] text-slate-400">
                        <PropertyLink property={row.property} />
                    </span>
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
                    <PropertyLink property={item.property} />: {item.value};
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
 *
 * The card holds links to the reference, so it has to stay open long enough
 * to be walked into: the frame around it is flush with the pill, and focus
 * moving inside it does not count as leaving.
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

/**
 * The one card that is open, if any.
 *
 * Every pill keeps its own `open` state, but leaving a pill only *schedules*
 * the close — so a pointer sweeping along a row opens the next card while the
 * one behind it is still serving out its grace period, and the cards pile up.
 * The cards are siblings on the page rather than in one React subtree, so the
 * arbitration lives outside the component: whoever opens closes whoever was
 * open.
 */
let closeOpenCard = null;

const claimOpenCard = (close) => {
    if (closeOpenCard && closeOpenCard !== close) closeOpenCard();
    closeOpenCard = close;
};

const releaseOpenCard = (close) => {
    if (closeOpenCard === close) closeOpenCard = null;
};

const MatchDetails = ({ match, declarations, variants, settings, children }) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);
    const triggerRef = useRef(null);
    const hideTimer = useRef(null);
    const cardId = useId();

    const cancelHide = useCallback(() => {
        if (hideTimer.current) {
            clearTimeout(hideTimer.current);
            hideTimer.current = null;
        }
    }, []);

    /* `hide` is declared above `show` because `show` closes over it. */
    const hide = useCallback(() => {
        cancelHide();
        releaseOpenCard(hide);
        setOpen(false);
    }, [cancelHide]);

    const show = useCallback(() => {
        cancelHide();
        const element = triggerRef.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const width = 300;
        setPosition({
            // Keep the card on screen when the trigger sits near an edge.
            left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
            // Flush with the pill. The 6px of breathing room below is
            // transparent padding on the card's frame rather than a gap, so
            // it stays part of the hover target.
            top: rect.bottom,
            flip: rect.bottom + 200 > window.innerHeight,
            bottom: window.innerHeight - rect.top,
            width,
        });
        claimOpenCard(hide);
        setOpen(true);
    }, [cancelHide, hide]);

    /**
     * Close, but not straight away.
     *
     * The card is a DOM descendant of the trigger and its frame touches the
     * pill, so a pointer travelling down into it never leaves the trigger and
     * the links stay reachable. The grace period covers what the geometry
     * cannot: a pointer that clips a corner on the way in, or a card the
     * window edge has pushed sideways.
     */
    const scheduleHide = useCallback(() => {
        cancelHide();
        hideTimer.current = setTimeout(hide, 120);
    }, [cancelHide, hide]);

    useEffect(
        () => () => {
            cancelHide();
            releaseOpenCard(hide);
        },
        [cancelHide, hide],
    );

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            hide();
            // Focus may be on a link inside the card, which is about to
            // disappear; put it back on something that will still be there.
            triggerRef.current?.focus();
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('scroll', hide, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('scroll', hide, true);
        };
    }, [open, hide]);

    const detail = open ? explainMatch(match, declarations, { ...settings, map, variants }) : null;

    // What the family of utilities is for, in Tailwind's words.
    const summary = detail ? docsSummaryFor(documentedProperty(detail)) : null;

    return (
        <span
            ref={triggerRef}
            className={PILL_FRAME}
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            onFocus={show}
            /* Keyboard users tab from the pill into the card's links, which
               fires focusout here. Only a focus move that leaves the pill
               *and* its card should close it. */
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) hide();
            }}
            tabIndex={0}
            /* Not `role="button"`: nothing happens on activation, and a
               button may not contain the links the card carries. A named
               group is what this is — a pill plus its explanation. */
            role="group"
            aria-describedby={open ? cardId : undefined}
            aria-label={`${match.className}: ${QUALITY_LABEL[match.quality]}`}
        >
            {children}

            {open && detail && position && (
                /* The frame is the hover target; the card inside it is what
                   you see. They are separate elements so the 6px between pill
                   and card can be transparent padding rather than a dead
                   zone — the pointer stays inside the trigger's subtree the
                   whole way down, so `mouseleave` never fires and the links
                   below stay reachable. */
                <span
                    onMouseEnter={cancelHide}
                    onMouseLeave={scheduleHide}
                    className="fixed z-50 block"
                    style={{
                        left: position.left,
                        width: position.width,
                        ...(position.flip
                            ? { bottom: position.bottom, paddingBottom: 6 }
                            : { top: position.top, paddingTop: 6 }),
                    }}
                >
                    <span
                        id={cardId}
                        /* No `role="tooltip"`: a tooltip may not hold
                           interactive content, and this one links out to the
                           reference. The trigger's `aria-describedby` points
                           here instead. */
                        /* `select-none`: the card is a DOM descendant of the
                           pill, which sits inside the click-to-copy block.
                           Without this, drag-selecting the row while a card
                           happens to be open copies the card's entire
                           contents along with the class names. */
                        className="block w-full select-none overflow-hidden rounded-sm border border-slate-300 bg-white text-slate-700 shadow-lg"
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
                            {/* The class and the way to read up on it, on one
                                line: the name is what the reader looked up,
                                and the link is the next thing they might want
                                from it. */}
                            <span
                                className={`flex items-baseline justify-between gap-2 ${
                                    detail.approximation ? 'mb-2' : ''
                                }`}
                            >
                                <code className="min-w-0 truncate font-mono text-[13px] font-semibold text-slate-900">
                                    {detail.className}
                                </code>
                                <DocsLink detail={detail} />
                            </span>
                            {/* One sentence of prose, and only one.
                                Tailwind's own line about the family says the
                                thing the rest of the card cannot — what these
                                utilities are *for* — so it takes the slot.
                                Where there is none, the headline stands in,
                                unless the banner above is already carrying
                                it. */}
                            {(summary || !detail.approximation) && (
                                <span className="mb-2 block text-[11px] leading-snug text-slate-500">
                                    {summary ?? detail.headline}
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
                </span>
            )}
        </span>
    );
};

export default MatchDetails;
