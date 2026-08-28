/**
 * Curated CSS to convert.
 *
 * Chosen to cover the ground someone moving from CSS to Tailwind actually
 * hits, and deliberately not all flattering: two of these exist to show where
 * utilities stop. Comments are part of the lesson, so they are written to be
 * read in the editor.
 */

const examples = [
    {
        id: 'card',
        name: 'Card',
        summary: 'Spacing, borders, colour and a breakpoint',
        css: `/* A typical component: most of this maps cleanly.
   Hover any class to see what it became and why. */

.card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 15px;
  color: #1f2937;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
}

.card:hover {
  background-color: #f9fafb;
}

/* Utilities live on one element, so the .card part cannot come along */
.card .title {
  font-weight: 600;
  text-transform: uppercase;
}

@media (min-width: 768px) {
  .card {
    padding: 24px 32px;
  }
}
`,
    },
    {
        id: 'button',
        name: 'Button',
        summary: 'Interactive states become variant prefixes',
        css: `/* Every state selector becomes a prefix: hover:, focus-visible:, disabled: */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 6px;
  background-color: #4f46e5;
  color: #ffffff;
  font-weight: 500;
  font-size: 14px;
}

.btn:hover {
  background-color: #4338ca;
}

.btn:focus-visible {
  outline: 2px solid #a5b4fc;
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`,
    },
    {
        id: 'form',
        name: 'Form field',
        summary: 'Pseudo-elements and focus rings',
        css: `/* ::placeholder is a variant too, and content-less pseudo-elements
   convert the same way as pseudo-classes. */

.input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  line-height: 20px;
}

.input::placeholder {
  color: #9ca3af;
}

.input:focus {
  border-color: #6366f1;
  outline: none;
}

.label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}
`,
    },
    {
        id: 'layout',
        name: 'Responsive grid',
        summary: 'Grid, gaps and stacked breakpoints',
        css: `/* Breakpoints stack: each media query becomes its own prefix. */

.grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;
  max-width: 1024px;
  margin: 0 auto;
  padding: 16px;
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
  }
}
`,
    },
    {
        id: 'typography',
        name: 'Typography',
        summary: 'Type sizes carry a line-height with them',
        css: `/* Tailwind's text sizes set a line-height as well as a font-size.
   Hover text-* to see the extra declaration you get for free. */

.title {
  font-size: 30px;
  line-height: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
}

.body {
  font-size: 16px;
  line-height: 28px;
  color: #374151;
  margin-bottom: 12px;
}

.link {
  color: #4f46e5;
  text-decoration: underline;
  text-underline-offset: 2px;
}
`,
    },
    {
        id: 'dark-mode',
        name: 'Dark mode',
        summary: 'A colour-scheme query becomes dark:',
        css: `/* prefers-color-scheme maps straight onto the dark: prefix. */

.panel {
  background-color: #ffffff;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

@media (prefers-color-scheme: dark) {
  .panel {
    background-color: #111827;
    color: #f9fafb;
    border-color: #374151;
  }
}
`,
    },
    {
        id: 'handoff',
        name: 'Design handoff',
        summary: 'Odd values from a design tool, snapped to the scale',
        css: `/* Numbers straight out of a design tool rarely sit on Tailwind's
   scale. Most snap to a neighbour a pixel or two away — hover the
   underlined classes to see exactly what moved, and by how much. */

.modal {
  width: 460px;
  padding: 18px 22px;
  border-radius: 10px;
  gap: 14px;
  font-size: 15px;
  line-height: 22px;
  box-shadow: 0 18px 30px -12px rgb(0 0 0 / 0.18);
}

.modal__title {
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.015em;
  margin-bottom: 6px;
}

.modal__close {
  top: 14px;
  right: 14px;
  width: 26px;
  height: 26px;
  border-radius: 7px;
}
`,
    },
    {
        id: 'palette',
        name: 'Legacy palette',
        summary: 'Old hex colours matched against the v4 palette',
        css: `/* Tailwind v4 rebuilt its palette in OKLCH, so v3-era hexes land
   near their new counterparts rather than on them. Hover a colour to
   see both swatches and how far apart they actually are. */

.alert {
  background-color: #fffaf0;
  border: 1px solid #fbd38d;
  color: #744210;
}

.alert--error {
  background-color: #fff5f5;
  border-color: #feb2b2;
  color: #742a2a;
}

.alert--ok {
  background-color: #f0fff4;
  border-color: #9ae6b4;
  color: #22543d;
}
`,
    },
    {
        id: 'limits',
        name: 'Where it stops',
        summary: 'Declarations and selectors utilities cannot express',
        css: `/* Not everything has a utility, and that is fine —
   an arbitrary value in [brackets] is exact, just off the scale. */

.legacy {
  transition: color 0.2s ease, transform 0.3s;
  background: url(hero.png) no-repeat center / cover;
  text-rendering: optimizeLegibility;
  grid-template-areas: "hd hd" "sb mn";
}

/* Selectors that describe *which* element cannot become classes at all */
.sidebar > .item + .item {
  border-top: 1px solid #e5e7eb;
}

[data-state="open"] .chevron {
  transform: rotate(180deg);
}
`,
    },
];

export default examples;
