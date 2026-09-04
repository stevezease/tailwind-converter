import React from 'react';

/**
 * A JSON-LD block for the Head.
 *
 * Gatsby's Head API renders real DOM nodes rather than React children into a
 * string, so the JSON has to go in as raw HTML — a `{json}` child would be
 * escaped and the block would parse as nothing.
 */
const StructuredData = ({ data }) => (
    <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
);

export default StructuredData;
