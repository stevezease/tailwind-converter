import React from 'react';
import { CODE_DELIMITER } from '../data/property-catalog.mjs';

/**
 * Renders the backticked spans in a catalogue blurb as code.
 *
 * The blurbs are written with markdown-style backticks because they are prose
 * about class names, and a blurb that says "becomes p-* on the spacing scale"
 * with no typographic break between the sentence and the class is hard to
 * read. Nothing else in them is markdown, so a parser would be overkill: a
 * split on the delimiter is the whole feature.
 *
 * Splitting on a captured group means the odd-indexed pieces are exactly the
 * ones that were inside backticks.
 */
const Blurb = ({ text, className }) => (
    <span className={className}>
        {text.split(CODE_DELIMITER).map((piece, index) =>
            index % 2 === 1 ? (
                <code key={index} className="font-mono text-[13px] text-teal-800">
                    {piece}
                </code>
            ) : (
                <React.Fragment key={index}>{piece}</React.Fragment>
            ),
        )}
    </span>
);

export default Blurb;
