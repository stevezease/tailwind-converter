/**
 * The only place in the codebase that touches Tailwind's internals.
 *
 * `__unstable__loadDesignSystem` is the API Tailwind's own IntelliSense and
 * Prettier plugin are built on, so it is unlikely to disappear — but the name
 * is a promise that it may change shape. Keeping it behind this adapter means
 * a signature change is a one-file fix rather than a rewrite of the generator.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { __unstable__loadDesignSystem } from 'tailwindcss';

const require = createRequire(import.meta.url);

/** Absolute path to the installed tailwindcss package. */
export function tailwindRoot() {
    return path.dirname(require.resolve('tailwindcss/package.json'));
}

export function tailwindVersion() {
    return require('tailwindcss/package.json').version;
}

/**
 * Resolve the `@import` targets Tailwind's own stylesheets use
 * (`tailwindcss`, `tailwindcss/theme`, `tailwindcss/utilities`, ...) against
 * the installed package.
 */
function resolveStylesheet(id, root) {
    if (id === 'tailwindcss') return path.join(root, 'index.css');

    const relative = id.replace(/^tailwindcss\//, '');
    const candidates = [
        path.join(root, relative),
        path.join(root, `${relative}.css`),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    throw new Error(`Cannot resolve stylesheet import "${id}" from ${root}`);
}

/**
 * Load a Tailwind design system.
 *
 * `css` defaults to a stock Tailwind install. Passing a project's own
 * stylesheet — one with an `@theme` block — produces a design system for that
 * project's tokens instead, which is what makes custom-theme support fall out
 * of the same code path.
 */
export async function loadDesignSystem(css = '@import "tailwindcss";') {
    const root = tailwindRoot();

    return __unstable__loadDesignSystem(css, {
        base: process.cwd(),
        loadStylesheet: async (id) => {
            const file = resolveStylesheet(id, root);
            return {
                base: path.dirname(file),
                path: file,
                content: fs.readFileSync(file, 'utf8'),
            };
        },
        loadModule: async () => {
            throw new Error('JS plugins are not supported by the map generator');
        },
    });
}
