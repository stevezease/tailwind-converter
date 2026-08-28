/**
 * CodeMirror 6 requires a DOM and cannot be evaluated during Gatsby's static
 * HTML pass, so it is replaced with an empty module there. The editor mounts
 * it only after hydration (see src/components/editor.js), and nothing else in
 * the build references it.
 *
 * The pattern covers `codemirror`, `@codemirror/*` and `@uiw/react-codemirror`.
 */
exports.onCreateWebpackConfig = ({ stage, loaders, actions }) => {
    if (stage !== 'build-html') return;

    actions.setWebpackConfig({
        module: {
            rules: [{ test: /codemirror/, use: loaders.null() }],
        },
    });
};
