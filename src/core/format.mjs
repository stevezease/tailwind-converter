/**
 * Pretty-print CSS.
 *
 * Built on PostCSS, which the converter already uses, so the "Tidy" button and
 * the conversion always agree about what the stylesheet says. (The previous
 * dependency, js-beautify, also could not be imported during Gatsby's static
 * HTML pass.)
 *
 * Formatting only ever reprints the parsed tree — no declaration is added,
 * removed, or rewritten.
 */

import postcss from 'postcss';

const INDENT = '  ';

function formatNode(node, depth) {
    const pad = INDENT.repeat(depth);

    switch (node.type) {
        case 'decl':
            return `${pad}${node.prop}: ${node.value}${node.important ? ' !important' : ''};`;

        case 'comment':
            return `${pad}/*${node.raws.left ?? ' '}${node.text}${node.raws.right ?? ' '}*/`;

        case 'atrule': {
            const params = node.params ? ` ${node.params}` : '';
            if (!node.nodes) return `${pad}@${node.name}${params};`;
            const body = node.nodes.map((child) => formatNode(child, depth + 1)).join('\n');
            return `${pad}@${node.name}${params} {\n${body}\n${pad}}`;
        }

        case 'rule': {
            const selector = node.selectors.join(`,\n${pad}`);
            const body = (node.nodes || []).map((child) => formatNode(child, depth + 1)).join('\n');
            return body ? `${pad}${selector} {\n${body}\n${pad}}` : `${pad}${selector} {}`;
        }

        default:
            return `${pad}${node.toString()}`;
    }
}

/**
 * Return `css` reformatted, or the original string unchanged when it cannot be
 * parsed — a half-typed stylesheet should not be mangled by pressing Tidy.
 */
export function formatCss(css) {
    let root;
    try {
        root = postcss.parse(css);
    } catch {
        return css;
    }

    const formatted = root.nodes.map((node) => formatNode(node, 0)).join('\n\n');
    return formatted ? `${formatted}\n` : '';
}
