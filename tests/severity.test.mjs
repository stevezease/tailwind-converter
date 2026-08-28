/**
 * When the UI should warn.
 *
 * The point of these thresholds is restraint: almost every approximation the
 * converter makes is a faithful translation, and colouring those as problems
 * makes the reader stop noticing the colour. These pin down the cases that do
 * and do not earn a warning.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { convertCss, QUALITY } from '../src/core/convert.mjs';
import {
    severityFor,
    hasReviewableMatches,
    SEVERITY_INFO,
    SEVERITY_REVIEW,
} from '../src/core/severity.mjs';

const map = JSON.parse(fs.readFileSync(new URL('../src/generated/tailwind-map.json', import.meta.url), 'utf8'));

function matchFor(css, settings = {}) {
    const rule = convertCss(css, map, settings).rules[0];
    return rule.matches[rule.matches.length - 1];
}

describe('severityFor', () => {
    it('says nothing about an exact match', () => {
        expect(severityFor(matchFor('.a { display: flex; }'))).toBeNull();
    });

    it('treats a unit conversion as faithful', () => {
        const match = matchFor('.a { padding: 16px; }');
        expect(match.quality).toBe(QUALITY.CONVERTED);
        expect(severityFor(match)).toBe(SEVERITY_INFO);
    });

    it('treats an arbitrary value as faithful — it reproduces the input exactly', () => {
        const match = matchFor('.a { letter-spacing: 0.033em; }');
        expect(match.quality).toBe(QUALITY.ARBITRARY);
        expect(severityFor(match)).toBe(SEVERITY_INFO);
    });

    it('does not warn about an imperceptible colour shift', () => {
        // #e5e7eb clips to the same hex as gray-200 despite a non-zero delta.
        const match = matchFor('.a { border-color: #e5e7eb; }');
        expect(match.quality).toBe(QUALITY.NEAREST_COLOR);
        expect(severityFor(match)).toBe(SEVERITY_INFO);
    });

    it('does not warn about a v3 palette colour mapping to its v4 counterpart', () => {
        // The whole palette moved in v4, so #ef4444 -> red-500 is ~0.029 away
        // and is the correct answer. Warning here would flag most of a v3
        // stylesheet.
        const match = matchFor('.a { color: #ef4444; }');
        expect(match.distance).toBeGreaterThan(0.02);
        expect(severityFor(match)).toBe(SEVERITY_INFO);
    });

    it('warns about a colour near the edge of the configured tolerance', () => {
        const match = matchFor('.a { color: #002244; }');
        expect(match.quality).toBe(QUALITY.NEAREST_COLOR);
        expect(severityFor(match)).toBe(SEVERITY_REVIEW);
    });

    it('scales with the tolerance rather than a fixed distance', () => {
        const match = matchFor('.a { color: #ef4444; }');
        // Same match, stricter standard for what counts as the same colour.
        expect(severityFor(match, { colorTolerance: 0.03 })).toBe(SEVERITY_REVIEW);
        expect(severityFor(match, { colorTolerance: 0.05 })).toBe(SEVERITY_INFO);
    });

    it('warns when rounding visibly resizes a value', () => {
        // 2px and 20% — both large enough to notice.
        const match = matchFor('.a { border-radius: 10px; }');
        expect(match.quality).toBe(QUALITY.ROUNDED);
        expect(severityFor(match)).toBe(SEVERITY_REVIEW);
    });

    it('stays quiet about a one-pixel rounding, whatever its percentage', () => {
        // 7px -> 6px is 14%, and invisible. Flagging it would train the reader
        // to ignore the colour that matters.
        const match = matchFor('.a { border-radius: 7px; }');
        expect(match.quality).toBe(QUALITY.ROUNDED);
        expect(severityFor(match)).toBe(SEVERITY_INFO);
    });

    it('stays quiet about a small proportional shift on a large value', () => {
        // 30px -> 32px is 2px but only 7%.
        const match = matchFor('.a { border-radius: 30px; }');
        expect(severityFor(match)).toBe(SEVERITY_INFO);
    });

    it('stays quiet across a real stylesheet at default settings', () => {
        // Nothing rounds by default, so a faithful conversion warns about
        // nothing at all — the header key stays hidden.
        const css = '.a { padding: 16px; color: #1f2937; font-size: 14px; border: 1px solid #e5e7eb; }';
        const result = convertCss(css, map);
        expect(hasReviewableMatches(result)).toBe(false);
    });
});
