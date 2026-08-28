import React from 'react';

/**
 * Copy control for a rule's classes.
 *
 * Presentational and controlled: the surrounding block is also clickable, so
 * the copied state lives with the rule rather than here. This stays a real
 * <button> so the action is reachable by keyboard — the block's click handler
 * is a convenience for pointers, not the accessible path.
 */
const CopyButton = ({ copied, onCopy }) => (
    <button
        type="button"
        onClick={(event) => {
            // The whole block copies too; don't run it twice.
            event.stopPropagation();
            onCopy();
        }}
        /* `select-none` keeps the label out of a hand-made selection: the
           button sits inside the class block, so dragging across the row to
           copy manually would otherwise paste a trailing "Copy". */
        className={`ml-1 inline-flex shrink-0 select-none items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-semibold transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 ${
            copied
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
        }`}
    >
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-3"
        >
            {copied ? (
                <path d="M20 6 9 17l-5-5" />
            ) : (
                <>
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </>
            )}
        </svg>
        {copied ? 'Copied' : 'Copy'}
    </button>
);

export default React.memo(CopyButton);
