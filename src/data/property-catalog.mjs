/**
 * The CSS properties that get their own reference page.
 *
 * This is a curated allowlist rather than a dump of every property in the
 * generated map, and deliberately so. The map knows about 262 properties,
 * including vendor-prefixed ones, the logical-property twin of nearly every
 * physical one, and outliers like `mask-composite` that expand to 1,500 rows.
 * A page per entry would bury the properties people actually convert under a
 * pile of near-duplicates that say nothing.
 *
 * `blurb` is the one thing here that cannot be derived from the map: what the
 * property's Tailwind equivalent is *like*, which is the part a table of
 * value/class pairs never tells you. Keep it to a sentence, and keep it true —
 * several of these exist to say that the mapping is lossy.
 *
 * Shorthands with no Tailwind equivalent at all (`transition`, `border`,
 * `outline`, `text-decoration`) are absent on purpose: the converter expands
 * them before matching, so there is no value/class table to show.
 */

const catalog = [
    // ---- Layout ----------------------------------------------------------
    { property: 'display', category: 'Layout', blurb: 'Every display value Tailwind supports is its own bare utility — the value is the class name, with no `display-` prefix.' },
    { property: 'position', category: 'Layout', blurb: 'The five position keywords map to bare utilities of the same name; `static` is the browser default but still has a class, for overriding.' },
    { property: 'top', category: 'Layout', blurb: 'Offsets share the spacing scale with padding and margin, so `top: 8px` becomes `top-2` on a 0.25rem base.' },
    { property: 'right', category: 'Layout', blurb: 'The physical-side offset; Tailwind also ships `end-*` for the logical equivalent that flips in RTL.' },
    { property: 'bottom', category: 'Layout', blurb: 'Offsets share the spacing scale with padding and margin, so `bottom: 8px` becomes `bottom-2` on a 0.25rem base.' },
    { property: 'left', category: 'Layout', blurb: 'The physical-side offset; Tailwind also ships `start-*` for the logical equivalent that flips in RTL.' },
    { property: 'inset', category: 'Layout', blurb: 'The four-side shorthand becomes `inset-*`, and the common `inset: 0` collapses to `inset-0`.' },
    { property: 'float', category: 'Layout', blurb: 'Float keywords map one-to-one, with `float-start` and `float-end` as the direction-aware pair.' },
    { property: 'clear', category: 'Layout', blurb: 'Mirrors float: the same keywords, the same logical `clear-start` / `clear-end` additions.' },
    { property: 'visibility', category: 'Layout', blurb: 'Three keywords, three utilities — note `invisible` still occupies layout space, unlike `hidden` which is `display: none`.' },
    { property: 'z-index', category: 'Layout', blurb: 'The default scale is sparse (0, 10, 20, 30, 40, 50); anything else needs an arbitrary value like `z-[60]`.' },
    { property: 'overflow', category: 'Layout', blurb: 'The shorthand maps directly, and the per-axis `overflow-x-*` / `overflow-y-*` utilities cover the long-hand forms.' },
    { property: 'overflow-x', category: 'Layout', blurb: 'Horizontal overflow gets its own utility family, most often reached for as `overflow-x-auto` on a wide table.' },
    { property: 'overflow-y', category: 'Layout', blurb: 'Vertical overflow gets its own utility family, most often reached for as `overflow-y-auto` on a scrolling pane.' },
    { property: 'box-sizing', category: 'Layout', blurb: 'Tailwind sets `border-box` globally in its preflight, so `box-content` is the one you will actually write.' },
    { property: 'isolation', category: 'Layout', blurb: 'Two utilities, used to create a stacking context so a blend mode or a z-index stays contained.' },

    // ---- Flexbox & Grid --------------------------------------------------
    { property: 'flex-direction', category: 'Flexbox & Grid', blurb: 'Direction is folded into the `flex-*` family, so `flex-direction: column` is `flex-col` — you still need `flex` alongside it.' },
    { property: 'flex-wrap', category: 'Flexbox & Grid', blurb: 'Three wrap keywords become `flex-wrap`, `flex-wrap-reverse` and `flex-nowrap`.' },
    { property: 'flex-grow', category: 'Flexbox & Grid', blurb: 'Only 0 and 1 have named utilities; any other growth factor needs an arbitrary value like `grow-[2]`.' },
    { property: 'flex-shrink', category: 'Flexbox & Grid', blurb: 'Only 0 and 1 have named utilities, and `shrink-0` is the one that stops a flex child collapsing.' },
    { property: 'flex-basis', category: 'Flexbox & Grid', blurb: 'Basis draws on the spacing scale plus a set of fractions, so `flex-basis: 50%` becomes `basis-1/2`.' },
    { property: 'flex', category: 'Flexbox & Grid', blurb: 'The shorthand has a handful of named forms (`flex-1`, `flex-auto`, `flex-initial`, `flex-none`); anything else becomes arbitrary.' },
    { property: 'order', category: 'Flexbox & Grid', blurb: 'Integer order values 1-12 have utilities, plus `order-first`, `order-last` and `order-none`.' },
    { property: 'align-items', category: 'Flexbox & Grid', blurb: 'Becomes the `items-*` family, where `align-items: center` is the very common `items-center`.' },
    { property: 'align-self', category: 'Flexbox & Grid', blurb: 'Becomes the `self-*` family, for overriding the container alignment on one child.' },
    { property: 'justify-content', category: 'Flexbox & Grid', blurb: 'Becomes the `justify-*` family — the main-axis counterpart to `items-*`.' },
    { property: 'justify-items', category: 'Flexbox & Grid', blurb: 'Becomes `justify-items-*`, a grid-only property that sets inline-axis alignment for every cell.' },
    { property: 'justify-self', category: 'Flexbox & Grid', blurb: 'Becomes `justify-self-*`, overriding the grid container inline-axis alignment for one item.' },
    { property: 'place-items', category: 'Flexbox & Grid', blurb: 'The align/justify shorthand, where `place-items-center` is the shortest route to centring in a grid.' },
    { property: 'place-content', category: 'Flexbox & Grid', blurb: 'The content-distribution shorthand, mapping to `place-content-*`.' },
    { property: 'gap', category: 'Flexbox & Grid', blurb: 'Gap uses the spacing scale, so `gap: 12px` becomes `gap-3` on the default 0.25rem base.' },
    { property: 'row-gap', category: 'Flexbox & Grid', blurb: 'The per-axis gap becomes `gap-y-*`, which is the axis name Tailwind uses rather than `row`.' },
    { property: 'column-gap', category: 'Flexbox & Grid', blurb: 'The per-axis gap becomes `gap-x-*`, which is the axis name Tailwind uses rather than `column`.' },
    { property: 'grid-template-columns', category: 'Flexbox & Grid', blurb: 'Only the repeated equal-width forms have utilities: `repeat(3, minmax(0, 1fr))` is `grid-cols-3`, and anything irregular becomes arbitrary.' },
    { property: 'grid-template-rows', category: 'Flexbox & Grid', blurb: 'Mirrors columns: equal-height `repeat()` tracks become `grid-rows-*`, bespoke track lists do not.' },
    { property: 'grid-column', category: 'Flexbox & Grid', blurb: 'Spans map to `col-span-*` and explicit lines to `col-start-*` / `col-end-*`.' },
    { property: 'grid-row', category: 'Flexbox & Grid', blurb: 'Spans map to `row-span-*` and explicit lines to `row-start-*` / `row-end-*`.' },
    { property: 'grid-auto-flow', category: 'Flexbox & Grid', blurb: 'Becomes `grid-flow-*`, including the dense packing variants.' },
    { property: 'grid-auto-columns', category: 'Flexbox & Grid', blurb: 'Becomes `auto-cols-*`, covering the auto, min, max and fr keywords.' },
    { property: 'grid-auto-rows', category: 'Flexbox & Grid', blurb: 'Becomes `auto-rows-*`, covering the auto, min, max and fr keywords.' },

    // ---- Spacing ---------------------------------------------------------
    { property: 'padding', category: 'Spacing', blurb: 'A single value becomes `p-*` on the spacing scale; the two- and four-value shorthands split into the axis and side utilities.' },
    { property: 'padding-top', category: 'Spacing', blurb: 'Becomes `pt-*`, one of the four side utilities the padding shorthand expands into.' },
    { property: 'padding-right', category: 'Spacing', blurb: 'Becomes `pr-*`; the logical equivalent Tailwind also ships is `pe-*`.' },
    { property: 'padding-bottom', category: 'Spacing', blurb: 'Becomes `pb-*`, one of the four side utilities the padding shorthand expands into.' },
    { property: 'padding-left', category: 'Spacing', blurb: 'Becomes `pl-*`; the logical equivalent Tailwind also ships is `ps-*`.' },
    { property: 'margin', category: 'Spacing', blurb: 'Becomes `m-*` on the spacing scale, and negative margins keep the sign as a prefix: `-m-2`.' },
    { property: 'margin-top', category: 'Spacing', blurb: 'Becomes `mt-*`, and `margin-top: auto` becomes `mt-auto` for pushing an item to the bottom of a flex column.' },
    { property: 'margin-right', category: 'Spacing', blurb: 'Becomes `mr-*`; the logical equivalent Tailwind also ships is `me-*`.' },
    { property: 'margin-bottom', category: 'Spacing', blurb: 'Becomes `mb-*`, one of the four side utilities the margin shorthand expands into.' },
    { property: 'margin-left', category: 'Spacing', blurb: 'Becomes `ml-*`; the logical equivalent Tailwind also ships is `ms-*`.' },

    // ---- Sizing ----------------------------------------------------------
    { property: 'width', category: 'Sizing', blurb: 'Width draws on the spacing scale, a set of fractions, and viewport keywords, so both `w-64` and `w-1/3` are ordinary utilities.' },
    { property: 'height', category: 'Sizing', blurb: 'Height mirrors width, with `h-screen` for `100vh` and `h-full` for `100%`.' },
    { property: 'min-width', category: 'Sizing', blurb: 'Becomes `min-w-*`, where `min-w-0` is the fix for a flex child that refuses to shrink below its content.' },
    { property: 'max-width', category: 'Sizing', blurb: 'Becomes `max-w-*`, including the named prose widths like `max-w-prose` and the breakpoint-named sizes.' },
    { property: 'min-height', category: 'Sizing', blurb: 'Becomes `min-h-*`, with `min-h-screen` the usual way to make a page fill the viewport.' },
    { property: 'max-height', category: 'Sizing', blurb: 'Becomes `max-h-*`, drawing on the same spacing scale as height.' },
    { property: 'aspect-ratio', category: 'Sizing', blurb: 'A few named ratios exist (`aspect-square`, `aspect-video`); any other ratio is written arbitrarily as `aspect-[4/3]`.' },

    // ---- Typography ------------------------------------------------------
    { property: 'font-size', category: 'Typography', blurb: 'Sizes are named rather than numeric — `text-sm`, not `text-14` — so the scale is a closed set and an off-scale size becomes an arbitrary value.' },
    { property: 'font-weight', category: 'Typography', blurb: 'Numeric weights map to names, so `font-weight: 600` becomes `font-semibold`.' },
    { property: 'font-family', category: 'Typography', blurb: 'Three named stacks ship by default — `font-sans`, `font-serif`, `font-mono` — and a custom stack matches only if you have defined it in your theme.' },
    { property: 'font-style', category: 'Typography', blurb: 'Two utilities: `italic` and `not-italic`.' },
    { property: 'line-height', category: 'Typography', blurb: 'Unitless leading values map to `leading-*` names; a length maps to the spacing scale instead.' },
    { property: 'letter-spacing', category: 'Typography', blurb: 'Becomes the `tracking-*` family, which is named rather than numeric.' },
    { property: 'text-align', category: 'Typography', blurb: 'Maps one-to-one, including the logical `text-start` and `text-end`.' },
    { property: 'text-transform', category: 'Typography', blurb: 'Bare utilities named after the value: `uppercase`, `lowercase`, `capitalize`, `normal-case`.' },
    { property: 'text-decoration-line', category: 'Typography', blurb: 'Bare utilities again — `underline`, `line-through`, `overline`, `no-underline`.' },
    { property: 'text-overflow', category: 'Typography', blurb: 'The `truncate` utility is the one to know: it sets overflow, white-space and text-overflow together.' },
    { property: 'white-space', category: 'Typography', blurb: 'Becomes the `whitespace-*` family, where `whitespace-nowrap` is the usual reason to reach for it.' },
    { property: 'word-break', category: 'Typography', blurb: 'Maps to `break-*`, and note `wrap-anywhere` and `break-all` behave differently on long unbroken strings.' },
    { property: 'vertical-align', category: 'Typography', blurb: 'Becomes the `align-*` family — unrelated to flexbox alignment despite the similar name.' },
    { property: 'list-style-type', category: 'Typography', blurb: 'Three utilities cover the common cases: `list-none`, `list-disc`, `list-decimal`.' },
    { property: 'color', category: 'Typography', blurb: 'Text colour becomes `text-*`, which is the same prefix as font size — the palette name is what tells the two apart.' },

    // ---- Backgrounds -----------------------------------------------------
    { property: 'background-color', category: 'Backgrounds', blurb: 'Becomes `bg-*` with a palette name; a colour outside the palette is emitted as an arbitrary value.' },
    { property: 'background-size', category: 'Backgrounds', blurb: 'Three keywords map to `bg-auto`, `bg-cover` and `bg-contain`.' },
    { property: 'background-position', category: 'Backgrounds', blurb: 'The nine keyword positions map to `bg-*`; offsets and percentages become arbitrary values.' },
    { property: 'background-repeat', category: 'Backgrounds', blurb: 'Maps to the `bg-repeat*` family, including the per-axis and `space` / `round` forms.' },
    { property: 'background-attachment', category: 'Backgrounds', blurb: 'Three utilities: `bg-fixed`, `bg-local`, `bg-scroll`.' },
    { property: 'background-clip', category: 'Backgrounds', blurb: 'Maps to `bg-clip-*`, with `bg-clip-text` the one used for gradient text.' },

    // ---- Borders ---------------------------------------------------------
    { property: 'border-width', category: 'Borders', blurb: 'Widths are unprefixed numbers and the 1px default is the bare `border` — so `border-2` is a width, not a palette shade.' },
    { property: 'border-style', category: 'Borders', blurb: 'Maps to `border-*` style names, which share the `border-` prefix with widths and colours.' },
    { property: 'border-color', category: 'Borders', blurb: 'Becomes `border-*` with a palette name; the same prefix carries width and style, so the suffix disambiguates.' },
    { property: 'border-radius', category: 'Borders', blurb: 'Radii are named rather than numeric — `rounded-lg`, not `rounded-8` — and the corner and side variants follow the same names.' },
    { property: 'border-collapse', category: 'Borders', blurb: 'Two utilities, `border-collapse` and `border-separate`, for table borders.' },
    { property: 'border-spacing', category: 'Borders', blurb: 'Uses the spacing scale, with per-axis `border-spacing-x-*` and `border-spacing-y-*` forms.' },
    { property: 'outline-width', category: 'Borders', blurb: 'Mirrors border widths: unprefixed numbers, with the bare `outline` as the 1px default.' },
    { property: 'outline-color', category: 'Borders', blurb: 'Becomes `outline-*` with a palette name, most often paired with a `focus-visible:` variant.' },

    // ---- Effects & Filters ----------------------------------------------
    { property: 'opacity', category: 'Effects', blurb: 'Percentages become the number: `opacity: 0.5` is `opacity-50`.' },
    { property: 'box-shadow', category: 'Effects', blurb: 'Shadows are named presets, so an exact match depends on your CSS using the same values Tailwind ships — a custom shadow becomes arbitrary.' },
    { property: 'mix-blend-mode', category: 'Effects', blurb: 'Every blend mode has a `mix-blend-*` utility of the same name.' },
    { property: 'filter', category: 'Effects', blurb: 'Each filter function is its own utility (`blur-sm`, `grayscale`, `brightness-50`) and they compose, so one CSS declaration can become several classes.' },
    { property: 'backdrop-filter', category: 'Effects', blurb: 'Mirrors `filter` with a `backdrop-` prefix on every utility, and composes the same way.' },
    { property: 'object-fit', category: 'Effects', blurb: 'Maps to the `object-*` family, where `object-cover` is the usual choice for images.' },
    { property: 'object-position', category: 'Effects', blurb: 'The nine keyword positions map to `object-*`; anything finer becomes an arbitrary value.' },

    // ---- Transitions & Transforms ---------------------------------------
    { property: 'transition-property', category: 'Transitions', blurb: 'Named bundles rather than raw property lists: `transition`, `transition-colors`, `transition-opacity` and friends.' },
    { property: 'transition-duration', category: 'Transitions', blurb: 'Durations are the millisecond count: `transition-duration: 150ms` is `duration-150`.' },
    { property: 'transition-delay', category: 'Transitions', blurb: 'Delays follow the same millisecond convention as durations, as `delay-*`.' },
    { property: 'transition-timing-function', category: 'Transitions', blurb: 'The four standard easings map to `ease-*`; a custom cubic-bezier becomes an arbitrary value.' },
    { property: 'animation', category: 'Transitions', blurb: 'Four named animations ship by default (`animate-spin`, `animate-ping`, `animate-pulse`, `animate-bounce`); your own keyframes need theme config.' },
    { property: 'transform', category: 'Transforms', blurb: 'Tailwind splits the shorthand into per-function utilities, so a `transform` with several functions becomes several classes.' },
    { property: 'translate', category: 'Transforms', blurb: 'Uses the spacing scale and fractions, with negative values written as `-translate-x-4`.' },
    { property: 'rotate', category: 'Transforms', blurb: 'Degree values map directly, with the sign as a prefix: `rotate-45`, `-rotate-45`.' },
    { property: 'scale', category: 'Transforms', blurb: 'Scale factors become percentages: `scale: 1.05` is `scale-105`.' },
    { property: 'transform-origin', category: 'Transforms', blurb: 'The nine keyword origins map to `origin-*`.' },

    // ---- Interactivity ---------------------------------------------------
    { property: 'cursor', category: 'Interactivity', blurb: 'Every standard cursor keyword has a utility of the same name.' },
    { property: 'pointer-events', category: 'Interactivity', blurb: 'Two utilities, most often used as `pointer-events-none` on a decorative overlay.' },
    { property: 'user-select', category: 'Interactivity', blurb: 'Four utilities under the `select-*` prefix.' },
    { property: 'resize', category: 'Interactivity', blurb: 'Maps to the `resize*` family, where the bare `resize` means both axes.' },
    { property: 'appearance', category: 'Interactivity', blurb: 'Two utilities; `appearance-none` is the one used to strip native form styling.' },
    { property: 'scroll-behavior', category: 'Interactivity', blurb: 'Two utilities, `scroll-auto` and `scroll-smooth`.' },
    { property: 'table-layout', category: 'Interactivity', blurb: 'Two utilities, `table-auto` and `table-fixed`.' },
];

export default catalog;

/**
 * The backtick spans in a blurb, which mark class names inside the prose.
 *
 * Lives here rather than with the component that renders them because the
 * blurbs are the thing being described, and because a plain-text consumer —
 * the meta description, the JSON-LD — needs to strip them without importing
 * anything that renders.
 */
export const CODE_DELIMITER = /`([^`]+)`/g;

/** The same blurb with the backticks dropped, for plain-string contexts. */
export const plainBlurb = (text) => text.replace(CODE_DELIMITER, '$1');

/** `padding` -> `padding-to-tailwind`, the slug used for the page path. */
export const slugFor = (property) => `${property}-to-tailwind`;

/** The order categories appear in on the index page. */
export const CATEGORY_ORDER = [
    'Layout',
    'Flexbox & Grid',
    'Spacing',
    'Sizing',
    'Typography',
    'Backgrounds',
    'Borders',
    'Effects',
    'Transitions',
    'Transforms',
    'Interactivity',
];
