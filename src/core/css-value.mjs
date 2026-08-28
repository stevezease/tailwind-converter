/**
 * Low-level CSS value utilities shared by the map generator and the runtime
 * converter. Keeping one implementation is what makes lookups work: the same
 * text transformation is applied to Tailwind's compiled output at build time
 * and to the user's CSS at conversion time, so equal values produce equal keys.
 *
 * Framework-agnostic: no React, no Node built-ins.
 */

const OPEN = { '(': ')', '[': ']' };

/**
 * Split on a separator that appears at nesting depth zero, so
 * `0 4px 6px rgb(0 0 0 / 0.1), 0 2px 4px` splits into two shadow layers
 * rather than shattering the rgb().
 */
export function splitTopLevel(value, separator = ',') {
    const parts = [];
    let depth = 0;
    let quote = null;
    let current = '';

    for (let i = 0; i < value.length; i++) {
        const char = value[i];

        if (quote) {
            current += char;
            if (char === quote && value[i - 1] !== '\\') quote = null;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            current += char;
            continue;
        }
        if (OPEN[char]) depth++;
        else if (char === ')' || char === ']') depth--;

        if (depth === 0 && char === separator) {
            parts.push(current);
            current = '';
            continue;
        }
        current += char;
    }
    parts.push(current);
    return parts.map((part) => part.trim());
}

/**
 * Find the index just past the `)` that closes the `(` at `openIndex`.
 * Returns -1 when the value is unbalanced.
 */
function matchParen(value, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < value.length; i++) {
        if (value[i] === '(') depth++;
        else if (value[i] === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * Replace `var(--name)` and `var(--name, fallback)` using `resolve`.
 *
 * `resolve(name)` returns a string, or `undefined` when the variable is
 * unknown — in which case the declared fallback is used. An empty fallback
 * (`var(--tw-blur,)`, which Tailwind emits for optional filter slots) is a
 * real value meaning "contribute nothing", so it collapses to an empty string
 * rather than being treated as missing.
 *
 * Substitution is recursive because Tailwind nests them, e.g.
 * `var(--tw-leading, var(--text-sm--line-height))`.
 */
export function substituteVars(value, resolve, depth = 0) {
    if (depth > 12 || typeof value !== 'string' || !value.includes('var(')) {
        return value;
    }

    let result = '';
    let index = 0;

    while (index < value.length) {
        const start = value.indexOf('var(', index);
        if (start === -1) {
            result += value.slice(index);
            break;
        }
        result += value.slice(index, start);

        const close = matchParen(value, start + 3);
        if (close === -1) {
            result += value.slice(start);
            break;
        }

        const inner = value.slice(start + 4, close);
        const comma = splitTopLevel(inner, ',');
        const name = comma[0].trim();
        // `var(--x,)` yields [' --x', ''] — an explicit empty fallback.
        const hasFallback = comma.length > 1;
        const fallback = hasFallback ? comma.slice(1).join(',').trim() : undefined;

        const resolved = resolve(name);
        let replacement;
        if (resolved !== undefined && resolved !== null) {
            replacement = resolved;
        } else if (hasFallback) {
            replacement = fallback;
        } else {
            // Unresolvable and no fallback: leave the var() intact so callers
            // can tell the value is not statically knowable.
            replacement = value.slice(start, close + 1);
            result += replacement;
            index = close + 1;
            continue;
        }

        result += substituteVars(replacement, resolve, depth + 1);
        index = close + 1;
    }

    return substituteVars(result, resolve, depth + 1);
}

/* ------------------------------------------------------------------ *
 * calc() evaluation
 *
 * Tailwind emits calc() constantly — `calc(var(--spacing) * 4)` for every
 * spacing utility, `calc(1 / 2 * 100%)` for every fraction. A regex that only
 * handles multiplication silently drops all the fractional utilities, so this
 * is a real (if small) recursive-descent parser.
 * ------------------------------------------------------------------ */

const NUMBER_UNIT = /^([+-]?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;

function tokenize(input) {
    const tokens = [];
    let i = 0;
    while (i < input.length) {
        const char = input[i];
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        if (char === '(' || char === ')') {
            tokens.push({ type: char });
            i++;
            continue;
        }
        if (char === '*' || char === '/') {
            tokens.push({ type: 'op', value: char });
            i++;
            continue;
        }
        // `+` and `-` are only operators when surrounded by whitespace, per the
        // calc() grammar. `-4px` and `1e-5` are part of the number.
        if ((char === '+' || char === '-') && /\s/.test(input[i - 1] ?? ' ') && /\s/.test(input[i + 1] ?? '')) {
            tokens.push({ type: 'op', value: char });
            i++;
            continue;
        }
        const rest = input.slice(i);
        const match = rest.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[a-z%]*/i);
        if (!match) return null;
        const parsed = NUMBER_UNIT.exec(match[0]);
        if (!parsed) return null;
        tokens.push({ type: 'num', value: parseFloat(parsed[1]), unit: parsed[2].toLowerCase() });
        i += match[0].length;
    }
    return tokens;
}

function combine(left, operator, right) {
    if (operator === '*' || operator === '/') {
        if (operator === '/' && right.value === 0) return null;
        // At most one operand may carry a unit.
        if (left.unit && right.unit) return null;
        return {
            value: operator === '*' ? left.value * right.value : left.value / right.value,
            unit: left.unit || (operator === '*' ? right.unit : ''),
        };
    }
    // Addition and subtraction need matching units; unitless zero adapts.
    let unit = left.unit;
    if (left.unit !== right.unit) {
        if (left.value === 0 && !left.unit) unit = right.unit;
        else if (right.value === 0 && !right.unit) unit = left.unit;
        else return null;
    }
    return {
        value: operator === '+' ? left.value + right.value : left.value - right.value,
        unit,
    };
}

function parseExpression(tokens, position) {
    let result = parseTerm(tokens, position);
    if (!result) return null;
    let { node, next } = result;

    while (tokens[next] && tokens[next].type === 'op' && (tokens[next].value === '+' || tokens[next].value === '-')) {
        const operator = tokens[next].value;
        const right = parseTerm(tokens, next + 1);
        if (!right) return null;
        const combined = combine(node, operator, right.node);
        if (!combined) return null;
        node = combined;
        next = right.next;
    }
    return { node, next };
}

function parseTerm(tokens, position) {
    let result = parseFactor(tokens, position);
    if (!result) return null;
    let { node, next } = result;

    while (tokens[next] && tokens[next].type === 'op' && (tokens[next].value === '*' || tokens[next].value === '/')) {
        const operator = tokens[next].value;
        const right = parseFactor(tokens, next + 1);
        if (!right) return null;
        const combined = combine(node, operator, right.node);
        if (!combined) return null;
        node = combined;
        next = right.next;
    }
    return { node, next };
}

function parseFactor(tokens, position) {
    const token = tokens[position];
    if (!token) return null;
    if (token.type === 'num') {
        return { node: { value: token.value, unit: token.unit }, next: position + 1 };
    }
    if (token.type === '(') {
        const inner = parseExpression(tokens, position + 1);
        if (!inner || !tokens[inner.next] || tokens[inner.next].type !== ')') return null;
        return { node: inner.node, next: inner.next + 1 };
    }
    return null;
}

/** Round away float noise from things like 0.1 + 0.2 without losing precision. */
export function formatNumber(value) {
    const rounded = Number(value.toFixed(6));
    return String(rounded === 0 ? 0 : rounded);
}

/**
 * Evaluate every fully-numeric `calc(...)` in a value. Expressions that still
 * contain unresolved variables, or that mix units illegally, are left exactly
 * as they were — an unevaluated calc() is a correct CSS value, just not an
 * indexable one.
 */
export function evaluateCalc(value) {
    if (typeof value !== 'string' || !value.toLowerCase().includes('calc(')) {
        return value;
    }

    let result = '';
    let index = 0;

    while (index < value.length) {
        const start = value.toLowerCase().indexOf('calc(', index);
        if (start === -1) {
            result += value.slice(index);
            break;
        }
        result += value.slice(index, start);

        const close = matchParen(value, start + 4);
        if (close === -1) {
            result += value.slice(start);
            break;
        }

        const inner = evaluateCalc(value.slice(start + 5, close));
        const tokens = tokenize(inner);
        const parsed = tokens && parseExpression(tokens, 0);

        if (parsed && parsed.next === tokens.length) {
            result += formatNumber(parsed.node.value) + parsed.node.unit;
        } else {
            result += `calc(${inner})`;
        }
        index = close + 1;
    }

    return result;
}
