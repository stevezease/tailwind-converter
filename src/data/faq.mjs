/**
 * The questions the converter actually gets asked.
 *
 * One source for both the rendered list and the FAQPage structured data, so
 * the markup and the schema cannot answer the same question differently —
 * which is the failure mode Google penalises rather than rewards.
 *
 * `answer` is plain text, not markup, because the JSON-LD copy has to be the
 * same string as the visible copy.
 *
 * Exported as a function of the version so the answer that names it cannot go
 * stale: the number comes from the same generated map the converter uses.
 */

const faqFor = (tailwindVersion) => [
    {
        question: 'Which Tailwind version does the converter target?',
        answer: `Whatever version is installed in this repository, currently v${tailwindVersion}. The conversion table is generated from the Tailwind release itself at build time rather than written by hand, so a class name only appears here if that release really produces it.`,
    },
    {
        question: 'Do I need to sign up or install anything?',
        answer: 'No. Paste CSS into the left pane and the classes appear on the right. There is no account, no upload, and no build step — the conversion runs in your browser, so the CSS never leaves your machine.',
    },
    {
        question: 'What happens to CSS that has no Tailwind equivalent?',
        answer: 'It is flagged rather than dropped. Values that are off the scale become arbitrary values in square brackets, and anything a utility genuinely cannot express — a descendant selector, for example — is called out with an explanation instead of being silently discarded.',
    },
    {
        question: 'Does it handle media queries and pseudo-classes?',
        answer: 'Yes. Min-width media queries become the matching breakpoint prefix such as md: or lg:, and pseudo-classes such as :hover and :focus become the corresponding variant prefix.',
    },
    {
        question: 'Are shorthand properties expanded?',
        answer: 'Yes. Shorthands like padding, margin, border and flex are expanded into their long-hand declarations before matching, so a four-value padding becomes the right combination of side utilities rather than failing to match.',
    },
    {
        question: 'Why do some rules produce more classes than declarations?',
        answer: 'Because several Tailwind utilities cover only part of a CSS property. A transform with three functions becomes three classes, and a filter behaves the same way, since Tailwind exposes each function separately so they can be composed.',
    },
];

export default faqFor;
