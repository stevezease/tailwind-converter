import React from 'react';
import CopyButton from './tailwind-block';
import { QUALITY } from '../core/convert.mjs';

/**
 * How each match tier is presented.
 *
 * The v1 converter rounded values silently and reported nothing, so a 13px
 * padding quietly became 12px. Every non-exact result is labelled here.
 */
const QUALITY_STYLES = {
    [QUALITY.EXACT]: null,
    [QUALITY.CONVERTED]: {
        label: 'unit converted',
        className: 'bg-sky-100 text-sky-900',
    },
    [QUALITY.ROUNDED]: {
        label: 'rounded',
        className: 'bg-amber-100 text-amber-900',
    },
    [QUALITY.NEAREST_COLOR]: {
        label: 'nearest colour',
        className: 'bg-violet-100 text-violet-900',
    },
    [QUALITY.ARBITRARY]: {
        label: 'arbitrary value',
        className: 'bg-slate-200 text-slate-700',
    },
};

const ClassPill = ({ match }) => {
    const style = QUALITY_STYLES[match.quality];
    const title = match.note || (style ? style.label : 'exact match');

    return (
        <span
            title={title}
            className={`rounded-sm px-1.5 py-0.5 font-mono text-[13px] ${
                style ? style.className : 'text-slate-800'
            }`}
        >
            {match.className}
        </span>
    );
};

const RuleResult = ({ rule }) => {
    const approximate = rule.matches.filter((match) => match.quality !== QUALITY.EXACT);

    return (
        <div className="border-b border-slate-200 px-4 py-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <code className="truncate font-mono text-xs text-slate-500">{rule.selector}</code>
                {rule.classNames && <CopyButton text={rule.classNames} />}
            </div>

            {rule.classNames ? (
                <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                    {rule.matches.map((match, index) => (
                        <ClassPill key={`${match.className}-${index}`} match={match} />
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-400">Nothing to convert.</p>
            )}

            {approximate.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                    {approximate.map((match, index) => (
                        <li key={`${match.className}-note-${index}`}>
                            <span className="font-mono text-slate-600">{match.className}</span>
                            {' — '}
                            {match.note || QUALITY_STYLES[match.quality]?.label}
                            {/* Four decimals: a near-exact palette hit is around
                                0.0005, and three decimals renders that as
                                "0.000", which reads as exact when it is not. */}
                            {match.distance !== undefined && ` (Δ ${match.distance.toFixed(4)})`}
                        </li>
                    ))}
                </ul>
            )}

            {rule.unsupportedAtRules.length > 0 && (
                <p className="mt-2 text-xs text-amber-700">
                    No variant for {rule.unsupportedAtRules.join(', ')} — the classes above apply
                    unconditionally.
                </p>
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

const Output = ({ result }) => {
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
            {result.rules.map((rule, index) => (
                <RuleResult key={`${rule.selector}-${index}`} rule={rule} />
            ))}
        </div>
    );
};

export default Output;
