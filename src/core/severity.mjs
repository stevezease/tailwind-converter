/**
 * How much attention a match deserves.
 *
 * Separate from rendering on purpose: this is a judgement about the quality of
 * a translation, and the UI only maps the answer onto a colour. Keeping it
 * here makes the thresholds testable and keeps `src/core` free of React.
 *
 * Three levels:
 *   null     the utility emits exactly what you wrote
 *   'info'   approximate but faithful — no value was meaningfully altered
 *   'review' a translation a person might argue with
 *
 * Most approximations are faithful. `16px` to `1rem` loses nothing, an
 * arbitrary value reproduces the input exactly, and a palette colour a
 * half-thousandth away in OKLab renders to the same hex. Treating those as
 * warnings trains the reader to ignore the one signal that matters.
 */

import { QUALITY } from './match.mjs';
import { DEFAULT_SETTINGS } from './match.mjs';

/**
 * A colour is worth checking when it sits near the edge of the tolerance the
 * reader configured, expressed as a fraction of it.
 *
 * A fixed distance does not work. Tailwind v4 rebuilt its palette in OKLCH, so
 * a v3 stylesheet's colours land a median of ~0.035 away from their correct v4
 * counterparts — `#ef4444` to `red-500` is 0.029, and that is the right
 * answer, not a bad translation. Any fixed threshold tight enough to catch a
 * genuinely dubious match would flag nearly every colour in a v3 codebase.
 *
 * The tolerance already encodes "how close counts as the same colour", and
 * anything beyond it has already fallen through to an exact arbitrary value.
 * Scaling against it means tightening the setting tightens this in step.
 */
export const REVIEW_TOLERANCE_FRACTION = 0.8;

/**
 * When a snapped length is worth a second look.
 *
 * Both conditions must hold, because either alone misreads one end of the
 * scale. A 1px shift is invisible whatever its percentage — 7px to 6px is
 * 14%, and nobody can see it. A 2px shift on a 30px radius is 6% and equally
 * invisible. It takes a change that is both a couple of pixels *and* a real
 * fraction of the value before anyone notices, which is where 10px to 8px
 * lands.
 */
export const REVIEW_ROUNDING_ERROR = 0.1;
export const REVIEW_ROUNDING_PX = 2;

export const SEVERITY_INFO = 'info';
export const SEVERITY_REVIEW = 'review';

/**
 * Judge one match. Returns null, 'info', or 'review'.
 */
export function severityFor(match, settings = {}) {
    if (!match || match.quality === QUALITY.EXACT) return null;

    const colorTolerance = settings.colorTolerance ?? DEFAULT_SETTINGS.colorTolerance;

    if (
        match.quality === QUALITY.NEAREST_COLOR &&
        (match.distance ?? 0) >= colorTolerance * REVIEW_TOLERANCE_FRACTION
    ) {
        return SEVERITY_REVIEW;
    }

    if (
        match.quality === QUALITY.ROUNDED &&
        (match.error ?? 0) >= REVIEW_ROUNDING_ERROR &&
        (match.offByPx ?? 0) >= REVIEW_ROUNDING_PX
    ) {
        return SEVERITY_REVIEW;
    }

    return SEVERITY_INFO;
}

/** True when a match is worth a second look, rather than merely approximate. */
export function needsReview(match, settings) {
    return severityFor(match, settings) === SEVERITY_REVIEW;
}

/** Does this whole result contain anything the reader should check? */
export function hasReviewableMatches(result, settings) {
    return result.rules.some((rule) => rule.matches.some((match) => needsReview(match, settings)));
}
