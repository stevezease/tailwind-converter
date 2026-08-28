import React, { useCallback, useEffect, useState } from 'react';
import CopyButton from './copy-button';
import MatchDetails from './match-details';
import { QUALITY } from '../core/convert.mjs';
import {
    SEVERITY_INFO,
    SEVERITY_REVIEW,
    hasReviewableMatches,
    needsReview,
    severityFor,
} from '../core/severity.mjs';

/**
 * How each severity level looks.
 *
 * Every class is hoverable — the card explains what any class does and which
 * declaration it came from, which is the point of the tool as a way to learn
 * Tailwind from CSS you already understand. The underline is therefore not a
 * "hover me" hint; it means the translation is not verbatim. Exact matches
 * carry no decoration at all, so a clean row reads as "all of this is exactly
 * your CSS".
 *
 * The judgement itself lives in `src/core/severity.mjs`; this only maps the
 * answer onto a treatment. Colour is not the only signal — the underline style
 * carries the same distinction, which survives for readers who cannot separate
 * the hues. It is text decoration rather than a character, so unlike a marker
 * glyph it can never end up in a copied selection.
 */
const SEVERITY_STYLES = {
    [SEVERITY_INFO]:
        'text-slate-800 underline decoration-slate-300 decoration-dotted underline-offset-4',
    [SEVERITY_REVIEW]:
        'bg-amber-50 text-amber-900 underline decoration-amber-400 decoration-wavy underline-offset-4',
};

/** Exact matches: no decoration, but still hoverable. */
const EXACT_STYLE = 'text-slate-800';

export { hasReviewableMatches };

/** Render `backtick` spans in a warning as inline code. */
function renderTicks(text) {
    return text.split(/`([^`]+)`/g).map((part, index) =>
        index % 2 === 1 ? (
            <code key={index} className="font-mono text-slate-800">
                {part}
            </code>
        ) : (
            part
        )
    );
}

const ClassPill = ({ match, declarations, variants, settings }) => {
    const severity = severityFor(match, settings);

    const pill = (
        <span
            className={`rounded-sm px-1.5 py-0.5 font-mono text-[13px] ${
                severity ? SEVERITY_STYLES[severity] : EXACT_STYLE
            } hover:bg-slate-100`}
        >
            {match.className}
        </span>
    );

    return (
        <MatchDetails
            match={match}
            declarations={declarations}
            variants={variants}
            settings={settings}
        >
            {pill}
        </MatchDetails>
    );
};

const RuleResult = ({ rule, settings }) => {
    const review = rule.matches.filter((match) => needsReview(match, settings));
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async () => {
        if (!rule.classNames) return;
        try {
            await navigator.clipboard.writeText(rule.classNames);
            setCopied(true);
        } catch {
            // Clipboard access can be denied; the classes stay selectable.
            setCopied(false);
        }
    }, [rule.classNames]);

    useEffect(() => setCopied(false), [rule.classNames]);

    useEffect(() => {
        if (!copied) return undefined;
        const timer = setTimeout(() => setCopied(false), 1600);
        return () => clearTimeout(timer);
    }, [copied]);

    return (
        <div className="border-b border-slate-200 px-4 py-3">
            <code className="mb-1.5 block truncate font-mono text-xs text-slate-500">
                {rule.selector}
            </code>

            {rule.classNames ? (
                /* Copying is the point of the tool, so the whole block is the
                   target and the button sits with the classes rather than
                   across the panel from them. The div's click handler is a
                   pointer convenience; the nested <button> is the keyboard and
                   screen-reader path. */
                <div
                    onClick={copy}
                    className="-mx-1.5 flex cursor-pointer flex-wrap items-center gap-x-1 gap-y-1 rounded-sm border border-transparent px-1.5 py-1 transition hover:border-slate-200 hover:bg-slate-50"
                >
                    {rule.matches.map((match, index) => (
                        <ClassPill
                            key={`${match.className}-${index}`}
                            match={match}
                            declarations={rule.declarations}
                            variants={rule.variants}
                            settings={settings}
                        />
                    ))}
                    <CopyButton copied={copied} onCopy={copy} />
                </div>
            ) : (
                <p className="text-sm text-slate-400">Nothing to convert.</p>
            )}

            {/* Only rule-specific news belongs here. The invitation to hover
                is the same on every rule, so it is said once above the list
                instead of repeated down the page. */}
            {review.length > 0 && (
                <p className="mt-1.5 text-[11px] text-amber-700">
                    {review.length} {review.length === 1 ? 'class is' : 'classes are'} worth checking
                </p>
            )}

            {/* Things the class list cannot say. Kept visually distinct from
                the approximation colour: these are not "close enough", they
                are parts of the rule that did not come across at all. */}
            {(rule.selectorWarnings.length > 0 || rule.unsupportedAtRules.length > 0) && (
                <div className="mt-2 space-y-1 border-l-2 border-sky-300 pl-2 text-[11px] leading-snug text-slate-600">
                    {rule.unsupportedAtRules.length > 0 && (
                        <p>
                            No variant for{' '}
                            <code className="font-mono">{rule.unsupportedAtRules.join(', ')}</code> — the
                            classes above apply unconditionally.
                        </p>
                    )}
                    {rule.selectorWarnings.map((warning, index) => (
                        <p key={index}>{renderTicks(warning)}</p>
                    ))}
                </div>
            )}

            {rule.unconverted.length > 0 && (
                <div className="mt-2 rounded-sm bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    <p className="font-semibold">Not converted</p>
                    {rule.unconverted.map((declaration, index) => (
                        <code key={index} className="block font-mono">
                            {declaration.property}: {declaration.value};
                        </code>
                    ))}
                </div>
            )}
        </div>
    );
};

const Output = ({ result, settings }) => {
    if (result.error) {
        return (
            <div className="px-4 py-6">
                <p className="text-sm text-rose-700">
                    Could not parse the CSS: {result.error.message}
                    {result.error.line !== undefined && ` (line ${result.error.line})`}
                </p>
            </div>
        );
    }

    if (result.rules.length === 0) {
        return (
            <div className="px-4 py-6">
                <p className="text-sm text-slate-400">
                    Paste CSS on the left to see the equivalent Tailwind classes.
                </p>
            </div>
        );
    }

    return (
        <div>
            <p className="border-b border-slate-200 px-4 py-1.5 text-[11px] text-slate-400">
                Hover any class to see what it does and where it came from.
            </p>
            {result.rules.map((rule, index) => (
                <RuleResult key={`${rule.selector}-${index}`} rule={rule} settings={settings} />
            ))}
        </div>
    );
};

export default Output;
